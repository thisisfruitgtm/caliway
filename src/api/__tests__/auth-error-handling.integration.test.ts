import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { AuthRoutes } from '../routes/auth';
import { AuthMiddleware } from '../middleware/auth';
import { AuthErrorCode } from '../../types/errors';

// Mock the authentication service
vi.mock('../../services/AuthenticationService');
vi.mock('../../repositories/UserRepository');

describe('Authentication Error Handling Integration Tests', () => {
  let app: express.Application;
  let authRoutes: AuthRoutes;
  let authMiddleware: AuthMiddleware;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    authRoutes = new AuthRoutes();
    authMiddleware = new AuthMiddleware();
    
    app.use('/', authRoutes.getRouter());
    
    // Add a protected test route
    app.get('/protected', 
      authMiddleware.requireAuth({ returnJson: true }),
      (req, res) => {
        res.json({ success: true, message: 'Protected resource accessed' });
      }
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /login', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required',
        errorCode: AuthErrorCode.MISSING_CREDENTIALS
      });
    });

    it('should return 400 for missing username', async () => {
      const response = await request(app)
        .post('/login')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required',
        errorCode: AuthErrorCode.MISSING_CREDENTIALS
      });
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/login')
        .send({ username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required',
        errorCode: AuthErrorCode.MISSING_CREDENTIALS
      });
    });

    it('should return 401 for invalid credentials', async () => {
      // Mock the authentication service to return invalid credentials
      const mockAuthService = {
        authenticate: vi.fn().mockResolvedValue({
          success: false,
          error: 'Invalid username or password. Please check your credentials and try again.',
          errorCode: AuthErrorCode.INVALID_CREDENTIALS
        }),
        getFailedAttemptCount: vi.fn().mockReturnValue(1),
        getRateLimitTimeRemaining: vi.fn().mockReturnValue(0)
      };

      // Replace the auth service in the routes
      (authRoutes as any).authService = mockAuthService;

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid username or password. Please check your credentials and try again.',
        errorCode: AuthErrorCode.INVALID_CREDENTIALS
      });
    });

    it('should return 429 for rate limited requests', async () => {
      // Mock the authentication service to return rate limit error
      const mockAuthService = {
        authenticate: vi.fn().mockResolvedValue({
          success: false,
          error: 'Too many login attempts. Please wait before trying again.',
          errorCode: AuthErrorCode.RATE_LIMIT_EXCEEDED
        }),
        getFailedAttemptCount: vi.fn().mockReturnValue(5),
        getRateLimitTimeRemaining: vi.fn().mockReturnValue(900000) // 15 minutes
      };

      (authRoutes as any).authService = mockAuthService;

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        success: false,
        error: 'Too many login attempts. Please wait before trying again.',
        errorCode: AuthErrorCode.RATE_LIMIT_EXCEEDED,
        rateLimitInfo: {
          attemptsRemaining: 0,
          timeUntilReset: 900000
        }
      });
    });

    it('should include rate limit info when approaching limit', async () => {
      // Mock the authentication service to return invalid credentials with high attempt count
      const mockAuthService = {
        authenticate: vi.fn().mockResolvedValue({
          success: false,
          error: 'Invalid username or password. Please check your credentials and try again.',
          errorCode: AuthErrorCode.INVALID_CREDENTIALS
        }),
        getFailedAttemptCount: vi.fn().mockReturnValue(4), // 1 attempt remaining
        getRateLimitTimeRemaining: vi.fn().mockReturnValue(0)
      };

      (authRoutes as any).authService = mockAuthService;

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid username or password. Please check your credentials and try again.',
        errorCode: AuthErrorCode.INVALID_CREDENTIALS,
        rateLimitInfo: {
          attemptsRemaining: 1,
          timeUntilReset: 0
        }
      });
    });

    it('should return 503 for service unavailable', async () => {
      // Mock the authentication service to return service error
      const mockAuthService = {
        authenticate: vi.fn().mockResolvedValue({
          success: false,
          error: 'Authentication service is temporarily unavailable. Please try again later.',
          errorCode: AuthErrorCode.SERVICE_UNAVAILABLE
        }),
        getFailedAttemptCount: vi.fn().mockReturnValue(0),
        getRateLimitTimeRemaining: vi.fn().mockReturnValue(0)
      };

      (authRoutes as any).authService = mockAuthService;

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: 'Authentication service is temporarily unavailable. Please try again later.',
        errorCode: AuthErrorCode.SERVICE_UNAVAILABLE
      });
    });

    it('should set secure cookie on successful login', async () => {
      // Mock successful authentication
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        companyId: 'company-123'
      };

      const mockAuthService = {
        authenticate: vi.fn().mockResolvedValue({
          success: true,
          user: mockUser,
          token: 'mock-jwt-token'
        }),
        getFailedAttemptCount: vi.fn().mockReturnValue(0),
        getRateLimitTimeRemaining: vi.fn().mockReturnValue(0)
      };

      (authRoutes as any).authService = mockAuthService;

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        user: {
          id: 'user-123',
          username: 'testuser',
          companyId: 'company-123'
        }
      });

      // Check that cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toContain('authToken=mock-jwt-token');
      expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    });
  });

  describe('Protected Route Access', () => {
    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/protected');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: AuthErrorCode.TOKEN_INVALID,
          message: 'Invalid session. Please log in again.',
          timestamp: expect.any(String),
          redirectUrl: '/login'
        }
      });
    });

    it('should return 401 for expired token', async () => {
      // Mock the authentication service to return expired token error
      const mockAuthService = {
        validateSession: vi.fn().mockResolvedValue({
          valid: false,
          error: 'Your session has expired. Please log in again.',
          errorCode: AuthErrorCode.TOKEN_EXPIRED
        })
      };

      (authMiddleware as any).authService = mockAuthService;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: AuthErrorCode.TOKEN_EXPIRED,
          message: 'Your session has expired. Please log in again.',
          timestamp: expect.any(String),
          redirectUrl: '/login'
        }
      });
    });

    it('should return 401 for invalid token', async () => {
      // Mock the authentication service to return invalid token error
      const mockAuthService = {
        validateSession: vi.fn().mockResolvedValue({
          valid: false,
          error: 'Invalid session. Please log in again.',
          errorCode: AuthErrorCode.TOKEN_INVALID
        })
      };

      (authMiddleware as any).authService = mockAuthService;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: AuthErrorCode.TOKEN_INVALID,
          message: 'Invalid session. Please log in again.',
          timestamp: expect.any(String),
          redirectUrl: '/login'
        }
      });
    });

    it('should return 503 for service unavailable', async () => {
      // Mock the authentication service to return service error
      const mockAuthService = {
        validateSession: vi.fn().mockResolvedValue({
          valid: false,
          error: 'Authentication service is temporarily unavailable. Please try again later.',
          errorCode: AuthErrorCode.SERVICE_UNAVAILABLE
        })
      };

      (authMiddleware as any).authService = mockAuthService;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer some-token');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: AuthErrorCode.SERVICE_UNAVAILABLE,
          message: 'Authentication service is temporarily unavailable. Please try again later.',
          timestamp: expect.any(String)
        }
      });
    });

    it('should allow access with valid token', async () => {
      // Mock successful validation
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        companyId: 'company-123'
      };

      const mockAuthService = {
        validateSession: vi.fn().mockResolvedValue({
          valid: true,
          user: mockUser
        })
      };

      (authMiddleware as any).authService = mockAuthService;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Protected resource accessed'
      });

      // Check security headers are set
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Login Page Error Display', () => {
    it('should display error message from query parameters', async () => {
      const response = await request(app)
        .get('/login?error=Your%20session%20has%20expired&code=TOKEN_EXPIRED');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Your session has expired');
      expect(response.text).toContain('error-message');
    });

    it('should render login page without errors when no query params', async () => {
      const response = await request(app)
        .get('/login');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Company Calendar - Login');
      expect(response.text).not.toContain('error-message');
    });
  });

  describe('Session Timeout Handling', () => {
    it('should require fresh token for sensitive operations', async () => {
      // Mock token that's older than 1 hour
      const mockAuthService = {
        validateSession: vi.fn().mockResolvedValue({
          valid: true,
          user: { id: 'user-123', username: 'testuser', companyId: 'company-123' }
        })
      };

      // Mock getTokenAge to return old token
      vi.spyOn(authMiddleware as any, 'getTokenAge').mockReturnValue(3700000); // > 1 hour

      (authMiddleware as any).authService = mockAuthService;

      // Add a route that requires fresh token
      app.get('/sensitive', 
        authMiddleware.requireAuth({ returnJson: true, requireFreshToken: true }),
        (req, res) => {
          res.json({ success: true, message: 'Sensitive operation completed' });
        }
      );

      const response = await request(app)
        .get('/sensitive')
        .set('Authorization', 'Bearer old-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: AuthErrorCode.SESSION_TIMEOUT,
          message: 'Your session has timed out due to inactivity. Please log in again.',
          timestamp: expect.any(String),
          redirectUrl: '/login'
        }
      });
    });
  });
});