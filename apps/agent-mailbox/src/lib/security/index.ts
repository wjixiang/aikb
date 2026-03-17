/**
 * Security Module
 *
 * Centralized security utilities for the agent-mailbox service.
 * Exports sanitization, validation, and other security functions.
 */

// Export sanitization functions
export {
  sanitizePlainText,
  sanitizeEmailBody,
  sanitizeStringArray,
  escapeRegex,
  removeControlChars,
  sanitizeSearchQuery,
  sanitizeJsonPayload,
  sanitizeOutgoingMail,
  containsHtml,
  containsDangerousJs,
  type SanitizableMail,
} from './sanitization.js';

// Export validation functions
export {
  validateMailAddress,
  validateMailAddresses,
  validateMessageId,
  validateSubject,
  validateBody,
  validatePriority,
  validatePagination,
  validateSort,
  validateSearchQuery,
  validateOutgoingMail,
  containsNoSqlInjection,
  sanitizeNoSql,
  type ValidationResult,
  type ValidatableOutgoingMail,
  // Constants
  MAX_ADDRESS_LENGTH,
  MAX_SUBJECT_LENGTH,
  MAX_BODY_LENGTH,
  MAX_MESSAGE_ID_LENGTH,
  MAX_TASK_ID_LENGTH,
  MAX_RECIPIENTS,
  MAX_ATTACHMENTS,
  MAX_PAGINATION_LIMIT,
  DEFAULT_PAGINATION_LIMIT,
} from './validation.js';

// Export rate limiting configuration
export {
  rateLimitConfig,
  websocketConnectionTracker,
  type RateLimitConfig,
} from './rateLimit.js';
