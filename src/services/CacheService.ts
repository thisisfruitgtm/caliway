import { Event } from '../models';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
}

export interface CacheConfig {
  feedTTL?: number;
  publicViewTTL?: number;
  maxEntries?: number;
  cleanupInterval?: number;
}

export class CacheService {
  private feedCache: Map<string, CacheEntry<string>> = new Map();
  private publicViewCache: Map<string, CacheEntry<Event[]>> = new Map();
  private stats = {
    hits: 0,
    misses: 0
  };
  
  private readonly feedTTL: number;
  private readonly publicViewTTL: number;
  private readonly maxEntries: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.feedTTL = config.feedTTL || 15 * 60 * 1000; // 15 minutes
    this.publicViewTTL = config.publicViewTTL || 5 * 60 * 1000; // 5 minutes
    this.maxEntries = config.maxEntries || 1000;
    
    // Start cleanup timer
    const cleanupInterval = config.cleanupInterval || 5 * 60 * 1000; // 5 minutes
    this.startCleanupTimer(cleanupInterval);
  }

  /**
   * Get cached calendar feed
   */
  getCachedFeed(companyId: string): string | null {
    const entry = this.feedCache.get(companyId);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.feedCache.delete(companyId);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Cache calendar feed
   */
  setCachedFeed(companyId: string, feed: string): void {
    this.enforceMaxEntries(this.feedCache);
    
    this.feedCache.set(companyId, {
      data: feed,
      timestamp: Date.now(),
      ttl: this.feedTTL
    });
  }

  /**
   * Get cached public events
   */
  getCachedPublicEvents(companyId: string): Event[] | null {
    const entry = this.publicViewCache.get(companyId);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.publicViewCache.delete(companyId);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Cache public events
   */
  setCachedPublicEvents(companyId: string, events: Event[]): void {
    this.enforceMaxEntries(this.publicViewCache);
    
    this.publicViewCache.set(companyId, {
      data: events,
      timestamp: Date.now(),
      ttl: this.publicViewTTL
    });
  }

  /**
   * Invalidate all cache entries for a company
   */
  invalidateCompanyCache(companyId: string): void {
    this.feedCache.delete(companyId);
    this.publicViewCache.delete(companyId);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAllCache(): void {
    this.feedCache.clear();
    this.publicViewCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

    return {
      totalEntries: this.feedCache.size + this.publicViewCache.size,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Enforce maximum number of cache entries
   */
  private enforceMaxEntries<T>(cache: Map<string, CacheEntry<T>>): void {
    if (cache.size >= this.maxEntries) {
      // Remove oldest entries (simple LRU-like behavior)
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 10% of entries
      const toRemove = Math.ceil(entries.length * 0.1);
      for (let i = 0; i < toRemove; i++) {
        cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean feed cache
    for (const [key, entry] of this.feedCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.feedCache.delete(key);
      }
    }
    
    // Clean public view cache
    for (const [key, entry] of this.publicViewCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.publicViewCache.delete(key);
      }
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(interval: number): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, interval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    
    // Estimate feed cache size
    for (const entry of this.feedCache.values()) {
      size += entry.data.length * 2; // Rough estimate for string size
      size += 24; // Overhead for timestamp and ttl
    }
    
    // Estimate public view cache size
    for (const entry of this.publicViewCache.values()) {
      size += entry.data.length * 200; // Rough estimate per event object
      size += 24; // Overhead for timestamp and ttl
    }
    
    return size;
  }

  /**
   * Get cache entry count by type
   */
  getCacheInfo(): {
    feedCacheSize: number;
    publicViewCacheSize: number;
    feedTTL: number;
    publicViewTTL: number;
  } {
    return {
      feedCacheSize: this.feedCache.size,
      publicViewCacheSize: this.publicViewCache.size,
      feedTTL: this.feedTTL,
      publicViewTTL: this.publicViewTTL
    };
  }

  /**
   * Warm up cache for a company
   */
  async warmUpCache(
    companyId: string,
    feedGenerator: () => Promise<string>,
    eventsGenerator: () => Promise<Event[]>
  ): Promise<void> {
    try {
      // Generate and cache feed
      const feed = await feedGenerator();
      this.setCachedFeed(companyId, feed);
      
      // Generate and cache events
      const events = await eventsGenerator();
      this.setCachedPublicEvents(companyId, events);
    } catch (error) {
      console.error(`Failed to warm up cache for company ${companyId}:`, error);
    }
  }

  /**
   * Preload cache for multiple companies
   */
  async preloadCache(
    companyIds: string[],
    feedGenerator: (companyId: string) => Promise<string>,
    eventsGenerator: (companyId: string) => Promise<Event[]>
  ): Promise<void> {
    const promises = companyIds.map(async (companyId) => {
      try {
        await this.warmUpCache(
          companyId,
          () => feedGenerator(companyId),
          () => eventsGenerator(companyId)
        );
      } catch (error) {
        console.error(`Failed to preload cache for company ${companyId}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }
}

// Global cache instance
export const cacheService = new CacheService();