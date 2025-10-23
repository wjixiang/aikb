import {
  MarkdownStorageRequestMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  MultiVersionChunkingEmbeddingRequestMessage,
} from './message.types';
import { getRabbitMQService, RabbitMQService } from './rabbitmq.service';
import { MessageProtocol } from './message-service.interface';
import {
  AbstractLibraryStorage,
  BookMetadata,
  ChunkingEmbeddingGroup,
} from '../../knowledgeBase/knowledgeImport/library';
import {
  defaultChunkingConfig,
} from '../chunking/chunkingStrategy';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';
import { createItemVectorStorage } from 'knowledgeBase/knowledgeImport/elasticsearch-item-vector-storage';
import { defaultEmbeddingConfig } from 'lib/embedding/embedding';

const logger = createLoggerWithPrefix('MarkdownStorageWorker');

/**
 * Markdown Storage Worker
 * Processes markdown storage requests from RabbitMQ queue
 */
export class MarkdownStorageWorker {
  private rabbitMQService: RabbitMQService;
  private consumerTag: string | null = null;
  private isRunning = false;
  private storage: AbstractLibraryStorage;

  constructor(storage: AbstractLibraryStorage, protocol?: MessageProtocol) {
    this.storage = storage;
    this.rabbitMQService = getRabbitMQService(protocol);
  }

  /**
   * Start the markdown storage worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Markdown storage worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting markdown storage worker...');

      // Start consuming messages from the request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_REQUEST,
        this.handleMarkdownStorageRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_STORAGE_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info('Markdown storage worker started successfully');
    } catch (error) {
      logger.error('Failed to start markdown storage worker:', error);
      throw error;
    }
  }

  /**
   * Stop the markdown storage worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Markdown storage worker is not running');
      return;
    }

    try {
      logger.info('Stopping markdown storage worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('Markdown storage worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop markdown storage worker:', error);
      throw error;
    }
  }

  /**
   * Handle markdown storage request
   */
  private async handleMarkdownStorageRequest(
    message: MarkdownStorageRequestMessage,
    originalMessage: any,
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(
      `Processing markdown storage request for item: ${message.itemId}`,
    );

    try {
      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        throw new Error(`Item ${message.itemId} not found`);
      }

      // Update item status to processing
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        'Storing markdown content',
      );

      // Save markdown content
      logger.info(`Saving markdown content for item: ${message.itemId}`);
      await this.storage.saveMarkdown(message.itemId, message.markdownContent);

      // Update item metadata with completion info
      const processingTime = Date.now() - startTime;
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Markdown storage completed successfully',
        100,
        undefined,
        processingTime,
      );

      // Publish completion message
      await this.publishCompletionMessage(message.itemId, processingTime);

      // Send chunking and embedding request
      logger.info(
        `Sending chunking and embedding request for item: ${message.itemId}`,
      );
      await this.sendChunkingEmbeddingRequest(
        message.itemId,
        message.markdownContent,
      );

      logger.info(
        `Markdown storage completed successfully for item: ${message.itemId}`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `Markdown storage failed for item ${message.itemId}:`,
        error,
      );

      // Update item status with error
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Markdown storage failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Check if should retry
      const retryCount = message.retryCount || 0;
      const maxRetries = message.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying markdown storage for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.rabbitMQService.publishMarkdownStorageRequest(retryRequest);
      } else {
        // Publish failure message
        await this.publishFailureMessage(
          message.itemId,
          errorMessage,
          retryCount,
          maxRetries,
          processingTime,
        );
      }
    }
  }

  /**
   * Update item status in storage
   */
  private async updateItemStatus(
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
      const updatedMetadata: BookMetadata = {
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

  /**
   * Send chunking and embedding request
   */
  private async sendChunkingEmbeddingRequest(
    itemId: string,
    markdownContent: string,
  ): Promise<void> {
    try {
      const groupinfo: Omit<ChunkingEmbeddingGroup, "id"> = {
        name: `chunk-embed-${Date.now()}`,
        chunkingConfig: defaultChunkingConfig,
        embeddingConfig: defaultEmbeddingConfig,
        isDefault: false,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      

      const chunkingEmbeddingRequest: MultiVersionChunkingEmbeddingRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: "MULTI_VERSION_CHUNKING_EMBEDDING_REQUEST",
        itemId,
        markdownContent,
        priority: 'normal' as const,
        retryCount: 0,
        maxRetries: 3,
        groupConfig: groupinfo
      };

      await this.rabbitMQService.publishChunkingEmbeddingRequest(
        chunkingEmbeddingRequest,
      );
      logger.info(`Chunking and embedding request sent for item: ${itemId}`);
    } catch (error) {
      logger.error(
        `Failed to send chunking and embedding request for item ${itemId}:`,
        error,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  /**
   * Publish completion message
   */
  private async publishCompletionMessage(
    itemId: string,
    processingTime: number,
  ): Promise<void> {
    try {
      const completionMessage: MarkdownStorageCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_COMPLETED',
        itemId,
        status: PdfProcessingStatus.COMPLETED,
        processingTime,
      };

      await this.rabbitMQService.publishMarkdownStorageCompleted(
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
  private async publishFailureMessage(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const failureMessage: MarkdownStorageFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_FAILED',
        itemId,
        status: PdfProcessingStatus.FAILED,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.rabbitMQService.publishMarkdownStorageFailed(failureMessage);
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
}

/**
 * Create and start a markdown storage worker
 */
export async function startMarkdownStorageWorker(
  storage: AbstractLibraryStorage,
): Promise<MarkdownStorageWorker> {
  const worker = new MarkdownStorageWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a markdown storage worker
 */
export async function stopMarkdownStorageWorker(
  worker: MarkdownStorageWorker,
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
      const worker = await startMarkdownStorageWorker(storage);
      logger.info('Markdown Storage Worker started successfully');
    } catch (error) {
      logger.error('Failed to start Markdown Storage Worker:', error);
      process.exit(1);
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
