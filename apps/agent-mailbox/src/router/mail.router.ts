import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PostgreMailStorage } from '../lib/storage/postgreMailStorage.js';
import {
  type IMailStorage,
  type MailAddress,
  type OutgoingMail,
  type InboxQuery,
  type SearchQuery,
} from '../lib/storage/type.js';

declare module 'fastify' {
  interface FastifyInstance {
    mailStorage: IMailStorage;
  }
}

/**
 * Mail Router Plugin
 * Provides REST API endpoints for mail operations
 */
const mailRouterPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Decorate fastify with storage instance
  const storage = new PostgreMailStorage();
  await storage.initialize();
  fastify.decorate('mailStorage', storage);

  // Register routes under /api/v1/mail
  fastify.register(mailRoutes, { prefix: '/api/v1/mail' });
};

/**
 * Mail Routes
 */
const mailRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const storage = fastify.mailStorage;

  // ==================== Health Check ====================

  /**
   * GET /api/v1/mail/health
   * Health check endpoint
   */
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            health: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, (request, reply) => {
    return { health: true, timestamp: new Date().toISOString() };
  });

  // ==================== Send Mail ====================

  /**
   * POST /api/v1/mail/send
   * Send an email message
   */
  fastify.post<{
    Body: OutgoingMail;
  }>('/send', {
    schema: {
      description: 'Send an email message',
      tags: ['mail'],
      body: {
        type: 'object',
        required: ['from', 'to', 'subject'],
        properties: {
          from: { type: 'string', description: 'Sender address (e.g., "pubmed@expert")' },
          to: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Recipient address or addresses' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' },
          cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
          bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
          attachments: { type: 'array', items: { type: 'string' }, description: 'Attachment S3 keys' },
          payload: { type: 'object', description: 'Custom payload data' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
          taskId: { type: 'string', description: 'Associated task ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            messageId: { type: 'string' },
            sentAt: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const result = await storage.send(request.body);
    return result;
  });

  // ==================== Get Inbox ====================

  /**
   * GET /api/v1/mail/inbox/:address
   * Get inbox messages for an address
   */
  fastify.get<{
    Params: { address: string };
    Querystring: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      starredOnly?: boolean;
      sortBy?: 'sentAt' | 'receivedAt' | 'subject' | 'priority';
      sortOrder?: 'asc' | 'desc';
    };
  }>('/inbox/:address', {
    schema: {
      description: 'Get inbox messages for an address',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Mailbox address (e.g., "pubmed@expert")' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 },
          offset: { type: 'number', default: 0 },
          unreadOnly: { type: 'boolean', default: false },
          starredOnly: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['sentAt', 'receivedAt', 'subject', 'priority'] },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            messages: { type: 'array' },
            total: { type: 'number' },
            unread: { type: 'number' },
            starred: { type: 'number' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { address } = request.params;
    const query: InboxQuery = {
      pagination: {
        limit: request.query.limit || 20,
        offset: request.query.offset || 0,
      },
      unreadOnly: request.query.unreadOnly,
      starredOnly: request.query.starredOnly,
      sortBy: request.query.sortBy,
      sortOrder: request.query.sortOrder,
    };
    const result = await storage.getInbox(address as MailAddress, query);
    return result;
  });

  // ==================== Get Unread Count ====================

  /**
   * GET /api/v1/mail/inbox/:address/unread
   * Get unread message count for an address
   */
  fastify.get<{
    Params: { address: string };
  }>('/inbox/:address/unread', {
    schema: {
      description: 'Get unread message count',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Mailbox address' },
        },
      },
      response: {
        200: { type: 'number' },
      },
    },
  }, async (request, reply) => {
    const { address } = request.params;
    const count = await storage.getUnreadCount(address as MailAddress);
    return count;
  });

  // ==================== Mark as Read ====================

  /**
   * POST /api/v1/mail/:messageId/read
   * Mark a message as read
   */
  fastify.post<{
    Params: { messageId: string };
  }>('/:messageId/read', {
    schema: {
      description: 'Mark message as read',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params;
    const result = await storage.markAsRead(messageId);
    return result;
  });

  // ==================== Mark as Unread ====================

  /**
   * POST /api/v1/mail/:messageId/unread
   * Mark a message as unread
   */
  fastify.post<{
    Params: { messageId: string };
  }>('/:messageId/unread', {
    schema: {
      description: 'Mark message as unread',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params;
    const result = await storage.markAsUnread(messageId);
    return result;
  });

  // ==================== Star Message ====================

  /**
   * POST /api/v1/mail/:messageId/star
   * Star a message
   */
  fastify.post<{
    Params: { messageId: string };
  }>('/:messageId/star', {
    schema: {
      description: 'Star a message',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params;
    const result = await storage.starMessage(messageId);
    return result;
  });

  // ==================== Unstar Message ====================

  /**
   * POST /api/v1/mail/:messageId/unstar
   * Unstar a message
   */
  fastify.post<{
    Params: { messageId: string };
  }>('/:messageId/unstar', {
    schema: {
      description: 'Unstar a message',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params;
    const result = await storage.unstarMessage(messageId);
    return result;
  });

  // ==================== Delete Message ====================

  /**
   * DELETE /api/v1/mail/:messageId
   * Delete a message (soft delete)
   */
  fastify.delete<{
    Params: { messageId: string };
  }>('/:messageId', {
    schema: {
      description: 'Delete a message (soft delete)',
      tags: ['mail'],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { messageId } = request.params;
    const result = await storage.deleteMessage(messageId);
    return result;
  });

  // ==================== Search Messages ====================

  /**
   * POST /api/v1/mail/search
   * Search messages across all mailboxes
   */
  fastify.post<{
    Body: SearchQuery;
  }>('/search', {
    schema: {
      description: 'Search messages',
      tags: ['mail'],
      body: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Filter by sender' },
          to: { type: 'string', description: 'Filter by recipient' },
          subject: { type: 'string', description: 'Filter by subject contains' },
          body: { type: 'string', description: 'Filter by body contains' },
          unread: { type: 'boolean', description: 'Filter by unread status' },
          read: { type: 'boolean', description: 'Filter by read status' },
          starred: { type: 'boolean', description: 'Filter by starred status' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          dateFrom: { type: 'string', description: 'Filter by date from (ISO string)' },
          dateTo: { type: 'string', description: 'Filter by date to (ISO string)' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const result = await storage.search(request.body);
    return result;
  });

  // ==================== Register Address ====================

  /**
   * POST /api/v1/mail/register
   * Register a new mailbox address
   */
  fastify.post<{
    Body: { address: string };
  }>('/register', {
    schema: {
      description: 'Register a new mailbox address',
      tags: ['mail'],
      body: {
        type: 'object',
        required: ['address'],
        properties: {
          address: { type: 'string', description: 'Address to register (e.g., "pubmed@expert")' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { address } = request.body;
    const result = await storage.registerAddress(address as MailAddress);
    return result;
  });
};

export default mailRouterPlugin;
