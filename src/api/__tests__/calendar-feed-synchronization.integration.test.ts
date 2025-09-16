import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { EventRepository } from '../../repositories/EventRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';

describe('Calendar Feed Synchronization Integration Tests', () => {
  let testUser: any;
  let testCompany: any;
  let authCookie: string;
  let userRepository: UserRepository;
  let companyRepository: CompanyRepository;
  let eventRepository: EventRepository;

  beforeEach(async () => {
    // Initialize repositories
    userRepository = new UserRepository();
    companyRepository = new CompanyRepository();
    eventRepository = new EventRepository();

    // Create test company
    testCompany = await companyRepository.create({
      name: 'Sync Test Company',
      shareableUrl: 'sync-test-company-456'
    });

    // Create test user
    testUser = await userRepository.create({
      username: 'syncuser',
      passwordHash: 'hashedpassword',
      companyId: testCompany.id
    });

    // Login to get auth cookie
    const loginResponse = await request(app)
      .post('/login')
      .send({
        username: 'syncuser',
        password: 'hashedpassword'
      });

    authCookie = loginResponse.headers['set-cookie'][0];
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser) {
      await userRepository.delete(testUser.id);
    }
    if (testCompany) {
      await companyRepository.delete(testCompany.id);
    }
  });

  describe('Complete Event Lifecycle Synchronization', () => {
    it('should reflect complete event lifecycle in calendar feed', async () => {
      // Step 1: Initial empty feed
      let feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('BEGIN:VCALENDAR');
      expect(feedResponse.text).toContain('END:VCALENDAR');
      expect(feedResponse.text).not.toContain('BEGIN:VEVENT');

      // Step 2: Create first event
      const event1Data = {
        title: 'Team Standup',
        description: 'Daily team standup meeting',
        startDateTime: '2024-12-16T09:00:00Z',
        endDateTime: '2024-12-16T09:30:00Z',
        location: 'Conference Room A',
        isPublic: true
      };

      const createResponse1 = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(event1Data);

      expect(createResponse1.status).toBe(201);
      const event1 = createResponse1.body.event;

      // Verify feed contains the new event
      feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('SUMMARY:Team Standup');
      expect(feedResponse.text).toContain('DESCRIPTION:Daily team standup meeting');
      expect(feedResponse.text).toContain('LOCATION:Conference Room A');
      expect(feedResponse.text).toContain('DTSTART:20241216T090000Z');
      expect(feedResponse.text).toContain('DTEND:20241216T093000Z');

      // Step 3: Create second event
      const event2Data = {
        title: 'Project Review',
        description: 'Weekly project review session',
        startDateTime: '2024-12-16T14:00:00Z',
        endDateTime: '2024-12-16T15:00:00Z',
        location: 'Meeting Room B',
        isPublic: true
      };

      const createResponse2 = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(event2Data);

      expect(createResponse2.status).toBe(201);
      const event2 = createResponse2.body.event;

      // Verify feed contains both events
      feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('SUMMARY:Team Standup');
      expect(feedResponse.text).toContain('SUMMARY:Project Review');
      
      // Count VEVENT blocks
      const eventBlocks = feedResponse.text.match(/BEGIN:VEVENT/g);
      expect(eventBlocks).toHaveLength(2);

      // Step 4: Update first event
      const updateData = {
        title: 'Daily Standup (Updated)',
        description: 'Updated daily team standup meeting',
        location: 'Conference Room C'
      };

      const updateResponse = await request(app)
        .put(`/api/events/${event1.id}`)
        .set('Cookie', authCookie)
        .send(updateData);

      expect(updateResponse.status).toBe(200);

      // Verify feed reflects the update
      feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('SUMMARY:Daily Standup (Updated)');
      expect(feedResponse.text).toContain('DESCRIPTION:Updated daily team standup meeting');
      expect(feedResponse.text).toContain('LOCATION:Conference Room C');
      expect(feedResponse.text).not.toContain('SUMMARY:Team Standup');
      expect(feedResponse.text).toContain('SUMMARY:Project Review'); // Second event unchanged

      // Step 5: Delete second event
      const deleteResponse = await request(app)
        .delete(`/api/events/${event2.id}`)
        .set('Cookie', authCookie);

      expect(deleteResponse.status).toBe(200);

      // Verify feed no longer contains deleted event
      feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('SUMMARY:Daily Standup (Updated)');
      expect(feedResponse.text).not.toContain('SUMMARY:Project Review');
      
      // Should only have one VEVENT block now
      const finalEventBlocks = feedResponse.text.match(/BEGIN:VEVENT/g);
      expect(finalEventBlocks).toHaveLength(1);

      // Step 6: Delete remaining event
      const deleteResponse2 = await request(app)
        .delete(`/api/events/${event1.id}`)
        .set('Cookie', authCookie);

      expect(deleteResponse2.status).toBe(200);

      // Verify feed is empty again
      feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('BEGIN:VCALENDAR');
      expect(feedResponse.text).toContain('END:VCALENDAR');
      expect(feedResponse.text).not.toContain('BEGIN:VEVENT');
    });

    it('should handle private events correctly in feed', async () => {
      // Create public event
      const publicEventData = {
        title: 'Public Meeting',
        description: 'This is a public meeting',
        startDateTime: '2024-12-16T10:00:00Z',
        endDateTime: '2024-12-16T11:00:00Z',
        isPublic: true
      };

      await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(publicEventData);

      // Create private event
      const privateEventData = {
        title: 'Private Meeting',
        description: 'This is a private meeting',
        startDateTime: '2024-12-16T12:00:00Z',
        endDateTime: '2024-12-16T13:00:00Z',
        isPublic: false
      };

      await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(privateEventData);

      // Verify feed only contains public event
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('SUMMARY:Public Meeting');
      expect(feedResponse.text).not.toContain('SUMMARY:Private Meeting');
      
      const eventBlocks = feedResponse.text.match(/BEGIN:VEVENT/g);
      expect(eventBlocks).toHaveLength(1);
    });

    it('should maintain proper iCal format throughout event lifecycle', async () => {
      // Create event with special characters
      const eventData = {
        title: 'Meeting; with, special\\characters\nand newlines',
        description: 'Description with; commas, backslashes\\ and\nnewlines',
        startDateTime: '2024-12-16T15:00:00Z',
        endDateTime: '2024-12-16T16:00:00Z',
        location: 'Room; A, Building\\B\nFloor 2',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData);

      expect(createResponse.status).toBe(201);

      // Verify feed properly escapes special characters
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      expect(feedResponse.text).toContain('SUMMARY:Meeting\\; with\\, special\\\\characters\\nand newlines');
      expect(feedResponse.text).toContain('LOCATION:Room\\; A\\, Building\\\\B\\nFloor 2');
      
      // Verify proper line endings
      expect(feedResponse.text).toContain('\r\n');
      
      // Verify proper iCal structure
      expect(feedResponse.text).toMatch(/^BEGIN:VCALENDAR\r\n/);
      expect(feedResponse.text).toMatch(/END:VCALENDAR$/);
    });
  });

  describe('Feed Caching and Invalidation', () => {
    it('should serve cached feed and invalidate on changes', async () => {
      // Create initial event
      const eventData = {
        title: 'Cache Test Event',
        description: 'Testing cache behavior',
        startDateTime: '2024-12-16T16:00:00Z',
        endDateTime: '2024-12-16T17:00:00Z',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData);

      const event = createResponse.body.event;

      // First request - should be cache miss
      const firstResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');
      expect(firstResponse.text).toContain('SUMMARY:Cache Test Event');

      // Second request - should be cache hit
      const secondResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // Update event - should invalidate cache
      await request(app)
        .put(`/api/events/${event.id}`)
        .set('Cookie', authCookie)
        .send({ title: 'Updated Cache Test Event' });

      // Next request - should be cache miss due to invalidation
      const thirdResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(thirdResponse.status).toBe(200);
      expect(thirdResponse.headers['x-cache']).toBe('MISS');
      expect(thirdResponse.text).toContain('SUMMARY:Updated Cache Test Event');
      expect(thirdResponse.text).not.toContain('SUMMARY:Cache Test Event');
    });
  });

  describe('Calendar Application Compatibility', () => {
    it('should generate feed compatible with major calendar applications', async () => {
      // Create a comprehensive event with all fields
      const eventData = {
        title: 'Comprehensive Test Event',
        description: 'Event with all possible fields for compatibility testing',
        startDateTime: '2024-12-20T10:00:00Z',
        endDateTime: '2024-12-20T11:30:00Z',
        location: 'Main Conference Room',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData);

      const event = createResponse.body.event;

      // Get the feed
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);
      
      expect(feedResponse.status).toBe(200);
      
      const feed = feedResponse.text;
      
      // Verify RFC 5545 compliance
      expect(feed).toMatch(/^BEGIN:VCALENDAR\r\n/);
      expect(feed).toContain('VERSION:2.0\r\n');
      expect(feed).toContain('PRODID:-//Company Calendar Platform//Calendar Feed//EN\r\n');
      expect(feed).toContain('CALSCALE:GREGORIAN\r\n');
      expect(feed).toContain('METHOD:PUBLISH\r\n');
      
      // Verify event structure
      expect(feed).toContain('BEGIN:VEVENT\r\n');
      expect(feed).toContain(`UID:${event.id}@company-calendar-platform.com\r\n`);
      expect(feed).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
      expect(feed).toContain('DTSTART:20241220T100000Z\r\n');
      expect(feed).toContain('DTEND:20241220T113000Z\r\n');
      expect(feed).toContain('SUMMARY:Comprehensive Test Event\r\n');
      expect(feed).toContain('DESCRIPTION:Event with all possible fields for compatibility testing\r\n');
      expect(feed).toContain('LOCATION:Main Conference Room\r\n');
      expect(feed).toContain('END:VEVENT\r\n');
      expect(feed).toMatch(/END:VCALENDAR$/);
      
      // Verify proper Content-Type header
      expect(feedResponse.headers['content-type']).toContain('text/calendar');
      expect(feedResponse.headers['content-type']).toContain('charset=utf-8');
      
      // Verify Content-Disposition header for download
      expect(feedResponse.headers['content-disposition']).toContain('attachment');
      expect(feedResponse.headers['content-disposition']).toContain(`filename="${testCompany.name}-calendar.ics"`);
    });
  });
});