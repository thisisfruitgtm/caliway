import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../../services/AuthenticationService';
import { UserRepository } from '../../repositories/UserRepository';
import { AuthErrorCode, AuthErrorContext } from '../../types/errors';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: import('../../models').User;
    }
  }
}

export interface AuthMiddlewareOptions {
  redirectUrl?: string;
  returnJson?: boolean;
  requireFreshToken?: boolean; // Require token to be less than 1 hour old
}

export interface AuthErrorResponse {
  success: false;
  error: {
    code: AuthErrorCode;
    message: string;
    timestamp: string;
    redirectUrl?: string;
  };
}

export class AuthMiddleware {
  private authService: AuthenticationService;

  constructor() {
    const userRepository = new UserRepository();
    this.authService = new AuthenticationService(userRepository);
  }

  /**
   * Middleware to protect routes requiring authentication
   */
  requireAuth(options: AuthMiddlewareOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Create error context for logging
        const context: AuthErrorContext = {
          ipAddress: this.getClientIP(req),
          userAgent: req.get('User-Agent')
        };

        // Extract token from Authorization header or cookies
        const token = this.extractToken(req);
        
        if (!token) {
          return this.handleAuthError(
            res, 
            AuthErrorCode.TOKEN_INVALID,
            'No authentication token provided',
            options,
            context
          );
        }

        // Validate session
        const validation = await this.authService.validateSession(token);
        
        if (!validation.valid) {
          // Handle specific error codes
          const errorCode = validation.errorCode || AuthErrorCode.TOKEN_INVALID;
          
          // For expired tokens, clear the cookie
          if (errorCode === AuthErrorCode.TOKEN_EXPIRED) {
            res.clearCookie('authToken');
          }

          return this.handleAuthError(
            res,
            errorCode,
            validation.error || 'Invalid session',
            options,
            context
          );
        }

        // Check for fresh token requirement
        if (options.requireFreshToken) {
          const tokenAge = this.getTokenAge(token);
          if (tokenAge > 3600000) { // 1 hour in milliseconds
            return this.handleAuthError(
              res,
              AuthErrorCode.SESSION_TIMEOUT,
              'Session requires fresh authentication',
              options,
              context
            );
          }
        }

        // Attach user to request
        req.user = validation.user;
        
        // Add security headers
        res.set({
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': '1; mode=block'
        });

        next();
      } catch (error) {
        console.error('Auth middleware error:', error);
        return this.handleAuthError(
          res,
          AuthErrorCode.SERVICE_UNAVAILABLE,
          'Authentication service error',
          options,
          {
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent')
          }
        );
      }
    };
  }

  /**
   * Middleware to redirect authenticated users away from login pages
   */
  redirectIfAuthenticated(redirectUrl: string = '/dashboard') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const token = this.extractToken(req);
        
        if (token) {
          const validation = await this.authService.validateSession(token);
          
          if (validation.valid) {
            return res.redirect(redirectUrl);
          }
        }
        
        next();
      } catch (error) {
        // If validation fails, continue to login page
        next();
      }
    };
  }

  /**
   * Extract token from request headers or cookies
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookies
    if (req.cookies && req.cookies.authToken) {
      return req.cookies.authToken;
    }

    return null;
  }

  /**
   * Handle authentication errors with proper status codes and messages
   */
  private handleAuthError(
    res: Response, 
    errorCode: AuthErrorCode,
    message: string, 
    options: AuthMiddlewareOptions,
    context?: AuthErrorContext
  ) {
    const statusCode = this.getStatusCodeForError(errorCode);
    const redirectUrl = options.redirectUrl || '/login';

    // Log the error for security monitoring
    console.warn('Authentication error:', {
      errorCode,
      message,
      statusCode,
      context,
      timestamp: new Date().toISOString()
    });

    if (options.returnJson) {
      const errorResponse: AuthErrorResponse = {
        success: false,
        error: {
          code: errorCode,
          message,
          timestamp: new Date().toISOString(),
          redirectUrl: errorCode === AuthErrorCode.TOKEN_EXPIRED || 
                      errorCode === AuthErrorCode.TOKEN_INVALID ||
                      errorCode === AuthErrorCode.TOKEN_BLACKLISTED ? redirectUrl : undefined
        }
      };

      return res.status(statusCode).json(errorResponse);
    }

    // For web requests, redirect to login with error context
    const errorParam = encodeURIComponent(message);
    const redirectWithError = `${redirectUrl}?error=${errorParam}&code=${errorCode}`;
    
    return res.redirect(redirectWithError);
  }

  /**
   * Get appropriate HTTP status code for authentication error
   */
  private getStatusCodeForError(errorCode: AuthErrorCode): number {
    switch (errorCode) {
      case AuthErrorCode.INVALID_CREDENTIALS:
      case AuthErrorCode.TOKEN_EXPIRED:
      case AuthErrorCode.TOKEN_INVALID:
      case AuthErrorCode.TOKEN_BLACKLISTED:
        return 401;
      case AuthErrorCode.UNAUTHORIZED_ACCESS:
        return 403;
      case AuthErrorCode.MISSING_CREDENTIALS:
        return 400;
      case AuthErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case AuthErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 401;
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Get token age in milliseconds
   */
  private getTokenAge(token: string): number {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.iat) {
        return Date.now() - (decoded.iat * 1000);
      }
    } catch (error) {
      console.warn('Failed to decode token for age calculation:', error);
    }
    return 0;
  }
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();