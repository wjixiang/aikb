/**
 * Input Validation Module
 *
 * Provides validation functions for mail addresses, message IDs,
 * and other user inputs to prevent injection attacks.
 */

import type { MailAddress } from '../storage/type.js';

// ============================================================================
// Constants
// ============================================================================

/** Maximum length for a mail address */
export const MAX_ADDRESS_LENGTH = 128;

/** Maximum length for a subject line */
export const MAX_SUBJECT_LENGTH = 512;

/** Maximum length for a message body */
export const MAX_BODY_LENGTH = 10 * 1024 * 1024; // 10MB

/** Maximum length for a message ID */
export const MAX_MESSAGE_ID_LENGTH = 256;

/** Maximum length for a task ID */
export const MAX_TASK_ID_LENGTH = 128;

/** Maximum number of recipients */
export const MAX_RECIPIENTS = 100;

/** Maximum number of attachments */
export const MAX_ATTACHMENTS = 50;

/** Maximum pagination limit */
export const MAX_PAGINATION_LIMIT = 1000;

/** Default pagination limit */
export const DEFAULT_PAGINATION_LIMIT = 20;

/** Valid characters for mail address local part (before @) */
const ADDRESS_LOCAL_REGEX = /^[a-zA-Z0-9._-]+$/;

/** Valid characters for mail address domain part */
const ADDRESS_DOMAIN_REGEX = /^[a-zA-Z0-9._-]+$/;

/** Valid priority values */
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

/** Valid sort fields */
const VALID_SORT_FIELDS = ['sentAt', 'receivedAt', 'subject', 'priority'] as const;

/** Valid sort orders */
const VALID_SORT_ORDERS = ['asc', 'desc'] as const;

// ============================================================================
// Address Validation
// ============================================================================

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a mail address format
 * Format: "user@domain" or "name" for simple addresses
 * Examples: "pubmed@expert", "analysis@expert", "broadcast"
 */
export function validateMailAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  if (address.length > MAX_ADDRESS_LENGTH) {
    return {
      valid: false,
      error: `Address exceeds maximum length of ${MAX_ADDRESS_LENGTH} characters`,
    };
  }

  // Special case for broadcast addresses
  if (address === 'broadcast' || address === '@broadcast') {
    return { valid: true };
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(address)) {
    return { valid: false, error: 'Address contains invalid characters' };
  }

  // Parse and validate parts
  const atIndex = address.indexOf('@');

  if (atIndex === -1) {
    // Simple address without domain - only alphanumeric, underscore, hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(address)) {
      return {
        valid: false,
        error: 'Simple address can only contain letters, numbers, underscores, and hyphens',
      };
    }
    return { valid: true };
  }

  // Split into local and domain parts
  const local = address.substring(0, atIndex);
  const domain = address.substring(atIndex + 1);

  // Validate local part
  if (!local || local.length === 0) {
    return { valid: false, error: 'Address local part cannot be empty' };
  }

  if (!ADDRESS_LOCAL_REGEX.test(local)) {
    return {
      valid: false,
      error: 'Address local part can only contain letters, numbers, dots, underscores, and hyphens',
    };
  }

  // Validate domain part
  if (!domain || domain.length === 0) {
    return { valid: false, error: 'Address domain cannot be empty' };
  }

  if (!ADDRESS_DOMAIN_REGEX.test(domain)) {
    return {
      valid: false,
      error: 'Address domain can only contain letters, numbers, dots, underscores, and hyphens',
    };
  }

  return { valid: true };
}

/**
 * Validate multiple mail addresses
 */
export function validateMailAddresses(addresses: string[]): ValidationResult {
  if (!Array.isArray(addresses)) {
    return { valid: false, error: 'Addresses must be an array' };
  }

  if (addresses.length > MAX_RECIPIENTS) {
    return {
      valid: false,
      error: `Too many recipients. Maximum is ${MAX_RECIPIENTS}`,
    };
  }

  for (const address of addresses) {
    const result = validateMailAddress(address);
    if (!result.valid) {
      return {
        valid: false,
        error: `Invalid address "${address}": ${result.error}`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Message ID Validation
// ============================================================================

/**
 * Validate a message ID format
 */
export function validateMessageId(messageId: string): ValidationResult {
  if (!messageId || typeof messageId !== 'string') {
    return { valid: false, error: 'Message ID is required' };
  }

  if (messageId.length > MAX_MESSAGE_ID_LENGTH) {
    return {
      valid: false,
      error: `Message ID exceeds maximum length of ${MAX_MESSAGE_ID_LENGTH} characters`,
    };
  }

  // Message IDs should be alphanumeric with underscores, hyphens, and dots
  // Format: mail_<timestamp>_<random>_<index>
  const messageIdRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!messageIdRegex.test(messageId)) {
    return {
      valid: false,
      error: 'Message ID contains invalid characters',
    };
  }

  return { valid: true };
}

// ============================================================================
// Subject Validation
// ============================================================================

/**
 * Validate a subject line
 */
export function validateSubject(subject: string): ValidationResult {
  if (!subject || typeof subject !== 'string') {
    return { valid: false, error: 'Subject is required' };
  }

  if (subject.length === 0) {
    return { valid: false, error: 'Subject cannot be empty' };
  }

  if (subject.length > MAX_SUBJECT_LENGTH) {
    return {
      valid: false,
      error: `Subject exceeds maximum length of ${MAX_SUBJECT_LENGTH} characters`,
    };
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(subject)) {
    return { valid: false, error: 'Subject contains invalid characters' };
  }

  return { valid: true };
}

// ============================================================================
// Body Validation
// ============================================================================

/**
 * Validate message body
 */
export function validateBody(body: string | undefined): ValidationResult {
  if (body === undefined || body === null) {
    return { valid: true }; // Body is optional
  }

  if (typeof body !== 'string') {
    return { valid: false, error: 'Body must be a string' };
  }

  if (body.length > MAX_BODY_LENGTH) {
    return {
      valid: false,
      error: `Body exceeds maximum length of ${MAX_BODY_LENGTH} bytes`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Priority Validation
// ============================================================================

/**
 * Validate message priority
 */
export function validatePriority(priority: string | undefined): ValidationResult {
  if (priority === undefined || priority === null) {
    return { valid: true }; // Priority is optional
  }

  if (!VALID_PRIORITIES.includes(priority as typeof VALID_PRIORITIES[number])) {
    return {
      valid: false,
      error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Pagination Validation
// ============================================================================

/**
 * Validate pagination parameters
 */
export function validatePagination(
  limit: number | undefined,
  offset: number | undefined,
): ValidationResult {
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit)) {
      return { valid: false, error: 'Limit must be an integer' };
    }
    if (limit < 1) {
      return { valid: false, error: 'Limit must be at least 1' };
    }
    if (limit > MAX_PAGINATION_LIMIT) {
      return {
        valid: false,
        error: `Limit cannot exceed ${MAX_PAGINATION_LIMIT}`,
      };
    }
  }

  if (offset !== undefined) {
    if (typeof offset !== 'number' || !Number.isInteger(offset)) {
      return { valid: false, error: 'Offset must be an integer' };
    }
    if (offset < 0) {
      return { valid: false, error: 'Offset cannot be negative' };
    }
  }

  return { valid: true };
}

// ============================================================================
// Sort Validation
// ============================================================================

/**
 * Validate sort parameters
 */
export function validateSort(
  sortBy: string | undefined,
  sortOrder: string | undefined,
): ValidationResult {
  if (sortBy !== undefined) {
    if (!VALID_SORT_FIELDS.includes(sortBy as typeof VALID_SORT_FIELDS[number])) {
      return {
        valid: false,
        error: `Invalid sort field. Must be one of: ${VALID_SORT_FIELDS.join(', ')}`,
      };
    }
  }

  if (sortOrder !== undefined) {
    if (!VALID_SORT_ORDERS.includes(sortOrder as typeof VALID_SORT_ORDERS[number])) {
      return {
        valid: false,
        error: `Invalid sort order. Must be one of: ${VALID_SORT_ORDERS.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// Search Query Validation
// ============================================================================

/**
 * Validate search query parameters
 */
export function validateSearchQuery(query: Record<string, unknown>): ValidationResult {
  // Validate date range if provided
  if (query.dateFrom !== undefined) {
    const dateFrom = new Date(query.dateFrom as string);
    if (isNaN(dateFrom.getTime())) {
      return { valid: false, error: 'Invalid dateFrom format' };
    }
  }

  if (query.dateTo !== undefined) {
    const dateTo = new Date(query.dateTo as string);
    if (isNaN(dateTo.getTime())) {
      return { valid: false, error: 'Invalid dateTo format' };
    }
  }

  // Validate priority if provided
  if (query.priority !== undefined) {
    const priorityResult = validatePriority(query.priority as string);
    if (!priorityResult.valid) {
      return priorityResult;
    }
  }

  return { valid: true };
}

// ============================================================================
// Outgoing Mail Validation
// ============================================================================

/**
 * Interface for outgoing mail to validate
 */
export interface ValidatableOutgoingMail {
  from: string;
  to: string | string[];
  subject: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: string[];
  priority?: string;
  taskId?: string;
}

/**
 * Validate an outgoing mail object
 */
export function validateOutgoingMail(mail: ValidatableOutgoingMail): ValidationResult {
  // Validate from address
  const fromResult = validateMailAddress(mail.from);
  if (!fromResult.valid) {
    return { valid: false, error: `Invalid from address: ${fromResult.error}` };
  }

  // Validate to addresses
  const toAddresses = Array.isArray(mail.to) ? mail.to : [mail.to];
  const toResult = validateMailAddresses(toAddresses);
  if (!toResult.valid) {
    return { valid: false, error: `Invalid to address: ${toResult.error}` };
  }

  // Validate subject
  const subjectResult = validateSubject(mail.subject);
  if (!subjectResult.valid) {
    return subjectResult;
  }

  // Validate body (optional)
  const bodyResult = validateBody(mail.body);
  if (!bodyResult.valid) {
    return bodyResult;
  }

  // Validate CC addresses (optional)
  if (mail.cc !== undefined) {
    const ccResult = validateMailAddresses(mail.cc);
    if (!ccResult.valid) {
      return { valid: false, error: `Invalid cc address: ${ccResult.error}` };
    }
  }

  // Validate BCC addresses (optional)
  if (mail.bcc !== undefined) {
    const bccResult = validateMailAddresses(mail.bcc);
    if (!bccResult.valid) {
      return { valid: false, error: `Invalid bcc address: ${bccResult.error}` };
    }
  }

  // Validate attachments (optional)
  if (mail.attachments !== undefined) {
    if (!Array.isArray(mail.attachments)) {
      return { valid: false, error: 'Attachments must be an array' };
    }
    if (mail.attachments.length > MAX_ATTACHMENTS) {
      return {
        valid: false,
        error: `Too many attachments. Maximum is ${MAX_ATTACHMENTS}`,
      };
    }
  }

  // Validate priority (optional)
  if (mail.priority !== undefined) {
    const priorityResult = validatePriority(mail.priority);
    if (!priorityResult.valid) {
      return priorityResult;
    }
  }

  // Validate taskId (optional)
  if (mail.taskId !== undefined && mail.taskId !== null) {
    if (typeof mail.taskId !== 'string') {
      return { valid: false, error: 'Task ID must be a string' };
    }
    if (mail.taskId.length > MAX_TASK_ID_LENGTH) {
      return {
        valid: false,
        error: `Task ID exceeds maximum length of ${MAX_TASK_ID_LENGTH} characters`,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// NoSQL Injection Prevention
// ============================================================================

/**
 * Check if a string contains NoSQL injection patterns
 * This is a defense-in-depth measure even though we use Prisma
 */
export function containsNoSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  const dangerousPatterns = [
    /\$where\s*:/,
    /\$regex\s*:/,
    /\$ne\s*:/,
    /\$gt\s*:/,
    /\$gte\s*:/,
    /\$lt\s*:/,
    /\$lte\s*:/,
    /\$in\s*:/,
    /\$nin\s*:/,
    /\$or\s*:/,
    /\$and\s*:/,
    /\$not\s*:/,
    /\$exists\s*:/,
    /\$type\s*:/,
    /\$mod\s*:/,
    /\$all\s*:/,
    /\$size\s*:/,
    /\$elemMatch\s*:/,
  ];

  return dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize a string to prevent NoSQL injection
 */
export function sanitizeNoSql(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove MongoDB operators
  return input.replace(/\$[a-zA-Z]+/g, '');
}
