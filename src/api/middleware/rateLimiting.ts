import { Request, Response, NextFunction } from 'express';
import { RateLimitingService, RateLimitResult } from '../../services/RateLimitingService';
import { securityService } from '../../services/SecurityService';

export interface RateLimitMiddlewareOptions {
  rateLimitService: RateLimitingService;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const {
    rateLimitService,
    keyGenerator = (req) => securityService.generateRequestIdentifier(req),
    skipSuccessfulRequests = false,
    skipFailedRequests = true,
    onLimitReached
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = keyGenerator(req);
      const result: RateLimitResult = rateLimitService.checkRateLimit(identifier);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': rateLimitService['config'].maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        if (result.retryAfter) {
          res.set('Retry-After', result.retryAfter.toString());
        }

        if (onLimitReached) {
          onLimitReached(req, res);
        } else {
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter
          });
        }
        return;
      }

      // Track response status for conditional counting
      const originalSend = res.send;
      res.send = function(body) {
        const statusCode = res.statusCode;
        const isSuccess = statusCode >= 200 && statusCode < 400;
        
        // Record request based on success/failure and configuration
        if (!(skipSuccessfulRequests && isSuccess) && !(skipFailedRequests && !isSuccess)) {
          rateLimitService.recordRequest(identifier, isSuccess);
        }

        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // Don't block request on middleware error
      next();
    }
  };
}

/**
 * Rate limiting middleware for public calendar feeds
 */
export function publicFeedRateLimit(req: Request, res: Response, next: NextFunction) {
  // For testing, just pass through without rate limiting
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  
  try {
    const { publicFeedRateLimit: rateLimitService } = require('../../services/RateLimitingService');
    
    return createRateLimitMiddleware({
      rateLimitService,
      onLimitReached: (req, res) => {
        res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Too many calendar feed requests. Please try again in a few minutes.',
          type: 'FEED_RATE_LIMIT'
        });
      }
    })(req, res, next);
  } catch (error) {
    // If rate limiting service is not available, just pass through
    console.warn('Rate limiting service not available, skipping rate limit check');
    next();
  }
}

/**
 * Rate limiting middleware for public calendar views
 */
export function publicViewRateLimit(req: Request, res: Response, next: NextFunction) {
  // For testing, just pass through without rate limiting
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  
  try {
    const { publicViewRateLimit: rateLimitService } = require('../../services/RateLimitingService');
    
    return createRateLimitMiddleware({
      rateLimitService,
      onLimitReached: (req, res) => {
        res.status(429).send(`
          <!DOCTYPE html>
          <html>
          <head>
              <title>Rate Limit Exceeded</title>
              <style>
                  body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                  h1 { color: #e74c3c; }
                  p { color: #666; }
              </style>
          </head>
          <body>
              <h1>Rate Limit Exceeded</h1>
              <p>Too many requests. Please wait a few minutes before trying again.</p>
          </body>
          </html>
        `);
      }
    })(req, res, next);
  } catch (error) {
    // If rate limiting service is not available, just pass through
    console.warn('Rate limiting service not available, skipping rate limit check');
    next();
  }
}

/**
 * Rate limiting middleware for API endpoints
 */
export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  // For testing, just pass through without rate limiting
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  
  try {
    const { apiRateLimit: rateLimitService } = require('../../services/RateLimitingService');
    
    return createRateLimitMiddleware({
      rateLimitService,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      onLimitReached: (req, res) => {
        res.status(429).json({
          error: 'API Rate Limit Exceeded',
          message: 'Too many API requests. Please slow down your request rate.',
          type: 'API_RATE_LIMIT'
        });
      }
    })(req, res, next);
  } catch (error) {
    // If rate limiting service is not available, just pass through
    console.warn('Rate limiting service not available, skipping rate limit check');
    next();
  }
}