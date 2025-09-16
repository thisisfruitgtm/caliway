/**
 * Custom error types for authentication and authorization
 */

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_BLACKLISTED = 'TOKEN_BLACKLISTED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export enum EventErrorCode {
  EVENT_NOT_FOUND = 'EVENT_NOT_FOUND',
  INVALID_EVENT_DATA = 'INVALID_EVENT_DATA',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DUPLICATE_EVENT = 'DUPLICATE_EVENT',
  EVENT_CONFLICT = 'EVENT_CONFLICT',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR'
}

export enum CalendarFeedErrorCode {
  FEED_GENERATION_FAILED = 'FEED_GENERATION_FAILED',
  INVALID_COMPANY_ID = 'INVALID_COMPANY_ID',
  NO_PUBLIC_EVENTS = 'NO_PUBLIC_EVENTS',
  FEED_FORMAT_ERROR = 'FEED_FORMAT_ERROR',
  FEED_SIZE_EXCEEDED = 'FEED_SIZE_EXCEEDED',
  FEED_CACHE_ERROR = 'FEED_CACHE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

export class AuthenticationError extends Error {
  public readonly code: AuthErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly timestamp: Date;

  constructor(
    code: AuthErrorCode,
    message: string,
    userMessage?: string,
    statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.getDefaultUserMessage(code);
    this.timestamp = new Date();
  }

  private getDefaultUserMessage(code: AuthErrorCode): string {
    switch (code) {
      case AuthErrorCode.INVALID_CREDENTIALS:
        return 'Invalid username or password. Please check your credentials and try again.';
      case AuthErrorCode.MISSING_CREDENTIALS:
        return 'Please provide both username and password.';
      case AuthErrorCode.TOKEN_EXPIRED:
        return 'Your session has expired. Please log in again.';
      case AuthErrorCode.TOKEN_INVALID:
        return 'Invalid session. Please log in again.';
      case AuthErrorCode.TOKEN_BLACKLISTED:
        return 'Your session has been terminated. Please log in again.';
      case AuthErrorCode.USER_NOT_FOUND:
        return 'User account not found. Please contact your administrator.';
      case AuthErrorCode.SESSION_TIMEOUT:
        return 'Your session has timed out due to inactivity. Please log in again.';
      case AuthErrorCode.UNAUTHORIZED_ACCESS:
        return 'You are not authorized to access this resource.';
      case AuthErrorCode.SERVICE_UNAVAILABLE:
        return 'Authentication service is temporarily unavailable. Please try again later.';
      case AuthErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many login attempts. Please wait before trying again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      timestamp: this.timestamp.toISOString()
    };
  }
}

export class EventManagementError extends Error {
  public readonly code: EventErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly timestamp: Date;
  public readonly validationErrors?: string[];

  constructor(
    code: EventErrorCode,
    message: string,
    userMessage?: string,
    statusCode: number = 400,
    validationErrors?: string[]
  ) {
    super(message);
    this.name = 'EventManagementError';
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.getDefaultUserMessage(code);
    this.timestamp = new Date();
    this.validationErrors = validationErrors;
  }

  private getDefaultUserMessage(code: EventErrorCode): string {
    switch (code) {
      case EventErrorCode.EVENT_NOT_FOUND:
        return 'The requested event could not be found.';
      case EventErrorCode.INVALID_EVENT_DATA:
        return 'The event data provided is invalid. Please check your input and try again.';
      case EventErrorCode.VALIDATION_FAILED:
        return 'Event validation failed. Please correct the errors and try again.';
      case EventErrorCode.DUPLICATE_EVENT:
        return 'An event with similar details already exists.';
      case EventErrorCode.EVENT_CONFLICT:
        return 'This event conflicts with an existing event.';
      case EventErrorCode.INVALID_DATE_RANGE:
        return 'The date range provided is invalid. Start date must be before end date.';
      case EventErrorCode.COMPANY_NOT_FOUND:
        return 'Company not found. Please verify the company information.';
      case EventErrorCode.PERMISSION_DENIED:
        return 'You do not have permission to perform this action.';
      case EventErrorCode.DATABASE_ERROR:
        return 'A database error occurred. Please try again later.';
      case EventErrorCode.CACHE_ERROR:
        return 'Cache operation failed, but your request was processed successfully.';
      default:
        return 'An error occurred while processing your event request.';
    }
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      validationErrors: this.validationErrors,
      timestamp: this.timestamp.toISOString()
    };
  }
}

export class CalendarFeedError extends Error {
  public readonly code: CalendarFeedErrorCode;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly timestamp: Date;

  constructor(
    code: CalendarFeedErrorCode,
    message: string,
    userMessage?: string,
    statusCode: number = 500
  ) {
    super(message);
    this.name = 'CalendarFeedError';
    this.code = code;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.getDefaultUserMessage(code);
    this.timestamp = new Date();
  }

  private getDefaultUserMessage(code: CalendarFeedErrorCode): string {
    switch (code) {
      case CalendarFeedErrorCode.FEED_GENERATION_FAILED:
        return 'Failed to generate calendar feed. Please try again later.';
      case CalendarFeedErrorCode.INVALID_COMPANY_ID:
        return 'Invalid company identifier. Please check the calendar URL.';
      case CalendarFeedErrorCode.NO_PUBLIC_EVENTS:
        return 'No public events found for this calendar.';
      case CalendarFeedErrorCode.FEED_FORMAT_ERROR:
        return 'Calendar feed format error. Please contact support.';
      case CalendarFeedErrorCode.FEED_SIZE_EXCEEDED:
        return 'Calendar feed is too large. Please contact the calendar owner.';
      case CalendarFeedErrorCode.FEED_CACHE_ERROR:
        return 'Calendar cache error. The feed may not be up to date.';
      case CalendarFeedErrorCode.EXTERNAL_SERVICE_ERROR:
        return 'External calendar service error. Please try again later.';
      default:
        return 'Calendar feed error. Please try again later.';
    }
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.userMessage,
      timestamp: this.timestamp.toISOString()
    };
  }
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface AuthErrorContext {
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  attemptCount?: number;
}