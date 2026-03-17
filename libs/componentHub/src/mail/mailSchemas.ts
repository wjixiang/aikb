import { z } from 'zod';
import { type MailComponentConfig } from 'agent-lib/multi-agent';

export type { MailComponentConfig };

/**
 * Tool parameter schemas
 */
export const sendMailParamsSchema = z.object({
  to: z.string().describe('Recipient address (e.g., "pubmed@expert", "analysis@expert")'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body content'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal').describe('Message priority'),
  taskId: z.string().optional().describe('Associated task ID'),
  attachments: z.array(z.string()).optional().describe('S3 keys of attachments'),
  payload: z.record(z.unknown()).optional().describe('Additional JSON payload data'),
});

export const getInboxParamsSchema = z.object({
  address: z.string().optional().describe('Mailbox address to query (defaults to component defaultAddress)'),
  limit: z.number().default(20).describe('Maximum number of messages to return'),
  offset: z.number().default(0).describe('Number of messages to skip'),
  unreadOnly: z.boolean().default(false).describe('Filter to show only unread messages'),
  starredOnly: z.boolean().default(false).describe('Filter to show only starred messages'),
});

export const getUnreadCountParamsSchema = z.object({
  address: z.string().optional().describe('Mailbox address (defaults to component defaultAddress)'),
});

export const messageIdParamsSchema = z.object({
  messageId: z.string().describe('ID of the message'),
});

export const searchMessagesParamsSchema = z.object({
  query: z.string().describe('Search text for subject or body'),
  from: z.string().optional().describe('Filter by sender address'),
  to: z.string().optional().describe('Filter by recipient address'),
  unread: z.boolean().optional().describe('Filter by unread status'),
  starred: z.boolean().optional().describe('Filter by starred status'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('Filter by priority'),
});

export const replyToMessageParamsSchema = z.object({
  messageId: z.string().describe('ID of the message to reply to'),
  body: z.string().describe('Reply body content'),
  attachments: z.array(z.string()).optional().describe('S3 keys of attachments'),
  payload: z.record(z.unknown()).optional().describe('Additional JSON payload data'),
});

export const registerAddressParamsSchema = z.object({
  address: z.string().describe('Address to register (e.g., "myagent@expert")'),
});

/**
 * Tool schemas map
 */
export const mailToolSchemas = {
  sendMail: {
    toolName: 'sendMail',
    desc: 'Send an email message to another agent or expert.',
    paramsSchema: sendMailParamsSchema,
  },
  getInbox: {
    toolName: 'getInbox',
    desc: 'Get inbox messages with optional filtering.',
    paramsSchema: getInboxParamsSchema,
  },
  getUnreadCount: {
    toolName: 'getUnreadCount',
    desc: 'Get the count of unread messages for an address',
    paramsSchema: getUnreadCountParamsSchema,
  },
  markAsRead: {
    toolName: 'markAsRead',
    desc: 'Mark a message as read',
    paramsSchema: messageIdParamsSchema,
  },
  markAsUnread: {
    toolName: 'markAsUnread',
    desc: 'Mark a message as unread',
    paramsSchema: messageIdParamsSchema,
  },
  starMessage: {
    toolName: 'starMessage',
    desc: 'Star a message',
    paramsSchema: messageIdParamsSchema,
  },
  unstarMessage: {
    toolName: 'unstarMessage',
    desc: 'Unstar a message',
    paramsSchema: messageIdParamsSchema,
  },
  deleteMessage: {
    toolName: 'deleteMessage',
    desc: 'Delete a message (soft delete)',
    paramsSchema: messageIdParamsSchema,
  },
  searchMessages: {
    toolName: 'searchMessages',
    desc: 'Search messages across mailboxes by subject, body, sender, etc.',
    paramsSchema: searchMessagesParamsSchema,
  },
  replyToMessage: {
    toolName: 'replyToMessage',
    desc: 'Reply to an existing message',
    paramsSchema: replyToMessageParamsSchema,
  },
  registerAddress: {
    toolName: 'registerAddress',
    desc: 'Register a new mailbox address',
    paramsSchema: registerAddressParamsSchema,
  },
};
