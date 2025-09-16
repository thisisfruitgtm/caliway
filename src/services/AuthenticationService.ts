import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { IUserRepository } from '../repositories/UserRepository';
import { AuthenticationError, AuthErrorCode, AuthErrorContext } from '../types/errors';

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  errorCode?: AuthErrorCode;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: User;
  error?: string;
  errorCode?: AuthErrorCode;
}

export interface IAuthenticationService {
  authenticate(username: string, password: string): Promise<AuthResult>;
  validateSession(sessionToken: string): Promise<SessionValidationResult>;
  logout(sessionToken: string): Promise<void>;
  hashPassword(password: string): Promise<string>;
  generateSessionToken(user: User): string;
}

export class AuthenticationService implements IAuthenticationService {
  private readonly saltRounds = 12;
  private readonly jwtSecret: string;
  private readonly tokenExpiration = '24h';
  private readonly blacklistedTokens = new Set<string>();
  private readonly loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes

  constructor(private userRepository: IUserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    if (this.jwtSecret === 'default-secret-key') {
      console.warn('Warning: Using default JWT secret. Set JWT_SECRET environment variable for production.');
    }
  }

  async authenticate(username: string, password: string, context?: AuthErrorContext): Promise<AuthResult> {
    try {
      // Input validation
      if (!username || !password) {
        const error = new AuthenticationError(
          AuthErrorCode.MISSING_CREDENTIALS,
          'Username and password are required',
          undefined,
          400
        );
        this.logAuthenticationAttempt(username, false, error.code, context);
        return {
          success: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Check for rate limiting
      if (this.isRateLimited(username)) {
        const error = new AuthenticationError(
          AuthErrorCode.RATE_LIMIT_EXCEEDED,
          `Too many login attempts for user: ${username}`,
          undefined,
          429
        );
        this.logAuthenticationAttempt(username, false, error.code, context);
        return {
          success: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Find user by username
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        this.recordFailedAttempt(username);
        const error = new AuthenticationError(
          AuthErrorCode.INVALID_CREDENTIALS,
          `User not found: ${username}`
        );
        this.logAuthenticationAttempt(username, false, error.code, context);
        return {
          success: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        this.recordFailedAttempt(username);
        const error = new AuthenticationError(
          AuthErrorCode.INVALID_CREDENTIALS,
          `Invalid password for user: ${username}`
        );
        this.logAuthenticationAttempt(username, false, error.code, context);
        return {
          success: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Clear failed attempts on successful login
      this.clearFailedAttempts(username);

      // Update last login time
      await this.userRepository.updateLastLogin(user.id);

      // Generate session token
      const token = this.generateSessionToken(user);

      this.logAuthenticationAttempt(username, true, undefined, context);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('Authentication error:', error);
      const authError = new AuthenticationError(
        AuthErrorCode.SERVICE_UNAVAILABLE,
        `Authentication service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        503
      );
      this.logAuthenticationAttempt(username, false, authError.code, context);
      return {
        success: false,
        error: authError.userMessage,
        errorCode: authError.code
      };
    }
  }

  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    try {
      if (!sessionToken) {
        const error = new AuthenticationError(
          AuthErrorCode.TOKEN_INVALID,
          'No session token provided'
        );
        return {
          valid: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Check if token is blacklisted
      if (this.blacklistedTokens.has(sessionToken)) {
        const error = new AuthenticationError(
          AuthErrorCode.TOKEN_BLACKLISTED,
          'Token has been invalidated'
        );
        return {
          valid: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Verify JWT token
      const decoded = jwt.verify(sessionToken, this.jwtSecret) as any;
      
      if (!decoded.userId) {
        const error = new AuthenticationError(
          AuthErrorCode.TOKEN_INVALID,
          'Invalid token format - missing userId'
        );
        return {
          valid: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      // Check if token is close to expiration (within 1 hour)
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = decoded.exp - now;
      if (timeUntilExpiry < 3600) { // 1 hour
        console.warn(`Token for user ${decoded.userId} expires in ${timeUntilExpiry} seconds`);
      }

      // Fetch current user data
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        const error = new AuthenticationError(
          AuthErrorCode.USER_NOT_FOUND,
          `User not found for token: ${decoded.userId}`
        );
        return {
          valid: false,
          error: error.userMessage,
          errorCode: error.code
        };
      }

      return {
        valid: true,
        user
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        const authError = new AuthenticationError(
          AuthErrorCode.TOKEN_EXPIRED,
          'JWT token has expired'
        );
        return {
          valid: false,
          error: authError.userMessage,
          errorCode: authError.code
        };
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        const authError = new AuthenticationError(
          AuthErrorCode.TOKEN_INVALID,
          `Invalid JWT token: ${error.message}`
        );
        return {
          valid: false,
          error: authError.userMessage,
          errorCode: authError.code
        };
      }

      console.error('Session validation error:', error);
      const authError = new AuthenticationError(
        AuthErrorCode.SERVICE_UNAVAILABLE,
        `Session validation service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        503
      );
      return {
        valid: false,
        error: authError.userMessage,
        errorCode: authError.code
      };
    }
  }

  async logout(sessionToken: string): Promise<void> {
    try {
      // Add token to blacklist
      this.blacklistedTokens.add(sessionToken);
      
      // In a production environment, you might want to store blacklisted tokens
      // in a database or Redis with expiration times
    } catch (error) {
      console.error('Logout error:', error);
      // Don't throw error for logout failures
    }
  }

  async hashPassword(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password is required');
    }
    
    return bcrypt.hash(password, this.saltRounds);
  }

  generateSessionToken(user: User): string {
    const payload = {
      userId: user.id,
      username: user.username,
      companyId: user.companyId,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiration
    });
  }

  /**
   * Check if a username is rate limited
   */
  private isRateLimited(username: string): boolean {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) {
      return false;
    }

    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - attempts.lastAttempt.getTime();

    // Clear old attempts if lockout period has passed
    if (timeSinceLastAttempt > this.lockoutDuration) {
      this.loginAttempts.delete(username);
      return false;
    }

    return attempts.count >= this.maxLoginAttempts;
  }

  /**
   * Record a failed login attempt
   */
  private recordFailedAttempt(username: string): void {
    const now = new Date();
    const existing = this.loginAttempts.get(username);

    if (existing) {
      // Reset count if enough time has passed
      const timeSinceLastAttempt = now.getTime() - existing.lastAttempt.getTime();
      if (timeSinceLastAttempt > this.lockoutDuration) {
        this.loginAttempts.set(username, { count: 1, lastAttempt: now });
      } else {
        this.loginAttempts.set(username, { 
          count: existing.count + 1, 
          lastAttempt: now 
        });
      }
    } else {
      this.loginAttempts.set(username, { count: 1, lastAttempt: now });
    }
  }

  /**
   * Clear failed attempts for a username
   */
  private clearFailedAttempts(username: string): void {
    this.loginAttempts.delete(username);
  }

  /**
   * Log authentication attempts for security monitoring
   */
  private logAuthenticationAttempt(
    username: string, 
    success: boolean, 
    errorCode?: AuthErrorCode,
    context?: AuthErrorContext
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      username,
      success,
      errorCode,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      attemptCount: context?.attemptCount
    };

    if (success) {
      console.log('Authentication success:', logEntry);
    } else {
      console.warn('Authentication failure:', logEntry);
    }

    // In production, you might want to send this to a security monitoring service
    // or store in a dedicated audit log database
  }

  /**
   * Get current failed attempt count for a username
   */
  getFailedAttemptCount(username: string): number {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) {
      return 0;
    }

    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - attempts.lastAttempt.getTime();

    // Return 0 if lockout period has passed
    if (timeSinceLastAttempt > this.lockoutDuration) {
      return 0;
    }

    return attempts.count;
  }

  /**
   * Get time remaining for rate limit (in milliseconds)
   */
  getRateLimitTimeRemaining(username: string): number {
    const attempts = this.loginAttempts.get(username);
    if (!attempts || attempts.count < this.maxLoginAttempts) {
      return 0;
    }

    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - attempts.lastAttempt.getTime();
    const remaining = this.lockoutDuration - timeSinceLastAttempt;

    return Math.max(0, remaining);
  }
}