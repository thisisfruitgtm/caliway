import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventManagementService, CreateEventData, UpdateEventData, EventOperationContext } from '../EventManagementService';
import { Event } from '../../models';
import { IEventRepository } from '../../repositories/EventRepository';
import { ICacheInvalidationService } from '../CacheInvalidationService';
import * as ErrorTypes from '../../types/errors';

// Debug: Check if EventErrorCode is imported correctly
console.log('ErrorTypes in test:', ErrorTypes);
const { EventErrorCode } = ErrorTypes;

describe('EventManagementService Error Handling', () => {
  let eventService: EventManagementService;
  let mockEventRepository: IEventRepository;
  let mockCacheService: ICacheInvalidationService;
  let mockEvent: Event;

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
    };

    // Create mock cache service
    mockCacheService = {
      invalidateCalendarFeed: vi.fn(),
      invalidatePublicCalendar: vi.fn(),
      invalidateWidgetCache: vi.fn(),
      clearAllCache: vi.fn()
    };

    // Create mock event
    mockEvent = {
      id: 'event-123',
      companyId: 'company-123',
      title: 'Test Event',
      description: 'Test Description',
      startDateTime: new Date('2024-12-01T10:00:00Z'),
      endDateTime: new Date('2024-12-01T11:00:00Z'),
      location: 'Test Location',
      isPublic: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    };

    eventService = new EventManagementService(mockEventRepository, mockCacheService);
  });

  describe('createEvent error handling', () => {
    it('should return error for missing company ID', async () => {
      const eventData: CreateEventData = {
        companyId: '',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.COMPANY_NOT_FOUND);
      expect(result.errors).toContain('Company not found. Please verify the company information.');
    });

    it('should return validation error for invalid event data', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: '', // Invalid: empty title
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.VALIDATION_FAILED);
      expect(result.errors).toBeDefined();
    });

    it('should return error for events in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Past Event',
        description: 'Test Description',
        startDateTime: pastDate,
        endDateTime: new Date(pastDate.getTime() + 3600000)
      };

      // Mock repository to return empty array (no existing events)
      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([]);

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.INVALID_DATE_RANGE);
      expect(result.errors).toContain('Cannot create events in the past');
    });

    it('should return error for duplicate events', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      // Mock repository to return existing event with same title and time
      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([mockEvent]);

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.DUPLICATE_EVENT);
      expect(result.errors).toContain('An event with the same title and start time already exists');
    });

    it('should handle database errors gracefully', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      // Mock repository to throw database error
      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([]);
      mockEventRepository.create = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.DATABASE_ERROR);
      expect(result.errors).toContain('Database is temporarily unavailable. Please try again later.');
    });

    it('should handle cache invalidation failures gracefully', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      // Mock successful creation but cache failure
      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([]);
      mockEventRepository.create = vi.fn().mockResolvedValue(mockEvent);
      mockCacheService.invalidateCalendarFeed = vi.fn().mockRejectedValue(new Error('Cache service down'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(true); // Should still succeed
      expect(result.event).toEqual(mockEvent);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Cache invalidation failed during event creation:',
        expect.objectContaining({
          eventId: mockEvent.id,
          companyId: eventData.companyId
        })
      );

      consoleSpy.mockRestore();
    });

    it('should include operation context in logging', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      const context: EventOperationContext = {
        userId: 'user-123',
        companyId: 'company-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([]);
      mockEventRepository.create = vi.fn().mockResolvedValue(mockEvent);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await eventService.createEvent(eventData, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Event operation success:',
        expect.objectContaining({
          operation: 'create',
          success: true,
          eventId: mockEvent.id,
          userId: context.userId,
          companyId: context.companyId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('updateEvent error handling', () => {
    it('should return error for missing event ID', async () => {
      const updateData: UpdateEventData = {
        title: 'Updated Event'
      };

      const result = await eventService.updateEvent('', updateData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.INVALID_EVENT_DATA);
      expect(result.errors).toContain('The event data provided is invalid. Please check your input and try again.');
    });

    it('should return error for non-existent event', async () => {
      const updateData: UpdateEventData = {
        title: 'Updated Event'
      };

      mockEventRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await eventService.updateEvent('non-existent-id', updateData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.EVENT_NOT_FOUND);
      expect(result.errors).toContain('The requested event could not be found.');
    });

    it('should return error for permission denied', async () => {
      const updateData: UpdateEventData = {
        title: 'Updated Event'
      };

      const context: EventOperationContext = {
        companyId: 'different-company-123'
      };

      mockEventRepository.findById = vi.fn().mockResolvedValue(mockEvent);

      const result = await eventService.updateEvent('event-123', updateData, context);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.PERMISSION_DENIED);
      expect(result.errors).toContain('You do not have permission to perform this action.');
    });

    it('should handle update validation errors', async () => {
      const updateData: UpdateEventData = {
        title: '', // Invalid: empty title
        startDateTime: new Date('2024-12-01T11:00:00Z'),
        endDateTime: new Date('2024-12-01T10:00:00Z') // Invalid: end before start
      };

      mockEventRepository.findById = vi.fn().mockResolvedValue(mockEvent);

      const result = await eventService.updateEvent('event-123', updateData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.VALIDATION_FAILED);
      expect(result.errors).toBeDefined();
    });
  });

  describe('deleteEvent error handling', () => {
    it('should return error for missing event ID', async () => {
      const result = await eventService.deleteEvent('');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.INVALID_EVENT_DATA);
      expect(result.errors).toContain('The event data provided is invalid. Please check your input and try again.');
    });

    it('should return error for non-existent event', async () => {
      mockEventRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await eventService.deleteEvent('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.EVENT_NOT_FOUND);
      expect(result.errors).toContain('The requested event could not be found.');
    });

    it('should return error for permission denied', async () => {
      const context: EventOperationContext = {
        companyId: 'different-company-123'
      };

      mockEventRepository.findById = vi.fn().mockResolvedValue(mockEvent);

      const result = await eventService.deleteEvent('event-123', context);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.PERMISSION_DENIED);
      expect(result.errors).toContain('You do not have permission to perform this action.');
    });

    it('should handle database deletion errors', async () => {
      mockEventRepository.findById = vi.fn().mockResolvedValue(mockEvent);
      mockEventRepository.delete = vi.fn().mockResolvedValue(false);

      const result = await eventService.deleteEvent('event-123');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.DATABASE_ERROR);
      expect(result.errors).toContain('A database error occurred. Please try again later.');
    });
  });

  describe('business rule validation', () => {
    it('should validate date ranges correctly', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T11:00:00Z'),
        endDateTime: new Date('2024-12-01T10:00:00Z') // End before start
      };

      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([]);

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.INVALID_DATE_RANGE);
      expect(result.errors).toContain('Event start time must be before end time');
    });

    it('should handle business validation database errors', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      // Mock repository to throw error during business validation
      mockEventRepository.findByCompanyId = vi.fn().mockRejectedValue(new Error('Database error'));

      const result = await eventService.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(EventErrorCode.DATABASE_ERROR);
    });
  });

  describe('error logging and monitoring', () => {
    it('should log successful operations', async () => {
      const eventData: CreateEventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue([]);
      mockEventRepository.create = vi.fn().mockResolvedValue(mockEvent);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await eventService.createEvent(eventData);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Event operation success:',
        expect.objectContaining({
          operation: 'create',
          success: true,
          eventId: mockEvent.id
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log failed operations', async () => {
      const eventData: CreateEventData = {
        companyId: '',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z')
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      await eventService.createEvent(eventData);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Event operation failure:',
        expect.objectContaining({
          operation: 'create',
          success: false,
          errorCode: EventErrorCode.COMPANY_NOT_FOUND
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('event statistics', () => {
    it('should return event statistics', async () => {
      const events = [
        { ...mockEvent, isPublic: true, startDateTime: new Date('2024-12-01T10:00:00Z'), endDateTime: new Date('2024-12-01T11:00:00Z') },
        { ...mockEvent, id: 'event-2', isPublic: false, startDateTime: new Date('2024-11-01T10:00:00Z'), endDateTime: new Date('2024-11-01T11:00:00Z') }
      ];

      mockEventRepository.findByCompanyId = vi.fn().mockResolvedValue(events);

      const stats = await eventService.getEventStats('company-123');

      expect(stats.totalEvents).toBe(2);
      expect(stats.publicEvents).toBe(1);
      expect(stats.upcomingEvents).toBe(1);
      expect(stats.pastEvents).toBe(1);
    });

    it('should handle statistics errors gracefully', async () => {
      mockEventRepository.findByCompanyId = vi.fn().mockRejectedValue(new Error('Database error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      const stats = await eventService.getEventStats('company-123');

      expect(stats).toEqual({
        totalEvents: 0,
        publicEvents: 0,
        upcomingEvents: 0,
        pastEvents: 0
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to get event stats:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});