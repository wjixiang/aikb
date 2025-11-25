import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { axiosInstance } from './support/axios-instance';
function generateRandomUser() {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    email: `test-${timestamp}-${randomSuffix}@example.com`,
    password: 'password123',
    name: `Test User ${timestamp}-${randomSuffix}`
  };
}


describe('Session Management Endpoints', () => {
  let authToken: string;
  let testUserId: string;
  let user = generateRandomUser()

  beforeAll(async () => {
    // Create a test user and get auth token
    const registerResponse = await axiosInstance.post('/auth/register', user);

    authToken = registerResponse.data.accessToken;
    testUserId = registerResponse.data.user.id;
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('GET /sessions', () => {
    it('should get user sessions', async () => {
      const response = await axiosInstance.get(`/sessions?userId=${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should filter by active status', async () => {
      const response = await axiosInstance.get(`/sessions?userId=${testUserId}&isActive=true`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.get(`/sessions?userId=${testUserId}`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should return error for missing userId', async () => {
      try {
        await axiosInstance.get('/sessions', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });

  describe('DELETE /sessions/:sessionId', () => {
    let testSessionId: string;

    beforeAll(async () => {
      // Create a session by logging in again
      const loginResponse = await axiosInstance.post('/auth/login', {
        email: user.email,
        password: user.password
      });

      // Get sessions to find a session ID
      const sessionsResponse = await axiosInstance.get(`/sessions?userId=${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (sessionsResponse.data.length > 0) {
        testSessionId = sessionsResponse.data[0].id;
      }
    });

    it('should revoke specific session successfully', async () => {
      if (!testSessionId) {
        // Skip test if no session available
        console.log('No session available for testing');
        return;
      }

      const response = await axiosInstance.delete(`/sessions/${testSessionId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('会话已撤销');
    });

    it('should return error for non-existent session', async () => {
      try {
        await axiosInstance.delete('/sessions/00000000-0000-0000-0000-000000000000', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.message).toContain('会话不存在');
      }
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.delete(`/sessions/${testSessionId}`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('DELETE /sessions/user/:userId', () => {
    it('should revoke all user sessions successfully', async () => {
      const response = await axiosInstance.delete(`/sessions/user/${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('所有会话已撤销');
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.delete(`/sessions/user/${testUserId}`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should return error for invalid user ID', async () => {
      try {
        await axiosInstance.delete('/sessions/user/invalid-uuid', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });
  });
});