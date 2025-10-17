import * as amqp from 'amqplib';
import {
  BaseRabbitMQMessage,
  PdfConversionMessage,
  PdfConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfPartConversionRequestMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  PdfMergingRequestMessage,
  PdfMergingProgressMessage,
  MarkdownStorageRequestMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  MarkdownPartStorageRequestMessage,
  MarkdownPartStorageProgressMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  ChunkingEmbeddingRequestMessage,
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  RabbitMQMessageOptions,
  RABBITMQ_QUEUES,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_CONSUMER_TAGS,
  PdfProcessingStatus,
} from './message.types';
import {
  getValidatedRabbitMQConfig,
  rabbitMQConnectionOptions,
  rabbitMQHealthCheckConfig,
  getQueueConfig,
  getExchangeConfig,
  getAllQueueConfigs,
  getAllExchangeConfigs,
} from './rabbitmq.config';
import {
  IMessageService,
  MessageProtocol,
  MessageServiceConfig,
} from './message-service.interface';
import { createMessageService } from './message-service-factory';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('RabbitMQService');

/**
 * RabbitMQ service for handling PDF conversion messages
 */
export class RabbitMQService {
  private messageService: IMessageService;
  private isInitialized = false;
  private isConnecting = false;

  constructor(private configPath?: string) {
    // Create the message service instance using the factory
    this.messageService = createMessageService(MessageProtocol.RABBITMQ);
  }

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      logger.info('Initializing RabbitMQ service using message service interface...');
      await this.messageService.initialize();

      this.isInitialized = true;
      this.isConnecting = false;

      logger.info('RabbitMQ service initialized successfully');
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to initialize RabbitMQ service:', error);
      throw error;
    }
  }


  /**
   * Publish a message to RabbitMQ
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options: RabbitMQMessageOptions = {},
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
      // Check queue message count before publishing
      if (routingKey === RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST) {
        const queueInfo = await this.messageService.getQueueInfo(
          RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        );
        logger.info(
          `DEBUG: Queue ${RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST} message count before publishing: ${queueInfo?.messageCount || 0}`,
        );
      }

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

        // Check queue message count after publishing
        if (routingKey === RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST) {
          setTimeout(async () => {
            const queueInfo = await this.messageService.getQueueInfo(
              RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
            );
            logger.info(
              `DEBUG: Queue ${RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST} message count after publishing: ${queueInfo?.messageCount || 0}`,
            );
          }, 100);
        }
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
   * Publish PDF conversion request
   */
  async publishPdfConversionRequest(
    request: PdfConversionRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish PDF conversion progress
   */
  async publishPdfConversionProgress(
    progress: PdfConversionProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_PROGRESS,
      progress,
      {
        persistent: false, // Progress messages are transient
        expiration: '300000', // 5 minutes
      },
    );
  }

  /**
   * Publish PDF conversion completed
   */
  async publishPdfConversionCompleted(
    completed: PdfConversionCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_COMPLETED,
      completed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish PDF conversion failed
   */
  async publishPdfConversionFailed(
    failed: PdfConversionFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_FAILED,
      failed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish PDF analysis request
   */
  async publishPdfAnalysisRequest(
    request: PdfAnalysisRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish PDF analysis completed
   */
  async publishPdfAnalysisCompleted(
    completed: PdfAnalysisCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_COMPLETED,
      completed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish PDF analysis failed
   */
  async publishPdfAnalysisFailed(
    failed: PdfAnalysisFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_FAILED,
      failed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish PDF part conversion request
   */
  async publishPdfPartConversionRequest(
    request: PdfPartConversionRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish PDF part conversion completed
   */
  async publishPdfPartConversionCompleted(
    completed: PdfPartConversionCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_COMPLETED,
      completed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish PDF part conversion failed
   */
  async publishPdfPartConversionFailed(
    failed: PdfPartConversionFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_FAILED,
      failed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish PDF merging request
   */
  async publishPdfMergingRequest(
    request: PdfMergingRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_MERGING_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish PDF merging progress
   */
  async publishPdfMergingProgress(
    progress: PdfMergingProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_MERGING_PROGRESS,
      progress,
      {
        persistent: false, // Progress messages are transient
        expiration: '300000', // 5 minutes
      },
    );
  }

  /**
   * Publish markdown storage request
   */
  async publishMarkdownStorageRequest(
    request: MarkdownStorageRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish markdown storage completed
   */
  async publishMarkdownStorageCompleted(
    completed: MarkdownStorageCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_COMPLETED,
      completed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish markdown storage failed
   */
  async publishMarkdownStorageFailed(
    failed: MarkdownStorageFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_FAILED,
      failed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish markdown part storage request
   */
  async publishMarkdownPartStorageRequest(
    request: MarkdownPartStorageRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_REQUEST,
      request,
      {
        persistent: true,
        priority:
          request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      },
    );
  }

  /**
   * Publish markdown part storage progress
   */
  async publishMarkdownPartStorageProgress(
    progress: MarkdownPartStorageProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_PROGRESS,
      progress,
      {
        persistent: false, // Progress messages are transient
        expiration: '300000', // 5 minutes
      },
    );
  }

  /**
   * Publish markdown part storage completed
   */
  async publishMarkdownPartStorageCompleted(
    completed: MarkdownPartStorageCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_COMPLETED,
      completed,
      {
        persistent: true,
      },
    );
  }

  /**
   * Publish markdown part storage failed
   */
  async publishMarkdownPartStorageFailed(
    failed: MarkdownPartStorageFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_FAILED,
      failed,
      {
        persistent: true,
      },
    );
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
      message: PdfConversionMessage,
      originalMessage: amqp.ConsumeMessage,
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
  async getQueueInfo(
    queueName: string,
  ): Promise<any> {
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
      channelOpen: healthResult.details.channelOpen || healthResult.details.connected,
      reconnectAttempts: healthResult.details.reconnectAttempts || 0,
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
      logger.error('Error closing RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isConnected(): boolean {
    return this.isInitialized && this.messageService.isConnected();
  }
}

/**
 * Singleton instance for the RabbitMQ service
 */
let rabbitMQServiceInstance: RabbitMQService | null = null;

/**
 * Get or create the RabbitMQ service singleton instance
 */
export function getRabbitMQService(configPath?: string): RabbitMQService {
  if (!rabbitMQServiceInstance) {
    logger.info('Creating new RabbitMQ service instance');
    rabbitMQServiceInstance = new RabbitMQService(configPath);
  } else {
    logger.debug('Returning existing RabbitMQ service instance', {
      isConnected: rabbitMQServiceInstance.isConnected(),
    });
  }
  return rabbitMQServiceInstance;
}

/**
 * Initialize the RabbitMQ service
 */
export async function initializeRabbitMQService(
  configPath?: string,
): Promise<RabbitMQService> {
  const service = getRabbitMQService(configPath);
  await service.initialize();
  return service;
}

/**
 * Close and cleanup the RabbitMQ service
 */
export async function closeRabbitMQService(): Promise<void> {
  if (rabbitMQServiceInstance) {
    await rabbitMQServiceInstance.close();
    rabbitMQServiceInstance = null;
  }
}
