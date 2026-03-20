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
export type MessageStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead_letter';

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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a new TaskMessage
 */
export function createTaskMessage(
  params: Omit<
    TaskMessage,
    'messageId' | 'createdAt' | 'status' | 'retryCount'
  > & {
    messageId?: string;
  },
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
  params: Omit<TaskResult, 'resultId' | 'createdAt'> & { resultId?: string },
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
export function isTargetMatchReceiver(
  target: TaskTarget,
  sender: TaskSource,
): boolean {
  if (target.type === 'broadcast') {
    return true;
  }
  if (target.type === 'mc' && sender.type === 'mc') {
    return true;
  }
  if (target.type === 'expert' && sender.type === 'expert') {
    return (
      (target as { type: 'expert'; expertId: string }).expertId ===
      (sender as { type: 'expert'; expertId: string }).expertId
    );
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
