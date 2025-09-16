import { Event } from '../models';
import { EventRepository } from '../repositories';
import { CalendarFeedError, CalendarFeedErrorCode } from '../types/errors';
import { cacheService } from './CacheService';

export interface ICalendarFeedService {
  generateICalFeed(companyId: string): Promise<string>;
  getPublicEvents(companyId: string): Promise<Event[]>;
  formatEventForFeed(event: Event): string;
}

export interface CalendarFeedResult {
  success: boolean;
  feed?: string;
  events?: Event[];
  error?: string;
  errorCode?: CalendarFeedErrorCode;
}

export interface FeedGenerationContext {
  companyId: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class CalendarFeedService implements ICalendarFeedService {
  private eventRepository: EventRepository;
  private readonly maxFeedSize = 1024 * 1024; // 1MB max feed size
  private readonly maxEventsPerFeed = 1000; // Maximum events per feed

  constructor(eventRepository?: EventRepository) {
    this.eventRepository = eventRepository || new EventRepository();
  }

  /**
   * Generate iCal/ICS feed for a company's public events
   */
  async generateICalFeed(companyId: string, context?: FeedGenerationContext): Promise<string> {
    try {
      if (!companyId || typeof companyId !== 'string' || companyId.trim() === '') {
        throw new CalendarFeedError(
          CalendarFeedErrorCode.INVALID_COMPANY_ID,
          'Invalid or missing company ID',
          undefined,
          400
        );
      }

      // Check cache first
      const cachedFeed = cacheService.getCachedFeed(companyId);
      if (cachedFeed) {
        this.logFeedOperation('generate', companyId, true, undefined, context, undefined, true);
        return cachedFeed;
      }

      this.logFeedOperation('generate', companyId, true, undefined, context);

      const events = await this.getPublicEvents(companyId);
      
      if (events.length === 0) {
        // Return empty but valid calendar feed
        const emptyFeed = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Company Calendar Platform//Calendar Feed//EN',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH',
          'END:VCALENDAR'
        ].join('\r\n');
        
        this.logFeedOperation('generate', companyId, true, undefined, context, 0);
        return emptyFeed;
      }

      // Check if we have too many events
      if (events.length > this.maxEventsPerFeed) {
        console.warn(`Feed for company ${companyId} has ${events.length} events, truncating to ${this.maxEventsPerFeed}`);
        events.splice(this.maxEventsPerFeed);
      }

      const icalHeader = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Company Calendar Platform//Calendar Feed//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:Company Calendar`,
        `X-WR-CALDESC:Public events calendar`,
        `X-WR-TIMEZONE:UTC`
      ].join('\r\n');

      const icalFooter = 'END:VCALENDAR';

      const eventStrings: string[] = [];
      for (const event of events) {
        try {
          const eventString = this.formatEventForFeed(event);
          eventStrings.push(eventString);
        } catch (error) {
          console.warn(`Failed to format event ${event.id} for feed:`, error);
          // Continue with other events instead of failing the entire feed
        }
      }
      
      const feed = [icalHeader, ...eventStrings, icalFooter].join('\r\n');

      // Check feed size
      if (feed.length > this.maxFeedSize) {
        throw new CalendarFeedError(
          CalendarFeedErrorCode.FEED_SIZE_EXCEEDED,
          `Feed size ${feed.length} exceeds maximum ${this.maxFeedSize}`,
          undefined,
          413
        );
      }

      // Cache the generated feed
      cacheService.setCachedFeed(companyId, feed);

      this.logFeedOperation('generate', companyId, true, undefined, context, events.length);
      return feed;
    } catch (error) {
      if (error instanceof CalendarFeedError) {
        this.logFeedOperation('generate', companyId, false, error.code, context);
        throw error;
      }

      console.error('Calendar feed generation error:', error);
      const feedError = new CalendarFeedError(
        CalendarFeedErrorCode.FEED_GENERATION_FAILED,
        `Failed to generate calendar feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        500
      );
      this.logFeedOperation('generate', companyId, false, feedError.code, context);
      throw feedError;
    }
  }

  /**
   * Get all public events for a company
   */
  async getPublicEvents(companyId: string): Promise<Event[]> {
    try {
      if (!companyId || typeof companyId !== 'string' || companyId.trim() === '') {
        throw new CalendarFeedError(
          CalendarFeedErrorCode.INVALID_COMPANY_ID,
          'Invalid or missing company ID for event retrieval',
          undefined,
          400
        );
      }

      // Check cache first
      const cachedEvents = cacheService.getCachedPublicEvents(companyId);
      if (cachedEvents) {
        return cachedEvents;
      }

      const events = await this.eventRepository.findPublicByCompanyId(companyId);
      
      // Sort events by start date for better feed organization
      const sortedEvents = events.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
      
      // Cache the events
      cacheService.setCachedPublicEvents(companyId, sortedEvents);
      
      return sortedEvents;
    } catch (error) {
      if (error instanceof CalendarFeedError) {
        throw error;
      }

      console.error('Error retrieving public events:', error);
      throw new CalendarFeedError(
        CalendarFeedErrorCode.FEED_GENERATION_FAILED,
        `Failed to retrieve public events: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        500
      );
    }
  }

  /**
   * Format a single event for iCal feed
   */
  formatEventForFeed(event: Event): string {
    try {
      if (!event || !event.id || !event.title || !event.startDateTime || !event.endDateTime) {
        throw new CalendarFeedError(
          CalendarFeedErrorCode.FEED_FORMAT_ERROR,
          'Invalid event data for feed formatting',
          undefined,
          400
        );
      }

      const now = new Date();
      const dtstamp = this.formatDateForICal(now);
      const dtstart = this.formatDateForICal(event.startDateTime);
      const dtend = this.formatDateForICal(event.endDateTime);
      const uid = `${event.id}@company-calendar-platform.com`;
      
      // Escape special characters in text fields according to RFC 5545
      const title = this.escapeICalText(event.title);
      const description = this.escapeICalText(event.description || '');
      const location = event.location ? this.escapeICalText(event.location) : '';

      const eventLines = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description}`,
        `STATUS:CONFIRMED`,
        `TRANSP:OPAQUE`
      ];

      if (location) {
        eventLines.push(`LOCATION:${location}`);
      }

      // Add creation and modification timestamps if available
      if (event.createdAt) {
        eventLines.push(`CREATED:${this.formatDateForICal(event.createdAt)}`);
      }
      if (event.updatedAt) {
        eventLines.push(`LAST-MODIFIED:${this.formatDateForICal(event.updatedAt)}`);
      }

      eventLines.push('END:VEVENT');

      const eventString = eventLines.join('\r\n');

      // Validate the generated event string
      if (eventString.length > 8192) { // 8KB per event limit
        console.warn(`Event ${event.id} exceeds size limit, truncating description`);
        // Truncate description and try again
        const truncatedDescription = this.escapeICalText(
          (event.description || '').substring(0, 500) + '...'
        );
        const truncatedLines = eventLines.map(line => 
          line.startsWith('DESCRIPTION:') ? `DESCRIPTION:${truncatedDescription}` : line
        );
        return truncatedLines.join('\r\n');
      }

      return eventString;
    } catch (error) {
      if (error instanceof CalendarFeedError) {
        throw error;
      }

      console.error('Event formatting error:', error);
      throw new CalendarFeedError(
        CalendarFeedErrorCode.FEED_FORMAT_ERROR,
        `Failed to format event for feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        500
      );
    }
  }

  /**
   * Format date for iCal format (YYYYMMDDTHHMMSSZ)
   */
  private formatDateForICal(date: Date): string {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Escape special characters for iCal text fields
   */
  private escapeICalText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/;/g, '\\;')    // Escape semicolons
      .replace(/,/g, '\\,')    // Escape commas
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '')      // Remove carriage returns
      .trim();                 // Remove leading/trailing whitespace
  }

  /**
   * Generate calendar feed with error handling wrapper
   */
  async generateICalFeedSafe(companyId: string, context?: FeedGenerationContext): Promise<CalendarFeedResult> {
    try {
      const feed = await this.generateICalFeed(companyId, context);
      return {
        success: true,
        feed
      };
    } catch (error) {
      if (error instanceof CalendarFeedError) {
        return {
          success: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      console.error('Unexpected calendar feed error:', error);
      return {
        success: false,
        error: 'Failed to generate calendar feed. Please try again later.',
        errorCode: CalendarFeedErrorCode.FEED_GENERATION_FAILED
      };
    }
  }

  /**
   * Get public events with error handling wrapper
   */
  async getPublicEventsSafe(companyId: string): Promise<CalendarFeedResult> {
    try {
      const events = await this.getPublicEvents(companyId);
      return {
        success: true,
        events
      };
    } catch (error) {
      if (error instanceof CalendarFeedError) {
        return {
          success: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      console.error('Unexpected error retrieving events:', error);
      return {
        success: false,
        error: 'Failed to retrieve calendar events. Please try again later.',
        errorCode: CalendarFeedErrorCode.FEED_GENERATION_FAILED
      };
    }
  }

  /**
   * Validate calendar feed format
   */
  validateFeedFormat(feed: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!feed || typeof feed !== 'string') {
      errors.push('Feed must be a non-empty string');
      return { isValid: false, errors };
    }

    // Check for required iCal components
    if (!feed.includes('BEGIN:VCALENDAR')) {
      errors.push('Feed must begin with BEGIN:VCALENDAR');
    }

    if (!feed.includes('END:VCALENDAR')) {
      errors.push('Feed must end with END:VCALENDAR');
    }

    if (!feed.includes('VERSION:2.0')) {
      errors.push('Feed must specify VERSION:2.0');
    }

    // Check for proper line endings
    if (feed.includes('\n') && !feed.includes('\r\n')) {
      errors.push('Feed should use CRLF line endings (\\r\\n)');
    }

    // Check feed size
    if (feed.length > this.maxFeedSize) {
      errors.push(`Feed size ${feed.length} exceeds maximum ${this.maxFeedSize}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Log feed operations for monitoring and debugging
   */
  private logFeedOperation(
    operation: string,
    companyId: string,
    success: boolean,
    errorCode?: CalendarFeedErrorCode,
    context?: FeedGenerationContext,
    eventCount?: number,
    cacheHit?: boolean
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      companyId,
      success,
      errorCode,
      eventCount,
      cacheHit: cacheHit || false,
      requestId: context?.requestId,
      userAgent: context?.userAgent,
      ipAddress: context?.ipAddress
    };

    if (success) {
      console.log('Calendar feed operation success:', logEntry);
    } else {
      console.warn('Calendar feed operation failure:', logEntry);
    }

    // In production, you might want to send this to a monitoring service
  }

  /**
   * Get feed generation statistics
   */
  async getFeedStats(companyId: string): Promise<{
    totalEvents: number;
    publicEvents: number;
    feedSize: number;
    lastGenerated: Date;
  }> {
    try {
      const events = await this.getPublicEvents(companyId);
      const feed = await this.generateICalFeed(companyId);

      return {
        totalEvents: events.length,
        publicEvents: events.filter(event => event.isPublic).length,
        feedSize: feed.length,
        lastGenerated: new Date()
      };
    } catch (error) {
      console.error('Failed to get feed stats:', error);
      return {
        totalEvents: 0,
        publicEvents: 0,
        feedSize: 0,
        lastGenerated: new Date()
      };
    }
  }

  /**
   * Invalidate cache for a company
   */
  invalidateCompanyCache(companyId: string): void {
    cacheService.invalidateCompanyCache(companyId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Warm up cache for a company
   */
  async warmUpCache(companyId: string): Promise<void> {
    await cacheService.warmUpCache(
      companyId,
      () => this.generateICalFeed(companyId),
      () => this.getPublicEvents(companyId)
    );
  }

  /**
   * Create fallback feed for service unavailability
   */
  createFallbackFeed(companyName?: string): string {
    const fallbackMessage = companyName 
      ? `Calendar temporarily unavailable for ${companyName}`
      : 'Calendar temporarily unavailable';

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Company Calendar Platform//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${fallbackMessage}`,
      'BEGIN:VEVENT',
      `UID:fallback-${Date.now()}@company-calendar-platform.com`,
      `DTSTAMP:${this.formatDateForICal(new Date())}`,
      `DTSTART:${this.formatDateForICal(new Date())}`,
      `DTEND:${this.formatDateForICal(new Date(Date.now() + 3600000))}`, // 1 hour later
      `SUMMARY:${fallbackMessage}`,
      'DESCRIPTION:The calendar service is temporarily unavailable. Please try again later.',
      'STATUS:TENTATIVE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }
}