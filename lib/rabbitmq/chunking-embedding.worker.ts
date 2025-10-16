import {
  ChunkingEmbeddingRequestMessage,
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  MultiVersionChunkingEmbeddingRequestMessage,
  MultiVersionChunkingEmbeddingProgressMessage,
  MultiVersionChunkingEmbeddingCompletedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import Library from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingStrategyType } from '../chunking/chunkingStrategy';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('ChunkingEmbeddingWorker');

/**
 * Chunking and Embedding Worker
 * Processes chunking and embedding requests from RabbitMQ queue
 */
export class ChunkingEmbeddingWorker {
  private rabbitMQService = getRabbitMQService();
  private consumerTag: string | null = null;
  private isRunning = false;
  private storage: AbstractLibraryStorage;
  private library: Library;

  constructor(storage: AbstractLibraryStorage) {
    this.storage = storage;
    this.library = new Library(storage);
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
          await this.handleChunkingEmbeddingRequest(message, originalMessage);
          break;
        case 'MULTI_VERSION_CHUNKING_EMBEDDING_REQUEST':
          await this.handleMultiVersionChunkingEmbeddingRequest(message, originalMessage);
          break;
        default:
          logger.warn(`Unknown message type: ${message.eventType}`);
          // Acknowledge the message to prevent reprocessing
          originalMessage.ack();
      }
    } catch (error) {
      logger.error(`Error handling message:`, error);
      // Negative acknowledge to requeue the message
      originalMessage.nack(false, true);
    }
  }

  /**
   * Handle chunking and embedding request
   */
  private async handleChunkingEmbeddingRequest(
    message: ChunkingEmbeddingRequestMessage,
    originalMessage: any,
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(
      `Processing chunking and embedding request for item: ${message.itemId}`,
    );

    // Check retry status before processing
    const retryCount = message.retryCount || 0;
    const maxRetries = message.maxRetries || 3;
    const isFinalAttempt = retryCount >= maxRetries;

    if (isFinalAttempt) {
      logger.info(
        `Processing final attempt for item ${message.itemId} (retryCount: ${retryCount}, maxRetries: ${maxRetries})`,
      );
    }

    try {
      // Update status to processing
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        0,
        'Starting chunking and embedding',
      );

      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        throw new Error(`Item ${message.itemId} not found`);
      }

      // Get the markdown content
      let markdownContent = message.markdownContent;
      if (!markdownContent) {
        logger.info(`Fetching markdown content from storage for item: ${message.itemId}`);
        const storedMarkdown = await this.storage.getMarkdown(message.itemId);
        if (!storedMarkdown) {
          throw new Error(`No markdown content found for item ${message.itemId}`);
        }
        markdownContent = storedMarkdown;
      }

      // Update progress
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        10,
        'Preparing chunking process',
      );

      // Convert string strategy to enum
      let chunkingStrategy: ChunkingStrategyType;
      if (message.chunkingStrategy === 'h1') {
        chunkingStrategy = ChunkingStrategyType.H1;
      } else {
        chunkingStrategy = ChunkingStrategyType.PARAGRAPH;
      }

      logger.info(
        `Starting chunking for item ${message.itemId} using strategy: ${chunkingStrategy}`,
        {
          itemId: message.itemId,
          chunkingStrategy: message.chunkingStrategy,
          denseVectorIndexGroup: message.denseVectorIndexGroup,
          embeddingProvider: message.embeddingProvider,
          retryCount,
          maxRetries,
        },
      );

      // Update progress
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        20,
        'Chunking markdown content',
      );

      // Prepare options for multi-version support
      const options = {
        denseVectorIndexGroup: message.denseVectorIndexGroup,
        embeddingProvider: message.embeddingProvider,
        embeddingConfig: message.embeddingConfig,
        chunkingConfig: message.chunkingConfig,
        forceReprocess: message.forceReprocess,
        preserveExisting: message.preserveExisting,
      };

      // Process chunks and embeddings with options
      await this.library.processItemChunks(message.itemId, chunkingStrategy, options);

      // Update progress
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        90,
        'Finalizing chunking and embedding',
      );

      // Get the chunks to count them
      const chunks = await this.library.getItemChunks(message.itemId);
      const chunksCount = chunks.length;

      // Update item status to completed
      const processingTime = Date.now() - startTime;
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Chunking and embedding completed successfully',
        100,
        undefined,
        processingTime,
      );

      // Publish completion message
      await this.publishCompletionMessage(
        message.itemId,
        chunksCount,
        processingTime,
        message.chunkingStrategy,
      );

      logger.info(
        `Chunking and embedding completed successfully for item: ${message.itemId}, chunks: ${chunksCount}`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(
        `Chunking and embedding failed for item ${message.itemId}:`,
        {
          error: errorMessage,
          stack: errorStack,
          itemId: message.itemId,
          chunkingStrategy: message.chunkingStrategy,
          denseVectorIndexGroup: message.denseVectorIndexGroup,
          embeddingProvider: message.embeddingProvider,
          retryCount,
          maxRetries,
          processingTime,
        },
      );

      // Update item status with error
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Chunking and embedding failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Check if should retry
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
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
   * Handle multi-version chunking and embedding request
   */
  private async handleMultiVersionChunkingEmbeddingRequest(
    message: MultiVersionChunkingEmbeddingRequestMessage,
    originalMessage: any,
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(
      `Processing multi-version chunking and embedding request for item: ${message.itemId}`,
    );

    // Check retry status before processing
    const retryCount = message.retryCount || 0;
    const maxRetries = message.maxRetries || 3;
    const isFinalAttempt = retryCount >= maxRetries;

    if (isFinalAttempt) {
      logger.info(
        `Processing final attempt for item ${message.itemId} (retryCount: ${retryCount}, maxRetries: ${maxRetries})`,
      );
    }

    try {
      // Update status to processing
      await this.publishMultiVersionProgressMessage(
        message.itemId,
        message.groupId,
        PdfProcessingStatus.PROCESSING,
        0,
        'Starting multi-version chunking and embedding',
      );

      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        throw new Error(`Item ${message.itemId} not found`);
      }

      // Get the markdown content
      let markdownContent = message.markdownContent;
      if (!markdownContent) {
        logger.info(`Fetching markdown content from storage for item: ${message.itemId}`);
        const storedMarkdown = await this.storage.getMarkdown(message.itemId);
        if (!storedMarkdown) {
          throw new Error(`No markdown content found for item ${message.itemId}`);
        }
        markdownContent = storedMarkdown;
      }

      // Extract group configuration
      let groupId = message.groupId;
      let chunkingStrategy: ChunkingStrategyType;
      let options: any = {};

      if (message.groupConfig) {
        // Use provided group configuration
        const groupConfig = message.groupConfig;
        groupId = groupId || groupConfig.id;
        
        // Convert string strategy to enum
        if (groupConfig.chunkingStrategy === 'h1') {
          chunkingStrategy = ChunkingStrategyType.H1;
        } else {
          chunkingStrategy = ChunkingStrategyType.PARAGRAPH;
        }

        options = {
          denseVectorIndexGroup: groupId,
          embeddingProvider: groupConfig.embeddingProvider,
          embeddingConfig: groupConfig.embeddingConfig,
          chunkingConfig: groupConfig.chunkingConfig,
          forceReprocess: message.forceReprocess,
          preserveExisting: message.preserveExisting,
        };

        logger.info(
          `Using group configuration for item ${message.itemId}: strategy=${groupConfig.chunkingStrategy}, provider=${groupConfig.embeddingProvider}`,
        );
      } else if (groupId) {
        // Use existing group (would need to fetch group details from storage)
        logger.info(`Using existing group ${groupId} for item ${message.itemId}`);
        // For now, use default strategy
        chunkingStrategy = ChunkingStrategyType.H1;
        options = {
          denseVectorIndexGroup: groupId,
          forceReprocess: message.forceReprocess,
          preserveExisting: message.preserveExisting,
        };
      } else {
        throw new Error('Either groupId or groupConfig must be provided for multi-version processing');
      }

      // Update progress
      await this.publishMultiVersionProgressMessage(
        message.itemId,
        groupId,
        PdfProcessingStatus.PROCESSING,
        20,
        'Chunking markdown content with multi-version support',
      );

      // Process chunks and embeddings with multi-version options
      await this.library.processItemChunks(message.itemId, chunkingStrategy, options);

      // Update progress
      await this.publishMultiVersionProgressMessage(
        message.itemId,
        groupId,
        PdfProcessingStatus.PROCESSING,
        90,
        'Finalizing multi-version chunking and embedding',
      );

      // Get the chunks to count them
      const chunks = await this.library.getItemChunks(message.itemId);
      const chunksCount = chunks.length;

      // Update item status to completed
      const processingTime = Date.now() - startTime;
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Multi-version chunking and embedding completed successfully',
        100,
        undefined,
        processingTime,
      );

      // Publish multi-version completion message
      await this.publishMultiVersionCompletionMessage(
        message.itemId,
        groupId!,
        chunksCount,
        processingTime,
        options.chunkingStrategy || chunkingStrategy,
        options.embeddingProvider || 'default',
        '1.0.0', // Default version
      );

      logger.info(
        `Multi-version chunking and embedding completed successfully for item: ${message.itemId}, group: ${groupId}, chunks: ${chunksCount}`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(
        `Multi-version chunking and embedding failed for item ${message.itemId}:`,
        {
          error: errorMessage,
          stack: errorStack,
          itemId: message.itemId,
          groupId: message.groupId,
          groupConfig: message.groupConfig,
          retryCount,
          maxRetries,
          processingTime,
        },
      );

      // Update item status with error
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Multi-version chunking and embedding failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Check if should retry
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying multi-version chunking and embedding for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Convert multi-version message to standard message for retry
        const retryRequest: ChunkingEmbeddingRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'CHUNKING_EMBEDDING_REQUEST',
          itemId: message.itemId,
          markdownContent: message.markdownContent,
          chunkingStrategy: message.groupConfig?.chunkingStrategy as 'h1' | 'paragraph' || 'h1',
          priority: message.priority,
          retryCount: retryCount + 1,
          maxRetries: message.maxRetries,
          denseVectorIndexGroup: message.groupId,
          embeddingProvider: message.groupConfig?.embeddingProvider,
          embeddingConfig: message.groupConfig?.embeddingConfig,
          chunkingConfig: message.groupConfig?.chunkingConfig,
          forceReprocess: message.forceReprocess,
          preserveExisting: message.preserveExisting,
        };

        await this.rabbitMQService.publishChunkingEmbeddingRequest(retryRequest);
      } else {
        // Publish failure message using the standard method
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

  /**
   * Publish progress message
   */
  private async publishProgressMessage(
    itemId: string,
    status: PdfProcessingStatus,
    progress: number,
    message: string,
    chunksProcessed?: number,
    totalChunks?: number,
  ): Promise<void> {
    try {
      const progressMessage: ChunkingEmbeddingProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'CHUNKING_EMBEDDING_PROGRESS',
        itemId,
        status,
        progress,
        message,
        startedAt: Date.now(),
        chunksProcessed,
        totalChunks,
      };

      await this.rabbitMQService.publishChunkingEmbeddingProgress(progressMessage);
    } catch (error) {
      logger.error(
        `Failed to publish progress message for item ${itemId}:`,
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
    chunksCount: number,
    processingTime: number,
    chunkingStrategy: 'h1' | 'paragraph',
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
  private async publishFailureMessage(
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
   * Publish multi-version progress message
   */
  private async publishMultiVersionProgressMessage(
    itemId: string,
    groupId: string | undefined,
    status: PdfProcessingStatus,
    progress: number,
    message: string,
    chunksProcessed?: number,
    totalChunks?: number,
  ): Promise<void> {
    try {
      // For now, use the standard progress message publisher with group info in the message
      // In a full implementation, you would add a specific method for multi-version messages
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

      await this.rabbitMQService.publishChunkingEmbeddingProgress(progressMessage);
    } catch (error) {
      logger.error(
        `Failed to publish multi-version progress message for item ${itemId}:`,
        error,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  /**
   * Publish multi-version completion message
   */
  private async publishMultiVersionCompletionMessage(
    itemId: string,
    groupId: string,
    chunksCount: number,
    processingTime: number,
    strategy: string,
    provider: string,
    version: string,
  ): Promise<void> {
    try {
      const completionMessage: MultiVersionChunkingEmbeddingCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MULTI_VERSION_CHUNKING_EMBEDDING_COMPLETED',
        itemId,
        groupId,
        status: PdfProcessingStatus.COMPLETED,
        chunksCount,
        processingTime,
        strategy,
        provider,
        version,
      };

      // For now, use the standard completion message publisher
      // In a full implementation, you would add a specific method for multi-version messages
      await this.rabbitMQService.publishChunkingEmbeddingCompleted({
        messageId: completionMessage.messageId,
        timestamp: completionMessage.timestamp,
        eventType: 'CHUNKING_EMBEDDING_COMPLETED',
        itemId: completionMessage.itemId,
        status: completionMessage.status,
        chunksCount: completionMessage.chunksCount,
        processingTime: completionMessage.processingTime,
        chunkingStrategy: completionMessage.strategy as 'h1' | 'paragraph',
      });
    } catch (error) {
      logger.error(
        `Failed to publish multi-version completion message for item ${itemId}:`,
        error,
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
  storage: AbstractLibraryStorage,
): Promise<ChunkingEmbeddingWorker> {
  const worker = new ChunkingEmbeddingWorker(storage);
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
  } = require('../../knowledgeImport/library');

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