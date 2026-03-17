import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import mailRouter from './mail.router.js';
import { PostgreMailStorage } from '../lib/storage/postgreMailStorage.js';
import { MailAddress, OutgoingMail } from '../lib/storage/type.js';

describe('Mail Router E2E', () => {
  let app: ReturnType<typeof Fastify>;
  let storage: PostgreMailStorage;
  const testAddress1: MailAddress = 'sender@expert';
  const testAddress2: MailAddress = 'receiver@expert';

  beforeAll(async () => {
    // Create Fastify instance
    app = Fastify({ logger: false });

    // Create and initialize storage
    storage = new PostgreMailStorage();
    await storage.initialize();

    // Decorate with storage
    app.decorate('mailStorage', storage);

    // Register routes (router already has /api/v1/mail prefix built-in)
    await app.register(mailRouter);

    // Start server
    await app.listen({ port: 3001 });

    // Register test addresses
    await storage.registerAddress(testAddress1);
    await storage.registerAddress(testAddress2);
  });

  afterAll(async () => {
    await app.close();
    await storage.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const inbox1 = await storage.getInbox(testAddress1);
    for (const msg of inbox1.messages) {
      await storage.deleteMessage(msg.messageId);
    }
    const inbox2 = await storage.getInbox(testAddress2);
    for (const msg of inbox2.messages) {
      await storage.deleteMessage(msg.messageId);
    }
  });

  describe('POST /api/v1/mail/send', () => {
    it('should send mail to recipient', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Test Subject',
          body: 'Test body content',
          priority: 'normal',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.messageId).toBeDefined();
      expect(body.sentAt).toBeDefined();
    });

    it('should send to multiple recipients', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: [testAddress2, 'third@expert'],
          subject: 'Broadcast test',
          body: 'Testing multiple recipients',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          // missing to and subject
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/mail/inbox/:address', () => {
    it('should get inbox messages', async () => {
      // First send a message
      await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Inbox test',
          body: 'Check inbox',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/inbox/${encodeURIComponent(testAddress2)}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.address).toBe(testAddress2);
      expect(body.messages).toBeDefined();
      expect(body.total).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/inbox/${encodeURIComponent(testAddress2)}?limit=5&offset=0`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages.length).toBeLessThanOrEqual(5);
    });

    it('should filter unread only', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/inbox/${encodeURIComponent(testAddress2)}?unreadOnly=true`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.unread).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/v1/mail/inbox/:address/unread', () => {
    it('should get unread count', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/inbox/${encodeURIComponent(testAddress2)}/unread`,
      });

      expect(response.statusCode).toBe(200);
      const count = parseInt(response.body);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/v1/mail/:messageId/read', () => {
    it('should mark message as read', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Mark as read test',
          body: 'Test marking as read',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Mark as read
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/read`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/:messageId/unread', () => {
    it('should mark message as unread', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Mark as unread test',
          body: 'Test marking as unread',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Mark as read then unread
      await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/read`,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/unread`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/:messageId/star', () => {
    it('should star message', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Star test',
          body: 'Test starring',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/star`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/:messageId/unstar', () => {
    it('should unstar message', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Unstar test',
          body: 'Test unstarring',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Star then unstar
      await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/star`,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/unstar`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/mail/:messageId', () => {
    it('should delete message', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Delete test',
          body: 'Test deleting',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/mail/${messageId}_0`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/search', () => {
    it('should search by subject', async () => {
      // Send a message first
      await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Unique Search Term 12345',
          body: 'Search test content',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/search',
        payload: {
          subject: 'Unique Search Term',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should search by sender', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/search',
        payload: {
          from: testAddress1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });

    it('should filter by unread', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/search',
        payload: {
          unread: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('POST /api/v1/mail/register', () => {
    it('should register new address', async () => {
      const newAddress = 'newuser@expert';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/register',
        payload: {
          address: newAddress,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Health check', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.health).toBe(true);
      expect(body.timestamp).toBeDefined();
    });
  });
});
