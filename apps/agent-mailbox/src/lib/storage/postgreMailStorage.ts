import {
  PrismaClient,
  Prisma,
  MailMessage as PrismaMailMessage,
  RegisteredAddress as PrismaRegisteredAddress,
} from '../../generated/prisma/index.js';
import {
  type IMailStorage,
  type MailAddress,
  type OutgoingMail,
  type MailMessage,
  type SendResult,
  type StorageResult,
  type InboxQuery,
  type InboxResult,
  type SearchQuery,
  parseMailAddress,
} from './type.js';

/**
 * PostgreSQL-based mail storage implementation
 * Uses Prisma ORM to interact with PostgreSQL database
 */
export class PostgreMailStorage implements IMailStorage {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Initialize the storage backend
   */
  async initialize(): Promise<void> {
    await this.prisma.$connect();
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
   * Send/save a mail message
   */
  async send(mail: OutgoingMail): Promise<SendResult> {
    try {
      const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
      const now = new Date();
      const sentAt = now.toISOString();
      const baseMessageId = `mail_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Save message for each recipient
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
          sentAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      );

      // Insert all messages
      await this.prisma.mailMessage.createMany({
        data: messages,
      });

      // Update sender statistics
      const senderInfo = this.parseAddress(mail.from);
      await this.prisma.registeredAddress.upsert({
        where: { address: mail.from },
        create: {
          address: mail.from,
          user: senderInfo.user,
          domain: senderInfo.domain,
          active: true,
          totalSent: 1,
        },
        update: {
          lastActiveAt: now,
          totalSent: { increment: 1 },
        },
      });

      // Update recipient statistics
      for (const recipient of recipients) {
        const recipientInfo = this.parseAddress(recipient);
        await this.prisma.registeredAddress.upsert({
          where: { address: recipient },
          create: {
            address: recipient,
            user: recipientInfo.user,
            domain: recipientInfo.domain,
            active: true,
            totalReceived: 1,
          },
          update: {
            lastActiveAt: now,
            totalReceived: { increment: 1 },
          },
        });
      }

      return {
        success: true,
        messageId: baseMessageId,
        sentAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
      };

      if (query?.unreadOnly) {
        where.read = false;
      }

      if (query?.starredOnly) {
        where.starred = true;
      }

      // Exclude deleted messages by default
      where.deleted = false;

      // Get total count
      const total = await this.prisma.mailMessage.count({ where });

      // Get unread count
      const unread = await this.prisma.mailMessage.count({
        where: { ...where, read: false },
      });

      // Get starred count
      const starred = await this.prisma.mailMessage.count({
        where: { ...where, starred: true },
      });

      // Determine sort order - map to valid DB fields
      const orderBy: Prisma.MailMessageOrderByWithRelationInput = {};
      let sortField = query?.sortBy ?? 'sentAt';
      // Map receivedAt to createdAt (DB field)
      if (sortField === 'receivedAt') {
        sortField = 'sentAt';
      }
      const sortOrder = query?.sortOrder ?? 'desc';
      orderBy[sortField] = sortOrder;

      // Get messages with pagination
      const dbMessages = await this.prisma.mailMessage.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      });

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
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<MailMessage | null> {
    try {
      const dbMessage = await this.prisma.mailMessage.findUnique({
        where: { messageId },
      });

      if (!dbMessage) {
        return null;
      }

      return this.toMailMessage(dbMessage);
    } catch (error) {
      return null;
    }
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
    try {
      await this.prisma.mailMessage.update({
        where: { messageId },
        data: { read: true, updatedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Mark a message as unread
   */
  async markAsUnread(messageId: string): Promise<StorageResult> {
    try {
      await this.prisma.mailMessage.update({
        where: { messageId },
        data: { read: false, updatedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Star a message
   */
  async starMessage(messageId: string): Promise<StorageResult> {
    try {
      await this.prisma.mailMessage.update({
        where: { messageId },
        data: { starred: true, updatedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unstar a message
   */
  async unstarMessage(messageId: string): Promise<StorageResult> {
    try {
      await this.prisma.mailMessage.update({
        where: { messageId },
        data: { starred: false, updatedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: string): Promise<StorageResult> {
    try {
      await this.prisma.mailMessage.update({
        where: { messageId },
        data: { deleted: true, updatedAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Permanently remove a message
   */
  async removeMessage(messageId: string): Promise<StorageResult> {
    try {
      await this.prisma.mailMessage.delete({
        where: { messageId },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Search messages across all mailboxes
   */
  async search(query: SearchQuery): Promise<MailMessage[]> {
    try {
      // Build where clause
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
        where.read = query.unread;
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
          (where.sentAt as Prisma.DateTimeFilter).gte = new Date(
            query.dateFrom,
          );
        }
        if (query.dateTo) {
          (where.sentAt as Prisma.DateTimeFilter).lte = new Date(query.dateTo);
        }
      }

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
   */
  async registerAddress(address: MailAddress): Promise<StorageResult> {
    try {
      const { user, domain } = this.parseAddress(address);
      const now = new Date();

      await this.prisma.registeredAddress.upsert({
        where: { address },
        create: {
          address,
          user,
          domain,
          active: true,
          registeredAt: now,
          lastActiveAt: now,
        },
        update: {
          active: true,
          lastActiveAt: now,
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if an address is registered
   */
  async isAddressRegistered(address: MailAddress): Promise<boolean> {
    const result = await this.prisma.registeredAddress.findUnique({
      where: { address },
    });
    return result?.active ?? false;
  }

  /**
   * Get all registered addresses
   */
  async getRegisteredAddresses(): Promise<MailAddress[]> {
    const addresses = await this.prisma.registeredAddress.findMany({
      where: { active: true },
      orderBy: { lastActiveAt: 'desc' },
    });
    return addresses.map((a: PrismaRegisteredAddress) => a.address);
  }

  /**
   * Close/cleanup storage connections
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
