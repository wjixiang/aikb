import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { axiosInstance } from './support/axios-instance';
import { clearMockDb } from './support/test-db-setup';

// Helper function to generate random user data
function generateRandomUser() {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    email: `test${timestamp}${randomSuffix}@example.com`,
    password: `password${timestamp}`,
    name: `Test User ${timestamp}`
  };
}

describe('Authentication Endpoints', () => {
  let authToken: string;
  let refreshToken: string;
  let userId: string;
  let testUser: ReturnType<typeof generateRandomUser>;

  beforeAll(async () => {
    // Clear the mock database before each test run
    await clearMockDb();
    
    // Setup test data with random user
    testUser = generateRandomUser();
    await axiosInstance.post('/auth/register', testUser);
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = generateRandomUser();
      const response = await axiosInstance.post('/auth/register', newUser);

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
      expect(response.data.user.email).toBe(newUser.email);
      expect(response.data.user.name).toBe(newUser.name);
    });

    it('should return error for duplicate email', async () => {
      try {
        await axiosInstance.post('/auth/register', {
          email: testUser.email,
          password: 'password123',
          name: 'Duplicate User'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(409);
        expect(error.response.data.message).toContain('用户已存在');
      }
    });

    it('should return error for invalid email', async () => {
      try {
        await axiosInstance.post('/auth/register', {
          email: 'invalid-email',
          password: 'password123',
          name: 'Invalid Email User'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should return error for short password', async () => {
      try {
        await axiosInstance.post('/auth/register', {
          email: 'shortpass@example.com',
          password: '123',
          name: 'Short Pass User'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await axiosInstance.post('/auth/login', {
        email: testUser.email,
        password: testUser.password
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
      expect(response.data.user.email).toBe(testUser.email);

      // Store tokens for subsequent tests
      authToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
      userId = response.data.user.id;
    });

    it('should return error for invalid credentials', async () => {
      try {
        await axiosInstance.post('/auth/login', {
          email: testUser.email,
          password: 'wrongpassword'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toContain('邮箱或密码错误');
      }
    });

    it('should return error for non-existent user', async () => {
      try {
        await axiosInstance.post('/auth/login', {
          email: 'nonexistent@example.com',
          password: 'password123'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toContain('邮箱或密码错误');
      }
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token successfully', async () => {
      const response = await axiosInstance.post('/auth/refresh', {
        refreshToken: refreshToken
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('user');
      expect(response.data).toHaveProperty('accessToken');
      expect(response.data).toHaveProperty('refreshToken');
      expect(response.data.user.email).toBe(testUser.email);

      // Update tokens
      authToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
    });

    it('should return error for invalid refresh token', async () => {
      try {
        await axiosInstance.post('/auth/refresh', {
          refreshToken: 'invalid-refresh-token'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toContain('无效的刷新令牌');
      }
    });
  });

  describe('GET /auth/validate', () => {
    it('should validate token successfully', async () => {
      const response = await axiosInstance.get('/auth/validate', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('email');
      expect(response.data).toHaveProperty('isActive');
      expect(response.data.email).toBe(testUser.email);
      expect(response.data.isActive).toBe(true);
    });

    it('should return error for invalid token', async () => {
      try {
        await axiosInstance.get('/auth/validate', {
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should return error for missing token', async () => {
      try {
        await axiosInstance.get('/auth/validate');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await axiosInstance.post('/auth/logout', {
        refreshToken: refreshToken
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.message).toBe('登出成功');
    });

    it('should return error for logout without token', async () => {
      try {
        await axiosInstance.post('/auth/logout', {
          refreshToken: refreshToken
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });
});