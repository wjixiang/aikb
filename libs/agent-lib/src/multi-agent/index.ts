/**
 * Multi-Agent System - Core Module (Email-style)
 *
 * Provides email-style message-driven multi-agent communication infrastructure
 * with support for Expert-to-Expert and MC-to-Expert messaging.
 *
 * Main exports:
 * - MailAddress, MailMessage, OutgoingMail: Email-style types
 * - IMailListener: Event listener for new mail notifications
 * - MessageBus: Email-style message router
 * - ExpertAdapter: Bridge between MessageBus and Expert system
 *
 * Note: InboxResult, MailMessage, SendResult, StorageResult are re-exported from
 * core/statefulContext to avoid duplicate export conflicts
 */

// Types - selective re-export excluding conflicting types
// The following types conflict with core/statefulContext exports and are excluded:
// - InboxResult, MailMessage, SendResult, StorageResult
export {
    type TaskSource,
    type TaskTarget,
    type SourceType,
    type TargetType,
    type MessageType,
    type MessageStatus,
    type MessagePriority,
    type ResultStatus,
    type TaskMessage,
    type MessageError,
    type TaskResult,
    type QueueConfig,
    type QueueStatus,
    type QueueStats,
    type MessageHandler,
    type ResultHandler,
    type Subscription,
    type SubscriptionOptions,
    type ExpertAdapterConfig,
    type InputTransformation,
    type OutputTransformation,
    type IExpertAdapter,
    type MCAdapterConfig,
    type IMCAdapter,
    type MessageBusConfig,
    type MessageBusStats,
    type IMessageBus,
    type MailAddress,
    type MailPriority,
    type MailMessageStatus,
    type OutgoingMail,
    type IMailListener,
    type SubscriptionId,
    type MailSubscription,
    type PaginationOptions,
    type InboxQuery,
    type SearchQuery,
    type IMailStorage,
    type MailComponentConfig,
} from './types.js';

// Re-export ExpertTask and ExpertResult from core for compatibility
export type { ExpertTask, ExpertResult } from './types.js';

// Message Bus
export { MessageBus } from './MessageBus.js';

// Adapters
export { ExpertAdapter } from './ExpertAdapter.js';
