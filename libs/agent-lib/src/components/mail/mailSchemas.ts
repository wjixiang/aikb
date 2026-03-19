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
  saveDraft: {
    toolName: 'saveDraft',
    desc: 'Save an email as a draft (not sent)',
    paramsSchema: saveDraftParamsSchema,
  },
  editDraft: {
    toolName: 'editDraft',
    desc: 'Edit an existing draft',
    paramsSchema: editDraftParamsSchema,
  },
  getDrafts: {
    toolName: 'getDrafts',
    desc: 'Get saved drafts from mailbox',
    paramsSchema: getDraftsParamsSchema,
  },
  deleteDraft: {
    toolName: 'deleteDraft',
    desc: 'Delete a draft',
    paramsSchema: deleteDraftParamsSchema,
  },
  insertDraftContent: {
    toolName: 'insertDraftContent',
    desc: 'Insert content at a specific position in a draft body',
    paramsSchema: insertDraftContentParamsSchema,
  },
  replaceDraftContent: {
    toolName: 'replaceDraftContent',
    desc: 'Replace specific content in a draft body with new content',
    paramsSchema: replaceDraftContentParamsSchema,
  },
  sendDraft: {
    toolName: 'sendDraft',
    desc: 'Send a draft email. If the draft was created as a reply (has inReplyTo), it will be sent as a reply.',
    paramsSchema: sendDraftParamsSchema,
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
  saveDraft: StorageResult;
  editDraft: StorageResult;
  getDrafts: InboxResult;
  deleteDraft: StorageResult;
  insertDraftContent: StorageResult;
  replaceDraftContent: StorageResult;
  sendDraft: SendResult;
}

/**
 * Helper type to get the return type for a specific mail tool
 */
export type ToolReturnType<T extends MailToolName> = MailToolReturnTypes[T];
