/**
 * Input Sanitization Module
 *
 * Provides functions to sanitize user inputs and prevent XSS attacks.
 * Uses DOMPurify for HTML sanitization.
 */

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// Initialize DOMPurify with JSDOM for server-side use
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// DOMPurify configuration for strict sanitization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STRICT_CONFIG: any = {
  ALLOWED_TAGS: [], // No HTML tags allowed
  ALLOWED_ATTR: [], // No attributes allowed
  KEEP_CONTENT: true, // Keep text content
  SANITIZE_DOM: true,
  SAFE_FOR_TEMPLATES: true,
};

// DOMPurify configuration for rich text (if needed)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RICH_TEXT_CONFIG: any = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href', 'title'],
  SANITIZE_DOM: true,
  SAFE_FOR_TEMPLATES: true,
};

/**
 * Sanitize a string by removing all HTML tags
 * Use for plain text fields like subject, addresses
 */
export function sanitizePlainText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return String(purify.sanitize(input, STRICT_CONFIG)).trim();
}

/**
 * Sanitize email body content
 * Allows basic formatting tags but removes dangerous content
 */
export function sanitizeEmailBody(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return String(purify.sanitize(input, RICH_TEXT_CONFIG)).trim();
}

/**
 * Sanitize an array of strings
 */
export function sanitizeStringArray(inputs: string[]): string[] {
  if (!Array.isArray(inputs)) {
    return [];
  }
  return inputs
    .map(item => sanitizePlainText(item))
    .filter(item => item.length > 0);
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove null bytes and control characters
 */
export function removeControlChars(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Remove null bytes and control characters (except common whitespace)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize a search query string
 * Removes special characters that could be used for injection
 */
export function sanitizeSearchQuery(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Remove control characters first
  let sanitized = removeControlChars(input);
  // Escape special regex characters for safe pattern matching
  sanitized = escapeRegex(sanitized);
  return sanitized.trim();
}

/**
 * Validate and sanitize a JSON payload
 * Returns null if the payload is invalid or contains dangerous patterns
 */
export function sanitizeJsonPayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  try {
    // Convert to string and back to ensure it's serializable
    const serialized = JSON.stringify(payload);

    // Check for prototype pollution patterns
    const dangerousPatterns = [
      /"__proto__"\s*:/,
      /"constructor"\s*:\s*\{/,
      /"prototype"\s*:/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(serialized)) {
        console.warn('Blocked potentially dangerous JSON payload');
        return null;
      }
    }

    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Sanitize outgoing mail content
 * Returns a sanitized version of the mail object
 */
export interface SanitizableMail {
  from: string;
  to: string | string[];
  subject: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: string[];
  payload?: Record<string, unknown>;
  taskId?: string;
}

export function sanitizeOutgoingMail(mail: SanitizableMail): SanitizableMail {
  const sanitized: SanitizableMail = {
    from: sanitizePlainText(mail.from),
    to: Array.isArray(mail.to)
      ? sanitizeStringArray(mail.to)
      : sanitizePlainText(mail.to),
    subject: sanitizePlainText(mail.subject),
  };

  if (mail.body !== undefined) {
    sanitized.body = sanitizeEmailBody(mail.body);
  }

  if (mail.cc !== undefined) {
    sanitized.cc = sanitizeStringArray(mail.cc);
  }

  if (mail.bcc !== undefined) {
    sanitized.bcc = sanitizeStringArray(mail.bcc);
  }

  if (mail.attachments !== undefined) {
    sanitized.attachments = mail.attachments
      .map(att => removeControlChars(att).trim())
      .filter(att => att.length > 0);
  }

  if (mail.payload !== undefined) {
    const sanitizedPayload = sanitizeJsonPayload(mail.payload);
    if (sanitizedPayload !== null) {
      sanitized.payload = sanitizedPayload;
    }
  }

  if (mail.taskId !== undefined) {
    sanitized.taskId = sanitizePlainText(mail.taskId);
  }

  return sanitized;
}

/**
 * Check if a string contains HTML
 */
export function containsHtml(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  const htmlRegex = /<[^>]+>/;
  return htmlRegex.test(input);
}

/**
 * Check if a string contains potentially dangerous JavaScript
 */
export function containsDangerousJs(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
    /data:text\/html/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
  ];

  return dangerousPatterns.some(pattern => pattern.test(input));
}
