import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarFeedService, FeedGenerationContext } from '../CalendarFeedService';
import { Event } from '../../models';
import { EventRepository } from '../../repositories/EventRepository';
import { CalendarFeedErrorCode } from '../../types/errors';

describe('CalendarFeedService Error Handling', () => {
  let feedService: CalendarFeedService;
  let mockEventRepository: EventRepository;
  let mockEvents: Event[];

  beforeEach(() => {
    // Create mock event repository
    mockEventRepository = {
      findById: vi.fn(),
      findByCompanyId: vi.fn(),
      findPublicByCompanyId: vi.fn(),
      findUpcomingByCompanyId: vi.fn(),
      findByDateRange: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    } as any;

    // Create mock events
    mockEvents = [
      {
        id: 'event-1',
        companyId: 'company-123',
        title: 'Test Event 1',
        description: 'Test Description 1',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z'),
        location: 'Test Location 1',
        isPublic: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      },
      {
        id: 'event-2',
        companyId: 'company-123',
        title: 'Test Event 2',
        description: 'Test Description 2',
        startDateTime: new Date('2024-12-02T14:00:00Z'),
        endDateTime: new Date('2024-12-02T15:00:00Z'),
        location: 'Test Location 2',
        isPublic: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      }
    ];

    feedService = new CalendarFeedService(mockEventRepository);
  });

  describe('generateICalFeed error handling', () => {
    it('should throw error for invalid company ID', async () => {
      await expect(feedService.generateICalFeed('')).rejects.toThrow();
      await expect(feedService.generateICalFeed('   ')).rejects.toThrow();
    });

    it('should handle empty company ID gracefully with safe method', async () => {
      const result = await feedService.generateICalFeedSafe('');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CalendarFeedErrorCode.INVALID_COMPANY_ID);
      expect(result.error).toBe('Invalid company identifier. Please check the calendar URL.');
    });

    it('should generate empty feed when no events exist', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue([]);

      const feed = await feedService.generateICalFeed('company-123');

      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('END:VCALENDAR');
      expect(feed).toContain('VERSION:2.0');
      expect(feed).not.toContain('BEGIN:VEVENT');
    });

    it('should handle repository errors during event retrieval', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      await expect(feedService.generateICalFeed('company-123')).rejects.toThrow();
    });

    it('should handle repository errors gracefully with safe method', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const result = await feedService.generateICalFeedSafe('company-123');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CalendarFeedErrorCode.FEED_GENERATION_FAILED);
      expect(result.error).toBe('Failed to generate calendar feed. Please try again later.');
    });

    it('should truncate feeds with too many events', async () => {
      // Create array with more than max events (1000)
      const manyEvents = Array.from({ length: 1001 }, (_, i) => ({
        ...mockEvents[0],
        id: `event-${i}`,
        title: `Event ${i}`
      }));

      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(manyEvents);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const feed = await feedService.generateICalFeed('company-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('has 1001 events, truncating to 1000')
      );

      // Count VEVENT occurrences to verify truncation
      const eventCount = (feed.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBe(1000);

      consoleSpy.mockRestore();
    });

    it('should handle feed size exceeded error', async () => {
      // Create events with very large descriptions to exceed size limit
      const largeEvents = Array.from({ length: 100 }, (_, i) => ({
        ...mockEvents[0],
        id: `event-${i}`,
        description: 'x'.repeat(20000) // Very large description
      }));

      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(largeEvents);

      await expect(feedService.generateICalFeed('company-123')).rejects.toThrow();
    });

    it('should continue processing when individual event formatting fails', async () => {
      const eventsWithInvalid = [
        mockEvents[0],
        { ...mockEvents[1], title: null as any }, // Invalid event
        mockEvents[0]
      ];

      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(eventsWithInvalid);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const feed = await feedService.generateICalFeed('company-123');

      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('END:VCALENDAR');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to format event'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should include operation context in logging', async () => {
      const context: FeedGenerationContext = {
        companyId: 'company-123',
        requestId: 'req-123',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1'
      };

      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(mockEvents);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await feedService.generateICalFeed('company-123', context);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calendar feed operation success:',
        expect.objectContaining({
          operation: 'generate',
          companyId: 'company-123',
          success: true,
          eventCount: 2,
          requestId: 'req-123',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getPublicEvents error handling', () => {
    it('should throw error for invalid company ID', async () => {
      await expect(feedService.getPublicEvents('')).rejects.toThrow();
      await expect(feedService.getPublicEvents('   ')).rejects.toThrow();
    });

    it('should handle invalid company ID gracefully with safe method', async () => {
      const result = await feedService.getPublicEventsSafe('');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CalendarFeedErrorCode.INVALID_COMPANY_ID);
      expect(result.error).toBe('Invalid company identifier. Please check the calendar URL.');
    });

    it('should sort events by start date', async () => {
      const unsortedEvents = [mockEvents[1], mockEvents[0]]; // Second event first
      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(unsortedEvents);

      const events = await feedService.getPublicEvents('company-123');

      expect(events[0].startDateTime.getTime()).toBeLessThan(events[1].startDateTime.getTime());
    });

    it('should handle repository errors', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(feedService.getPublicEvents('company-123')).rejects.toThrow();
    });

    it('should handle repository errors gracefully with safe method', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await feedService.getPublicEventsSafe('company-123');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CalendarFeedErrorCode.FEED_GENERATION_FAILED);
      expect(result.error).toBe('Failed to retrieve calendar events. Please try again later.');
    });
  });

  describe('formatEventForFeed error handling', () => {
    it('should throw error for invalid event data', () => {
      const invalidEvent = null as any;
      expect(() => feedService.formatEventForFeed(invalidEvent)).toThrow();
    });

    it('should throw error for event missing required fields', () => {
      const invalidEvent = {
        id: 'event-1',
        title: '', // Missing title
        startDateTime: new Date(),
        endDateTime: new Date()
      } as any;

      expect(() => feedService.formatEventForFeed(invalidEvent)).toThrow();
    });

    it('should handle events with missing optional fields', () => {
      const eventWithoutOptionals = {
        id: 'event-1',
        companyId: 'company-123',
        title: 'Test Event',
        description: null,
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z'),
        location: null,
        isPublic: true
      } as any;

      const result = feedService.formatEventForFeed(eventWithoutOptionals);

      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('SUMMARY:Test Event');
      expect(result).toContain('DESCRIPTION:');
      expect(result).not.toContain('LOCATION:');
    });

    it('should truncate oversized events', () => {
      const largeEvent = {
        ...mockEvents[0],
        description: 'x'.repeat(10000) // Very large description
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = feedService.formatEventForFeed(largeEvent);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds size limit, truncating description')
      );
      expect(result).toContain('...');

      consoleSpy.mockRestore();
    });

    it('should properly escape special characters', () => {
      const eventWithSpecialChars = {
        ...mockEvents[0],
        title: 'Event; with, special\ncharacters\\and backslashes',
        description: 'Description\nwith\rline\nbreaks;and,commas'
      };

      const result = feedService.formatEventForFeed(eventWithSpecialChars);

      expect(result).toContain('SUMMARY:Event\\; with\\, special\\ncharacters\\\\and backslashes');
      expect(result).toContain('DESCRIPTION:Description\\nwith\\nbreaks\\;and\\,commas');
    });

    it('should include creation and modification timestamps when available', () => {
      const result = feedService.formatEventForFeed(mockEvents[0]);

      expect(result).toContain('CREATED:');
      expect(result).toContain('LAST-MODIFIED:');
    });
  });

  describe('feed validation', () => {
    it('should validate correct feed format', () => {
      const validFeed = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Test//Test//EN',
        'END:VCALENDAR'
      ].join('\r\n');

      const validation = feedService.validateFeedFormat(validFeed);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required components', () => {
      const invalidFeed = 'Some invalid content';

      const validation = feedService.validateFeedFormat(invalidFeed);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Feed must begin with BEGIN:VCALENDAR');
      expect(validation.errors).toContain('Feed must end with END:VCALENDAR');
      expect(validation.errors).toContain('Feed must specify VERSION:2.0');
    });

    it('should detect incorrect line endings', () => {
      const feedWithWrongLineEndings = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'END:VCALENDAR'
      ].join('\n'); // Using \n instead of \r\n

      const validation = feedService.validateFeedFormat(feedWithWrongLineEndings);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Feed should use CRLF line endings (\\r\\n)');
    });

    it('should detect oversized feeds', () => {
      const largeFeed = 'x'.repeat(2 * 1024 * 1024); // 2MB

      const validation = feedService.validateFeedFormat(largeFeed);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(expect.stringContaining('exceeds maximum'));
    });

    it('should handle null or empty feed', () => {
      const validation1 = feedService.validateFeedFormat(null as any);
      const validation2 = feedService.validateFeedFormat('');

      expect(validation1.isValid).toBe(false);
      expect(validation2.isValid).toBe(false);
      expect(validation1.errors).toContain('Feed must be a non-empty string');
      expect(validation2.errors).toContain('Feed must be a non-empty string');
    });
  });

  describe('fallback mechanisms', () => {
    it('should create fallback feed', () => {
      const fallbackFeed = feedService.createFallbackFeed('Test Company');

      expect(fallbackFeed).toContain('BEGIN:VCALENDAR');
      expect(fallbackFeed).toContain('END:VCALENDAR');
      expect(fallbackFeed).toContain('Calendar temporarily unavailable for Test Company');
      expect(fallbackFeed).toContain('BEGIN:VEVENT');
      expect(fallbackFeed).toContain('STATUS:TENTATIVE');
    });

    it('should create generic fallback feed without company name', () => {
      const fallbackFeed = feedService.createFallbackFeed();

      expect(fallbackFeed).toContain('Calendar temporarily unavailable');
      expect(fallbackFeed).not.toContain('for undefined');
    });
  });

  describe('feed statistics', () => {
    it('should return feed statistics', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(mockEvents);

      const stats = await feedService.getFeedStats('company-123');

      expect(stats.totalEvents).toBe(2);
      expect(stats.publicEvents).toBe(2);
      expect(stats.feedSize).toBeGreaterThan(0);
      expect(stats.lastGenerated).toBeInstanceOf(Date);
    });

    it('should handle statistics errors gracefully', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockRejectedValue(new Error('Database error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const stats = await feedService.getFeedStats('company-123');

      expect(stats).toEqual({
        totalEvents: 0,
        publicEvents: 0,
        feedSize: 0,
        lastGenerated: expect.any(Date)
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to get feed stats:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('error logging', () => {
    it('should log successful operations', async () => {
      mockEventRepository.findPublicByCompanyId = vi.fn().mockResolvedValue(mockEvents);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await feedService.generateICalFeed('company-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calendar feed operation success:',
        expect.objectContaining({
          operation: 'generate',
          companyId: 'company-123',
          success: true,
          eventCount: 2
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log failed operations', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await feedService.generateICalFeedSafe('');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Calendar feed operation failure:',
        expect.objectContaining({
          operation: 'generate',
          companyId: '',
          success: false,
          errorCode: CalendarFeedErrorCode.INVALID_COMPANY_ID
        })
      );

      consoleSpy.mockRestore();
    });
  });
});