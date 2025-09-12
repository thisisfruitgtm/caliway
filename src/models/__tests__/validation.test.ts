import { describe, it, expect } from 'vitest';
import {
  validateUser,
  validateCompany,
  validateEvent,
  validateCalendarUrls,
  validateWidgetConfig,
  validatePassword,
  isValidEmail,
  isValidUrl,
  isValidDate,
  isValidHexColor,
  isValidDateFormat
} from '../validation';
import { User, Company, Event, CalendarUrls, WidgetConfig } from '../index';

describe('Helper Validation Functions', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('test+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test..test@example.com')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=value')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://invalid')).toBe(true); // URL constructor accepts ftp
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should validate correct dates', () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date('2023-01-01'))).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false);
      expect(isValidDate({} as Date)).toBe(false);
    });
  });

  describe('isValidHexColor', () => {
    it('should validate correct hex colors', () => {
      expect(isValidHexColor('#FF0000')).toBe(true);
      expect(isValidHexColor('#000')).toBe(true);
      expect(isValidHexColor('#123ABC')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHexColor('FF0000')).toBe(false);
      expect(isValidHexColor('#GG0000')).toBe(false);
      expect(isValidHexColor('#12345')).toBe(false);
    });
  });

  describe('isValidDateFormat', () => {
    it('should validate correct date formats', () => {
      expect(isValidDateFormat('YYYY-MM-DD')).toBe(true);
      expect(isValidDateFormat('MM/DD/YYYY')).toBe(true);
      expect(isValidDateFormat('DD/MM/YYYY')).toBe(true);
      expect(isValidDateFormat('MMM DD, YYYY')).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(isValidDateFormat('YYYY/MM/DD')).toBe(false);
      expect(isValidDateFormat('invalid-format')).toBe(false);
    });
  });
});

describe('User Validation', () => {
  const validUser: User = {
    id: 'user-123',
    username: 'testuser',
    passwordHash: 'hashed-password',
    companyId: 'company-123',
    createdAt: new Date(),
    lastLoginAt: new Date()
  };

  it('should validate a correct user', () => {
    const result = validateUser(validUser);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require username', () => {
    const result = validateUser({ ...validUser, username: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Username is required');
  });

  it('should validate username length', () => {
    let result = validateUser({ ...validUser, username: 'ab' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Username must be at least 3 characters long');

    result = validateUser({ ...validUser, username: 'a'.repeat(51) });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Username must be no more than 50 characters long');
  });

  it('should require password hash', () => {
    const result = validateUser({ ...validUser, passwordHash: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password hash is required');
  });

  it('should require company ID', () => {
    const result = validateUser({ ...validUser, companyId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company ID is required');
  });

  it('should validate dates', () => {
    const result = validateUser({ ...validUser, createdAt: new Date('invalid') });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Created date must be a valid date');
  });
});

describe('Company Validation', () => {
  const validCompany: Company = {
    id: 'company-123',
    name: 'Test Company',
    shareableUrl: 'test-company-url',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('should validate a correct company', () => {
    const result = validateCompany(validCompany);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require company name', () => {
    const result = validateCompany({ ...validCompany, name: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company name is required');
  });

  it('should validate company name length', () => {
    let result = validateCompany({ ...validCompany, name: 'a' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company name must be at least 2 characters long');

    result = validateCompany({ ...validCompany, name: 'a'.repeat(101) });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company name must be no more than 100 characters long');
  });

  it('should require shareable URL', () => {
    const result = validateCompany({ ...validCompany, shareableUrl: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Shareable URL is required');
  });

  it('should validate shareable URL length', () => {
    let result = validateCompany({ ...validCompany, shareableUrl: 'short' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Shareable URL must be at least 10 characters long');

    result = validateCompany({ ...validCompany, shareableUrl: 'a'.repeat(201) });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Shareable URL must be no more than 200 characters long');
  });
});

describe('Event Validation', () => {
  const validEvent: Event = {
    id: 'event-123',
    companyId: 'company-123',
    title: 'Test Event',
    description: 'This is a test event description',
    startDateTime: new Date('2024-01-01T10:00:00Z'),
    endDateTime: new Date('2024-01-01T11:00:00Z'),
    location: 'Test Location',
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('should validate a correct event', () => {
    const result = validateEvent(validEvent);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require company ID', () => {
    const result = validateEvent({ ...validEvent, companyId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company ID is required');
  });

  it('should require title', () => {
    const result = validateEvent({ ...validEvent, title: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Event title is required');
  });

  it('should validate title length', () => {
    let result = validateEvent({ ...validEvent, title: 'ab' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Event title must be at least 3 characters long');

    result = validateEvent({ ...validEvent, title: 'a'.repeat(201) });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Event title must be no more than 200 characters long');
  });

  it('should require description', () => {
    const result = validateEvent({ ...validEvent, description: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Event description is required');
  });

  it('should validate description length', () => {
    let result = validateEvent({ ...validEvent, description: 'short' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Event description must be at least 10 characters long');

    result = validateEvent({ ...validEvent, description: 'a'.repeat(1001) });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Event description must be no more than 1000 characters long');
  });

  it('should require start and end dates', () => {
    let result = validateEvent({ ...validEvent, startDateTime: undefined as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Start date and time is required');

    result = validateEvent({ ...validEvent, endDateTime: undefined as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('End date and time is required');
  });

  it('should validate start date is before end date', () => {
    const result = validateEvent({
      ...validEvent,
      startDateTime: new Date('2024-01-01T11:00:00Z'),
      endDateTime: new Date('2024-01-01T10:00:00Z')
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Start date and time must be before end date and time');
  });

  it('should validate location length', () => {
    const result = validateEvent({ ...validEvent, location: 'a'.repeat(201) });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Location must be no more than 200 characters long');
  });

  it('should validate isPublic as boolean', () => {
    const result = validateEvent({ ...validEvent, isPublic: 'true' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('isPublic must be a boolean value');
  });
});

describe('Calendar URLs Validation', () => {
  const validUrls: CalendarUrls = {
    icalFeed: 'https://example.com/calendar.ics',
    googleCalendar: 'https://calendar.google.com/calendar/u/0?cid=example',
    outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar',
    appleCalendar: 'webcal://example.com/calendar.ics'
  };

  it('should validate correct calendar URLs', () => {
    const result = validateCalendarUrls(validUrls);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require all URL fields', () => {
    const result = validateCalendarUrls({
      ...validUrls,
      icalFeed: '',
      googleCalendar: '',
      outlookCalendar: '',
      appleCalendar: ''
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('iCal feed URL is required');
    expect(result.errors).toContain('Google Calendar URL is required');
    expect(result.errors).toContain('Outlook Calendar URL is required');
    expect(result.errors).toContain('Apple Calendar URL is required');
  });

  it('should validate URL format', () => {
    const result = validateCalendarUrls({
      icalFeed: 'invalid-url',
      googleCalendar: 'not-a-url',
      outlookCalendar: 'also-invalid',
      appleCalendar: 'still-invalid'
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('iCal feed URL must be a valid URL');
    expect(result.errors).toContain('Google Calendar URL must be a valid URL');
    expect(result.errors).toContain('Outlook Calendar URL must be a valid URL');
    expect(result.errors).toContain('Apple Calendar URL must be a valid URL');
  });
});

describe('Widget Config Validation', () => {
  const validConfig: WidgetConfig = {
    companyId: 'company-123',
    theme: 'light',
    primaryColor: '#FF0000',
    showUpcomingOnly: true,
    maxEvents: 10,
    dateFormat: 'YYYY-MM-DD'
  };

  it('should validate correct widget config', () => {
    const result = validateWidgetConfig(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require company ID', () => {
    const result = validateWidgetConfig({ ...validConfig, companyId: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Company ID is required');
  });

  it('should validate theme values', () => {
    let result = validateWidgetConfig({ ...validConfig, theme: undefined as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Theme is required');

    result = validateWidgetConfig({ ...validConfig, theme: 'invalid' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Theme must be one of: light, dark, auto');
  });

  it('should validate primary color', () => {
    let result = validateWidgetConfig({ ...validConfig, primaryColor: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Primary color is required');

    result = validateWidgetConfig({ ...validConfig, primaryColor: 'red' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Primary color must be a valid hex color (e.g., #FF0000)');
  });

  it('should validate maxEvents range', () => {
    let result = validateWidgetConfig({ ...validConfig, maxEvents: 0 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('maxEvents must be at least 1');

    result = validateWidgetConfig({ ...validConfig, maxEvents: 101 });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('maxEvents must be no more than 100');

    result = validateWidgetConfig({ ...validConfig, maxEvents: 'ten' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('maxEvents must be a number');
  });

  it('should validate date format', () => {
    let result = validateWidgetConfig({ ...validConfig, dateFormat: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date format is required');

    result = validateWidgetConfig({ ...validConfig, dateFormat: 'invalid-format' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Date format must be one of: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, MMM DD, YYYY');
  });

  it('should validate boolean fields', () => {
    const result = validateWidgetConfig({ ...validConfig, showUpcomingOnly: 'true' as any });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('showUpcomingOnly must be a boolean value');
  });
});

describe('Password Validation', () => {
  it('should validate a strong password', () => {
    const result = validatePassword('StrongPass123!');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should require password', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password is required');
  });

  it('should validate password length', () => {
    let result = validatePassword('Short1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');

    result = validatePassword('a'.repeat(129) + 'A1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be no more than 128 characters long');
  });

  it('should require uppercase letter', () => {
    const result = validatePassword('lowercase123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should require lowercase letter', () => {
    const result = validatePassword('UPPERCASE123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should require number', () => {
    const result = validatePassword('NoNumbers!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should require special character', () => {
    const result = validatePassword('NoSpecialChar123');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character');
  });
});