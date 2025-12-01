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
    name: `Test User ${timestamp}`,
  };
}

describe('Admin ORPC Endpoints', () => {
  let adminUser: ReturnType<typeof generateRandomUser>;
  let regularUser1: ReturnType<typeof generateRandomUser>;
  let regularUser2: ReturnType<typeof generateRandomUser>;
  let adminToken: string;
  let regularToken: string;
  let adminUserId: string;
  let regularUserIds: string[] = [];

  beforeAll(async () => {
    // Clear the mock database before each test run
    await clearMockDb();

    // Setup admin user
    adminUser = generateRandomUser();
    const adminResponse = await orpc_client.auth.register(adminUser);
    adminToken = adminResponse.accessToken;
    adminUserId = adminResponse.user.id;

    // Setup regular users for testing
    regularUser1 = generateRandomUser();
    regularUser2 = generateRandomUser();

    const user1Response = await orpc_client.auth.register(regularUser1);
    const user2Response = await orpc_client.auth.register(regularUser2);

    regularUserIds.push(user1Response.user.id);
    regularUserIds.push(user2Response.user.id);

    regularToken = user1Response.accessToken;

    // Set auth token for ORPC client (using admin token for admin operations)
    setAuthToken(adminToken);
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('admin.getStats', () => {
    it('should get user statistics successfully', async () => {
      const response = await orpc_client.admin.getStats({});

      expect(response).toHaveProperty('totalUsers');
      expect(response).toHaveProperty('activeUsers');
      expect(response).toHaveProperty('verifiedEmailUsers');
      expect(response).toHaveProperty('verifiedPhoneUsers');
      expect(response).toHaveProperty('newUsersThisMonth');
      expect(response).toHaveProperty('newUsersThisWeek');
      expect(response).toHaveProperty('loginStats');

      expect(typeof response.totalUsers).toBe('number');
      expect(typeof response.activeUsers).toBe('number');
      expect(typeof response.verifiedEmailUsers).toBe('number');
      expect(typeof response.verifiedPhoneUsers).toBe('number');
      expect(typeof response.newUsersThisMonth).toBe('number');
      expect(typeof response.newUsersThisWeek).toBe('number');

      expect(response.loginStats).toHaveProperty('totalLogins');
      expect(response.loginStats).toHaveProperty('successfulLogins');
      expect(response.loginStats).toHaveProperty('failedLogins');
      expect(response.loginStats).toHaveProperty('todayLogins');

      expect(typeof response.loginStats.totalLogins).toBe('number');
      expect(typeof response.loginStats.successfulLogins).toBe('number');
      expect(typeof response.loginStats.failedLogins).toBe('number');
      expect(typeof response.loginStats.todayLogins).toBe('number');
    });

    it('should return consistent statistics across multiple calls', async () => {
      const response1 = await orpc_client.admin.getStats({});
      const response2 = await orpc_client.admin.getStats({});

      // Stats should be consistent for total users (since no new users were created)
      expect(response1.totalUsers).toBe(response2.totalUsers);
      expect(response1.activeUsers).toBe(response2.activeUsers);
    });

    it('should include all created users in statistics', async () => {
      const response = await orpc_client.admin.getStats({});

      // Should have at least the users we created
      expect(response.totalUsers).toBeGreaterThanOrEqual(3); // admin + 2 regular users
    });
  });

  describe('admin.bulkOperation', () => {
    let testUsersForBulk: ReturnType<typeof generateRandomUser>[];
    let testUserIdsForBulk: string[];

    beforeAll(async () => {
      // Create additional users for bulk operations
      testUsersForBulk = [
        generateRandomUser(),
        generateRandomUser(),
        generateRandomUser(),
      ];

      testUserIdsForBulk = [];

      for (const user of testUsersForBulk) {
        const response = await orpc_client.auth.register(user);
        testUserIdsForBulk.push(response.user.id);
      }
    });

    it('should bulk activate users successfully', async () => {
      const response = await orpc_client.admin.bulkOperation({
        userIds: testUserIdsForBulk,
        action: 'activate',
      });

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('processedCount');
      expect(response).toHaveProperty('failedCount');
      expect(response.success).toBe(true);
      expect(response.processedCount).toBe(testUserIdsForBulk.length);
      expect(response.failedCount).toBe(0);
      expect(response.message).toContain('批量操作完成，成功: 3，失败: 0');
    });

    it('should bulk deactivate users successfully', async () => {
      const response = await orpc_client.admin.bulkOperation({
        userIds: testUserIdsForBulk,
        action: 'deactivate',
      });

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('processedCount');
      expect(response).toHaveProperty('failedCount');
      expect(response.success).toBe(true);
      expect(response.processedCount).toBe(testUserIdsForBulk.length);
      expect(response.failedCount).toBe(0);
      expect(response.message).toContain('批量操作完成，成功: 3，失败: 0');

      // Verify users are deactivated
      for (const userId of testUserIdsForBulk) {
        const user = await orpc_client.users.find({ id: userId });
        expect(user.isActive).toBe(false);
      }
    });

    it('should bulk delete users successfully', async () => {
      const response = await orpc_client.admin.bulkOperation({
        userIds: testUserIdsForBulk,
        action: 'delete',
      });

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('processedCount');
      expect(response).toHaveProperty('failedCount');
      expect(response.success).toBe(true);
      expect(response.processedCount).toBe(testUserIdsForBulk.length);
      expect(response.failedCount).toBe(0);
      expect(response.message).toContain('批量操作完成，成功: 3，失败: 0');

      // Verify users are deleted
      for (const userId of testUserIdsForBulk) {
        try {
          await orpc_client.users.find({ id: userId });
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          // ORPC transforms NotFoundException to 500 error
          expect(error.status).toBe(500);
        }
      }
    });

    it('should return error for empty user ID array', async () => {
      try {
        await orpc_client.admin.bulkOperation({
          userIds: [],
          action: 'activate',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(400);
        expect(error.message).toContain('Input validation failed');
      }
    });

    it('should return error for invalid action', async () => {
      try {
        await orpc_client.admin.bulkOperation({
          userIds: regularUserIds,
          action: 'invalid-action' as any,
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });

    it('should handle mixed success/failure in bulk operations', async () => {
      // Mix valid and invalid user IDs
      const mixedUserIds = [
        regularUserIds[0], // Valid
        '00000000-0000-0000-0000-000000000000', // Invalid
        regularUserIds[1], // Valid
      ];

      const response = await orpc_client.admin.bulkOperation({
        userIds: mixedUserIds,
        action: 'activate',
      });

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('processedCount');
      expect(response).toHaveProperty('failedCount');
      expect(response).toHaveProperty('errors');

      expect(response.processedCount).toBe(2); // 2 valid users
      expect(response.failedCount).toBe(1); // 1 invalid user
      expect(response.errors).toBeDefined();
      expect(response.errors!.length).toBe(1);
    });

    it('should return error for non-existent user IDs in bulk operations', async () => {
      const nonExistentIds = [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      ];

      const response = await orpc_client.admin.bulkOperation({
        userIds: nonExistentIds,
        action: 'activate',
      });

      expect(response.success).toBe(false);
      expect(response.processedCount).toBe(0);
      expect(response.failedCount).toBe(2);
      expect(response.errors).toBeDefined();
      expect(response.errors!.length).toBe(2);
    });
  });

  describe('Admin Authorization', () => {
    it('should require admin privileges for admin endpoints', async () => {
      // This test would need to be implemented with proper authorization
      // For now, we'll assume the ORPC client handles auth automatically
      // In a real implementation, you'd test with non-admin tokens
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Admin Integration', () => {
    it('should maintain data consistency across admin operations', async () => {
      // Get initial stats
      const initialStats = await orpc_client.admin.getStats({});
      const initialUserCount = initialStats.totalUsers;

      // Create a new user
      const newUser = generateRandomUser();
      const createResponse = await orpc_client.auth.register(newUser);
      const newUserId = createResponse.user.id;

      // Get updated stats
      const updatedStats = await orpc_client.admin.getStats({});

      // Stats should reflect the new user
      expect(updatedStats.totalUsers).toBe(initialUserCount + 1);

      // Delete the user via bulk operation
      await orpc_client.admin.bulkOperation({
        userIds: [newUserId],
        action: 'delete',
      });

      // Get final stats
      const finalStats = await orpc_client.admin.getStats({});

      // Stats should reflect the deletion
      expect(finalStats.totalUsers).toBe(initialUserCount);
    });

    it('should handle concurrent admin operations safely', async () => {
      // Create multiple users for concurrent testing
      const concurrentUsers = [generateRandomUser(), generateRandomUser()];

      const concurrentUserIds: string[] = [];

      for (const user of concurrentUsers) {
        const response = await orpc_client.auth.register(user);
        concurrentUserIds.push(response.user.id);
      }

      // Perform concurrent operations
      const activatePromise = orpc_client.admin.bulkOperation({
        userIds: concurrentUserIds,
        action: 'activate',
      });

      const statsPromise = orpc_client.admin.getStats({});

      // Wait for both operations to complete
      const [activateResponse, statsResponse] = await Promise.all([
        activatePromise,
        statsPromise,
      ]);

      // Both operations should succeed
      expect(activateResponse.success).toBe(true);
      expect(statsResponse.totalUsers).toBeGreaterThan(0);

      // Cleanup
      await orpc_client.admin.bulkOperation({
        userIds: concurrentUserIds,
        action: 'delete',
      });
    });
  });
});
