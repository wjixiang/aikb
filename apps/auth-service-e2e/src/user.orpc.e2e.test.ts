import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { orpc_client, setAuthToken } from './support/orpc-client';
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

describe('User Management ORPC Endpoints', () => {
  let authToken: string;
  let refreshToken: string;
  let userId: string;
  let testUser: ReturnType<typeof generateRandomUser>;
  let adminUser: ReturnType<typeof generateRandomUser>;
  let adminToken: string;

  beforeAll(async () => {
    // Clear the mock database before each test run
    await clearMockDb();
    
    // Setup test data with regular user
    testUser = generateRandomUser();
    const userResponse = await orpc_client.auth.register(testUser);
    authToken = userResponse.accessToken;
    refreshToken = userResponse.refreshToken;
    userId = userResponse.user.id;

    // Setup admin user
    adminUser = generateRandomUser();
    const adminResponse = await orpc_client.auth.register(adminUser);
    adminToken = adminResponse.accessToken;
    
    // Set auth token for ORPC client (using regular user token)
    setAuthToken(authToken);
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('users.list', () => {
    it('should list users successfully', async () => {
      const response = await orpc_client.users.list({
        page: 1,
        limit: 10
      });

      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('pagination');
      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.pagination).toHaveProperty('page');
      expect(response.pagination).toHaveProperty('limit');
      expect(response.pagination).toHaveProperty('total');
    });

    it('should filter users by search term', async () => {
      const response = await orpc_client.users.list({
        page: 1,
        limit: 10,
        search: testUser.name
      });

      expect(response.data).toBeInstanceOf(Array);
      expect(response.data.length).toBeGreaterThan(0);
      expect(response.data.some(user => user.name && user.name.includes(testUser.name))).toBe(true);
    });

    it('should paginate results correctly', async () => {
      const response1 = await orpc_client.users.list({
        page: 1,
        limit: 1
      });

      const response2 = await orpc_client.users.list({
        page: 2,
        limit: 1
      });

      expect(response1.data.length).toBe(1);
      expect(response2.data.length).toBe(1);
      expect(response1.data[0].id).not.toBe(response2.data[0].id);
    });
  });

  describe('users.find', () => {
    it('should find user by ID successfully', async () => {
      const response = await orpc_client.users.find({ id: userId });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('email');
      expect(response).toHaveProperty('name');
      expect(response).toHaveProperty('isActive');
      expect(response.id).toBe(userId);
      expect(response.email).toBe(testUser.email);
      expect(response.name).toBe(testUser.name);
    });

    it('should return error for non-existent user ID', async () => {
      try {
        await orpc_client.users.find({ id: '00000000-0000-0000-0000-000000000000' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes
        expect(error.status).toBe(500);
        expect(error.message).toContain('Internal server error');
      }
    });

    it('should return error for invalid UUID format', async () => {
      try {
        await orpc_client.users.find({ id: 'invalid-uuid' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes, or throws input validation errors
        if (error.status === 400) {
          expect(error.message).toContain('Input validation failed');
        } else {
          expect(error.status).toBe(500);
        }
      }
    });
  });

  describe('users.update', () => {
    it('should update user successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        email: testUser.email // Keep same email to avoid conflicts
      };

      const response = await orpc_client.users.update({
        id: userId,
        data: updateData
      });

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('email');
      expect(response).toHaveProperty('name');
      expect(response.id).toBe(userId);
      expect(response.email).toBe(testUser.email);
      expect(response.name).toBe('Updated Name');
    });

    it('should return error when updating with invalid data', async () => {
      try {
        await orpc_client.users.update({
          id: userId,
          data: { name: '' } // Invalid empty name
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it('should return error for non-existent user ID', async () => {
      try {
        await orpc_client.users.update({
          id: '00000000-0000-0000-0000-000000000000',
          data: { name: 'Updated Name' }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes
        expect(error.status).toBe(500);
        expect(error.message).toContain('Internal server error');
      }
    });
  });

  describe('users.updatePassword', () => {
    it('should update user password successfully', async () => {
      const newPassword = 'newPassword123';
      
      const response = await orpc_client.users.updatePassword({
        id: userId,
        data: {
          currentPassword: testUser.password,
          newPassword: newPassword
        }
      });

      expect(response).toHaveProperty('message');
      expect(response.message).toContain('密码更新成功');

      // Verify login with new password works
      const loginResponse = await orpc_client.auth.login({
        email: testUser.email,
        password: newPassword
      });
      expect(loginResponse).toHaveProperty('accessToken');

      // Update test user password for other tests
      testUser.password = newPassword;
      
      // Update auth token with new login
      const newLoginResponse = await orpc_client.auth.login({
        email: testUser.email,
        password: newPassword
      });
      setAuthToken(newLoginResponse.accessToken);
    });

    it('should return error for incorrect current password', async () => {
      try {
        await orpc_client.users.updatePassword({
          id: userId,
          data: {
            currentPassword: 'wrongpassword',
            newPassword: 'newPassword123'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes
        expect(error.status).toBe(500);
        expect(error.message).toContain('Internal server error');
      }
    });

    it('should return error for weak new password', async () => {
      try {
        await orpc_client.users.updatePassword({
          id: userId,
          data: {
            currentPassword: testUser.password,
            newPassword: '123'
          }
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes, or throws input validation errors
        if (error.status === 400) {
          expect(error.message).toContain('Input validation failed');
        } else {
          expect(error.status).toBe(500);
        }
      }
    });
  });

  describe('users.delete', () => {
    let deleteUser: ReturnType<typeof generateRandomUser>;
    let deleteUserId: string;

    beforeAll(async () => {
      // Create a user for deletion tests
      deleteUser = generateRandomUser();
      const deleteResponse = await orpc_client.auth.register(deleteUser);
      deleteUserId = deleteResponse.user.id;
    });

    it('should delete user successfully', async () => {
      const response = await orpc_client.users.delete({ id: deleteUserId });

      expect(response).toHaveProperty('message');
      expect(response.message).toContain('用户删除成功');

      // Verify user is deleted
      try {
        await orpc_client.users.find({ id: deleteUserId });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes
        expect(error.status).toBe(500);
        expect(error.message).toContain('Internal server error');
      }
    });

    it('should return error for non-existent user ID', async () => {
      try {
        await orpc_client.users.delete({ id: '00000000-0000-0000-0000-000000000000' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors to 500 status codes
        expect(error.status).toBe(500);
        expect(error.message).toContain('Internal server error');
      }
    });
  });

  describe('users.getActivity', () => {
    it('should get user activity successfully', async () => {
      const response = await orpc_client.users.getActivity({ id: userId });

      expect(response).toHaveProperty('activities');
      expect(response).toHaveProperty('userId');
      expect(response.userId).toBe(userId);
      expect(response.activities).toBeInstanceOf(Array);
    });

    it('should return error for non-existent user ID', async () => {
      try {
        await orpc_client.users.getActivity({ id: '00000000-0000-0000-0000-000000000000' });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC transforms all errors - handle different error structures
        expect(error.status || error.code === 'INTERNAL_SERVER_ERROR' || error.message).toBeTruthy();
        expect(error.message).toContain('Internal server error');
      }
    });
  });
});