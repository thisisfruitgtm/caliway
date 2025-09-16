import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventManagementService, CreateEventData, UpdateEventData } from '../EventManagementService';
import { Event } from '../../models';
import { IEventRepository } from '../../repositories/EventRepository';
import { ICacheInvalidationService } from '../CacheInvalidationService';

// Mock repository implementation
class MockEventRepository implements IEventRepository {
  private events: Event[] = [];
  private nextId = 1;

  async findById(id: string): Promise<Event | null> {
    return this.events.find(event => event.id === id) || null;
  }

  async findByCompanyId(companyId: string): Promise<Event[]> {
    return this.events.filter(event => event.companyId === companyId);
  }

  async findPublicByCompanyId(companyId: string): Promise<Event[]> {
    return this.events.filter(event => event.companyId === companyId && event.isPublic);
  }

  async findUpcomingByCompanyId(companyId: string, limit?: number): Promise<Event[]> {
    const now = new Date();
    let upcoming = this.events.filter(event => 
      event.companyId === companyId && event.startDateTime > now
    ).sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    
    if (limit) {
      upcoming = upcoming.slice(0, limit);
    }
    
    return upcoming;
  }

  async findByDateRange(companyId: string, startDate: Date, endDate: Date): Promise<Event[]> {
    return this.events.filter(event => 
      event.companyId === companyId &&
      event.startDateTime >= startDate &&
      event.endDateTime <= endDate
    );
  }

  async create(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const now = new Date();
    const event: Event = {
      id: this.nextId.toString(),
      ...eventData,
      createdAt: now,
      updatedAt: now
    };
    this.events.push(event);
    this.nextId++;
    return event;
  }

  async update(id: string, eventData: Partial<Event>): Promise<Event | null> {
    const index = this.events.findIndex(event => event.id === id);
    if (index === -1) return null;

    const updatedEvent = {
      ...this.events[index],
      ...eventData,
      updatedAt: new Date()
    };
    this.events[index] = updatedEvent;
    return updatedEvent;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.events.findIndex(event => event.id === id);
    if (index === -1) return false;
    
    this.events.splice(index, 1);
    return true;
  }

  // Helper method to reset mock data
  reset() {
    this.events = [];
    this.nextId = 1;
  }

  // Helper method to add test data
  addTestEvent(event: Partial<Event>): Event {
    const now = new Date();
    const fullEvent: Event = {
      id: this.nextId.toString(),
      companyId: 'test-company',
      title: 'Test Event',
      description: 'Test Description',
      startDateTime: new Date('2024-12-15T10:00:00Z'),
      endDateTime: new Date('2024-12-15T11:00:00Z'),
      isPublic: true,
      createdAt: now,
      updatedAt: now,
      ...event
    };
    this.events.push(fullEvent);
    this.nextId++;
    return fullEvent;
  }
}

// Mock cache invalidation service
class MockCacheInvalidationService implements ICacheInvalidationService {
  invalidateCalendarFeed = vi.fn();
  invalidateAllCaches = vi.fn();
}

describe('EventManagementService', () => {
  let service: EventManagementService;
  let mockRepository: MockEventRepository;
  let mockCacheService: MockCacheInvalidationService;

  beforeEach(() => {
    mockRepository = new MockEventRepository();
    mockCacheService = new MockCacheInvalidationService();
    service = new EventManagementService(mockRepository, mockCacheService);
  });

  describe('createEvent', () => {
    it('should create a valid event successfully', async () => {
      const eventData: CreateEventData = {
        companyId: 'test-company',
        title: 'Team Meeting',
        description: 'Weekly team sync meeting',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        location: 'Conference Room A',
        isPublic: true
      };

      const result = await service.createEvent(eventData);

      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event!.title).toBe('Team Meeting');
      expect(result.event!.companyId).toBe('test-company');
      expect(result.errors).toBeUndefined();
      
      // Verify cache invalidation was called
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledWith('test-company');
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledTimes(1);
    });

    it('should fail validation for missing required fields', async () => {
      const eventData: CreateEventData = {
        companyId: '',
        title: '',
        description: '',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z')
      };

      const result = await service.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Company ID is required');
      expect(result.errors).toContain('Event title is required');
      expect(result.errors).toContain('Event description is required');
    });

    it('should fail validation when start date is after end date', async () => {
      const eventData: CreateEventData = {
        companyId: 'test-company',
        title: 'Invalid Event',
        description: 'This event has invalid dates',
        startDateTime: new Date('2024-12-15T11:00:00Z'),
        endDateTime: new Date('2024-12-15T10:00:00Z')
      };

      const result = await service.createEvent(eventData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Start date and time must be before end date and time');
    });

    it('should default isPublic to true when not specified', async () => {
      const eventData: CreateEventData = {
        companyId: 'test-company',
        title: 'Public Event',
        description: 'This should be public by default',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z')
      };

      const result = await service.createEvent(eventData);

      expect(result.success).toBe(true);
      expect(result.event!.isPublic).toBe(true);
    });

    it('should trim whitespace from string fields', async () => {
      const eventData: CreateEventData = {
        companyId: 'test-company',
        title: '  Team Meeting  ',
        description: '  Weekly team sync meeting  ',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        location: '  Conference Room A  '
      };

      const result = await service.createEvent(eventData);

      expect(result.success).toBe(true);
      expect(result.event!.title).toBe('Team Meeting');
      expect(result.event!.description).toBe('Weekly team sync meeting');
      expect(result.event!.location).toBe('Conference Room A');
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event successfully', async () => {
      // Create a test event first
      const existingEvent = mockRepository.addTestEvent({
        title: 'Original Title',
        description: 'Original Description'
      });

      const updateData: UpdateEventData = {
        title: 'Updated Title',
        description: 'Updated Description'
      };

      const result = await service.updateEvent(existingEvent.id, updateData);

      expect(result.success).toBe(true);
      expect(result.event!.title).toBe('Updated Title');
      expect(result.event!.description).toBe('Updated Description');
      
      // Verify cache invalidation was called
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledWith(existingEvent.companyId);
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledTimes(1);
    });

    it('should fail when event does not exist', async () => {
      const updateData: UpdateEventData = {
        title: 'Updated Title'
      };

      const result = await service.updateEvent('non-existent-id', updateData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Event not found');
    });

    it('should validate updated data', async () => {
      const existingEvent = mockRepository.addTestEvent({});

      const updateData: UpdateEventData = {
        title: '', // Invalid empty title
        startDateTime: new Date('2024-12-15T11:00:00Z'),
        endDateTime: new Date('2024-12-15T10:00:00Z') // End before start
      };

      const result = await service.updateEvent(existingEvent.id, updateData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Start date and time must be before end date and time');
      // Check that we get a title validation error when setting empty title
      expect(result.errors).toContain('Event title is required');
    });

    it('should trim whitespace from updated string fields', async () => {
      const existingEvent = mockRepository.addTestEvent({});

      const updateData: UpdateEventData = {
        title: '  Updated Title  ',
        location: '  Updated Location  '
      };

      const result = await service.updateEvent(existingEvent.id, updateData);

      expect(result.success).toBe(true);
      expect(result.event!.title).toBe('Updated Title');
      expect(result.event!.location).toBe('Updated Location');
    });
  });

  describe('deleteEvent', () => {
    it('should delete an existing event successfully', async () => {
      const existingEvent = mockRepository.addTestEvent({});

      const result = await service.deleteEvent(existingEvent.id);

      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();

      // Verify cache invalidation was called
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledWith(existingEvent.companyId);
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledTimes(1);

      // Verify event is deleted
      const getResult = await service.getEvent(existingEvent.id);
      expect(getResult.success).toBe(false);
    });

    it('should fail when event does not exist', async () => {
      const result = await service.deleteEvent('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Event not found');
    });
  });

  describe('getEvent', () => {
    it('should retrieve an existing event', async () => {
      const existingEvent = mockRepository.addTestEvent({
        title: 'Test Event'
      });

      const result = await service.getEvent(existingEvent.id);

      expect(result.success).toBe(true);
      expect(result.event!.title).toBe('Test Event');
    });

    it('should fail when event does not exist', async () => {
      const result = await service.getEvent('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Event not found');
    });
  });

  describe('getCompanyEvents', () => {
    it('should retrieve all events for a company', async () => {
      mockRepository.addTestEvent({ companyId: 'company-1', title: 'Event 1' });
      mockRepository.addTestEvent({ companyId: 'company-1', title: 'Event 2' });
      mockRepository.addTestEvent({ companyId: 'company-2', title: 'Event 3' });

      const result = await service.getCompanyEvents('company-1');

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.events!.every(event => event.companyId === 'company-1')).toBe(true);
    });

    it('should return empty array for company with no events', async () => {
      const result = await service.getCompanyEvents('empty-company');

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
    });
  });

  describe('getUpcomingEvents', () => {
    it('should retrieve upcoming events only', async () => {
      const pastDate = new Date('2020-01-01T10:00:00Z');
      const futureDate1 = new Date('2030-01-01T10:00:00Z');
      const futureDate2 = new Date('2030-01-02T10:00:00Z');

      mockRepository.addTestEvent({ 
        companyId: 'test-company',
        title: 'Past Event',
        startDateTime: pastDate,
        endDateTime: new Date(pastDate.getTime() + 3600000)
      });
      mockRepository.addTestEvent({ 
        companyId: 'test-company',
        title: 'Future Event 1',
        startDateTime: futureDate1,
        endDateTime: new Date(futureDate1.getTime() + 3600000)
      });
      mockRepository.addTestEvent({ 
        companyId: 'test-company',
        title: 'Future Event 2',
        startDateTime: futureDate2,
        endDateTime: new Date(futureDate2.getTime() + 3600000)
      });

      const result = await service.getUpcomingEvents('test-company');

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.events!.every(event => event.startDateTime > new Date())).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const futureDate1 = new Date('2030-01-01T10:00:00Z');
      const futureDate2 = new Date('2030-01-02T10:00:00Z');
      const futureDate3 = new Date('2030-01-03T10:00:00Z');

      mockRepository.addTestEvent({ 
        companyId: 'test-company',
        startDateTime: futureDate1,
        endDateTime: new Date(futureDate1.getTime() + 3600000)
      });
      mockRepository.addTestEvent({ 
        companyId: 'test-company',
        startDateTime: futureDate2,
        endDateTime: new Date(futureDate2.getTime() + 3600000)
      });
      mockRepository.addTestEvent({ 
        companyId: 'test-company',
        startDateTime: futureDate3,
        endDateTime: new Date(futureDate3.getTime() + 3600000)
      });

      const result = await service.getUpcomingEvents('test-company', 2);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
    });
  });

  describe('getEventsByDateRange', () => {
    it('should retrieve events within date range', async () => {
      const startRange = new Date('2024-12-01T00:00:00Z');
      const endRange = new Date('2024-12-31T23:59:59Z');

      mockRepository.addTestEvent({
        companyId: 'test-company',
        title: 'Event in range',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z')
      });
      mockRepository.addTestEvent({
        companyId: 'test-company',
        title: 'Event outside range',
        startDateTime: new Date('2025-01-15T10:00:00Z'),
        endDateTime: new Date('2025-01-15T11:00:00Z')
      });

      const result = await service.getEventsByDateRange('test-company', startRange, endRange);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events![0].title).toBe('Event in range');
    });

    it('should fail when start date is after end date', async () => {
      const startRange = new Date('2024-12-31T00:00:00Z');
      const endRange = new Date('2024-12-01T00:00:00Z');

      const result = await service.getEventsByDateRange('test-company', startRange, endRange);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });
  });

  describe('getPublicEvents', () => {
    it('should retrieve only public events', async () => {
      mockRepository.addTestEvent({
        companyId: 'test-company',
        title: 'Public Event',
        isPublic: true
      });
      mockRepository.addTestEvent({
        companyId: 'test-company',
        title: 'Private Event',
        isPublic: false
      });

      const result = await service.getPublicEvents('test-company');

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events![0].title).toBe('Public Event');
      expect(result.events![0].isPublic).toBe(true);
    });
  });

  describe('validateEventData', () => {
    it('should validate event data correctly', () => {
      const validEvent: Partial<Event> = {
        companyId: 'test-company',
        title: 'Valid Event',
        description: 'This is a valid event description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        isPublic: true
      };

      const result = service.validateEventData(validEvent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', () => {
      const invalidEvent: Partial<Event> = {
        companyId: '',
        title: '',
        description: 'short',
        startDateTime: new Date('2024-12-15T11:00:00Z'),
        endDateTime: new Date('2024-12-15T10:00:00Z')
      };

      const result = service.validateEventData(invalidEvent);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('cache invalidation', () => {
    beforeEach(() => {
      // Reset mock call counts before each test
      mockCacheService.invalidateCalendarFeed.mockClear();
    });

    it('should not invalidate cache when event creation fails', async () => {
      const invalidEventData: CreateEventData = {
        companyId: '',
        title: '',
        description: '',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z')
      };

      const result = await service.createEvent(invalidEventData);

      expect(result.success).toBe(false);
      expect(mockCacheService.invalidateCalendarFeed).not.toHaveBeenCalled();
    });

    it('should not invalidate cache when event update fails', async () => {
      const updateData: UpdateEventData = {
        title: 'Updated Title'
      };

      const result = await service.updateEvent('non-existent-id', updateData);

      expect(result.success).toBe(false);
      expect(mockCacheService.invalidateCalendarFeed).not.toHaveBeenCalled();
    });

    it('should not invalidate cache when event deletion fails', async () => {
      const result = await service.deleteEvent('non-existent-id');

      expect(result.success).toBe(false);
      expect(mockCacheService.invalidateCalendarFeed).not.toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      // Make cache invalidation throw an error
      mockCacheService.invalidateCalendarFeed.mockImplementation(() => {
        throw new Error('Cache invalidation failed');
      });

      const eventData: CreateEventData = {
        companyId: 'test-company',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z')
      };

      // Event creation should still succeed even if cache invalidation fails
      const result = await service.createEvent(eventData);

      expect(result.success).toBe(true);
      expect(mockCacheService.invalidateCalendarFeed).toHaveBeenCalledWith('test-company');
    });
  });
});