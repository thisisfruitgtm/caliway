import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { EventErrorCode, CalendarFeedErrorCode } from '../../types/errors';

// Mock the services
vi.mock('../../services/EventManagementService');
vi.mock('../../services/CalendarFeedService');
vi.mock('../../repositories/EventRepository');

describe('Event Management and Calendar Feed Error Handling Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock routes for testing
    app.post('/api/events', async (req, res) => {
      // Mock event creation endpoint
      const { EventManagementService } = await import('../../services/EventManagementService');
      const service = new EventManagementService();
      const result = await service.createEvent(req.body);
      
      if (result.success) {
        res.status(201).json(result);
      } else {
        const statusCode = getStatusCodeForEventError(result.errorCode);
        res.status(statusCode).json({
          success: false,
          error: {
            code: result.errorCode,
            message: result.errors?.[0] || 'Event operation failed',
            validationErrors: result.errors,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    app.put('/api/events/:id', async (req, res) => {
      // Mock event update endpoint
      const { EventManagementService } = await import('../../services/EventManagementService');
      const service = new EventManagementService();
      const result = await service.updateEvent(req.params.id, req.body);
      
      if (result.success) {
        res.json(result);
      } else {
        const statusCode = getStatusCodeForEventError(result.errorCode);
        res.status(statusCode).json({
          success: false,
          error: {
            code: result.errorCode,
            message: result.errors?.[0] || 'Event operation failed',
            validationErrors: result.errors,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    app.delete('/api/events/:id', async (req, res) => {
      // Mock event deletion endpoint
      const { EventManagementService } = await import('../../services/EventManagementService');
      const service = new EventManagementService();
      const result = await service.deleteEvent(req.params.id);
      
      if (result.success) {
        res.status(204).send();
      } else {
        const statusCode = getStatusCodeForEventError(result.errorCode);
        res.status(statusCode).json({
          success: false,
          error: {
            code: result.errorCode,
            message: result.errors?.[0] || 'Event operation failed',
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    app.get('/api/calendar/:companyId/feed.ics', async (req, res) => {
      // Mock calendar feed endpoint
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      const service = new CalendarFeedService();
      
      try {
        const feed = await service.generateICalFeed(req.params.companyId);
        res.set({
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="calendar.ics"',
          'Cache-Control': 'public, max-age=900' // 15 minutes
        });
        res.send(feed);
      } catch (error: any) {
        const statusCode = getStatusCodeForCalendarError(error.code);
        res.status(statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.userMessage || 'Calendar feed error',
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    app.get('/api/calendar/:companyId/events', async (req, res) => {
      // Mock public events endpoint
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      const service = new CalendarFeedService();
      const result = await service.getPublicEventsSafe(req.params.companyId);
      
      if (result.success) {
        res.json({
          success: true,
          events: result.events
        });
      } else {
        const statusCode = getStatusCodeForCalendarError(result.errorCode);
        res.status(statusCode).json({
          success: false,
          error: {
            code: result.errorCode,
            message: result.error,
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Management API Error Handling', () => {
    it('should return 400 for validation errors during event creation', async () => {
      // Mock service to return validation error
      const { EventManagementService } = await import('../../services/EventManagementService');
      vi.mocked(EventManagementService).mockImplementation(() => ({
        createEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.VALIDATION_FAILED,
          errors: ['Title is required', 'Start date must be before end date']
        })
      }) as any);

      const response = await request(app)
        .post('/api/events')
        .send({
          companyId: 'company-123',
          title: '',
          description: 'Test event',
          startDateTime: '2024-12-01T11:00:00Z',
          endDateTime: '2024-12-01T10:00:00Z'
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: EventErrorCode.VALIDATION_FAILED,
          message: 'Title is required',
          validationErrors: ['Title is required', 'Start date must be before end date'],
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 404 for non-existent event update', async () => {
      // Mock service to return not found error
      const { EventManagementService } = await import('../../services/EventManagementService');
      vi.mocked(EventManagementService).mockImplementation(() => ({
        updateEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.EVENT_NOT_FOUND,
          errors: ['The requested event could not be found.']
        })
      }) as any);

      const response = await request(app)
        .put('/api/events/non-existent-id')
        .send({
          title: 'Updated Event'
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: EventErrorCode.EVENT_NOT_FOUND,
          message: 'The requested event could not be found.',
          validationErrors: ['The requested event could not be found.'],
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 403 for permission denied', async () => {
      // Mock service to return permission denied error
      const { EventManagementService } = await import('../../services/EventManagementService');
      vi.mocked(EventManagementService).mockImplementation(() => ({
        deleteEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.PERMISSION_DENIED,
          errors: ['You do not have permission to perform this action.']
        })
      }) as any);

      const response = await request(app)
        .delete('/api/events/event-123');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: EventErrorCode.PERMISSION_DENIED,
          message: 'You do not have permission to perform this action.',
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 409 for duplicate event', async () => {
      // Mock service to return duplicate error
      const { EventManagementService } = await import('../../services/EventManagementService');
      vi.mocked(EventManagementService).mockImplementation(() => ({
        createEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.DUPLICATE_EVENT,
          errors: ['An event with the same title and start time already exists']
        })
      }) as any);

      const response = await request(app)
        .post('/api/events')
        .send({
          companyId: 'company-123',
          title: 'Duplicate Event',
          description: 'Test event',
          startDateTime: '2024-12-01T10:00:00Z',
          endDateTime: '2024-12-01T11:00:00Z'
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: EventErrorCode.DUPLICATE_EVENT,
          message: 'An event with the same title and start time already exists',
          validationErrors: ['An event with the same title and start time already exists'],
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 500 for database errors', async () => {
      // Mock service to return database error
      const { EventManagementService } = await import('../../services/EventManagementService');
      vi.mocked(EventManagementService).mockImplementation(() => ({
        createEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.DATABASE_ERROR,
          errors: ['A database error occurred. Please try again later.']
        })
      }) as any);

      const response = await request(app)
        .post('/api/events')
        .send({
          companyId: 'company-123',
          title: 'Test Event',
          description: 'Test event',
          startDateTime: '2024-12-01T10:00:00Z',
          endDateTime: '2024-12-01T11:00:00Z'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: EventErrorCode.DATABASE_ERROR,
          message: 'A database error occurred. Please try again later.',
          validationErrors: ['A database error occurred. Please try again later.'],
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 201 for successful event creation', async () => {
      // Mock service to return success
      const mockEvent = {
        id: 'event-123',
        companyId: 'company-123',
        title: 'Test Event',
        description: 'Test event',
        startDateTime: new Date('2024-12-01T10:00:00Z'),
        endDateTime: new Date('2024-12-01T11:00:00Z'),
        isPublic: true
      };

      const { EventManagementService } = await import('../../services/EventManagementService');
      vi.mocked(EventManagementService).mockImplementation(() => ({
        createEvent: vi.fn().mockResolvedValue({
          success: true,
          event: mockEvent
        })
      }) as any);

      const response = await request(app)
        .post('/api/events')
        .send({
          companyId: 'company-123',
          title: 'Test Event',
          description: 'Test event',
          startDateTime: '2024-12-01T10:00:00Z',
          endDateTime: '2024-12-01T11:00:00Z'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        event: expect.objectContaining({
          id: 'event-123',
          title: 'Test Event'
        })
      });
    });
  });

  describe('Calendar Feed API Error Handling', () => {
    it('should return 400 for invalid company ID', async () => {
      // Mock service to throw invalid company ID error
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        generateICalFeed: vi.fn().mockRejectedValue({
          code: CalendarFeedErrorCode.INVALID_COMPANY_ID,
          userMessage: 'Invalid company identifier. Please check the calendar URL.'
        })
      }) as any);

      const response = await request(app)
        .get('/api/calendar/invalid-id/feed.ics');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: CalendarFeedErrorCode.INVALID_COMPANY_ID,
          message: 'Invalid company identifier. Please check the calendar URL.',
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 413 for feed size exceeded', async () => {
      // Mock service to throw feed size error
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        generateICalFeed: vi.fn().mockRejectedValue({
          code: CalendarFeedErrorCode.FEED_SIZE_EXCEEDED,
          userMessage: 'Calendar feed is too large. Please contact the calendar owner.'
        })
      }) as any);

      const response = await request(app)
        .get('/api/calendar/company-123/feed.ics');

      expect(response.status).toBe(413);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: CalendarFeedErrorCode.FEED_SIZE_EXCEEDED,
          message: 'Calendar feed is too large. Please contact the calendar owner.',
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 500 for feed generation failure', async () => {
      // Mock service to throw generation error
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        generateICalFeed: vi.fn().mockRejectedValue({
          code: CalendarFeedErrorCode.FEED_GENERATION_FAILED,
          userMessage: 'Failed to generate calendar feed. Please try again later.'
        })
      }) as any);

      const response = await request(app)
        .get('/api/calendar/company-123/feed.ics');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: CalendarFeedErrorCode.FEED_GENERATION_FAILED,
          message: 'Failed to generate calendar feed. Please try again later.',
          timestamp: expect.any(String)
        }
      });
    });

    it('should return valid iCal feed for successful generation', async () => {
      // Mock service to return valid feed
      const mockFeed = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Company Calendar Platform//Calendar Feed//EN',
        'BEGIN:VEVENT',
        'UID:event-123@company-calendar-platform.com',
        'SUMMARY:Test Event',
        'DTSTART:20241201T100000Z',
        'DTEND:20241201T110000Z',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        generateICalFeed: vi.fn().mockResolvedValue(mockFeed)
      }) as any);

      const response = await request(app)
        .get('/api/calendar/company-123/feed.ics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/calendar');
      expect(response.headers['content-disposition']).toContain('attachment; filename="calendar.ics"');
      expect(response.headers['cache-control']).toBe('public, max-age=900');
      expect(response.text).toBe(mockFeed);
    });

    it('should handle public events API errors gracefully', async () => {
      // Mock service to return error
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        getPublicEventsSafe: vi.fn().mockResolvedValue({
          success: false,
          errorCode: CalendarFeedErrorCode.INVALID_COMPANY_ID,
          error: 'Invalid company identifier. Please check the calendar URL.'
        })
      }) as any);

      const response = await request(app)
        .get('/api/calendar/invalid-id/events');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: CalendarFeedErrorCode.INVALID_COMPANY_ID,
          message: 'Invalid company identifier. Please check the calendar URL.',
          timestamp: expect.any(String)
        }
      });
    });

    it('should return public events successfully', async () => {
      // Mock service to return events
      const mockEvents = [
        {
          id: 'event-1',
          title: 'Public Event 1',
          startDateTime: '2024-12-01T10:00:00Z',
          endDateTime: '2024-12-01T11:00:00Z'
        }
      ];

      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        getPublicEventsSafe: vi.fn().mockResolvedValue({
          success: true,
          events: mockEvents
        })
      }) as any);

      const response = await request(app)
        .get('/api/calendar/company-123/events');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        events: mockEvents
      });
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should maintain consistent error response format across all endpoints', async () => {
      // Test that all error responses follow the same structure
      const endpoints = [
        { method: 'post', path: '/api/events', body: {} },
        { method: 'put', path: '/api/events/test-id', body: {} },
        { method: 'delete', path: '/api/events/test-id' },
        { method: 'get', path: '/api/calendar/invalid/feed.ics' },
        { method: 'get', path: '/api/calendar/invalid/events' }
      ];

      // Mock all services to return errors
      const { EventManagementService } = await import('../../services/EventManagementService');
      const { CalendarFeedService } = await import('../../services/CalendarFeedService');
      
      vi.mocked(EventManagementService).mockImplementation(() => ({
        createEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.VALIDATION_FAILED,
          errors: ['Test error']
        }),
        updateEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.EVENT_NOT_FOUND,
          errors: ['Test error']
        }),
        deleteEvent: vi.fn().mockResolvedValue({
          success: false,
          errorCode: EventErrorCode.EVENT_NOT_FOUND,
          errors: ['Test error']
        })
      }) as any);

      vi.mocked(CalendarFeedService).mockImplementation(() => ({
        generateICalFeed: vi.fn().mockRejectedValue({
          code: CalendarFeedErrorCode.INVALID_COMPANY_ID,
          userMessage: 'Test error'
        }),
        getPublicEventsSafe: vi.fn().mockResolvedValue({
          success: false,
          errorCode: CalendarFeedErrorCode.INVALID_COMPANY_ID,
          error: 'Test error'
        })
      }) as any);

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method as keyof typeof request](endpoint.path)
          .send(endpoint.body);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');
        expect(response.body.error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });
});

// Helper functions
function getStatusCodeForEventError(errorCode?: EventErrorCode): number {
  switch (errorCode) {
    case EventErrorCode.EVENT_NOT_FOUND:
      return 404;
    case EventErrorCode.INVALID_EVENT_DATA:
    case EventErrorCode.VALIDATION_FAILED:
    case EventErrorCode.INVALID_DATE_RANGE:
      return 400;
    case EventErrorCode.DUPLICATE_EVENT:
      return 409;
    case EventErrorCode.PERMISSION_DENIED:
      return 403;
    case EventErrorCode.DATABASE_ERROR:
      return 500;
    default:
      return 400;
  }
}

function getStatusCodeForCalendarError(errorCode?: CalendarFeedErrorCode): number {
  switch (errorCode) {
    case CalendarFeedErrorCode.INVALID_COMPANY_ID:
      return 400;
    case CalendarFeedErrorCode.FEED_SIZE_EXCEEDED:
      return 413;
    case CalendarFeedErrorCode.FEED_GENERATION_FAILED:
    case CalendarFeedErrorCode.FEED_FORMAT_ERROR:
    case CalendarFeedErrorCode.EXTERNAL_SERVICE_ERROR:
      return 500;
    default:
      return 500;
  }
}