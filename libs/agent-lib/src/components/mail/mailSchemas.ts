import { z } from 'zod';
// Import types from multi-agent module (within agent-lib)
import type {
  SendResult,
  InboxResult,
  StorageResult,
  MailAddress,
  MailComponentConfig,
} from '../../multi-agent/types.js';

// Re-export types from multi-agent module
export type { SendResult, InboxResult, StorageResult, MailAddress, MailComponentConfig };

/**
 * Tool parameter schemas
 */

// GetInbox parameters
export type GetInboxParams = z.infer<typeof getInboxParamsSchema>;

// GetUnreadCount parameters
export type GetUnreadCountParams = z.infer<typeof getUnreadCountParamsSchema>;

// Message ID parameters (for markAsRead, markAsUnread, starMessage, unstarMessage, deleteMessage)
export type MessageIdParams = z.infer<typeof messageIdParamsSchema>;

// SearchMessages parameters
export type SearchMessagesParams = z.infer<typeof searchMessagesParamsSchema>;

// ReplyToMessage parameters
export type ReplyToMessageParams = z.infer<typeof replyToMessageParamsSchema>;

// RegisterAddress parameters
export type RegisterAddressParams = z.infer<typeof registerAddressParamsSchema>;

// SaveDraft parameters
export type SaveDraftParams = z.infer<typeof saveDraftParamsSchema>;

// EditDraft parameters
export type EditDraftParams = z.infer<typeof editDraftParamsSchema>;

// GetDrafts parameters
export type GetDraftsParams = z.infer<typeof getDraftsParamsSchema>;

// DeleteDraft parameters
export type DeleteDraftParams = z.infer<typeof deleteDraftParamsSchema>;

// InsertDraftContent parameters
export type InsertDraftContentParams = z.infer<typeof insertDraftContentParamsSchema>;

// ReplaceDraftContent parameters
export type ReplaceDraftContentParams = z.infer<typeof replaceDraftContentParamsSchema>;

// SendDraft parameters
export type SendDraftParams = z.infer<typeof sendDraftParamsSchema>;

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

export const saveDraftParamsSchema = z.object({
  to: z.string().describe('Recipient address (e.g., "pubmed@expert", "analysis@expert")'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body content'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal').describe('Message priority'),
  taskId: z.string().optional().describe('Associated task ID'),
  attachments: z.array(z.string()).optional().describe('S3 keys of attachments'),
  payload: z.record(z.unknown()).optional().describe('Additional JSON payload data'),
});

export const editDraftParamsSchema = z.object({
  draftId: z.string().describe('ID of the draft to edit'),
  to: z.string().optional().describe('New recipient address'),
  subject: z.string().optional().describe('New email subject line'),
  body: z.string().optional().describe('New email body content'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().describe('New message priority'),
  taskId: z.string().optional().describe('New associated task ID'),
  attachments: z.array(z.string()).optional().describe('New S3 keys of attachments'),
  payload: z.record(z.unknown()).optional().describe('New additional JSON payload data'),
});

export const getDraftsParamsSchema = z.object({
  address: z.string().optional().describe('Mailbox address to query (defaults to component defaultAddress)'),
  limit: z.number().default(20).describe('Maximum number of drafts to return'),
  offset: z.number().default(0).describe('Number of drafts to skip'),
});

export const deleteDraftParamsSchema = z.object({
  draftId: z.string().describe('ID of the draft to delete'),
});

// InsertDraftContent parameters - insert content at a specific position
export const insertDraftContentParamsSchema = z.object({
  draftId: z.string().describe('ID of the draft to insert content into'),
  content: z.string().describe('Content to insert'),
  position: z.number().describe('Character position to insert at (0-based index)'),
});

// ReplaceDraftContent parameters - replace specific content in the draft
export const replaceDraftContentParamsSchema = z.object({
  draftId: z.string().describe('ID of the draft to replace content in'),
  search: z.string().describe('Content to search for (will be replaced)'),
  replacement: z.string().describe('Content to replace the search text with'),
  replaceAll: z.boolean().default(false).describe('Replace all occurrences or just the first one'),
});

// SendDraft parameters - send a draft (optionally as a reply)
export const sendDraftParamsSchema = z.object({
  draftId: z.string().describe('ID of the draft to send'),
  // Optional: override the reply-to target when sending
  inReplyTo: z.string().optional().describe('Message ID this draft is replying to (auto-detected from draft if not provided)'),
});

/**
 * Union type for all mail tool parameters
 */
export type MailToolParams =
  | GetInboxParams
  | GetUnreadCountParams
  | MessageIdParams
  | SearchMessagesParams
  | ReplyToMessageParams
  | RegisterAddressParams
  | SaveDraftParams
  | EditDraftParams
  | GetDraftsParams
  | DeleteDraftParams
  | InsertDraftContentParams
  | ReplaceDraftContentParams
  | SendDraftParams;

/**
 * Tool schemas map
 */
export const mailToolSchemas = {
  getInbox: {
    toolName: 'getInbox',
    desc: 'Get inbox messages with optional filtering by read status, starred status, or address.',
    paramsSchema: getInboxParamsSchema,
    examples: [
      {
        description: 'Get first 20 messages from inbox',
        params: { limit: 20, offset: 0, unreadOnly: false },
        expectedResult: 'Returns array of messages with id, subject, from, date, read status, etc.',
      },
      {
        description: 'Get only unread messages',
        params: { limit: 10, unreadOnly: true },
        expectedResult: 'Returns only unread messages',
      },
      {
        description: 'Get messages from specific address',
        params: { address: 'task@agent', limit: 50 },
        expectedResult: 'Returns messages from the specified mailbox address',
      },
    ],
  },
  getUnreadCount: {
    toolName: 'getUnreadCount',
    desc: 'Get the count of unread messages for an address. Use this to check if there are new tasks.',
    paramsSchema: getUnreadCountParamsSchema,
    examples: [
      {
        description: 'Check unread count for default address',
        params: {},
        expectedResult: 'Returns { count: number }',
      },
    ],
  },
  markAsRead: {
    toolName: 'markAsRead',
    desc: 'Mark a message as read after you have processed it.',
    paramsSchema: messageIdParamsSchema,
    examples: [
      {
        description: 'Mark a message as read',
        params: { messageId: 'msg-123abc' },
        expectedResult: 'Message status updated to read',
      },
    ],
  },
  markAsUnread: {
    toolName: 'markAsUnread',
    desc: 'Mark a message as unread.',
    paramsSchema: messageIdParamsSchema,
    examples: [
      {
        description: 'Mark a message as unread',
        params: { messageId: 'msg-123abc' },
      },
    ],
  },
  starMessage: {
    toolName: 'starMessage',
    desc: 'Star a message to mark it as important.',
    paramsSchema: messageIdParamsSchema,
    examples: [
      {
        description: 'Star an important message',
        params: { messageId: 'msg-123abc' },
      },
    ],
  },
  unstarMessage: {
    toolName: 'unstarMessage',
    desc: 'Remove star from a message.',
    paramsSchema: messageIdParamsSchema,
    examples: [
      {
        description: 'Remove star from message',
        params: { messageId: 'msg-123abc' },
      },
    ],
  },
  deleteMessage: {
    toolName: 'deleteMessage',
    desc: 'Soft delete a message (moves to trash).',
    paramsSchema: messageIdParamsSchema,
    examples: [
      {
        description: 'Delete a message',
        params: { messageId: 'msg-123abc' },
        expectedResult: 'Message moved to trash',
      },
    ],
  },
  searchMessages: {
    toolName: 'searchMessages',
    desc: 'Search messages by text content, sender, or recipient. Returns matching messages.',
    paramsSchema: searchMessagesParamsSchema,
    examples: [
      {
        description: 'Search for messages containing "PubMed"',
        params: { query: 'PubMed' },
        expectedResult: 'Returns messages with PubMed in subject or body',
      },
      {
        description: 'Search from specific sender',
        params: { query: 'article', from: 'research@agent' },
        expectedResult: 'Returns messages from research@agent containing "article"',
      },
      {
        description: 'Search for unread high priority messages',
        params: { query: 'urgent', unread: true, priority: 'urgent' },
        expectedResult: 'Returns unread urgent messages',
      },
    ],
  },
  replyToMessage: {
    toolName: 'replyToMessage',
    desc: 'Create a draft reply to an existing message. This is the FIRST step of the reply workflow.',
    paramsSchema: replyToMessageParamsSchema,
    examples: [
      {
        description: 'Reply to a message',
        params: {
          messageId: 'msg-123abc',
          body: 'Thank you for your message. I will process your request and get back to you shortly.',
        },
        expectedResult: 'Returns draftId which is used in sendDraft',
      },
      {
        description: 'Reply with attachment reference',
        params: {
          messageId: 'msg-456def',
          body: 'Here is the analysis you requested.',
          attachments: ['results.pdf'],
        },
      },
    ],
  },
  registerAddress: {
    toolName: 'registerAddress',
    desc: 'Register a mailbox address for this agent. Must be called before receiving messages.',
    paramsSchema: registerAddressParamsSchema,
    examples: [
      {
        description: 'Register a new mailbox address',
        params: { address: 'myagent@expert' },
        expectedResult: 'Address registered and ready to receive messages',
      },
    ],
  },
  saveDraft: {
    toolName: 'saveDraft',
    desc: 'Save a new email draft (not sent). Use for composing new messages to send later.',
    paramsSchema: saveDraftParamsSchema,
    examples: [
      {
        description: 'Save a draft to a task agent',
        params: {
          to: 'pubmed@expert',
          subject: 'Literature Search Request',
          body: 'Please search for articles about...',
          priority: 'normal',
        },
        expectedResult: 'Returns draftId for later sending',
      },
    ],
  },
  editDraft: {
    toolName: 'editDraft',
    desc: 'Edit an existing draft. Use to modify subject, body, recipient, or priority.',
    paramsSchema: editDraftParamsSchema,
    examples: [
      {
        description: 'Update draft body',
        params: {
          draftId: 'draft-789xyz',
          body: 'Updated content for the reply...',
        },
        expectedResult: 'Draft content updated',
      },
      {
        description: 'Change draft priority',
        params: {
          draftId: 'draft-789xyz',
          priority: 'urgent',
        },
      },
    ],
  },
  getDrafts: {
    toolName: 'getDrafts',
    desc: 'Get all saved drafts from mailbox.',
    paramsSchema: getDraftsParamsSchema,
    examples: [
      {
        description: 'Get all drafts',
        params: { limit: 20 },
        expectedResult: 'Returns array of drafts',
      },
    ],
  },
  deleteDraft: {
    toolName: 'deleteDraft',
    desc: 'Delete a draft permanently.',
    paramsSchema: deleteDraftParamsSchema,
    examples: [
      {
        description: 'Delete a draft',
        params: { draftId: 'draft-789xyz' },
        expectedResult: 'Draft deleted',
      },
    ],
  },
  insertDraftContent: {
    toolName: 'insertDraftContent',
    desc: 'Insert content at a specific character position in a draft body.',
    paramsSchema: insertDraftContentParamsSchema,
    examples: [
      {
        description: 'Insert content at position 100',
        params: {
          draftId: 'draft-789xyz',
          content: '\n\nAdditional paragraph...',
          position: 100,
        },
        expectedResult: 'Content inserted at specified position',
      },
    ],
  },
  replaceDraftContent: {
    toolName: 'replaceDraftContent',
    desc: 'Replace specific text in a draft body with new content.',
    paramsSchema: replaceDraftContentParamsSchema,
    examples: [
      {
        description: 'Replace text in draft',
        params: {
          draftId: 'draft-789xyz',
          search: 'old text',
          replacement: 'new text',
          replaceAll: false,
        },
        expectedResult: 'First occurrence replaced',
      },
      {
        description: 'Replace all occurrences',
        params: {
          draftId: 'draft-789xyz',
          search: 'error',
          replacement: 'success',
          replaceAll: true,
        },
        expectedResult: 'All occurrences replaced',
      },
    ],
  },
  sendDraft: {
    toolName: 'sendDraft',
    desc: 'Send a draft email. If draft was created with replyToMessage, it will be sent as a reply. This is the FINAL step of the reply workflow.',
    paramsSchema: sendDraftParamsSchema,
    examples: [
      {
        description: 'Send a reply draft',
        params: { draftId: 'draft-789xyz' },
        expectedResult: 'Message sent successfully, returns messageId',
      },
      {
        description: 'Send draft as reply to specific message',
        params: { draftId: 'draft-789xyz', inReplyTo: 'msg-123abc' },
        expectedResult: 'Message sent as reply to msg-123abc',
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
 * Used with MailToolName to get the return type for a specific tool
 */
export interface MailToolReturnTypes {
  getInbox: InboxResult;
  getUnreadCount: { count: number };
  markAsRead: StorageResult;
  markAsUnread: StorageResult;
  starMessage: StorageResult;
  unstarMessage: StorageResult;
  deleteMessage: StorageResult;
  searchMessages: InboxResult;
  replyToMessage: SendResult;
  registerAddress: MailAddress;
  saveDraft: StorageResult<{ draftId: string }>;
  editDraft: StorageResult<void>;
  getDrafts: InboxResult;
  deleteDraft: StorageResult<void>;
  insertDraftContent: StorageResult<void>;
  replaceDraftContent: StorageResult<void>;
  sendDraft: SendResult;
}

/**
 * Helper type to get the return type for a specific mail tool
 */
export type ToolReturnType<T extends MailToolName> = MailToolReturnTypes[T];
