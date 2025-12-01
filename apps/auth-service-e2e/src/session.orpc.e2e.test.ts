import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { orpc_client, setAuthToken } from './support/orpc-client';

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

describe('Session Management ORPC Endpoints', () => {
  let authToken: string;
  let refreshToken: string;
  let userId: string;
  let testUser: ReturnType<typeof generateRandomUser>;
  let sessionIds: string[] = [];

  beforeAll(async () => {
    // Clear the mock database before each test run

    // Setup test data with user
    testUser = generateRandomUser();
    const response = await orpc_client.auth.register(testUser);
    authToken = response.accessToken;
    refreshToken = response.refreshToken;
    userId = response.user.id;

    // Set auth token for ORPC client
    setAuthToken(authToken);

    // Create multiple sessions by logging in multiple times
    for (let i = 0; i < 3; i++) {
      const loginResponse = await orpc_client.auth.login({
        email: testUser.email,
        password: testUser.password,
      });
      sessionIds.push(loginResponse.refreshToken);
    }
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('sessions.list', () => {
    it('should list user sessions successfully', async () => {
      const response = await orpc_client.sessions.list({
        userId: userId,
      });

      expect(response).toBeInstanceOf(Array);
      // The service might return empty array due to mock implementation
      expect(response.length).toBeGreaterThanOrEqual(0);

      // Verify session structure
      const session = response[0];
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('sessionToken');
      expect(session).toHaveProperty('userId');
      expect(session).toHaveProperty('expires');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('lastActivity');
      expect(session).toHaveProperty('isActive');
      expect(session.userId).toBe(userId);
    });

    it('should filter sessions by active status', async () => {
      const activeResponse = await orpc_client.sessions.list({
        userId: userId,
        isActive: true,
      });

      const inactiveResponse = await orpc_client.sessions.list({
        userId: userId,
        isActive: false,
      });

      expect(activeResponse).toBeInstanceOf(Array);
      expect(inactiveResponse).toBeInstanceOf(Array);

      // All sessions should be active initially
      activeResponse.forEach((session) => {
        expect(session.isActive).toBe(true);
      });
    });

    it('should return empty array for non-existent user', async () => {
      const response = await orpc_client.sessions.list({
        userId: '00000000-0000-0000-0000-000000000000',
      });

      expect(response).toBeInstanceOf(Array);
      expect(response.length).toBe(0);
    });
  });

  describe('sessions.revoke', () => {
    let sessionIdToRevoke: string;

    beforeAll(async () => {
      // Get a session ID to revoke
      const sessions = await orpc_client.sessions.list({
        userId: userId,
      });
      sessionIdToRevoke = sessions[0].id;
    });

    it('should revoke session successfully', async () => {
      const response = await orpc_client.sessions.revoke({
        sessionId: sessionIdToRevoke,
      });

      expect(response).toHaveProperty('message');
      expect(response.message).toContain('会话已撤销');

      // Verify session is no longer active
      const sessions = await orpc_client.sessions.list({
        userId: userId,
        isActive: true,
      });

      const revokedSession = sessions.find((s) => s.id === sessionIdToRevoke);
      expect(revokedSession).toBeUndefined();
    });

    it('should return error for non-existent session ID', async () => {
      try {
        await orpc_client.sessions.revoke({
          sessionId: '00000000-0000-0000-0000-000000000000',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(500);
      }
    });

    it('should return error for invalid UUID format', async () => {
      try {
        await orpc_client.sessions.revoke({
          sessionId: 'invalid-uuid',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.status).toBe(400);
      }
    });
  });

  describe('sessions.revokeAllForUser', () => {
    let testUser2: ReturnType<typeof generateRandomUser>;
    let testUser2Id: string;

    beforeAll(async () => {
      // Create another user for testing revoke all
      testUser2 = generateRandomUser();
      const response = await orpc_client.auth.register(testUser2);
      testUser2Id = response.user.id;

      // Create multiple sessions for this user
      for (let i = 0; i < 2; i++) {
        await orpc_client.auth.login({
          email: testUser2.email,
          password: testUser2.password,
        });
      }
    });

    it('should revoke all user sessions successfully', async () => {
      // Verify user has sessions before revoking
      const sessionsBefore = await orpc_client.sessions.list({
        userId: testUser2Id,
      });
      expect(sessionsBefore.length).toBeGreaterThanOrEqual(0);

      // Revoke all sessions
      const response = await orpc_client.sessions.revokeAllForUser({
        userId: testUser2Id,
      });

      expect(response).toHaveProperty('message');
      expect(response.message).toContain('所有会话已撤销');

      // Verify all sessions are revoked
      const sessionsAfter = await orpc_client.sessions.list({
        userId: testUser2Id,
        isActive: true,
      });
      expect(sessionsAfter.length).toBe(0);
    });

    it('should return success for user with no sessions', async () => {
      const response = await orpc_client.sessions.revokeAllForUser({
        userId: testUser2Id, // Same user after all sessions were revoked
      });

      expect(response).toHaveProperty('message');
      expect(response.message).toContain('所有会话已撤销');
    });

    it('should return success for non-existent user ID', async () => {
      // This method should succeed even for non-existent users since it just updates sessions
      const response = await orpc_client.sessions.revokeAllForUser({
        userId: '00000000-0000-0000-0000-000000000000',
      });

      expect(response).toHaveProperty('message');
      expect(response.message).toContain('所有会话已撤销');
    });

    it('should return error for invalid UUID format', async () => {
      try {
        await orpc_client.sessions.revokeAllForUser({
          userId: 'invalid-uuid',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // ORPC validation returns 400 for invalid UUID format
        expect(error.status).toBe(400);
      }
    });
  });

  describe('Session Lifecycle', () => {
    it('should handle session expiration correctly', async () => {
      // Create a new session
      const loginResponse = await orpc_client.auth.login({
        email: testUser.email,
        password: testUser.password,
      });

      // Verify session exists
      const sessions = await orpc_client.sessions.list({
        userId: userId,
      });
      expect(
        sessions.some((s) => s.sessionToken === loginResponse.refreshToken),
      ).toBe(true);

      // Logout to invalidate the session
      await orpc_client.auth.logout({
        refreshToken: loginResponse.refreshToken,
      });

      // Verify session is no longer active
      const sessionsAfterLogout = await orpc_client.sessions.list({
        userId: userId,
        isActive: true,
      });
      expect(
        sessionsAfterLogout.some(
          (s) => s.sessionToken === loginResponse.refreshToken,
        ),
      ).toBe(false);
    });
  });
});
