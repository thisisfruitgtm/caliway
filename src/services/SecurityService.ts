export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export interface SecurityConfig {
  maxStringLength: number;
  allowedHtmlTags: string[];
  maxArrayLength: number;
  maxObjectDepth: number;
}

export class SecurityService {
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = {
      maxStringLength: 10000,
      allowedHtmlTags: [], // No HTML tags allowed by default
      maxArrayLength: 1000,
      maxObjectDepth: 10,
      ...config
    };
  }

  /**
   * Sanitize string input to prevent XSS attacks
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    // Remove HTML tags (basic XSS prevention)
    let sanitized = input.replace(/<[^>]*>/g, '');
    
    // Escape special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // Limit length
    if (sanitized.length > this.config.maxStringLength) {
      sanitized = sanitized.substring(0, this.config.maxStringLength);
    }

    return sanitized.trim();
  }

  /**
   * Validate and sanitize company ID
   */
  validateCompanyId(companyId: any): ValidationResult {
    const errors: string[] = [];

    if (!companyId) {
      errors.push('Company ID is required');
      return { isValid: false, errors };
    }

    if (typeof companyId !== 'string') {
      errors.push('Company ID must be a string');
      return { isValid: false, errors };
    }

    // Check for valid UUID format or alphanumeric
    const sanitized = this.sanitizeString(companyId);
    if (!/^[a-zA-Z0-9\-_]{1,50}$/.test(sanitized)) {
      errors.push('Company ID contains invalid characters');
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedValue: sanitized
    };
  }

  /**
   * Validate and sanitize share URL
   */
  validateShareUrl(shareUrl: any): ValidationResult {
    const errors: string[] = [];

    if (!shareUrl) {
      errors.push('Share URL is required');
      return { isValid: false, errors };
    }

    if (typeof shareUrl !== 'string') {
      errors.push('Share URL must be a string');
      return { isValid: false, errors };
    }

    const sanitized = this.sanitizeString(shareUrl);
    if (!/^[a-zA-Z0-9\-_]{1,100}$/.test(sanitized)) {
      errors.push('Share URL contains invalid characters');
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedValue: sanitized
    };
  }

  /**
   * Validate event data for public exposure
   */
  validatePublicEventData(eventData: any): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    if (!eventData || typeof eventData !== 'object') {
      errors.push('Invalid event data');
      return { isValid: false, errors };
    }

    // Validate title
    if (eventData.title) {
      sanitized.title = this.sanitizeString(eventData.title);
      if (sanitized.title.length === 0) {
        errors.push('Event title cannot be empty after sanitization');
      }
    }

    // Validate description
    if (eventData.description) {
      sanitized.description = this.sanitizeString(eventData.description);
    }

    // Validate location
    if (eventData.location) {
      sanitized.location = this.sanitizeString(eventData.location);
    }

    // Validate dates
    if (eventData.startDateTime) {
      if (eventData.startDateTime instanceof Date) {
        sanitized.startDateTime = eventData.startDateTime;
      } else {
        const date = new Date(eventData.startDateTime);
        if (isNaN(date.getTime())) {
          errors.push('Invalid start date');
        } else {
          sanitized.startDateTime = date;
        }
      }
    }

    if (eventData.endDateTime) {
      if (eventData.endDateTime instanceof Date) {
        sanitized.endDateTime = eventData.endDateTime;
      } else {
        const date = new Date(eventData.endDateTime);
        if (isNaN(date.getTime())) {
          errors.push('Invalid end date');
        } else {
          sanitized.endDateTime = date;
        }
      }
    }

    // Ensure no sensitive data is exposed
    const allowedFields = ['id', 'title', 'description', 'startDateTime', 'endDateTime', 'location', 'isPublic'];
    for (const key of Object.keys(eventData)) {
      if (!allowedFields.includes(key)) {
        // Don't include sensitive fields in sanitized output
        continue;
      }
      if (sanitized[key] === undefined && eventData[key] !== undefined) {
        sanitized[key] = eventData[key];
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    };
  }

  /**
   * Validate request headers for security
   */
  validateRequestHeaders(headers: any): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    if (!headers || typeof headers !== 'object') {
      return { isValid: true, errors: [], sanitizedValue: {} };
    }

    // Check User-Agent
    if (headers['user-agent']) {
      const userAgent = this.sanitizeString(headers['user-agent']);
      if (userAgent.length > 500) {
        errors.push('User-Agent header too long');
      } else {
        sanitized.userAgent = userAgent;
      }
    }

    // Check Referer
    if (headers.referer || headers.referrer) {
      const referer = this.sanitizeString(headers.referer || headers.referrer);
      if (referer.length > 1000) {
        errors.push('Referer header too long');
      } else {
        sanitized.referer = referer;
      }
    }

    // Check for suspicious headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-cluster-client-ip'];
    for (const header of suspiciousHeaders) {
      if (headers[header]) {
        sanitized[header] = this.sanitizeString(headers[header]);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    };
  }

  /**
   * Check for potential SQL injection patterns
   */
  detectSqlInjection(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|\/\*|\*\/)/,
      /(\b(OR|AND)\b.*=.*)/i,
      /('|(\\x27)|(\\x2D\\x2D))/,
      /(;|\x00)/
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for potential XSS patterns
   */
  detectXss(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Validate and sanitize query parameters
   */
  validateQueryParams(params: any): ValidationResult {
    const errors: string[] = [];
    const sanitized: any = {};

    if (!params || typeof params !== 'object') {
      return { isValid: true, errors: [], sanitizedValue: {} };
    }

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Check for injection attacks
        if (this.detectSqlInjection(value)) {
          errors.push(`Potential SQL injection detected in parameter: ${key}`);
          continue;
        }

        if (this.detectXss(value)) {
          errors.push(`Potential XSS detected in parameter: ${key}`);
          continue;
        }

        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else {
        // Skip complex objects/arrays for security
        continue;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: sanitized
    };
  }

  /**
   * Generate secure request identifier for rate limiting
   */
  generateRequestIdentifier(req: any): string {
    // Use IP address as primary identifier
    const ip = req.ip || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               'unknown';

    // Sanitize IP address
    const sanitizedIp = this.sanitizeString(ip);
    
    // For authenticated requests, include user/company info
    if (req.user?.companyId) {
      return `${sanitizedIp}:${req.user.companyId}`;
    }

    return sanitizedIp;
  }

  /**
   * Check if request is from a suspicious source
   */
  isSuspiciousRequest(req: any): { suspicious: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check User-Agent
    const userAgent = req.headers['user-agent'];
    if (!userAgent) {
      reasons.push('Missing User-Agent header');
    } else if (userAgent.length < 10) {
      reasons.push('Suspicious User-Agent header');
    } else if (/bot|crawler|spider|scraper/i.test(userAgent)) {
      // Check for common bot patterns only if user agent is long enough
      reasons.push('Bot/crawler detected');
    }

    // Check request frequency (basic check)
    const identifier = this.generateRequestIdentifier(req);
    // This would need to be implemented with actual rate limiting data

    return {
      suspicious: reasons.length > 0,
      reasons
    };
  }
}

// Global security service instance
export const securityService = new SecurityService();