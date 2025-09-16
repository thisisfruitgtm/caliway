import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheInvalidationService } from '../CacheInvalidationService';
import { CalendarRoutes } from '../../api/routes/calendar';

// Mock the CalendarRoutes
vi.mock('../../api/routes/calendar', () => ({
  CalendarRoutes: {
    invalidateCacheForCompany: vi.fn()
  }
}));

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let mockInvalidateCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new CacheInvalidationService();
    mockInvalidateCache = CalendarRoutes.invalidateCacheForCompany as ReturnType<typeof vi.fn>;
    mockInvalidateCache.mockClear();
    
    // Mock console.log and console.error to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('invalidateCalendarFeed', () => {
    it('should call CalendarRoutes.invalidateCacheForCompany with correct company ID', () => {
      // Arrange
      const companyId = 'test-company-123';

      // Act
      service.invalidateCalendarFeed(companyId);

      // Assert
      expect(mockInvalidateCache).toHaveBeenCalledWith(companyId);
      expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
    });

    it('should log success message when cache invalidation succeeds', () => {
      // Arrange
      const companyId = 'test-company-123';
      const consoleSpy = vi.spyOn(console, 'log');

      // Act
      service.invalidateCalendarFeed(companyId);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(`Cache invalidated for company: ${companyId}`);
    });

    it('should handle errors gracefully and not throw', () => {
      // Arrange
      const companyId = 'test-company-123';
      const error = new Error('Cache invalidation failed');
      mockInvalidateCache.mockImplementation(() => {
        throw error;
      });
      const consoleErrorSpy = vi.spyOn(console, 'error');

      // Act & Assert
      expect(() => service.invalidateCalendarFeed(companyId)).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to invalidate cache for company:',
        companyId,
        error
      );
    });

    it('should work with different company IDs', () => {
      // Arrange
      const companyIds = ['company-1', 'company-2', 'company-3'];

      // Act
      companyIds.forEach(id => service.invalidateCalendarFeed(id));

      // Assert
      expect(mockInvalidateCache).toHaveBeenCalledTimes(3);
      companyIds.forEach(id => {
        expect(mockInvalidateCache).toHaveBeenCalledWith(id);
      });
    });
  });

  describe('invalidateAllCaches', () => {
    it('should log success message when invalidating all caches', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log');

      // Act
      service.invalidateAllCaches();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('All caches invalidated');
    });

    it('should handle errors gracefully and not throw', () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error');
      // Force an error by mocking console.log to throw
      vi.spyOn(console, 'log').mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Act & Assert
      expect(() => service.invalidateAllCaches()).not.toThrow();
    });
  });
});