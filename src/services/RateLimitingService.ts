export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimitingService {
  private config: RateLimitConfig;
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Clean up old entries
    this.cleanup(windowStart);
    
    const entry = this.requests.get(identifier);
    const resetTime = now + this.config.windowMs;
    
    if (!entry || entry.resetTime <= now) {
      // New window or expired entry
      this.requests.set(identifier, { count: 0, resetTime });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime
      };
    }
    
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      };
    }
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count - 1,
      resetTime: entry.resetTime
    };
  }

  recordRequest(identifier: string, isSuccess: boolean): void {
    const entry = this.requests.get(identifier);
    if (entry) {
      entry.count++;
    }
  }

  private cleanup(windowStart: number): void {
    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetTime <= windowStart) {
        this.requests.delete(key);
      }
    }
  }
}

// Export default instances for different use cases
export const publicFeedRateLimit = new RateLimitingService({
  maxRequests: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: false,
  skipFailedRequests: true
});

export const publicViewRateLimit = new RateLimitingService({
  maxRequests: 200,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: false,
  skipFailedRequests: true
});

export const apiRateLimit = new RateLimitingService({
  maxRequests: 1000,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});