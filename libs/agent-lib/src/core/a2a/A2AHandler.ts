/**
 * A2A Handler - Handler for processing incoming A2A messages
 *
 * Processes incoming A2A messages and routes them to appropriate handlers.
 */

import { getLogger } from '@shared/logger';
import type { IMessageBus } from '../runtime/topology/messaging/MessageBus.js';
import { createMessage } from '../runtime/topology/types.js';
import type {
  A2AMessage,
  A2AMessageType,
  A2APayload,
  A2AContext,
  A2AQueryHandler,
  A2AEventHandler,
  A2ACancelHandler,
  A2AHandlerConfig,
  A2ATaskStatus,
} from './types.js';

export interface IA2AHandler {
  /** Handle an incoming A2A message */
  handleMessage(message: A2AMessage): Promise<void>;

  /** Register a query handler (unified handler for all request messages) */
  onQuery(handler: A2AQueryHandler): void;

  /** Register an event handler */
  onEvent(handler: A2AEventHandler): void;

  /** Register a cancel handler */
  onCancel(handler: A2ACancelHandler): void;

  /** Start listening for messages */
  startListening(): void;

  /** Stop listening for messages */
  stopListening(): void;

  /** Set callback for when a query is completed via completeTask tool */
  setQueryCompletionCallback(
    callback: (conversationId: string, output: unknown, status: string) => void,
  ): void;

  /** Signal that an A2A query has been completed (calls the registered callback) */
  completeQuery(conversationId: string, output: unknown, status: string): void;

  /** Set callback for any message received (called before type-specific handlers) */
  setOnMessageReceivedCallback(
    callback: (conversationId: string, message: A2AMessage) => void,
  ): void;
}

/**
 * A2A Handler implementation
 *
 * Processes incoming A2A messages and routes them to registered handlers.
 * Sends responses back via the MessageBus.
 */
export class A2AHandler implements IA2AHandler {
  private readonly logger = getLogger('A2AHandler');
  private readonly instanceId: string;
  private readonly supportedTypes: A2AMessageType[];
  private readonly messageBus: IMessageBus;
  private readonly handlerTimeout: number;

  private queryHandler?: A2AQueryHandler;
  private eventHandler?: A2AEventHandler;
  private cancelHandler?: A2ACancelHandler;

  private unsubscribeMessage?: () => void;
  private isListening = false;

  /**
   * Callback for when query is completed via completeTask tool
   */
  private queryCompletionCallback?: (
    conversationId: string,
    output: unknown,
    status: string,
  ) => void;

  /**
   * Callback for any message received (before type-specific handlers)
   */
  private onMessageReceivedCallback?: (
    conversationId: string,
    message: A2AMessage,
  ) => void;

  constructor(messageBus: IMessageBus, config: A2AHandlerConfig) {
    this.instanceId = config.instanceId;
    this.supportedTypes = config.supportedTypes;
    this.messageBus = messageBus;
    this.handlerTimeout = config.handlerTimeout ?? 60000;
  }

  /**
   * Handle an incoming A2A message
   */
  async handleMessage(message: A2AMessage): Promise<void> {
    if (message.to !== this.instanceId) {
      this.logger.warn(
        { messageTo: message.to, myId: this.instanceId },
        'Message not addressed to this agent, ignoring',
      );
      return;
    }

    this.onMessageReceivedCallback?.(message.conversationId, message);

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
      acknowledge: async () => {
        await this.sendAck(message);
      },
    };

    try {
      switch (message.messageType) {
        case 'query':
          await this.processQuery(message, context);
          return;
        case 'event':
          await this.processEvent(message, context);
          return;
        case 'cancel':
          await this.processCancel(message, context);
          return;
        case 'response':
          this.logger.debug('Response message received, handled by MessageBus');
          return;
        case 'stream':
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

    console.log(
      `[A2AHandler.startListening] Agent ${this.instanceId} registering handler on MessageBus`,
    );

    this.unsubscribeMessage = this.messageBus.onMessage((topologyMessage) => {
      console.log(
        `[A2AHandler.onMessage] Agent ${this.instanceId} received: to=${topologyMessage.to}, myId=${this.instanceId}`,
        `from=${topologyMessage.from}, conversationId=${topologyMessage.conversationId}`,
      );

      if (topologyMessage.to !== this.instanceId) {
        this.logger.trace(
          { msgTo: topologyMessage.to, myId: this.instanceId },
          '[A2AHandler] Message not for me, skipping',
        );
        return;
      }

      const content = topologyMessage.content;

      // Trigger callback for any message that could wake up a sleeping agent
      // This includes 'result' messages from completeTask
      if (
        topologyMessage.messageType === 'result' ||
        this.isA2AMessage(content)
      ) {
        // Construct a minimal A2AMessage-like object for the callback
        const callbackMessage = this.isA2AMessage(content)
          ? content
          : {
              messageId: topologyMessage.messageId,
              conversationId: topologyMessage.conversationId,
              messageType: 'response' as const,
              from: topologyMessage.from,
              to: topologyMessage.to,
              content: content,
              timestamp: topologyMessage.timestamp,
            };
        this.onMessageReceivedCallback?.(
          topologyMessage.conversationId,
          callbackMessage as any,
        );
      }

      if (this.isA2AMessage(content)) {
        this.handleMessage(content).catch((error) => {
          this.logger.error({ error }, '[A2AHandler] Error handling message');
        });
      }
    });

    this.isListening = true;
    this.logger.info(
      { instanceId: this.instanceId },
      'Started listening for A2A messages',
    );
    console.log(
      `[A2AHandler.startListening] Agent ${this.instanceId} now listening for A2A messages`,
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
   * Set callback for when query is completed via completeTask tool
   */
  setQueryCompletionCallback(
    callback: (conversationId: string, output: unknown, status: string) => void,
  ): void {
    this.queryCompletionCallback = callback;
  }

  /**
   * Signal that an A2A query has been completed
   */
  completeQuery(conversationId: string, output: unknown, status: string): void {
    if (this.queryCompletionCallback) {
      this.queryCompletionCallback(conversationId, output, status);
      this.logger.debug(
        { conversationId, status },
        'Query completion callback invoked',
      );
    } else {
      this.logger.warn(
        { conversationId },
        'No query completion callback registered',
      );
    }
  }

  /**
   * Set callback for any message received
   */
  setOnMessageReceivedCallback(
    callback: (conversationId: string, message: A2AMessage) => void,
  ): void {
    this.onMessageReceivedCallback = callback;
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
    const response = await this.queryHandler(payload, context);

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
    await this.eventHandler(payload, context);
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

    // Send acknowledgment
    await this.sendAck(message);

    // Call cancel handler
    await this.cancelHandler(message.conversationId, context);
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
