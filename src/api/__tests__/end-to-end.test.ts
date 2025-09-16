import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { WidgetConfigRepository } from '../../repositories/WidgetConfigRepository';
import { AuthenticationService } from '../../services/AuthenticationService';
import { User, Company, Event, WidgetConfig } from '../../models';

describe('End-to-End User Workflows', () => {
  let userRepository: UserRepository;
  let companyRepository: CompanyRepository;
  let eventRepository: EventRepository;
  let widgetConfigRepository: WidgetConfigRepository;
  let authService: AuthenticationService;
  
  let testCompany: Company;
  let testUser: User;
  let authToken: string;
  let createdEvents: Event[] = [];

  beforeEach(async () => {
    // Initialize repositories and services
    userRepository = new UserRepository();
    companyRepository = new CompanyRepository();
    eventRepository = new EventRepository();
    widgetConfigRepository = new WidgetConfigRepository();
    authService = new AuthenticationService(userRepository);

    // Create test company
    testCompany = await companyRepository.create({
      name: 'E2E Test Company',
      shareableUrl: `e2e-test-${Date.now()}`
    });

    // Create test user
    const hashedPassword = await authService.hashPassword('testpassword123');
    testUser = await userRepository.create({
      username: `e2euser${Date.now()}`,
      passwordHash: hashedPassword,
      companyId: testCompany.id
    });

    // Authenticate and get token
    const authResult = await authService.authenticate(testUser.username, 'testpassword123');
    authToken = authResult.token!;

    // Clear events array
    createdEvents = [];
  });

  afterEach(async () => {
    try {
      // Clean up created events
      for (const event of createdEvents) {
        try {
          await eventRepository.delete(event.id);
        } catch (error) {
          console.warn(`Failed to delete event ${event.id}:`, error);
        }
      }

      // Clean up test data
      await userRepository.delete(testUser.id);
      await companyRepository.delete(testCompany.id);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Complete Admin Workflow: Login → Create Event → Share Calendar', () => {
    it('should complete full admin workflow successfully', async () => {
      // Step 1: Access login page
      const loginPageResponse = await request(app)
        .get('/login')
        .expect(200);

      expect(loginPageResponse.text).toContain('Company Calendar - Login');
      expect(loginPageResponse.text).toContain('id="username"');
      expect(loginPageResponse.text).toContain('id="password"');

      // Step 2: Login with credentials
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.user.username).toBe(testUser.username);

      const cookies = loginResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const authCookie = cookies[0];

      // Step 3: Access dashboard
      const dashboardResponse = await request(app)
        .get('/dashboard')
        .set('Cookie', authCookie)
        .expect(200);

      expect(dashboardResponse.text).toContain('Company Calendar Dashboard');
      expect(dashboardResponse.text).toContain(`Welcome, ${testUser.username}`);

      // Step 4: Access events management page
      const eventsPageResponse = await request(app)
        .get('/events')
        .set('Cookie', authCookie)
        .expect(200);

      expect(eventsPageResponse.text).toContain('Manage Events');
      expect(eventsPageResponse.text).toContain('Create Event');

      // Step 5: Create a new event
      const eventData = {
        title: 'E2E Test Event',
        description: 'This is an end-to-end test event',
        startDateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        endDateTime: new Date(Date.now() + 90000000).toISOString(), // Tomorrow + 1 hour
        location: 'Test Location',
        isPublic: true
      };

      const createEventResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      expect(createEventResponse.body.success).toBe(true);
      expect(createEventResponse.body.event.title).toBe(eventData.title);
      expect(createEventResponse.body.event.companyId).toBe(testCompany.id);

      const createdEvent = createEventResponse.body.event;
      createdEvents.push(createdEvent);

      // Step 6: Verify event appears in events list
      const eventsListResponse = await request(app)
        .get('/api/events')
        .set('Cookie', authCookie)
        .expect(200);

      expect(eventsListResponse.body.success).toBe(true);
      expect(eventsListResponse.body.events).toHaveLength(1);
      expect(eventsListResponse.body.events[0].title).toBe(eventData.title);

      // Step 7: Access calendar sharing page
      const calendarPageResponse = await request(app)
        .get('/calendar')
        .set('Cookie', authCookie)
        .expect(200);

      expect(calendarPageResponse.text).toContain('Calendar Sharing');
      expect(calendarPageResponse.text).toContain('Shareable URL');
      expect(calendarPageResponse.text).toContain(testCompany.shareableUrl);

      // Step 8: Get shareable URL information
      const shareUrlResponse = await request(app)
        .get('/api/calendar/share-url')
        .set('Cookie', authCookie)
        .expect(200);

      expect(shareUrlResponse.body.success).toBe(true);
      expect(shareUrlResponse.body.shareableUrl).toBe(testCompany.shareableUrl);
      expect(shareUrlResponse.body.calendarUrls).toBeDefined();
      expect(shareUrlResponse.body.calendarUrls.icalFeed).toContain('feed.ics');

      // Step 9: Verify public calendar is accessible
      const publicCalendarResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(publicCalendarResponse.text).toContain('Public Calendar');
      expect(publicCalendarResponse.text).toContain(eventData.title);
      expect(publicCalendarResponse.text).toContain('Add to Google Calendar');
      expect(publicCalendarResponse.text).toContain('Add to Outlook');

      // Step 10: Verify calendar feed is accessible
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(feedResponse.headers['content-type']).toMatch(/text\/calendar/);
      expect(feedResponse.text).toContain('BEGIN:VCALENDAR');
      expect(feedResponse.text).toContain('BEGIN:VEVENT');
      expect(feedResponse.text).toContain(eventData.title);
      expect(feedResponse.text).toContain('END:VEVENT');
      expect(feedResponse.text).toContain('END:VCALENDAR');
    });

    it('should handle event editing in admin workflow', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create initial event
      const eventData = {
        title: 'Original Event Title',
        description: 'Original description',
        startDateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 90000000).toISOString(),
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      const createdEvent = createResponse.body.event;
      createdEvents.push(createdEvent);

      // Edit the event
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated description with more details',
        location: 'New Location'
      };

      const updateResponse = await request(app)
        .put(`/api/events/${createdEvent.id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.event.title).toBe(updateData.title);
      expect(updateResponse.body.event.description).toBe(updateData.description);
      expect(updateResponse.body.event.location).toBe(updateData.location);

      // Verify updated event appears in public calendar
      const publicCalendarResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(publicCalendarResponse.text).toContain(updateData.title);
      expect(publicCalendarResponse.text).toContain(updateData.description);

      // Verify updated event appears in calendar feed
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(feedResponse.text).toContain(updateData.title);
      expect(feedResponse.text).toContain(updateData.description);
    });

    it('should handle event deletion in admin workflow', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create event to delete
      const eventData = {
        title: 'Event to Delete',
        description: 'This event will be deleted',
        startDateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 90000000).toISOString(),
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      const createdEvent = createResponse.body.event;

      // Verify event exists in public calendar
      const beforeDeleteResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(beforeDeleteResponse.text).toContain(eventData.title);

      // Delete the event
      const deleteResponse = await request(app)
        .delete(`/api/events/${createdEvent.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify event no longer exists in events list
      const eventsListResponse = await request(app)
        .get('/api/events')
        .set('Cookie', authCookie)
        .expect(200);

      expect(eventsListResponse.body.events).toHaveLength(0);

      // Verify event no longer appears in public calendar
      const afterDeleteResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(afterDeleteResponse.text).not.toContain(eventData.title);

      // Verify event no longer appears in calendar feed
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(feedResponse.text).not.toContain(eventData.title);
    });
  });

  describe('Public Access Workflow: View Calendar → Subscribe → Receive Updates', () => {
    it('should complete full public access workflow', async () => {
      // Setup: Create events as admin first
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create multiple events
      const events = [
        {
          title: 'Public Event 1',
          description: 'First public event',
          startDateTime: new Date(Date.now() + 86400000).toISOString(),
          endDateTime: new Date(Date.now() + 90000000).toISOString(),
          isPublic: true
        },
        {
          title: 'Public Event 2',
          description: 'Second public event',
          startDateTime: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
          endDateTime: new Date(Date.now() + 176400000).toISOString(),
          isPublic: true
        }
      ];

      for (const eventData of events) {
        const createResponse = await request(app)
          .post('/api/events')
          .set('Cookie', authCookie)
          .send(eventData)
          .expect(201);
        
        createdEvents.push(createResponse.body.event);
      }

      // Step 1: Access public calendar without authentication
      const publicCalendarResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(publicCalendarResponse.text).toContain('Public Calendar');
      expect(publicCalendarResponse.text).toContain('Public Event 1');
      expect(publicCalendarResponse.text).toContain('Public Event 2');
      expect(publicCalendarResponse.text).toContain('First public event');
      expect(publicCalendarResponse.text).toContain('Second public event');

      // Step 2: Verify calendar integration buttons are present
      expect(publicCalendarResponse.text).toContain('Add to Google Calendar');
      expect(publicCalendarResponse.text).toContain('Add to Outlook');
      expect(publicCalendarResponse.text).toContain('Add to Apple Calendar');
      expect(publicCalendarResponse.text).toContain('Download iCal Feed');

      // Step 3: Test calendar subscription URLs
      expect(publicCalendarResponse.text).toContain('calendar.google.com');
      expect(publicCalendarResponse.text).toContain('outlook.live.com');
      expect(publicCalendarResponse.text).toContain('webcal://');

      // Step 4: Access iCal feed for subscription
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(feedResponse.headers['content-type']).toMatch(/text\/calendar/);
      expect(feedResponse.text).toContain('BEGIN:VCALENDAR');
      expect(feedResponse.text).toContain('VERSION:2.0');
      expect(feedResponse.text).toContain('PRODID:');

      // Verify both events are in the feed
      const eventMatches = feedResponse.text.match(/BEGIN:VEVENT/g);
      expect(eventMatches).toHaveLength(2);
      expect(feedResponse.text).toContain('Public Event 1');
      expect(feedResponse.text).toContain('Public Event 2');

      // Step 5: Test automatic updates - modify an event
      const updateData = {
        title: 'Updated Public Event 1',
        description: 'Updated description for first event'
      };

      await request(app)
        .put(`/api/events/${createdEvents[0].id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      // Step 6: Verify updates appear in public calendar
      const updatedCalendarResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(updatedCalendarResponse.text).toContain('Updated Public Event 1');
      expect(updatedCalendarResponse.text).toContain('Updated description for first event');
      expect(updatedCalendarResponse.text).not.toContain('Public Event 1'); // Old title should be gone

      // Step 7: Verify updates appear in calendar feed
      const updatedFeedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(updatedFeedResponse.text).toContain('Updated Public Event 1');
      expect(updatedFeedResponse.text).toContain('Updated description for first event');
      expect(updatedFeedResponse.text).not.toContain('SUMMARY:Public Event 1'); // Old title should be gone

      // Step 8: Test event deletion updates
      await request(app)
        .delete(`/api/events/${createdEvents[1].id}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Step 9: Verify deletion reflected in public calendar
      const afterDeleteCalendarResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}`)
        .expect(200);

      expect(afterDeleteCalendarResponse.text).toContain('Updated Public Event 1');
      expect(afterDeleteCalendarResponse.text).not.toContain('Public Event 2');

      // Step 10: Verify deletion reflected in calendar feed
      const afterDeleteFeedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const finalEventMatches = afterDeleteFeedResponse.text.match(/BEGIN:VEVENT/g);
      expect(finalEventMatches).toHaveLength(1);
      expect(afterDeleteFeedResponse.text).toContain('Updated Public Event 1');
      expect(afterDeleteFeedResponse.text).not.toContain('Public Event 2');
    });

    it('should handle invalid share URLs gracefully', async () => {
      // Test non-existent share URL
      const invalidResponse = await request(app)
        .get('/calendar/non-existent-url')
        .expect(404);

      expect(invalidResponse.text).toContain('Calendar Not Found');

      // Test invalid feed URL
      const invalidFeedResponse = await request(app)
        .get('/calendar/non-existent-url/feed.ics')
        .expect(404);

      expect(invalidFeedResponse.text).toContain('Calendar not found');
    });
  });

  describe('Widget Embedding Workflow: Generate Code → Embed → Display Events', () => {
    it('should complete full widget embedding workflow', async () => {
      // Setup: Login and create events
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create test event for widget
      const eventData = {
        title: 'Widget Test Event',
        description: 'Event for widget testing',
        startDateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 90000000).toISOString(),
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      createdEvents.push(createResponse.body.event);

      // Step 1: Access widget generator page
      const widgetPageResponse = await request(app)
        .get('/widget')
        .set('Cookie', authCookie)
        .expect(200);

      expect(widgetPageResponse.text).toContain('Widget Generator');
      expect(widgetPageResponse.text).toContain('Widget Configuration');
      expect(widgetPageResponse.text).toContain('Preview & Code');

      // Step 2: Get current widget configuration
      const configResponse = await request(app)
        .get('/widget/config')
        .set('Cookie', authCookie)
        .expect(200);

      expect(configResponse.body.success).toBe(true);
      expect(configResponse.body.config).toBeDefined();
      expect(configResponse.body.config.companyId).toBe(testCompany.id);

      // Step 3: Customize widget configuration
      const customConfig = {
        theme: 'dark' as const,
        primaryColor: '#ff6b35',
        showUpcomingOnly: true,
        maxEvents: 5,
        dateFormat: 'MMM dd, yyyy'
      };

      const updateConfigResponse = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send(customConfig)
        .expect(200);

      expect(updateConfigResponse.body.success).toBe(true);
      expect(updateConfigResponse.body.config.theme).toBe('dark');
      expect(updateConfigResponse.body.config.primaryColor).toBe('#ff6b35');

      // Step 4: Generate widget embed code
      const scriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      expect(scriptResponse.body.success).toBe(true);
      expect(scriptResponse.body.script).toContain('const config = {');
      expect(scriptResponse.body.script).toContain(`"companyId": "${testCompany.id}"`);
      expect(scriptResponse.body.script).toContain('"theme": "dark"');
      expect(scriptResponse.body.script).toContain('"primaryColor": "#ff6b35"');
      expect(scriptResponse.body.script).toContain('createWidget');

      // Step 5: Test widget events API (public endpoint)
      const widgetEventsResponse = await request(app)
        .get(`/widget/${testCompany.id}/events`)
        .expect(200);

      expect(Array.isArray(widgetEventsResponse.body)).toBe(true);
      expect(widgetEventsResponse.body).toHaveLength(1);
      expect(widgetEventsResponse.body[0].title).toBe('Widget Test Event');
      expect(widgetEventsResponse.body[0].description).toBe('Event for widget testing');

      // Step 6: Test widget with different configuration settings
      const limitedConfig = {
        maxEvents: 0, // Should return no events
        showUpcomingOnly: true
      };

      await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send(limitedConfig)
        .expect(200);

      const limitedEventsResponse = await request(app)
        .get(`/widget/${testCompany.id}/events`)
        .expect(200);

      expect(limitedEventsResponse.body).toHaveLength(0);

      // Step 7: Reset configuration and verify events return
      const resetConfig = {
        maxEvents: 10,
        showUpcomingOnly: true
      };

      await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send(resetConfig)
        .expect(200);

      const resetEventsResponse = await request(app)
        .get(`/widget/${testCompany.id}/events`)
        .expect(200);

      expect(resetEventsResponse.body).toHaveLength(1);

      // Step 8: Test widget with multiple events
      const additionalEvent = {
        title: 'Second Widget Event',
        description: 'Another event for widget',
        startDateTime: new Date(Date.now() + 172800000).toISOString(),
        endDateTime: new Date(Date.now() + 176400000).toISOString(),
        isPublic: true
      };

      const secondEventResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(additionalEvent)
        .expect(201);

      createdEvents.push(secondEventResponse.body.event);

      const multipleEventsResponse = await request(app)
        .get(`/widget/${testCompany.id}/events`)
        .expect(200);

      expect(multipleEventsResponse.body).toHaveLength(2);
      expect(multipleEventsResponse.body.map((e: any) => e.title)).toContain('Widget Test Event');
      expect(multipleEventsResponse.body.map((e: any) => e.title)).toContain('Second Widget Event');

      // Step 9: Verify widget script includes calendar integration
      const finalScriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      expect(finalScriptResponse.body.script).toContain('addToGoogleCalendar');
      expect(finalScriptResponse.body.script).toContain('addToOutlook');
      expect(finalScriptResponse.body.script).toContain('addToAppleCalendar');
      expect(finalScriptResponse.body.script).toContain('downloadIcal');
    });

    it('should handle widget configuration validation', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Test invalid theme
      const invalidThemeResponse = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send({ theme: 'invalid-theme' })
        .expect(400);

      expect(invalidThemeResponse.body.success).toBe(false);
      expect(invalidThemeResponse.body.error).toContain('Invalid theme value');

      // Test invalid color format
      const invalidColorResponse = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send({ primaryColor: 'not-a-color' })
        .expect(400);

      expect(invalidColorResponse.body.success).toBe(false);
      expect(invalidColorResponse.body.error).toContain('Invalid color format');

      // Test negative maxEvents
      const invalidMaxEventsResponse = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send({ maxEvents: -1 })
        .expect(400);

      expect(invalidMaxEventsResponse.body.success).toBe(false);
      expect(invalidMaxEventsResponse.body.error).toContain('maxEvents must be non-negative');
    });
  });

  describe('Calendar Application Integration Validation', () => {
    it('should generate valid calendar application URLs', async () => {
      // Setup: Create event and get share URL
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const eventData = {
        title: 'Integration Test Event',
        description: 'Event for testing calendar integration',
        startDateTime: new Date(Date.now() + 86400000).toISOString(),
        endDateTime: new Date(Date.now() + 90000000).toISOString(),
        location: 'Test Location',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      createdEvents.push(createResponse.body.event);

      // Get calendar URLs
      const shareUrlResponse = await request(app)
        .get('/api/calendar/share-url')
        .set('Cookie', authCookie)
        .expect(200);

      const calendarUrls = shareUrlResponse.body.calendarUrls;

      // Validate Google Calendar URL format
      expect(calendarUrls.googleCalendar).toContain('calendar.google.com/calendar/render');
      expect(calendarUrls.googleCalendar).toContain('cid=');
      expect(calendarUrls.googleCalendar).toContain(encodeURIComponent(calendarUrls.icalFeed));

      // Validate Outlook Calendar URL format
      expect(calendarUrls.outlookCalendar).toContain('outlook.live.com/calendar/0/addcalendar');
      expect(calendarUrls.outlookCalendar).toContain('url=');
      expect(calendarUrls.outlookCalendar).toContain(encodeURIComponent(calendarUrls.icalFeed));

      // Validate Apple Calendar URL format (webcal protocol)
      expect(calendarUrls.appleCalendar).toStartWith('webcal://');
      expect(calendarUrls.appleCalendar).toContain('feed.ics');

      // Validate iCal feed URL
      expect(calendarUrls.icalFeed).toContain(`/calendar/${testCompany.shareableUrl}/feed.ics`);

      // Test that the iCal feed URL actually works
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(feedResponse.headers['content-type']).toMatch(/text\/calendar/);
      expect(feedResponse.text).toContain('Integration Test Event');
    });

    it('should validate iCal feed format compliance', async () => {
      // Setup event
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const eventData = {
        title: 'iCal Format Test Event',
        description: 'Testing iCal format compliance with special characters: àáâãäåæçèéêë',
        startDateTime: new Date('2024-12-15T10:00:00Z').toISOString(),
        endDateTime: new Date('2024-12-15T11:00:00Z').toISOString(),
        location: 'Test Location with, commas and; semicolons',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      createdEvents.push(createResponse.body.event);

      // Get iCal feed
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const icalContent = feedResponse.text;

      // Validate iCal structure
      expect(icalContent).toMatch(/^BEGIN:VCALENDAR\r?\n/);
      expect(icalContent).toMatch(/\r?\nEND:VCALENDAR\r?\n?$/);
      expect(icalContent).toContain('VERSION:2.0');
      expect(icalContent).toContain('PRODID:');
      expect(icalContent).toContain('BEGIN:VEVENT');
      expect(icalContent).toContain('END:VEVENT');

      // Validate required VEVENT properties
      expect(icalContent).toMatch(/UID:[^\r\n]+/);
      expect(icalContent).toMatch(/DTSTART:[0-9]{8}T[0-9]{6}Z/);
      expect(icalContent).toMatch(/DTEND:[0-9]{8}T[0-9]{6}Z/);
      expect(icalContent).toMatch(/DTSTAMP:[0-9]{8}T[0-9]{6}Z/);
      expect(icalContent).toContain('SUMMARY:iCal Format Test Event');

      // Validate proper escaping of special characters
      expect(icalContent).toContain('LOCATION:Test Location with\\, commas and\\; semicolons');
      
      // Validate line folding (lines should not exceed 75 characters)
      const lines = icalContent.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith(' ')) { // Continuation lines start with space
          expect(line.length).toBeLessThanOrEqual(75);
        }
      }
    });
  });
});