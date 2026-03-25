/**
 * MessageBus - Message bus for agent communication
 *
 * Handles message routing, delivery, and the two-phase response protocol
 * (ACK immediately, result asynchronously).
 */

import type {
  TopologyMessage,
  MessageHandler,
  EventHandler,
  TopologyEvent,
  Conversation,
  TopologyConfig,
} from '../types.js';
import {
  createMessage,
  createTopologyEvent,
  DEFAULT_TOPOLOGY_CONFIG,
} from '../types.js';
import type { IConversationManager } from './Conversation.js';
import { createConversationManager } from './Conversation.js';
import type { IAckTracker } from './AckTracker.js';
import { createAckTracker } from './AckTracker.js';

/**
 * NullMessageBus - A no-op message bus for testing without a real message bus
 */
export class NullMessageBus implements IMessageBus {
  send(): Promise<TopologyMessage> {
    throw new Error('NullMessageBus: send() called without messageBus');
  }
  publish(): void {
    // no-op
  }
  sendAck(): Promise<TopologyMessage> {
    throw new Error('NullMessageBus: sendAck() called without messageBus');
  }
  sendResult(): Promise<TopologyMessage> {
    throw new Error('NullMessageBus: sendResult() called without messageBus');
  }
  sendError(): Promise<TopologyMessage> {
    throw new Error('NullMessageBus: sendError() called without messageBus');
  }
  broadcast(): Promise<TopologyMessage[]> {
    throw new Error('NullMessageBus: broadcast() called without messageBus');
  }
  onMessage(): () => void {
    return () => {};
  }
  onEvent(): () => void {
    return () => {};
  }
  getConversation(): Conversation | undefined {
    return undefined;
  }
  getPendingConversations(): Conversation[] {
    return [];
  }
  getActiveConversations(): Conversation[] {
    return [];
  }
  setConfig(): void {
    // no-op
  }
  getConfig(): Required<TopologyConfig> {
    return DEFAULT_TOPOLOGY_CONFIG;
  }
}

export interface IMessageBus {
  send(message: TopologyMessage): Promise<TopologyMessage>;
  publish(message: TopologyMessage): void;
  sendAck(
    to: string,
    conversationId: string,
    content?: unknown,
  ): Promise<TopologyMessage>;
  sendResult(
    to: string,
    conversationId: string,
    content: unknown,
  ): Promise<TopologyMessage>;
  sendError(
    to: string,
    conversationId: string,
    error: string,
  ): Promise<TopologyMessage>;

  broadcast(
    from: string,
    toInstances: string[],
    content: unknown,
    conversationId?: string,
  ): Promise<TopologyMessage[]>;

  onMessage(handler: MessageHandler): () => void;
  onEvent(handler: EventHandler): () => void;

  getConversation(conversationId: string): Conversation | undefined;
  getPendingConversations(): Conversation[];
  getActiveConversations(): Conversation[];

  setConfig(config: TopologyConfig): void;
  getConfig(): Required<TopologyConfig>;
}

export class MessageBus implements IMessageBus {
  private conversationManager: IConversationManager;
  private ackTracker: IAckTracker;
  private messageHandlers: Set<MessageHandler> = new Set();
  private eventHandlers: Set<EventHandler> = new Set();
  private config: Required<TopologyConfig>;
  private messageQueue: TopologyMessage[] = [];
  private isProcessing = false;

  constructor(config?: TopologyConfig) {
    this.conversationManager = createConversationManager();
    this.ackTracker = createAckTracker();
    this.config = {
      defaultAckTimeout: config?.defaultAckTimeout ?? 30000,
      defaultResultTimeout: config?.defaultResultTimeout ?? 60000,
      maxRetries: config?.maxRetries ?? 3,
      defaultTtl: config?.defaultTtl ?? 10,
    };
  }

  async send(message: TopologyMessage): Promise<TopologyMessage> {
    console.log(
      `[MessageBus.send] Creating conversation: from=${message.from}, to=${message.to}, conversationId=${message.conversationId}`,
    );

    const conversation = this.conversationManager.create(message, {
      ackTimeout: this.config.defaultAckTimeout,
      resultTimeout: this.config.defaultResultTimeout,
      maxRetries: this.config.maxRetries,
    });

    this.emitEvent('conversation:started', conversation);

    console.log(
      `[MessageBus.send] Delivering message: conversationId=${message.conversationId}, handlers=${this.messageHandlers.size}`,
    );

    const ackPromise = this.waitForAck(
      conversation.conversationId,
      message.from,
    );

    this.deliverMessage(message);
    this.emitEvent('message:sent', message);

    return ackPromise;
  }

  publish(message: TopologyMessage): void {
    this.deliverMessage(message);
    this.emitEvent('message:sent', message);
  }

  async sendAck(
    to: string,
    conversationId: string,
    content?: unknown,
  ): Promise<TopologyMessage> {
    const conversation = this.conversationManager.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const ack = createMessage(
      'system',
      to,
      content ?? { status: 'acknowledged', conversationId },
      'ack',
      { conversationId, ttl: 5 },
    );

    this.conversationManager.setAck(conversationId, ack);
    this.ackTracker.acknowledge(conversationId, ack);
    this.emitEvent('conversation:ack', { conversationId, ack });
    this.deliverMessage(ack);

    return ack;
  }

  async sendResult(
    to: string,
    conversationId: string,
    content: unknown,
  ): Promise<TopologyMessage> {
    const conversation = this.conversationManager.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const result = createMessage('system', to, content, 'result', {
      conversationId,
      ttl: 5,
    });

    this.conversationManager.setResult(conversationId, result);
    this.emitEvent('conversation:completed', { conversationId, result });
    this.deliverMessage(result);

    return result;
  }

  async sendError(
    to: string,
    conversationId: string,
    error: string,
  ): Promise<TopologyMessage> {
    const conversation = this.conversationManager.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const errorMsg = createMessage('system', to, { error }, 'error', {
      conversationId,
      ttl: 5,
    });

    this.conversationManager.updateStatus(conversationId, 'failed');
    this.emitEvent('conversation:failed', { conversationId, error });
    this.deliverMessage(errorMsg);

    return errorMsg;
  }

  async broadcast(
    from: string,
    toInstances: string[],
    content: unknown,
    conversationId?: string,
  ): Promise<TopologyMessage[]> {
    const results: TopologyMessage[] = [];

    for (const to of toInstances) {
      const message = createMessage(from, to, content, 'event', {
        conversationId: conversationId ?? `broadcast_${Date.now()}`,
      });
      this.deliverMessage(message);
      results.push(message);
    }

    return results;
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.conversationManager.get(conversationId);
  }

  getPendingConversations(): Conversation[] {
    return this.conversationManager.getPending();
  }

  getActiveConversations(): Conversation[] {
    return this.conversationManager.getActive();
  }

  setConfig(config: TopologyConfig): void {
    this.config = {
      defaultAckTimeout:
        config?.defaultAckTimeout ?? this.config.defaultAckTimeout,
      defaultResultTimeout:
        config?.defaultResultTimeout ?? this.config.defaultResultTimeout,
      maxRetries: config?.maxRetries ?? this.config.maxRetries,
      defaultTtl: config?.defaultTtl ?? this.config.defaultTtl,
    };
  }

  getConfig(): Required<TopologyConfig> {
    return { ...this.config };
  }

  private async waitForAck(
    conversationId: string,
    senderId: string,
  ): Promise<TopologyMessage> {
    return new Promise((resolve, reject) => {
      const conversation = this.conversationManager.get(conversationId);
      if (!conversation) {
        reject(new Error(`Conversation ${conversationId} not found`));
        return;
      }

      const handleTimeout = () => {
        this.conversationManager.incrementRetry(conversationId);
        const updated = this.conversationManager.get(conversationId);

        if (updated && updated.retryCount < updated.maxRetries) {
          this.emitEvent('conversation:timeout', {
            conversationId,
            retryCount: updated.retryCount,
            maxRetries: updated.maxRetries,
          });

          const retryMessage = createMessage(
            senderId,
            updated.request.to,
            updated.request.content,
            'request',
            { conversationId, ttl: updated.request.ttl },
          );
          this.deliverMessage(retryMessage);

          this.ackTracker.track(
            conversationId,
            {
              onTimeout: handleTimeout,
              onAck: handleAck,
            },
            this.config.defaultAckTimeout,
          );
        } else {
          this.conversationManager.updateStatus(conversationId, 'timeout');
          this.emitEvent('conversation:timeout', {
            conversationId,
            reason: 'max retries exceeded',
          });
          reject(new Error(`ACK timeout for conversation ${conversationId}`));
        }
      };

      const handleAck = (ack: TopologyMessage) => {
        resolve(ack);
      };

      this.ackTracker.track(
        conversationId,
        {
          onTimeout: handleTimeout,
          onAck: handleAck,
        },
        this.config.defaultAckTimeout,
      );
    });
  }

  private deliverMessage(message: TopologyMessage): void {
    this.messageQueue.push(message);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      await this.dispatchMessage(message);
    }

    this.isProcessing = false;
  }

  private async dispatchMessage(message: TopologyMessage): Promise<void> {
    this.emitEvent('message:received', message);

    const a2aType = (message.content as { messageType?: string })?.messageType;
    console.log(
      `[MessageBus] Dispatching message: from=${message.from}, to=${message.to}, msgType=${message.messageType}, a2aType=${a2aType ?? 'N/A'}, handlers=${this.messageHandlers.size}`,
    );

    let handlerIndex = 0;
    for (const handler of this.messageHandlers) {
      handlerIndex++;
      console.log(
        `[MessageBus] Invoking handler ${handlerIndex}/${this.messageHandlers.size}`,
      );

      try {
        const result = handler(message);
        if (result && typeof result.then === 'function') {
          await result;
        }
        console.log(`[MessageBus] Handler ${handlerIndex} completed`);
      } catch (error) {
        console.error(`[MessageBus] Handler ${handlerIndex} error:`, error);
      }
    }
    console.log(`[MessageBus] All ${handlerIndex} handlers processed`);
  }

  private emitEvent(type: TopologyEvent['type'], payload: unknown): void {
    const event = createTopologyEvent(type, payload);

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('[MessageBus] Event handler error:', error);
      }
    }
  }
}

export function createMessageBus(config?: TopologyConfig): IMessageBus {
  return new MessageBus(config);
}
