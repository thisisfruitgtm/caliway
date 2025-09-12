import { Event } from '../models';
import { EventRepository, IEventRepository } from '../repositories/EventRepository';
import { validateEvent, ValidationResult } from '../models/validation';

export interface CreateEventData {
  companyId: string;
  title: string;
  description: string;
  startDateTime: Date;
  endDateTime: Date;
  location?: string;
  isPublic?: boolean;
}

export interface UpdateEventData {
  title?: string;
  description?: string;
  startDateTime?: Date;
  endDateTime?: Date;
  location?: string;
  isPublic?: boolean;
}

export interface EventManagementResult {
  success: boolean;
  event?: Event;
  errors?: string[];
}

export interface EventListResult {
  success: boolean;
  events?: Event[];
  errors?: string[];
}

export class EventManagementService {
  private eventRepository: IEventRepository;

  constructor(eventRepository?: IEventRepository) {
    this.eventRepository = eventRepository || new EventRepository();
  }

  /**
   * Create a new event with validation
   */
  async createEvent(eventData: CreateEventData): Promise<EventManagementResult> {
    try {
      // Prepare event object for validation
      const eventToValidate: Partial<Event> = {
        companyId: eventData.companyId,
        title: eventData.title,
        description: eventData.description,
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime,
        location: eventData.location,
        isPublic: eventData.isPublic ?? true, // Default to public
      };

      // Validate the event data
      const validation = validateEvent(eventToValidate);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Create the event in the repository
      const createdEvent = await this.eventRepository.create({
        companyId: eventData.companyId,
        title: eventData.title.trim(),
        description: eventData.description.trim(),
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime,
        location: eventData.location?.trim(),
        isPublic: eventData.isPublic ?? true
      });

      return {
        success: true,
        event: createdEvent
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Update an existing event with validation
   */
  async updateEvent(eventId: string, eventData: UpdateEventData): Promise<EventManagementResult> {
    try {
      // First, get the existing event to validate the update
      const existingEvent = await this.eventRepository.findById(eventId);
      if (!existingEvent) {
        return {
          success: false,
          errors: ['Event not found']
        };
      }

      // Merge existing data with updates for validation
      const eventToValidate: Partial<Event> = {
        ...existingEvent,
        ...eventData,
        // Trim string fields if they're being updated
        title: eventData.title !== undefined ? eventData.title.trim() : existingEvent.title,
        description: eventData.description !== undefined ? eventData.description.trim() : existingEvent.description,
        location: eventData.location !== undefined ? eventData.location?.trim() : existingEvent.location,
      };

      // Validate the merged event data
      const validation = validateEvent(eventToValidate);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Prepare update data with trimmed strings
      const updateData: UpdateEventData = { ...eventData };
      if (updateData.title) updateData.title = updateData.title.trim();
      if (updateData.description) updateData.description = updateData.description.trim();
      if (updateData.location !== undefined) updateData.location = updateData.location?.trim();

      // Update the event in the repository
      const updatedEvent = await this.eventRepository.update(eventId, updateData);
      if (!updatedEvent) {
        return {
          success: false,
          errors: ['Failed to update event']
        };
      }

      return {
        success: true,
        event: updatedEvent
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // Check if event exists first
      const existingEvent = await this.eventRepository.findById(eventId);
      if (!existingEvent) {
        return {
          success: false,
          errors: ['Event not found']
        };
      }

      const deleted = await this.eventRepository.delete(eventId);
      if (!deleted) {
        return {
          success: false,
          errors: ['Failed to delete event']
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<EventManagementResult> {
    try {
      const event = await this.eventRepository.findById(eventId);
      if (!event) {
        return {
          success: false,
          errors: ['Event not found']
        };
      }

      return {
        success: true,
        event
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to retrieve event: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get all events for a company
   */
  async getCompanyEvents(companyId: string): Promise<EventListResult> {
    try {
      const events = await this.eventRepository.findByCompanyId(companyId);
      return {
        success: true,
        events
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to retrieve company events: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get upcoming events for a company
   */
  async getUpcomingEvents(companyId: string, limit?: number): Promise<EventListResult> {
    try {
      const events = await this.eventRepository.findUpcomingByCompanyId(companyId, limit);
      return {
        success: true,
        events
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to retrieve upcoming events: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get events within a date range for a company
   */
  async getEventsByDateRange(companyId: string, startDate: Date, endDate: Date): Promise<EventListResult> {
    try {
      // Validate date range
      if (startDate >= endDate) {
        return {
          success: false,
          errors: ['Start date must be before end date']
        };
      }

      const events = await this.eventRepository.findByDateRange(companyId, startDate, endDate);
      return {
        success: true,
        events
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to retrieve events by date range: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get public events for a company (for calendar feeds and public views)
   */
  async getPublicEvents(companyId: string): Promise<EventListResult> {
    try {
      const events = await this.eventRepository.findPublicByCompanyId(companyId);
      return {
        success: true,
        events
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to retrieve public events: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate event data without creating/updating
   */
  validateEventData(eventData: Partial<Event>): ValidationResult {
    return validateEvent(eventData);
  }
}