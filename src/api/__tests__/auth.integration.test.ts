import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRoutes } from '../routes/auth';
import { User } from '../../models';
import { UserRepository } from '../../repositories/UserRepository';
import bcrypt from 'bcrypt';

// Mock Supabase configuration
vi.mock('../../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    }))
  }
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  }
}));

// Mock the UserRepository
vi.mock('../../repositories/UserRepository');

describe('Authentication Integration Tests', () => {
  let app: express.Application;
  let mockUserRepository: any;
  let mockUser: User;

  beforeEach(() => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.use('/', authRoutes.getRouter());

    // Setup mock user
    mockUser = {
      id: 'user-123',
      username: 'testuser',
      passwordHash: '$2b$12$hashedpassword',
      companyId: 'company-123',
      createdAt: new Date('2024-01-01'),
      lastLoginAt: new Date('2024-01-01')
    };

    // Setup mock repository
    mockUserRepository = {
      findByUsername: vi.fn(),
      findById: vi.fn(),
      updateLastLogin: vi.fn()
    };

    // Mock the UserRepository constructor
    vi.mocked(UserRepository).mockImplementation(() => mockUserRepository);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /login', () => {
    it('should render login page for unauthenticated users', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      expect(response.text).toContain('Company Calendar - Login');
      expect(response.text).toContain('Sign in to manage your calendar');
      expect(response.text).toContain('id="username"');
      expect(response.text).toContain('id="password"');
    });

    it('should redirect authenticated users to dashboard', async () => {
      // First login to get a token
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      // Now try to access login page with valid session
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .get('/login')
        .set('Cookie', cookies ? cookies[0] : '')
        .expect(302);

      expect(response.headers.location).toBe('/dashboard');
    });
  });

  describe('POST /login', () => {
    it('should successfully login with valid credentials', async () => {
      // Setup mocks
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        user: {
          id: 'user-123',
          username: 'testuser',
          companyId: 'company-123'
        }
      });

      // Check that auth cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('authToken=');
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('should fail login with invalid username', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      const response = await request(app)
        .post('/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should fail login with invalid password', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should fail login with missing credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser'
          // missing password
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required'
      });
    });
  });

  describe('GET /dashboard', () => {
    it('should render dashboard for authenticated users', async () => {
      // First login to get a token
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      // Access dashboard with valid session
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', cookies ? cookies[0] : '')
        .expect(200);

      expect(response.text).toContain('Company Calendar Dashboard');
      expect(response.text).toContain('Welcome, testuser');
      expect(response.text).toContain('Manage Events');
    });

    it('should redirect unauthenticated users to login', async () => {
      const response = await request(app)
        .get('/dashboard')
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });

    it('should redirect users with invalid token to login', async () => {
      const response = await request(app)
        .get('/dashboard')
        .set('Cookie', ['authToken=invalid-token'])
        .expect(302);

      expect(response.headers.location).toBe('/login');
    });
  });

  describe('POST /logout', () => {
    it('should successfully logout authenticated user', async () => {
      // First login to get a token
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      // Logout
      const response = await request(app)
        .post('/logout')
        .set('Cookie', cookies ? cookies[0] : '')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully'
      });

      // Check that auth cookie is cleared
      const setCookies = response.headers['set-cookie'];
      expect(setCookies).toBeDefined();
      expect(setCookies[0]).toContain('authToken=;');
    });

    it('should handle logout without token gracefully', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });

  describe('GET /api/session', () => {
    it('should return user info for valid session', async () => {
      // First login to get a token
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockUserRepository.updateLastLogin.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);

      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      
      // Validate session
      mockUserRepository.findById.mockResolvedValue(mockUser);
      
      const response = await request(app)
        .get('/api/session')
        .set('Cookie', cookies ? cookies[0] : '')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        user: {
          id: 'user-123',
          username: 'testuser',
          companyId: 'company-123'
        }
      });
    });

    it('should return 401 for invalid session', async () => {
      const response = await request(app)
        .get('/api/session')
        .set('Cookie', ['authToken=invalid-token'])
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token'
      });
    });
  });
});