import { Event } from '../models';
import { EventRepository, IEventRepository } from '../repositories/EventRepository';
import { validateEvent, ValidationResult } from '../models/validation';
import { CacheInvalidationService, ICacheInvalidationService } from './CacheInvalidationService';
import { EventManagementError, EventErrorCode } from '../types/errors';

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
  errorCode?: EventErrorCode;
}

export interface EventListResult {
  success: boolean;
  events?: Event[];
  errors?: string[];
  errorCode?: EventErrorCode;
}

export interface EventOperationContext {
  userId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class EventManagementService {
  private eventRepository: IEventRepository;
  private cacheInvalidationService: ICacheInvalidationService;

  constructor(eventRepository?: IEventRepository, cacheInvalidationService?: ICacheInvalidationService) {
    this.eventRepository = eventRepository || new EventRepository();
    this.cacheInvalidationService = cacheInvalidationService || new CacheInvalidationService();
  }

  /**
   * Create a new event with validation
   */
  async createEvent(eventData: CreateEventData, context?: EventOperationContext): Promise<EventManagementResult> {
    try {
      // Input validation
      if (!eventData.companyId) {
        const error = new EventManagementError(
          EventErrorCode.COMPANY_NOT_FOUND,
          'Company ID is required for event creation',
          undefined,
          400
        );
        this.logEventOperation('create', false, error.code, context);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Prepare event object for validation
      const eventToValidate: Partial<Event> = {
        companyId: eventData.companyId,
        title: eventData.title?.trim(),
        description: eventData.description?.trim(),
        startDateTime: eventData.startDateTime,
        endDateTime: eventData.endDateTime,
        location: eventData.location?.trim(),
        isPublic: eventData.isPublic ?? true, // Default to public
      };

      // Validate the event data
      const validation = validateEvent(eventToValidate);
      if (!validation.isValid) {
        const error = new EventManagementError(
          EventErrorCode.VALIDATION_FAILED,
          'Event validation failed',
          undefined,
          400,
          validation.errors
        );
        this.logEventOperation('create', false, error.code, context);
        return {
          success: false,
          errors: validation.errors,
          errorCode: error.code
        };
      }

      // Additional business logic validation
      const businessValidation = await this.validateBusinessRules(eventToValidate, 'create');
      if (!businessValidation.isValid) {
        this.logEventOperation('create', false, businessValidation.errorCode, context);
        return {
          success: false,
          errors: businessValidation.errors,
          errorCode: businessValidation.errorCode
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

      // Invalidate cache for the company's calendar feed
      try {
        await this.cacheInvalidationService.invalidateCalendarFeed(eventData.companyId);
      } catch (error) {
        // Cache invalidation failure shouldn't break the main operation
        console.warn('Cache invalidation failed during event creation:', {
          eventId: createdEvent.id,
          companyId: eventData.companyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      this.logEventOperation('create', true, undefined, context, createdEvent.id);

      return {
        success: true,
        event: createdEvent
      };
    } catch (error) {
      console.error('Event creation error:', error);
      
      const eventError = this.handleDatabaseError(error, 'create event');
      this.logEventOperation('create', false, eventError.code, context);
      
      return {
        success: false,
        errors: [eventError.userMessage],
        errorCode: eventError.code
      };
    }
  }

  /**
   * Update an existing event with validation
   */
  async updateEvent(eventId: string, eventData: UpdateEventData, context?: EventOperationContext): Promise<EventManagementResult> {
    try {
      if (!eventId) {
        const error = new EventManagementError(
          EventErrorCode.INVALID_EVENT_DATA,
          'Event ID is required for update',
          undefined,
          400
        );
        this.logEventOperation('update', false, error.code, context);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // First, get the existing event to validate the update
      const existingEvent = await this.eventRepository.findById(eventId);
      if (!existingEvent) {
        const error = new EventManagementError(
          EventErrorCode.EVENT_NOT_FOUND,
          `Event not found: ${eventId}`,
          undefined,
          404
        );
        this.logEventOperation('update', false, error.code, context, eventId);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Check permissions if context is provided
      if (context?.companyId && existingEvent.companyId !== context.companyId) {
        const error = new EventManagementError(
          EventErrorCode.PERMISSION_DENIED,
          `User does not have permission to update event: ${eventId}`,
          undefined,
          403
        );
        this.logEventOperation('update', false, error.code, context, eventId);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Merge existing data with updates for validation
      const eventToValidate: Partial<Event> = {
        ...existingEvent,
        ...eventData,
        // Trim string fields if they're being updated
        title: eventData.title !== undefined ? eventData.title?.trim() : existingEvent.title,
        description: eventData.description !== undefined ? eventData.description?.trim() : existingEvent.description,
        location: eventData.location !== undefined ? eventData.location?.trim() : existingEvent.location,
      };

      // Validate the merged event data
      const validation = validateEvent(eventToValidate);
      if (!validation.isValid) {
        const error = new EventManagementError(
          EventErrorCode.VALIDATION_FAILED,
          'Event validation failed during update',
          undefined,
          400,
          validation.errors
        );
        this.logEventOperation('update', false, error.code, context, eventId);
        return {
          success: false,
          errors: validation.errors,
          errorCode: error.code
        };
      }

      // Additional business logic validation
      const businessValidation = await this.validateBusinessRules(eventToValidate, 'update', eventId);
      if (!businessValidation.isValid) {
        this.logEventOperation('update', false, businessValidation.errorCode, context, eventId);
        return {
          success: false,
          errors: businessValidation.errors,
          errorCode: businessValidation.errorCode
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
        const error = new EventManagementError(
          EventErrorCode.DATABASE_ERROR,
          `Failed to update event in database: ${eventId}`,
          undefined,
          500
        );
        this.logEventOperation('update', false, error.code, context, eventId);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Invalidate cache for the company's calendar feed
      try {
        await this.cacheInvalidationService.invalidateCalendarFeed(existingEvent.companyId);
      } catch (error) {
        // Cache invalidation failure shouldn't break the main operation
        console.warn('Cache invalidation failed during event update:', {
          eventId,
          companyId: existingEvent.companyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      this.logEventOperation('update', true, undefined, context, eventId);

      return {
        success: true,
        event: updatedEvent
      };
    } catch (error) {
      console.error('Event update error:', error);
      
      const eventError = this.handleDatabaseError(error, 'update event');
      this.logEventOperation('update', false, eventError.code, context, eventId);
      
      return {
        success: false,
        errors: [eventError.userMessage],
        errorCode: eventError.code
      };
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, context?: EventOperationContext): Promise<{ success: boolean; errors?: string[]; errorCode?: EventErrorCode }> {
    try {
      if (!eventId) {
        const error = new EventManagementError(
          EventErrorCode.INVALID_EVENT_DATA,
          'Event ID is required for deletion',
          undefined,
          400
        );
        this.logEventOperation('delete', false, error.code, context);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Check if event exists first
      const existingEvent = await this.eventRepository.findById(eventId);
      if (!existingEvent) {
        const error = new EventManagementError(
          EventErrorCode.EVENT_NOT_FOUND,
          `Event not found: ${eventId}`,
          undefined,
          404
        );
        this.logEventOperation('delete', false, error.code, context, eventId);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Check permissions if context is provided
      if (context?.companyId && existingEvent.companyId !== context.companyId) {
        const error = new EventManagementError(
          EventErrorCode.PERMISSION_DENIED,
          `User does not have permission to delete event: ${eventId}`,
          undefined,
          403
        );
        this.logEventOperation('delete', false, error.code, context, eventId);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      const deleted = await this.eventRepository.delete(eventId);
      if (!deleted) {
        const error = new EventManagementError(
          EventErrorCode.DATABASE_ERROR,
          `Failed to delete event from database: ${eventId}`,
          undefined,
          500
        );
        this.logEventOperation('delete', false, error.code, context, eventId);
        return {
          success: false,
          errors: [error.userMessage],
          errorCode: error.code
        };
      }

      // Invalidate cache for the company's calendar feed
      try {
        await this.cacheInvalidationService.invalidateCalendarFeed(existingEvent.companyId);
      } catch (error) {
        // Cache invalidation failure shouldn't break the main operation
        console.warn('Cache invalidation failed during event deletion:', {
          eventId,
          companyId: existingEvent.companyId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      this.logEventOperation('delete', true, undefined, context, eventId);

      return {
        success: true
      };
    } catch (error) {
      console.error('Event deletion error:', error);
      
      const eventError = this.handleDatabaseError(error, 'delete event');
      this.logEventOperation('delete', false, eventError.code, context, eventId);
      
      return {
        success: false,
        errors: [eventError.userMessage],
        errorCode: eventError.code
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

  /**
   * Validate business rules for events
   */
  private async validateBusinessRules(
    eventData: Partial<Event>, 
    operation: 'create' | 'update',
    eventId?: string
  ): Promise<{ isValid: boolean; errors: string[]; errorCode?: EventErrorCode }> {
    const errors: string[] = [];

    try {
      // Check for date conflicts
      if (eventData.startDateTime && eventData.endDateTime) {
        if (eventData.startDateTime >= eventData.endDateTime) {
          errors.push('Event start time must be before end time');
        }

        // Check if start time is in the past (for new events)
        if (operation === 'create' && eventData.startDateTime < new Date()) {
          errors.push('Cannot create events in the past');
        }
      }

      // Check for duplicate events (same title, company, and start time)
      if (eventData.companyId && eventData.title && eventData.startDateTime) {
        const existingEvents = await this.eventRepository.findByCompanyId(eventData.companyId);
        const duplicates = existingEvents.filter(event => 
          event.title.toLowerCase() === eventData.title!.toLowerCase() &&
          event.startDateTime.getTime() === eventData.startDateTime!.getTime() &&
          (operation === 'create' || event.id !== eventId)
        );

        if (duplicates.length > 0) {
          errors.push('An event with the same title and start time already exists');
          return {
            isValid: false,
            errors,
            errorCode: EventErrorCode.DUPLICATE_EVENT
          };
        }
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          errors,
          errorCode: EventErrorCode.INVALID_DATE_RANGE
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      console.error('Business validation error:', error);
      return {
        isValid: false,
        errors: ['Failed to validate business rules'],
        errorCode: EventErrorCode.DATABASE_ERROR
      };
    }
  }

  /**
   * Handle database errors and convert to appropriate EventManagementError
   */
  private handleDatabaseError(error: unknown, operation: string): EventManagementError {
    if (error instanceof Error) {
      // Check for specific database error types
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        return new EventManagementError(
          EventErrorCode.DATABASE_ERROR,
          `Database connection error during ${operation}: ${error.message}`,
          'Database is temporarily unavailable. Please try again later.',
          503
        );
      }

      if (error.message.includes('constraint') || error.message.includes('duplicate')) {
        return new EventManagementError(
          EventErrorCode.DUPLICATE_EVENT,
          `Constraint violation during ${operation}: ${error.message}`,
          undefined,
          409
        );
      }

      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return new EventManagementError(
          EventErrorCode.EVENT_NOT_FOUND,
          `Resource not found during ${operation}: ${error.message}`,
          undefined,
          404
        );
      }
    }

    // Generic database error
    return new EventManagementError(
      EventErrorCode.DATABASE_ERROR,
      `Database error during ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      500
    );
  }

  /**
   * Log event operations for audit and monitoring
   */
  private logEventOperation(
    operation: string,
    success: boolean,
    errorCode?: EventErrorCode,
    context?: EventOperationContext,
    eventId?: string
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      success,
      errorCode,
      eventId,
      userId: context?.userId,
      companyId: context?.companyId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    };

    if (success) {
      console.log('Event operation success:', logEntry);
    } else {
      console.warn('Event operation failure:', logEntry);
    }

    // In production, you might want to send this to a monitoring service
    // or store in a dedicated audit log database
  }

  /**
   * Get event operation statistics for monitoring
   */
  async getEventStats(companyId: string): Promise<{
    totalEvents: number;
    publicEvents: number;
    upcomingEvents: number;
    pastEvents: number;
  }> {
    try {
      const allEvents = await this.eventRepository.findByCompanyId(companyId);
      const now = new Date();

      return {
        totalEvents: allEvents.length,
        publicEvents: allEvents.filter(event => event.isPublic).length,
        upcomingEvents: allEvents.filter(event => event.startDateTime > now).length,
        pastEvents: allEvents.filter(event => event.endDateTime < now).length
      };
    } catch (error) {
      console.error('Failed to get event stats:', error);
      return {
        totalEvents: 0,
        publicEvents: 0,
        upcomingEvents: 0,
        pastEvents: 0
      };
    }
  }
}