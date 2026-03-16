/**
 * MessageBus - Core message routing implementation for multi-agent system
 *
 * Responsibilities:
 * - Manage message queues
 * - Route messages to appropriate subscribers
 * - Handle message acknowledgment and dead letters
 */

import { injectable } from 'inversify';
import type {
  TaskMessage,
  TaskResult,
  TaskTarget,
  QueueConfig,
  QueueStatus,
  Subscription,
  SubscriptionOptions,
  MessageHandler,
  MessageBusConfig,
  MessageBusStats,
  MessageType,
  MessagePriority,
} from './types.js';
import { MessageQueue } from './MessageQueue.js';
import { generateMessageId } from './types.js';

/**
 * Default MessageBus configuration
 */
const DEFAULT_CONFIG: Required<MessageBusConfig> = {
  enableDeadLetter: true,
  deadLetterPrefix: 'dlq.',
  defaultTtl: 3600000,  // 1 hour
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Subscription entry with ID mapping
 */
interface SubscriptionEntry extends Subscription {
  queueName: string;
}

/**
 * MessageBus Implementation
 */
@injectable()
export class MessageBus {
  private readonly config: Required<MessageBusConfig>;
  private readonly queues: Map<string, MessageQueue> = new Map();
  private readonly subscriptions: Map<string, SubscriptionEntry> = new Map();
  private readonly subscriptionIndex: Map<string, Set<string>> = new Map();  // target -> subscription IDs
  private deadLetterQueue: MessageQueue | undefined;
  private initialized: boolean = false;
  private shuttingDown: boolean = false;

  // Statistics
  private stats: MessageBusStats = {
    totalSent: 0,
    totalReceived: 0,
    totalFailed: 0,
    totalDeadLetter: 0,
    activeSubscriptions: 0,
    queueStats: {
      totalQueues: 0,
      totalPending: 0,
      totalProcessing: 0,
      totalFailed: 0,
    },
  };

  constructor(config?: Partial<MessageBusConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== Lifecycle ====================

  /**
   * Initialize the message bus
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create dead letter queue if enabled
    if (this.config.enableDeadLetter) {
      this.deadLetterQueue = new MessageQueue(
        `${this.config.deadLetterPrefix}default`,
        {
          durable: true,
          messageTtl: this.config.defaultTtl * 24,  // Keep DLQ messages longer
        }
      );
      this.queues.set(this.deadLetterQueue.getName(), this.deadLetterQueue);
    }

    this.initialized = true;
  }

  /**
   * Shutdown the message bus
   */
  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;

    // Clear all subscriptions
    this.subscriptions.clear();
    this.subscriptionIndex.clear();

    // Clear all queues
    for (const queue of this.queues.values()) {
      queue.clear();
    }
    this.queues.clear();

    this.initialized = false;
    this.shuttingDown = false;
  }

  /**
   * Check if message bus is ready
   */
  isReady(): boolean {
    return this.initialized && !this.shuttingDown;
  }

  // ==================== Queue Management ====================

  /**
   * Create a new queue
   */
  async createQueue(config: QueueConfig): Promise<void> {
    if (this.queues.has(config.name)) {
      throw new Error(`Queue '${config.name}' already exists`);
    }

    const queue = new MessageQueue(config.name, {
      ...config,
      messageTtl: config.messageTtl || this.config.defaultTtl,
    });

    this.queues.set(config.name, queue);
    this.stats.queueStats.totalQueues = this.queues.size;
  }

  /**
   * Delete a queue
   */
  async deleteQueue(name: string): Promise<void> {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue '${name}' does not exist`);
    }

    // Don't delete dead letter queue
    if (this.deadLetterQueue && name === this.deadLetterQueue.getName()) {
      throw new Error('Cannot delete dead letter queue');
    }

    queue.clear();
    this.queues.delete(name);

    // Clean up subscriptions
    for (const [subId, sub] of this.subscriptions.entries()) {
      if (sub.queueName === name) {
        this.subscriptions.delete(subId);
      }
    }

    this.stats.queueStats.totalQueues = this.queues.size;
  }

  /**
   * Get queue status
   */
  getQueueStatus(name: string): QueueStatus | undefined {
    return this.queues.get(name)?.getStatus();
  }

  /**
   * Get all queue statuses
   */
  getAllQueueStatuses(): QueueStatus[] {
    return Array.from(this.queues.values()).map(q => q.getStatus());
  }

  // ==================== Subscription Management ====================

  /**
   * Get queue name for a target
   */
  private getQueueNameForTarget(target: TaskTarget): string {
    if (target.type === 'expert') {
      return `expert-${target.expertId}-input`;
    }
    if (target.type === 'mc') {
      return `mc-${target.mcId}-input`;
    }
    return 'broadcast';
  }

  /**
   * Subscribe to messages for a target
   */
  async subscribe(
    target: TaskTarget,
    handler: MessageHandler,
    options?: SubscriptionOptions
  ): Promise<Subscription> {
    const queueName = this.getQueueNameForTarget(target);

    // Ensure queue exists
    if (!this.queues.has(queueName)) {
      await this.createQueue({
        name: queueName,
        durable: true,
        messageTtl: this.config.defaultTtl,
      });
    }

    const subscriptionId = generateMessageId();
    const subscription: SubscriptionEntry = {
      subscriptionId,
      target,
      handler,
      filter: this.createFilter(options),
      active: true,
      createdAt: new Date(),
      queueName,
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Index by target for fast lookup
    const targetKey = this.getTargetKey(target);
    if (!this.subscriptionIndex.has(targetKey)) {
      this.subscriptionIndex.set(targetKey, new Set());
    }
    this.subscriptionIndex.get(targetKey)!.add(subscriptionId);

    this.stats.activeSubscriptions = this.subscriptions.size;

    return subscription;
  }

  /**
   * Create filter function from options
   */
  private createFilter(options?: SubscriptionOptions): ((message: TaskMessage) => boolean) | undefined {
    if (!options) return undefined;

    return (message: TaskMessage) => {
      // Filter by message type
      if (options.messageTypes && options.messageTypes.length > 0) {
        if (!options.messageTypes.includes(message.type)) {
          return false;
        }
      }

      // Filter by sender
      if (options.senderFilter && options.senderFilter.length > 0) {
        const senderMatch = options.senderFilter.some(s => {
          if (s.type !== message.sender.type) return false;
          if (s.type === 'mc' && message.sender.type === 'mc') {
            return s.mcId === message.sender.mcId;
          }
          if (s.type === 'expert' && message.sender.type === 'expert') {
            return s.expertId === message.sender.expertId;
          }
          return false;
        });
        if (!senderMatch) return false;
      }

      // Filter by priority
      if (options.minPriority) {
        const priorityOrder: MessagePriority[] = ['low', 'normal', 'high', 'urgent'];
        const minIndex = priorityOrder.indexOf(options.minPriority);
        const msgIndex = priorityOrder.indexOf(message.priority || 'normal');
        if (msgIndex < minIndex) return false;
      }

      return true;
    };
  }

  /**
   * Get target key for indexing
   */
  private getTargetKey(target: TaskTarget): string {
    if (target.type === 'broadcast') {
      return 'broadcast';
    }
    return `${target.type}:${target.type === 'mc' ? target.mcId : target.expertId}`;
  }

  /**
   * Unsubscribe from messages
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription '${subscriptionId}' not found`);
    }

    // Remove from index
    const targetKey = this.getTargetKey(subscription.target);
    this.subscriptionIndex.get(targetKey)?.delete(subscriptionId);

    // Remove subscription
    this.subscriptions.delete(subscriptionId);
    this.stats.activeSubscriptions = this.subscriptions.size;
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.active);
  }

  // ==================== Message Operations ====================

  /**
   * Get queue name for a receiver
   */
  private getQueueNameForReceiver(receiver: TaskTarget): string {
    return this.getQueueNameForTarget(receiver);
  }

  /**
   * Send a task message
   */
  async sendTask(message: TaskMessage): Promise<void> {
    this.ensureInitialized();

    const queueName = this.getQueueNameForReceiver(message.receiver);

    // Create queue if it doesn't exist
    if (!this.queues.has(queueName)) {
      await this.createQueue({
        name: queueName,
        durable: true,
        messageTtl: this.config.defaultTtl,
      });
    }

    const queue = this.queues.get(queueName)!;
    queue.enqueue(message);
    this.stats.totalSent++;

    // Trigger processing if there are subscribers
    await this.processQueue(queueName);
  }

  /**
   * Send a result message
   */
  async sendResult(result: TaskResult): Promise<void> {
    this.ensureInitialized();

    // Results go to the sender's queue (who requested the result)
    const queueName = this.getQueueNameForReceiver(result.receiver);

    // Create queue if it doesn't exist
    if (!this.queues.has(queueName)) {
      await this.createQueue({
        name: queueName,
        durable: true,
        messageTtl: this.config.defaultTtl,
      });
    }

    // Convert result to a message for routing
    const message: TaskMessage = {
      messageId: result.resultId,
      taskId: result.taskId,
      type: 'result',
      sender: result.sender,
      receiver: result.receiver,
      summary: result.summary,
      inputFiles: result.outputFiles,  // Results can be treated as "output files" from the sender
      payload: result.data,
      status: 'pending',
      retryCount: 0,
      createdAt: result.createdAt,
    };

    const queue = this.queues.get(queueName)!;
    queue.enqueue(message);
    this.stats.totalSent++;

    // Trigger processing
    await this.processQueue(queueName);
  }

  /**
   * Process messages in a queue
   */
  private async processQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    // Find subscriptions for this queue
    const matchingSubs: SubscriptionEntry[] = [];

    for (const sub of this.subscriptions.values()) {
      if (!sub.active) continue;
      if (sub.queueName !== queueName) continue;
      matchingSubs.push(sub);
    }

    // Process messages
    let message = queue.dequeue();
    while (message && matchingSubs.length > 0) {
      this.stats.totalReceived++;

      // Find matching subscriptions
      for (const sub of matchingSubs) {
        // Apply filter if exists
        if (sub.filter && !sub.filter(message)) {
          continue;
        }

        try {
          await sub.handler(message);
        } catch (error) {
          console.error(`Error in message handler:`, error);
          this.stats.totalFailed++;
        }
      }

      // Mark as completed
      queue.markCompleted(message.messageId);

      // Get next message
      message = queue.dequeue();
    }
  }

  /**
   * Acknowledge message processing
   */
  async ack(messageId: string): Promise<void> {
    this.ensureInitialized();

    // Find message in any queue and mark as completed
    for (const queue of this.queues.values()) {
      if (queue.get(messageId)) {
        queue.markCompleted(messageId);
        return;
      }
    }
  }

  /**
   * Reject message
   */
  async reject(messageId: string, requeue: boolean = false): Promise<void> {
    this.ensureInitialized();

    // Find message in any queue
    for (const queue of this.queues.values()) {
      const queued = queue.getWithMeta(messageId);
      if (!queued) continue;

      if (requeue && queued.message.retryCount < this.config.maxRetries) {
        // Retry the message
        queue.retryFailed(messageId);
      } else {
        // Send to dead letter queue
        queue.markFailed(messageId);

        if (this.deadLetterQueue) {
          const failed = queue.getFailed(messageId);
          if (failed) {
            this.deadLetterQueue.enqueue({
              ...failed.message,
              type: 'error',
              error: {
                code: 'DEAD_LETTER',
                message: failed.error.message,
              },
            });
          }
        }

        queue.markCompleted(messageId);
        this.stats.totalDeadLetter++;
      }

      return;
    }

    throw new Error(`Message '${messageId}' not found`);
  }

  // ==================== Utility ====================

  /**
   * Get message bus statistics
   */
  getStats(): MessageBusStats {
    // Update queue stats
    let totalPending = 0;
    let totalProcessing = 0;
    let totalFailed = 0;

    for (const queue of this.queues.values()) {
      const status = queue.getStatus();
      totalPending += status.pending;
      totalProcessing += status.processing;
      totalFailed += status.failed;
    }

    this.stats.queueStats = {
      totalQueues: this.queues.size,
      totalPending,
      totalProcessing,
      totalFailed,
    };
    this.stats.activeSubscriptions = this.subscriptions.size;

    return { ...this.stats };
  }

  /**
   * Ensure message bus is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MessageBus is not initialized. Call initialize() first.');
    }
    if (this.shuttingDown) {
      throw new Error('MessageBus is shutting down.');
    }
  }
}
