import { Request, Response, NextFunction } from 'express';
import { AuthenticationService } from '../../services/AuthenticationService';
import { UserRepository } from '../../repositories/UserRepository';

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
        // Extract token from Authorization header or cookies
        const token = this.extractToken(req);
        
        if (!token) {
          return this.handleUnauthorized(res, 'No authentication token provided', options);
        }

        // Validate session
        const validation = await this.authService.validateSession(token);
        
        if (!validation.valid) {
          return this.handleUnauthorized(res, validation.error || 'Invalid session', options);
        }

        // Attach user to request
        req.user = validation.user;
        next();
      } catch (error) {
        console.error('Auth middleware error:', error);
        return this.handleUnauthorized(res, 'Authentication failed', options);
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
   * Handle unauthorized access
   */
  private handleUnauthorized(res: Response, message: string, options: AuthMiddlewareOptions) {
    if (options.returnJson) {
      return res.status(401).json({
        success: false,
        error: message
      });
    }

    // Redirect to login page
    const redirectUrl = options.redirectUrl || '/login';
    return res.redirect(redirectUrl);
  }
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();