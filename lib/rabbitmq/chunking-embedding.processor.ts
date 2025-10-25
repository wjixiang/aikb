import {
  ChunkingEmbeddingRequestMessage,
  PdfProcessingStatus,
} from './message.types';
import {
  AbstractLibraryStorage,
  ItemChunk,
} from '../../knowledgeBase/knowledgeImport/library';
import Library from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingStrategy } from '../chunking/chunkingStrategy';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { createItemVectorStorage } from 'knowledgeBase/knowledgeImport/elasticsearch-item-vector-storage';
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
    private library: Library,
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
    // Get markdown content
    const markdown =
      message.markdownContent ??
      (await (await this.library.getItem(message.itemId))?.getMarkdown());
    if (!markdown) {
      this.statusUpdater.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        '',
      );
      throw new Error(
        `Chunking and embedding failed: markdown content item ${message.itemId} is empty`,
      );
    }

    // Chunking

    // Create new chunking&embedding group
    const groupStorage = createItemVectorStorage(
      message.itemId,
      message.groupConfig,
      this.embedingService,
      this.chunkingService,
    );
    await groupStorage.chunkEmbed(markdown);
  }
}
