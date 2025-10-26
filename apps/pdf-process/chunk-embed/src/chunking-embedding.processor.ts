import {
  ChunkingEmbeddingRequestMessage,
  PdfProcessingStatus,
} from './message.types';
import {
  ILibraryStorage,
  ItemChunk,
  ILibrary,
} from '@aikb/bibliography';
import { ChunkingStrategy } from '@aikb/chunking';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { createItemVectorStorage } from '@aikb/bibliography';
import { Embedding } from '@aikb/embedding';
import { ChunkingManager } from '@aikb/chunking';
import { error } from 'console';
import { v4 } from 'uuid';

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
 * Chunking and Embedding Processor
 * Handles the core processing logic for chunking and embedding operations
 */
export class ChunkingEmbeddingProcessor {
  private progressReporter: ProgressReporter;
  private statusUpdater: StatusUpdater;
  private retryHandler: RetryHandler;

  constructor(
    private library: ILibrary,
    private embedingService: Embedding,
    private chunkingService: ChunkingManager,
    progressReporter: ProgressReporter,
    statusUpdater: StatusUpdater,
    retryHandler: RetryHandler,
  ) {
    this.progressReporter = progressReporter;
    this.statusUpdater = statusUpdater;
    this.retryHandler = retryHandler;
  }

  /**
   * Process a chunking and embedding request
   */
  async processChunkingEmbeddingRequest(
    message: ChunkingEmbeddingRequestMessage,
  ): Promise<void> {
    const startTime = Date.now();
    const maxRetries = message.maxRetries || 3;
    const retryCount = message.retryCount || 0;

    try {
      // Update status to processing
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        'Starting chunking and embedding process',
        10,
      );

      // Get markdown content
      const markdown =
        message.markdownContent ??
        (await (await this.library.getItem(message.itemId))?.getMarkdown());
      if (!markdown) {
        await this.statusUpdater.updateItemStatus(
          message.itemId,
          PdfProcessingStatus.FAILED,
          'Markdown content not found',
        );
        throw new Error(
          `Chunking and embedding failed: markdown content item ${message.itemId} is empty`,
        );
      }

      // Update progress
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        30,
        'Markdown content retrieved, starting chunking',
      );

      // Chunking

      // Create new chunking&embedding group
      const groupStorage = createItemVectorStorage(
        message.itemId,
        message.groupConfig,
        this.embedingService as any,
        this.chunkingService,
      );

      // Update progress
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        50,
        'Starting chunking and embedding process',
      );

      await groupStorage.chunkEmbed(markdown);

      // Update progress
      await this.progressReporter.reportProgress(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        90,
        'Chunking and embedding completed',
      );

      // Update status to completed
      const processingTime = Date.now() - startTime;
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Chunking and embedding completed successfully',
        100,
        undefined,
        processingTime,
      );

      logger.info(
        `Chunking and embedding completed for item ${message.itemId} in ${processingTime}ms`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(
        `Chunking and embedding failed for item ${message.itemId}:`,
        error,
      );

      // Update status to failed
      await this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Chunking and embedding failed: ${(error as Error).message}`,
        undefined,
        (error as Error).message,
        processingTime,
      );

      // Handle retry logic
      if (this.retryHandler.shouldRetry(retryCount, maxRetries)) {
        await this.retryHandler.handleRetry(message, retryCount, maxRetries);
      } else {
        await this.retryHandler.handleFailure(
          message.itemId,
          (error as Error).message,
          retryCount,
          maxRetries,
          processingTime,
        );
      }

      throw error;
    }
  }
}