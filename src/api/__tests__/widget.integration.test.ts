import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { UserRepository } from '../../repositories/UserRepository';
import { CompanyRepository } from '../../repositories/CompanyRepository';
import { WidgetConfigRepository } from '../../repositories/WidgetConfigRepository';
import { EventRepository } from '../../repositories/EventRepository';
import { User, Company, WidgetConfig, Event } from '../../models';

// Mock repositories
vi.mock('../../repositories/UserRepository');
vi.mock('../../repositories/CompanyRepository');
vi.mock('../../repositories/WidgetConfigRepository');
vi.mock('../../repositories/EventRepository');

describe('Widget Routes Integration', () => {
  let mockUserRepository: any;
  let mockCompanyRepository: any;
  let mockWidgetConfigRepository: any;
  let mockEventRepository: any;
  let mockUser: User;
  let mockCompany: Company;
  let mockConfig: WidgetConfig;
  let mockEvents: Event[];
  let authCookie: string;

  beforeEach(async () => {
    // Create mock repositories
    mockUserRepository = {
      findByUsername: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };

    mockCompanyRepository = {
      findById: vi.fn(),
      findByShareableUrl: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      isShareableUrlUnique: vi.fn()
    };

    mockWidgetConfigRepository = {
      findByCompanyId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };

    mockEventRepository = {
      findById: vi.fn(),
      findByCompanyId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };

    // Set up mocks
    UserRepository.prototype.findByUsername = mockUserRepository.findByUsername;
    UserRepository.prototype.findById = mockUserRepository.findById;
    CompanyRepository.prototype.findById = mockCompanyRepository.findById;
    WidgetConfigRepository.prototype.findByCompanyId = mockWidgetConfigRepository.findByCompanyId;
    WidgetConfigRepository.prototype.create = mockWidgetConfigRepository.create;
    WidgetConfigRepository.prototype.update = mockWidgetConfigRepository.update;
    EventRepository.prototype.findByCompanyId = mockEventRepository.findByCompanyId;

    // Mock data
    mockUser = {
      id: 'user-1',
      username: 'testuser',
      passwordHash: '$2b$10$hashedpassword',
      companyId: 'company-1',
      createdAt: new Date(),
      lastLoginAt: new Date()
    };

    mockCompany = {
      id: 'company-1',
      name: 'Test Company',
      shareableUrl: 'test-company',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockConfig = {
      companyId: 'company-1',
      theme: 'light',
      primaryColor: '#007bff',
      showUpcomingOnly: true,
      maxEvents: 10,
      dateFormat: 'MMM dd, yyyy'
    };

    mockEvents = [
      {
        id: 'event-1',
        companyId: 'company-1',
        title: 'Test Event',
        description: 'Test Description',
        startDateTime: new Date(Date.now() + 86400000),
        endDateTime: new Date(Date.now() + 90000000),
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Login to get auth cookie
    mockUserRepository.findByUsername.mockResolvedValue(mockUser);
    
    const loginResponse = await request(app)
      .post('/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    authCookie = loginResponse.headers['set-cookie'][0];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /widget', () => {
    it('should render widget customization page for authenticated users', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/widget')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.text).toContain('Widget Generator');
      expect(response.text).toContain('Widget Configuration');
      expect(response.text).toContain('Preview & Code');
      expect(response.text).toContain('Embed Code');
    });

    it('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/widget')
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });
  });

  describe('GET /widget/config', () => {
    it('should return widget configuration for authenticated users', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/widget/config')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(mockConfig);
    });

    it('should create default configuration if none exists', async () => {
      const defaultConfig = {
        companyId: 'company-1',
        theme: 'light',
        primaryColor: '#007bff',
        showUpcomingOnly: true,
        maxEvents: 10,
        dateFormat: 'MMM dd, yyyy'
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(null);
      mockWidgetConfigRepository.create.mockResolvedValue(defaultConfig);

      const response = await request(app)
        .get('/widget/config')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(defaultConfig);
      expect(mockWidgetConfigRepository.create).toHaveBeenCalledWith(defaultConfig);
    });

    it('should return 401 for unauthenticated users', async () => {
      const response = await request(app)
        .get('/widget/config')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /widget/config', () => {
    it('should update widget configuration successfully', async () => {
      const configUpdate = {
        theme: 'dark' as const,
        primaryColor: '#ff0000',
        maxEvents: 5
      };

      const updatedConfig = { ...mockConfig, ...configUpdate };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);
      mockWidgetConfigRepository.update.mockResolvedValue(updatedConfig);

      const response = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send(configUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toEqual(updatedConfig);
      expect(mockWidgetConfigRepository.update).toHaveBeenCalledWith('company-1', configUpdate);
    });

    it('should validate configuration values', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);

      const response = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send({
          theme: 'invalid-theme',
          primaryColor: 'not-a-color'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid theme value');
    });

    it('should return 401 for unauthenticated users', async () => {
      const response = await request(app)
        .put('/widget/config')
        .send({ theme: 'dark' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /widget/script', () => {
    it('should generate widget script for authenticated users', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.script).toContain('const config = {');
      expect(response.body.script).toContain('"companyId": "company-1"');
      expect(response.body.script).toContain('createWidget');
      expect(response.body.script).toContain('loadEvents');
    });

    it('should return 401 for unauthenticated users', async () => {
      const response = await request(app)
        .get('/widget/script')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /widget/:companyId/events', () => {
    it('should return public events for valid company (public endpoint)', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);
      mockEventRepository.findByCompanyId.mockResolvedValue(mockEvents);

      const response = await request(app)
        .get('/widget/company-1/events')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Test Event');
    });

    it('should return 404 for invalid company', async () => {
      mockCompanyRepository.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/widget/invalid-company/events')
        .expect(404);

      expect(response.body.error).toContain('Company not found');
    });

    it('should filter events based on widget configuration', async () => {
      const configWithLimit = { ...mockConfig, maxEvents: 0 };
      
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(configWithLimit);
      mockEventRepository.findByCompanyId.mockResolvedValue(mockEvents);

      const response = await request(app)
        .get('/widget/company-1/events')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('Widget Generation Workflow', () => {
    it('should complete full widget customization workflow', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);
      mockWidgetConfigRepository.update.mockResolvedValue({ ...mockConfig, theme: 'dark' });

      // 1. Access widget page
      const pageResponse = await request(app)
        .get('/widget')
        .set('Cookie', authCookie)
        .expect(200);

      expect(pageResponse.text).toContain('Widget Generator');

      // 2. Get current configuration
      const configResponse = await request(app)
        .get('/widget/config')
        .set('Cookie', authCookie)
        .expect(200);

      expect(configResponse.body.success).toBe(true);

      // 3. Update configuration
      const updateResponse = await request(app)
        .put('/widget/config')
        .set('Cookie', authCookie)
        .send({ theme: 'dark', primaryColor: '#ff0000' })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);

      // 4. Generate widget script
      const scriptResponse = await request(app)
        .get('/widget/script')
        .set('Cookie', authCookie)
        .expect(200);

      expect(scriptResponse.body.success).toBe(true);
      expect(scriptResponse.body.script).toContain('createWidget');

      // 5. Test public events endpoint
      mockEventRepository.findByCompanyId.mockResolvedValue(mockEvents);
      
      const eventsResponse = await request(app)
        .get('/widget/company-1/events')
        .expect(200);

      expect(Array.isArray(eventsResponse.body)).toBe(true);
    });

    it('should handle copy-to-clipboard functionality in UI', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/widget')
        .set('Cookie', authCookie)
        .expect(200);

      // Check that the page includes copy functionality
      expect(response.text).toContain('copyEmbedCode');
      expect(response.text).toContain('copy-button');
      expect(response.text).toContain('navigator.clipboard');
    });

    it('should include widget preview functionality', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/widget')
        .set('Cookie', authCookie)
        .expect(200);

      // Check that the page includes preview functionality
      expect(response.text).toContain('updatePreview');
      expect(response.text).toContain('createPreviewWidget');
      expect(response.text).toContain('calendar-widget-preview');
    });
  });
});