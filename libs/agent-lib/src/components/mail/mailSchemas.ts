import { z } from 'zod';
// Import types from multi-agent module (within agent-lib)
import type {
  MailAddress,
  MailComponentConfig,
} from '../../multi-agent/types.js';

// Re-export types from multi-agent module
export type { MailAddress, MailComponentConfig };

/**
 * MarkAsRead parameters
 */
export const markAsReadParamsSchema = z.object({
  messageId: z.string().describe('ID of the message to mark as read'),
});

export type MarkAsReadParams = z.infer<typeof markAsReadParamsSchema>;

/**
 * GetUnreadCount parameters
 */
export const getUnreadCountParamsSchema = z.object({
  address: z.string().optional().describe('Mailbox address (uses default if not provided)'),
});

export type GetUnreadCountParams = z.infer<typeof getUnreadCountParamsSchema>;

/**
 * GetInbox parameters - for reading emails
 */
export const getInboxParamsSchema = z.object({
  limit: z.number().default(20).describe('Maximum number of messages to return'),
  offset: z.number().default(0).describe('Number of messages to skip'),
  unreadOnly: z.boolean().default(false).describe('Only return unread messages'),
});

export type GetInboxParams = z.infer<typeof getInboxParamsSchema>;

/**
 * Tool schemas map - simplified to read-only with markAsRead
 */
export const mailToolSchemas = {
  getInbox: {
    toolName: 'getInbox',
    desc: 'Get inbox messages for the agent mailbox. Returns task instructions and messages.',
    paramsSchema: getInboxParamsSchema,
    examples: [
      {
        description: 'Get inbox messages',
        params: {
          limit: 20,
          offset: 0,
          unreadOnly: false,
        },
        expectedResult: 'Returns list of messages with task instructions',
      },
    ],
  },
  markAsRead: {
    toolName: 'markAsRead',
    desc: 'Mark a message as read.',
    paramsSchema: markAsReadParamsSchema,
    examples: [
      {
        description: 'Mark message as read',
        params: { messageId: 'msg-123abc' },
        expectedResult: 'Message marked as read',
      },
    ],
  },
  getUnreadCount: {
    toolName: 'getUnreadCount',
    desc: 'Get the count of unread messages for a mailbox address.',
    paramsSchema: getUnreadCountParamsSchema,
    examples: [
      {
        description: 'Get unread count for default address',
        params: {},
        expectedResult: 'Returns { count: number }',
      },
    ],
  },
};

/**
 * Union type for all mail tool names
 */
export type MailToolName = keyof typeof mailToolSchemas;

/**
 * Tool name to return type mapping
 */
export interface MailToolReturnTypes {
  getInbox: { messages: any[]; total: number; unread: number };
  markAsRead: { success: boolean };
  getUnreadCount: { count: number };
}

/**
 * Helper type to get the return type for a specific mail tool
 */
export type ToolReturnType<T extends MailToolName> = MailToolReturnTypes[T];
