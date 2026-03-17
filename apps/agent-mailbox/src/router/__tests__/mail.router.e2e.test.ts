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

  describe('GET /api/v1/mail/message/:messageId', () => {
    it('should get message by ID', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Get message test',
          body: 'Test getting message by ID',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Get the message
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/message/${messageId}_0`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messageId).toBe(`${messageId}_0`);
      expect(body.subject).toBe('Get message test');
      expect(body.from).toBe(testAddress1);
    });

    it('should return 404 for non-existent message', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/message/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/mail/:messageId/reply', () => {
    it('should reply to a message', async () => {
      // Send a message first
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Reply test',
          body: 'Original message',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Reply to the message
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/reply`,
        payload: {
          body: 'This is my reply',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.messageId).toBeDefined();
      expect(body.sentAt).toBeDefined();

      // Verify the reply was sent to the original sender
      const senderInbox = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/inbox/${encodeURIComponent(testAddress1)}`,
      });
      const inboxBody = JSON.parse(senderInbox.body);
      const replyMessage = inboxBody.messages.find((m: { subject: string }) =>
        m.subject === 'Re: Reply test'
      );
      expect(replyMessage).toBeDefined();
      expect(replyMessage.body).toBe('This is my reply');
    });

    it('should return 404 for non-existent message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/non-existent-id/reply',
        payload: {
          body: 'This is a reply',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/mail/thread/:messageId', () => {
    it('should get message thread', async () => {
      // Send an original message
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Thread test',
          body: 'Original message',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Reply to create a thread
      await app.inject({
        method: 'POST',
        url: `/api/v1/mail/${messageId}_0/reply`,
        payload: {
          body: 'First reply',
        },
      });

      // Get the thread
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/mail/thread/${messageId}_0`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.rootMessage).toBeDefined();
      expect(body.messages).toBeDefined();
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.rootMessage.subject).toBe('Thread test');
    });

    it('should return 404 for non-existent thread', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/thread/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/mail/batch', () => {
    it('should batch mark messages as read', async () => {
      // Send multiple messages
      const sendResponse1 = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Batch test 1',
          body: 'Message 1',
        },
      });
      const { messageId: msgId1 } = JSON.parse(sendResponse1.body);

      const sendResponse2 = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Batch test 2',
          body: 'Message 2',
        },
      });
      const { messageId: msgId2 } = JSON.parse(sendResponse2.body);

      // Batch mark as read
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'markAsRead',
          messageIds: [`${msgId1}_0`, `${msgId2}_0`],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(0);
    });

    it('should batch star messages', async () => {
      // Send a message
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Batch star test',
          body: 'Test message',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Batch star
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'star',
          messageIds: [`${messageId}_0`],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.succeeded).toBe(1);
    });

    it('should batch delete messages', async () => {
      // Send multiple messages
      const sendResponse1 = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Batch delete 1',
          body: 'Message to delete',
        },
      });
      const { messageId: msgId1 } = JSON.parse(sendResponse1.body);

      const sendResponse2 = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Batch delete 2',
          body: 'Message to delete',
        },
      });
      const { messageId: msgId2 } = JSON.parse(sendResponse2.body);

      // Batch delete
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'delete',
          messageIds: [`${msgId1}_0`, `${msgId2}_0`],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.succeeded).toBe(2);
    });

    it('should handle partial failures in batch operations', async () => {
      // Send one message
      const sendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: testAddress1,
          to: testAddress2,
          subject: 'Partial batch test',
          body: 'Test message',
        },
      });
      const { messageId } = JSON.parse(sendResponse.body);

      // Try to mark one valid and one invalid message
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'markAsRead',
          messageIds: [`${messageId}_0`, 'non-existent-id'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Should succeed for valid message, fail for non-existent
      expect(body.succeeded).toBeGreaterThanOrEqual(0);
      expect(body.failed).toBeGreaterThanOrEqual(0);
    });

    it('should return 400 for missing operation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          messageIds: ['msg-1'],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid operation type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'invalidOperation',
          messageIds: ['msg-1'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
