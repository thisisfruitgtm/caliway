import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRoutes } from '../routes/auth';
import { User } from '../../models';

// Mock all external dependencies
vi.mock('../../config/supabase', () => ({
  supabase: {}
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn()
  }
}));

vi.mock('../../repositories/UserRepository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findByUsername: vi.fn(),
    findById: vi.fn(),
    updateLastLogin: vi.fn()
  }))
}));

describe('Authentication Routes - Simple Tests', () => {
  let app: express.Application;

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
  });

  describe('GET /login', () => {
    it('should render login page', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      expect(response.text).toContain('Company Calendar - Login');
      expect(response.text).toContain('Sign in to manage your calendar');
      expect(response.text).toContain('id="username"');
      expect(response.text).toContain('id="password"');
    });
  });

  describe('POST /login', () => {
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

    it('should fail login with empty username', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: '',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required'
      });
    });

    it('should fail login with empty password', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: ''
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Username and password are required'
      });
    });
  });

  describe('GET /dashboard', () => {
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

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/session')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'No authentication token provided'
      });
    });
  });
});