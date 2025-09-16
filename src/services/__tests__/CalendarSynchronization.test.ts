import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CalendarFeedService } from '../CalendarFeedService';
import { Event } from '../../models';
import { IEventRepository } from '../../repositories/EventRepository';

// Mock event repository
class MockEventRepository implements IEventRepository {
  private events: Event[] = [];

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
    );
    return limit ? upcoming.slice(0, limit) : upcoming;
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
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...eventData,
      createdAt: now,
      updatedAt: now
    };
    this.events.push(event);
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

  // Helper methods for testing
  reset() {
    this.events = [];
  }

  addTestEvent(event: Partial<Event>): Event {
    const now = new Date();
    const fullEvent: Event = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    return fullEvent;
  }
}

describe('Calendar Synchronization Tests', () => {
  let service: CalendarFeedService;
  let mockRepository: MockEventRepository;

  beforeEach(() => {
    mockRepository = new MockEventRepository();
    service = new CalendarFeedService(mockRepository);
  });

  describe('iCal Feed Format Validation', () => {
    it('should generate valid iCal header and footer', async () => {
      // Arrange
      const companyId = 'test-company';

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('VERSION:2.0');
      expect(feed).toContain('PRODID:-//Company Calendar Platform//Calendar Feed//EN');
      expect(feed).toContain('CALSCALE:GREGORIAN');
      expect(feed).toContain('METHOD:PUBLISH');
      expect(feed).toContain('END:VCALENDAR');
    });

    it('should generate valid VEVENT blocks for each event', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Test Meeting',
        description: 'Important meeting',
        startDateTime: new Date('2024-12-15T10:00:00Z'),
        endDateTime: new Date('2024-12-15T11:00:00Z'),
        location: 'Conference Room A'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('BEGIN:VEVENT');
      expect(feed).toContain('END:VEVENT');
      expect(feed).toContain('SUMMARY:Test Meeting');
      expect(feed).toContain('DESCRIPTION:Important meeting');
      expect(feed).toContain('LOCATION:Conference Room A');
      expect(feed).toContain('DTSTART:20241215T100000Z');
      expect(feed).toContain('DTEND:20241215T110000Z');
    });

    it('should include required iCal fields for each event', async () => {
      // Arrange
      const companyId = 'test-company';
      const testEvent = mockRepository.addTestEvent({
        companyId,
        title: 'Required Fields Test',
        description: 'Testing required fields'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain(`UID:${testEvent.id}@company-calendar-platform.com`);
      expect(feed).toContain('DTSTAMP:');
      expect(feed).toContain('DTSTART:');
      expect(feed).toContain('DTEND:');
      expect(feed).toContain('SUMMARY:');
      expect(feed).toContain('DESCRIPTION:');
    });

    it('should properly escape special characters in iCal format', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Meeting; with, special\\characters\nand newlines',
        description: 'Description with; commas, backslashes\\ and\nnewlines\rcarriage returns',
        location: 'Room; A, Building\\B\nFloor 2'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('SUMMARY:Meeting\\; with\\, special\\\\characters\\nand newlines');
      expect(feed).toContain('DESCRIPTION:Description with\\; commas\\, backslashes\\\\ and\\nnewlinescarriage returns');
      expect(feed).toContain('LOCATION:Room\\; A\\, Building\\\\B\\nFloor 2');
    });

    it('should handle events without optional fields', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Minimal Event',
        description: 'Event without location',
        location: undefined
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('SUMMARY:Minimal Event');
      expect(feed).toContain('DESCRIPTION:Event without location');
      expect(feed).not.toContain('LOCATION:');
    });
  });

  describe('Event Modifications and Feed Updates', () => {
    it('should include newly added events in feed', async () => {
      // Arrange
      const companyId = 'test-company';
      
      // Initial feed should be empty
      let feed = await service.generateICalFeed(companyId);
      expect(feed).not.toContain('BEGIN:VEVENT');

      // Add an event
      mockRepository.addTestEvent({
        companyId,
        title: 'New Event',
        description: 'Newly added event'
      });

      // Act
      feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('BEGIN:VEVENT');
      expect(feed).toContain('SUMMARY:New Event');
      expect(feed).toContain('DESCRIPTION:Newly added event');
    });

    it('should reflect updated event details in feed', async () => {
      // Arrange
      const companyId = 'test-company';
      const event = mockRepository.addTestEvent({
        companyId,
        title: 'Original Title',
        description: 'Original Description'
      });

      // Initial feed
      let feed = await service.generateICalFeed(companyId);
      expect(feed).toContain('SUMMARY:Original Title');
      expect(feed).toContain('DESCRIPTION:Original Description');

      // Update the event
      await mockRepository.update(event.id, {
        title: 'Updated Title',
        description: 'Updated Description'
      });

      // Act
      feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('SUMMARY:Updated Title');
      expect(feed).toContain('DESCRIPTION:Updated Description');
      expect(feed).not.toContain('SUMMARY:Original Title');
      expect(feed).not.toContain('DESCRIPTION:Original Description');
    });

    it('should remove deleted events from feed', async () => {
      // Arrange
      const companyId = 'test-company';
      const event1 = mockRepository.addTestEvent({
        companyId,
        title: 'Event to Keep',
        description: 'This event will remain'
      });
      const event2 = mockRepository.addTestEvent({
        companyId,
        title: 'Event to Delete',
        description: 'This event will be removed'
      });

      // Initial feed should contain both events
      let feed = await service.generateICalFeed(companyId);
      expect(feed).toContain('SUMMARY:Event to Keep');
      expect(feed).toContain('SUMMARY:Event to Delete');

      // Delete one event
      await mockRepository.delete(event2.id);

      // Act
      feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('SUMMARY:Event to Keep');
      expect(feed).not.toContain('SUMMARY:Event to Delete');
    });

    it('should only include public events in feed', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Public Event',
        description: 'This is public',
        isPublic: true
      });
      mockRepository.addTestEvent({
        companyId,
        title: 'Private Event',
        description: 'This is private',
        isPublic: false
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('SUMMARY:Public Event');
      expect(feed).not.toContain('SUMMARY:Private Event');
    });
  });

  describe('Calendar Application Compatibility', () => {
    it('should generate RFC 5545 compliant date format', async () => {
      // Arrange
      const companyId = 'test-company';
      const testDate = new Date('2024-12-15T14:30:00.000Z');
      mockRepository.addTestEvent({
        companyId,
        startDateTime: testDate,
        endDateTime: new Date(testDate.getTime() + 3600000) // +1 hour
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('DTSTART:20241215T143000Z');
      expect(feed).toContain('DTEND:20241215T153000Z');
    });

    it('should generate unique UIDs for each event', async () => {
      // Arrange
      const companyId = 'test-company';
      const event1 = mockRepository.addTestEvent({
        companyId,
        title: 'Event 1'
      });
      const event2 = mockRepository.addTestEvent({
        companyId,
        title: 'Event 2'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain(`UID:${event1.id}@company-calendar-platform.com`);
      expect(feed).toContain(`UID:${event2.id}@company-calendar-platform.com`);
      
      // Ensure UIDs are different
      expect(event1.id).not.toBe(event2.id);
    });

    it('should include DTSTAMP for each event', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Timestamp Test Event'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('DTSTAMP:');
      // DTSTAMP should be in the correct format (YYYYMMDDTHHMMSSZ)
      expect(feed).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    });

    it('should handle multiple events correctly', async () => {
      // Arrange
      const companyId = 'test-company';
      const events = [];
      for (let i = 1; i <= 5; i++) {
        events.push(mockRepository.addTestEvent({
          companyId,
          title: `Event ${i}`,
          description: `Description for event ${i}`,
          startDateTime: new Date(`2024-12-${15 + i}T10:00:00Z`),
          endDateTime: new Date(`2024-12-${15 + i}T11:00:00Z`)
        }));
      }

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      const eventBlocks = feed.match(/BEGIN:VEVENT/g);
      expect(eventBlocks).toHaveLength(5);
      
      const endEventBlocks = feed.match(/END:VEVENT/g);
      expect(endEventBlocks).toHaveLength(5);

      // Check that all events are included
      for (let i = 1; i <= 5; i++) {
        expect(feed).toContain(`SUMMARY:Event ${i}`);
        expect(feed).toContain(`DESCRIPTION:Description for event ${i}`);
      }
    });
  });

  describe('Feed Content Validation', () => {
    it('should maintain proper line endings (CRLF)', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Line Ending Test'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('\r\n');
      expect(feed.split('\r\n')).toHaveLength(feed.split('\n').length);
    });

    it('should handle empty company (no events)', async () => {
      // Arrange
      const companyId = 'empty-company';

      // Act
      const feed = await service.generateICalFeed(companyId);

      // Assert
      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('END:VCALENDAR');
      expect(feed).not.toContain('BEGIN:VEVENT');
      expect(feed).not.toContain('END:VEVENT');
    });

    it('should generate consistent feed structure', async () => {
      // Arrange
      const companyId = 'test-company';
      mockRepository.addTestEvent({
        companyId,
        title: 'Structure Test Event'
      });

      // Act
      const feed = await service.generateICalFeed(companyId);
      const lines = feed.split('\r\n');

      // Assert
      expect(lines[0]).toBe('BEGIN:VCALENDAR');
      expect(lines[1]).toBe('VERSION:2.0');
      expect(lines[2]).toBe('PRODID:-//Company Calendar Platform//Calendar Feed//EN');
      expect(lines[3]).toBe('CALSCALE:GREGORIAN');
      expect(lines[4]).toBe('METHOD:PUBLISH');
      expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    });
  });
});