import { Request, Response, NextFunction } from 'express';
import { securityService } from '../../services/SecurityService';

/**
 * Security middleware for input validation and sanitization
 */
export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Validate and sanitize query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      const queryValidation = securityService.validateQueryParams(req.query);
      if (!queryValidation.isValid) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'Request contains invalid or potentially malicious parameters',
          details: queryValidation.errors
        });
      }
      req.query = queryValidation.sanitizedValue;
    }

    // Validate request headers
    const headerValidation = securityService.validateRequestHeaders(req.headers);
    if (!headerValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid Headers',
        message: 'Request headers contain invalid data',
        details: headerValidation.errors
      });
    }

    // Check for suspicious requests
    const suspiciousCheck = securityService.isSuspiciousRequest(req);
    if (suspiciousCheck.suspicious) {
      console.warn('Suspicious request detected:', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        reasons: suspiciousCheck.reasons,
        url: req.url
      });
      
      // For now, just log suspicious requests, don't block them
      // In production, you might want to implement more strict blocking
    }

    next();
  } catch (error) {
    console.error('Security middleware error:', error);
    // Don't block request on middleware error, but log it
    next();
  }
}

/**
 * Middleware to validate company ID parameter
 */
export function validateCompanyId(req: Request, res: Response, next: NextFunction) {
  const companyId = req.params.companyId || req.body.companyId || req.query.companyId;
  
  if (!companyId) {
    return res.status(400).json({
      error: 'Missing Company ID',
      message: 'Company ID is required'
    });
  }

  const validation = securityService.validateCompanyId(companyId);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Invalid Company ID',
      message: 'Company ID format is invalid',
      details: validation.errors
    });
  }

  // Store sanitized value
  req.params.companyId = validation.sanitizedValue;
  next();
}

/**
 * Middleware to validate share URL parameter
 */
export function validateShareUrl(req: Request, res: Response, next: NextFunction) {
  const shareUrl = req.params.shareUrl || req.body.shareUrl || req.query.shareUrl;
  
  if (!shareUrl) {
    return res.status(400).json({
      error: 'Missing Share URL',
      message: 'Share URL is required'
    });
  }

  const validation = securityService.validateShareUrl(shareUrl);
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Invalid Share URL',
      message: 'Share URL format is invalid',
      details: validation.errors
    });
  }

  // Store sanitized value
  req.params.shareUrl = validation.sanitizedValue;
  next();
}

/**
 * Middleware to sanitize event data in request body
 */
export function sanitizeEventData(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    const validation = securityService.validatePublicEventData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid Event Data',
        message: 'Event data contains invalid or potentially malicious content',
        details: validation.errors
      });
    }
    
    // Replace body with sanitized data
    req.body = validation.sanitizedValue;
  }
  
  next();
}

/**
 * Middleware to add security headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });

  next();
}

/**
 * Middleware to prevent sensitive data exposure in public endpoints
 */
export function preventDataExposure(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(obj: any) {
    if (obj && typeof obj === 'object') {
      // Remove sensitive fields from response
      const sanitized = sanitizeResponseData(obj);
      return originalJson.call(this, sanitized);
    }
    return originalJson.call(this, obj);
  };

  next();
}

/**
 * Sanitize response data to prevent sensitive information exposure
 */
function sanitizeResponseData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponseData(item));
  }

  const sensitiveFields = [
    'password', 'passwordHash', 'secret', 'token', 'key', 'apiKey',
    'email', 'phone', 'ssn', 'creditCard', 'internalId', 'userId'
  ];

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    // Skip sensitive fields
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeResponseData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to log security events
 */
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log request details
  const requestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    ip: securityService.generateRequestIdentifier(req),
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer
  };

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime;
    const responseLog = {
      ...requestLog,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    };

    // Log security-relevant events
    if (res.statusCode === 429) {
      console.warn('Rate limit exceeded:', responseLog);
    } else if (res.statusCode >= 400) {
      console.warn('Security-related error:', responseLog);
    }

    return originalEnd.apply(this, args);
  };

  next();
}