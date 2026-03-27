/**
 * RedisMessageBus - Redis-based implementation of IMessageBus
 *
 * Enables cross-process/machine A2A communication using Redis pub/sub.
 * Maintains local conversation tracking while using Redis for message transport.
 */

import Redis from 'ioredis';
import type {
  TopologyMessage,
  TopologyConfig,
  Conversation,
  MessageHandler,
  EventHandler,
} from '../types.js';
import { IMessageBus, MessageBus } from './MessageBus.js';
import {
  type RedisMessageBusConfig,
  buildRedisOptions,
  DEFAULT_REDIS_CONFIG,
} from './RedisConfig.js';
import { createMessage, createTopologyEvent } from '../types.js';
import type { IConversationManager } from './Conversation.js';
import { createConversationManager } from './Conversation.js';
import type { IAckTracker } from './AckTracker.js';
import { createAckTracker } from './AckTracker.js';

/**
 * RedisMessageBus - Redis-based message bus for distributed A2A communication
 *
 * Uses Redis pub/sub for message distribution while maintaining local
 * conversation state and ACK tracking.
 */
export class RedisMessageBus implements IMessageBus {
  private publisher: Redis;
  private subscriber: Redis;
  private conversationManager: IConversationManager;
  private ackTracker: IAckTracker;
  private messageHandlers: Set<MessageHandler> = new Set();
  private eventHandlers: Set<EventHandler> = new Set();
  private config: Required<TopologyConfig>;
  private redisConfig: Required<
    Pick<RedisMessageBusConfig, 'keyPrefix' | 'connectionTimeout'>
  >;
  private subscribedAgents: Set<string> = new Set();
  private isConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(
    redisConfig: RedisMessageBusConfig = {},
    topologyConfig: TopologyConfig = {},
  ) {
    this.redisConfig = {
      keyPrefix: redisConfig.keyPrefix ?? DEFAULT_REDIS_CONFIG.keyPrefix,
      connectionTimeout:
        redisConfig.connectionTimeout ?? DEFAULT_REDIS_CONFIG.connectionTimeout,
    };

    this.config = {
      defaultAckTimeout: topologyConfig.defaultAckTimeout ?? 30000,
      maxRetries: topologyConfig.maxRetries ?? 3,
      defaultTtl: topologyConfig.defaultTtl ?? 10,
    };

    this.conversationManager = createConversationManager();
    this.ackTracker = createAckTracker(
      this.config.defaultAckTimeout,
      this.config.maxRetries,
    );

    // Build Redis options
    const redisOptions = buildRedisOptions(redisConfig);

    // Create publisher client
    this.publisher = new Redis({
      host: redisOptions.host,
      port: redisOptions.port,
      password: redisOptions.password,
      db: redisOptions.db,
      keyPrefix: redisOptions.keyPrefix,
      lazyConnect: redisOptions.lazyConnect,
      retryStrategy: redisOptions.retryStrategy,
      connectTimeout: redisOptions.connectTimeout,
      keepAlive: redisOptions.keepAlive,
    });

    // Create subscriber client (separate connection for pub/sub)
    this.subscriber = new Redis({
      host: redisOptions.host,
      port: redisOptions.port,
      password: redisOptions.password,
      db: redisOptions.db,
      keyPrefix: redisOptions.keyPrefix,
      lazyConnect: redisOptions.lazyConnect,
      retryStrategy: redisOptions.retryStrategy,
      connectTimeout: redisOptions.connectTimeout,
      keepAlive: redisOptions.keepAlive,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.publisher.on('connect', () => {
      console.log('[RedisMessageBus] Publisher connected');
      this.isConnected = true;
    });

    this.publisher.on('error', (err) => {
      console.error('[RedisMessageBus] Publisher error:', err.message);
    });

    this.subscriber.on('connect', () => {
      console.log('[RedisMessageBus] Subscriber connected');
    });

    this.subscriber.on('error', (err) => {
      console.error('[RedisMessageBus] Subscriber error:', err.message);
    });

    // Handle incoming messages
    this.subscriber.on('message', (channel: string, message: string) => {
      this.handleRedisMessage(channel, message);
    });
  }

  /**
   * Build channel name for an agent
   */
  private getAgentChannel(instanceId: string): string {
    // Redis adds keyPrefix automatically, so we just need the relative path
    return `agent:${instanceId}`;
  }

  /**
   * Parse channel name to extract agent instanceId
   */
  private parseAgentChannel(channel: string): string | null {
    const match = channel.match(/agent:(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Handle incoming Redis message
   */
  private handleRedisMessage(channel: string, messageStr: string): void {
    try {
      const message = JSON.parse(messageStr) as TopologyMessage;
      console.log(
        `[RedisMessageBus] Received message on channel ${channel}:`,
        message.messageId,
      );

      // Emit message:received event
      this.emitEvent('message:received', message);

      // If this is an ACK message, also emit conversation:ack and call ackTracker
      // This is needed because when ACKs come via Redis (cross-process), the sender's
      // waitForAck is waiting for conversation:ack event
      if (message.messageType === 'ack') {
        const content = message.content as
          | { conversationId?: string }
          | undefined;
        const conversationId =
          content?.conversationId || message.conversationId;
        if (conversationId) {
          this.emitEvent('conversation:ack', { conversationId, ack: message });
          this.ackTracker.acknowledge(conversationId, message);
        }
      }

      // Dispatch to local handlers
      this.dispatchMessage(message);
    } catch (error) {
      console.error(
        '[RedisMessageBus] Failed to parse message:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Dispatch message to local handlers
   */
  private async dispatchMessage(message: TopologyMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error(
          '[RedisMessageBus] Handler error:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Emit event to local event handlers
   */
  private emitEvent(type: string, payload: unknown): void {
    const event = createTopologyEvent(type as any, payload);
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(
          '[RedisMessageBus] Event handler error:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Connect to Redis (if not already connected)
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        await Promise.all([this.publisher.ping(), this.subscriber.ping()]);
        this.isConnected = true;
        console.log('[RedisMessageBus] Connected to Redis');
      } catch (error) {
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
      this.isConnected = false;
      console.log('[RedisMessageBus] Disconnected from Redis');
    } catch (error) {
      console.error(
        '[RedisMessageBus] Disconnect error:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Subscribe to receive messages for an agent
   */
  subscribeAgent(instanceId: string): void {
    if (this.subscribedAgents.has(instanceId)) {
      return;
    }

    const channel = this.getAgentChannel(instanceId);
    this.subscriber.subscribe(channel, (err) => {
      if (err) {
        console.error(
          `[RedisMessageBus] Failed to subscribe to ${channel}:`,
          err.message,
        );
        return;
      }
      console.log(`[RedisMessageBus] Subscribed to agent channel: ${channel}`);
    });

    this.subscribedAgents.add(instanceId);
  }

  /**
   * Unsubscribe from an agent's channel
   */
  unsubscribeAgent(instanceId: string): void {
    if (!this.subscribedAgents.has(instanceId)) {
      return;
    }

    const channel = this.getAgentChannel(instanceId);
    this.subscriber.unsubscribe(channel, (err) => {
      if (err) {
        console.error(
          `[RedisMessageBus] Failed to unsubscribe from ${channel}:`,
          err.message,
        );
        return;
      }
      console.log(
        `[RedisMessageBus] Unsubscribed from agent channel: ${channel}`,
      );
    });

    this.subscribedAgents.delete(instanceId);
  }

  // ============================================
  // IMessageBus Implementation
  // ============================================

  /**
   * Send a message and wait for ACK
   */
  async send(message: TopologyMessage): Promise<TopologyMessage> {
    console.log(
      `[RedisMessageBus.send] Creating conversation: from=${message.from}, to=${message.to}, conversationId=${message.conversationId}`,
    );

    // Create conversation
    const conversation = this.conversationManager.create(message, {
      ackTimeout: this.config.defaultAckTimeout,
      maxRetries: this.config.maxRetries,
    });

    this.emitEvent('conversation:started', conversation);

    // Setup ACK tracking
    const ackPromise = this.waitForAck(
      conversation.conversationId,
      message.from,
    );

    // Publish message to Redis
    await this.publishToRedis(message);

    this.emitEvent('message:sent', message);

    return ackPromise;
  }

  /**
   * Publish a message (fire-and-forget)
   */
  publish(message: TopologyMessage): void {
    this.publishToRedis(message);
    this.emitEvent('message:sent', message);
  }

  /**
   * Publish message to Redis channel
   */
  private async publishToRedis(message: TopologyMessage): Promise<void> {
    const channel = this.getAgentChannel(message.to);
    const messageStr = JSON.stringify(message);

    try {
      await this.publisher.publish(channel, messageStr);
      console.log(
        `[RedisMessageBus] Published message to ${channel}:`,
        message.messageId,
      );
    } catch (error) {
      console.error(
        `[RedisMessageBus] Failed to publish to ${channel}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Send ACK message
   */
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
    await this.publishToRedis(ack);

    return ack;
  }

  /**
   * Send result message
   */
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
    await this.publishToRedis(result);

    return result;
  }

  /**
   * Send error message
   */
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
    await this.publishToRedis(errorMsg);

    return errorMsg;
  }

  /**
   * Broadcast to multiple agents
   */
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
      await this.publishToRedis(message);
      results.push(message);
    }

    return results;
  }

  /**
   * Subscribe to all messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to events
   */
  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Get conversation by ID
   */
  getConversation(conversationId: string): Conversation | undefined {
    return this.conversationManager.get(conversationId);
  }

  /**
   * Get conversation by task ID
   */
  getConversationByTaskId(taskId: string): Conversation | undefined {
    return this.conversationManager.getByTaskId(taskId);
  }

  /**
   * Get pending conversations
   */
  getPendingConversations(): Conversation[] {
    return this.conversationManager.getPending();
  }

  /**
   * Get active conversations
   */
  getActiveConversations(): Conversation[] {
    return this.conversationManager.getActive();
  }

  /**
   * Set configuration
   */
  setConfig(config: TopologyConfig): void {
    this.config = {
      defaultAckTimeout:
        config.defaultAckTimeout ?? this.config.defaultAckTimeout,
      defaultResultTimeout:
        config.defaultResultTimeout ?? this.config.defaultResultTimeout,
      maxRetries: config.maxRetries ?? this.config.maxRetries,
      defaultTtl: config.defaultTtl ?? this.config.defaultTtl,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): Required<TopologyConfig> {
    return { ...this.config };
  }

  /**
   * Wait for ACK on a conversation
   */
  private waitForAck(
    conversationId: string,
    _from: string,
  ): Promise<TopologyMessage> {
    return new Promise((resolve, reject) => {
      const timeout = this.config.defaultAckTimeout;
      let settled = false;

      const cleanup = this.ackTracker.track(
        conversationId,
        {
          onTimeout: () => {
            if (settled) return;
            settled = true;
            this.conversationManager.updateStatus(conversationId, 'timeout');
            reject(new Error(`ACK timeout for conversation ${conversationId}`));
          },
          onAck: (ack: TopologyMessage) => {
            if (settled) return;
            settled = true;
            resolve(ack);
          },
        },
        timeout,
      );

      // Set overall timeout
      setTimeout(() => {
        if (!settled) {
          settled = true;
          this.ackTracker.untrack(conversationId);
          this.conversationManager.updateStatus(conversationId, 'timeout');
          reject(new Error(`ACK timeout for conversation ${conversationId}`));
        }
      }, timeout);
    });
  }

  /**
   * Check if connected to Redis
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get subscribed agents
   */
  getSubscribedAgents(): string[] {
    return Array.from(this.subscribedAgents);
  }
}

/**
 * Create a Redis MessageBus instance
 */
export function createRedisMessageBus(
  redisConfig?: RedisMessageBusConfig,
  topologyConfig?: TopologyConfig,
): RedisMessageBus {
  return new RedisMessageBus(redisConfig, topologyConfig);
}
