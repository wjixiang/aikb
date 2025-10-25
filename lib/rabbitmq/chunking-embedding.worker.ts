import {
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  ChunkingEmbeddingRequestMessage,
  MultiVersionChunkingEmbeddingProgressMessage,
  MultiVersionChunkingEmbeddingCompletedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { MessageProtocol } from './message-service.interface';
import Library, {
  ILibraryStorage,
} from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingEmbeddingProcessor } from './chunking-embedding.processor';
import { ChunkingStrategy } from '@aikb/chunking';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { v4 as uuidv4 } from 'uuid';
import { Embedding } from '@aikb/embedding';
import { ChunkingManager } from '@aikb/chunking';

const logger = createLoggerWithPrefix('ChunkingEmbeddingWorker');

/**
 * Interface for status updates
 */
interface StatusUpdater {
  updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message?: string,
    progress?: number,
    error?: string,
    processingTime?: number,
  ): Promise<void>;
}

/**
 * Interface for retry handling
 */
interface RetryHandler {
  shouldRetry(retryCount: number, maxRetries: number): boolean;
  handleRetry(
    message: ChunkingEmbeddingRequestMessage,
    retryCount: number,
    maxRetries: number,
  ): Promise<void>;
  handleFailure(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void>;
}

interface ProgressReporter {
  reportProgress(
    itemId: string,
    status: PdfProcessingStatus,
    progress: number,
    message: string,
    chunksProcessed?: number,
    totalChunks?: number,
    groupId?: string,
  ): Promise<void>;
}

/**
 * Chunking and Embedding Worker
 * Orchestrates the processing and communication for chunking and embedding requests from RabbitMQ queue
 */
export class ChunkingEmbeddingWorker
  implements ProgressReporter, StatusUpdater, RetryHandler
{
  private rabbitMQService;
  private processor: ChunkingEmbeddingProcessor;
  private consumerTag: string | null = null;
  private isRunning = false;
  private storage: ILibraryStorage;

  constructor(storage: ILibraryStorage, protocol?: MessageProtocol) {
    this.storage = storage;
    this.rabbitMQService = getRabbitMQService(protocol);
    this.processor = new ChunkingEmbeddingProcessor(
      new Library(storage),
      new Embedding(),
      new ChunkingManager(),
      this, // ProgressReporter
      this, // StatusUpdater
      this, // RetryHandler
    );
  }

  /**
   * Start the chunking and embedding worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Chunking and embedding worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting chunking and embedding worker...');

      // Start consuming messages from the request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.CHUNKING_EMBEDDING_REQUEST,
        this.handleMessage.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.CHUNKING_EMBEDDING_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info('Chunking and embedding worker started successfully');
    } catch (error) {
      logger.error('Failed to start chunking and embedding worker:', error);
      throw error;
    }
  }

  /**
   * Stop the chunking and embedding worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Chunking and embedding worker is not running');
      return;
    }

    try {
      logger.info('Stopping chunking and embedding worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('Chunking and embedding worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop chunking and embedding worker:', error);
      throw error;
    }
  }

  /**
   * Handle incoming messages and route to appropriate handler
   */
  private async handleMessage(
    message: any,
    originalMessage: any,
  ): Promise<void> {
    try {
      // Route message based on event type
      switch (message.eventType) {
        case 'CHUNKING_EMBEDDING_REQUEST':
          throw new Error('CHUNKING_EMBEDDING_REQUEST not longer support');
          break;
        case 'CHUNKING_EMBEDDING_REQUEST':
          await this.processor.processChunkingEmbeddingRequest(
            message as ChunkingEmbeddingRequestMessage,
          );
          break;
        default:
          logger.warn(`Unknown message type: ${message.eventType}`);
          // Acknowledge the message to prevent reprocessing
          originalMessage.ack();
      }

      // Acknowledge the message after successful processing
      originalMessage.ack();
    } catch (error) {
      logger.error(`Error handling message:`, error);
      // Negative acknowledge to requeue the message
      originalMessage.nack(false, true);
    }
  }

  // ProgressReporter interface implementation
  async reportProgress(
    itemId: string,
    status: PdfProcessingStatus,
    progress: number,
    message: string,
    chunksProcessed?: number,
    totalChunks?: number,
    groupId?: string,
  ): Promise<void> {
    try {
      const progressMessage: ChunkingEmbeddingProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'CHUNKING_EMBEDDING_PROGRESS',
        itemId,
        status,
        progress,
        message: groupId ? `${message} (Group: ${groupId})` : message,
        startedAt: Date.now(),
        chunksProcessed,
        totalChunks,
      };

      await this.rabbitMQService.publishChunkingEmbeddingProgress(
        progressMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish progress message for item ${itemId}:`,
        error,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  // StatusUpdater interface implementation
  async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message?: string,
    progress?: number,
    error?: string,
    processingTime?: number,
  ): Promise<void> {
    try {
      // Get current metadata
      const metadata = await this.storage.getMetadata(itemId);
      if (!metadata) {
        logger.warn(`Item ${itemId} not found for status update`);
        return;
      }

      // Update status fields
      const updatedMetadata = {
        ...metadata,
        pdfProcessingStatus: status,
        pdfProcessingMessage: message,
        pdfProcessingProgress: progress,
        pdfProcessingError: error,
        pdfProcessingCompletedAt:
          status === PdfProcessingStatus.COMPLETED ? new Date() : undefined,
        dateModified: new Date(),
      };

      await this.storage.updateMetadata(updatedMetadata);
    } catch (updateError) {
      logger.error(`Failed to update status for item ${itemId}:`, updateError);
      // Don't throw here, as this is a secondary operation
    }
  }

  // RetryHandler interface implementation
  shouldRetry(retryCount: number, maxRetries: number): boolean {
    return retryCount < maxRetries;
  }

  async handleRetry(
    message: ChunkingEmbeddingRequestMessage,
    retryCount: number,
    maxRetries: number,
  ): Promise<void> {
    logger.info(
      `Retrying chunking and embedding for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`,
    );

    // Republish the request with incremented retry count
    const retryRequest = {
      ...message,
      messageId: uuidv4(),
      timestamp: Date.now(),
      retryCount: retryCount + 1,
    };

    await this.rabbitMQService.publishChunkingEmbeddingRequest(retryRequest);
  }

  async handleFailure(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    // Publish failure message
    await this.publishFailureMessage(
      itemId,
      error,
      retryCount,
      maxRetries,
      processingTime,
    );
  }

  /**
   * Publish completion message
   */
  async publishCompletionMessage(
    itemId: string,
    chunksCount: number,
    processingTime: number,
    chunkingStrategy: ChunkingStrategy,
  ): Promise<void> {
    try {
      const completionMessage: ChunkingEmbeddingCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'CHUNKING_EMBEDDING_COMPLETED',
        itemId,
        status: PdfProcessingStatus.COMPLETED,
        chunksCount,
        processingTime,
        chunkingStrategy,
      };

      await this.rabbitMQService.publishChunkingEmbeddingCompleted(
        completionMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish completion message for item ${itemId}:`,
        error,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  /**
   * Publish failure message
   */
  async publishFailureMessage(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const failureMessage: ChunkingEmbeddingFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'CHUNKING_EMBEDDING_FAILED',
        itemId,
        status: PdfProcessingStatus.FAILED,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.rabbitMQService.publishChunkingEmbeddingFailed(failureMessage);
    } catch (publishError) {
      logger.error(
        `Failed to publish failure message for item ${itemId}:`,
        publishError,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  /**
   * Check if the worker is running
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<{
    isRunning: boolean;
    consumerTag: string | null;
    rabbitMQConnected: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
    };
  }
}

/**
 * Create and start a chunking and embedding worker
 */
export async function createChunkingEmbeddingWorker(
  storage: ILibraryStorage,
  protocol?: MessageProtocol,
): Promise<ChunkingEmbeddingWorker> {
  const worker = new ChunkingEmbeddingWorker(storage, protocol);
  await worker.start();
  return worker;
}

/**
 * Stop a chunking and embedding worker
 */
export async function stopChunkingEmbeddingWorker(
  worker: ChunkingEmbeddingWorker,
): Promise<void> {
  await worker.stop();
}

// Direct execution support
if (require.main === module) {
  const {
    S3ElasticSearchLibraryStorage,
  } = require('../../knowledgeBase/knowledgeImport/library');

  async function main() {
    try {
      // Create storage instance
      const elasticsearchUrl =
        process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
      const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl, 1024);

      // Create and start worker
      const worker = await createChunkingEmbeddingWorker(storage);
      logger.info('Chunking and Embedding Worker started successfully');

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        await worker.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        await worker.stop();
        process.exit(0);
      });

      // Keep the process running
      logger.info(
        'Chunking and Embedding Worker is running. Press Ctrl+C to stop.',
      );
    } catch (error) {
      logger.error('Failed to start Chunking and Embedding Worker:', error);
      process.exit(1);
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
