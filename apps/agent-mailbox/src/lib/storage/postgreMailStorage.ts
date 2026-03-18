import {
  PrismaClient,
  Prisma,
  type MailMessage as PrismaMailMessage,
  type RegisteredAddress as PrismaRegisteredAddress,
} from '../../generated/prisma/index.js';
import {
  type IMailStorage,
  type MailAddress,
  type OutgoingMail,
  type MailMessage,
  type SendResult,
  type StorageResult,
  type RegisterAddressResult,
  type InboxQuery,
  type InboxResult,
  type SearchQuery,
  type ReplyMail,
  type ReplyResult,
  type ThreadResult,
  type BatchOperation,
  type BatchOperationResult,
  parseMailAddress,
} from './type.js';
import { subscriptionManager } from '../websocket/subscriptionManager.js';
import { getErrorMessage } from '../utils/errors.js';
import { now } from '../utils/date.js';
import { createLogger } from '../logger.js';
import { StorageError, NotFoundError } from '../errors/index.js';

/**
 * PostgreSQL-based mail storage implementation
 * Uses Prisma ORM to interact with PostgreSQL database
 */
export class PostgreMailStorage implements IMailStorage {
  private prisma: PrismaClient;
  private logger: ReturnType<typeof createLogger>;

  constructor() {
    this.prisma = new PrismaClient();
    this.logger = createLogger(undefined, { component: 'PostgreMailStorage' });
  }

  /**
   * Initialize the storage backend
   */
  async initialize(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info('PostgreSQL storage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL storage', error instanceof Error ? error : undefined);
      throw new StorageError('Failed to initialize database connection', error instanceof Error ? error : undefined);
    }
  }

  /**
   * Convert internal MailMessage from DB to public MailMessage
   */
  private toMailMessage(dbMessage: PrismaMailMessage): MailMessage {
    return {
      messageId: dbMessage.messageId,
      from: dbMessage.from,
      to: dbMessage.to,
      cc: dbMessage.cc,
      bcc: dbMessage.bcc,
      subject: dbMessage.subject,
      body: dbMessage.body ?? undefined,
      attachments: dbMessage.attachments,
      payload: (dbMessage.payload as Record<string, unknown>) ?? undefined,
      priority: dbMessage.priority as MailMessage['priority'],
      taskId: dbMessage.taskId ?? undefined,
      status: {
        read: dbMessage.read,
        starred: dbMessage.starred,
        deleted: dbMessage.deleted,
      },
      sentAt: dbMessage.sentAt.toISOString(),
      receivedAt: dbMessage.createdAt.toISOString(),
      updatedAt: dbMessage.updatedAt.toISOString(),
    };
  }

  /**
   * Parse address to get user and domain
   */
  private parseAddress(address: MailAddress): {
    user: string;
    domain: string | null;
  } {
    const parsed = parseMailAddress(address);
    return {
      user: parsed.user,
      domain: parsed.domain || null,
    };
  }

  /**
   * Execute database operation with error handling
   * @param operation - Database operation to execute
   * @param errorMessage - Error message prefix
   * @returns Result of the operation
   */
  private async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string,
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: `${errorMessage}: ${getErrorMessage(error)}` };
    }
  }

  /**
   * Update address statistics
   * @param address - Address to update
   * @param field - Field to increment (totalSent or totalReceived)
   */
  private async updateAddressStats(
    address: MailAddress,
    field: 'totalSent' | 'totalReceived',
  ): Promise<void> {
    const { user, domain } = this.parseAddress(address);
    const currentTime = new Date();

    await this.prisma.registeredAddress.upsert({
      where: { address },
      create: {
        address,
        user,
        domain,
        active: true,
        [field]: 1,
      },
      update: {
        lastActiveAt: currentTime,
        [field]: { increment: 1 },
      },
    });
  }

  /**
   * Update message status field
   * @param messageId - Message ID
   * @param field - Status field to update
   * @param value - New value
   * @returns Storage result
   */
  private async updateMessageStatus(
    messageId: string,
    field: 'read' | 'starred' | 'deleted',
    value: boolean,
  ): Promise<StorageResult> {
    const result = await this.executeWithErrorHandling(
      () =>
        this.prisma.mailMessage.update({
          where: { messageId },
          data: { [field]: value, updatedAt: new Date() },
        }),
      `Failed to update message ${field} status`,
    );

    if (!result.success) {
      return { success: false, error: (result as { success: false; error: string }).error };
    }
    return { success: true };
  }

  /**
   * Send/save a mail message with transaction support
   */
  async send(mail: OutgoingMail): Promise<SendResult> {
    const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
    const currentTime = now();
    const sentAt = new Date(currentTime).toISOString();
    const baseMessageId = `mail_${currentTime}_${Math.random().toString(36).substring(2, 11)}`;

    this.logger.debug('Sending mail', {
      from: mail.from,
      to: recipients,
      subject: mail.subject,
      recipientCount: recipients.length,
    });

    try {
      // Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Prepare messages for each recipient
        const messages: Prisma.MailMessageCreateManyInput[] = recipients.map(
          (recipient, index) => ({
            messageId: `${baseMessageId}_${index}`,
            from: mail.from,
            to: recipient,
            cc: mail.cc ?? [],
            bcc: mail.bcc ?? [],
            subject: mail.subject,
            body: mail.body ?? null,
            attachments: mail.attachments ?? [],
            payload: (mail.payload as Prisma.InputJsonValue) ?? null,
            priority: mail.priority ?? 'normal',
            taskId: mail.taskId ?? null,
            inReplyTo: null,
            references: [],
            read: false,
            starred: false,
            deleted: false,
            sentAt: new Date(currentTime),
            createdAt: new Date(currentTime),
            updatedAt: new Date(currentTime),
          }),
        );

        // Insert all messages
        await tx.mailMessage.createMany({
          data: messages,
        });

        // Update sender statistics
        const { user: senderUser, domain: senderDomain } = this.parseAddress(mail.from);
        await tx.registeredAddress.upsert({
          where: { address: mail.from },
          create: {
            address: mail.from,
            user: senderUser,
            domain: senderDomain,
            active: true,
            totalSent: 1,
          },
          update: {
            lastActiveAt: new Date(currentTime),
            totalSent: { increment: 1 },
          },
        });

        // Update recipient statistics
        for (const recipient of recipients) {
          const { user, domain } = this.parseAddress(recipient);
          await tx.registeredAddress.upsert({
            where: { address: recipient },
            create: {
              address: recipient,
              user,
              domain,
              active: true,
              totalReceived: 1,
            },
            update: {
              lastActiveAt: new Date(currentTime),
              totalReceived: { increment: 1 },
            },
          });
        }

        return { success: true, messages };
      }, {
        // Transaction options for better reliability
        maxWait: 5000, // 5 seconds max wait for transaction
        timeout: 10000, // 10 seconds timeout
      });

      // Notify WebSocket subscribers (outside transaction to avoid blocking)
      for (const recipient of recipients) {
        const dbMessage = await this.prisma.mailMessage.findFirst({
          where: { messageId: `${baseMessageId}_${recipients.indexOf(recipient)}` },
        });
        if (dbMessage) {
          subscriptionManager.notifyNewMail(recipient, this.toMailMessage(dbMessage));
        }
      }

      this.logger.info('Mail sent successfully', {
        messageId: baseMessageId,
        from: mail.from,
        to: recipients,
        recipientCount: recipients.length,
      });

      return {
        success: true,
        messageId: baseMessageId,
        sentAt,
      };
    } catch (error) {
      this.logger.error('Failed to send mail', error instanceof Error ? error : undefined, {
        from: mail.from,
        to: recipients,
        subject: mail.subject,
      });

      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get messages for a specific inbox address
   */
  async getInbox(
    address: MailAddress,
    query?: InboxQuery,
  ): Promise<InboxResult> {
    try {
      const limit = query?.pagination?.limit ?? 20;
      const offset = query?.pagination?.offset ?? 0;

      // Build where clause
      const where: Prisma.MailMessageWhereInput = {
        to: address,
        deleted: false,
      };

      if (query?.unreadOnly) {
        where.read = false;
      }

      if (query?.starredOnly) {
        where.starred = true;
      }

      // Get counts and messages in parallel
      const [total, unread, starred, dbMessages] = await Promise.all([
        this.prisma.mailMessage.count({ where }),
        this.prisma.mailMessage.count({
          where: { ...where, read: false },
        }),
        this.prisma.mailMessage.count({
          where: { ...where, starred: true },
        }),
        this.getPaginatedMessages(where, query, limit, offset),
      ]);

      const messages = dbMessages.map((msg: PrismaMailMessage) =>
        this.toMailMessage(msg),
      );

      return {
        address,
        messages,
        total,
        unread,
        starred,
      };
    } catch (error) {
      return {
        address,
        messages: [],
        total: 0,
        unread: 0,
        starred: 0,
      };
    }
  }

  /**
   * Get paginated messages with sorting
   */
  private async getPaginatedMessages(
    where: Prisma.MailMessageWhereInput,
    query: InboxQuery | undefined,
    limit: number,
    offset: number,
  ): Promise<PrismaMailMessage[]> {
    // Determine sort order - map to valid DB fields
    const orderBy: Prisma.MailMessageOrderByWithRelationInput = {};
    let sortField = query?.sortBy ?? 'sentAt';
    // Map receivedAt to createdAt (DB field)
    if (sortField === 'receivedAt') {
      sortField = 'sentAt';
    }
    const sortOrder = query?.sortOrder ?? 'desc';
    orderBy[sortField] = sortOrder;

    return this.prisma.mailMessage.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MailMessage | null> {
    const result = await this.executeWithErrorHandling(
      () =>
        this.prisma.mailMessage.findUnique({
          where: { messageId },
        }),
      'Failed to get message',
    );

    if (!result.success || !result.data) {
      return null;
    }

    return this.toMailMessage(result.data);
  }

  /**
   * Get unread message count for an address
   */
  async getUnreadCount(address: MailAddress): Promise<number> {
    return this.prisma.mailMessage.count({
      where: {
        to: address,
        read: false,
        deleted: false,
      },
    });
  }

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string): Promise<StorageResult> {
    return this.updateMessageStatus(messageId, 'read', true);
  }

  /**
   * Mark a message as unread
   */
  async markAsUnread(messageId: string): Promise<StorageResult> {
    return this.updateMessageStatus(messageId, 'read', false);
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<StorageResult> {
    return this.updateMessageStatus(messageId, 'starred', true);
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<StorageResult> {
    return this.updateMessageStatus(messageId, 'starred', false);
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<StorageResult> {
    return this.updateMessageStatus(messageId, 'deleted', true);
  }

  /**
   * Permanently remove a message
   */
  async removeMessage(messageId: string): Promise<StorageResult> {
    const result = await this.executeWithErrorHandling(
      () =>
        this.prisma.mailMessage.delete({
          where: { messageId },
        }),
      'Failed to remove message',
    );

    if (!result.success) {
      return { success: false, error: (result as { success: false; error: string }).error };
    }
    return { success: true };
  }

  /**
   * Build search where clause from query
   */
  private buildSearchWhere(query: SearchQuery): Prisma.MailMessageWhereInput {
    const where: Prisma.MailMessageWhereInput = {
      deleted: false,
    };

    if (query.from) {
      where.from = query.from;
    }

    if (query.to) {
      where.to = query.to;
    }

    if (query.subject) {
      where.subject = { contains: query.subject, mode: 'insensitive' };
    }

    if (query.body) {
      where.body = { contains: query.body, mode: 'insensitive' };
    }

    if (query.unread !== undefined) {
      where.read = !query.unread;
    }

    if (query.read !== undefined) {
      where.read = query.read;
    }

    if (query.starred !== undefined) {
      where.starred = query.starred;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.dateFrom || query.dateTo) {
      where.sentAt = {};
      if (query.dateFrom) {
        (where.sentAt as Prisma.DateTimeFilter).gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        (where.sentAt as Prisma.DateTimeFilter).lte = new Date(query.dateTo);
      }
    }

    return where;
  }

  /**
   * Search messages across all mailboxes
   */
  async search(query: SearchQuery): Promise<MailMessage[]> {
    try {
      const where = this.buildSearchWhere(query);

      const dbMessages = await this.prisma.mailMessage.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: 100,
      });

      return dbMessages.map((msg) => this.toMailMessage(msg));
    } catch (error) {
      return [];
    }
  }

  /**
   * Register a new mailbox address
   * @returns RegisterAddressResult with registered=true if newly created, false if reactivated
   */
  async registerAddress(address: MailAddress): Promise<RegisterAddressResult> {
    const result = await this.executeWithErrorHandling(async () => {
      const { user, domain } = this.parseAddress(address);
      const currentTime = new Date();

      // Check if address already exists
      const existing = await this.prisma.registeredAddress.findUnique({
        where: { address },
      });

      if (existing) {
        // Address exists, reactivate it
        await this.prisma.registeredAddress.update({
          where: { address },
          data: {
            active: true,
            lastActiveAt: currentTime,
          },
        });
        return { registered: false };
      } else {
        // Address doesn't exist, create new
        await this.prisma.registeredAddress.create({
          data: {
            address,
            user,
            domain,
            active: true,
            registeredAt: currentTime,
            lastActiveAt: currentTime,
          },
        });
        return { registered: true };
      }
    }, 'Failed to register address');

    if (!result.success) {
      return { success: false, error: (result as { success: false; error: string }).error, registered: false };
    }
    return { success: true, registered: result.data.registered };
  }

  /**
   * Check if an address is registered
   */
  async isAddressRegistered(address: MailAddress): Promise<boolean> {
    const result = await this.executeWithErrorHandling(
      () =>
        this.prisma.registeredAddress.findUnique({
          where: { address },
        }),
      'Failed to check address registration',
    );

    if (!result.success || !result.data) {
      return false;
    }

    return result.data.active ?? false;
  }

  /**
   * Get all registered addresses
   */
  async getRegisteredAddresses(): Promise<MailAddress[]> {
    const result = await this.executeWithErrorHandling(
      () =>
        this.prisma.registeredAddress.findMany({
          where: { active: true },
          orderBy: { lastActiveAt: 'desc' },
        }),
      'Failed to get registered addresses',
    );

    if (!result.success) {
      return [];
    }

    return result.data.map((a: PrismaRegisteredAddress) => a.address);
  }

  /**
   * Reply to a message with transaction support
   */
  async replyToMessage(messageId: string, reply: ReplyMail): Promise<ReplyResult> {
    this.logger.debug('Replying to message', { messageId, from: reply.from });

    try {
      // Use transaction for atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Get the original message
        const originalMessage = await tx.mailMessage.findUnique({
          where: { messageId },
        });

        if (!originalMessage) {
          throw new NotFoundError('Message', messageId);
        }

        // Build references chain
        const references: string[] = [
          ...(originalMessage.references || []),
        ];
        if (originalMessage.inReplyTo) {
          references.push(originalMessage.inReplyTo);
        }
        references.push(messageId);

        const currentTime = new Date();
        const sentAt = currentTime.toISOString();
        const replyMessageId = `mail_${now()}_${Math.random().toString(36).substring(2, 11)}`;

        // Determine sender - use provided from, or the original recipient
        const from = reply.from || originalMessage.to;

        // Create the reply message
        await tx.mailMessage.create({
          data: {
            messageId: replyMessageId,
            from: from,
            to: originalMessage.from,
            cc: [],
            bcc: [],
            subject: `Re: ${originalMessage.subject}`,
            body: reply.body,
            attachments: reply.attachments ?? [],
            payload: (reply.payload as Prisma.InputJsonValue) ?? null,
            priority: 'normal',
            taskId: originalMessage.taskId ?? null,
            inReplyTo: messageId,
            references: references,
            read: false,
            starred: false,
            deleted: false,
            sentAt: currentTime,
            createdAt: currentTime,
            updatedAt: currentTime,
          },
        });

        // Update sender and recipient statistics
        const { user: senderUser, domain: senderDomain } = this.parseAddress(from);
        await tx.registeredAddress.upsert({
          where: { address: from },
          create: {
            address: from,
            user: senderUser,
            domain: senderDomain,
            active: true,
            totalSent: 1,
          },
          update: {
            lastActiveAt: currentTime,
            totalSent: { increment: 1 },
          },
        });

        const { user: recipientUser, domain: recipientDomain } = this.parseAddress(originalMessage.from);
        await tx.registeredAddress.upsert({
          where: { address: originalMessage.from },
          create: {
            address: originalMessage.from,
            user: recipientUser,
            domain: recipientDomain,
            active: true,
            totalReceived: 1,
          },
          update: {
            lastActiveAt: currentTime,
            totalReceived: { increment: 1 },
          },
        });

        return {
          success: true,
          messageId: replyMessageId,
          sentAt,
          recipient: originalMessage.from,
        };
      }, {
        maxWait: 5000,
        timeout: 10000,
      });

      // Notify WebSocket subscribers (outside transaction)
      const dbMessage = await this.prisma.mailMessage.findUnique({
        where: { messageId: result.messageId },
      });
      if (dbMessage) {
        subscriptionManager.notifyNewMail(result.recipient, this.toMailMessage(dbMessage));
      }

      this.logger.info('Reply sent successfully', {
        originalMessageId: messageId,
        replyMessageId: result.messageId,
        from: reply.from,
        to: result.recipient,
      });

      return {
        success: true,
        messageId: result.messageId,
        sentAt: result.sentAt,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        this.logger.warn('Message not found for reply', { messageId });
        return {
          success: false,
          error: `Message ${messageId} not found`,
        };
      }

      this.logger.error('Failed to send reply', error instanceof Error ? error : undefined, {
        messageId,
        from: reply.from,
      });

      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get message thread (conversation chain)
   */
  async getThread(messageId: string): Promise<ThreadResult | null> {
    try {
      // First, get the message to find the thread root
      const message = await this.prisma.mailMessage.findUnique({
        where: { messageId },
      });

      if (!message) {
        return null;
      }

      // Find the root message of the thread
      // The root is either: this message (if not a reply), or we trace back via inReplyTo
      let rootMessageId = messageId;
      const visitedIds = new Set<string>();
      visitedIds.add(messageId);

      // Trace back to find the root
      let currentMsg = message;
      while (currentMsg.inReplyTo && !visitedIds.has(currentMsg.inReplyTo)) {
        const parentMsg = await this.prisma.mailMessage.findUnique({
          where: { messageId: currentMsg.inReplyTo },
        });
        if (!parentMsg) break;
        rootMessageId = parentMsg.messageId;
        visitedIds.add(parentMsg.messageId);
        currentMsg = parentMsg;
      }

      // Now find all messages in the thread
      const rootMessage = await this.prisma.mailMessage.findUnique({
        where: { messageId: rootMessageId },
      });

      if (!rootMessage) {
        return null;
      }

      // Find all messages that reference the root or are part of the conversation
      const threadMessages = await this.prisma.mailMessage.findMany({
        where: {
          OR: [
            { messageId: rootMessageId },
            { inReplyTo: rootMessageId },
            { references: { has: rootMessageId } },
          ],
          deleted: false,
        },
        orderBy: { sentAt: 'asc' },
      });

      // Also include messages that reply to any message in our current thread
      const threadMessageIds = new Set(threadMessages.map(m => m.messageId));
      const additionalMessages = await this.prisma.mailMessage.findMany({
        where: {
          inReplyTo: { in: Array.from(threadMessageIds) },
          deleted: false,
          // Exclude messages we already have
          messageId: { notIn: Array.from(threadMessageIds) },
        },
        orderBy: { sentAt: 'asc' },
      });

      const allMessages = [...threadMessages, ...additionalMessages];
      allMessages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

      return {
        rootMessage: this.toMailMessage(rootMessage),
        messages: allMessages.map(msg => this.toMailMessage(msg)),
        total: allMessages.length,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Perform batch operations on messages
   */
  async batchOperation(operation: BatchOperation): Promise<BatchOperationResult> {
    const { operation: opType, messageIds } = operation;
    const errors: Array<{ messageId: string; error: string }> = [];
    let succeeded = 0;

    // Map operation types to methods
    const operationMap: Record<string, (id: string) => Promise<StorageResult>> = {
      markAsRead: (id) => this.markAsRead(id),
      markAsUnread: (id) => this.markAsUnread(id),
      star: (id) => this.starMessage(id),
      unstar: (id) => this.unstarMessage(id),
      delete: (id) => this.deleteMessage(id),
    };

    const opMethod = operationMap[opType];
    if (!opMethod) {
      return {
        success: false,
        succeeded: 0,
        failed: messageIds.length,
        errors: messageIds.map(id => ({ messageId: id, error: `Unknown operation: ${opType}` })),
      };
    }

    // Process each message
    for (const msgId of messageIds) {
      const result = await this.executeWithErrorHandling(
        () => opMethod(msgId),
        `Failed to ${opType} message`,
      );

      if (result.success && result.data?.success) {
        succeeded++;
      } else {
        const errMsg = result.success
          ? ((result.data as { error?: string })?.error || 'Operation failed')
          : ((result as { error: string }).error || 'Operation failed');
        errors.push({
          messageId: msgId,
          error: errMsg,
        });
      }
    }

    return {
      success: errors.length === 0,
      succeeded,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Check if the storage is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close/cleanup storage connections
   */
  async close(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.logger.info('PostgreSQL storage connection closed');
    } catch (error) {
      this.logger.error('Error closing PostgreSQL storage connection', error instanceof Error ? error : undefined);
      throw new StorageError('Failed to close database connection', error instanceof Error ? error : undefined);
    }
  }
}
