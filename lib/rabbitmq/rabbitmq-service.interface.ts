import { ConsumeMessage } from 'amqplib';
import { IMessageService, MessageProtocol } from './message-service.interface';
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
  PdfConversionMessage,
  MultiVersionChunkingEmbeddingRequestMessage,
} from './message.types';

/**
 * Interface for RabbitMQ service
 * This interface defines the public API for RabbitMQ operations
 */
export interface IRabbitMQService {
  /**
   * The message protocol being used (AMQP or STOMP)
   */
  protocol: MessageProtocol;

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  initialize(): Promise<void>;

  /**
   * Publish a message to RabbitMQ
   */
  publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options?: RabbitMQMessageOptions,
  ): Promise<boolean>;

  /**
   * Publish PDF conversion request
   */
  publishPdfConversionRequest(
    request: PdfConversionRequestMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF conversion progress
   */
  publishPdfConversionProgress(
    progress: PdfConversionProgressMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF conversion completed
   */
  publishPdfConversionCompleted(
    completed: PdfConversionCompletedMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF conversion failed
   */
  publishPdfConversionFailed(
    failed: PdfConversionFailedMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF analysis request
   */
  publishPdfAnalysisRequest(
    request: PdfAnalysisRequestMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF analysis completed
   */
  publishPdfAnalysisCompleted(
    completed: PdfAnalysisCompletedMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF analysis failed
   */
  publishPdfAnalysisFailed(failed: PdfAnalysisFailedMessage): Promise<boolean>;

  /**
   * Publish PDF part conversion request
   */
  publishPdfPartConversionRequest(
    request: PdfPartConversionRequestMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF part conversion completed
   */
  publishPdfPartConversionCompleted(
    completed: PdfPartConversionCompletedMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF part conversion failed
   */
  publishPdfPartConversionFailed(
    failed: PdfPartConversionFailedMessage,
  ): Promise<boolean>;

  /**
   * Publish PDF merging request
   */
  publishPdfMergingRequest(request: PdfMergingRequestMessage): Promise<boolean>;

  /**
   * Publish PDF merging progress
   */
  publishPdfMergingProgress(
    progress: PdfMergingProgressMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown storage request
   */
  publishMarkdownStorageRequest(
    request: MarkdownStorageRequestMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown storage completed
   */
  publishMarkdownStorageCompleted(
    completed: MarkdownStorageCompletedMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown storage failed
   */
  publishMarkdownStorageFailed(
    failed: MarkdownStorageFailedMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown part storage request
   */
  publishMarkdownPartStorageRequest(
    request: MarkdownPartStorageRequestMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown part storage progress
   */
  publishMarkdownPartStorageProgress(
    progress: MarkdownPartStorageProgressMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown part storage completed
   */
  publishMarkdownPartStorageCompleted(
    completed: MarkdownPartStorageCompletedMessage,
  ): Promise<boolean>;

  /**
   * Publish markdown part storage failed
   */
  publishMarkdownPartStorageFailed(
    failed: MarkdownPartStorageFailedMessage,
  ): Promise<boolean>;

  /**
   * Publish chunking and embedding request
   */
  publishChunkingEmbeddingRequest(
    request: MultiVersionChunkingEmbeddingRequestMessage,
  ): Promise<boolean>;

  /**
   * Publish chunking and embedding progress
   */
  publishChunkingEmbeddingProgress(
    progress: ChunkingEmbeddingProgressMessage,
  ): Promise<boolean>;

  /**
   * Publish chunking and embedding completed
   */
  publishChunkingEmbeddingCompleted(
    completed: ChunkingEmbeddingCompletedMessage,
  ): Promise<boolean>;

  /**
   * Publish chunking and embedding failed
   */
  publishChunkingEmbeddingFailed(
    failed: ChunkingEmbeddingFailedMessage,
  ): Promise<boolean>;

  /**
   * Consume messages from a queue
   */
  consumeMessages(
    queueName: string,
    onMessage: (
      message: PdfConversionMessage,
      originalMessage: ConsumeMessage,
    ) => void,
    options?: {
      consumerTag?: string;
      noAck?: boolean;
      exclusive?: boolean;
      priority?: number;
    },
  ): Promise<string>;

  /**
   * Stop consuming messages
   */
  stopConsuming(consumerTag: string): Promise<void>;

  /**
   * Get queue information
   */
  getQueueInfo(queueName: string): Promise<any>;

  /**
   * Purge a queue
   */
  purgeQueue(queueName: string): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      channelOpen: boolean;
      reconnectAttempts: number;
    };
  }>;

  /**
   * Close connection and cleanup
   */
  close(): Promise<void>;

  /**
   * Check if service is initialized and connected
   */
  isConnected(): boolean;
}
