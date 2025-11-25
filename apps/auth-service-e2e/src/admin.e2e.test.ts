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

describe('Admin Endpoints', () => {
  let authToken: string;
  let testUserIds: string[] = [];
  let user = [generateRandomUser(),generateRandomUser(),generateRandomUser()]
  beforeAll(async () => {
    // Create test users for admin operations
    user = [generateRandomUser(),generateRandomUser(),generateRandomUser()]
    for (let i = 0; i < 3; i++) {
      const registerResponse = await axiosInstance.post('/auth/register',user[i]);
      testUserIds.push(registerResponse.data.user.id);
    }

    // Get auth token for admin operations
    const loginResponse = await axiosInstance.post('/auth/login', user[0]);
    authToken = loginResponse.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('GET /admin/stats', () => {
    it('should get user statistics successfully', async () => {
      const response = await axiosInstance.get('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('totalUsers');
      expect(response.data).toHaveProperty('activeUsers');
      expect(response.data).toHaveProperty('verifiedEmailUsers');
      expect(response.data).toHaveProperty('verifiedPhoneUsers');
      expect(response.data).toHaveProperty('newUsersThisMonth');
      expect(response.data).toHaveProperty('newUsersThisWeek');
      expect(response.data).toHaveProperty('loginStats');
      
      expect(response.data.loginStats).toHaveProperty('totalLogins');
      expect(response.data.loginStats).toHaveProperty('successfulLogins');
      expect(response.data.loginStats).toHaveProperty('failedLogins');
      expect(response.data.loginStats).toHaveProperty('todayLogins');
      
      expect(typeof response.data.totalUsers).toBe('number');
      expect(typeof response.data.activeUsers).toBe('number');
      expect(typeof response.data.verifiedEmailUsers).toBe('number');
      expect(typeof response.data.verifiedPhoneUsers).toBe('number');
      expect(typeof response.data.newUsersThisMonth).toBe('number');
      expect(typeof response.data.newUsersThisWeek).toBe('number');
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.get('/admin/stats');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('POST /admin/bulk-operation', () => {
    let bulkTestUserIds: string[] = [];

    beforeAll(async () => {
      // Create additional users for bulk operations
      const bulkUsers = [generateRandomUser(), generateRandomUser(), generateRandomUser()];
      for (let i = 0; i < 3; i++) {
        const registerResponse = await axiosInstance.post('/auth/register', bulkUsers[i]);
        bulkTestUserIds.push(registerResponse.data.user.id);
      }
    });

    it('should activate users in bulk successfully', async () => {
      const response = await axiosInstance.post('/admin/bulk-operation', {
        userIds: bulkTestUserIds,
        action: 'activate'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.processedCount).toBe(3);
      expect(response.data.failedCount).toBe(0);
      expect(response.data.message).toContain('批量操作完成');
    });

    it('should deactivate users in bulk successfully', async () => {
      const response = await axiosInstance.post('/admin/bulk-operation', {
        userIds: bulkTestUserIds,
        action: 'deactivate'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.processedCount).toBe(3);
      expect(response.data.failedCount).toBe(0);
      expect(response.data.message).toContain('批量操作完成');
    });

    it('should delete users in bulk successfully', async () => {
      // Create new users for deletion test
      const deleteTestUserIds: string[] = [];
      const deleteUsers = [generateRandomUser(), generateRandomUser()];
      for (let i = 0; i < 2; i++) {
        const registerResponse = await axiosInstance.post('/auth/register', deleteUsers[i]);
        deleteTestUserIds.push(registerResponse.data.user.id);
      }

      const response = await axiosInstance.post('/admin/bulk-operation', {
        userIds: deleteTestUserIds,
        action: 'delete'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.processedCount).toBe(2);
      expect(response.data.failedCount).toBe(0);
      expect(response.data.message).toContain('批量操作完成');
    });

    it('should handle mixed success/failure operations', async () => {
      // Mix valid and invalid user IDs
      const mixedUserIds = [
        ...bulkTestUserIds.slice(0, 1), // Valid ID
        '00000000-0000-0000-0000-000000000000', // Invalid ID
        ...bulkTestUserIds.slice(1, 2)  // Valid ID
      ];

      const response = await axiosInstance.post('/admin/bulk-operation', {
        userIds: mixedUserIds,
        action: 'activate'
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(false); // Should be false due to failures
      expect(response.data.processedCount).toBe(2);
      expect(response.data.failedCount).toBe(1);
      expect(response.data.errors).toBeDefined();
      expect(Array.isArray(response.data.errors)).toBe(true);
    });

    it('should return error for invalid action', async () => {
      try {
        await axiosInstance.post('/admin/bulk-operation', {
          userIds: bulkTestUserIds,
          action: 'invalid-action'
        }, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.post('/admin/bulk-operation', {
          userIds: bulkTestUserIds,
          action: 'activate'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should return error for empty user IDs array', async () => {
      try {
        await axiosInstance.post('/admin/bulk-operation', {
          userIds: [],
          action: 'activate'
        }, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should return error for invalid UUID format', async () => {
      try {
        await axiosInstance.post('/admin/bulk-operation', {
          userIds: ['invalid-uuid-format'],
          action: 'activate'
        }, {
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