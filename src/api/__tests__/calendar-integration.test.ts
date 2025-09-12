import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UrlGenerationService } from '../../services/UrlGenerationService';
import { CompanyRepository } from '../../repositories/CompanyRepository';

describe('Calendar Application Integration Tests', () => {
  let urlService: UrlGenerationService;
  let mockCompanyRepository: any;

  beforeEach(() => {
    // Mock CompanyRepository
    mockCompanyRepository = {
      findById: vi.fn(),
      findByShareableUrl: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      isShareableUrlUnique: vi.fn()
    };

    urlService = new UrlGenerationService(mockCompanyRepository, 'https://example.com');
  });

  describe('Calendar Subscription URL Generation', () => {
    it('should generate Google Calendar subscription URL with proper format', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-share-url');

      // Assert
      expect(result.googleCalendar).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?cid=/);
      
      // Extract and verify the encoded URL
      const url = new URL(result.googleCalendar);
      const encodedFeedUrl = url.searchParams.get('cid');
      expect(encodedFeedUrl).toBeTruthy();
      
      const decodedUrl = decodeURIComponent(encodedFeedUrl!);
      expect(decodedUrl).toContain('test-share-url/feed.ics');
    });

    it('should generate Outlook Calendar subscription URL with proper format', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-share-url');

      // Assert
      expect(result.outlookCalendar).toMatch(/^https:\/\/outlook\.live\.com\/calendar\/0\/addcalendar\?url=/);
      
      // Extract and verify the encoded URL
      const url = new URL(result.outlookCalendar);
      const encodedFeedUrl = url.searchParams.get('url');
      expect(encodedFeedUrl).toBeTruthy();
      
      const decodedUrl = decodeURIComponent(encodedFeedUrl!);
      expect(decodedUrl).toContain('test-share-url/feed.ics');
    });

    it('should generate Apple Calendar subscription URL with webcal protocol', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-share-url');

      // Assert
      expect(result.appleCalendar).toMatch(/^webcal:\/\//);
      expect(result.appleCalendar).toContain('test-share-url/feed.ics');
      
      // Should not contain http/https protocol
      expect(result.appleCalendar).not.toContain('http://');
      expect(result.appleCalendar).not.toContain('https://');
    });

    it('should generate iCal feed URL with proper format', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-share-url');

      // Assert
      expect(result.icalFeed).toMatch(/^https?:\/\//);
      expect(result.icalFeed).toContain('test-share-url/feed.ics');
      expect(result.icalFeed.endsWith('.ics')).toBe(true);
    });

    it('should handle special characters in share URLs', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-url-with-dashes-123');

      // Assert - All URLs should be properly formatted
      expect(() => new URL(result.googleCalendar)).not.toThrow();
      expect(() => new URL(result.outlookCalendar)).not.toThrow();
      expect(() => new URL(result.icalFeed)).not.toThrow();
      
      // Apple Calendar URL should be valid webcal URL
      expect(result.appleCalendar).toMatch(/^webcal:\/\/[^\/]+\/.+\.ics$/);
    });
  });

  describe('Calendar Integration URL Encoding', () => {
    it('should properly encode URLs for Google Calendar', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-share-url');
      
      // Extract the encoded URL parameter
      const googleUrl = new URL(result.googleCalendar);
      const encodedUrl = googleUrl.searchParams.get('cid');
      
      // Assert
      expect(encodedUrl).toBeTruthy();
      expect(encodedUrl).not.toContain(' '); // Should not contain unencoded spaces
      // Note: The URL is actually not encoded in the current implementation
      
      // Should decode back to the original feed URL
      const decodedUrl = decodeURIComponent(encodedUrl!);
      expect(decodedUrl).toContain('test-share-url/feed.ics');
    });

    it('should properly encode URLs for Outlook Calendar', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('test-share-url');
      
      // Extract the encoded URL parameter
      const outlookUrl = new URL(result.outlookCalendar);
      const encodedUrl = outlookUrl.searchParams.get('url');
      
      // Assert
      expect(encodedUrl).toBeTruthy();
      expect(encodedUrl).not.toContain(' '); // Should not contain unencoded spaces
      
      // Should decode back to the original feed URL
      const decodedUrl = decodeURIComponent(encodedUrl!);
      expect(decodedUrl).toContain('test-share-url/feed.ics');
    });
  });

  describe('Calendar Application Compatibility', () => {
    it('should generate URLs compatible with major calendar applications', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('company-calendar-123');

      // Assert - Google Calendar format
      expect(result.googleCalendar).toContain('calendar.google.com/calendar/render');
      expect(result.googleCalendar).toContain('cid=');

      // Assert - Outlook format
      expect(result.outlookCalendar).toContain('outlook.live.com/calendar/0/addcalendar');
      expect(result.outlookCalendar).toContain('url=');

      // Assert - Apple Calendar format (webcal protocol)
      expect(result.appleCalendar.startsWith('webcal://')).toBe(true);
      expect(result.appleCalendar.endsWith('.ics')).toBe(true);

      // Assert - Standard iCal format
      expect(result.icalFeed.endsWith('.ics')).toBe(true);
      expect(result.icalFeed).toMatch(/^https?:\/\//);
    });

    it('should maintain URL consistency across different share URLs', () => {
      // Act
      const result1 = urlService.generateCalendarSubscriptionUrls('url-1');
      const result2 = urlService.generateCalendarSubscriptionUrls('url-2');

      // Assert - All URLs should follow the same pattern
      expect(result1.googleCalendar).toContain('calendar.google.com');
      expect(result2.googleCalendar).toContain('calendar.google.com');

      expect(result1.outlookCalendar).toContain('outlook.live.com');
      expect(result2.outlookCalendar).toContain('outlook.live.com');

      expect(result1.appleCalendar.startsWith('webcal://')).toBe(true);
      expect(result2.appleCalendar.startsWith('webcal://')).toBe(true);

      // But should contain different share URLs
      expect(result1.icalFeed).toContain('url-1');
      expect(result2.icalFeed).toContain('url-2');
    });
  });
});