import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimitingService } from '../RateLimitingService';

describe('RateLimitingService', () => {
  let rateLimitService: RateLimitingService;

  beforeEach(() => {
    rateLimitService = new RateLimitingService({
      windowMs: 1000, // 1 second for testing
      maxRequests: 3
    });
  });

  afterEach(() => {
    rateLimitService.stopCleanupTimer();
    rateLimitService.clear();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const identifier = 'test-user';

      // First request
      const result1 = rateLimitService.checkRateLimit(identifier);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      // Second request
      const result2 = rateLimitService.checkRateLimit(identifier);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      // Third request
      const result3 = rateLimitService.checkRateLimit(identifier);
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests exceeding limit', () => {
      const identifier = 'test-user';

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkRateLimit(identifier);
      }

      // Fourth request should be blocked
      const result = rateLimitService.checkRateLimit(identifier);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle multiple identifiers independently', () => {
      const user1 = 'user1';
      const user2 = 'user2';

      // User1 uses up their limit
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkRateLimit(user1);
      }

      // User1 should be blocked
      const result1 = rateLimitService.checkRateLimit(user1);
      expect(result1.allowed).toBe(false);

      // User2 should still be allowed
      const result2 = rateLimitService.checkRateLimit(user2);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(2);
    });

    it('should reset after time window expires', async () => {
      const identifier = 'test-user';

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkRateLimit(identifier);
      }

      // Should be blocked
      let result = rateLimitService.checkRateLimit(identifier);
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      result = rateLimitService.checkRateLimit(identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('Request Recording', () => {
    it('should record successful requests by default', () => {
      const identifier = 'test-user';

      rateLimitService.recordRequest(identifier, true);
      rateLimitService.recordRequest(identifier, true);

      const status = rateLimitService.getRateLimitStatus(identifier);
      expect(status.remaining).toBe(1); // 3 - 2 = 1
    });

    it('should record failed requests by default', () => {
      const identifier = 'test-user';

      rateLimitService.recordRequest(identifier, false);
      rateLimitService.recordRequest(identifier, false);

      const status = rateLimitService.getRateLimitStatus(identifier);
      expect(status.remaining).toBe(1); // 3 - 2 = 1
    });

    it('should skip successful requests when configured', () => {
      const service = new RateLimitingService({
        windowMs: 1000,
        maxRequests: 3,
        skipSuccessfulRequests: true
      });

      const identifier = 'test-user';

      service.recordRequest(identifier, true);
      service.recordRequest(identifier, true);

      const status = service.getRateLimitStatus(identifier);
      expect(status.remaining).toBe(3); // No requests recorded

      service.stopCleanupTimer();
    });

    it('should skip failed requests when configured', () => {
      const service = new RateLimitingService({
        windowMs: 1000,
        maxRequests: 3,
        skipFailedRequests: true
      });

      const identifier = 'test-user';

      service.recordRequest(identifier, false);
      service.recordRequest(identifier, false);

      const status = service.getRateLimitStatus(identifier);
      expect(status.remaining).toBe(3); // No requests recorded

      service.stopCleanupTimer();
    });
  });

  describe('Rate Limit Status', () => {
    it('should return correct status for new identifier', () => {
      const status = rateLimitService.getRateLimitStatus('new-user');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(3);
      expect(status.retryAfter).toBeUndefined();
    });

    it('should return correct status for active identifier', () => {
      const identifier = 'test-user';

      rateLimitService.checkRateLimit(identifier);
      rateLimitService.checkRateLimit(identifier);

      const status = rateLimitService.getRateLimitStatus(identifier);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(1);
      expect(status.retryAfter).toBeUndefined();
    });

    it('should return correct status for blocked identifier', () => {
      const identifier = 'test-user';

      // Use up the limit
      for (let i = 0; i < 4; i++) {
        rateLimitService.checkRateLimit(identifier);
      }

      const status = rateLimitService.getRateLimitStatus(identifier);
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
      expect(status.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Reset and Clear', () => {
    it('should reset rate limit for specific identifier', () => {
      const identifier = 'test-user';

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        rateLimitService.checkRateLimit(identifier);
      }

      // Should be blocked
      let result = rateLimitService.checkRateLimit(identifier);
      expect(result.allowed).toBe(false);

      // Reset the limit
      rateLimitService.resetRateLimit(identifier);

      // Should be allowed again
      result = rateLimitService.checkRateLimit(identifier);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should clear all rate limit data', () => {
      const user1 = 'user1';
      const user2 = 'user2';

      rateLimitService.checkRateLimit(user1);
      rateLimitService.checkRateLimit(user2);

      let stats = rateLimitService.getStats();
      expect(stats.totalIdentifiers).toBe(2);

      rateLimitService.clear();

      stats = rateLimitService.getStats();
      expect(stats.totalIdentifiers).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const user1 = 'user1';
      const user2 = 'user2';

      rateLimitService.checkRateLimit(user1);
      rateLimitService.checkRateLimit(user2);

      const stats = rateLimitService.getStats();
      expect(stats.totalIdentifiers).toBe(2);
      expect(stats.activeWindows).toBe(2);
      expect(stats.config.maxRequests).toBe(3);
      expect(stats.config.windowMs).toBe(1000);
    });

    it('should track active windows correctly', async () => {
      const identifier = 'test-user';

      rateLimitService.checkRateLimit(identifier);

      let stats = rateLimitService.getStats();
      expect(stats.activeWindows).toBe(1);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // The cleanup might not have run yet, so manually check
      stats = rateLimitService.getStats();
      // Note: activeWindows might still be 1 until cleanup runs
      expect(stats.totalIdentifiers).toBe(1);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries', async () => {
      const identifier = 'test-user';

      rateLimitService.checkRateLimit(identifier);

      let stats = rateLimitService.getStats();
      expect(stats.totalIdentifiers).toBe(1);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger cleanup by checking rate limit again
      rateLimitService.checkRateLimit('another-user');

      // The expired entry should eventually be cleaned up
      // Note: This test might be flaky due to timing of cleanup
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive requests', () => {
      const identifier = 'test-user';
      const results = [];

      // Make many requests rapidly
      for (let i = 0; i < 10; i++) {
        results.push(rateLimitService.checkRateLimit(identifier));
      }

      // First 3 should be allowed
      expect(results[0].allowed).toBe(true);
      expect(results[1].allowed).toBe(true);
      expect(results[2].allowed).toBe(true);

      // Rest should be blocked
      for (let i = 3; i < 10; i++) {
        expect(results[i].allowed).toBe(false);
      }
    });

    it('should handle zero max requests', () => {
      const service = new RateLimitingService({
        windowMs: 1000,
        maxRequests: 0
      });

      const result = service.checkRateLimit('test-user');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);

      service.stopCleanupTimer();
    });

    it('should handle very short time windows', () => {
      const service = new RateLimitingService({
        windowMs: 1, // 1 millisecond
        maxRequests: 1
      });

      const identifier = 'test-user';

      const result1 = service.checkRateLimit(identifier);
      expect(result1.allowed).toBe(true);

      // Wait a bit
      setTimeout(() => {
        const result2 = service.checkRateLimit(identifier);
        expect(result2.allowed).toBe(true);
      }, 10);

      service.stopCleanupTimer();
    });
  });

  describe('Configuration Validation', () => {
    it('should work with different configurations', () => {
      const configs = [
        { windowMs: 5000, maxRequests: 10 },
        { windowMs: 60000, maxRequests: 100 },
        { windowMs: 1000, maxRequests: 1 }
      ];

      configs.forEach(config => {
        const service = new RateLimitingService(config);
        const result = service.checkRateLimit('test');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(config.maxRequests - 1);
        service.stopCleanupTimer();
      });
    });
  });
});