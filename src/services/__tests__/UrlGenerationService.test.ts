import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UrlGenerationService } from '../UrlGenerationService';
import { Company } from '../../models';
import { ICompanyRepository } from '../../repositories/CompanyRepository';

// Mock crypto module
vi.mock('crypto', () => ({
  randomBytes: vi.fn()
}));

describe('UrlGenerationService', () => {
  let urlService: UrlGenerationService;
  let mockCompanyRepository: ICompanyRepository;
  let mockCompany: Company;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock Date.now to return consistent timestamp
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
    
    // Create mock company repository
    mockCompanyRepository = {
      findById: vi.fn(),
      findByShareableUrl: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      isShareableUrlUnique: vi.fn()
    };

    // Create mock company
    mockCompany = {
      id: 'company-123',
      name: 'Test Company',
      shareableUrl: 'cal-existing-url',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01')
    };

    // Set up environment variable
    process.env.BASE_URL = 'https://example.com';
    
    urlService = new UrlGenerationService(mockCompanyRepository, 'https://example.com');
  });

  describe('generateShareableUrl', () => {
    it('should return existing shareable URL if company already has one', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(mockCompany);

      // Act
      const result = await urlService.generateShareableUrl('company-123');

      // Assert
      expect(result).toBe('cal-existing-url');
      expect(mockCompanyRepository.findById).toHaveBeenCalledWith('company-123');
      expect(mockCompanyRepository.update).not.toHaveBeenCalled();
    });

    it('should generate new shareable URL if company does not have one', async () => {
      // Arrange
      const companyWithoutUrl = { ...mockCompany, shareableUrl: '' };
      const updatedCompany = { ...mockCompany, shareableUrl: 'cal-new-url' };
      
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(companyWithoutUrl);
      mockCompanyRepository.isShareableUrlUnique = vi.fn().mockResolvedValue(true);
      mockCompanyRepository.update = vi.fn().mockResolvedValue(updatedCompany);
      
      // Mock crypto.randomBytes
      const { randomBytes } = await import('crypto');
      (vi.mocked(randomBytes) as any).mockReturnValue(Buffer.from('abcd1234', 'hex'));

      // Act
      const result = await urlService.generateShareableUrl('company-123');

      // Assert
      expect(result).toBe('cal-kxv26800-abcd1234'); // kxv26800 is base36 of 1640995200000
      expect(mockCompanyRepository.findById).toHaveBeenCalledWith('company-123');
      expect(mockCompanyRepository.isShareableUrlUnique).toHaveBeenCalled();
      expect(mockCompanyRepository.update).toHaveBeenCalledWith('company-123', {
        shareableUrl: 'cal-kxv26800-abcd1234',
        updatedAt: expect.any(Date)
      });
    });

    it('should throw error if company not found', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(urlService.generateShareableUrl('nonexistent')).rejects.toThrow('Company not found');
    });

    it('should throw error if update fails', async () => {
      // Arrange
      const companyWithoutUrl = { ...mockCompany, shareableUrl: '' };
      
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(companyWithoutUrl);
      mockCompanyRepository.isShareableUrlUnique = vi.fn().mockResolvedValue(true);
      mockCompanyRepository.update = vi.fn().mockResolvedValue(null);
      
      // Mock crypto.randomBytes
      const { randomBytes } = await import('crypto');
      (vi.mocked(randomBytes) as any).mockReturnValue(Buffer.from('abcd1234', 'hex'));

      // Act & Assert
      await expect(urlService.generateShareableUrl('company-123')).rejects.toThrow('Failed to update company with shareable URL');
    });

    it('should retry URL generation if collision occurs', async () => {
      // Arrange
      const companyWithoutUrl = { ...mockCompany, shareableUrl: '' };
      const updatedCompany = { ...mockCompany, shareableUrl: 'cal-new-url' };
      
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(companyWithoutUrl);
      mockCompanyRepository.isShareableUrlUnique = vi.fn()
        .mockResolvedValueOnce(false) // First attempt fails
        .mockResolvedValueOnce(true);  // Second attempt succeeds
      mockCompanyRepository.update = vi.fn().mockResolvedValue(updatedCompany);
      
      // Mock crypto.randomBytes to return different values
      const { randomBytes } = await import('crypto');
      (vi.mocked(randomBytes) as any)
        .mockReturnValueOnce(Buffer.from('abcd1234', 'hex')) // First attempt (collision)
        .mockReturnValueOnce(Buffer.from('success1', 'ascii')); // Second attempt (success)

      // Act
      const result = await urlService.generateShareableUrl('company-123');

      // Assert
      expect(mockCompanyRepository.isShareableUrlUnique).toHaveBeenCalledTimes(2);
      expect(result).toBe('cal-kxv26800-7375636365737331'); // 7375636365737331 is hex of 'success1'
    });

    it('should throw error after maximum retries', async () => {
      // Arrange
      const companyWithoutUrl = { ...mockCompany, shareableUrl: '' };
      
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(companyWithoutUrl);
      mockCompanyRepository.isShareableUrlUnique = vi.fn().mockResolvedValue(false); // Always fails
      
      // Mock crypto.randomBytes
      const { randomBytes } = await import('crypto');
      (vi.mocked(randomBytes) as any).mockReturnValue(Buffer.from('collision', 'hex'));

      // Act & Assert
      await expect(urlService.generateShareableUrl('company-123')).rejects.toThrow('Failed to generate unique shareable URL after maximum retries');
    });
  });

  describe('getCompanyByShareUrl', () => {
    it('should return company for valid share URL', async () => {
      // Arrange
      mockCompanyRepository.findByShareableUrl = vi.fn().mockResolvedValue(mockCompany);

      // Act
      const result = await urlService.getCompanyByShareUrl('cal-existing-url');

      // Assert
      expect(result).toEqual(mockCompany);
      expect(mockCompanyRepository.findByShareableUrl).toHaveBeenCalledWith('cal-existing-url');
    });

    it('should return null for invalid share URL', async () => {
      // Arrange
      mockCompanyRepository.findByShareableUrl = vi.fn().mockResolvedValue(null);

      // Act
      const result = await urlService.getCompanyByShareUrl('invalid-url');

      // Assert
      expect(result).toBeNull();
      expect(mockCompanyRepository.findByShareableUrl).toHaveBeenCalledWith('invalid-url');
    });

    it('should return null for empty share URL', async () => {
      // Act
      const result = await urlService.getCompanyByShareUrl('');

      // Assert
      expect(result).toBeNull();
      expect(mockCompanyRepository.findByShareableUrl).not.toHaveBeenCalled();
    });

    it('should return null for whitespace-only share URL', async () => {
      // Act
      const result = await urlService.getCompanyByShareUrl('   ');

      // Assert
      expect(result).toBeNull();
      expect(mockCompanyRepository.findByShareableUrl).not.toHaveBeenCalled();
    });
  });

  describe('generateCalendarSubscriptionUrls', () => {
    it('should generate all calendar subscription URLs', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('cal-test-url');

      // Assert
      expect(result.icalFeed).toBe('https://example.com/calendar/cal-test-url/feed.ics');
      expect(result.googleCalendar).toContain('https://calendar.google.com/calendar/render?cid=');
      expect(result.outlookCalendar).toContain('https://outlook.live.com/calendar/0/addcalendar?url=');
      expect(result.appleCalendar).toBe('webcal://example.com/calendar/cal-test-url/feed.ics');
    });

    it('should properly encode URLs for calendar applications', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('cal-test-url');
      
      // Extract encoded URL from Google Calendar URL
      const googleUrl = new URL(result.googleCalendar);
      const encodedUrl = googleUrl.searchParams.get('cid');
      const decodedUrl = decodeURIComponent(encodedUrl!);

      // Assert
      expect(decodedUrl).toBe('https://example.com/calendar/cal-test-url/feed.ics');
    });

    it('should throw error for empty share URL', () => {
      // Act & Assert
      expect(() => urlService.generateCalendarSubscriptionUrls('')).toThrow('Share URL is required');
    });

    it('should throw error for whitespace-only share URL', () => {
      // Act & Assert
      expect(() => urlService.generateCalendarSubscriptionUrls('   ')).toThrow('Share URL is required');
    });
  });

  describe('generateEmbedCode', () => {
    it('should generate embed code with default configuration', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(mockCompany);

      // Act
      const result = await urlService.generateEmbedCode('company-123');

      // Assert
      expect(result).toContain('company-calendar-widget-cal-existing-url');
      expect(result).toContain('https://example.com/widget/cal-existing-url');
      expect(result).toContain('"theme": "auto"');
      expect(result).toContain('"primaryColor": "#007bff"');
      expect(result).toContain('"maxEvents": 5');
      expect(result).toContain('"showUpcomingOnly": true');
    });

    it('should generate embed code with custom configuration', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(mockCompany);
      const config = {
        theme: 'dark' as const,
        primaryColor: '#ff0000',
        maxEvents: 10,
        showUpcomingOnly: false
      };

      // Act
      const result = await urlService.generateEmbedCode('company-123', config);

      // Assert
      expect(result).toContain('"theme": "dark"');
      expect(result).toContain('"primaryColor": "#ff0000"');
      expect(result).toContain('"maxEvents": 10');
      expect(result).toContain('"showUpcomingOnly": false');
    });

    it('should generate shareable URL if company does not have one', async () => {
      // Arrange
      const companyWithoutUrl = { ...mockCompany, shareableUrl: '' };
      const updatedCompany = { ...mockCompany, shareableUrl: 'cal-new-url' };
      
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(companyWithoutUrl);
      mockCompanyRepository.isShareableUrlUnique = vi.fn().mockResolvedValue(true);
      mockCompanyRepository.update = vi.fn().mockResolvedValue(updatedCompany);
      
      // Mock crypto.randomBytes
      const { randomBytes } = await import('crypto');
      (vi.mocked(randomBytes) as any).mockReturnValue(Buffer.from('abcd1234', 'hex'));

      // Act
      const result = await urlService.generateEmbedCode('company-123');

      // Assert
      expect(result).toContain('company-calendar-widget-cal-kxv26800-abcd1234');
      expect(mockCompanyRepository.update).toHaveBeenCalled();
    });

    it('should throw error if company not found', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(urlService.generateEmbedCode('nonexistent')).rejects.toThrow('Company not found');
    });
  });

  describe('ensureCompanyHasShareableUrl', () => {
    it('should return existing shareable URL', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(mockCompany);

      // Act
      const result = await urlService.ensureCompanyHasShareableUrl('company-123');

      // Assert
      expect(result).toBe('cal-existing-url');
      expect(mockCompanyRepository.findById).toHaveBeenCalledWith('company-123');
    });

    it('should generate new shareable URL if company does not have one', async () => {
      // Arrange
      const companyWithoutUrl = { ...mockCompany, shareableUrl: '' };
      const updatedCompany = { ...mockCompany, shareableUrl: 'cal-new-url' };
      
      mockCompanyRepository.findById = vi.fn()
        .mockResolvedValueOnce(companyWithoutUrl) // First call in ensureCompanyHasShareableUrl
        .mockResolvedValueOnce(companyWithoutUrl); // Second call in generateShareableUrl
      mockCompanyRepository.isShareableUrlUnique = vi.fn().mockResolvedValue(true);
      mockCompanyRepository.update = vi.fn().mockResolvedValue(updatedCompany);
      
      // Mock crypto.randomBytes
      const { randomBytes } = await import('crypto');
      (vi.mocked(randomBytes) as any).mockReturnValue(Buffer.from('abcd1234', 'hex'));

      // Act
      const result = await urlService.ensureCompanyHasShareableUrl('company-123');

      // Assert
      expect(result).toBe('cal-kxv26800-abcd1234');
      expect(mockCompanyRepository.update).toHaveBeenCalled();
    });

    it('should throw error if company not found', async () => {
      // Arrange
      mockCompanyRepository.findById = vi.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(urlService.ensureCompanyHasShareableUrl('nonexistent')).rejects.toThrow('Company not found');
    });
  });

  describe('validateShareableUrl', () => {
    it('should validate correct shareable URL format', () => {
      // Act & Assert
      expect(UrlGenerationService.validateShareableUrl('cal-abc123-def456')).toBe(true);
      expect(UrlGenerationService.validateShareableUrl('cal-1234567890')).toBe(true);
      expect(UrlGenerationService.validateShareableUrl('cal-test-url-123')).toBe(true);
    });

    it('should reject invalid shareable URL formats', () => {
      // Act & Assert
      expect(UrlGenerationService.validateShareableUrl('')).toBe(false);
      expect(UrlGenerationService.validateShareableUrl('   ')).toBe(false);
      expect(UrlGenerationService.validateShareableUrl('invalid-url')).toBe(false);
      expect(UrlGenerationService.validateShareableUrl('cal-')).toBe(false);
      expect(UrlGenerationService.validateShareableUrl('cal-abc@123')).toBe(false);
      expect(UrlGenerationService.validateShareableUrl('cal-abc 123')).toBe(false);
    });

    it('should reject URLs that are too short or too long', () => {
      // Act & Assert
      expect(UrlGenerationService.validateShareableUrl('cal-123')).toBe(false); // Too short
      expect(UrlGenerationService.validateShareableUrl('cal-' + 'a'.repeat(200))).toBe(false); // Too long
    });
  });

  describe('private methods behavior', () => {
    it('should handle webcal URL conversion correctly', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('cal-test-url');

      // Assert - Apple Calendar should use webcal protocol
      expect(result.appleCalendar).toBe('webcal://example.com/calendar/cal-test-url/feed.ics');
    });

    it('should handle URL encoding for special characters', () => {
      // Act
      const result = urlService.generateCalendarSubscriptionUrls('cal-test-url');
      
      // The iCal feed URL should be properly encoded in Google and Outlook URLs
      const expectedIcalUrl = 'https://example.com/calendar/cal-test-url/feed.ics';
      const encodedUrl = encodeURIComponent(expectedIcalUrl);

      // Assert
      expect(result.googleCalendar).toContain(encodedUrl);
      expect(result.outlookCalendar).toContain(encodedUrl);
    });
  });
});