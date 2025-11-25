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
describe('User Management Endpoints', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user and get auth token
    const testUser = generateRandomUser();
    const registerResponse = await axiosInstance.post('/auth/register', testUser);

    authToken = registerResponse.data.accessToken;
    testUserId = registerResponse.data.user.id;
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('GET /users', () => {
    it('should get paginated users list', async () => {
      const response = await axiosInstance.get('/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(response.data).toHaveProperty('pagination');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.pagination).toHaveProperty('page');
      expect(response.data.pagination).toHaveProperty('limit');
      expect(response.data.pagination).toHaveProperty('total');
    });

    it('should support pagination parameters', async () => {
      const response = await axiosInstance.get('/users?page=1&limit=5', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(Number(response.data.pagination.page)).toBe(1);
      expect(Number(response.data.pagination.limit)).toBe(5);
      expect(response.data.data.length).toBeLessThanOrEqual(5);
    });

    it('should support search functionality', async () => {
      // Create a user with a known name for search testing
      const searchUser = generateRandomUser();
      searchUser.name = 'SearchTestUser';
      await axiosInstance.post('/auth/register', searchUser);

      const response = await axiosInstance.get('/users?search=SearchTestUser', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.get('/users');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('GET /users/:id', () => {
    it('should get user details by ID', async () => {
      const response = await axiosInstance.get(`/users/${testUserId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('email');
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('refreshTokens');
      expect(response.data).toHaveProperty('sessions');
      expect(response.data).toHaveProperty('loginLogs');
      expect(response.data.id).toBe(testUserId);
    });

    it('should return error for non-existent user', async () => {
      try {
        await axiosInstance.get('/users/00000000-0000-0000-0000-000000000000', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.message).toContain('用户不存在');
      }
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.get(`/users/${testUserId}`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user information successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        avatar: 'https://example.com/avatar.jpg',
        phone: `+1${(Date.now() % 10000000000)}` // Generate unique phone number with max 10 digits
      };

      const response = await axiosInstance.put(`/users/${testUserId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.name).toBe(updateData.name);
      expect(response.data.avatar).toBe(updateData.avatar);
      expect(response.data.phone).toBe(updateData.phone);
    });

    it('should update user active status', async () => {
      const updateData = {
        isActive: false
      };

      const response = await axiosInstance.put(`/users/${testUserId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.isActive).toBe(false);
    });

    it('should return error for invalid phone number', async () => {
      // Create a fresh user for this test to ensure token is valid
      const freshUser = generateRandomUser();
      const registerResponse = await axiosInstance.post('/auth/register', freshUser);
      const freshToken = registerResponse.data.accessToken;
      const freshUserId = registerResponse.data.user.id;
      
      try {
        await axiosInstance.put(`/users/${freshUserId}`, {
          phone: 'invalid-phone'
        }, {
          headers: {
            'Authorization': `Bearer ${freshToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.put(`/users/${testUserId}`, {
          name: 'Updated Name'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('POST /users/:id/password', () => {
    let passwordTestUser: any;
    let passwordTestUserId: string;
    let passwordTestAuthToken: string;

    beforeAll(async () => {
      // Create a dedicated user for password tests
      passwordTestUser = generateRandomUser();
      const registerResponse = await axiosInstance.post('/auth/register', passwordTestUser);
      passwordTestUserId = registerResponse.data.user.id;
      passwordTestAuthToken = registerResponse.data.accessToken;
    });

    it('should update password successfully', async () => {
      const response = await axiosInstance.post(`/users/${passwordTestUserId}/password`, {
        currentPassword: passwordTestUser.password,
        newPassword: 'newpassword123'
      }, {
        headers: {
          'Authorization': `Bearer ${passwordTestAuthToken}`
        }
      });

      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('密码更新成功');
    });

    it('should return error for wrong current password', async () => {
      try {
        await axiosInstance.post(`/users/${passwordTestUserId}/password`, {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456'
        }, {
          headers: {
            'Authorization': `Bearer ${passwordTestAuthToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('当前密码错误');
      }
    });

    it('should return error for same password', async () => {
      try {
        await axiosInstance.post(`/users/${passwordTestUserId}/password`, {
          currentPassword: 'newpassword123', // Use the updated password
          newPassword: 'newpassword123'
        }, {
          headers: {
            'Authorization': `Bearer ${passwordTestAuthToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.message).toContain('新密码不能与当前密码相同');
      }
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.post(`/users/${passwordTestUserId}/password`, {
          currentPassword: passwordTestUser.password,
          newPassword: 'newpassword123'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('GET /users/:id/activity', () => {
    let activityTestUser: any;
    let activityTestUserId: string;
    let activityTestAuthToken: string;

    beforeAll(async () => {
      // Create a dedicated user for activity tests
      activityTestUser = generateRandomUser();
      const registerResponse = await axiosInstance.post('/auth/register', activityTestUser);
      activityTestUserId = registerResponse.data.user.id;
      activityTestAuthToken = registerResponse.data.accessToken;
    });

    it('should get user activity logs', async () => {
      const response = await axiosInstance.get(`/users/${activityTestUserId}/activity`, {
        headers: {
          'Authorization': `Bearer ${activityTestAuthToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('userId');
      expect(response.data).toHaveProperty('activities');
      expect(response.data.userId).toBe(activityTestUserId);
      expect(Array.isArray(response.data.activities)).toBe(true);
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.get(`/users/${activityTestUserId}/activity`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('DELETE /users/:id', () => {
    let deleteTestUserId: string;
    let deleteAuthToken: string;

    beforeAll(async () => {
      // Create a user for deletion test
      const deleteUser = generateRandomUser();
      const registerResponse = await axiosInstance.post('/auth/register', deleteUser);
      deleteTestUserId = registerResponse.data.user.id;
      deleteAuthToken = registerResponse.data.accessToken;
    });

    it('should delete user successfully', async () => {
      const response = await axiosInstance.delete(`/users/${deleteTestUserId}`, {
        headers: {
          'Authorization': `Bearer ${deleteAuthToken}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toContain('用户删除成功');
    });

    it('should return error for non-existent user deletion', async () => {
      // Create a fresh user for this test to ensure token is valid
      const freshUser = generateRandomUser();
      const registerResponse = await axiosInstance.post('/auth/register', freshUser);
      const freshToken = registerResponse.data.accessToken;
      
      try {
        await axiosInstance.delete('/users/00000000-0000-0000-0000-000000000000', {
          headers: {
            'Authorization': `Bearer ${freshToken}`
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.message).toContain('用户不存在');
      }
    });

    it('should return error without authentication', async () => {
      try {
        await axiosInstance.delete(`/users/${testUserId}`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });
});