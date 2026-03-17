/**
 * Multi-Agent System Types - Core Type Definitions
 *
 * This module defines the core types for multi-agent communication,
 * including TaskMessage, TaskResult, and related interfaces.
 *
 * Design principles:
 * - Message-driven architecture (IPO model: Input/Process/Output)
 * - Expert-to-Expert communication via message passing
 * - Backward compatibility with existing ExpertTask
 */

import type { ExpertTask, ExpertResult } from '../core/expert/types.js';

// =============================================================================
// Task Source & Target - Who sends and receives messages
// =============================================================================

/**
 * Task source - identifies who sends a message
 * - mc: Main Controller (the orchestrator)
 * - expert: An Expert agent
 */
export type TaskSource =
  | { type: 'mc'; mcId: string }
  | { type: 'expert'; expertId: string };

/**
 * Task target - identifies who receives a message
 * - mc: Main Controller
 * - expert: A specific Expert
 * - broadcast: All available Experts
 */
export type TaskTarget =
  | { type: 'mc'; mcId: string }
  | { type: 'expert'; expertId: string }
  | { type: 'broadcast' };

/**
 * Source type enum (for easier comparison)
 */
export type SourceType = 'mc' | 'expert';

/**
 * Target type enum (for easier comparison)
 */
export type TargetType = 'mc' | 'expert' | 'broadcast';

// =============================================================================
// Task Message - The core communication unit between agents
// =============================================================================

/**
 * Task message type
 * - task: A new task to be processed
 * - result: A task result/response
 * - error: An error occurred
 * - heartbeat: Health check message
 */
export type MessageType = 'task' | 'result' | 'error' | 'heartbeat';

/**
 * Task message status
 */
export type MessageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

/**
 * Task message priority
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Core task message interface
 * This is the primary communication unit in the multi-agent system
 */
export interface TaskMessage {
  /** Unique message ID */
  messageId: string;
  /** Associated task ID (can span multiple messages) */
  taskId: string;
  /** Message type */
  type: MessageType;
  /** Sender of the message */
  sender: TaskSource;
  /** Intended receiver of the message */
  receiver: TaskTarget;
  /** Task summary/description */
  summary: string;
  /** Input file S3 keys (references to input files) */
  inputFiles?: string[];
  /** Additional payload data */
  payload?: Record<string, unknown>;
  /** Message priority */
  priority?: MessagePriority;
  /** Parent message ID (for message threading/tracing) */
  parentMessageId?: string;
  /** Correlation ID (for request-response matching) */
  correlationId?: string;
  /** Message creation timestamp */
  createdAt: Date;
  /** Message expiration time (optional) */
  expiresAt?: Date;
  /** Current message status */
  status: MessageStatus;
  /** Retry count */
  retryCount: number;
  /** Error information (if type is 'error') */
  error?: MessageError;
}

/**
 * Error information within a message
 */
export interface MessageError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace (optional) */
  stack?: string;
  /** Original error details */
  details?: Record<string, unknown>;
}

// =============================================================================
// Task Result - The output from processing a task
// =============================================================================

/**
 * Task result status
 */
export type ResultStatus = 'success' | 'failed' | 'partial' | 'cancelled';

/**
 * Task result interface
 * Represents the output of processing a TaskMessage
 */
export interface TaskResult {
  /** Unique result ID */
  resultId: string;
  /** Associated message ID */
  messageId: string;
  /** Associated task ID */
  taskId: string;
  /** Sender of the result */
  sender: TaskSource;
  /** Intended receiver of the result */
  receiver: TaskTarget;
  /** Result summary/description */
  summary: string;
  /** Output file S3 keys (references to output files) */
  outputFiles?: string[];
  /** Result data/payload */
  data?: Record<string, unknown>;
  /** Execution status */
  status: ResultStatus;
  /** Execution duration in milliseconds */
  duration: number;
  /** Result creation timestamp */
  createdAt: Date;
  /** Error information (if status is 'failed') */
  error?: MessageError;
}

// =============================================================================
// Message Queue - Queue management types
// =============================================================================

/**
 * Queue configuration
 */
export interface QueueConfig {
  /** Queue name */
  name: string;
  /** Whether queue is durable */
  durable?: boolean;
  /** Whether queue is exclusive */
  exclusive?: boolean;
  /** Auto-delete when empty */
  autoDelete?: boolean;
  /** Message TTL in milliseconds */
  messageTtl?: number;
  /** Maximum queue size */
  maxLength?: number;
  /** Dead letter queue name */
  deadLetterQueue?: string;
  /** Dead letter exchange */
  deadLetterExchange?: string;
}

/**
 * Queue status
 */
export interface QueueStatus {
  /** Queue name */
  name: string;
  /** Number of pending messages */
  pending: number;
  /** Number of messages being processed */
  processing: number;
  /** Number of failed messages */
  failed: number;
  /** Total messages processed */
  totalProcessed: number;
}

/**
 * Message queue statistics
 */
export interface QueueStats {
  /** Total queues */
  totalQueues: number;
  /** Total pending messages */
  totalPending: number;
  /** Total processing messages */
  totalProcessing: number;
  /** Total failed messages */
  totalFailed: number;
}

// =============================================================================
// Subscription - Message subscription management
// =============================================================================

/**
 * Message handler function
 */
export type MessageHandler = (message: TaskMessage) => Promise<void>;

/**
 * Result handler function
 */
export type ResultHandler = (result: TaskResult) => Promise<void>;

/**
 * Subscription information
 */
export interface Subscription {
  /** Unique subscription ID */
  subscriptionId: string;
  /** Subscribed target */
  target: TaskTarget;
  /** Handler function */
  handler: MessageHandler;
  /** Filter predicate (optional) */
  filter?: (message: TaskMessage) => boolean;
  /** Whether subscription is active */
  active: boolean;
  /** Created timestamp */
  createdAt: Date;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Filter messages by type */
  messageTypes?: MessageType[];
  /** Filter messages by sender */
  senderFilter?: TaskSource[];
  /** Filter by priority */
  minPriority?: MessagePriority;
  /** Auto-acknowledge */
  autoAck?: boolean;
}

// =============================================================================
// Adapter Types - Integration with existing Expert system
// =============================================================================

/**
 * Expert adapter configuration
 */
export interface ExpertAdapterConfig {
  /** Expert ID */
  expertId: string;
  /** Input queue name */
  inputQueue: string;
  /** Output queue name */
  outputQueue: string;
  /** Message processing timeout (ms) */
  messageTimeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Enable auto-subscribe */
  autoSubscribe?: boolean;
}

/**
 * Input transformation result
 */
export interface InputTransformation {
  /** Transformed input */
  input: unknown;
  /** Validation status */
  valid: boolean;
  /** Validation errors (if invalid) */
  errors?: string[];
  /** Warnings (if any) */
  warnings?: string[];
}

/**
 * Output transformation result
 */
export interface OutputTransformation {
  /** Transformed output */
  output: unknown;
  /** Generated output files */
  outputFiles?: string[];
  /** Summary text */
  summary: string;
}

/**
 * Expert adapter interface
 * Bridges the message queue with the existing Expert system
 */
export interface IExpertAdapter {
  /** Get expert ID */
  getExpertId(): string;

  /** Transform incoming TaskMessage to ExpertTask */
  transformInput(message: TaskMessage): Promise<InputTransformation>;

  /** Transform ExpertResult to TaskResult */
  transformOutput(
    expertResult: ExpertResult,
    originalMessage: TaskMessage
  ): Promise<TaskResult>;

  /** Start processing messages */
  start(): Promise<void>;

  /** Stop processing messages */
  stop(): Promise<void>;

  /** Check if adapter is running */
  isRunning(): boolean;
}

// =============================================================================
// MC (Main Controller) Adapter - Integration with orchestrator
// =============================================================================

/**
 * MC adapter configuration
 */
export interface MCAdapterConfig {
  /** MC ID */
  mcId: string;
  /** Input queue name (for receiving results) */
  inputQueue: string;
  /** Default expert output queue pattern */
  expertOutputPattern?: string;
  /** Enable result aggregation */
  aggregateResults?: boolean;
  /** Aggregation timeout (ms) */
  aggregationTimeout?: number;
}

/**
 * MC adapter interface
 * Bridges the message queue with the Main Controller
 */
export interface IMCAdapter {
  /** Get MC ID */
  getMcId(): string;

  /** Send task to expert(s) */
  sendTask(message: TaskMessage): Promise<void>;

  /** Send result to target */
  sendResult(result: TaskResult): Promise<void>;

  /** Register result handler */
  onResult(handler: ResultHandler): void;

  /** Unregister result handler */
  offResult(handler: ResultHandler): void;

  /** Start receiving messages */
  start(): Promise<void>;

  /** Stop receiving messages */
  stop(): Promise<void>;
}

// =============================================================================
// Message Bus - Core message routing
// =============================================================================

/**
 * Message bus configuration
 */
export interface MessageBusConfig {
  /** Enable dead letter queue */
  enableDeadLetter?: boolean;
  /** Dead letter queue prefix */
  deadLetterPrefix?: string;
  /** Default message TTL (ms) */
  defaultTtl?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
}

/**
 * Message bus statistics
 */
export interface MessageBusStats {
  /** Total messages sent */
  totalSent: number;
  /** Total messages received */
  totalReceived: number;
  /** Total messages failed */
  totalFailed: number;
  /** Total messages in dead letter */
  totalDeadLetter: number;
  /** Active subscriptions */
  activeSubscriptions: number;
  /** Queue statistics */
  queueStats: QueueStats;
}

/**
 * Message bus interface
 * Core component for message routing in multi-agent system
 */
export interface IMessageBus {
  /**
   * Initialize the message bus
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the message bus
   */
  shutdown(): Promise<void>;

  // Queue management
  /**
   * Create a queue
   */
  createQueue(config: QueueConfig): Promise<void>;

  /**
   * Delete a queue
   */
  deleteQueue(name: string): Promise<void>;

  /**
   * Get queue status
   */
  getQueueStatus(name: string): QueueStatus | undefined;

  /**
   * Get all queue statuses
   */
  getAllQueueStatuses(): QueueStatus[];

  // Subscription management
  /**
   * Subscribe to messages for a target
   */
  subscribe(
    target: TaskTarget,
    handler: MessageHandler,
    options?: SubscriptionOptions
  ): Promise<Subscription>;

  /**
   * Unsubscribe from messages
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): Subscription[];

  // Message operations
  /**
   * Send a task message
   */
  sendTask(message: TaskMessage): Promise<void>;

  /**
   * Send a result message
   */
  sendResult(result: TaskResult): Promise<void>;

  /**
   * Acknowledge a message (mark as processed)
   */
  ack(messageId: string): Promise<void>;

  /**
   * Reject a message (send to dead letter or requeue)
   */
  reject(messageId: string, requeue?: boolean): Promise<void>;

  // Utility
  /**
   * Get message bus statistics
   */
  getStats(): MessageBusStats;

  /**
   * Check if message bus is ready
   */
  isReady(): boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a new TaskMessage
 */
export function createTaskMessage(
  params: Omit<TaskMessage, 'messageId' | 'createdAt' | 'status' | 'retryCount'> & {
    messageId?: string;
  }
): TaskMessage {
  return {
    messageId: params.messageId || generateMessageId(),
    taskId: params.taskId,
    type: params.type,
    sender: params.sender,
    receiver: params.receiver,
    summary: params.summary,
    inputFiles: params.inputFiles,
    payload: params.payload,
    priority: params.priority || 'normal',
    parentMessageId: params.parentMessageId,
    correlationId: params.correlationId,
    createdAt: new Date(),
    expiresAt: params.expiresAt,
    status: 'pending',
    retryCount: 0,
  };
}

/**
 * Create a new TaskResult
 */
export function createTaskResult(
  params: Omit<TaskResult, 'resultId' | 'createdAt'> & { resultId?: string }
): TaskResult {
  return {
    resultId: params.resultId || generateResultId(),
    messageId: params.messageId,
    taskId: params.taskId,
    sender: params.sender,
    receiver: params.receiver,
    summary: params.summary,
    outputFiles: params.outputFiles,
    data: params.data,
    status: params.status,
    duration: params.duration,
    createdAt: new Date(),
    error: params.error,
  };
}

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate unique result ID
 */
export function generateResultId(): string {
  return `res_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate unique task ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if target matches source
 */
export function isTargetMatchReceiver(target: TaskTarget, sender: TaskSource): boolean {
  if (target.type === 'broadcast') {
    return true;
  }
  if (target.type === 'mc' && sender.type === 'mc') {
    return true;
  }
  if (target.type === 'expert' && sender.type === 'expert') {
    return (target as { type: 'expert'; expertId: string }).expertId ===
      (sender as { type: 'expert'; expertId: string }).expertId;
  }
  return false;
}

/**
 * Get display name for TaskSource
 */
export function getSourceDisplayName(source: TaskSource): string {
  if (source.type === 'mc') {
    return `MC:${source.mcId}`;
  }
  return `Expert:${source.expertId}`;
}

/**
 * Get display name for TaskTarget
 */
export function getTargetDisplayName(target: TaskTarget): string {
  if (target.type === 'mc') {
    return `MC:${target.mcId}`;
  }
  if (target.type === 'expert') {
    return `Expert:${target.expertId}`;
  }
  return 'Broadcast';
}

// =============================================================================
// Email-Style Mail System - 邮件风格消息系统
// =============================================================================

/**
 * Mail Address - Unified email-style address
 * Examples: "pubmed@expert", "analysis@expert", "main@mc", "broadcast"
 * Format: "user@domain" or just "name" for simple addresses
 */
export type MailAddress = string;

/**
 * Parse address string to get domain and user parts
 */
export function parseMailAddress(address: MailAddress): { user: string; domain: string } {
  if (address.includes('@')) {
    const [user, domain] = address.split('@');
    return { user, domain };
  }
  // No domain specified, treat as simple address
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

/**
 * Mail priority
 */
export type MailPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Mail message status
 */
export interface MailMessageStatus {
  read: boolean;
  starred: boolean;
  deleted: boolean;
}

/**
 * Mail message - 邮件消息
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
  priority: MailPriority;
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
 * 发送邮件参数
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
  priority?: MailPriority;
  inReplyTo?: string;
  taskId?: string;
}

/**
 * 邮件监听器 - Expert 实现此接口来处理新邮件
 */
export interface IMailListener {
  /** 新邮件到达时立即调用 */
  onNewMail(mail: MailMessage): Promise<void>;
  /** 处理错误时调用 */
  onError?(error: Error): void;
}

/**
 * 订阅 ID
 */
export type SubscriptionId = string;

/**
 * 邮件订阅信息
 */
export interface MailSubscription {
  subscriptionId: SubscriptionId;
  address: MailAddress;
  listener: IMailListener;
  createdAt: Date;
}

// =============================================================================
// Query Types - 查询类型
// =============================================================================

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
  priority?: MailPriority;
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

// =============================================================================
// Storage Interface - 存储接口
// =============================================================================

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
  /** Initialize the storage backend */
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

  /** Close/cleanup storage connections */
  close(): Promise<void>;
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export from expert types for type compatibility
export type { ExpertTask, ExpertResult } from '../core/expert/types.js';
