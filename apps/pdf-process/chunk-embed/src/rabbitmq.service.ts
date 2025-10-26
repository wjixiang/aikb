import {
  BaseRabbitMQMessage,
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  ChunkingEmbeddingRequestMessage,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
} from './message.types';
import {
  IMessageService,
  MessageProtocol,
} from './message-service.interface';
import { IRabbitMQService } from './rabbitmq-service.interface';
import { createMessageService } from './message-service-factory';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('RabbitMQService');

/**
 * RabbitMQ service for handling chunking and embedding messages
 */
export class RabbitMQService implements IRabbitMQService {
  private messageService: IMessageService;
  private isInitialized = false;
  private isConnecting = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationResolver: (() => void) | null = null;
  public protocol: MessageProtocol;

  constructor(protocol?: MessageProtocol) {
    this.protocol =
      protocol ??
      (process.env['RABBITMQ_PROTOCOL'] as MessageProtocol) ??
      MessageProtocol.AMQP;
    this.messageService = createMessageService(this.protocol);
  }

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  async initialize(): Promise<void> {
    // If already initializing, wait for existing initialization to complete
    if (this.isConnecting && this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return;
    }

    this.isConnecting = true;

    // Create initialization Promise
    this.initializationPromise = new Promise((resolve) => {
      this.initializationResolver = resolve;
    });

    try {
      logger.info(
        'Initializing RabbitMQ service using message service interface...',
      );
      await this.messageService.initialize();

      // Ensure underlying service is truly connected
      await this.waitForConnectionReady();

      this.isInitialized = true;
      this.isConnecting = false;

      // Resolve waiting Promise
      if (this.initializationResolver) {
        this.initializationResolver();
        this.initializationResolver = null;
      }

      logger.info(
        `RabbitMQ service initialized successfully, protocol: ${this.protocol}`,
      );
    } catch (error) {
      this.isConnecting = false;
      this.initializationPromise = null;
      this.initializationResolver = null;
      logger.error('Failed to initialize RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Wait for underlying connection to be truly ready
   */
  private async waitForConnectionReady(): Promise<void> {
    // Wait for underlying connection to be truly ready, with timeout mechanism
    const maxWaitTime = 10000; // 10 second timeout
    const checkInterval = 100; // 100ms check interval
    let elapsed = 0;

    logger.info('Waiting for RabbitMQ connection to be ready...');

    while (!this.messageService.isConnected() && elapsed < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      // Log progress every second
      if (elapsed % 1000 === 0 && elapsed > 0) {
        logger.debug(`Still waiting for connection... (${elapsed}ms elapsed)`);
      }
    }

    if (!this.messageService.isConnected()) {
      throw new Error(
        `RabbitMQ service initialization timeout - connection not ready after ${maxWaitTime}ms`,
      );
    }

    logger.info(`RabbitMQ connection is ready (took ${elapsed}ms)`);
  }

  /**
   * Publish a message to RabbitMQ
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options: any = {},
  ): Promise<boolean> {
    logger.debug('publishMessage called', {
      routingKey,
      isInitialized: this.isInitialized,
      isConnected: this.messageService.isConnected(),
    });

    if (!this.isInitialized) {
      logger.error(
        'RabbitMQ service not initialized when attempting to publish',
        {
          isInitialized: this.isInitialized,
          routingKey,
        },
      );
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      const published = await this.messageService.publishMessage(
        routingKey,
        message,
        options,
      );

      if (published) {
        logger.debug(`Message published to routing key: ${routingKey}`, {
          messageId: message.messageId,
          eventType: message.eventType,
        });
      } else {
        logger.warn(`Failed to publish message to routing key: ${routingKey}`, {
          messageId: message.messageId,
          eventType: message.eventType,
        });
      }

      return published;
    } catch (error) {
      logger.error('Failed to publish message:', error);
      throw error;
    }
  }

  /**
   * Publish chunking and embedding request
   */
  async publishChunkingEmbeddingRequest(
    request: ChunkingEmbeddingRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish chunking and embedding progress
   */
  async publishChunkingEmbeddingProgress(
    progress: ChunkingEmbeddingProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_PROGRESS,
      progress,
      {
        persistent: false, // Progress messages are transient
        expiration: '300000', // 5 minutes
      },
    );
  }

  /**
   * Publish chunking and embedding completed
   */
  async publishChunkingEmbeddingCompleted(
    completed: ChunkingEmbeddingCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_COMPLETED,
      completed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish chunking and embedding failed
   */
  async publishChunkingEmbeddingFailed(
    failed: ChunkingEmbeddingFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_FAILED,
      failed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Consume messages from a queue
   */
  async consumeMessages(
    queueName: string,
    onMessage: (
      message: any,
      originalMessage: any,
    ) => void,
    options: {
      consumerTag?: string;
      noAck?: boolean;
      exclusive?: boolean;
      priority?: number;
    } = {},
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      const consumerTag = await this.messageService.consumeMessages(
        queueName,
        async (message, originalMessage) => {
          logger.info(
            `DEBUG: Consumer callback triggered for queue: ${queueName}`,
          );

          logger.info(`DEBUG: Received message from queue ${queueName}:`, {
            eventType: message.eventType,
            itemId: message.itemId,
            retryCount: (message as any).retryCount,
            maxRetries: (message as any).maxRetries,
          });
          await onMessage(message, originalMessage);
        },
        options,
      );

      logger.info(`Started consuming messages from queue: ${queueName}`, {
        consumerTag,
      });

      return consumerTag;
    } catch (error) {
      logger.error(`Failed to start consuming from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.messageService.stopConsuming(consumerTag);
      logger.info(
        `Stopped consuming messages for consumer tag: ${consumerTag}`,
      );
    } catch (error) {
      logger.error(
        `Failed to stop consuming for consumer tag ${consumerTag}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get queue information
   */
  async getQueueInfo(queueName: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      return await this.messageService.getQueueInfo(queueName);
    } catch (error) {
      logger.error(`Failed to get queue info for ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Purge a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      await this.messageService.purgeQueue(queueName);
      logger.info(`Purged queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to purge queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      channelOpen: boolean;
      reconnectAttempts: number;
    };
  }> {
    const healthResult = await this.messageService.healthCheck();

    const details = {
      connected: healthResult.details.connected,
      channelOpen:
        healthResult.details['channelOpen'] || healthResult.details.connected,
      reconnectAttempts: healthResult.details['reconnectAttempts'] || 0,
    };

    return {
      status: healthResult.status,
      details,
    };
  }

  /**
   * Close connection and cleanup
   */
  async close(): Promise<void> {
    try {
      await this.messageService.close();
      this.isInitialized = false;
      logger.info('RabbitMQ service closed successfully');
    } catch (error) {
      logger.error('Failed to close RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.messageService.isConnected();
  }
}

/**
 * Global service instances cache
 */
const serviceInstances = new Map<MessageProtocol, RabbitMQService>();

/**
 * Get RabbitMQ service instance (singleton pattern)
 */
export function getRabbitMQService(
  protocol?: MessageProtocol,
): RabbitMQService {
  const serviceProtocol =
    protocol ??
    (process.env['RABBITMQ_PROTOCOL'] as MessageProtocol) ??
    MessageProtocol.AMQP;

  if (!serviceInstances.has(serviceProtocol)) {
    serviceInstances.set(serviceProtocol, new RabbitMQService(serviceProtocol));
  }

  return serviceInstances.get(serviceProtocol)!;
}

/**
 * Initialize RabbitMQ service
 */
export async function initializeRabbitMQService(
  protocol?: MessageProtocol,
): Promise<RabbitMQService> {
  const service = getRabbitMQService(protocol);
  await service.initialize();
  return service;
}

/**
 * Close RabbitMQ service
 */
export async function closeRabbitMQService(
  protocol?: MessageProtocol,
): Promise<void> {
  const service = getRabbitMQService(protocol);
  await service.close();
  serviceInstances.delete(service.protocol);
}

/**
 * Close all RabbitMQ services
 */
export async function closeAllRabbitMQServices(): Promise<void> {
  const closePromises = Array.from(serviceInstances.values()).map((service) =>
    service.close(),
  );
  await Promise.all(closePromises);
  serviceInstances.clear();
}