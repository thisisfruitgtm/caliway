import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { AuthenticationService } from '../../services/AuthenticationService';

describe('Events API Integration Tests', () => {
  let authToken: string;
  let testUser: any;
  let testCompany: any;
  let userRepository: UserRepository;
  let companyRepository: CompanyRepository;
  let eventRepository: EventRepository;
  let authService: AuthenticationService;

  beforeEach(async () => {
    // Initialize repositories
    userRepository = new UserRepository();
    companyRepository = new CompanyRepository();
    eventRepository = new EventRepository();
    authService = new AuthenticationService(userRepository);

    // Create test company
    testCompany = await companyRepository.create({
      name: 'Test Company',
      shareableUrl: 'test-company-url'
    });

    // Create test user
    const hashedPassword = await authService.hashPassword('testpassword123');
    testUser = await userRepository.create({
      username: 'testuser',
      passwordHash: hashedPassword,
      companyId: testCompany.id
    });

    // Authenticate and get token
    const authResult = await authService.authenticate('testuser', 'testpassword123');
    authToken = authResult.token!;
  });

  afterEach(async () => {
    // Clean up test data
    try {
      // Delete all events for the test company
      const events = await eventRepository.findByCompanyId(testCompany.id);
      for (const event of events) {
        await eventRepository.delete(event.id);
      }
      
      // Delete test user and company
      await userRepository.delete(testUser.id);
      await companyRepository.delete(testCompany.id);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('GET /events', () => {
    it('should render events page for authenticated user', async () => {
      const response = await request(app)
        .get('/events')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.text).toContain('Manage Events');
      expect(response.text).toContain('Create Event');
    });

    it('should redirect to login for unauthenticated user', async () => {
      const response = await request(app)
        .get('/events');

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/login');
    });
  });

  describe('GET /api/events', () => {
    it('should return empty events list for new company', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.events).toEqual([]);
    });

    it('should return company events', async () => {
      // Create test event
      const testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const response = await request(app)
        .get('/api/events')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].title).toBe('Test Event');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/events');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/events', () => {
    it('should create a new event', async () => {
      const eventData = {
        title: 'New Test Event',
        description: 'This is a test event description',
        startDateTime: '2024-12-15T10:00:00Z',
        endDateTime: '2024-12-15T11:00:00Z',
        location: 'Test Location',
        isPublic: true
      };

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `authToken=${authToken}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.event.title).toBe(eventData.title);
      expect(response.body.event.companyId).toBe(testCompany.id);
    });

    it('should validate required fields', async () => {
      const eventData = {
        title: '',
        description: '',
        startDateTime: '2024-12-15T10:00:00Z',
        endDateTime: '2024-12-15T11:00:00Z'
      };

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `authToken=${authToken}`)
        .send(eventData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should validate date range', async () => {
      const eventData = {
        title: 'Invalid Event',
        description: 'This event has invalid dates',
        startDateTime: '2024-12-15T11:00:00Z',
        endDateTime: '2024-12-15T10:00:00Z' // End before start
      };

      const response = await request(app)
        .post('/api/events')
        .set('Cookie', `authToken=${authToken}`)
        .send(eventData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Start date and time must be before end date and time');
    });

    it('should require authentication', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: '2024-12-15T10:00:00Z',
        endDateTime: '2024-12-15T11:00:00Z'
      };

      const response = await request(app)
        .post('/api/events')
        .send(eventData);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/events/:id', () => {
    it('should return specific event', async () => {
      // Create test event
      const testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const response = await request(app)
        .get(`/api/events/${testEvent.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.event.id).toBe(testEvent.id);
      expect(response.body.event.title).toBe('Test Event');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/api/events/non-existent-id')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should deny access to events from other companies', async () => {
      // Create another company and event
      const otherCompany = await companyRepository.create({
        name: 'Other Company',
        shareableUrl: 'other-company-url'
      });

      const otherEvent = await eventRepository.create({
        companyId: otherCompany.id,
        title: 'Other Event',
        description: 'Other Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const response = await request(app)
        .get(`/api/events/${otherEvent.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');

      // Cleanup
      await eventRepository.delete(otherEvent.id);
      await companyRepository.delete(otherCompany.id);
    });
  });

  describe('PUT /api/events/:id', () => {
    it('should update existing event', async () => {
      // Create test event
      const testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Original Title',
        description: 'Original Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description'
      };

      const response = await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Cookie', `authToken=${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.event.title).toBe('Updated Title');
      expect(response.body.event.description).toBe('Updated Description');
    });

    it('should validate updated data', async () => {
      // Create test event
      const testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Original Title',
        description: 'Original Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const updateData = {
        title: '', // Invalid empty title
        startDateTime: '2024-12-15T11:00:00Z',
        endDateTime: '2024-12-15T10:00:00Z' // End before start
      };

      const response = await request(app)
        .put(`/api/events/${testEvent.id}`)
        .set('Cookie', `authToken=${authToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent event', async () => {
      const updateData = {
        title: 'Updated Title'
      };

      const response = await request(app)
        .put('/api/events/non-existent-id')
        .set('Cookie', `authToken=${authToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should deny access to events from other companies', async () => {
      // Create another company and event
      const otherCompany = await companyRepository.create({
        name: 'Other Company',
        shareableUrl: 'other-company-url'
      });

      const otherEvent = await eventRepository.create({
        companyId: otherCompany.id,
        title: 'Other Event',
        description: 'Other Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const updateData = {
        title: 'Hacked Title'
      };

      const response = await request(app)
        .put(`/api/events/${otherEvent.id}`)
        .set('Cookie', `authToken=${authToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');

      // Cleanup
      await eventRepository.delete(otherEvent.id);
      await companyRepository.delete(otherCompany.id);
    });
  });

  describe('DELETE /api/events/:id', () => {
    it('should delete existing event', async () => {
      // Create test event
      const testEvent = await eventRepository.create({
        companyId: testCompany.id,
        title: 'Event to Delete',
        description: 'This event will be deleted',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const response = await request(app)
        .delete(`/api/events/${testEvent.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify event is deleted
      const getResponse = await request(app)
        .get(`/api/events/${testEvent.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .delete('/api/events/non-existent-id')
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should deny access to events from other companies', async () => {
      // Create another company and event
      const otherCompany = await companyRepository.create({
        name: 'Other Company',
        shareableUrl: 'other-company-url'
      });

      const otherEvent = await eventRepository.create({
        companyId: otherCompany.id,
        title: 'Other Event',
        description: 'Other Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      });

      const response = await request(app)
        .delete(`/api/events/${otherEvent.id}`)
        .set('Cookie', `authToken=${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');

      // Cleanup
      await eventRepository.delete(otherEvent.id);
      await companyRepository.delete(otherCompany.id);
    });
  });
});