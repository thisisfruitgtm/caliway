import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthenticationService } from '../AuthenticationService';
import { User } from '../../models';
import { IUserRepository } from '../../repositories/UserRepository';
import { AuthErrorCode, AuthErrorContext } from '../../types/errors';

// Mock dependencies
vi.mock('bcrypt');
vi.mock('jsonwebtoken');

const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockUserRepository: IUserRepository;
  let mockUser: User;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock user repository
    mockUserRepository = {
      findById: vi.fn(),
      findByUsername: vi.fn(),
      findByCompanyId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateLastLogin: vi.fn()
    };

    // Create mock user
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      passwordHash: 'hashed-password',
      companyId: 'company-123',
      createdAt: new Date('2024-01-01'),
      lastLoginAt: new Date('2024-01-01')
    };

    // Set up environment variable
    process.env.JWT_SECRET = 'test-secret-key';
    
    authService = new AuthenticationService(mockUserRepository);
  });

  describe('authenticate', () => {
    it('should successfully authenticate with valid credentials', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin = vi.fn().mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      // Act
      const result = await authService.authenticate('testuser', 'password123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBe('mock-jwt-token');
      expect(result.error).toBeUndefined();
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should fail authentication with invalid username', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(null);

      // Act
      const result = await authService.authenticate('nonexistent', 'password123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.error).toBe('Invalid username or password. Please check your credentials and try again.');
      expect(result.errorCode).toBe(AuthErrorCode.INVALID_CREDENTIALS);
    });

    it('should fail authentication with invalid password', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      // Act
      const result = await authService.authenticate('testuser', 'wrongpassword');

      // Assert
      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.token).toBeUndefined();
      expect(result.error).toBe('Invalid username or password. Please check your credentials and try again.');
      expect(result.errorCode).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should fail authentication with empty username', async () => {
      // Act
      const result = await authService.authenticate('', 'password123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Please provide both username and password.');
      expect(result.errorCode).toBe(AuthErrorCode.MISSING_CREDENTIALS);
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should fail authentication with empty password', async () => {
      // Act
      const result = await authService.authenticate('testuser', '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Please provide both username and password.');
      expect(result.errorCode).toBe(AuthErrorCode.MISSING_CREDENTIALS);
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.authenticate('testuser', 'password123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication service is temporarily unavailable. Please try again later.');
      expect(result.errorCode).toBe(AuthErrorCode.SERVICE_UNAVAILABLE);
    });

    it('should implement rate limiting after multiple failed attempts', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(null);

      // Act - Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.authenticate('testuser', 'wrongpassword');
      }

      // Try one more time - should be rate limited
      const result = await authService.authenticate('testuser', 'wrongpassword');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Too many login attempts. Please wait before trying again.');
      expect(result.errorCode).toBe(AuthErrorCode.RATE_LIMIT_EXCEEDED);
    });

    it('should clear failed attempts after successful login', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn()
        .mockResolvedValueOnce(null) // First attempt fails
        .mockResolvedValueOnce(mockUser); // Second attempt succeeds
      mockUserRepository.updateLastLogin = vi.fn().mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('mock-jwt-token');

      // Act - First failed attempt
      await authService.authenticate('testuser', 'wrongpassword');
      
      // Second successful attempt
      const result = await authService.authenticate('testuser', 'password123');

      // Assert
      expect(result.success).toBe(true);
      expect(authService.getFailedAttemptCount('testuser')).toBe(0);
    });

    it('should include authentication context in error logging', async () => {
      // Arrange
      const context: AuthErrorContext = {
        username: 'testuser',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        attemptCount: 1
      };
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(null);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Act
      await authService.authenticate('testuser', 'wrongpassword', context);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Authentication failure:',
        expect.objectContaining({
          username: 'testuser',
          success: false,
          errorCode: AuthErrorCode.INVALID_CREDENTIALS,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validateSession', () => {
    it('should successfully validate a valid token', async () => {
      // Arrange
      const mockDecoded = { userId: 'user-123', username: 'testuser' };
      mockJwt.verify.mockReturnValue(mockDecoded);
      mockUserRepository.findById = vi.fn().mockResolvedValue(mockUser);

      // Act
      const result = await authService.validateSession('valid-token');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeUndefined();
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret-key');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should fail validation for expired token', async () => {
      // Arrange
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      // Act
      const result = await authService.validateSession('expired-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Your session has expired. Please log in again.');
      expect(result.errorCode).toBe(AuthErrorCode.TOKEN_EXPIRED);
    });

    it('should fail validation for invalid token', async () => {
      // Arrange
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      // Act
      const result = await authService.validateSession('invalid-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Invalid session. Please log in again.');
      expect(result.errorCode).toBe(AuthErrorCode.TOKEN_INVALID);
    });

    it('should fail validation when user not found', async () => {
      // Arrange
      const mockDecoded = { userId: 'user-123', username: 'testuser' };
      mockJwt.verify.mockReturnValue(mockDecoded);
      mockUserRepository.findById = vi.fn().mockResolvedValue(null);

      // Act
      const result = await authService.validateSession('valid-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('User account not found. Please contact your administrator.');
      expect(result.errorCode).toBe(AuthErrorCode.USER_NOT_FOUND);
    });

    it('should fail validation for token without userId', async () => {
      // Arrange
      const mockDecoded = { username: 'testuser' }; // Missing userId
      mockJwt.verify.mockReturnValue(mockDecoded);

      // Act
      const result = await authService.validateSession('invalid-format-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Invalid session. Please log in again.');
      expect(result.errorCode).toBe(AuthErrorCode.TOKEN_INVALID);
    });

    it('should fail validation for blacklisted token', async () => {
      // Arrange - first logout to blacklist the token
      await authService.logout('blacklisted-token');

      // Act
      const result = await authService.validateSession('blacklisted-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Your session has been terminated. Please log in again.');
      expect(result.errorCode).toBe(AuthErrorCode.TOKEN_BLACKLISTED);
    });

    it('should fail validation for empty token', async () => {
      // Act
      const result = await authService.validateSession('');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Invalid session. Please log in again.');
      expect(result.errorCode).toBe(AuthErrorCode.TOKEN_INVALID);
    });

    it('should handle session validation service errors', async () => {
      // Arrange
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Unexpected JWT error');
      });

      // Act
      const result = await authService.validateSession('some-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Authentication service is temporarily unavailable. Please try again later.');
      expect(result.errorCode).toBe(AuthErrorCode.SERVICE_UNAVAILABLE);
    });
  });

  describe('logout', () => {
    it('should successfully logout and blacklist token', async () => {
      // Arrange
      const token = 'test-token';

      // Act
      await authService.logout(token);

      // Verify token is blacklisted by trying to validate it
      const result = await authService.validateSession(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Your session has been terminated. Please log in again.');
    });

    it('should handle logout errors gracefully', async () => {
      // This test ensures logout doesn't throw errors
      // Act & Assert - should not throw
      await expect(authService.logout('any-token')).resolves.toBeUndefined();
    });
  });

  describe('hashPassword', () => {
    it('should successfully hash a password', async () => {
      // Arrange
      const password = 'password123';
      const hashedPassword = 'hashed-password-result';
      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      // Act
      const result = await authService.hashPassword(password);

      // Assert
      expect(result).toBe(hashedPassword);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should throw error for empty password', async () => {
      // Act & Assert
      await expect(authService.hashPassword('')).rejects.toThrow('Password is required');
    });
  });

  describe('generateSessionToken', () => {
    it('should generate a valid JWT token', () => {
      // Arrange
      const expectedToken = 'generated-jwt-token';
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = authService.generateSessionToken(mockUser);

      // Assert
      expect(result).toBe(expectedToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          username: mockUser.username,
          companyId: mockUser.companyId,
          iat: expect.any(Number)
        }),
        'test-secret-key',
        { expiresIn: '24h' }
      );
    });
  });

  describe('rate limiting', () => {
    it('should track failed attempt count', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(null);

      // Act
      await authService.authenticate('testuser', 'wrongpassword');
      await authService.authenticate('testuser', 'wrongpassword');

      // Assert
      expect(authService.getFailedAttemptCount('testuser')).toBe(2);
    });

    it('should return rate limit time remaining', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(null);

      // Act - Make 5 failed attempts to trigger rate limit
      for (let i = 0; i < 5; i++) {
        await authService.authenticate('testuser', 'wrongpassword');
      }

      // Assert
      const timeRemaining = authService.getRateLimitTimeRemaining('testuser');
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(15 * 60 * 1000); // 15 minutes max
    });

    it('should reset rate limit after lockout period', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockResolvedValue(null);

      // Act - Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authService.authenticate('testuser', 'wrongpassword');
      }

      // Simulate time passing by manipulating the internal state
      // In a real scenario, you'd wait or use fake timers
      const attempts = (authService as any).loginAttempts.get('testuser');
      if (attempts) {
        attempts.lastAttempt = new Date(Date.now() - 16 * 60 * 1000); // 16 minutes ago
      }

      // Try again - should not be rate limited
      const result = await authService.authenticate('testuser', 'wrongpassword');

      // Assert
      expect(result.errorCode).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      expect(result.errorCode).not.toBe(AuthErrorCode.RATE_LIMIT_EXCEEDED);
    });
  });
});