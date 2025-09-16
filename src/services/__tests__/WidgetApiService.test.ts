import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WidgetApiService } from '../WidgetApiService';
import { Event, WidgetConfig, Company } from '../../models';
import { IEventRepository } from '../../repositories/EventRepository';
import { ICompanyRepository } from '../../repositories/CompanyRepository';
import { IWidgetConfigRepository } from '../../repositories/WidgetConfigRepository';

describe('WidgetApiService', () => {
  let service: WidgetApiService;
  let mockEventRepository: IEventRepository;
  let mockCompanyRepository: ICompanyRepository;
  let mockWidgetConfigRepository: IWidgetConfigRepository;
  let mockCompany: Company;
  let mockEvents: Event[];
  let mockConfig: WidgetConfig;

  beforeEach(() => {
    // Create mock repositories
    mockEventRepository = {
      findById: vi.fn(),
      findByCompanyId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findAll: vi.fn()
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

    service = new WidgetApiService(
      mockEventRepository,
      mockCompanyRepository,
      mockWidgetConfigRepository
    );

    mockCompany = {
      id: 'company-1',
      name: 'Test Company',
      shareableUrl: 'test-company',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockEvents = [
      {
        id: 'event-1',
        companyId: 'company-1',
        title: 'Future Event',
        description: 'A future event',
        startDateTime: new Date(Date.now() + 86400000), // Tomorrow
        endDateTime: new Date(Date.now() + 90000000),
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'event-2',
        companyId: 'company-1',
        title: 'Past Event',
        description: 'A past event',
        startDateTime: new Date(Date.now() - 86400000), // Yesterday
        endDateTime: new Date(Date.now() - 82800000),
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'event-3',
        companyId: 'company-1',
        title: 'Private Event',
        description: 'A private event',
        startDateTime: new Date(Date.now() + 172800000), // Day after tomorrow
        endDateTime: new Date(Date.now() + 176400000),
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockConfig = {
      companyId: 'company-1',
      theme: 'light',
      primaryColor: '#007bff',
      showUpcomingOnly: true,
      maxEvents: 10,
      dateFormat: 'MMM dd, yyyy'
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('getWidgetEvents', () => {
    it('should return filtered public events for valid company', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);
      mockEventRepository.findByCompanyId.mockResolvedValue(mockEvents);

      const result = await service.getWidgetEvents('company-1');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Future Event');
      expect(result[0].isPublic).toBe(true);
      expect(mockCompanyRepository.findById).toHaveBeenCalledWith('company-1');
      expect(mockEventRepository.findByCompanyId).toHaveBeenCalledWith('company-1');
    });

    it('should include past events when showUpcomingOnly is false', async () => {
      const configWithPastEvents = { ...mockConfig, showUpcomingOnly: false };
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(configWithPastEvents);
      mockEventRepository.findByCompanyId.mockResolvedValue(mockEvents);

      const result = await service.getWidgetEvents('company-1');

      expect(result).toHaveLength(2); // Both public events
      expect(result.some(e => e.title === 'Past Event')).toBe(true);
      expect(result.some(e => e.title === 'Future Event')).toBe(true);
    });

    it('should limit events based on maxEvents configuration', async () => {
      const configWithLimit = { ...mockConfig, maxEvents: 1, showUpcomingOnly: false };
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(configWithLimit);
      mockEventRepository.findByCompanyId.mockResolvedValue(mockEvents);

      const result = await service.getWidgetEvents('company-1');

      expect(result).toHaveLength(1);
    });

    it('should throw error for non-existent company', async () => {
      mockCompanyRepository.findById.mockResolvedValue(null);

      await expect(service.getWidgetEvents('invalid-company')).rejects.toThrow('Failed to retrieve widget events');
      expect(mockCompanyRepository.findById).toHaveBeenCalledWith('invalid-company');
    });

    it('should handle repository errors gracefully', async () => {
      mockCompanyRepository.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getWidgetEvents('company-1')).rejects.toThrow('Failed to retrieve widget events');
    });
  });

  describe('getWidgetConfig', () => {
    it('should return existing widget configuration', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);

      const result = await service.getWidgetConfig('company-1');

      expect(result).toEqual(mockConfig);
      expect(mockCompanyRepository.findById).toHaveBeenCalledWith('company-1');
      expect(mockWidgetConfigRepository.findByCompanyId).toHaveBeenCalledWith('company-1');
    });

    it('should create default configuration if none exists', async () => {
      const defaultConfig: WidgetConfig = {
        companyId: 'company-1',
        theme: 'light',
        primaryColor: '#007bff',
        showUpcomingOnly: true,
        maxEvents: 10,
        dateFormat: 'MMM dd, yyyy'
      };

      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(null);
      mockWidgetConfigRepository.create.mockResolvedValue(defaultConfig);

      const result = await service.getWidgetConfig('company-1');

      expect(result).toEqual(defaultConfig);
      expect(mockWidgetConfigRepository.create).toHaveBeenCalledWith(defaultConfig);
    });

    it('should throw error for non-existent company', async () => {
      mockCompanyRepository.findById.mockResolvedValue(null);

      await expect(service.getWidgetConfig('invalid-company')).rejects.toThrow('Failed to retrieve widget configuration');
    });
  });

  describe('updateWidgetConfig', () => {
    it('should update widget configuration successfully', async () => {
      const configUpdate = { theme: 'dark' as const, primaryColor: '#ff0000' };
      const updatedConfig = { ...mockConfig, ...configUpdate };

      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);
      mockWidgetConfigRepository.update.mockResolvedValue(updatedConfig);

      const result = await service.updateWidgetConfig('company-1', configUpdate);

      expect(result).toEqual(updatedConfig);
      expect(mockWidgetConfigRepository.update).toHaveBeenCalledWith('company-1', configUpdate);
    });

    it('should validate theme values', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);

      await expect(
        service.updateWidgetConfig('company-1', { theme: 'invalid' as any })
      ).rejects.toThrow('Invalid theme value. Must be light, dark, or auto');
    });

    it('should validate primary color format', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);

      await expect(
        service.updateWidgetConfig('company-1', { primaryColor: 'invalid-color' })
      ).rejects.toThrow('Invalid primary color. Must be a valid hex color code');
    });

    it('should validate max events range', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);

      await expect(
        service.updateWidgetConfig('company-1', { maxEvents: -1 })
      ).rejects.toThrow('Max events must be between 0 and 100');

      await expect(
        service.updateWidgetConfig('company-1', { maxEvents: 101 })
      ).rejects.toThrow('Max events must be between 0 and 100');
    });

    it('should throw error for non-existent company', async () => {
      mockCompanyRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateWidgetConfig('invalid-company', { theme: 'dark' })
      ).rejects.toThrow('Failed to update widget configuration');
    });
  });

  describe('generateWidgetScript', () => {
    beforeEach(() => {
      process.env.BASE_URL = 'https://example.com';
    });

    afterEach(() => {
      delete process.env.BASE_URL;
    });

    it('should generate widget script with configuration', async () => {
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);

      const result = await service.generateWidgetScript('company-1');

      expect(result).toContain('const config = {');
      expect(result).toContain('"companyId": "company-1"');
      expect(result).toContain('"theme": "light"');
      expect(result).toContain('"primaryColor": "#007bff"');
      expect(result).toContain('https://example.com/api/widget/company-1');
      expect(result).toContain('createWidget');
      expect(result).toContain('loadEvents');
      expect(result).toContain('addToGoogleCalendar');
    });

    it('should use default base URL when not configured', async () => {
      delete process.env.BASE_URL;
      
      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(mockConfig);

      const result = await service.generateWidgetScript('company-1');

      expect(result).toContain('http://localhost:3000/api/widget/company-1');
    });

    it('should throw error for non-existent company', async () => {
      mockCompanyRepository.findById.mockResolvedValue(null);

      await expect(service.generateWidgetScript('invalid-company')).rejects.toThrow('Failed to generate widget script');
    });

    it('should handle configuration creation if none exists', async () => {
      const defaultConfig: WidgetConfig = {
        companyId: 'company-1',
        theme: 'light',
        primaryColor: '#007bff',
        showUpcomingOnly: true,
        maxEvents: 10,
        dateFormat: 'MMM dd, yyyy'
      };

      mockCompanyRepository.findById.mockResolvedValue(mockCompany);
      mockWidgetConfigRepository.findByCompanyId.mockResolvedValue(null);
      mockWidgetConfigRepository.create.mockResolvedValue(defaultConfig);

      const result = await service.generateWidgetScript('company-1');

      expect(result).toContain('"companyId": "company-1"');
      expect(mockWidgetConfigRepository.create).toHaveBeenCalledWith(defaultConfig);
    });
  });
});