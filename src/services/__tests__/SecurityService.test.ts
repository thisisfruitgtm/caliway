import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityService } from '../SecurityService';

describe('SecurityService', () => {
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = new SecurityService();
  });

  describe('String Sanitization', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const result = securityService.sanitizeString(input);
      expect(result).toBe('alert(&quot;xss&quot;)Hello World');
    });

    it('should escape special characters', () => {
      const input = 'Test & <script> "quotes" \'single\' /slash';
      const result = securityService.sanitizeString(input);
      expect(result).toBe('Test &amp;  &quot;quotes&quot; &#x27;single&#x27; &#x2F;slash');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(20000);
      const result = securityService.sanitizeString(longString);
      expect(result.length).toBe(10000);
    });

    it('should handle non-string input', () => {
      expect(securityService.sanitizeString(null as any)).toBe('');
      expect(securityService.sanitizeString(123 as any)).toBe('');
      expect(securityService.sanitizeString({} as any)).toBe('');
    });
  });

  describe('Company ID Validation', () => {
    it('should validate correct company ID', () => {
      const result = securityService.validateCompanyId('company-123');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('company-123');
    });

    it('should reject empty company ID', () => {
      const result = securityService.validateCompanyId('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Company ID is required');
    });

    it('should reject non-string company ID', () => {
      const result = securityService.validateCompanyId(123);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Company ID must be a string');
    });

    it('should reject company ID with invalid characters', () => {
      const result = securityService.validateCompanyId('company@#$%');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Company ID contains invalid characters');
    });

    it('should reject overly long company ID', () => {
      const longId = 'a'.repeat(100);
      const result = securityService.validateCompanyId(longId);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Company ID contains invalid characters');
    });
  });

  describe('Share URL Validation', () => {
    it('should validate correct share URL', () => {
      const result = securityService.validateShareUrl('abc123-def456');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('abc123-def456');
    });

    it('should reject empty share URL', () => {
      const result = securityService.validateShareUrl('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Share URL is required');
    });

    it('should reject share URL with invalid characters', () => {
      const result = securityService.validateShareUrl('url with spaces');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Share URL contains invalid characters');
    });
  });

  describe('Event Data Validation', () => {
    it('should validate and sanitize valid event data', () => {
      const eventData = {
        title: 'Test Event',
        description: 'Event description',
        location: 'Test Location',
        startDateTime: new Date('2025-01-01T10:00:00Z'),
        endDateTime: new Date('2025-01-01T11:00:00Z'),
        isPublic: true
      };

      const result = securityService.validatePublicEventData(eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue.title).toBe('Test Event');
    });

    it('should sanitize HTML in event data', () => {
      const eventData = {
        title: '<script>alert("xss")</script>Test Event',
        description: 'Description with <b>HTML</b> tags',
        location: 'Location & <script>',
        startDateTime: new Date('2025-01-01T10:00:00Z'),
        endDateTime: new Date('2025-01-01T11:00:00Z')
      };

      const result = securityService.validatePublicEventData(eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue.title).toBe('alert(&quot;xss&quot;)Test Event');
      expect(result.sanitizedValue.description).toBe('Description with HTML tags');
    });

    it('should reject invalid date formats', () => {
      const eventData = {
        title: 'Test Event',
        startDateTime: 'invalid-date',
        endDateTime: 'also-invalid'
      };

      const result = securityService.validatePublicEventData(eventData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid start date');
      expect(result.errors).toContain('Invalid end date');
    });

    it('should filter out sensitive fields', () => {
      const eventData = {
        title: 'Test Event',
        description: 'Event description',
        password: 'secret123',
        internalId: 'internal-123',
        userId: 'user-456',
        isPublic: true
      };

      const result = securityService.validatePublicEventData(eventData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue.password).toBeUndefined();
      expect(result.sanitizedValue.internalId).toBeUndefined();
      expect(result.sanitizedValue.userId).toBeUndefined();
      expect(result.sanitizedValue.title).toBe('Test Event');
    });
  });

  describe('SQL Injection Detection', () => {
    it('should detect SQL injection patterns', () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "1 OR 1=1",
        "UNION SELECT * FROM users",
        "admin'--",
        "1; DELETE FROM events"
      ];

      maliciousInputs.forEach(input => {
        expect(securityService.detectSqlInjection(input)).toBe(true);
      });
    });

    it('should not flag normal text as SQL injection', () => {
      const normalInputs = [
        'Hello World',
        'Event description with normal text',
        'Meeting at 2 PM',
        'Company event for all employees'
      ];

      normalInputs.forEach(input => {
        expect(securityService.detectSqlInjection(input)).toBe(false);
      });
    });
  });

  describe('XSS Detection', () => {
    it('should detect XSS patterns', () => {
      const xssInputs = [
        '<script>alert("xss")</script>',
        '<iframe src="malicious.com"></iframe>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        '<object data="malicious.swf"></object>'
      ];

      xssInputs.forEach(input => {
        expect(securityService.detectXss(input)).toBe(true);
      });
    });

    it('should not flag normal HTML as XSS', () => {
      const normalInputs = [
        'Hello World',
        'Event at 2:00 PM',
        'Meeting in Conference Room A',
        'Contact us at info@company.com'
      ];

      normalInputs.forEach(input => {
        expect(securityService.detectXss(input)).toBe(false);
      });
    });
  });

  describe('Query Parameter Validation', () => {
    it('should validate and sanitize safe query parameters', () => {
      const params = {
        page: '1',
        limit: '10',
        search: 'test query',
        sort: 'date'
      };

      const result = securityService.validateQueryParams(params);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue.page).toBe('1');
      expect(result.sanitizedValue.search).toBe('test query');
    });

    it('should detect SQL injection in query parameters', () => {
      const params = {
        search: "'; DROP TABLE users; --",
        filter: 'normal value'
      };

      const result = securityService.validateQueryParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('SQL injection'))).toBe(true);
    });

    it('should detect XSS in query parameters', () => {
      const params = {
        callback: '<script>alert("xss")</script>',
        name: 'normal name'
      };

      const result = securityService.validateQueryParams(params);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('XSS'))).toBe(true);
    });

    it('should handle non-string values', () => {
      const params = {
        page: 1,
        active: true,
        tags: ['tag1', 'tag2'], // Should be skipped
        config: { key: 'value' } // Should be skipped
      };

      const result = securityService.validateQueryParams(params);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue.page).toBe(1);
      expect(result.sanitizedValue.active).toBe(true);
      expect(result.sanitizedValue.tags).toBeUndefined();
      expect(result.sanitizedValue.config).toBeUndefined();
    });
  });

  describe('Request Identifier Generation', () => {
    it('should generate identifier from IP address', () => {
      const req = {
        ip: '192.168.1.1',
        headers: {}
      };

      const identifier = securityService.generateRequestIdentifier(req);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should include company ID for authenticated requests', () => {
      const req = {
        ip: '192.168.1.1',
        user: { companyId: 'company-123' },
        headers: {}
      };

      const identifier = securityService.generateRequestIdentifier(req);
      expect(identifier).toBe('192.168.1.1:company-123');
    });

    it('should handle missing IP address', () => {
      const req = {
        headers: {}
      };

      const identifier = securityService.generateRequestIdentifier(req);
      expect(identifier).toBe('unknown');
    });

    it('should extract IP from X-Forwarded-For header', () => {
      const req = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 192.168.1.1'
        }
      };

      const identifier = securityService.generateRequestIdentifier(req);
      expect(identifier).toBe('203.0.113.1');
    });
  });

  describe('Suspicious Request Detection', () => {
    it('should detect missing User-Agent', () => {
      const req = {
        headers: {}
      };

      const result = securityService.isSuspiciousRequest(req);
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('Missing User-Agent header');
    });

    it('should detect suspicious User-Agent', () => {
      const req = {
        headers: {
          'user-agent': 'bot'
        }
      };

      const result = securityService.isSuspiciousRequest(req);
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('Suspicious User-Agent header');
    });

    it('should detect bots and crawlers', () => {
      const req = {
        headers: {
          'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)'
        }
      };

      const result = securityService.isSuspiciousRequest(req);
      console.log('Bot detection result:', result);
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('Bot/crawler detected');
    });

    it('should not flag normal requests as suspicious', () => {
      const req = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const result = securityService.isSuspiciousRequest(req);
      expect(result.suspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });
});