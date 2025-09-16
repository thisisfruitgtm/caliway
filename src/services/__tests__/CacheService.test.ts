import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService } from '../CacheService';
import { Event } from '../../models';

describe('CacheService', () => {
  let cacheService: CacheService;
  
  beforeEach(() => {
    cacheService = new CacheService({
      feedTTL: 1000, // 1 second for testing
      publicViewTTL: 500, // 0.5 seconds for testing
      maxEntries: 5,
      cleanupInterval: 100 // 0.1 seconds for testing
    });
  });

  afterEach(() => {
    cacheService.stopCleanupTimer();
    cacheService.invalidateAllCache();
  });

  describe('Feed Caching', () => {
    it('should cache and retrieve calendar feeds', () => {
      const companyId = 'test-company-1';
      const feed = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';

      // Cache miss initially
      expect(cacheService.getCachedFeed(companyId)).toBeNull();

      // Set cache
      cacheService.setCachedFeed(companyId, feed);

      // Cache hit
      expect(cacheService.getCachedFeed(companyId)).toBe(feed);
    });

    it('should expire cached feeds after TTL', async () => {
      const companyId = 'test-company-2';
      const feed = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';

      cacheService.setCachedFeed(companyId, feed);
      expect(cacheService.getCachedFeed(companyId)).toBe(feed);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(cacheService.getCachedFeed(companyId)).toBeNull();
    });

    it('should handle multiple companies', () => {
      const feed1 = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
      const feed2 = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:Company2\nEND:VCALENDAR';

      cacheService.setCachedFeed('company1', feed1);
      cacheService.setCachedFeed('company2', feed2);

      expect(cacheService.getCachedFeed('company1')).toBe(feed1);
      expect(cacheService.getCachedFeed('company2')).toBe(feed2);
    });
  });

  describe('Public Events Caching', () => {
    const mockEvents: Event[] = [
      {
        id: '1',
        companyId: 'test-company',
        title: 'Test Event 1',
        description: 'Description 1',
        startDateTime: new Date('2025-01-01T10:00:00Z'),
        endDateTime: new Date('2025-01-01T11:00:00Z'),
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        companyId: 'test-company',
        title: 'Test Event 2',
        description: 'Description 2',
        startDateTime: new Date('2025-01-02T10:00:00Z'),
        endDateTime: new Date('2025-01-02T11:00:00Z'),
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    it('should cache and retrieve public events', () => {
      const companyId = 'test-company';

      // Cache miss initially
      expect(cacheService.getCachedPublicEvents(companyId)).toBeNull();

      // Set cache
      cacheService.setCachedPublicEvents(companyId, mockEvents);

      // Cache hit
      const cachedEvents = cacheService.getCachedPublicEvents(companyId);
      expect(cachedEvents).toEqual(mockEvents);
      expect(cachedEvents).toHaveLength(2);
    });

    it('should expire cached events after TTL', async () => {
      const companyId = 'test-company';

      cacheService.setCachedPublicEvents(companyId, mockEvents);
      expect(cacheService.getCachedPublicEvents(companyId)).toEqual(mockEvents);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(cacheService.getCachedPublicEvents(companyId)).toBeNull();
    });
  });

  describe('Cache Management', () => {
    it('should invalidate company cache', () => {
      const companyId = 'test-company';
      const feed = 'test-feed';
      const events = [mockEvents[0]];

      cacheService.setCachedFeed(companyId, feed);
      cacheService.setCachedPublicEvents(companyId, events);

      expect(cacheService.getCachedFeed(companyId)).toBe(feed);
      expect(cacheService.getCachedPublicEvents(companyId)).toEqual(events);

      cacheService.invalidateCompanyCache(companyId);

      expect(cacheService.getCachedFeed(companyId)).toBeNull();
      expect(cacheService.getCachedPublicEvents(companyId)).toBeNull();
    });

    it('should invalidate all cache', () => {
      cacheService.setCachedFeed('company1', 'feed1');
      cacheService.setCachedFeed('company2', 'feed2');
      cacheService.setCachedPublicEvents('company1', [mockEvents[0]]);

      cacheService.invalidateAllCache();

      expect(cacheService.getCachedFeed('company1')).toBeNull();
      expect(cacheService.getCachedFeed('company2')).toBeNull();
      expect(cacheService.getCachedPublicEvents('company1')).toBeNull();
    });

    it('should enforce max entries limit', () => {
      // Add more entries than the limit (5)
      for (let i = 0; i < 10; i++) {
        cacheService.setCachedFeed(`company${i}`, `feed${i}`);
      }

      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(5);
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', () => {
      const companyId = 'test-company';
      const feed = 'test-feed';

      // Initial stats
      let stats = cacheService.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);

      // Cache miss
      cacheService.getCachedFeed(companyId);
      stats = cacheService.getStats();
      expect(stats.totalMisses).toBe(1);

      // Cache set and hit
      cacheService.setCachedFeed(companyId, feed);
      cacheService.getCachedFeed(companyId);
      stats = cacheService.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);

      // Calculate hit rate
      expect(stats.hitRate).toBe(50);
      expect(stats.missRate).toBe(50);
    });

    it('should reset statistics', () => {
      cacheService.getCachedFeed('test'); // miss
      cacheService.setCachedFeed('test', 'feed');
      cacheService.getCachedFeed('test'); // hit

      let stats = cacheService.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.totalMisses).toBe(1);

      cacheService.resetStats();

      stats = cacheService.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });

    it('should provide cache info', () => {
      cacheService.setCachedFeed('company1', 'feed1');
      cacheService.setCachedPublicEvents('company1', [mockEvents[0]]);

      const info = cacheService.getCacheInfo();
      expect(info.feedCacheSize).toBe(1);
      expect(info.publicViewCacheSize).toBe(1);
      expect(info.feedTTL).toBe(1000);
      expect(info.publicViewTTL).toBe(500);
    });
  });

  describe('Performance', () => {
    it('should handle rapid cache operations', () => {
      const startTime = Date.now();
      
      // Perform many cache operations
      for (let i = 0; i < 1000; i++) {
        cacheService.setCachedFeed(`company${i % 10}`, `feed${i}`);
        cacheService.getCachedFeed(`company${i % 10}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should estimate memory usage', () => {
      cacheService.setCachedFeed('company1', 'a'.repeat(1000)); // 1KB string
      cacheService.setCachedPublicEvents('company1', [mockEvents[0]]);

      const stats = cacheService.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Cache Warm-up', () => {
    it('should warm up cache for a company', async () => {
      const companyId = 'test-company';
      const mockFeed = 'test-feed';
      const testEvents = [mockEvents[0]];

      const feedGenerator = vi.fn().mockResolvedValue(mockFeed);
      const eventsGenerator = vi.fn().mockResolvedValue(testEvents);

      await cacheService.warmUpCache(companyId, feedGenerator, eventsGenerator);

      expect(feedGenerator).toHaveBeenCalled();
      expect(eventsGenerator).toHaveBeenCalled();
      expect(cacheService.getCachedFeed(companyId)).toBe(mockFeed);
      expect(cacheService.getCachedPublicEvents(companyId)).toEqual(testEvents);
    });

    it('should handle warm-up errors gracefully', async () => {
      const companyId = 'test-company';
      const feedGenerator = vi.fn().mockRejectedValue(new Error('Feed generation failed'));
      const eventsGenerator = vi.fn().mockResolvedValue([]);

      // Should not throw
      await expect(cacheService.warmUpCache(companyId, feedGenerator, eventsGenerator))
        .resolves.not.toThrow();

      expect(cacheService.getCachedFeed(companyId)).toBeNull();
    });

    it('should preload cache for multiple companies', async () => {
      const companyIds = ['company1', 'company2', 'company3'];
      const feedGenerator = vi.fn().mockImplementation((id) => Promise.resolve(`feed-${id}`));
      const eventsGenerator = vi.fn().mockImplementation((id) => Promise.resolve([mockEvents[0]]));

      await cacheService.preloadCache(companyIds, feedGenerator, eventsGenerator);

      expect(feedGenerator).toHaveBeenCalledTimes(3);
      expect(eventsGenerator).toHaveBeenCalledTimes(3);

      companyIds.forEach(id => {
        expect(cacheService.getCachedFeed(id)).toBe(`feed-${id}`);
        expect(cacheService.getCachedPublicEvents(id)).toEqual([mockEvents[0]]);
      });
    });
  });
});

const mockEvents = [
  {
    id: '1',
    companyId: 'test-company',
    title: 'Test Event 1',
    description: 'Description 1',
    startDateTime: new Date('2025-01-01T10:00:00Z'),
    endDateTime: new Date('2025-01-01T11:00:00Z'),
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];