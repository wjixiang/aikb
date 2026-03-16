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
 */

// Types
export * from './types.js';

// Message Bus
export { MessageBus } from './MessageBus.js';

// Adapters
export { ExpertAdapter } from './ExpertAdapter.js';
