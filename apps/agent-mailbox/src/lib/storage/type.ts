/**
 * Mailbox Storage Module Type Definitions
 *
 * These types are synchronized with agent-lib/src/multi-agent/types.ts
 * to ensure consistency across the codebase.
 */

// ============================================================================
// Address Types - Unified Email-Style
// ============================================================================

/**
 * Mail address - Unified email-style address
 * Examples: "pubmed@expert", "analysis@expert", "main@mc", "broadcast"
 * Format: "user@domain" or just "name" for simple addresses
 */
export type MailAddress = string;

/**
 * Parse address string to get domain and user parts
 * e.g., "pubmed@expert" -> { user: "pubmed", domain: "expert" }
 */
export function parseMailAddress(address: MailAddress): { user: string; domain: string } {
  if (address.includes('@')) {
    const [user, domain] = address.split('@');
    return { user, domain };
  }
  return { user: address, domain: '' };
}

/**
 * Check if address is a broadcast
 */
export function isBroadcast(address: MailAddress): boolean {
  return address === 'broadcast' || address === '@broadcast';
}

/**
 * Create a MailAddress from user and domain
 */
export function createMailAddress(user: string, domain?: string): MailAddress {
  if (!domain) {
    return user;
  }
  return `${user}@${domain}`;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Message priority level
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Mail message status
 */
export interface MailMessageStatus {
  read: boolean;
  starred: boolean;
  deleted: boolean;
}

/**
 * A mail message in the mailbox system
 */
export interface MailMessage {
  /** Unique message identifier */
  messageId: string;
  /** Message subject */
  subject: string;
  /** Message body/content */
  body?: string;
  /** Sender address */
  from: MailAddress;
  /** Recipient address(es) */
  to: MailAddress | MailAddress[];
  /** Carbon copy recipients */
  cc?: MailAddress[];
  /** Blind carbon copy recipients */
  bcc?: MailAddress[];
  /** Attachment URLs or S3 keys */
  attachments?: string[];
  /** Custom payload data */
  payload?: Record<string, unknown>;
  /** Message priority */
  priority: MessagePriority;
  /** Message status */
  status: MailMessageStatus;
  /** Task ID associated with this message */
  taskId?: string;
  /** Timestamp when message was sent (ISO string) */
  sentAt: string;
  /** Timestamp when message was received (ISO string) */
  receivedAt: string;
  /** Timestamp when message was last modified (ISO string) */
  updatedAt: string;
  /** Reply to message ID */
  inReplyTo?: string;
  /** Message reference chain */
  references?: string[];
}

/**
 * Outgoing mail for sending
 */
export interface OutgoingMail {
  from: MailAddress;
  to: MailAddress | MailAddress[];
  subject: string;
  body?: string;
  cc?: MailAddress[];
  bcc?: MailAddress[];
  attachments?: string[];
  payload?: Record<string, unknown>;
  priority?: MessagePriority;
  taskId?: string;
  inReplyTo?: string;
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Pagination options for inbox queries
 */
export interface PaginationOptions {
  /** Maximum number of results to return */
  limit: number;
  /** Number of results to skip */
  offset: number;
}

/**
 * Inbox query options
 */
export interface InboxQuery {
  /** Filter by unread status only */
  unreadOnly?: boolean;
  /** Filter by star status */
  starredOnly?: boolean;
  /** Filter by sender */
  from?: MailAddress;
  /** Filter by subject contains */
  subject?: string;
  /** Filter by body contains */
  body?: string;
  /** Sort field */
  sortBy?: 'sentAt' | 'receivedAt' | 'subject' | 'priority';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Search query options
 */
export interface SearchQuery {
  /** Filter by sender */
  from?: MailAddress;
  /** Filter by recipient */
  to?: MailAddress;
  /** Filter by subject contains */
  subject?: string;
  /** Filter by body contains */
  body?: string;
  /** Filter by unread status */
  unread?: boolean;
  /** Filter by read status */
  read?: boolean;
  /** Filter by star status */
  starred?: boolean;
  /** Filter by priority */
  priority?: MessagePriority;
  /** Filter by date range - start (ISO string) */
  dateFrom?: string;
  /** Filter by date range - end (ISO string) */
  dateTo?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
}

/**
 * Inbox result with metadata
 */
export interface InboxResult {
  /** The requested address */
  address: MailAddress;
  /** List of messages */
  messages: MailMessage[];
  /** Total number of messages matching query */
  total: number;
  /** Number of unread messages */
  unread: number;
  /** Number of starred messages */
  starred: number;
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Result of send operation
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  sentAt?: string;
  error?: string;
}

/**
 * Storage operation result
 */
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Mail storage interface defining operations for storing and retrieving mail
 */
export interface IMailStorage {
  /**
   * Initialize the storage backend
   */
  initialize(): Promise<void>;

  /**
   * Send/save a mail message
   * @param mail The outgoing mail to send
   * @returns Result containing messageId on success
   */
  send(mail: OutgoingMail): Promise<SendResult>;

  /**
   * Get messages for a specific inbox address
   * @param address The mailbox address to query
   * @param query Optional query parameters
   * @returns Inbox result with messages and metadata
   */
  getInbox(address: MailAddress, query?: InboxQuery): Promise<InboxResult>;

  /**
   * Get a single message by ID
   * @param messageId The message ID to retrieve
   * @returns The mail message if found
   */
  getMessage(messageId: string): Promise<MailMessage | null>;

  /**
   * Get unread message count for an address
   * @param address The mailbox address
   * @returns Number of unread messages
   */
  getUnreadCount(address: MailAddress): Promise<number>;

  /**
   * Mark a message as read
   * @param messageId The message ID to mark as read
   * @returns Result of the operation
   */
  markAsRead(messageId: string): Promise<StorageResult>;

  /**
   * Mark a message as unread
   * @param messageId The message ID to mark as unread
   * @returns Result of the operation
   */
  markAsUnread(messageId: string): Promise<StorageResult>;

  /**
   * Star a message
   * @param messageId The message ID to star
   * @returns Result of the operation
   */
  starMessage(messageId: string): Promise<StorageResult>;

  /**
   * Unstar a message
   * @param messageId The message ID to unstar
   * @returns Result of the operation
   */
  unstarMessage(messageId: string): Promise<StorageResult>;

  /**
   * Delete a message (soft delete)
   * @param messageId The message ID to delete
   * @returns Result of the operation
   */
  deleteMessage(messageId: string): Promise<StorageResult>;

  /**
   * Permanently remove a message
   * @param messageId The message ID to remove
   * @returns Result of the operation
   */
  removeMessage(messageId: string): Promise<StorageResult>;

  /**
   * Search messages across all mailboxes
   * @param query Search query parameters
   * @returns List of matching messages
   */
  search(query: SearchQuery): Promise<MailMessage[]>;

  /**
   * Register a new mailbox address
   * @param address The address to register
   * @returns Result of the operation
   */
  registerAddress(address: MailAddress): Promise<StorageResult>;

  /**
   * Check if an address is registered
   * @param address The address to check
   * @returns True if the address is registered
   */
  isAddressRegistered(address: MailAddress): Promise<boolean>;

  /**
   * Get all registered addresses
   * @returns List of all registered addresses
   */
  getRegisteredAddresses(): Promise<MailAddress[]>;

  /**
   * Close/cleanup storage connections
   */
  close(): Promise<void>;
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Storage backend configuration
 */
export interface StorageConfig {
  /** Type of storage backend */
  type: 'memory' | 'redis' | 'database';
  /** Connection/config options */
  options?: Record<string, unknown>;
}

/**
 * Factory function to create a storage instance
 */
export type StorageFactory = (config: StorageConfig) => IMailStorage;
