import { Event } from '../models';
import { EventRepository } from '../repositories';

export interface ICalendarFeedService {
  generateICalFeed(companyId: string): Promise<string>;
  getPublicEvents(companyId: string): Promise<Event[]>;
  formatEventForFeed(event: Event): string;
}

export class CalendarFeedService implements ICalendarFeedService {
  private eventRepository: EventRepository;

  constructor(eventRepository?: EventRepository) {
    this.eventRepository = eventRepository || new EventRepository();
  }

  /**
   * Generate iCal/ICS feed for a company's public events
   */
  async generateICalFeed(companyId: string): Promise<string> {
    const events = await this.getPublicEvents(companyId);
    
    const icalHeader = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Company Calendar Platform//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ].join('\r\n');

    const icalFooter = 'END:VCALENDAR';

    const eventStrings = events.map(event => this.formatEventForFeed(event));
    
    return [icalHeader, ...eventStrings, icalFooter].join('\r\n');
  }

  /**
   * Get all public events for a company
   */
  async getPublicEvents(companyId: string): Promise<Event[]> {
    return await this.eventRepository.findPublicByCompanyId(companyId);
  }

  /**
   * Format a single event for iCal feed
   */
  formatEventForFeed(event: Event): string {
    const now = new Date();
    const dtstamp = this.formatDateForICal(now);
    const dtstart = this.formatDateForICal(event.startDateTime);
    const dtend = this.formatDateForICal(event.endDateTime);
    const uid = `${event.id}@company-calendar-platform.com`;
    
    // Escape special characters in text fields according to RFC 5545
    const title = this.escapeICalText(event.title);
    const description = this.escapeICalText(event.description);
    const location = event.location ? this.escapeICalText(event.location) : '';

    const eventLines = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`
    ];

    if (location) {
      eventLines.push(`LOCATION:${location}`);
    }

    eventLines.push('END:VEVENT');

    return eventLines.join('\r\n');
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
    return text
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/;/g, '\\;')    // Escape semicolons
      .replace(/,/g, '\\,')    // Escape commas
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '');     // Remove carriage returns
  }
}