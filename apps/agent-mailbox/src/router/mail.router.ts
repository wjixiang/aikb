import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { PostgreMailStorage } from '../lib/storage/postgreMailStorage.js';
import {
  type IMailStorage,
  type MailAddress,
  type OutgoingMail,
  type InboxQuery,
  type SearchQuery,
  type ReplyMail,
  type BatchOperation,
} from '../lib/storage/type.js';
import {
  recordEmailSent,
  recordInboxQuery,
  recordMessageOperation,
  recordSearchQuery,
  recordAddressRegistration,
  recordError,
  requestDurationHistogram,
} from '../lib/metrics/index.js';
import { createLogger } from '../lib/logger.js';
import { config } from '../config.js';
import {
  validateOutgoingMail,
  validateMailAddress,
  validateMailAddresses,
  validateMessageId,
  validatePagination,
  validateSort,
  validateSearchQuery,
  sanitizeOutgoingMail,
  sanitizePlainText,
  sanitizeSearchQuery,
  containsNoSqlInjection,
} from '../lib/security/index.js';
import {
  outgoingMailSchema,
  replyMailSchema,
  inboxQuerySchema,
  searchQuerySchema,
  batchOperationSchema,
  registerAddressSchema,
  messageIdParamSchema,
  addressParamSchema,
} from '../lib/validation/mailSchemas.js';
import { ValidationError, NotFoundError } from '../lib/errors/index.js';
import type { ZodSchema } from 'zod';

/**
 * Validate request body against Zod schema
 */
function validateBody<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw new ValidationError('Request validation failed', details);
  }
  return result.data;
}

/**
 * Validate request params against Zod schema
 */
function validateParams<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw new ValidationError('Invalid URL parameters', details);
  }
  return result.data;
}

/**
 * Validate querystring against Zod schema
 */
function validateQuery<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw new ValidationError('Invalid query parameters', details);
  }
  return result.data;
}

declare module 'fastify' {
  interface FastifyInstance {
    mailStorage: IMailStorage;
  }
}

/**
 * Mail Router Plugin
 * Provides REST API endpoints for mail operations
 */
const mailRouterPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
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
  const routeLogger = createLogger(undefined, { component: 'mail-router' });

  // ==================== Health Check ====================

  /**
   * GET /api/v1/mail/health
   * Health check endpoint
   */
  fastify.get(
    '/health',
    {
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
    },
    (request, reply) => {
      return { health: true, timestamp: new Date().toISOString() };
    },
  );

  // ==================== Send Mail ====================

  /**
   * POST /api/v1/mail/send
   * Send an email message
   */
  fastify.post<{
    Body: OutgoingMail;
  }>(
    '/send',
    {
      schema: {
        description: 'Send an email message',
        tags: ['mail'],
        body: {
          type: 'object',
          required: ['from', 'to', 'subject'],
          properties: {
            from: {
              type: 'string',
              description: 'Sender address (e.g., "pubmed@expert")',
            },
            to: {
              anyOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
              description: 'Recipient address or addresses',
            },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body content' },
            cc: {
              type: 'array',
              items: { type: 'string' },
              description: 'CC recipients',
            },
            bcc: {
              type: 'array',
              items: { type: 'string' },
              description: 'BCC recipients',
            },
            attachments: {
              type: 'array',
              items: { type: 'string' },
              description: 'Attachment S3 keys',
            },
            payload: { type: 'object', description: 'Custom payload data' },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
              default: 'normal',
            },
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'sendMail' });
      const startTime = Date.now();

      try {
        const result = await storage.send(request.body);
        const duration = (Date.now() - startTime) / 1000;

        if (result.success) {
          // Record metrics
          recordEmailSent(
            request.body.from,
            request.body.to,
            request.body.priority,
          );
          recordMessageOperation('send', 'success');

          logger.info('Email sent successfully', {
            from: request.body.from,
            to: request.body.to,
            messageId: result.messageId,
            durationMs: Date.now() - startTime,
          });
        } else {
          recordMessageOperation('send', 'failure');
          recordError('storage', '/mail/send', 'sendMail');
          logger.error('Failed to send email', new Error(result.error || 'Unknown error'), {
            from: request.body.from,
            to: request.body.to,
          });
        }

        // Record request duration
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/send', status_code: result.success ? 200 : 500 },
          duration,
        );

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('send', 'error');
        recordError('exception', '/mail/send', 'sendMail');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/send', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while sending email',
          error instanceof Error ? error : undefined,
          { from: request.body.from, to: request.body.to },
        );
        throw error;
      }
    },
  );

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
  }>(
    '/inbox/:address',
    {
      schema: {
        description: 'Get inbox messages for an address',
        tags: ['mail'],
        params: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Mailbox address (e.g., "pubmed@expert")',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 20 },
            offset: { type: 'number', default: 0 },
            unreadOnly: { type: 'boolean', default: false },
            starredOnly: { type: 'boolean', default: false },
            sortBy: {
              type: 'string',
              enum: ['sentAt', 'receivedAt', 'subject', 'priority'],
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
            },
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'getInbox' });
      const startTime = Date.now();

      try {
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

        const result = await storage.getInbox(address, query);
        const duration = (Date.now() - startTime) / 1000;

        // Record metrics
        recordInboxQuery(address, query.unreadOnly, query.starredOnly);
        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/inbox/:address', status_code: 200 },
          duration,
        );

        logger.info('Inbox retrieved', {
          address,
          total: result.total,
          unread: result.unread,
          durationMs: Date.now() - startTime,
        });

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordError('exception', '/mail/inbox/:address', 'getInbox');
        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/inbox/:address', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while retrieving inbox',
          error instanceof Error ? error : undefined,
          { address: request.params.address },
        );
        throw error;
      }
    },
  );

  // ==================== Get Unread Count ====================

  /**
   * GET /api/v1/mail/inbox/:address/unread
   * Get unread message count for an address
   */
  fastify.get<{
    Params: { address: string };
  }>(
    '/inbox/:address/unread',
    {
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'getUnreadCount' });
      const startTime = Date.now();

      try {
        const { address } = request.params;
        const count = await storage.getUnreadCount(address as MailAddress);
        const duration = (Date.now() - startTime) / 1000;

        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/inbox/:address/unread', status_code: 200 },
          duration,
        );

        logger.debug('Unread count retrieved', {
          address,
          count,
          durationMs: Date.now() - startTime,
        });

        return count;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordError('exception', '/mail/inbox/:address/unread', 'getUnreadCount');
        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/inbox/:address/unread', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while getting unread count',
          error instanceof Error ? error : undefined,
          { address: request.params.address },
        );
        throw error;
      }
    },
  );

  // ==================== Mark as Read ====================

  /**
   * POST /api/v1/mail/:messageId/read
   * Mark a message as read
   */
  fastify.post<{
    Params: { messageId: string };
  }>(
    '/:messageId/read',
    {
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'markAsRead' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.markAsRead(messageId);
        const duration = (Date.now() - startTime) / 1000;

        recordMessageOperation('markAsRead', result.success ? 'success' : 'failure');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/read', status_code: result.success ? 200 : 500 },
          duration,
        );

        if (result.success) {
          logger.debug('Message marked as read', { messageId });
        } else {
          logger.warn('Failed to mark message as read', { messageId, error: result.error });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('markAsRead', 'error');
        recordError('exception', '/mail/:messageId/read', 'markAsRead');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/read', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while marking message as read',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Mark as Unread ====================

  /**
   * POST /api/v1/mail/:messageId/unread
   * Mark a message as unread
   */
  fastify.post<{
    Params: { messageId: string };
  }>(
    '/:messageId/unread',
    {
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'markAsUnread' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.markAsUnread(messageId);
        const duration = (Date.now() - startTime) / 1000;

        recordMessageOperation('markAsUnread', result.success ? 'success' : 'failure');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/unread', status_code: result.success ? 200 : 500 },
          duration,
        );

        if (result.success) {
          logger.debug('Message marked as unread', { messageId });
        } else {
          logger.warn('Failed to mark message as unread', { messageId, error: result.error });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('markAsUnread', 'error');
        recordError('exception', '/mail/:messageId/unread', 'markAsUnread');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/unread', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while marking message as unread',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Star Message ====================

  /**
   * POST /api/v1/mail/:messageId/star
   * Star a message
   */
  fastify.post<{
    Params: { messageId: string };
  }>(
    '/:messageId/star',
    {
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'starMessage' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.starMessage(messageId);
        const duration = (Date.now() - startTime) / 1000;

        recordMessageOperation('star', result.success ? 'success' : 'failure');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/star', status_code: result.success ? 200 : 500 },
          duration,
        );

        if (result.success) {
          logger.debug('Message starred', { messageId });
        } else {
          logger.warn('Failed to star message', { messageId, error: result.error });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('star', 'error');
        recordError('exception', '/mail/:messageId/star', 'starMessage');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/star', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while starring message',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Unstar Message ====================

  /**
   * POST /api/v1/mail/:messageId/unstar
   * Unstar a message
   */
  fastify.post<{
    Params: { messageId: string };
  }>(
    '/:messageId/unstar',
    {
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'unstarMessage' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.unstarMessage(messageId);
        const duration = (Date.now() - startTime) / 1000;

        recordMessageOperation('unstar', result.success ? 'success' : 'failure');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/unstar', status_code: result.success ? 200 : 500 },
          duration,
        );

        if (result.success) {
          logger.debug('Message unstarred', { messageId });
        } else {
          logger.warn('Failed to unstar message', { messageId, error: result.error });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('unstar', 'error');
        recordError('exception', '/mail/:messageId/unstar', 'unstarMessage');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/unstar', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while unstarring message',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Delete Message ====================

  /**
   * DELETE /api/v1/mail/:messageId
   * Delete a message (soft delete)
   */
  fastify.delete<{
    Params: { messageId: string };
  }>(
    '/:messageId',
    {
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'deleteMessage' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.deleteMessage(messageId);
        const duration = (Date.now() - startTime) / 1000;

        recordMessageOperation('delete', result.success ? 'success' : 'failure');
        requestDurationHistogram.observe(
          { method: 'DELETE', route: '/mail/:messageId', status_code: result.success ? 200 : 500 },
          duration,
        );

        if (result.success) {
          logger.info('Message deleted', { messageId });
        } else {
          logger.warn('Failed to delete message', { messageId, error: result.error });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('delete', 'error');
        recordError('exception', '/mail/:messageId', 'deleteMessage');
        requestDurationHistogram.observe(
          { method: 'DELETE', route: '/mail/:messageId', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while deleting message',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Search Messages ====================

  /**
   * POST /api/v1/mail/search
   * Search messages across all mailboxes
   */
  fastify.post<{
    Body: SearchQuery;
  }>(
    '/search',
    {
      schema: {
        description: 'Search messages',
        tags: ['mail'],
        body: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Filter by sender' },
            to: { type: 'string', description: 'Filter by recipient' },
            subject: {
              type: 'string',
              description: 'Filter by subject contains',
            },
            body: { type: 'string', description: 'Filter by body contains' },
            unread: { type: 'boolean', description: 'Filter by unread status' },
            read: { type: 'boolean', description: 'Filter by read status' },
            starred: {
              type: 'boolean',
              description: 'Filter by starred status',
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent'],
            },
            dateFrom: {
              type: 'string',
              description: 'Filter by date from (ISO string)',
            },
            dateTo: {
              type: 'string',
              description: 'Filter by date to (ISO string)',
            },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                messageId: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' },
                from: { type: 'string' },
                to: { type: 'string' },
                cc: { type: 'array', items: { type: 'string' } },
                bcc: { type: 'array', items: { type: 'string' } },
                attachments: { type: 'array', items: { type: 'string' } },
                payload: { type: 'object' },
                priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
                status: {
                  type: 'object',
                  properties: {
                    read: { type: 'boolean' },
                    starred: { type: 'boolean' },
                    deleted: { type: 'boolean' },
                  },
                },
                taskId: { type: 'string' },
                sentAt: { type: 'string' },
                receivedAt: { type: 'string' },
                updatedAt: { type: 'string' },
                inReplyTo: { type: 'string' },
                references: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'search' });
      const startTime = Date.now();

      try {
        const result = await storage.search(request.body);
        const duration = (Date.now() - startTime) / 1000;

        recordSearchQuery();
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/search', status_code: 200 },
          duration,
        );

        logger.info('Search completed', {
          resultCount: result.length,
          durationMs: Date.now() - startTime,
        });

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordError('exception', '/mail/search', 'search');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/search', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while searching messages',
          error instanceof Error ? error : undefined,
        );
        throw error;
      }
    },
  );

  // ==================== Register Address ====================

  /**
   * POST /api/v1/mail/register
   * Register a new mailbox address
   */
  fastify.post<{
    Body: { address: string };
  }>(
    '/register',
    {
      schema: {
        description: 'Register a new mailbox address',
        tags: ['mail'],
        body: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
              description: 'Address to register (e.g., "pubmed@expert")',
            },
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
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'registerAddress' });
      const startTime = Date.now();

      try {
        const address = (request.params as { address?: string })?.address || request.body.address;
        const result = await storage.registerAddress(request.body.address);
        const duration = (Date.now() - startTime) / 1000;

        recordAddressRegistration(result.success);
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/register', status_code: result.success ? 200 : 500 },
          duration,
        );

        if (result.success) {
          logger.info('Address registered', { address: request.body.address });
        } else {
          logger.warn('Failed to register address', { address: request.body.address, error: result.error });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordAddressRegistration(false);
        recordError('exception', '/mail/register', 'registerAddress');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/register', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while registering address',
          error instanceof Error ? error : undefined,
          { address: request.body.address },
        );
        throw error;
      }
    },
  );

  // ==================== Get Message Detail ====================

  /**
   * GET /api/v1/mail/message/:messageId
   * Get a single message by ID
   */
  fastify.get<{
    Params: { messageId: string };
  }>(
    '/message/:messageId',
    {
      schema: {
        description: 'Get a single message by ID',
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
            description: 'Mail message object',
            properties: {
              messageId: { type: 'string' },
              subject: { type: 'string' },
              from: { type: 'string' },
              to: { type: 'string' },
              body: { type: 'string' },
              priority: { type: 'string' },
              status: { type: 'object' },
              sentAt: { type: 'string' },
              receivedAt: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'getMessage' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const message = await storage.getMessage(messageId);
        const duration = (Date.now() - startTime) / 1000;

        if (!message) {
          requestDurationHistogram.observe(
            { method: 'GET', route: '/mail/message/:messageId', status_code: 404 },
            duration,
          );
          logger.warn('Message not found', { messageId });
          return reply.status(404).send({ error: 'Message not found' });
        }

        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/message/:messageId', status_code: 200 },
          duration,
        );
        logger.debug('Message retrieved', { messageId });

        return message;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordError('exception', '/mail/message/:messageId', 'getMessage');
        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/message/:messageId', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while retrieving message',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Reply to Message ====================

  /**
   * POST /api/v1/mail/:messageId/reply
   * Reply to a message
   */
  fastify.post<{
    Params: { messageId: string };
    Body: ReplyMail;
  }>(
    '/:messageId/reply',
    {
      schema: {
        description: 'Reply to a message',
        tags: ['mail'],
        params: {
          type: 'object',
          properties: {
            messageId: { type: 'string', description: 'Message ID to reply to' },
          },
        },
        body: {
          type: 'object',
          required: ['body'],
          properties: {
            body: { type: 'string', description: 'Reply body content' },
            attachments: {
              type: 'array',
              items: { type: 'string' },
              description: 'Attachment S3 keys',
            },
            payload: { type: 'object', description: 'Custom payload data' },
            from: {
              type: 'string',
              description: 'Sender address (optional, defaults to original recipient)',
            },
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
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'replyToMessage' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.replyToMessage(messageId, request.body);
        const duration = (Date.now() - startTime) / 1000;

        if (!result.success) {
          const statusCode = result.error?.includes('not found') ? 404 : 500;
          requestDurationHistogram.observe(
            { method: 'POST', route: '/mail/:messageId/reply', status_code: statusCode },
            duration,
          );
          recordError('storage', '/mail/:messageId/reply', 'replyToMessage');
          logger.warn('Failed to reply to message', { messageId, error: result.error });
          return reply.status(statusCode).send({ error: result.error });
        }

        recordMessageOperation('reply', 'success');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/reply', status_code: 200 },
          duration,
        );

        logger.info('Reply sent', { messageId, replyMessageId: result.messageId });
        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation('reply', 'error');
        recordError('exception', '/mail/:messageId/reply', 'replyToMessage');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/:messageId/reply', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while replying to message',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Get Thread ====================

  /**
   * GET /api/v1/mail/thread/:messageId
   * Get message thread (conversation chain)
   */
  fastify.get<{
    Params: { messageId: string };
  }>(
    '/thread/:messageId',
    {
      schema: {
        description: 'Get message thread (conversation chain)',
        tags: ['mail'],
        params: {
          type: 'object',
          properties: {
            messageId: {
              type: 'string',
              description: 'Any message ID in the thread',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              rootMessage: {
                type: 'object',
                properties: {
                  messageId: { type: 'string' },
                  subject: { type: 'string' },
                  from: { type: 'string' },
                  to: { type: 'string' },
                  body: { type: 'string' },
                  priority: { type: 'string' },
                  status: { type: 'object' },
                  sentAt: { type: 'string' },
                  receivedAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    messageId: { type: 'string' },
                    subject: { type: 'string' },
                    from: { type: 'string' },
                    to: { type: 'string' },
                    body: { type: 'string' },
                    priority: { type: 'string' },
                    status: { type: 'object' },
                    sentAt: { type: 'string' },
                    receivedAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'getThread' });
      const startTime = Date.now();

      try {
        const { messageId } = request.params;
        const result = await storage.getThread(messageId);
        const duration = (Date.now() - startTime) / 1000;

        if (!result) {
          requestDurationHistogram.observe(
            { method: 'GET', route: '/mail/thread/:messageId', status_code: 404 },
            duration,
          );
          logger.warn('Thread not found', { messageId });
          return reply.status(404).send({ error: 'Thread not found' });
        }

        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/thread/:messageId', status_code: 200 },
          duration,
        );
        logger.debug('Thread retrieved', { messageId, total: result.total });

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordError('exception', '/mail/thread/:messageId', 'getThread');
        requestDurationHistogram.observe(
          { method: 'GET', route: '/mail/thread/:messageId', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while retrieving thread',
          error instanceof Error ? error : undefined,
          { messageId: request.params.messageId },
        );
        throw error;
      }
    },
  );

  // ==================== Batch Operations ====================

  /**
   * POST /api/v1/mail/batch
   * Perform batch operations on messages
   */
  fastify.post<{
    Body: BatchOperation;
  }>(
    '/batch',
    {
      schema: {
        description: 'Perform batch operations on messages',
        tags: ['mail'],
        body: {
          type: 'object',
          required: ['operation', 'messageIds'],
          properties: {
            operation: {
              type: 'string',
              enum: ['markAsRead', 'markAsUnread', 'star', 'unstar', 'delete'],
              description: 'Batch operation type',
            },
            messageIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of message IDs to operate on',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              succeeded: { type: 'number' },
              failed: { type: 'number' },
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    messageId: { type: 'string' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const logger = createLogger(request, { operation: 'batchOperation' });
      const startTime = Date.now();

      try {
        const result = await storage.batchOperation(request.body);
        const duration = (Date.now() - startTime) / 1000;

        recordMessageOperation(`batch_${request.body.operation}`, result.success ? 'success' : 'failure');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/batch', status_code: result.success ? 200 : 500 },
          duration,
        );

        logger.info('Batch operation completed', {
          operation: request.body.operation,
          messageCount: request.body.messageIds.length,
          succeeded: result.succeeded,
          failed: result.failed,
          durationMs: Date.now() - startTime,
        });

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        recordMessageOperation(`batch_${request.body.operation}`, 'error');
        recordError('exception', '/mail/batch', 'batchOperation');
        requestDurationHistogram.observe(
          { method: 'POST', route: '/mail/batch', status_code: 500 },
          duration,
        );

        logger.error(
          'Exception while performing batch operation',
          error instanceof Error ? error : undefined,
          { operation: request.body.operation, messageCount: request.body.messageIds.length },
        );
        throw error;
      }
    },
  );

  routeLogger.info('Mail routes registered');
};

export default mailRouterPlugin;
