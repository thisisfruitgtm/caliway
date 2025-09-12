import { describe, it, expect, vi } from 'vitest';
import { validateUser, validateCompany, validateEvent, validateWidgetConfig } from '../../models/validation';

// Mock the Supabase config to avoid requiring actual environment variables
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }))
  }
}));

// Import repositories after mocking
import { UserRepository, CompanyRepository, EventRepository, WidgetConfigRepository } from '../index';

describe('Repository Integration Tests', () => {
  describe('Repository Instantiation', () => {
    it('should create UserRepository instance', () => {
      const userRepo = new UserRepository();
      expect(userRepo).toBeInstanceOf(UserRepository);
    });

    it('should create CompanyRepository instance', () => {
      const companyRepo = new CompanyRepository();
      expect(companyRepo).toBeInstanceOf(CompanyRepository);
    });

    it('should create EventRepository instance', () => {
      const eventRepo = new EventRepository();
      expect(eventRepo).toBeInstanceOf(EventRepository);
    });

    it('should create WidgetConfigRepository instance', () => {
      const widgetRepo = new WidgetConfigRepository();
      expect(widgetRepo).toBeInstanceOf(WidgetConfigRepository);
    });
  });

  describe('Data Mapping Functions', () => {
    it('should correctly map User data between formats', () => {
      const userRepo = new UserRepository();
      
      const dbData = {
        id: 'user-123',
        username: 'testuser',
        password_hash: 'hashed-password',
        company_id: 'company-123',
        created_at: '2024-01-01T00:00:00Z',
        last_login_at: '2024-01-01T00:00:00Z'
      };

      const mappedUser = userRepo['mapFromDatabase'](dbData);
      
      expect(mappedUser).toEqual({
        id: 'user-123',
        username: 'testuser',
        passwordHash: 'hashed-password',
        companyId: 'company-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        lastLoginAt: new Date('2024-01-01T00:00:00Z')
      });

      // Validate the mapped data
      const validation = validateUser(mappedUser);
      expect(validation.isValid).toBe(true);
    });

    it('should correctly map Company data between formats', () => {
      const companyRepo = new CompanyRepository();
      
      const dbData = {
        id: 'company-123',
        name: 'Test Company',
        shareable_url: 'test-company-url',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mappedCompany = companyRepo['mapFromDatabase'](dbData);
      
      expect(mappedCompany).toEqual({
        id: 'company-123',
        name: 'Test Company',
        shareableUrl: 'test-company-url',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      });

      // Validate the mapped data
      const validation = validateCompany(mappedCompany);
      expect(validation.isValid).toBe(true);
    });

    it('should correctly map Event data between formats', () => {
      const eventRepo = new EventRepository();
      
      const dbData = {
        id: 'event-123',
        company_id: 'company-123',
        title: 'Test Event',
        description: 'This is a test event description',
        start_date_time: '2024-01-01T10:00:00Z',
        end_date_time: '2024-01-01T11:00:00Z',
        location: 'Test Location',
        is_public: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mappedEvent = eventRepo['mapFromDatabase'](dbData);
      
      expect(mappedEvent).toEqual({
        id: 'event-123',
        companyId: 'company-123',
        title: 'Test Event',
        description: 'This is a test event description',
        startDateTime: new Date('2024-01-01T10:00:00Z'),
        endDateTime: new Date('2024-01-01T11:00:00Z'),
        location: 'Test Location',
        isPublic: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      });

      // Validate the mapped data
      const validation = validateEvent(mappedEvent);
      expect(validation.isValid).toBe(true);
    });

    it('should correctly map WidgetConfig data between formats', () => {
      const widgetRepo = new WidgetConfigRepository();
      
      const dbData = {
        id: 'config-123',
        company_id: 'company-123',
        theme: 'light',
        primary_color: '#007bff',
        show_upcoming_only: true,
        max_events: 10,
        date_format: 'YYYY-MM-DD',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mappedConfig = widgetRepo['mapFromDatabase'](dbData);
      
      expect(mappedConfig).toEqual({
        id: 'config-123',
        companyId: 'company-123',
        theme: 'light',
        primaryColor: '#007bff',
        showUpcomingOnly: true,
        maxEvents: 10,
        dateFormat: 'YYYY-MM-DD',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      });

      // Validate the mapped data (excluding id, createdAt, updatedAt)
      const { id, createdAt, updatedAt, ...configForValidation } = mappedConfig;
      const validation = validateWidgetConfig(configForValidation);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Reverse Data Mapping', () => {
    it('should correctly map User data to database format', () => {
      const userRepo = new UserRepository();
      
      const userData = {
        username: 'testuser',
        passwordHash: 'hashed-password',
        companyId: 'company-123',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        lastLoginAt: new Date('2024-01-01T00:00:00Z')
      };

      const dbData = userRepo['mapToDatabase'](userData);
      
      expect(dbData).toEqual({
        username: 'testuser',
        password_hash: 'hashed-password',
        company_id: 'company-123',
        created_at: new Date('2024-01-01T00:00:00Z'),
        last_login_at: new Date('2024-01-01T00:00:00Z')
      });
    });

    it('should correctly map Company data to database format', () => {
      const companyRepo = new CompanyRepository();
      
      const companyData = {
        name: 'Test Company',
        shareableUrl: 'test-company-url',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      };

      const dbData = companyRepo['mapToDatabase'](companyData);
      
      expect(dbData).toEqual({
        name: 'Test Company',
        shareable_url: 'test-company-url',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      });
    });

    it('should correctly map Event data to database format', () => {
      const eventRepo = new EventRepository();
      
      const eventData = {
        companyId: 'company-123',
        title: 'Test Event',
        description: 'This is a test event description',
        startDateTime: new Date('2024-01-01T10:00:00Z'),
        endDateTime: new Date('2024-01-01T11:00:00Z'),
        location: 'Test Location',
        isPublic: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z')
      };

      const dbData = eventRepo['mapToDatabase'](eventData);
      
      expect(dbData).toEqual({
        company_id: 'company-123',
        title: 'Test Event',
        description: 'This is a test event description',
        start_date_time: new Date('2024-01-01T10:00:00Z'),
        end_date_time: new Date('2024-01-01T11:00:00Z'),
        location: 'Test Location',
        is_public: true,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z')
      });
    });
  });

  describe('Widget Config Repository Specific Methods', () => {
    it('should provide default widget configuration', () => {
      const widgetRepo = new WidgetConfigRepository();
      const defaultConfig = widgetRepo.getDefaultConfig('company-123');
      
      expect(defaultConfig).toEqual({
        companyId: 'company-123',
        theme: 'light',
        primaryColor: '#007bff',
        showUpcomingOnly: true,
        maxEvents: 10,
        dateFormat: 'YYYY-MM-DD'
      });

      // Validate the default configuration
      const validation = validateWidgetConfig(defaultConfig);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Repository Method Signatures', () => {
    it('should have correct method signatures for UserRepository', () => {
      const userRepo = new UserRepository();
      
      // Check that methods exist and are functions
      expect(typeof userRepo.findById).toBe('function');
      expect(typeof userRepo.findByUsername).toBe('function');
      expect(typeof userRepo.findByCompanyId).toBe('function');
      expect(typeof userRepo.create).toBe('function');
      expect(typeof userRepo.update).toBe('function');
      expect(typeof userRepo.delete).toBe('function');
      expect(typeof userRepo.updateLastLogin).toBe('function');
    });

    it('should have correct method signatures for CompanyRepository', () => {
      const companyRepo = new CompanyRepository();
      
      expect(typeof companyRepo.findById).toBe('function');
      expect(typeof companyRepo.findByShareableUrl).toBe('function');
      expect(typeof companyRepo.create).toBe('function');
      expect(typeof companyRepo.update).toBe('function');
      expect(typeof companyRepo.delete).toBe('function');
      expect(typeof companyRepo.isShareableUrlUnique).toBe('function');
    });

    it('should have correct method signatures for EventRepository', () => {
      const eventRepo = new EventRepository();
      
      expect(typeof eventRepo.findById).toBe('function');
      expect(typeof eventRepo.findByCompanyId).toBe('function');
      expect(typeof eventRepo.findPublicByCompanyId).toBe('function');
      expect(typeof eventRepo.findUpcomingByCompanyId).toBe('function');
      expect(typeof eventRepo.findByDateRange).toBe('function');
      expect(typeof eventRepo.findForCalendarFeed).toBe('function');
      expect(typeof eventRepo.create).toBe('function');
      expect(typeof eventRepo.update).toBe('function');
      expect(typeof eventRepo.delete).toBe('function');
    });

    it('should have correct method signatures for WidgetConfigRepository', () => {
      const widgetRepo = new WidgetConfigRepository();
      
      expect(typeof widgetRepo.findById).toBe('function');
      expect(typeof widgetRepo.findByCompanyId).toBe('function');
      expect(typeof widgetRepo.create).toBe('function');
      expect(typeof widgetRepo.update).toBe('function');
      expect(typeof widgetRepo.delete).toBe('function');
      expect(typeof widgetRepo.updateByCompanyId).toBe('function');
      expect(typeof widgetRepo.deleteByCompanyId).toBe('function');
      expect(typeof widgetRepo.upsertByCompanyId).toBe('function');
      expect(typeof widgetRepo.getDefaultConfig).toBe('function');
      expect(typeof widgetRepo.findByCompanyIdWithDefaults).toBe('function');
    });
  });
});