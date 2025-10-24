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
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  RabbitMQMessageOptions,
  RABBITMQ_QUEUES,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_CONSUMER_TAGS,
  PdfProcessingStatus,
  ChunkingEmbeddingRequestMessage,
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
import { IRabbitMQService } from './rabbitmq-service.interface';
import { createMessageService } from './message-service-factory';
import { getStompDestination } from './stomp.config';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('RabbitMQService');

/**
 * RabbitMQ service for handling PDF conversion messages
 */
export class RabbitMQService implements IRabbitMQService {
  private messageService: IMessageService;
  private isInitialized = false;
  private isConnecting = false;
  private initializationPromise: Promise<void> | null = null;
  private initializationResolver: (() => void) | null = null;
  public protocol: MessageProtocol;

  constructor(protocol?: MessageProtocol) {
    // Create the message service instance using the factory
    // console.log(process.env.RABBITMQ_PROTOCOL)
    this.protocol =
      protocol ??
      (process.env.RABBITMQ_PROTOCOL as MessageProtocol) ??
      MessageProtocol.AMQP;
    this.messageService = createMessageService(this.protocol);
  }

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  async initialize(): Promise<void> {
    // 如果已经在初始化中，等待现有的初始化完成
    if (this.isConnecting && this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return;
    }

    this.isConnecting = true;

    // 创建初始化Promise
    this.initializationPromise = new Promise((resolve) => {
      this.initializationResolver = resolve;
    });

    try {
      logger.info(
        'Initializing RabbitMQ service using message service interface...',
      );
      await this.messageService.initialize();

      // 确保底层服务真正连接成功
      await this.waitForConnectionReady();

      this.isInitialized = true;
      this.isConnecting = false;

      // 解析等待的Promise
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
   * 等待底层连接真正就绪
   */
  private async waitForConnectionReady(): Promise<void> {
    // 等待底层连接真正就绪，有超时机制
    const maxWaitTime = 10000; // 10秒超时
    const checkInterval = 100; // 100ms检查间隔
    let elapsed = 0;

    logger.info('Waiting for RabbitMQ connection to be ready...');

    while (!this.messageService.isConnected() && elapsed < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;

      // 每秒记录一次进度
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
      // For STOMP protocol, we need to convert routing keys to destinations
      let destination = routingKey;
      if (this.protocol === 'stomp') {
        destination = getStompDestination(routingKey);
      }

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
        destination,
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
      // For STOMP protocol, we need to convert queue names to destinations
      let destination = queueName;
      if (this.protocol === 'stomp') {
        // Map queue names to their corresponding routing keys
        let routingKey = queueName;

        // Map queue names to their corresponding routing keys
        switch (queueName) {
          case 'pdf-conversion-request':
            routingKey = 'pdf.conversion.request';
            break;
          case 'pdf-part-conversion-request':
            routingKey = 'pdf.part.conversion.request';
            break;
          case 'pdf-conversion-progress':
            routingKey = 'pdf.conversion.progress';
            break;
          case 'pdf-conversion-completed':
            routingKey = 'pdf.conversion.completed';
            break;
          case 'pdf-conversion-failed':
            routingKey = 'pdf.conversion.failed';
            break;
          case 'pdf-analysis-request':
            routingKey = 'pdf.analysis.request';
            break;
          case 'pdf-analysis-completed':
            routingKey = 'pdf.analysis.completed';
            break;
          case 'pdf-analysis-failed':
            routingKey = 'pdf.analysis.failed';
            break;
          case 'markdown-storage-request':
            routingKey = 'markdown.storage.request';
            break;
          case 'markdown-storage-completed':
            routingKey = 'markdown.storage.completed';
            break;
          case 'markdown-storage-failed':
            routingKey = 'markdown.storage.failed';
            break;
          case 'markdown-part-storage-request':
            routingKey = 'markdown.part.storage.request';
            break;
          case 'markdown-part-storage-progress':
            routingKey = 'markdown.part.storage.progress';
            break;
          case 'markdown-part-storage-completed':
            routingKey = 'markdown.part.storage.completed';
            break;
          case 'markdown-part-storage-failed':
            routingKey = 'markdown.part.storage.failed';
            break;
          case 'pdf-conversion-dlq':
            routingKey = 'pdf.conversion.dlq';
            break;
          // Add more mappings as needed
        }

        destination = getStompDestination(routingKey);
      }

      const consumerTag = await this.messageService.consumeMessages(
        destination,
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
        healthResult.details.channelOpen || healthResult.details.connected,
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
 * Singleton instances for the RabbitMQ service, keyed by protocol
 */
const rabbitMQServiceInstances: Map<string, RabbitMQService> = new Map();

/**
 * Get or create the RabbitMQ service singleton instance for the specified protocol
 */
export function getRabbitMQService(
  protocol?: MessageProtocol,
): RabbitMQService {
  const resolvedProtocol =
    protocol ?? (process.env.RABBITMQ_PROTOCOL as MessageProtocol) ?? 'amqp';
  const protocolKey = resolvedProtocol.toString();

  if (!rabbitMQServiceInstances.has(protocolKey)) {
    logger.info(
      `Creating new RabbitMQ service instance for protocol: ${resolvedProtocol}`,
    );
    const newInstance = new RabbitMQService(protocol);
    rabbitMQServiceInstances.set(protocolKey, newInstance);
  } else {
    const existingInstance = rabbitMQServiceInstances.get(protocolKey)!;
    logger.debug(
      `Returning existing RabbitMQ service instance for protocol: ${resolvedProtocol}`,
      {
        isConnected: existingInstance.isConnected(),
      },
    );
  }

  const service = rabbitMQServiceInstances.get(protocolKey)!;
  return service;
}

/**
 * Initialize the RabbitMQ service
 */
export async function initializeRabbitMQService(
  protocol?: MessageProtocol,
): Promise<RabbitMQService> {
  const service = getRabbitMQService(protocol);
  await service.initialize();
  return service;
}

/**
 * Close and cleanup a specific RabbitMQ service instance
 */
export async function closeRabbitMQService(
  protocol?: MessageProtocol,
): Promise<void> {
  const resolvedProtocol =
    protocol ?? (process.env.RABBITMQ_PROTOCOL as MessageProtocol) ?? 'amqp';
  const protocolKey = resolvedProtocol.toString();

  if (rabbitMQServiceInstances.has(protocolKey)) {
    const service = rabbitMQServiceInstances.get(protocolKey)!;
    await service.close();
    rabbitMQServiceInstances.delete(protocolKey);
    logger.info(
      `Closed RabbitMQ service instance for protocol: ${resolvedProtocol}`,
    );
  }
}

/**
 * Close and cleanup all RabbitMQ service instances
 */
export async function closeAllRabbitMQServices(): Promise<void> {
  const protocols = Array.from(rabbitMQServiceInstances.keys());
  for (const protocol of protocols) {
    const service = rabbitMQServiceInstances.get(protocol)!;
    await service.close();
    rabbitMQServiceInstances.delete(protocol);
  }
  logger.info('Closed all RabbitMQ service instances');
}
