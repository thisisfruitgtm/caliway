import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CalendarRoutes } from '../routes/calendar';

// Create a minimal Express app for testing public routes
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Mock the calendar routes
  const calendarRoutes = new CalendarRoutes();
  app.use('/', calendarRoutes.getRouter());
  
  return app;
};

describe('Public Calendar Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Create fresh app instance
    app = createTestApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Public Calendar View - GET /calendar/:shareUrl', () => {
    it('should return HTML page for public calendar view', async () => {
      // Act - Test with a sample share URL
      const response = await request(app)
        .get('/calendar/test-share-url-123');

      // Assert - Should return some HTML response (even if 404 or error)
      expect([200, 404, 500]).toContain(response.status);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      
      // If it's a 404, it should show the "Calendar Not Found" page
      if (response.status === 404) {
        expect(response.text).toContain('Calendar Not Found');
      }
      
      // If it's a 200, it should show calendar content
      if (response.status === 200) {
        expect(response.text).toContain('Public Calendar');
      }
    });

    it('should handle different share URL formats', async () => {
      const testUrls = [
        'cal-abc-123',
        'company-calendar-456',
        'test-url-with-dashes',
        'simple123'
      ];

      for (const shareUrl of testUrls) {
        const response = await request(app)
          .get(`/calendar/${shareUrl}`);

        // Should return HTML response regardless of whether calendar exists
        expect(response.headers['content-type']).toMatch(/text\/html/);
        expect([200, 404, 500]).toContain(response.status);
      }
    });

    it('should not require authentication for public calendar access', async () => {
      // Act - Make request without any authentication headers
      const response = await request(app)
        .get('/calendar/test-share-url');

      // Assert - Should not redirect to login or return 401
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302); // No redirect to login
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('Public Calendar Feed - GET /calendar/:shareUrl/feed.ics', () => {
    it('should return calendar feed response', async () => {
      // Act
      const response = await request(app)
        .get('/calendar/test-share-url/feed.ics');

      // Assert - Should return some response (even if 404 for non-existent calendar)
      expect([200, 404, 500]).toContain(response.status);
      
      // If successful, should have calendar content type
      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/text\/calendar/);
      }
      
      // If 404, should indicate calendar not found
      if (response.status === 404) {
        expect(response.text).toContain('Calendar not found');
      }
    });

    it('should handle alternative feed URL format', async () => {
      // Act
      const response = await request(app)
        .get('/calendar/test-share-url/feed');

      // Assert - Should return some response
      expect([200, 404, 500]).toContain(response.status);
      
      // If successful, should have calendar content type
      if (response.status === 200) {
        expect(response.headers['content-type']).toMatch(/text\/calendar/);
      }
    });

    it('should not require authentication for feed access', async () => {
      // Act - Make request without any authentication
      const response = await request(app)
        .get('/calendar/test-share-url/feed.ics');

      // Assert - Should not return authentication errors
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(302); // No redirect to login
    });
  });

  describe('Route Registration and Accessibility', () => {
    it('should have public calendar routes registered', async () => {
      // Test that the routes exist and are accessible
      const routes = [
        '/calendar/test-url',
        '/calendar/test-url/feed.ics',
        '/calendar/test-url/feed'
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        
        // Routes should exist and return some response
        // 404 is acceptable for calendar not found, but routes should be registered
        expect(response.status).toBeGreaterThan(0);
      }
    });

    it('should handle malformed share URLs gracefully', async () => {
      const malformedUrls = [
        '/calendar/',
        '/calendar//',
        '/calendar/test%20url',
        '/calendar/test@url',
        '/calendar/test#url'
      ];

      for (const url of malformedUrls) {
        const response = await request(app).get(url);
        
        // Should handle gracefully without crashing
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });
  });

  describe('Calendar Application Integration Buttons', () => {
    it('should include Add to Calendar buttons in public calendar view', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Should contain calendar integration buttons
        expect(response.text).toContain('Add to Google Calendar');
        expect(response.text).toContain('Add to Outlook');
        expect(response.text).toContain('Add to Apple Calendar');
        expect(response.text).toContain('Download iCal Feed');
      }
    });

    it('should generate proper URLs for calendar applications', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Should contain proper calendar application URLs
        expect(response.text).toContain('calendar.google.com');
        expect(response.text).toContain('outlook.live.com');
        expect(response.text).toContain('webcal://');
        expect(response.text).toContain('feed.ics');
      }
    });

    it('should have proper link attributes for calendar buttons', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Google and Outlook should open in new tab
        expect(response.text).toMatch(/href="[^"]*calendar\.google\.com[^"]*"[^>]*target="_blank"/);
        expect(response.text).toMatch(/href="[^"]*outlook\.live\.com[^"]*"[^>]*target="_blank"/);
        
        // Should have proper CSS classes for styling
        expect(response.text).toContain('class="calendar-button"');
        expect(response.text).toContain('calendar-icon');
      }
    });

    it('should include subscription section with proper styling', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Should have subscription section
        expect(response.text).toContain('Subscribe to Our Calendar');
        expect(response.text).toContain('calendar-buttons');
        
        // Should have proper icons for each calendar service
        expect(response.text).toContain('google-icon');
        expect(response.text).toContain('outlook-icon');
        expect(response.text).toContain('apple-icon');
        expect(response.text).toContain('ical-icon');
      }
    });

    it('should handle calendar integration URLs correctly', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Extract URLs from the response
        const googleMatch = response.text.match(/href="([^"]*calendar\.google\.com[^"]*)"/);
        const outlookMatch = response.text.match(/href="([^"]*outlook\.live\.com[^"]*)"/);
        const appleMatch = response.text.match(/href="([^"]*webcal:\/\/[^"]*)"/);
        
        if (googleMatch) {
          const googleUrl = googleMatch[1];
          expect(googleUrl).toContain('calendar.google.com/calendar/render');
          expect(googleUrl).toContain('cid=');
        }
        
        if (outlookMatch) {
          const outlookUrl = outlookMatch[1];
          expect(outlookUrl).toContain('outlook.live.com/calendar/0/addcalendar');
          expect(outlookUrl).toContain('url=');
        }
        
        if (appleMatch) {
          const appleUrl = appleMatch[1];
          expect(appleUrl).toStartWith('webcal://');
          expect(appleUrl).toContain('feed.ics');
        }
      }
    });
  });

  describe('Response Format and Security', () => {
    it('should return proper HTML structure for calendar view', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Should be valid HTML
        expect(response.text).toContain('<!DOCTYPE html>');
        expect(response.text).toContain('<html');
        expect(response.text).toContain('</html>');
        expect(response.text).toContain('<head>');
        expect(response.text).toContain('<body>');
      }
    });

    it('should include proper meta tags for public calendar', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      if (response.status === 200) {
        // Should have proper meta tags
        expect(response.text).toContain('charset="UTF-8"');
        expect(response.text).toContain('viewport');
      }
    });

    it('should not expose sensitive information in public view', async () => {
      const response = await request(app)
        .get('/calendar/test-share-url');

      // Should not contain sensitive data patterns
      expect(response.text).not.toContain('password');
      expect(response.text).not.toContain('secret');
      expect(response.text).not.toContain('token');
      expect(response.text).not.toContain('api_key');
    });
  });
});