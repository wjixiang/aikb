import {
  ChunkingEmbeddingRequestMessage,
  MultiVersionChunkingEmbeddingRequestMessage,
  PdfProcessingStatus,
} from './message.types';
import { AbstractLibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import Library from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingStrategy } from '../chunking/chunkingStrategy';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('ChunkingEmbeddingProcessor');

/**
 * Processing options for chunking and embedding
 */
export interface ProcessingOptions {
  denseVectorIndexGroupId?: string;
  embeddingProvider?: string;
  embeddingConfig?: any;
  chunkingConfig?: any;
  forceReprocess?: boolean;
  preserveExisting?: boolean;
}

/**
 * Interface for status updates
 */
export interface StatusUpdater {
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
export interface RetryHandler {
  shouldRetry(retryCount: number, maxRetries: number): boolean;
  handleRetry(
    message: ChunkingEmbeddingRequestMessage | MultiVersionChunkingEmbeddingRequestMessage,
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
 * Chunking and Embedding Processor
 * Handles the core processing logic for chunking and embedding operations
 */
export class ChunkingEmbeddingProcessor {
  private storage: AbstractLibraryStorage;
  private library: Library;
  private progressReporter: ProgressReporter;
  private statusUpdater: StatusUpdater;
  private retryHandler: RetryHandler;

  constructor(
    storage: AbstractLibraryStorage,
    progressReporter: ProgressReporter,
    statusUpdater: StatusUpdater,
    retryHandler: RetryHandler,
  ) {
    this.storage = storage;
    this.library = new Library(storage);
    this.progressReporter = progressReporter;
    this.statusUpdater = statusUpdater;
    this.retryHandler = retryHandler;
  }

  /**
   * Process a chunking and embedding request
   * @deprecated
   */
  async processChunkingEmbeddingRequest(
    message: ChunkingEmbeddingRequestMessage,
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
      await this.progressReporter.reportProgress(
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
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        10,
        'Preparing chunking process',
      );

      

      logger.info(
        `Starting chunking for item ${message.itemId} using strategy: ${message.chunkingStrategy}`,
        {
          itemId: message.itemId,
          chunkingStrategy: message.chunkingStrategy,
          denseVectorIndexGroupId: message.denseVectorIndexGroupId,
          embeddingProvider: message.embeddingProvider,
          retryCount,
          maxRetries,
        },
      );

      // Update progress
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        20,
        'Chunking markdown content',
      );

      // Prepare options for multi-version support
      const options: ProcessingOptions = {
        denseVectorIndexGroupId: message.denseVectorIndexGroupId,
        embeddingProvider: message.embeddingProvider,
        embeddingConfig: message.embeddingConfig,
        chunkingConfig: message.chunkingConfig,
        forceReprocess: message.forceReprocess,
        preserveExisting: message.preserveExisting,
      };

      // Process chunks and embeddings with options
      await this.library.processItemChunks(message.itemId, message.chunkingStrategy, options);

      // Update progress
      await this.progressReporter.reportProgress(
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
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Chunking and embedding completed successfully',
        100,
        undefined,
        processingTime,
      );

      // Report completion
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        100,
        'Chunking and embedding completed successfully',
        chunksCount,
        chunksCount,
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
          denseVectorIndexGroupId: message.denseVectorIndexGroupId,
          embeddingProvider: message.embeddingProvider,
          retryCount,
          maxRetries,
          processingTime,
        },
      );

      // Update item status with error
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Chunking and embedding failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Handle retry or failure
      if (this.retryHandler.shouldRetry(retryCount, maxRetries)) {
        await this.retryHandler.handleRetry(message, retryCount, maxRetries);
      } else {
        await this.retryHandler.handleFailure(
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
   * Process a multi-version chunking and embedding request
   */
  async processMultiVersionChunkingEmbeddingRequest(
    message: MultiVersionChunkingEmbeddingRequestMessage,
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
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        0,
        'Starting multi-version chunking and embedding',
        undefined,
        undefined,
        message.groupId,
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
    
      let chunkingStrategy: ChunkingStrategy;
      let options: ProcessingOptions = {};

      if (message.groupConfig) {
        // Use provided group configuration
        const groupConfig = message.groupConfig;
        
        
        // Convert string strategy to enum
        if (groupConfig.chunkingStrategy === 'h1') {
          chunkingStrategy = ChunkingStrategy.H1;
        } else {
          chunkingStrategy = ChunkingStrategy.PARAGRAPH;
        }

        options = {
          // denseVectorIndexGroupId: groupId,
          embeddingProvider: groupConfig.embeddingProvider,
          embeddingConfig: groupConfig.embeddingConfig,
          chunkingConfig: groupConfig.chunkingConfig,
          forceReprocess: message.forceReprocess,
          preserveExisting: message.preserveExisting,
        };

        logger.info(
          `Using group configuration for item ${message.itemId}: strategy=${groupConfig.chunkingStrategy}, provider=${groupConfig.embeddingProvider}`,
        );
      } else {
        throw new Error('Either groupId or groupConfig must be provided for multi-version processing');
      }

      // Update progress
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        20,
        'Chunking markdown content with multi-version support',
        undefined,
        undefined,
        // groupId,
      );

      // Process chunks and embeddings with multi-version options
      await this.library.processItemChunks(message.itemId, chunkingStrategy, options);

      // Update progress
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        90,
        'Finalizing multi-version chunking and embedding',
        undefined,
        undefined,
        groupId,
      );

      // Get the chunks to count them
      const chunks = await this.library.getItemChunks(message.itemId);
      const chunksCount = chunks.length;

      // Update item status to completed
      const processingTime = Date.now() - startTime;
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Multi-version chunking and embedding completed successfully',
        100,
        undefined,
        processingTime,
      );

      // Report completion
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        100,
        'Multi-version chunking and embedding completed successfully',
        chunksCount,
        chunksCount,
        groupId,
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
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Multi-version chunking and embedding failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Handle retry or failure
      if (this.retryHandler.shouldRetry(retryCount, maxRetries)) {
        await this.retryHandler.handleRetry(message, retryCount, maxRetries);
      } else {
        await this.retryHandler.handleFailure(
          message.itemId,
          errorMessage,
          retryCount,
          maxRetries,
          processingTime,
        );
      }
    }
  }
}

