import { v4 as uuidv4 } from 'uuid';
import {
  IRabbitMQService,
} from './rabbitmq-service.interface';
import { MessageProtocol } from './message-service.interface';
import {
  IMessageService,
  MessageServiceConfig,
} from './message-service.interface';
import { MessageServiceFactory } from './message-service-factory.js';
import {
  BaseRabbitMQMessage,
  RabbitMQMessageOptions,
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
  ChunkingEmbeddingRequestMessage,
  PdfConversionMessage,
} from './message.types';
import { getRabbitMQConfig } from './rabbitmq.config';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('RabbitMQService');

/**
 * RabbitMQ Service Implementation
 * Provides a high-level interface for RabbitMQ operations
 */
export class RabbitMQService implements IRabbitMQService {
  private messageService: IMessageService;
  private messageProtocol: MessageProtocol;
  private isInitialized = false;

  constructor(protocol: MessageProtocol = MessageProtocol.AMQP) {
    this.messageProtocol = protocol;
    
    const config: MessageServiceConfig = {
      protocol,
      connectionOptions: getRabbitMQConfig(),
      topology: {
        queues: [], // Will be set up during initialization
        exchanges: [],
        bindings: [],
      },
      reconnect: {
        maxAttempts: 5,
        delay: 1000,
      },
      healthCheck: {
        interval: 30000,
        timeout: 5000,
      },
    };

    this.messageService = MessageServiceFactory.create(config);
  }

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('RabbitMQ service is already initialized');
      return;
    }

    try {
      logger.info('Initializing RabbitMQ service...');
      await this.messageService.initialize();
      await this.messageService.setupTopology?.();
      this.isInitialized = true;
      logger.info('RabbitMQ service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Get the message protocol being used
   */
  get protocol(): MessageProtocol {
    return this.messageProtocol;
  }

  /**
   * Publish a message to RabbitMQ
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options?: RabbitMQMessageOptions,
  ): Promise<boolean> {
    try {
      // Ensure message has required fields
      if (!message.messageId) {
        message.messageId = uuidv4();
      }
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }

      return await this.messageService.publishMessage(routingKey, message, options);
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
    return this.publishMessage('pdf.conversion.request', request);
  }

  /**
   * Publish PDF conversion progress
   */
  async publishPdfConversionProgress(
    progress: PdfConversionProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.conversion.progress', progress);
  }

  /**
   * Publish PDF conversion completed
   */
  async publishPdfConversionCompleted(
    completed: PdfConversionCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.conversion.completed', completed);
  }

  /**
   * Publish PDF conversion failed
   */
  async publishPdfConversionFailed(
    failed: PdfConversionFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.conversion.failed', failed);
  }

  /**
   * Publish PDF analysis request
   */
  async publishPdfAnalysisRequest(
    request: PdfAnalysisRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.analysis.request', request);
  }

  /**
   * Publish PDF analysis completed
   */
  async publishPdfAnalysisCompleted(
    completed: PdfAnalysisCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.analysis.completed', completed);
  }

  /**
   * Publish PDF analysis failed
   */
  async publishPdfAnalysisFailed(failed: PdfAnalysisFailedMessage): Promise<boolean> {
    return this.publishMessage('pdf.analysis.failed', failed);
  }

  /**
   * Publish PDF part conversion request
   */
  async publishPdfPartConversionRequest(
    request: PdfPartConversionRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.request', request);
  }

  /**
   * Publish PDF part conversion completed
   */
  async publishPdfPartConversionCompleted(
    completed: PdfPartConversionCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.completed', completed);
  }

  /**
   * Publish PDF part conversion failed
   */
  async publishPdfPartConversionFailed(
    failed: PdfPartConversionFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.failed', failed);
  }

  /**
   * Publish PDF merging request
   */
  async publishPdfMergingRequest(request: PdfMergingRequestMessage): Promise<boolean> {
    return this.publishMessage('pdf.merging.request', request);
  }

  /**
   * Publish PDF merging progress
   */
  async publishPdfMergingProgress(
    progress: PdfMergingProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage('pdf.merging.progress', progress);
  }

  /**
   * Publish markdown storage request
   */
  async publishMarkdownStorageRequest(
    request: MarkdownStorageRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.storage.request', request);
  }

  /**
   * Publish markdown storage completed
   */
  async publishMarkdownStorageCompleted(
    completed: MarkdownStorageCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.storage.completed', completed);
  }

  /**
   * Publish markdown storage failed
   */
  async publishMarkdownStorageFailed(
    failed: MarkdownStorageFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.storage.failed', failed);
  }

  /**
   * Publish markdown part storage request
   */
  async publishMarkdownPartStorageRequest(
    request: MarkdownPartStorageRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.request', request);
  }

  /**
   * Publish markdown part storage progress
   */
  async publishMarkdownPartStorageProgress(
    progress: MarkdownPartStorageProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.progress', progress);
  }

  /**
   * Publish markdown part storage completed
   */
  async publishMarkdownPartStorageCompleted(
    completed: MarkdownPartStorageCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.completed', completed);
  }

  /**
   * Publish markdown part storage failed
   */
  async publishMarkdownPartStorageFailed(
    failed: MarkdownPartStorageFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.failed', failed);
  }

  /**
   * Publish chunking and embedding request
   */
  async publishChunkingEmbeddingRequest(
    request: ChunkingEmbeddingRequestMessage,
  ): Promise<boolean> {
    return this.publishMessage('chunking.embedding.request', request);
  }

  /**
   * Publish chunking and embedding progress
   */
  async publishChunkingEmbeddingProgress(
    progress: ChunkingEmbeddingProgressMessage,
  ): Promise<boolean> {
    return this.publishMessage('chunking.embedding.progress', progress);
  }

  /**
   * Publish chunking and embedding completed
   */
  async publishChunkingEmbeddingCompleted(
    completed: ChunkingEmbeddingCompletedMessage,
  ): Promise<boolean> {
    return this.publishMessage('chunking.embedding.completed', completed);
  }

  /**
   * Publish chunking and embedding failed
   */
  async publishChunkingEmbeddingFailed(
    failed: ChunkingEmbeddingFailedMessage,
  ): Promise<boolean> {
    return this.publishMessage('chunking.embedding.failed', failed);
  }

  /**
   * Consume messages from a queue
   */
  async consumeMessages(
    queueName: string,
    onMessage: (
      message: PdfConversionMessage,
      originalMessage: any,
    ) => void,
    options?: {
      consumerTag?: string;
      noAck?: boolean;
      exclusive?: boolean;
      priority?: number;
    },
  ): Promise<string> {
    try {
      return await this.messageService.consumeMessages(queueName, onMessage, options);
    } catch (error) {
      logger.error('Failed to consume messages:', error);
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    try {
      await this.messageService.stopConsuming(consumerTag);
    } catch (error) {
      logger.error('Failed to stop consuming:', error);
      throw error;
    }
  }

  /**
   * Get queue information
   */
  async getQueueInfo(queueName: string): Promise<any> {
    try {
      return await this.messageService.getQueueInfo(queueName);
    } catch (error) {
      logger.error('Failed to get queue info:', error);
      throw error;
    }
  }

  /**
   * Purge a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    try {
      await this.messageService.purgeQueue(queueName);
    } catch (error) {
      logger.error('Failed to purge queue:', error);
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
    try {
      const result = await this.messageService.healthCheck();
      return {
        status: result.status,
        details: {
          connected: result.details.connected,
          channelOpen: result.details.connected, // Simplified for compatibility
          reconnectAttempts: 0, // This would need to be tracked in the implementation
        },
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          channelOpen: false,
          reconnectAttempts: 0,
        },
      };
    }
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
   * Check if service is initialized and connected
   */
  isConnected(): boolean {
    return this.isInitialized && this.messageService.isConnected();
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' | 'reconnecting' {
    return this.messageService.isConnected() ? 'connected' : 'disconnected';
  }
}

// Service instance management
const serviceInstances = new Map<MessageProtocol, RabbitMQService>();

/**
 * Get RabbitMQ service instance
 * @param protocol - The message protocol to use
 * @returns RabbitMQ service instance
 */
export function getRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): RabbitMQService {
  if (!serviceInstances.has(protocol)) {
    serviceInstances.set(protocol, new RabbitMQService(protocol));
  }
  return serviceInstances.get(protocol)!;
}

/**
 * Initialize RabbitMQ service
 * @param protocol - The message protocol to use
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): Promise<void> {
  const service = getRabbitMQService(protocol);
  return service.initialize();
}

/**
 * Close RabbitMQ service
 * @param protocol - The message protocol to close
 * @returns Promise that resolves when closing is complete
 */
export async function closeRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): Promise<void> {
  const service = serviceInstances.get(protocol);
  if (service) {
    await service.close();
    serviceInstances.delete(protocol);
  }
}

/**
 * Close all RabbitMQ services
 * @returns Promise that resolves when all services are closed
 */
export async function closeAllRabbitMQServices(): Promise<void> {
  const closePromises = Array.from(serviceInstances.entries()).map(
    async ([protocol]) => closeRabbitMQService(protocol),
  );
  await Promise.all(closePromises);
  serviceInstances.clear();
}