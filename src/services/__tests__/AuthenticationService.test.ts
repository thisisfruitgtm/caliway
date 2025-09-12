import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthenticationService } from '../AuthenticationService';
import { User } from '../../models';
import { IUserRepository } from '../../repositories/UserRepository';

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
      expect(result.error).toBe('Invalid credentials');
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
      expect(result.error).toBe('Invalid credentials');
      expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled();
    });

    it('should fail authentication with empty username', async () => {
      // Act
      const result = await authService.authenticate('', 'password123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Username and password are required');
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should fail authentication with empty password', async () => {
      // Act
      const result = await authService.authenticate('testuser', '');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Username and password are required');
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      mockUserRepository.findByUsername = vi.fn().mockRejectedValue(new Error('Database error'));

      // Act
      const result = await authService.authenticate('testuser', 'password123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication service unavailable');
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
      expect(result.error).toBe('Token has expired');
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
      expect(result.error).toBe('Invalid token');
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
      expect(result.error).toBe('User not found');
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
      expect(result.error).toBe('Invalid token format');
    });

    it('should fail validation for blacklisted token', async () => {
      // Arrange - first logout to blacklist the token
      await authService.logout('blacklisted-token');

      // Act
      const result = await authService.validateSession('blacklisted-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.error).toBe('Token has been invalidated');
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
      expect(result.error).toBe('Token has been invalidated');
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
});