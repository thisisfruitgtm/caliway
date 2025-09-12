import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarFeedService } from '../CalendarFeedService';
import { EventRepository, IEventRepository } from '../../repositories';
import { Event } from '../../models';

describe('CalendarFeedService', () => {
  let calendarFeedService: CalendarFeedService;
  let mockEventRepository: IEventRepository;

  const mockEvents: Event[] = [
    {
      id: 'event-1',
      companyId: 'company-1',
      title: 'Team Meeting',
      description: 'Weekly team sync meeting',
      startDateTime: new Date('2024-01-15T10:00:00Z'),
      endDateTime: new Date('2024-01-15T11:00:00Z'),
      location: 'Conference Room A',
      isPublic: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    },
    {
      id: 'event-2',
      companyId: 'company-1',
      title: 'Product Launch',
      description: 'Launch event for new product\nWith multiple lines',
      startDateTime: new Date('2024-01-20T14:00:00Z'),
      endDateTime: new Date('2024-01-20T16:00:00Z'),
      location: undefined,
      isPublic: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    }
  ];

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
      delete: vi.fn(),
      findAll: vi.fn(),
      findForCalendarFeed: vi.fn()
    };
    
    calendarFeedService = new CalendarFeedService(mockEventRepository);
    vi.clearAllMocks();
  });

  describe('getPublicEvents', () => {
    it('should return public events for a company', async () => {
      mockEventRepository.findPublicByCompanyId.mockResolvedValue(mockEvents);

      const result = await calendarFeedService.getPublicEvents('company-1');

      expect(mockEventRepository.findPublicByCompanyId).toHaveBeenCalledWith('company-1');
      expect(result).toEqual(mockEvents);
    });

    it('should handle empty events list', async () => {
      mockEventRepository.findPublicByCompanyId.mockResolvedValue([]);

      const result = await calendarFeedService.getPublicEvents('company-1');

      expect(result).toEqual([]);
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Database connection failed');
      mockEventRepository.findPublicByCompanyId.mockRejectedValue(error);

      await expect(calendarFeedService.getPublicEvents('company-1')).rejects.toThrow(error);
    });
  });

  describe('formatEventForFeed', () => {
    it('should format event with all fields correctly', () => {
      const event = mockEvents[0];
      const result = calendarFeedService.formatEventForFeed(event);

      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');
      expect(result).toContain(`UID:${event.id}@company-calendar-platform.com`);
      expect(result).toContain('DTSTART:20240115T100000Z');
      expect(result).toContain('DTEND:20240115T110000Z');
      expect(result).toContain('SUMMARY:Team Meeting');
      expect(result).toContain('DESCRIPTION:Weekly team sync meeting');
      expect(result).toContain('LOCATION:Conference Room A');
      expect(result).toContain('DTSTAMP:');
    });

    it('should format event without location', () => {
      const event = mockEvents[1];
      const result = calendarFeedService.formatEventForFeed(event);

      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');
      expect(result).toContain('SUMMARY:Product Launch');
      expect(result).not.toContain('LOCATION:');
    });

    it('should escape special characters in text fields', () => {
      const eventWithSpecialChars: Event = {
        id: 'event-special',
        companyId: 'company-1',
        title: 'Meeting; Important, Notes\\Test',
        description: 'Description with\nnewlines and; semicolons, commas\\backslashes',
        startDateTime: new Date('2024-01-15T10:00:00Z'),
        endDateTime: new Date('2024-01-15T11:00:00Z'),
        location: 'Room; A, Building\\B',
        isPublic: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      };

      const result = calendarFeedService.formatEventForFeed(eventWithSpecialChars);

      expect(result).toContain('SUMMARY:Meeting\\; Important\\, Notes\\\\Test');
      expect(result).toContain('DESCRIPTION:Description with\\nnewlines and\\; semicolons\\, commas\\\\backslashes');
      expect(result).toContain('LOCATION:Room\\; A\\, Building\\\\B');
    });

    it('should format dates correctly in UTC', () => {
      const event = mockEvents[0];
      const result = calendarFeedService.formatEventForFeed(event);

      // Check that dates are in the correct iCal format (YYYYMMDDTHHMMSSZ)
      expect(result).toMatch(/DTSTART:20240115T100000Z/);
      expect(result).toMatch(/DTEND:20240115T110000Z/);
      expect(result).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    });
  });

  describe('generateICalFeed', () => {
    it('should generate complete iCal feed with events', async () => {
      mockEventRepository.findPublicByCompanyId.mockResolvedValue(mockEvents);

      const result = await calendarFeedService.generateICalFeed('company-1');

      // Check iCal header
      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('VERSION:2.0');
      expect(result).toContain('PRODID:-//Company Calendar Platform//Calendar Feed//EN');
      expect(result).toContain('CALSCALE:GREGORIAN');
      expect(result).toContain('METHOD:PUBLISH');

      // Check events are included
      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('SUMMARY:Team Meeting');
      expect(result).toContain('SUMMARY:Product Launch');

      // Check iCal footer
      expect(result).toContain('END:VCALENDAR');

      // Verify proper line endings (CRLF)
      expect(result).toMatch(/\r\n/);
    });

    it('should generate empty feed when no events exist', async () => {
      mockEventRepository.findPublicByCompanyId.mockResolvedValue([]);

      const result = await calendarFeedService.generateICalFeed('company-1');

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).not.toContain('BEGIN:VEVENT');
    });

    it('should handle repository errors during feed generation', async () => {
      const error = new Error('Failed to fetch events');
      mockEventRepository.findPublicByCompanyId.mockRejectedValue(error);

      await expect(calendarFeedService.generateICalFeed('company-1')).rejects.toThrow(error);
    });

    it('should generate valid iCal structure', async () => {
      mockEventRepository.findPublicByCompanyId.mockResolvedValue([mockEvents[0]]);

      const result = await calendarFeedService.generateICalFeed('company-1');
      const lines = result.split('\r\n');

      // Verify structure
      expect(lines[0]).toBe('BEGIN:VCALENDAR');
      expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
      
      // Find event boundaries
      const eventStartIndex = lines.findIndex(line => line === 'BEGIN:VEVENT');
      const eventEndIndex = lines.findIndex(line => line === 'END:VEVENT');
      
      expect(eventStartIndex).toBeGreaterThan(-1);
      expect(eventEndIndex).toBeGreaterThan(eventStartIndex);
    });
  });

  describe('date formatting', () => {
    it('should format dates in correct iCal format', () => {
      const testDate = new Date('2024-12-25T15:30:45.123Z');
      const event: Event = {
        id: 'test-event',
        companyId: 'company-1',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: testDate,
        endDateTime: testDate,
        isPublic: true,
        createdAt: testDate,
        updatedAt: testDate
      };

      const result = calendarFeedService.formatEventForFeed(event);

      // Should format as YYYYMMDDTHHMMSSZ (no hyphens, colons, or milliseconds)
      expect(result).toContain('DTSTART:20241225T153045Z');
      expect(result).toContain('DTEND:20241225T153045Z');
    });
  });

  describe('text escaping', () => {
    it('should properly escape all special iCal characters', () => {
      const testCases = [
        { input: 'Simple text', expected: 'Simple text' },
        { input: 'Text with; semicolon', expected: 'Text with\\; semicolon' },
        { input: 'Text with, comma', expected: 'Text with\\, comma' },
        { input: 'Text with\\backslash', expected: 'Text with\\\\backslash' },
        { input: 'Text with\nnewline', expected: 'Text with\\nnewline' },
        { input: 'Text with\r\nCRLF', expected: 'Text with\\nCRLF' },
        { input: 'Complex; text, with\\all\nspecial chars', expected: 'Complex\\; text\\, with\\\\all\\nspecial chars' }
      ];

      testCases.forEach(({ input, expected }) => {
        const event: Event = {
          id: 'test',
          companyId: 'company-1',
          title: input,
          description: input,
          startDateTime: new Date(),
          endDateTime: new Date(),
          location: input,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = calendarFeedService.formatEventForFeed(event);
        expect(result).toContain(`SUMMARY:${expected}`);
        expect(result).toContain(`DESCRIPTION:${expected}`);
        expect(result).toContain(`LOCATION:${expected}`);
      });
    });
  });
});