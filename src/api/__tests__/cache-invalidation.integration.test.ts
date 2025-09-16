import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { EventRepository } from '../../repositories/EventRepository';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { CalendarRoutes } from '../routes/calendar';

describe('Cache Invalidation Integration Tests', () => {
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
      name: 'Test Company',
      shareableUrl: 'test-cache-company-123'
    });

    // Create test user
    testUser = await userRepository.create({
      username: 'testuser',
      passwordHash: 'hashedpassword',
      companyId: testCompany.id
    });

    // Login to get auth cookie
    const loginResponse = await request(app)
      .post('/login')
      .send({
        username: 'testuser',
        password: 'hashedpassword'
      });

    authCookie = loginResponse.headers['set-cookie'][0];

    // Spy on the cache invalidation method
    vi.spyOn(CalendarRoutes, 'invalidateCacheForCompany');
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser) {
      await userRepository.delete(testUser.id);
    }
    if (testCompany) {
      await companyRepository.delete(testCompany.id);
    }

    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('Event Creation Cache Invalidation', () => {
    it('should invalidate cache when creating a new event', async () => {
      // Arrange
      const eventData = {
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: '2024-12-15T10:00:00Z',
        endDateTime: '2024-12-15T11:00:00Z',
        location: 'Test Location',
        isPublic: true
      };

      // Act
      const response = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(CalendarRoutes.invalidateCacheForCompany).toHaveBeenCalledWith(testCompany.id);
    });

    it('should not invalidate cache when event creation fails', async () => {
      // Arrange
      const invalidEventData = {
        title: '', // Invalid empty title
        description: '',
        startDateTime: '2024-12-15T10:00:00Z',
        endDateTime: '2024-12-15T11:00:00Z'
      };

      // Act
      const response = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(invalidEventData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(CalendarRoutes.invalidateCacheForCompany).not.toHaveBeenCalled();
    });
  });

  describe('Event Update Cache Invalidation', () => {
    let testEvent: any;

    beforeEach(async () => {
      // Create a test event
      testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Original Event',
        description: 'Original Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      // Clear any previous calls to the spy
      vi.clearAllMocks();
    });

    afterEach(async () => {
      if (testEvent) {
        await eventRepository.delete(testEvent.id);
      }
    });

    it('should invalidate cache when updating an event', async () => {
      // Arrange
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated Description'
      };

      // Act
      const response = await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Cookie', authCookie)
        .send(updateData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(CalendarRoutes.invalidateCacheForCompany).toHaveBeenCalledWith(testCompany.id);
    });

    it('should not invalidate cache when event update fails', async () => {
      // Arrange
      const invalidUpdateData = {
        title: '' // Invalid empty title
      };

      // Act
      const response = await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Cookie', authCookie)
        .send(invalidUpdateData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(CalendarRoutes.invalidateCacheForCompany).not.toHaveBeenCalled();
    });
  });

  describe('Event Deletion Cache Invalidation', () => {
    let testEvent: any;

    beforeEach(async () => {
      // Create a test event
      testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Event to Delete',
        description: 'This event will be deleted',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      // Clear any previous calls to the spy
      vi.clearAllMocks();
    });

    it('should invalidate cache when deleting an event', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/events/${testEvent.id}`)
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(CalendarRoutes.invalidateCacheForCompany).toHaveBeenCalledWith(testCompany.id);

      // Clean up flag to prevent double deletion in afterEach
      testEvent = null;
    });

    it('should not invalidate cache when event deletion fails', async () => {
      // Act - try to delete non-existent event
      const response = await request(app)
        .delete('/api/events/non-existent-id')
        .set('Cookie', authCookie);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(CalendarRoutes.invalidateCacheForCompany).not.toHaveBeenCalled();
    });
  });

  describe('Calendar Feed Cache Behavior', () => {
    let testEvent: any;

    beforeEach(async () => {
      // Create a test event
      testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Cache Test Event',
        description: 'Event for cache testing',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });
    });

    afterEach(async () => {
      if (testEvent) {
        await eventRepository.delete(testEvent.id);
      }
    });

    it('should serve fresh feed after cache invalidation', async () => {
      // First request - should populate cache
      const firstResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers['x-cache']).toBe('MISS');
      expect(firstResponse.text).toContain('Cache Test Event');

      // Second request - should use cache
      const secondResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.headers['x-cache']).toBe('HIT');

      // Update the event (this should invalidate cache)
      await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Cookie', authCookie)
        .send({
          title: 'Updated Cache Test Event'
        });

      // Third request - should be fresh (cache miss) due to invalidation
      const thirdResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`);

      expect(thirdResponse.status).toBe(200);
      expect(thirdResponse.headers['x-cache']).toBe('MISS');
      expect(thirdResponse.text).toContain('Updated Cache Test Event');
    });
  });
});