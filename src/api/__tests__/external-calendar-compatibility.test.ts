import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { WidgetConfigRepository } from '../../repositories/WidgetConfigRepository';
import { AuthenticationService } from '../../services/AuthenticationService';
import { User, Company, Event } from '../../models';

describe('External Calendar Compatibility Tests', () => {
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
      name: 'Calendar Compatibility Test Company',
      shareableUrl: `compat-test-${Date.now()}`
    });

    // Create test user
    const hashedPassword = await authService.hashPassword('testpassword123');
    testUser = await userRepository.create({
      username: `compatuser${Date.now()}`,
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

  describe('iCal Feed Compatibility with Google Calendar, Outlook, and Apple Calendar', () => {
    it('should generate RFC 5545 compliant iCal feed', async () => {
      // Login and create test events
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create comprehensive test event with all possible fields
      const eventData = {
        title: 'RFC 5545 Compliance Test Event',
        description: 'This event tests RFC 5545 compliance with special characters: àáâãäåæçèéêë\nNew line test\nAnother line with "quotes" and \'apostrophes\'',
        startDateTime: new Date('2024-12-15T14:30:00Z').toISOString(),
        endDateTime: new Date('2024-12-15T16:00:00Z').toISOString(),
        location: 'Conference Room A, Building 123, 456 Main St, City, State 12345',
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

      // Test RFC 5545 compliance
      
      // 1. Calendar object structure
      expect(icalContent).toMatch(/^BEGIN:VCALENDAR\r?\n/);
      expect(icalContent).toMatch(/\r?\nEND:VCALENDAR\r?\n?$/);
      
      // 2. Required calendar properties
      expect(icalContent).toContain('VERSION:2.0');
      expect(icalContent).toMatch(/PRODID:[^\r\n]+/);
      
      // 3. Calendar scale (optional but recommended)
      expect(icalContent).toContain('CALSCALE:GREGORIAN');
      
      // 4. Event structure
      expect(icalContent).toContain('BEGIN:VEVENT');
      expect(icalContent).toContain('END:VEVENT');
      
      // 5. Required event properties
      expect(icalContent).toMatch(/UID:[^\r\n]+/);
      expect(icalContent).toMatch(/DTSTART:20241215T143000Z/);
      expect(icalContent).toMatch(/DTEND:20241215T160000Z/);
      expect(icalContent).toMatch(/DTSTAMP:[0-9]{8}T[0-9]{6}Z/);
      
      // 6. Optional but important event properties
      expect(icalContent).toContain('SUMMARY:RFC 5545 Compliance Test Event');
      expect(icalContent).toMatch(/DESCRIPTION:.*special characters.*àáâãäåæçèéêë/);
      expect(icalContent).toMatch(/LOCATION:.*Conference Room A.*Building 123/);
      
      // 7. Line folding compliance (max 75 octets per line)
      const lines = icalContent.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith(' ') && !line.startsWith('\t')) {
          expect(line.length).toBeLessThanOrEqual(75);
        }
      }
      
      // 8. Proper escaping of special characters
      expect(icalContent).toMatch(/DESCRIPTION:.*\\n.*\\n/); // Newlines escaped
      expect(icalContent).toMatch(/DESCRIPTION:.*\\"quotes\\"/); // Quotes escaped
      expect(icalContent).toMatch(/LOCATION:.*\\,.*\\,/); // Commas escaped
      
      // 9. UTC time format
      expect(icalContent).toMatch(/DTSTART:[0-9]{8}T[0-9]{6}Z/);
      expect(icalContent).toMatch(/DTEND:[0-9]{8}T[0-9]{6}Z/);
      expect(icalContent).toMatch(/DTSTAMP:[0-9]{8}T[0-9]{6}Z/);
    });

    it('should handle recurring events properly (if supported)', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create a series of events that could represent a recurring pattern
      const recurringEvents = [];
      for (let i = 0; i < 3; i++) {
        const eventData = {
          title: 'Weekly Team Meeting',
          description: 'Recurring weekly team meeting',
          startDateTime: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000) + 86400000).toISOString(),
          endDateTime: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000) + 90000000).toISOString(),
          location: 'Conference Room B',
          isPublic: true
        };

        const createResponse = await request(app)
          .post('/api/events')
          .set('Cookie', authCookie)
          .send(eventData)
          .expect(201);

        createdEvents.push(createResponse.body.event);
        recurringEvents.push(createResponse.body.event);
      }

      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const icalContent = feedResponse.text;

      // Verify all recurring events are present
      const eventMatches = icalContent.match(/BEGIN:VEVENT/g);
      expect(eventMatches).toHaveLength(3);
      
      // Each event should have unique UID
      const uidMatches = icalContent.match(/UID:[^\r\n]+/g);
      expect(uidMatches).toHaveLength(3);
      
      const uids = uidMatches!.map(match => match.split(':')[1]);
      const uniqueUids = new Set(uids);
      expect(uniqueUids.size).toBe(3);
    });

    it('should handle all-day events correctly', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create all-day event (start and end on same date, 00:00:00 times)
      const allDayEventData = {
        title: 'All Day Company Event',
        description: 'Company-wide all-day event',
        startDateTime: new Date('2024-12-15T00:00:00Z').toISOString(),
        endDateTime: new Date('2024-12-15T23:59:59Z').toISOString(),
        location: 'Company Headquarters',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(allDayEventData)
        .expect(201);

      createdEvents.push(createResponse.body.event);

      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const icalContent = feedResponse.text;

      // For all-day events, some calendar applications expect DATE format instead of DATE-TIME
      // Check if the implementation handles this correctly
      expect(icalContent).toContain('All Day Company Event');
      expect(icalContent).toMatch(/DTSTART:20241215T000000Z|DTSTART;VALUE=DATE:20241215/);
    });

    it('should generate proper MIME type and headers for calendar feeds', async () => {
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      // Verify proper MIME type
      expect(feedResponse.headers['content-type']).toMatch(/text\/calendar/);
      
      // Verify charset is specified
      expect(feedResponse.headers['content-type']).toMatch(/charset=utf-8/i);
      
      // Verify proper cache headers for calendar feeds
      expect(feedResponse.headers['cache-control']).toBeDefined();
      
      // Verify content disposition for download
      expect(feedResponse.headers['content-disposition']).toMatch(/attachment.*\.ics/);
    });

    it('should handle timezone information correctly', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create event with specific timezone considerations
      const eventData = {
        title: 'Timezone Test Event',
        description: 'Testing timezone handling',
        startDateTime: new Date('2024-12-15T14:30:00Z').toISOString(), // UTC time
        endDateTime: new Date('2024-12-15T16:00:00Z').toISOString(),
        location: 'Global Office',
        isPublic: true
      };

      const createResponse = await request(app)
        .post('/api/events')
        .set('Cookie', authCookie)
        .send(eventData)
        .expect(201);

      createdEvents.push(createResponse.body.event);

      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const icalContent = feedResponse.text;

      // Verify UTC timezone format
      expect(icalContent).toMatch(/DTSTART:20241215T143000Z/);
      expect(icalContent).toMatch(/DTEND:20241215T160000Z/);
      
      // If timezone components are included, verify proper format
      if (icalContent.includes('BEGIN:VTIMEZONE')) {
        expect(icalContent).toContain('END:VTIMEZONE');
        expect(icalContent).toMatch(/TZID:[^\r\n]+/);
      }
    });
  });

  describe('Widget Functionality Across Different Website Environments', () => {
    it('should generate cross-browser compatible widget JavaScript', async () => {
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
        title: 'Widget Compatibility Test',
        description: 'Testing widget cross-browser compatibility',
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

      // Get widget script
      const scriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      const widgetScript = scriptResponse.body.script;

      // Test cross-browser compatibility features
      
      // 1. Should use modern JavaScript features with fallbacks
      expect(widgetScript).toContain('const '); // Modern const declaration
      expect(widgetScript).toMatch(/addEventListener|attachEvent/); // Event listener compatibility
      
      // 2. Should handle DOM ready state
      expect(widgetScript).toMatch(/DOMContentLoaded|readyState|onload/);
      
      // 3. Should use proper CORS handling for API calls
      expect(widgetScript).toMatch(/fetch|XMLHttpRequest/);
      expect(widgetScript).toMatch(/cors|crossOrigin/i);
      
      // 4. Should handle CSS injection safely
      expect(widgetScript).toContain('createElement');
      expect(widgetScript).toMatch(/appendChild|insertBefore/);
      
      // 5. Should include error handling
      expect(widgetScript).toMatch(/try.*catch|\.catch\(/);
      
      // 6. Should be minification-safe (no reserved word conflicts)
      expect(widgetScript).not.toMatch(/\bclass\s*=/); // Avoid 'class' as property name
      expect(widgetScript).not.toMatch(/\bdefault\s*=/); // Avoid 'default' as property name
    });

    it('should provide responsive widget design', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const scriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      const widgetScript = scriptResponse.body.script;

      // Test responsive design features
      
      // 1. Should include CSS media queries
      expect(widgetScript).toMatch(/@media.*screen.*max-width|@media.*screen.*min-width/);
      
      // 2. Should use flexible units
      expect(widgetScript).toMatch(/\d+%|\d+em|\d+rem|\d+vw|\d+vh/);
      
      // 3. Should handle mobile touch events
      expect(widgetScript).toMatch(/touchstart|touchend|touchmove/);
      
      // 4. Should include viewport meta considerations
      expect(widgetScript).toMatch(/viewport|device-width/);
    });

    it('should handle different website environments and conflicts', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const scriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      const widgetScript = scriptResponse.body.script;

      // Test conflict prevention
      
      // 1. Should use namespacing to avoid global conflicts
      expect(widgetScript).toMatch(/CalendarWidget|window\.CalendarWidget/);
      
      // 2. Should not pollute global namespace
      expect(widgetScript).toMatch(/\(function\(\)|function\s*\(\s*\)\s*\{|\(\(\)\s*=>/); // IIFE pattern
      
      // 3. Should handle existing CSS frameworks gracefully
      expect(widgetScript).toMatch(/!important|specific.*selector/);
      
      // 4. Should include unique CSS class prefixes
      expect(widgetScript).toMatch(/calendar-widget-|cw-/);
      
      // 5. Should handle z-index conflicts
      expect(widgetScript).toMatch(/z-index:\s*\d{4,}/); // High z-index values
    });

    it('should provide proper widget API for different integration methods', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Test widget events API
      const eventsResponse = await request(app)
        .get(`/widget/${testCompany.id}/events`)
        .expect(200);

      // Should return JSON with proper CORS headers
      expect(eventsResponse.headers['content-type']).toMatch(/application\/json/);
      expect(eventsResponse.headers['access-control-allow-origin']).toBeDefined();
      
      // Should handle JSONP callback if provided
      const jsonpResponse = await request(app)
        .get(`/widget/${testCompany.id}/events?callback=myCallback`)
        .expect(200);

      if (jsonpResponse.headers['content-type'].includes('javascript')) {
        expect(jsonpResponse.text).toMatch(/myCallback\s*\(/);
      }

      // Test widget configuration API
      const configResponse = await request(app)
        .get('/widget/config')
        .set('Cookie', authCookie)
        .expect(200);

      expect(configResponse.body.success).toBe(true);
      expect(configResponse.body.config).toBeDefined();
    });

    it('should handle widget security considerations', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const scriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      const widgetScript = scriptResponse.body.script;

      // Test security features
      
      // 1. Should sanitize HTML content
      expect(widgetScript).toMatch(/textContent|innerText|createTextNode/);
      
      // 2. Should not use innerHTML with user content
      expect(widgetScript).not.toMatch(/innerHTML\s*=.*\+|innerHTML\s*\+=.*[^"']/);
      
      // 3. Should validate URLs before navigation
      expect(widgetScript).toMatch(/https?:\/\/|protocol.*http/);
      
      // 4. Should use CSP-friendly practices
      expect(widgetScript).not.toMatch(/eval\s*\(|new\s+Function\s*\(/);
      
      // 5. Should handle XSS prevention
      expect(widgetScript).toMatch(/encodeURIComponent|escape|sanitize/);
    });
  });

  describe('Calendar Subscription URLs in Actual Calendar Applications', () => {
    it('should generate Google Calendar subscription URLs with proper parameters', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Get calendar URLs
      const shareUrlResponse = await request(app)
        .get('/api/calendar/share-url')
        .set('Cookie', authCookie)
        .expect(200);

      const calendarUrls = shareUrlResponse.body.calendarUrls;

      // Test Google Calendar URL format
      const googleUrl = new URL(calendarUrls.googleCalendar);
      
      expect(googleUrl.hostname).toBe('calendar.google.com');
      expect(googleUrl.pathname).toBe('/calendar/render');
      expect(googleUrl.searchParams.get('cid')).toBeDefined();
      
      // The cid parameter should be the encoded iCal feed URL
      const cidParam = googleUrl.searchParams.get('cid');
      expect(cidParam).toContain(encodeURIComponent(calendarUrls.icalFeed));
    });

    it('should generate Outlook Calendar subscription URLs with proper parameters', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const shareUrlResponse = await request(app)
        .get('/api/calendar/share-url')
        .set('Cookie', authCookie)
        .expect(200);

      const calendarUrls = shareUrlResponse.body.calendarUrls;

      // Test Outlook Calendar URL format
      const outlookUrl = new URL(calendarUrls.outlookCalendar);
      
      expect(outlookUrl.hostname).toBe('outlook.live.com');
      expect(outlookUrl.pathname).toBe('/calendar/0/addcalendar');
      expect(outlookUrl.searchParams.get('url')).toBeDefined();
      
      // The url parameter should be the encoded iCal feed URL
      const urlParam = outlookUrl.searchParams.get('url');
      expect(urlParam).toBe(encodeURIComponent(calendarUrls.icalFeed));
    });

    it('should generate Apple Calendar webcal URLs with proper protocol', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      const shareUrlResponse = await request(app)
        .get('/api/calendar/share-url')
        .set('Cookie', authCookie)
        .expect(200);

      const calendarUrls = shareUrlResponse.body.calendarUrls;

      // Test Apple Calendar webcal URL format
      expect(calendarUrls.appleCalendar).toMatch(/^webcal:\/\//);
      
      // Should be the same as iCal feed but with webcal protocol
      const expectedWebcalUrl = calendarUrls.icalFeed.replace(/^https?:\/\//, 'webcal://');
      expect(calendarUrls.appleCalendar).toBe(expectedWebcalUrl);
    });

    it('should test calendar subscription URL accessibility', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create test event
      const eventData = {
        title: 'Subscription Test Event',
        description: 'Testing calendar subscription',
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

      // Test that the iCal feed URL is accessible
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(feedResponse.headers['content-type']).toMatch(/text\/calendar/);
      expect(feedResponse.text).toContain('Subscription Test Event');

      // Test alternative feed URL format
      const altFeedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed`)
        .expect(200);

      expect(altFeedResponse.headers['content-type']).toMatch(/text\/calendar/);
      expect(altFeedResponse.text).toContain('Subscription Test Event');
    });

    it('should handle calendar application specific requirements', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create events with various edge cases
      const edgeCaseEvents = [
        {
          title: 'Event with "Quotes" and \'Apostrophes\'',
          description: 'Testing special characters in calendar apps',
          startDateTime: new Date(Date.now() + 86400000).toISOString(),
          endDateTime: new Date(Date.now() + 90000000).toISOString(),
          isPublic: true
        },
        {
          title: 'Very Long Event Title That Might Cause Issues in Some Calendar Applications When Displayed',
          description: 'This is a very long description that tests how calendar applications handle lengthy text content. It includes multiple sentences and should test text wrapping and display capabilities across different calendar clients.',
          startDateTime: new Date(Date.now() + 172800000).toISOString(),
          endDateTime: new Date(Date.now() + 176400000).toISOString(),
          location: 'Very Long Location Name That Includes Multiple Address Components, Building Names, Room Numbers, and Geographic Information',
          isPublic: true
        },
        {
          title: 'Unicode Test Event 🗓️📅',
          description: 'Testing Unicode characters: 中文 العربية русский 🎉🎊',
          startDateTime: new Date(Date.now() + 259200000).toISOString(),
          endDateTime: new Date(Date.now() + 262800000).toISOString(),
          isPublic: true
        }
      ];

      for (const eventData of edgeCaseEvents) {
        const createResponse = await request(app)
          .post('/api/events')
          .set('Cookie', authCookie)
          .send(eventData)
          .expect(201);

        createdEvents.push(createResponse.body.event);
      }

      // Test that all events are properly formatted in iCal feed
      const feedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const icalContent = feedResponse.text;

      // Verify all events are present
      expect(icalContent).toContain('Event with \\"Quotes\\" and \'Apostrophes\'');
      expect(icalContent).toContain('Very Long Event Title');
      expect(icalContent).toContain('Unicode Test Event');

      // Verify proper encoding of special characters
      expect(icalContent).toMatch(/SUMMARY:.*\\"Quotes\\"/);
      expect(icalContent).toContain('🗓️📅'); // Unicode should be preserved
      expect(icalContent).toContain('中文'); // Unicode should be preserved

      // Verify line folding for long content
      const lines = icalContent.split(/\r?\n/);
      const longLines = lines.filter(line => !line.startsWith(' ') && line.length > 75);
      expect(longLines.length).toBe(0); // No unfolded long lines
    });
  });

  describe('Automatic Update Synchronization Across Platforms', () => {
    it('should provide immediate feed updates when events are modified', async () => {
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
        title: 'Sync Test Event',
        description: 'Testing synchronization',
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

      // Get initial feed
      const initialFeedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(initialFeedResponse.text).toContain('Sync Test Event');
      expect(initialFeedResponse.text).toContain('Testing synchronization');

      // Update the event
      const updateData = {
        title: 'Updated Sync Test Event',
        description: 'Updated synchronization test'
      };

      await request(app)
        .put(`/api/events/${createdEvents[0].id}`)
        .set('Cookie', authCookie)
        .send(updateData)
        .expect(200);

      // Get updated feed immediately
      const updatedFeedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(updatedFeedResponse.text).toContain('Updated Sync Test Event');
      expect(updatedFeedResponse.text).toContain('Updated synchronization test');
      expect(updatedFeedResponse.text).not.toContain('SUMMARY:Sync Test Event');

      // Verify DTSTAMP is updated (indicates modification)
      const initialDtstamp = initialFeedResponse.text.match(/DTSTAMP:([0-9T]+Z)/)?.[1];
      const updatedDtstamp = updatedFeedResponse.text.match(/DTSTAMP:([0-9T]+Z)/)?.[1];
      
      expect(initialDtstamp).toBeDefined();
      expect(updatedDtstamp).toBeDefined();
      // Updated timestamp should be same or later (within test execution time)
      expect(updatedDtstamp! >= initialDtstamp!).toBe(true);
    });

    it('should handle event deletion in feed updates', async () => {
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
          title: 'Event to Keep',
          description: 'This event will remain',
          startDateTime: new Date(Date.now() + 86400000).toISOString(),
          endDateTime: new Date(Date.now() + 90000000).toISOString(),
          isPublic: true
        },
        {
          title: 'Event to Delete',
          description: 'This event will be deleted',
          startDateTime: new Date(Date.now() + 172800000).toISOString(),
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

      // Verify both events in feed
      const beforeDeleteResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(beforeDeleteResponse.text).toContain('Event to Keep');
      expect(beforeDeleteResponse.text).toContain('Event to Delete');

      const beforeEventCount = beforeDeleteResponse.text.match(/BEGIN:VEVENT/g)?.length;
      expect(beforeEventCount).toBe(2);

      // Delete one event
      await request(app)
        .delete(`/api/events/${createdEvents[1].id}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Verify deletion in feed
      const afterDeleteResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      expect(afterDeleteResponse.text).toContain('Event to Keep');
      expect(afterDeleteResponse.text).not.toContain('Event to Delete');

      const afterEventCount = afterDeleteResponse.text.match(/BEGIN:VEVENT/g)?.length;
      expect(afterEventCount).toBe(1);
    });

    it('should maintain consistent UID across updates for proper synchronization', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create event
      const eventData = {
        title: 'UID Consistency Test',
        description: 'Testing UID consistency',
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

      // Get initial UID
      const initialFeedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const initialUid = initialFeedResponse.text.match(/UID:([^\r\n]+)/)?.[1];
      expect(initialUid).toBeDefined();

      // Update event multiple times
      for (let i = 1; i <= 3; i++) {
        const updateData = {
          title: `UID Consistency Test - Update ${i}`,
          description: `Updated description ${i}`
        };

        await request(app)
          .put(`/api/events/${createdEvents[0].id}`)
          .set('Cookie', authCookie)
          .send(updateData)
          .expect(200);

        // Verify UID remains consistent
        const updatedFeedResponse = await request(app)
          .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
          .expect(200);

        const updatedUid = updatedFeedResponse.text.match(/UID:([^\r\n]+)/)?.[1];
        expect(updatedUid).toBe(initialUid);
        expect(updatedFeedResponse.text).toContain(`Update ${i}`);
      }
    });

    it('should handle cache invalidation properly for real-time updates', async () => {
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: testUser.username,
          password: 'testpassword123'
        })
        .expect(200);

      const authCookie = loginResponse.headers['set-cookie'][0];

      // Create event
      const eventData = {
        title: 'Cache Test Event',
        description: 'Testing cache invalidation',
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

      // Get feed with caching headers
      const initialResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const initialEtag = initialResponse.headers['etag'];
      const initialLastModified = initialResponse.headers['last-modified'];

      // Update event
      await request(app)
        .put(`/api/events/${createdEvents[0].id}`)
        .set('Cookie', authCookie)
        .send({ title: 'Updated Cache Test Event' })
        .expect(200);

      // Get updated feed
      const updatedResponse = await request(app)
        .get(`/calendar/${testCompany.shareableUrl}/feed.ics`)
        .expect(200);

      const updatedEtag = updatedResponse.headers['etag'];
      const updatedLastModified = updatedResponse.headers['last-modified'];

      // Cache headers should change after update
      if (initialEtag && updatedEtag) {
        expect(updatedEtag).not.toBe(initialEtag);
      }
      
      if (initialLastModified && updatedLastModified) {
        expect(new Date(updatedLastModified).getTime())
          .toBeGreaterThanOrEqual(new Date(initialLastModified).getTime());
      }

      // Content should be updated
      expect(updatedResponse.text).toContain('Updated Cache Test Event');
      expect(updatedResponse.text).not.toContain('SUMMARY:Cache Test Event');
    });
  });
});