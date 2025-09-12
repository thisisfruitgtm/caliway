// Validation functions for all data models
import { User, Company, Event, CalendarUrls, WidgetConfig } from './index';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Helper validation functions
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  // Additional check for consecutive dots
  if (email.includes('..')) return false;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidDate = (date: Date): boolean => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const isValidHexColor = (color: string): boolean => {
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexColorRegex.test(color);
};

export const isValidDateFormat = (format: string): boolean => {
  const validFormats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM DD, YYYY'];
  return validFormats.includes(format);
};

// User validation
export const validateUser = (user: Partial<User>): ValidationResult => {
  const errors: string[] = [];

  // Required fields
  if (!user.username || user.username.trim().length === 0) {
    errors.push('Username is required');
  } else if (user.username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  } else if (user.username.length > 50) {
    errors.push('Username must be no more than 50 characters long');
  }

  if (!user.passwordHash || user.passwordHash.trim().length === 0) {
    errors.push('Password hash is required');
  }

  if (!user.companyId || user.companyId.trim().length === 0) {
    errors.push('Company ID is required');
  }

  // Date validation
  if (user.createdAt && !isValidDate(user.createdAt)) {
    errors.push('Created date must be a valid date');
  }

  if (user.lastLoginAt && !isValidDate(user.lastLoginAt)) {
    errors.push('Last login date must be a valid date');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Company validation
export const validateCompany = (company: Partial<Company>): ValidationResult => {
  const errors: string[] = [];

  // Required fields
  if (!company.name || company.name.trim().length === 0) {
    errors.push('Company name is required');
  } else if (company.name.length < 2) {
    errors.push('Company name must be at least 2 characters long');
  } else if (company.name.length > 100) {
    errors.push('Company name must be no more than 100 characters long');
  }

  if (!company.shareableUrl || company.shareableUrl.trim().length === 0) {
    errors.push('Shareable URL is required');
  } else if (company.shareableUrl.length < 10) {
    errors.push('Shareable URL must be at least 10 characters long');
  } else if (company.shareableUrl.length > 200) {
    errors.push('Shareable URL must be no more than 200 characters long');
  }

  // Date validation
  if (company.createdAt && !isValidDate(company.createdAt)) {
    errors.push('Created date must be a valid date');
  }

  if (company.updatedAt && !isValidDate(company.updatedAt)) {
    errors.push('Updated date must be a valid date');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Event validation
export const validateEvent = (event: Partial<Event>): ValidationResult => {
  const errors: string[] = [];

  // Required fields
  if (!event.companyId || event.companyId.trim().length === 0) {
    errors.push('Company ID is required');
  }

  if (!event.title || event.title.trim().length === 0) {
    errors.push('Event title is required');
  } else if (event.title.length < 3) {
    errors.push('Event title must be at least 3 characters long');
  } else if (event.title.length > 200) {
    errors.push('Event title must be no more than 200 characters long');
  }

  if (!event.description || event.description.trim().length === 0) {
    errors.push('Event description is required');
  } else if (event.description.length < 10) {
    errors.push('Event description must be at least 10 characters long');
  } else if (event.description.length > 1000) {
    errors.push('Event description must be no more than 1000 characters long');
  }

  // Date validation
  if (!event.startDateTime) {
    errors.push('Start date and time is required');
  } else if (!isValidDate(event.startDateTime)) {
    errors.push('Start date and time must be a valid date');
  }

  if (!event.endDateTime) {
    errors.push('End date and time is required');
  } else if (!isValidDate(event.endDateTime)) {
    errors.push('End date and time must be a valid date');
  }

  // Validate start date is before end date
  if (event.startDateTime && event.endDateTime && 
      isValidDate(event.startDateTime) && isValidDate(event.endDateTime)) {
    if (event.startDateTime >= event.endDateTime) {
      errors.push('Start date and time must be before end date and time');
    }
  }

  // Optional location validation
  if (event.location && event.location.length > 200) {
    errors.push('Location must be no more than 200 characters long');
  }

  // Boolean validation
  if (event.isPublic !== undefined && typeof event.isPublic !== 'boolean') {
    errors.push('isPublic must be a boolean value');
  }

  // Date validation for audit fields
  if (event.createdAt && !isValidDate(event.createdAt)) {
    errors.push('Created date must be a valid date');
  }

  if (event.updatedAt && !isValidDate(event.updatedAt)) {
    errors.push('Updated date must be a valid date');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Calendar URLs validation
export const validateCalendarUrls = (urls: Partial<CalendarUrls>): ValidationResult => {
  const errors: string[] = [];

  // All URL fields are required
  if (!urls.icalFeed || urls.icalFeed.trim().length === 0) {
    errors.push('iCal feed URL is required');
  } else if (!isValidUrl(urls.icalFeed)) {
    errors.push('iCal feed URL must be a valid URL');
  }

  if (!urls.googleCalendar || urls.googleCalendar.trim().length === 0) {
    errors.push('Google Calendar URL is required');
  } else if (!isValidUrl(urls.googleCalendar)) {
    errors.push('Google Calendar URL must be a valid URL');
  }

  if (!urls.outlookCalendar || urls.outlookCalendar.trim().length === 0) {
    errors.push('Outlook Calendar URL is required');
  } else if (!isValidUrl(urls.outlookCalendar)) {
    errors.push('Outlook Calendar URL must be a valid URL');
  }

  if (!urls.appleCalendar || urls.appleCalendar.trim().length === 0) {
    errors.push('Apple Calendar URL is required');
  } else if (!isValidUrl(urls.appleCalendar)) {
    errors.push('Apple Calendar URL must be a valid URL');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Widget configuration validation
export const validateWidgetConfig = (config: Partial<WidgetConfig>): ValidationResult => {
  const errors: string[] = [];

  // Required fields
  if (!config.companyId || config.companyId.trim().length === 0) {
    errors.push('Company ID is required');
  }

  // Theme validation
  if (!config.theme) {
    errors.push('Theme is required');
  } else if (!['light', 'dark', 'auto'].includes(config.theme)) {
    errors.push('Theme must be one of: light, dark, auto');
  }

  // Primary color validation
  if (!config.primaryColor || config.primaryColor.trim().length === 0) {
    errors.push('Primary color is required');
  } else if (!isValidHexColor(config.primaryColor)) {
    errors.push('Primary color must be a valid hex color (e.g., #FF0000)');
  }

  // Boolean validation
  if (config.showUpcomingOnly !== undefined && typeof config.showUpcomingOnly !== 'boolean') {
    errors.push('showUpcomingOnly must be a boolean value');
  }

  // Max events validation
  if (config.maxEvents !== undefined) {
    if (typeof config.maxEvents !== 'number') {
      errors.push('maxEvents must be a number');
    } else if (config.maxEvents < 1) {
      errors.push('maxEvents must be at least 1');
    } else if (config.maxEvents > 100) {
      errors.push('maxEvents must be no more than 100');
    }
  }

  // Date format validation
  if (!config.dateFormat || config.dateFormat.trim().length === 0) {
    errors.push('Date format is required');
  } else if (!isValidDateFormat(config.dateFormat)) {
    errors.push('Date format must be one of: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, MMM DD, YYYY');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Password validation (for raw passwords before hashing)
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];

  if (!password || password.length === 0) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};