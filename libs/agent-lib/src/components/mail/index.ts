/**
 * Mail Module - Email-style messaging for agent communication
 *
 * This module provides a MailComponent that allows agents to:
 * - Send emails via the agent-mailbox service
 * - Search messages
 * - Reply to messages
 * - Manage drafts
 *
 * @example
 * ```typescript
 * import { MailComponent, createMailComponent } from 'agent-lib';
 *
 * const mail = createMailComponent({
 *   baseUrl: 'http://localhost:3000',
 *   defaultAddress: 'myagent@expert',
 * });
 *
 * // Reply to a message
 * await mail.handleToolCall('reply-createDraft', {
 *   messageId: 'msg-123',
 *   body: 'Thank you for your message...',
 * });
 *
 * // Send the reply
 * await mail.handleToolCall('reply-sendDraft', {
 *   draftId: 'draft-456',
 * });
 * ```
 */

export {
  MailComponent,
  createMailComponent,
  type MailComponentConfig,
  type MailComponentState,
  type DraftData,
  type DraftUpdate,
  type DraftResult,
  type DraftsResult,
} from './mailComponent.js';

// Export schema types for external use
export {
  mailToolSchemas,
  sendMailParamsSchema,
  messageIdParamsSchema,
  searchMessagesParamsSchema,
  replyToMessageParamsSchema,
  editDraftParamsSchema,
  deleteDraftParamsSchema,
  insertDraftContentParamsSchema,
  replaceDraftContentParamsSchema,
  sendDraftParamsSchema,
} from './mailSchemas.js';

// Export parameter types derived from Zod schemas
export type {
  SendMailParams,
  MessageIdParams,
  SearchMessagesParams,
  ReplyToMessageParams,
  EditDraftParams,
  DeleteDraftParams,
  InsertDraftContentParams,
  ReplaceDraftContentParams,
  SendDraftParams,
  MailToolParams,
  MailToolName,
  MailToolReturnTypes,
  ToolReturnType,
} from './mailSchemas.js';
