import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import mailRouter from './mail.router.js';

// Mock the PostgreMailStorage
vi.mock('../lib/storage/postgreMailStorage.js', () => {
  return {
    PostgreMailStorage: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'test-message-id',
        sentAt: new Date().toISOString(),
      }),
      getInbox: vi.fn().mockResolvedValue({
        address: 'test@expert',
        messages: [
          {
            messageId: 'msg-1',
            subject: 'Test Message',
            from: 'sender@expert',
            to: 'test@expert',
            body: 'Test body',
            priority: 'normal',
            status: { read: false, starred: false, deleted: false },
            sentAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unread: 1,
        starred: 0,
      }),
      getMessage: vi.fn().mockResolvedValue({
        messageId: 'msg-1',
        subject: 'Test Message',
        from: 'sender@expert',
        to: 'test@expert',
        body: 'Test body',
        priority: 'normal',
        status: { read: false, starred: false, deleted: false },
        sentAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockResolvedValue({ success: true }),
      markAsUnread: vi.fn().mockResolvedValue({ success: true }),
      starMessage: vi.fn().mockResolvedValue({ success: true }),
      unstarMessage: vi.fn().mockResolvedValue({ success: true }),
      deleteMessage: vi.fn().mockResolvedValue({ success: true }),
      search: vi.fn().mockResolvedValue([]),
      replyToMessage: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'reply-msg-id',
        sentAt: new Date().toISOString(),
      }),
      getThread: vi.fn().mockResolvedValue({
        rootMessage: {
          messageId: 'msg-1',
          subject: 'Test Message',
          from: 'sender@expert',
          to: 'test@expert',
          body: 'Test body',
          priority: 'normal',
          status: { read: false, starred: false, deleted: false },
          sentAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        messages: [
          {
            messageId: 'msg-1',
            subject: 'Test Message',
            from: 'sender@expert',
            to: 'test@expert',
            body: 'Test body',
            priority: 'normal',
            status: { read: false, starred: false, deleted: false },
            sentAt: new Date().toISOString(),
            receivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
      }),
      batchOperation: vi.fn().mockResolvedValue({
        success: true,
        succeeded: 2,
        failed: 0,
      }),
      registerAddress: vi.fn().mockResolvedValue({ success: true, registered: true }),
      isAddressRegistered: vi.fn().mockResolvedValue(true),
      getRegisteredAddresses: vi.fn().mockResolvedValue(['test@expert']),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Mail Router Unit', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(mailRouter);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/mail/health', () => {
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

  describe('POST /api/v1/mail/send', () => {
    it('should send mail with valid payload', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: 'sender@expert',
          to: 'receiver@expert',
          subject: 'Test Subject',
          body: 'Test body content',
          priority: 'normal',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.messageId).toBe('test-message-id');
      expect(body.sentAt).toBeDefined();
    });

    it('should send to multiple recipients', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/send',
        payload: {
          from: 'sender@expert',
          to: ['receiver1@expert', 'receiver2@expert'],
          subject: 'Broadcast',
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
          from: 'sender@expert',
          // missing to and subject
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/mail/inbox/:address', () => {
    it('should get inbox messages', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/inbox/test@expert',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.address).toBe('test@expert');
      expect(body.messages).toBeDefined();
      expect(body.messages.length).toBe(1);
      expect(body.total).toBe(1);
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/inbox/test@expert?limit=5&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messages.length).toBeLessThanOrEqual(5);
    });

    it('should filter unread only', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/inbox/test@expert?unreadOnly=true',
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
        url: '/api/v1/mail/inbox/test@expert/unread',
      });

      expect(response.statusCode).toBe(200);
      const count = parseInt(response.body);
      expect(count).toBe(1);
    });
  });

  describe('POST /api/v1/mail/:messageId/read', () => {
    it('should mark message as read', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/msg-1/read',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/:messageId/unread', () => {
    it('should mark message as unread', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/msg-1/unread',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/:messageId/star', () => {
    it('should star message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/msg-1/star',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/:messageId/unstar', () => {
    it('should unstar message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/msg-1/unstar',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/mail/:messageId', () => {
    it('should delete message', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/mail/msg-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/mail/search', () => {
    it('should search by subject', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/search',
        payload: {
          subject: 'Test',
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
          from: 'sender@expert',
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
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/register',
        payload: {
          address: 'newuser@expert',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 for missing address', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/register',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/mail/message/:messageId', () => {
    it('should get message by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/message/msg-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.messageId).toBe('msg-1');
      expect(body.subject).toBe('Test Message');
    });
  });

  describe('POST /api/v1/mail/:messageId/reply', () => {
    it('should reply to a message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/msg-1/reply',
        payload: {
          body: 'This is a reply',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.messageId).toBe('reply-msg-id');
    });

    it('should return 400 for missing body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/msg-1/reply',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/mail/thread/:messageId', () => {
    it('should get message thread', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/mail/thread/msg-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.rootMessage).toBeDefined();
      expect(body.messages).toBeDefined();
      expect(body.total).toBe(1);
    });
  });

  describe('POST /api/v1/mail/batch', () => {
    it('should perform batch mark as read', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'markAsRead',
          messageIds: ['msg-1', 'msg-2'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.succeeded).toBe(2);
      expect(body.failed).toBe(0);
    });

    it('should perform batch delete', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'delete',
          messageIds: ['msg-1', 'msg-2'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
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

    it('should return 400 for missing messageIds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/mail/batch',
        payload: {
          operation: 'markAsRead',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
