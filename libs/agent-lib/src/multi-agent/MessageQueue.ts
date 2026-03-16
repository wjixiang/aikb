/**
 * Message Queue - Internal queue implementation for MessageBus
 *
 * This class manages the storage and retrieval of messages within a queue.
 */

import type {
  TaskMessage,
  QueueConfig,
  QueueStatus,
  MessagePriority,
} from './types.js';

/**
 * Default queue configuration
 */
const DEFAULT_QUEUE_CONFIG: Required<QueueConfig> = {
  name: '',
  durable: true,
  exclusive: false,
  autoDelete: false,
  messageTtl: 3600000,  // 1 hour
  maxLength: 10000,
  deadLetterQueue: '',
  deadLetterExchange: '',
};

/**
 * Internal message storage with priority support
 */
interface QueuedMessage {
  message: TaskMessage;
  priority: MessagePriority;
  enqueuedAt: number;
  expiresAt?: number;
}

/**
 * Message Queue Implementation
 */
export class MessageQueue {
  private readonly name: string;
  private readonly config: Required<QueueConfig>;
  private readonly messages: Map<string, QueuedMessage> = new Map();
  private readonly priorityQueue: MessagePriority[] = ['urgent', 'high', 'normal', 'low'];
  private processing: Set<string> = new Set();
  private failed: Map<string, { message: TaskMessage; error: Error; failedAt: number }> = new Map();
  private totalProcessed: number = 0;

  constructor(name: string, config?: Partial<QueueConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config, name };
  }

  /**
   * Get queue name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Enqueue a message
   */
  enqueue(message: TaskMessage): void {
    const now = Date.now();
    const ttl = this.config.messageTtl || 3600000;

    const queued: QueuedMessage = {
      message: {
        ...message,
        status: 'pending',
        createdAt: message.createdAt || new Date(),
      },
      priority: message.priority || 'normal',
      enqueuedAt: now,
      expiresAt: ttl > 0 ? now + ttl : undefined,
    };

    this.messages.set(message.messageId, queued);
  }

  /**
   * Dequeue the next message (FIFO with priority support)
   */
  dequeue(): TaskMessage | undefined {
    // First, try to find the highest priority message that hasn't expired
    for (const priority of this.priorityQueue) {
      const now = Date.now();

      // Find oldest message with this priority
      let oldest: QueuedMessage | undefined;
      let oldestId: string | undefined;

      for (const [id, queued] of this.messages.entries()) {
        if (queued.priority !== priority) continue;
        if (this.processing.has(id)) continue;
        if (queued.expiresAt && queued.expiresAt < now) continue;

        if (!oldest || queued.enqueuedAt < oldest.enqueuedAt) {
          oldest = queued;
          oldestId = id;
        }
      }

      if (oldest && oldestId) {
        this.processing.add(oldestId);
        return oldest.message;
      }
    }

    return undefined;
  }

  /**
   * Get a message by ID
   */
  get(messageId: string): TaskMessage | undefined {
    const queued = this.messages.get(messageId);
    return queued?.message;
  }

  /**
   * Get message with full metadata
   */
  getWithMeta(messageId: string): QueuedMessage | undefined {
    return this.messages.get(messageId);
  }

  /**
   * Mark message as being processed
   */
  markProcessing(messageId: string): void {
    this.processing.add(messageId);
  }

  /**
   * Mark message as completed (remove from queue)
   */
  markCompleted(messageId: string): void {
    this.messages.delete(messageId);
    this.processing.delete(messageId);
    this.failed.delete(messageId);
    this.totalProcessed++;
  }

  /**
   * Mark message as failed
   */
  markFailed(messageId: string, error?: Error): void {
    const queued = this.messages.get(messageId);
    if (queued) {
      this.failed.set(messageId, {
        message: queued.message,
        error: error || new Error('Unknown error'),
        failedAt: Date.now(),
      });
    }
    this.processing.delete(messageId);
  }

  /**
   * Get failed message
   */
  getFailed(messageId: string): { message: TaskMessage; error: Error; failedAt: number } | undefined {
    return this.failed.get(messageId);
  }

  /**
   * Retry a failed message
   */
  retryFailed(messageId: string): boolean {
    const failed = this.failed.get(messageId);
    if (failed) {
      // Reset status and re-enqueue
      const message = {
        ...failed.message,
        status: 'pending' as const,
        retryCount: failed.message.retryCount + 1,
      };
      this.enqueue(message);
      this.failed.delete(messageId);
      return true;
    }
    return false;
  }

  /**
   * Clear all failed messages
   */
  clearFailed(): number {
    const count = this.failed.size;
    this.failed.clear();
    return count;
  }

  /**
   * Clear expired messages
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [id, queued] of this.messages.entries()) {
      if (queued.expiresAt && queued.expiresAt < now) {
        this.messages.delete(id);
        this.processing.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get queue status
   */
  getStatus(): QueueStatus {
    return {
      name: this.name,
      pending: this.messages.size - this.processing.size,
      processing: this.processing.size,
      failed: this.failed.size,
      totalProcessed: this.totalProcessed,
    };
  }

  /**
   * Get all pending messages (for inspection)
   */
  getAllMessages(): TaskMessage[] {
    return Array.from(this.messages.values()).map(q => q.message);
  }

  /**
   * Get message count
   */
  size(): number {
    return this.messages.size;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.messages.size === 0;
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages.clear();
    this.processing.clear();
    this.failed.clear();
  }
}
