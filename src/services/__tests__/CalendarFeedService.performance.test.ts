import { CalendarFeedService } from '../CalendarFeedService';
import { EventRepository } from '../../repositories/EventRepository';
import { Event } from '../../models';
import { cacheService } from '../CacheService';

// Mock the EventRepository
jest.mock('../../repositories/EventRepository');

describe('CalendarFeedService Performance Tests', () => {
  let feedService: CalendarFeedService;
  let mockEventRepository: jest.Mocked<EventRepository>;

  const mockEvents: Event[] = Array.from({ length: 100 }, (_, i) => ({
    id: `event-${i}`,
    companyId: 'test-company',
    title: `Event ${i}`,
    description: `Description for event ${i}`,
    startDateTime: new Date(Date.now() + i * 24 * 60 * 60 * 1000), // i days from now
    endDateTime: new Date(Date.now() + i * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), // 1 hour later
    location: `Location ${i}`,
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  beforeEach(() => {
    mockEventRepository = new EventRepository() as jest.Mocked<EventRepository>;
    feedService = new CalendarFeedService(mockEventRepository);
    
    // Clear cache before each test
    cacheService.invalidateAllCache();
    cacheService.resetStats();
    
    // Setup mock to return events
    mockEventRepository.findPublicByCompanyId.mockResolvedValue(mockEvents);
  });

  afterEach(() => {
    cacheService.invalidateAllCache();
  });

  describe('Feed Generation Performance', () => {
    it('should generate feed within acceptable time limits', async () => {
      const companyId = 'test-company';
      const startTime = Date.now();
      
      const feed = await feedService.generateICalFeed(companyId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('END:VCALENDAR');
      
      // Should generate feed within 500ms for 100 events
      expect(duration).toBeLessThan(500);
    });

    it('should demonstrate significant performance improvement with caching', async () => {
      const companyId = 'test-company';
      
      // First call (cache miss) - measure time
      const startTime1 = Date.now();
      const feed1 = await feedService.generateICalFeed(companyId);
      const endTime1 = Date.now();
      const firstCallDuration = endTime1 - startTime1;
      
      // Second call (cache hit) - measure time
      const startTime2 = Date.now();
      const feed2 = await feedService.generateICalFeed(companyId);
      const endTime2 = Date.now();
      const secondCallDuration = endTime2 - startTime2;
      
      expect(feed1).toBe(feed2);
      expect(mockEventRepository.findPublicByCompanyId).toHaveBeenCalledTimes(1);
      
      // Cache hit should be significantly faster (at least 50% faster)
      expect(secondCallDuration).toBeLessThan(firstCallDuration * 0.5);
      
      // Cache hit should be very fast (under 10ms)
      expect(secondCallDuration).toBeLessThan(10);
    });

    it('should handle concurrent requests efficiently', async () => {
      const companyId = 'test-company';
      const concurrentRequests = 10;
      
      const startTime = Date.now();
      
      // Make multiple concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        feedService.generateICalFeed(companyId)
      );
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      // All results should be identical
      results.forEach(feed => {
        expect(feed).toBe(results[0]);
      });
      
      // Should only call repository once due to caching
      expect(mockEventRepository.findPublicByCompanyId).toHaveBeenCalledTimes(1);
      
      // Total time should be reasonable (under 1 second for 10 concurrent requests)
      expect(totalDuration).toBeLessThan(1000);
    });

    it('should handle large number of events efficiently', async () => {
      const largeEventSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `event-${i}`,
        companyId: 'large-company',
        title: `Large Event ${i}`,
        description: `Description for large event ${i}`.repeat(10), // Longer descriptions
        startDateTime: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
        endDateTime: new Date(Date.now() + i * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        location: `Location ${i}`,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      mockEventRepository.findPublicByCompanyId.mockResolvedValue(largeEventSet);
      
      const companyId = 'large-company';
      const startTime = Date.now();
      
      const feed = await feedService.generateICalFeed(companyId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('END:VCALENDAR');
      
      // Should handle 1000 events within 2 seconds
      expect(duration).toBeLessThan(2000);
      
      // Verify feed contains events (should be truncated to maxEventsPerFeed)
      const eventCount = (feed.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventCount).toBeLessThanOrEqual(1000);
    });
  });

  describe('Public Events Performance', () => {
    it('should retrieve public events efficiently with caching', async () => {
      const companyId = 'test-company';
      
      // First call (cache miss)
      const startTime1 = Date.now();
      const events1 = await feedService.getPublicEvents(companyId);
      const endTime1 = Date.now();
      const firstCallDuration = endTime1 - startTime1;
      
      // Second call (cache hit)
      const startTime2 = Date.now();
      const events2 = await feedService.getPublicEvents(companyId);
      const endTime2 = Date.now();
      const secondCallDuration = endTime2 - startTime2;
      
      expect(events1).toEqual(events2);
      expect(events1).toHaveLength(100);
      expect(mockEventRepository.findPublicByCompanyId).toHaveBeenCalledTimes(1);
      
      // Cache hit should be much faster
      expect(secondCallDuration).toBeLessThan(firstCallDuration * 0.1);
      expect(secondCallDuration).toBeLessThan(5);
    });

    it('should sort events by start date efficiently', async () => {
      // Create unsorted events
      const unsortedEvents = [...mockEvents].reverse();
      mockEventRepository.findPublicByCompanyId.mockResolvedValue(unsortedEvents);
      
      const companyId = 'test-company';
      const startTime = Date.now();
      
      const events = await feedService.getPublicEvents(companyId);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify events are sorted
      for (let i = 1; i < events.length; i++) {
        expect(events[i].startDateTime.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].startDateTime.getTime()
        );
      }
      
      // Sorting should be fast
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should track cache performance metrics', async () => {
      const companyId = 'test-company';
      
      // Initial stats
      let stats = cacheService.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      
      // Generate some cache activity
      await feedService.generateICalFeed(companyId); // miss
      await feedService.generateICalFeed(companyId); // hit
      await feedService.getPublicEvents(companyId); // hit (already cached from feed generation)
      
      stats = cacheService.getStats();
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeGreaterThan(0);
    });

    it('should provide cache statistics from feed service', () => {
      const stats = feedService.getCacheStats();
      
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('missRate');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('totalMisses');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should warm up cache effectively', async () => {
      const companyId = 'test-company';
      
      // Warm up cache
      await feedService.warmUpCache(companyId);
      
      // Subsequent calls should be cache hits
      const startTime = Date.now();
      await feedService.generateICalFeed(companyId);
      await feedService.getPublicEvents(companyId);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Should be very fast due to cache warm-up
      expect(duration).toBeLessThan(20);
    });
  });

  describe('Memory Usage and Limits', () => {
    it('should handle memory efficiently with large feeds', async () => {
      const companyId = 'memory-test-company';
      
      // Generate feed and check memory usage
      await feedService.generateICalFeed(companyId);
      
      const stats = cacheService.getStats();
      const memoryUsage = stats.memoryUsage;
      
      // Memory usage should be reasonable (less than 10MB for test data)
      expect(memoryUsage).toBeLessThan(10 * 1024 * 1024);
      expect(memoryUsage).toBeGreaterThan(0);
    });

    it('should respect cache size limits', async () => {
      // Generate feeds for many companies to test cache limits
      const companies = Array.from({ length: 20 }, (_, i) => `company-${i}`);
      
      for (const companyId of companies) {
        mockEventRepository.findPublicByCompanyId.mockResolvedValue(
          mockEvents.map(event => ({ ...event, companyId }))
        );
        await feedService.generateICalFeed(companyId);
      }
      
      const info = cacheService.getCacheInfo();
      
      // Cache should not grow indefinitely
      expect(info.feedCacheSize + info.publicViewCacheSize).toBeLessThanOrEqual(1000);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle repository errors efficiently', async () => {
      const companyId = 'error-company';
      mockEventRepository.findPublicByCompanyId.mockRejectedValue(new Error('Database error'));
      
      const startTime = Date.now();
      
      await expect(feedService.generateICalFeed(companyId)).rejects.toThrow();
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Error handling should be fast
      expect(duration).toBeLessThan(100);
    });

    it('should not cache failed operations', async () => {
      const companyId = 'error-company';
      mockEventRepository.findPublicByCompanyId.mockRejectedValue(new Error('Database error'));
      
      // First call should fail
      await expect(feedService.generateICalFeed(companyId)).rejects.toThrow();
      
      // Fix the mock
      mockEventRepository.findPublicByCompanyId.mockResolvedValue(mockEvents);
      
      // Second call should succeed and hit the database
      const feed = await feedService.generateICalFeed(companyId);
      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(mockEventRepository.findPublicByCompanyId).toHaveBeenCalledTimes(2);
    });
  });
});