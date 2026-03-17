import { z } from 'zod';

/**
 * Mail address validation
 * Supports email-style addresses like "pubmed@expert", "main@mc", or simple names
 */
export const mailAddressSchema = z
  .string()
  .min(1, 'Address is required')
  .max(255, 'Address is too long')
  .regex(
    /^[a-zA-Z0-9_-]+(@[a-zA-Z0-9_-]+)?$/,
    'Invalid address format. Use "user@domain" or "name" format'
  );

/**
 * Message priority validation
 */
export const messagePrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']).default('normal');

/**
 * Pagination options validation
 */
export const paginationOptionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Outgoing mail validation schema
 */
export const outgoingMailSchema = z.object({
  from: mailAddressSchema,
  to: z.union([mailAddressSchema, z.array(mailAddressSchema).min(1)]),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject is too long'),
  body: z.string().max(100000, 'Body is too long').optional(),
  cc: z.array(mailAddressSchema).optional(),
  bcc: z.array(mailAddressSchema).optional(),
  attachments: z.array(z.string().min(1)).max(10, 'Too many attachments').optional(),
  payload: z.record(z.unknown()).optional(),
  priority: messagePrioritySchema,
  taskId: z.string().max(255).optional(),
  inReplyTo: z.string().optional(),
});

/**
 * Reply mail validation schema
 */
export const replyMailSchema = z.object({
  body: z.string().min(1, 'Reply body is required').max(100000, 'Body is too long'),
  attachments: z.array(z.string().min(1)).max(10, 'Too many attachments').optional(),
  payload: z.record(z.unknown()).optional(),
  from: mailAddressSchema.optional(),
});

/**
 * Inbox query validation schema
 */
export const inboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  unreadOnly: z.coerce.boolean().optional(),
  starredOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(['sentAt', 'receivedAt', 'subject', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Search query validation schema
 */
export const searchQuerySchema = z.object({
  from: mailAddressSchema.optional(),
  to: mailAddressSchema.optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(10000).optional(),
  unread: z.boolean().optional(),
  read: z.boolean().optional(),
  starred: z.boolean().optional(),
  priority: messagePrioritySchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  pagination: paginationOptionsSchema.optional(),
});

/**
 * Batch operation validation schema
 */
export const batchOperationSchema = z.object({
  operation: z.enum(['markAsRead', 'markAsUnread', 'star', 'unstar', 'delete']),
  messageIds: z.array(z.string().min(1)).min(1, 'At least one message ID is required'),
});

/**
 * Register address validation schema
 */
export const registerAddressSchema = z.object({
  address: mailAddressSchema,
});

/**
 * Message ID parameter validation
 */
export const messageIdParamSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
});

/**
 * Address parameter validation
 */
export const addressParamSchema = z.object({
  address: mailAddressSchema,
});

/**
 * Send mail response schema
 */
export const sendMailResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  sentAt: z.string().datetime().optional(),
  error: z.string().optional(),
});

/**
 * Storage result response schema
 */
export const storageResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

/**
 * Inbox response schema
 */
export const inboxResponseSchema = z.object({
  address: z.string(),
  messages: z.array(z.unknown()),
  total: z.number().int(),
  unread: z.number().int(),
  starred: z.number().int(),
});

/**
 * Health check response schema
 */
export const healthResponseSchema = z.object({
  health: z.boolean(),
  timestamp: z.string().datetime(),
});

/**
 * Thread result response schema
 */
export const threadResultSchema = z.object({
  rootMessage: z.unknown(),
  messages: z.array(z.unknown()),
  total: z.number().int(),
});

/**
 * Batch operation result schema
 */
export const batchOperationResultSchema = z.object({
  success: z.boolean(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  errors: z.array(z.object({
    messageId: z.string(),
    error: z.string(),
  })).optional(),
});

// Type exports
export type OutgoingMailInput = z.infer<typeof outgoingMailSchema>;
export type ReplyMailInput = z.infer<typeof replyMailSchema>;
export type InboxQueryInput = z.infer<typeof inboxQuerySchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type BatchOperationInput = z.infer<typeof batchOperationSchema>;
export type RegisterAddressInput = z.infer<typeof registerAddressSchema>;
export type MessageIdParamInput = z.infer<typeof messageIdParamSchema>;
export type AddressParamInput = z.infer<typeof addressParamSchema>;
