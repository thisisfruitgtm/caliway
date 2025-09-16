import { CalendarRoutes } from '../api/routes/calendar';
import { cacheService } from './CacheService';

export interface ICacheInvalidationService {
  invalidateCalendarFeed(companyId: string): void;
  invalidateAllCaches(): void;
  getCacheStats(): any;
  warmUpCache(companyId: string): Promise<void>;
}

/**
 * Service responsible for invalidating caches when data changes
 */
export class CacheInvalidationService implements ICacheInvalidationService {
  /**
   * Invalidate calendar feed cache for a specific company
   * This should be called whenever events are created, updated, or deleted
   */
  invalidateCalendarFeed(companyId: string): void {
    try {
      // Invalidate using the new cache service
      cacheService.invalidateCompanyCache(companyId);
      
      // Also invalidate the old calendar routes cache for backward compatibility
      CalendarRoutes.invalidateCacheForCompany(companyId);
      
      console.log(`Cache invalidated for company: ${companyId}`);
    } catch (error) {
      console.error('Failed to invalidate cache for company:', companyId, error);
      // Don't throw error - cache invalidation failure shouldn't break the main operation
    }
  }

  /**
   * Invalidate all caches (useful for maintenance or system-wide updates)
   */
  invalidateAllCaches(): void {
    try {
      // Invalidate all caches using the new cache service
      cacheService.invalidateAllCache();
      
      console.log('All caches invalidated');
    } catch (error) {
      console.error('Failed to invalidate all caches:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return cacheService.getStats();
  }

  /**
   * Warm up cache for a company
   */
  async warmUpCache(companyId: string): Promise<void> {
    try {
      // This would need to be implemented with proper service dependencies
      console.log(`Cache warm-up requested for company: ${companyId}`);
    } catch (error) {
      console.error('Failed to warm up cache for company:', companyId, error);
    }
  }
}