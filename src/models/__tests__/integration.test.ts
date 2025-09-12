import { describe, it, expect } from 'vitest';
import {
  validateUser,
  validateCompany,
  validateEvent,
  validateCalendarUrls,
  validateWidgetConfig,
  validatePassword
} from '../validation';

describe('Data Model Validation Integration', () => {
  it('should validate a complete user creation workflow', () => {
    // Test password validation first
    const passwordResult = validatePassword('SecurePass123!');
    expect(passwordResult.isValid).toBe(true);

    // Test user validation with valid data
    const userResult = validateUser({
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hashed-password-from-bcrypt',
      companyId: 'company-123',
      createdAt: new Date(),
      lastLoginAt: new Date()
    });
    expect(userResult.isValid).toBe(true);
  });

  it('should validate a complete company setup workflow', () => {
    const companyResult = validateCompany({
      id: 'company-123',
      name: 'Acme Corporation',
      shareableUrl: 'acme-corp-calendar-2024',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    expect(companyResult.isValid).toBe(true);
  });

  it('should validate a complete event creation workflow', () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const eventResult = validateEvent({
      id: 'event-123',
      companyId: 'company-123',
      title: 'Annual Company Meeting',
      description: 'Join us for our annual company meeting where we will discuss the year\'s achievements and future plans.',
      startDateTime: now,
      endDateTime: oneHourLater,
      location: 'Conference Room A, 123 Business St, City, State',
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    expect(eventResult.isValid).toBe(true);
  });

  it('should validate calendar URLs for integration', () => {
    const urlsResult = validateCalendarUrls({
      icalFeed: 'https://calendar.example.com/company-123/feed.ics',
      googleCalendar: 'https://calendar.google.com/calendar/u/0?cid=Y29tcGFueS0xMjNAZXhhbXBsZS5jb20',
      outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar?url=https%3A//calendar.example.com/company-123/feed.ics',
      appleCalendar: 'webcal://calendar.example.com/company-123/feed.ics'
    });
    expect(urlsResult.isValid).toBe(true);
  });

  it('should validate widget configuration for embedding', () => {
    const configResult = validateWidgetConfig({
      companyId: 'company-123',
      theme: 'light',
      primaryColor: '#007bff',
      showUpcomingOnly: true,
      maxEvents: 5,
      dateFormat: 'MMM DD, YYYY'
    });
    expect(configResult.isValid).toBe(true);
  });

  it('should handle validation errors gracefully in a workflow', () => {
    // Test invalid event that would fail in a real workflow
    const invalidEventResult = validateEvent({
      companyId: '', // Missing company ID
      title: 'AB', // Too short
      description: 'Short', // Too short
      startDateTime: new Date('2024-01-01T10:00:00Z'),
      endDateTime: new Date('2024-01-01T09:00:00Z'), // End before start
      isPublic: 'yes' as any, // Wrong type
      createdAt: new Date(),
      updatedAt: new Date()
    });

    expect(invalidEventResult.isValid).toBe(false);
    expect(invalidEventResult.errors).toContain('Company ID is required');
    expect(invalidEventResult.errors).toContain('Event title must be at least 3 characters long');
    expect(invalidEventResult.errors).toContain('Event description must be at least 10 characters long');
    expect(invalidEventResult.errors).toContain('Start date and time must be before end date and time');
    expect(invalidEventResult.errors).toContain('isPublic must be a boolean value');
  });

  it('should validate all models work together in a complete system', () => {
    // Simulate a complete system validation
    const results = {
      password: validatePassword('StrongPassword123!'),
      user: validateUser({
        id: 'user-1',
        username: 'admin',
        passwordHash: 'bcrypt-hash',
        companyId: 'company-1',
        createdAt: new Date(),
        lastLoginAt: new Date()
      }),
      company: validateCompany({
        id: 'company-1',
        name: 'Tech Startup Inc',
        shareableUrl: 'tech-startup-calendar',
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      event: validateEvent({
        id: 'event-1',
        companyId: 'company-1',
        title: 'Product Launch Event',
        description: 'Exciting product launch event with demos and networking opportunities.',
        startDateTime: new Date('2024-06-15T14:00:00Z'),
        endDateTime: new Date('2024-06-15T17:00:00Z'),
        location: 'Main Auditorium',
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      urls: validateCalendarUrls({
        icalFeed: 'https://api.example.com/calendar/company-1.ics',
        googleCalendar: 'https://calendar.google.com/calendar/embed?src=company1%40example.com',
        outlookCalendar: 'https://outlook.live.com/calendar/0/addcalendar',
        appleCalendar: 'webcal://api.example.com/calendar/company-1.ics'
      }),
      widget: validateWidgetConfig({
        companyId: 'company-1',
        theme: 'auto',
        primaryColor: '#6c757d',
        showUpcomingOnly: false,
        maxEvents: 20,
        dateFormat: 'DD/MM/YYYY'
      })
    };

    // All validations should pass
    Object.values(results).forEach(result => {
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});