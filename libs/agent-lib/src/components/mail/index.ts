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
  getInboxParamsSchema,
  getUnreadCountParamsSchema,
  messageIdParamsSchema,
  searchMessagesParamsSchema,
  replyToMessageParamsSchema,
  registerAddressParamsSchema,
  editDraftParamsSchema,
  getDraftsParamsSchema,
  deleteDraftParamsSchema,
} from './mailSchemas.js';

// Export parameter types derived from Zod schemas
export type {
  GetInboxParams,
  GetUnreadCountParams,
  MessageIdParams,
  SearchMessagesParams,
  ReplyToMessageParams,
  RegisterAddressParams,
  EditDraftParams,
  GetDraftsParams,
  DeleteDraftParams,
  MailToolParams,
  MailToolName,
  MailToolReturnTypes,
  ToolReturnType,
} from './mailSchemas.js';