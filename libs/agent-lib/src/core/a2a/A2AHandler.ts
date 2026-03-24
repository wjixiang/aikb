/**
 * A2A Handler - Handler for processing incoming A2A messages
 *
 * Processes incoming A2A messages and routes them to appropriate handlers.
 */

import pino from 'pino';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
import { createMessage } from '../runtime/topology/types.js';
import type {
  A2AMessage,
  A2AMessageType,
  A2APayload,
  A2AContext,
  A2ATaskHandler,
  A2AQueryHandler,
  A2AEventHandler,
  A2ACancelHandler,
  A2AHandlerConfig,
  A2ATaskResult,
  A2ATaskStatus,
} from './types.js';

export interface IA2AHandler {
  /** Handle an incoming A2A message */
  handleMessage(message: A2AMessage): Promise<A2ATaskResult | void>;

  /** Register a task handler */
  onTask(handler: A2ATaskHandler): void;

  /** Register a query handler */
  onQuery(handler: A2AQueryHandler): void;

  /** Register an event handler */
  onEvent(handler: A2AEventHandler): void;

  /** Register a cancel handler */
  onCancel(handler: A2ACancelHandler): void;

  /** Start listening for messages */
  startListening(): void;

  /** Stop listening for messages */
  stopListening(): void;

  /** Get pending task messages awaiting acknowledgment */
  getPendingTasks(): PendingTask[];

  /** Send acknowledgment for a message */
  acknowledge(conversationId: string): Promise<void>;

  /** Send task result response */
  sendTaskResult(
    conversationId: string,
    output: unknown,
    status: A2ATaskStatus,
    error?: string,
  ): Promise<void>;

  /** Send error response */
  sendTaskError(conversationId: string, error: string): Promise<void>;

  /** Set callback for when a task is completed via completeTask tool */
  setTaskCompletionCallback(
    callback: (conversationId: string, output: unknown, status: string) => void,
  ): void;

  /** Signal that an A2A task has been completed (calls the registered callback) */
  completeTask(conversationId: string, output: unknown, status: string): void;
}

/**
 * Pending task awaiting acknowledgment
 */
export interface PendingTask {
  conversationId: string;
  messageId: string;
  messageType: A2AMessageType;
  from: string;
  payload: A2APayload;
  receivedAt: number;
  acknowledged?: boolean;
}

/**
 * A2A Handler implementation
 *
 * Processes incoming A2A messages and routes them to registered handlers.
 * Sends responses back via the MessageBus.
 */
export class A2AHandler implements IA2AHandler {
  private readonly logger: pino.Logger;
  private readonly instanceId: string;
  private readonly supportedTypes: A2AMessageType[];
  private readonly messageBus: IMessageBus;
  private readonly handlerTimeout: number;

  private taskHandler?: A2ATaskHandler;
  private queryHandler?: A2AQueryHandler;
  private eventHandler?: A2AEventHandler;
  private cancelHandler?: A2ACancelHandler;

  private unsubscribeMessage?: () => void;
  private isListening = false;

  /**
   * Pending tasks awaiting acknowledgment
   * Key: conversationId
   */
  private pendingTasks: Map<string, PendingTask> = new Map();

  /**
   * Callback for when task is completed via completeTask tool
   */
  private taskCompletionCallback?: (
    conversationId: string,
    output: unknown,
    status: string,
  ) => void;

  constructor(messageBus: IMessageBus, config: A2AHandlerConfig) {
    this.logger = pino({
      level: 'debug',
      timestamp: pino.stdTimeFunctions.isoTime,
    });
    this.instanceId = config.instanceId;
    this.supportedTypes = config.supportedTypes;
    this.messageBus = messageBus;
    this.handlerTimeout = config.handlerTimeout ?? 60000;
  }

  /**
   * Handle an incoming A2A message
   */
  async handleMessage(message: A2AMessage): Promise<A2ATaskResult | void> {
    if (message.to !== this.instanceId) {
      this.logger.warn(
        { messageTo: message.to, myId: this.instanceId },
        'Message not addressed to this agent, ignoring',
      );
      return;
    }

    this.logger.info(
      {
        messageType: message.messageType,
        from: message.from,
        messageId: message.messageId,
      },
      'Handling incoming A2A message',
    );

    const context: A2AContext = {
      message,
      startTime: Date.now(),
      metadata: {},
    };

    try {
      switch (message.messageType) {
        case 'task':
          return await this.processTask(message, context);
        case 'query':
          return await this.processQuery(message, context);
        case 'event':
          return await this.processEvent(message, context);
        case 'cancel':
          return await this.processCancel(message, context);
        case 'response':
          // Response messages are handled by the conversation tracking in MessageBus
          this.logger.debug('Response message received, handled by MessageBus');
          return;
        case 'stream':
          // Streaming not yet implemented
          this.logger.warn('Streaming not yet implemented');
          return;
        default:
          this.logger.warn(
            { messageType: message.messageType },
            'Unknown message type',
          );
          return;
      }
    } catch (error) {
      const errorInfo =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { error: String(error) };

      this.logger.error(
        { error: errorInfo, messageId: message.messageId },
        'Error handling message',
      );

      // Send error response
      await this.sendErrorResponse(message, errorInfo.message || String(error));
    }
  }

  /**
   * Register a task handler
   */
  onTask(handler: A2ATaskHandler): void {
    this.taskHandler = handler;
    this.logger.debug('Task handler registered');
  }

  /**
   * Register a query handler
   */
  onQuery(handler: A2AQueryHandler): void {
    this.queryHandler = handler;
    this.logger.debug('Query handler registered');
  }

  /**
   * Register an event handler
   */
  onEvent(handler: A2AEventHandler): void {
    this.eventHandler = handler;
    this.logger.debug('Event handler registered');
  }

  /**
   * Register a cancel handler
   */
  onCancel(handler: A2ACancelHandler): void {
    this.cancelHandler = handler;
    this.logger.debug('Cancel handler registered');
  }

  /**
   * Start listening for messages from the MessageBus
   */
  startListening(): void {
    if (this.isListening) {
      this.logger.warn('Already listening for messages');
      return;
    }

    this.unsubscribeMessage = this.messageBus.onMessage(
      async (topologyMessage) => {
        // Only process messages addressed to this agent
        if (topologyMessage.to !== this.instanceId) {
          return;
        }

        // Check if this is an A2A message (content should be A2AMessage)
        const content = topologyMessage.content;
        if (this.isA2AMessage(content)) {
          await this.handleMessage(content);
        }
      },
    );

    this.isListening = true;
    this.logger.info(
      { instanceId: this.instanceId },
      'Started listening for A2A messages',
    );
  }

  /**
   * Stop listening for messages
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
      this.unsubscribeMessage = undefined;
    }

    this.isListening = false;
    this.logger.info(
      { instanceId: this.instanceId },
      'Stopped listening for A2A messages',
    );
  }

  /**
   * Get all pending tasks awaiting acknowledgment
   */
  getPendingTasks(): PendingTask[] {
    return Array.from(this.pendingTasks.values());
  }

  /**
   * Set callback for when task is completed via completeTask tool
   */
  setTaskCompletionCallback(
    callback: (conversationId: string, output: unknown, status: string) => void,
  ): void {
    this.taskCompletionCallback = callback;
  }

  /**
   * Send acknowledgment for a pending task
   */
  async acknowledge(conversationId: string): Promise<void> {
    const pending = this.pendingTasks.get(conversationId);
    if (!pending) {
      this.logger.warn(
        { conversationId },
        'No pending task found for acknowledgment',
      );
      return;
    }

    try {
      await this.messageBus.sendAck(pending.from, conversationId, {
        messageId: pending.messageId,
        status: 'acknowledged',
      });
      pending.acknowledged = true;
      this.logger.debug({ conversationId }, 'Sent ACK');
    } catch (error) {
      this.logger.error({ error, conversationId }, 'Failed to send ACK');
      throw error;
    }
  }

  /**
   * Send task result response
   */
  async sendTaskResult(
    conversationId: string,
    output: unknown,
    status: A2ATaskStatus,
    error?: string,
  ): Promise<void> {
    const pending = this.pendingTasks.get(conversationId);
    if (!pending) {
      this.logger.warn(
        { conversationId },
        'No pending task found for sending result',
      );
      throw new Error(`No pending task found: ${conversationId}`);
    }

    try {
      await this.messageBus.sendResult(pending.from, conversationId, {
        output,
        status,
        error,
      });
      this.pendingTasks.delete(conversationId);
      this.logger.debug({ conversationId, status }, 'Sent result');
    } catch (error) {
      this.logger.error({ error, conversationId }, 'Failed to send result');
      throw error;
    }
  }

  /**
   * Send error response
   */
  async sendTaskError(conversationId: string, error: string): Promise<void> {
    const pending = this.pendingTasks.get(conversationId);
    if (!pending) {
      this.logger.warn(
        { conversationId },
        'No pending task found for sending error',
      );
      throw new Error(`No pending task found: ${conversationId}`);
    }

    try {
      await this.messageBus.sendError(pending.from, conversationId, error);
      this.pendingTasks.delete(conversationId);
      this.logger.debug({ conversationId }, 'Sent error');
    } catch (err) {
      this.logger.error({ err, conversationId }, 'Failed to send error');
      throw err;
    }
  }

  /**
   * Signal that an A2A task has been completed
   * Calls the registered callback to notify the waiting task handler
   */
  completeTask(conversationId: string, output: unknown, status: string): void {
    if (this.taskCompletionCallback) {
      this.taskCompletionCallback(conversationId, output, status);
      this.logger.debug(
        { conversationId, status },
        'Task completion callback invoked',
      );
    } else {
      this.logger.warn(
        { conversationId },
        'No task completion callback registered',
      );
    }
  }

  /**
   * Process a task message
   * Stores in pendingTasks for manual ACK, does NOT auto-ACK
   */
  private async processTask(
    message: A2AMessage,
    context: A2AContext,
  ): Promise<A2ATaskResult | void> {
    if (!this.taskHandler) {
      this.logger.warn('No task handler registered, sending error response');
      await this.sendErrorResponse(message, 'No task handler registered');
      return;
    }

    const payload = message.content;

    // Store as pending task (component will control ACK via acknowledge())
    this.pendingTasks.set(message.conversationId, {
      conversationId: message.conversationId,
      messageId: message.messageId,
      messageType: message.messageType,
      from: message.from,
      payload,
      receivedAt: Date.now(),
    });

    // Call task handler with timeout (handler should call acknowledge() when ready)
    const result = await this.withTimeout(
      this.taskHandler(payload, context),
      this.handlerTimeout,
    );

    // If handler returns a result, send it automatically
    if (result) {
      await this.sendResult(
        message,
        result.output,
        result.status,
        result.error,
      );
      return result;
    }

    return;
  }

  /**
   * Process a query message
   */
  private async processQuery(
    message: A2AMessage,
    context: A2AContext,
  ): Promise<void> {
    if (!this.queryHandler) {
      this.logger.warn('No query handler registered, sending error response');
      await this.sendErrorResponse(message, 'No query handler registered');
      return;
    }

    const payload = message.content;

    // Send acknowledgment
    await this.sendAck(message);

    // Call query handler with timeout
    const response = await this.withTimeout(
      this.queryHandler(payload, context),
      this.handlerTimeout,
    );

    // Send response
    await this.sendResult(
      message,
      response.content,
      response.success ? 'completed' : 'failed',
      response.error,
    );
  }

  /**
   * Process an event message
   */
  private async processEvent(
    message: A2AMessage,
    context: A2AContext,
  ): Promise<void> {
    if (!this.eventHandler) {
      this.logger.debug('No event handler registered, ignoring event');
      return;
    }

    const payload = message.content;

    // Events are fire-and-forget, no acknowledgment needed
    await this.withTimeout(
      this.eventHandler(payload, context),
      this.handlerTimeout,
    );
  }

  /**
   * Process a cancel message
   */
  private async processCancel(
    message: A2AMessage,
    context: A2AContext,
  ): Promise<void> {
    if (!this.cancelHandler) {
      this.logger.debug('No cancel handler registered, ignoring cancel');
      return;
    }

    const payload = message.content;
    const taskId = payload.taskId;

    if (!taskId) {
      this.logger.warn('Cancel message missing taskId');
      return;
    }

    // Send acknowledgment
    await this.sendAck(message);

    // Call cancel handler
    await this.withTimeout(
      this.cancelHandler(taskId, context),
      this.handlerTimeout,
    );
  }

  /**
   * Send acknowledgment for a message
   */
  private async sendAck(message: A2AMessage): Promise<void> {
    try {
      await this.messageBus.sendAck(message.from, message.conversationId, {
        messageId: message.messageId,
        status: 'acknowledged',
      });
      this.logger.debug({ conversationId: message.conversationId }, 'Sent ACK');
    } catch (error) {
      this.logger.error({ error }, 'Failed to send ACK');
    }
  }

  /**
   * Send result response for a message
   */
  private async sendResult(
    message: A2AMessage,
    output: unknown,
    status: A2ATaskStatus,
    error?: string,
  ): Promise<void> {
    try {
      const payload: A2APayload = {
        output,
        status,
        error,
      };

      await this.messageBus.sendResult(
        message.from,
        message.conversationId,
        payload,
      );
      this.logger.debug(
        { conversationId: message.conversationId, status },
        'Sent result',
      );
    } catch (err) {
      this.logger.error({ err }, 'Failed to send result');
    }
  }

  /**
   * Send error response for a message
   */
  private async sendErrorResponse(
    message: A2AMessage,
    errorMessage: string,
  ): Promise<void> {
    try {
      const payload: A2APayload = {
        status: 'failed',
        error: errorMessage,
      };

      await this.messageBus.sendError(
        message.from,
        message.conversationId,
        errorMessage,
      );
      this.logger.debug(
        { conversationId: message.conversationId },
        'Sent error',
      );
    } catch (err) {
      this.logger.error({ err }, 'Failed to send error response');
    }
  }

  /**
   * Check if content is an A2A message
   */
  private isA2AMessage(content: unknown): content is A2AMessage {
    if (!content || typeof content !== 'object') {
      return false;
    }
    const msg = content as Record<string, unknown>;
    return (
      typeof msg['messageId'] === 'string' &&
      typeof msg['conversationId'] === 'string' &&
      typeof msg['messageType'] === 'string'
    );
  }

  /**
   * Execute a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Handler timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }
}

/**
 * Create an A2A Handler instance
 */
export function createA2AHandler(
  messageBus: IMessageBus,
  config: A2AHandlerConfig,
): A2AHandler {
  return new A2AHandler(messageBus, config);
}
