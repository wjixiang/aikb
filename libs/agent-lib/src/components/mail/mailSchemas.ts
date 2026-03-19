import { z } from 'zod';
// Import types from multi-agent module (within agent-lib)
import type {
  SendResult,
  StorageResult,
  MailAddress,
  MailComponentConfig,
} from '../../multi-agent/types.js';
// Import DraftResult and DraftsResult from mailComponent for local use
import type { DraftResult, DraftsResult } from './mailComponent.js';

// Re-export types from multi-agent module
export type { SendResult, StorageResult, MailAddress, MailComponentConfig };

// Re-export DraftResult and DraftsResult from mailComponent
export type { DraftResult, DraftsResult } from './mailComponent.js';

/**
 * Tool parameter schemas
 */

// SendMail parameters
export type SendMailParams = z.infer<typeof sendMailParamsSchema>;

// Message ID parameters (for deleteMessage)
export type MessageIdParams = z.infer<typeof messageIdParamsSchema>;

// SearchMessages parameters
export type SearchMessagesParams = z.infer<typeof searchMessagesParamsSchema>;

// ReplyToMessage parameters
export type ReplyToMessageParams = z.infer<typeof replyToMessageParamsSchema>;

// SaveDraft parameters
export type SaveDraftParams = z.infer<typeof saveDraftParamsSchema>;

// EditDraft parameters
export type EditDraftParams = z.infer<typeof editDraftParamsSchema>;

// DeleteDraft parameters
export type DeleteDraftParams = z.infer<typeof deleteDraftParamsSchema>;

// InsertDraftContent parameters
export type InsertDraftContentParams = z.infer<typeof insertDraftContentParamsSchema>;

// ReplaceDraftContent parameters
export type ReplaceDraftContentParams = z.infer<typeof replaceDraftContentParamsSchema>;

// SendDraft parameters
export type SendDraftParams = z.infer<typeof sendDraftParamsSchema>;

// SendMail parameters
export const sendMailParamsSchema = z.object({
  to: z.string().describe('Recipient address'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body content'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal').describe('Message priority'),
  taskId: z.string().optional().describe('Associated task ID'),
  attachments: z.array(z.string()).optional().describe('S3 keys of attachments'),
  payload: z.record(z.unknown()).optional().describe('Additional JSON payload data'),
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
  | SendMailParams
  | MessageIdParams
  | SearchMessagesParams
  | ReplyToMessageParams
  | SaveDraftParams
  | EditDraftParams
  | DeleteDraftParams
  | InsertDraftContentParams
  | ReplaceDraftContentParams
  | SendDraftParams;

/**
 * Tool schemas map
 */
export const mailToolSchemas = {
  sendMail: {
    toolName: 'sendMail',
    desc: 'Send an email message directly.',
    paramsSchema: sendMailParamsSchema,
    examples: [
      {
        description: 'Send a simple email',
        params: {
          to: 'recipient@expert',
          subject: 'Hello',
          body: 'This is a test email.',
        },
        expectedResult: 'Returns success with messageId',
      },
      {
        description: 'Send email with priority',
        params: {
          to: 'urgent@expert',
          subject: 'Urgent Request',
          body: 'Please respond ASAP.',
          priority: 'urgent',
        },
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
  'reply-createDraft': {
    toolName: 'reply-createDraft',
    desc: 'Create a draft reply to an existing message. This creates a draft that can be edited and sent.',
    paramsSchema: replyToMessageParamsSchema,
    examples: [
      {
        description: 'Reply to a message',
        params: {
          messageId: 'msg-123abc',
          body: 'Thank you for your message. I will process your request and get back to you shortly.',
        },
        expectedResult: 'Returns draftId which is used in reply-sendDraft',
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
  'reply-editDraft': {
    toolName: 'reply-editDraft',
    desc: 'Edit an existing reply draft. Use to modify subject, body, recipient, or priority.',
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
  'reply-sendDraft': {
    toolName: 'reply-sendDraft',
    desc: 'Send a reply draft. This is the FINAL step of the reply workflow.',
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
  sendMail: SendResult;
  deleteMessage: StorageResult;
  searchMessages: StorageResult;
  'reply-createDraft': SendResult;
  saveDraft: DraftResult;
  'reply-editDraft': DraftResult;
  deleteDraft: DraftResult;
  insertDraftContent: DraftResult;
  replaceDraftContent: DraftResult;
  'reply-sendDraft': SendResult;
}

/**
 * Helper type to get the return type for a specific mail tool
 */
export type ToolReturnType<T extends MailToolName> = MailToolReturnTypes[T];
