/**
 * Mail Module - Email-style messaging for agent communication
 *
 * This module provides a MailComponent that allows agents to:
 * - Send and receive emails via the agent-mailbox service
 * - Manage inbox (read/unread, star, delete)
 * - Search messages
 * - Reply to messages
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
 * // Send a message
 * await mail.sendMail({
 *   to: 'other@expert',
 *   subject: 'Hello',
 *   body: 'World',
 * });
 *
 * // Get inbox
 * const inbox = await mail.getInbox('myagent@expert');
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
  getInboxParamsSchema,
  getUnreadCountParamsSchema,
  messageIdParamsSchema,
  searchMessagesParamsSchema,
  replyToMessageParamsSchema,
  registerAddressParamsSchema,
  saveDraftParamsSchema,
  editDraftParamsSchema,
  getDraftsParamsSchema,
  deleteDraftParamsSchema,
  insertDraftContentParamsSchema,
  replaceDraftContentParamsSchema,
} from './mailSchemas.js';

// Export parameter types derived from Zod schemas
export type {
  SendMailParams,
  GetInboxParams,
  GetUnreadCountParams,
  MessageIdParams,
  SearchMessagesParams,
  ReplyToMessageParams,
  RegisterAddressParams,
  SaveDraftParams,
  EditDraftParams,
  GetDraftsParams,
  DeleteDraftParams,
  InsertDraftContentParams,
  ReplaceDraftContentParams,
  MailToolParams,
  MailToolName,
  MailToolReturnTypes,
  ToolReturnType,
} from './mailSchemas.js';

// Re-export mail-related types from agent-lib for convenience
export type {
  MailAddress,
  MailMessage,
  MailMessageStatus,
  OutgoingMail,
  MailPriority,
  IMailListener,
  MailSubscription,
  SubscriptionId,
  InboxQuery,
  InboxResult,
  SearchQuery,
  PaginationOptions,
  SendResult,
  StorageResult,
  IMailStorage,
} from 'agent-lib';
