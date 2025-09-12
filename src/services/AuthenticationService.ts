import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { IUserRepository } from '../repositories/UserRepository';

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: User;
  error?: string;
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

  constructor(private userRepository: IUserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    if (this.jwtSecret === 'default-secret-key') {
      console.warn('Warning: Using default JWT secret. Set JWT_SECRET environment variable for production.');
    }
  }

  async authenticate(username: string, password: string): Promise<AuthResult> {
    try {
      // Input validation
      if (!username || !password) {
        return {
          success: false,
          error: 'Username and password are required'
        };
      }

      // Find user by username
      const user = await this.userRepository.findByUsername(username);
      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login time
      await this.userRepository.updateLastLogin(user.id);

      // Generate session token
      const token = this.generateSessionToken(user);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication service unavailable'
      };
    }
  }

  async validateSession(sessionToken: string): Promise<SessionValidationResult> {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(sessionToken)) {
        return {
          valid: false,
          error: 'Token has been invalidated'
        };
      }

      // Verify JWT token
      const decoded = jwt.verify(sessionToken, this.jwtSecret) as any;
      
      if (!decoded.userId) {
        return {
          valid: false,
          error: 'Invalid token format'
        };
      }

      // Fetch current user data
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        return {
          valid: false,
          error: 'User not found'
        };
      }

      return {
        valid: true,
        user
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'Token has expired'
        };
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'Invalid token'
        };
      }

      console.error('Session validation error:', error);
      return {
        valid: false,
        error: 'Session validation failed'
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
}