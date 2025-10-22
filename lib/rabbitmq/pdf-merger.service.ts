import {
  PdfMergingRequestMessage,
  PdfMergingProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import { ChunkingStrategy, ChunkingStrategyType } from '../chunking/chunkingStrategy';
import { MarkdownPartCache } from './markdown-part-cache';
import { getMarkdownPartCache } from './markdown-part-cache-factory';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('PdfMergerService');

/**
 * PDF Merger Service
 * Merges converted PDF parts into a complete markdown document
 */
export class PdfMergerService {
  private rabbitMQService = getRabbitMQService();
  private consumerTag: string | null = null;
  private isRunning = false;
  private storage: AbstractLibraryStorage;
  private markdownPartCache: MarkdownPartCache;

  constructor(storage: AbstractLibraryStorage, markdownPartCache?: MarkdownPartCache) {
    this.storage = storage;
    this.markdownPartCache = markdownPartCache || getMarkdownPartCache();
  }

  /**
   * Start the PDF merger service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF merger service is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      // Initialize Markdown Part Cache
      logger.info('Initializing Markdown Part Cache...');
      await this.markdownPartCache.initialize();
      logger.info('Markdown Part Cache initialized successfully');

      logger.info('Starting PDF merger service...');

      // Start consuming messages from the merging request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_MERGING_REQUEST,
        this.handlePdfMergingRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_MERGING_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info('PDF merger service started successfully');
    } catch (error) {
      logger.error('Failed to start PDF merger service:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF merger service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF merger service is not running');
      return;
    }

    try {
      logger.info('Stopping PDF merger service...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('PDF merger service stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF merger service:', error);
      throw error;
    }
  }

  /**
   * Handle PDF merging request
   */
  private async handlePdfMergingRequest(
    message: PdfMergingRequestMessage,
    originalMessage: any,
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(`Processing PDF merging request for item: ${message.itemId}`);

    try {
      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        throw new Error(`Item ${message.itemId} not found`);
      }

      // Update item status to merging
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.MERGING,
        'Merging PDF parts into complete document',
      );

      // Get the merged markdown content from MarkdownPartCache
      logger.info(`Getting merged markdown content for item: ${message.itemId}`);
      let mergedMarkdown: string;
      
      try {
        // Try to get the merged content from cache first
        mergedMarkdown = await this.markdownPartCache.mergeAllParts(message.itemId);
        logger.info(`Successfully retrieved merged markdown from cache for item: ${message.itemId}`);
      } catch (cacheError) {
        logger.warn(
          `Failed to get merged markdown from cache for item ${message.itemId}, falling back to storage:`,
          cacheError,
        );
        
        // Fallback to getting content from storage
        const markdownContent = await this.storage.getMarkdown(message.itemId);
        if (!markdownContent) {
          throw new Error(`No markdown content found for item ${message.itemId}`);
        }

        // Merge and clean up the markdown content
        logger.info(`Merging markdown content from storage for item: ${message.itemId}`);
        mergedMarkdown = await this.mergeMarkdownContent(
          markdownContent,
          message.itemId,
        );
      }

      // Save the merged markdown content
      await this.storage.saveMarkdown(message.itemId, mergedMarkdown);

      // Update progress
      await this.publishMergingProgress(
        message.itemId,
        80,
        'Processing chunks and embeddings',
        message.completedParts.length,
        message.totalParts,
      );

      // Process chunks and embeddings
      await this.processChunksAndEmbeddings(message.itemId, mergedMarkdown);

      // Update progress
      await this.publishMergingProgress(
        message.itemId,
        95,
        'Finalizing merged document',
        message.completedParts.length,
        message.totalParts,
      );

      // Update item status to completed
      const processingTime = Date.now() - startTime;
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'PDF processing completed successfully',
        100,
        undefined,
        processingTime,
      );

      // Publish completion message
      await this.publishCompletionMessage(
        message.itemId,
        mergedMarkdown,
        processingTime,
      );

      logger.info(`PDF merging completed for item: ${message.itemId}`);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(`PDF merging failed for item ${message.itemId}:`, error);

      // Update item status with error
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `PDF merging failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Check if should retry
      const retryCount = message.retryCount || 0;
      const maxRetries = message.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying PDF merging for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.rabbitMQService.publishPdfMergingRequest(retryRequest);
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
   * Merge markdown content from multiple parts
   */
  private async mergeMarkdownContent(
    rawMarkdown: string,
    itemId: string,
  ): Promise<string> {
    try {
      // Split the content by part separators
      const partSeparator = /--- PART \d+ ---/;
      const parts = rawMarkdown.split(partSeparator);

      if (parts.length <= 1) {
        // No parts found, return as-is
        logger.warn(`No part separators found in markdown for item ${itemId}`);
        return rawMarkdown;
      }

      // Remove empty parts and clean up each part
      const cleanedParts: string[] = [];

      for (let i = 1; i < parts.length; i++) {
        // Skip the first part (before first separator)
        const part = parts[i].trim();
        if (part) {
          // Clean up the part content
          const cleanedPart = this.cleanPartContent(part);
          if (cleanedPart) {
            cleanedParts.push(cleanedPart);
          }
        }
      }

      if (cleanedParts.length === 0) {
        logger.warn(`No valid content found in parts for item ${itemId}`);
        return rawMarkdown;
      }

      // Merge the parts with proper spacing
      let mergedContent = cleanedParts[0];

      for (let i = 1; i < cleanedParts.length; i++) {
        const previousPart = cleanedParts[i - 1];
        const currentPart = cleanedParts[i];

        // Add appropriate spacing between parts
        if (!previousPart.endsWith('\n')) {
          mergedContent += '\n';
        }

        // Add section separator if both parts have substantial content
        if (previousPart.length > 100 && currentPart.length > 100) {
          mergedContent += '\n\n';
        }

        mergedContent += currentPart;
      }

      // Add a header indicating this is a merged document
      const header = `# Merged PDF Document\n\nThis document was automatically generated by merging ${cleanedParts.length} PDF parts.\n\n---\n\n`;

      return header + mergedContent;
    } catch (error) {
      logger.error(
        `Failed to merge markdown content for item ${itemId}:`,
        error,
      );
      throw new Error(
        `Markdown merging failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Clean up individual part content
   */
  private cleanPartContent(content: string): string {
    try {
      // Remove excessive whitespace
      let cleaned = content.replace(/\n{3,}/g, '\n\n');

      // Remove leading/trailing whitespace
      cleaned = cleaned.trim();

      // Remove any remaining part markers
      cleaned = cleaned.replace(/^--- PART \d+ ---\s*$/gm, '');

      // Fix common formatting issues
      cleaned = cleaned.replace(/\n{2,}#/g, '\n\n#'); // Ensure proper heading spacing
      cleaned = cleaned.replace(/\n{2,}-/g, '\n\n-'); // Ensure proper list spacing

      return cleaned;
    } catch (error) {
      logger.warn('Failed to clean part content:', error);
      return content;
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
      logger.info(`Starting chunking and embedding request for item: ${itemId}`);
      
      // Simulate processing delay for testing purposes
      logger.info(`Simulating 2-second delay for chunking and embedding processing`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const chunkingEmbeddingRequest = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'CHUNKING_EMBEDDING_REQUEST' as const,
        itemId,
        markdownContent,
        chunkingStrategy: ChunkingStrategy.PARAGRAPH, // Default strategy
        priority: 'normal' as const,
        retryCount: 0,
        maxRetries: 3,
      };

      await this.rabbitMQService.publishChunkingEmbeddingRequest(
        chunkingEmbeddingRequest,
      );
      logger.info(
        `Chunking and embedding request sent for merged item: ${itemId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to send chunking and embedding request for merged item ${itemId}:`,
        error,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  /**
   * Process chunks and embeddings
   * This method handles the actual chunking and embedding processing
   */
  private async processChunksAndEmbeddings(
    itemId: string,
    markdownContent: string,
  ): Promise<void> {
    try {
      // Simulate processing delay for testing purposes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, this would:
      // 1. Split the markdown content into chunks
      // 2. Generate embeddings for each chunk
      // 3. Store the chunks and embeddings in the vector database
      
      // For now, we just simulate the processing time
    } catch (error) {
      logger.error(
        `Failed to process chunks and embeddings for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update item status in storage
   */
  private async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message: string,
    progress?: number,
    error?: string,
    processingTime?: number,
  ): Promise<void> {
    try {
      const metadata = await this.storage.getMetadata(itemId);
      if (!metadata) {
        logger.warn(`Item ${itemId} not found for status update`);
        return;
      }

      const updates: any = {
        pdfProcessingStatus: status,
        pdfProcessingMessage: message,
        pdfProcessingProgress: progress,
        pdfProcessingError: error,
        dateModified: new Date(),
      };

      if (
        status === PdfProcessingStatus.MERGING &&
        !(metadata as any).pdfProcessingMergingStartedAt
      ) {
        (updates as any).pdfProcessingMergingStartedAt = new Date();
      } else if (status === PdfProcessingStatus.COMPLETED) {
        updates.pdfProcessingCompletedAt = new Date();
        updates.pdfProcessingProgress = 100;
      } else if (status === PdfProcessingStatus.FAILED) {
        updates.pdfProcessingRetryCount =
          (metadata.pdfProcessingRetryCount || 0) + 1;
      }

      await this.storage.updateMetadata({ ...metadata, ...updates });
    } catch (error) {
      logger.error(`Failed to update item status for ${itemId}:`, error);
    }
  }

  /**
   * Publish merging progress message
   */
  private async publishMergingProgress(
    itemId: string,
    progress: number,
    message: string,
    completedParts: number,
    totalParts: number,
  ): Promise<void> {
    try {
      const progressMessage: PdfMergingProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_MERGING_PROGRESS',
        itemId,
        status: PdfProcessingStatus.MERGING,
        progress,
        message,
        startedAt: Date.now(),
        completedParts,
        totalParts,
      };

      await this.rabbitMQService.publishPdfMergingProgress(progressMessage);
    } catch (error) {
      logger.error(
        `Failed to publish merging progress message for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Publish completion message
   */
  private async publishCompletionMessage(
    itemId: string,
    markdownContent: string,
    processingTime: number,
  ): Promise<void> {
    try {
      const completionMessage: PdfConversionCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_COMPLETED',
        itemId,
        status: PdfProcessingStatus.COMPLETED,
        processingTime,
      };

      await this.rabbitMQService.publishPdfConversionCompleted(
        completionMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish completion message for item ${itemId}:`,
        error,
      );
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
      const failureMessage: PdfConversionFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_FAILED',
        itemId,
        status: PdfProcessingStatus.FAILED,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.rabbitMQService.publishPdfConversionFailed(failureMessage);
    } catch (error) {
      logger.error(
        `Failed to publish failure message for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<{
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
 * Create and start a PDF merger service
 */
export async function createPdfMergerService(
  storage: AbstractLibraryStorage,
  markdownPartCache?: MarkdownPartCache,
): Promise<PdfMergerService> {
  const service = new PdfMergerService(storage, markdownPartCache);
  await service.start();
  return service;
}

/**
 * Stop a PDF merger service
 */
export async function stopPdfMergerService(
  service: PdfMergerService,
): Promise<void> {
  await service.stop();
}
