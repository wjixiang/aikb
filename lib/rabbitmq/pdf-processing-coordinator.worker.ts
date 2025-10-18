import {
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfConversionRequestMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfConversionProgressMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  MarkdownPartStorageProgressMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  PdfMetadata,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('PdfProcessingCoordinator');

/**
 * PDF Processing Coordinator Worker
 * Coordinates the PDF processing workflow by listening to analysis completion events
 * and triggering the next steps in the processing pipeline
 */
export class PdfProcessingCoordinatorWorker {
  private rabbitMQService = getRabbitMQService();
  private consumerTags: Map<string, string> = new Map();
  private isRunning = false;

  constructor(private storage: AbstractLibraryStorage) {}

  /**
   * Start the PDF processing coordinator worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF processing coordinator worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF processing coordinator worker...');

      // Start consuming messages from all PDF processing related queues
      const queuesToConsume = [
        {
          queue: RABBITMQ_QUEUES.PDF_ANALYSIS_COMPLETED,
          handler: this.handleAnalysisCompleted.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-coordinator'
        },
        {
          queue: RABBITMQ_QUEUES.PDF_ANALYSIS_FAILED,
          handler: this.handleAnalysisFailed.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-coordinator-failed'
        },
        {
          queue: RABBITMQ_QUEUES.PDF_CONVERSION_COMPLETED,
          handler: this.handleConversionCompleted.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER + '-coordinator'
        },
        {
          queue: RABBITMQ_QUEUES.PDF_CONVERSION_FAILED,
          handler: this.handleConversionFailed.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER + '-coordinator-failed'
        },
        {
          queue: RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS,
          handler: this.handleConversionProgress.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER + '-coordinator-progress'
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_STORAGE_COMPLETED,
          handler: this.handleMarkdownStorageCompleted.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_STORAGE_WORKER + '-coordinator'
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_STORAGE_FAILED,
          handler: this.handleMarkdownStorageFailed.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_STORAGE_WORKER + '-coordinator-failed'
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_COMPLETED,
          handler: this.handleMarkdownPartStorageCompleted.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER + '-coordinator'
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_FAILED,
          handler: this.handleMarkdownPartStorageFailed.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER + '-coordinator-failed'
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_PROGRESS,
          handler: this.handleMarkdownPartStorageProgress.bind(this),
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER + '-coordinator-progress'
        }
      ];

      for (const { queue, handler, consumerTag } of queuesToConsume) {
        try {
          const tag = await this.rabbitMQService.consumeMessages(
            queue,
            handler,
            {
              consumerTag,
              noAck: false, // Manual acknowledgment
            },
          );
          this.consumerTags.set(queue, tag);
          logger.info(`Started consuming from queue: ${queue}`);
        } catch (error) {
          logger.error(`Failed to start consuming from queue ${queue}:`, error);
          // Continue with other queues even if one fails
        }
      }

      this.isRunning = true;
      logger.info('PDF processing coordinator worker started successfully');
    } catch (error) {
      logger.error('Failed to start PDF processing coordinator worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF processing coordinator worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF processing coordinator worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF processing coordinator worker...');

      // Stop consuming from all queues
      for (const [queue, consumerTag] of this.consumerTags.entries()) {
        if (consumerTag) {
          try {
            await this.rabbitMQService.stopConsuming(consumerTag);
            logger.info(`Stopped consuming from queue: ${queue}`);
          } catch (error) {
            logger.error(`Failed to stop consuming from queue ${queue}:`, error);
          }
        }
      }
      this.consumerTags.clear();

      this.isRunning = false;
      logger.info('PDF processing coordinator worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF processing coordinator worker:', error);
      throw error;
    }
  }

  /**
   * Handle PDF analysis completed message
   */
  private async handleAnalysisCompleted(
    message: PdfAnalysisCompletedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing analysis completed for item: ${message.itemId}, requires splitting: ${message.requiresSplitting}`,
    );

    try {
      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);

      // Get Item directly
      if (!itemMetadata?.s3Key)
        throw new Error(
          `s3 key not found for library item: ${itemMetadata?.id}`,
        );

      // We no longer pass s3Url, consumers will generate it from s3Key

      if (!itemMetadata) {
        logger.error(`Item ${message.itemId} not found`);
        return;
      }

      // Check if the PDF was split and use the split parts for conversion
      if (message.requiresSplitting && itemMetadata.pdfSplittingInfo) {
        logger.info(
          `PDF was split for item ${message.itemId}, using split parts for conversion`,
        );

        // The split parts conversion requests are already published by the analyzer service
        // We just need to update the status to indicate the parts are being processed
        await this.storage.updateMetadata({
          ...itemMetadata,
          pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
          pdfProcessingMessage: 'PDF split parts conversion in progress',
          dateModified: new Date(),
        });

        logger.info(
          `Split parts conversion initiated for item: ${message.itemId}`,
        );
      } else {
        // Send PDF conversion request for the whole PDF (no splitting needed)
        logger.info(
          `Sending PDF conversion request for non-split item: ${message.itemId}`,
        );

        const conversionRequest: PdfConversionRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_CONVERSION_REQUEST',
          itemId: message.itemId,
          s3Key: itemMetadata.s3Key!,
          fileName: itemMetadata.s3Key!.split('/').pop() || 'document.pdf',
          metadata: {
            title: itemMetadata.title,
            authors: itemMetadata.authors,
            tags: itemMetadata.tags,
            collections: itemMetadata.collections,
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
          pdfMetadata: message.pdfMetadata, // Pass along PDF metadata from analysis
        };

        await this.rabbitMQService.publishPdfConversionRequest(
          conversionRequest,
        );
        logger.info(
          `PDF conversion request sent for item: ${message.itemId} with s3Key: ${itemMetadata.s3Key}`,
        );

        // Update item status
        await this.storage.updateMetadata({
          ...itemMetadata,
          pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
          pdfProcessingMessage: 'PDF conversion in progress',
          dateModified: new Date(),
        });
      }
    } catch (error) {
      logger.error(
        `Failed to handle analysis completed for item ${message.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle PDF analysis failed message
   */
  private async handleAnalysisFailed(
    message: PdfAnalysisFailedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing analysis failed for item: ${message.itemId}, error: ${message.error}`,
    );

    try {
      // Update item status to failed
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `PDF analysis failed: ${message.error}`,
        undefined,
        message.error,
      );

      logger.info(`Analysis failure processed for item: ${message.itemId}`);
    } catch (error) {
      logger.error(
        `Failed to handle analysis failed for item ${message.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle PDF conversion completed message
   */
  private async handleConversionCompleted(
    message: PdfConversionCompletedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing conversion completed for item: ${message.itemId}`,
    );

    try {
      // Update item status to completed
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'PDF conversion completed successfully',
        100,
        undefined,
        message.processingTime,
      );

      logger.info(`Conversion completion processed for item: ${message.itemId}`);
    } catch (error) {
      logger.error(
        `Failed to handle conversion completed for item ${message.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle PDF conversion failed message
   */
  private async handleConversionFailed(
    message: PdfConversionFailedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing conversion failed for item: ${message.itemId}, error: ${message.error}`,
    );

    try {
      // Update item status to failed
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `PDF conversion failed: ${message.error}`,
        undefined,
        message.error,
      );

      logger.info(`Conversion failure processed for item: ${message.itemId}`);
    } catch (error) {
      logger.error(
        `Failed to handle conversion failed for item ${message.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle PDF conversion progress message
   */
  private async handleConversionProgress(
    message: PdfConversionProgressMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.debug(
      `Processing conversion progress for item: ${message.itemId}, status: ${message.status}, progress: ${message.progress}%`,
    );

    try {
      // Update item status and progress
      await this.updateItemStatus(
        message.itemId,
        message.status,
        message.message,
        message.progress,
        message.error,
      );

      logger.debug(`Conversion progress processed for item: ${message.itemId}`);
    } catch (error) {
      logger.error(
        `Failed to handle conversion progress for item ${message.itemId}:`,
        error,
      );
      // Don't throw for progress messages as they are less critical
    }
  }

  /**
   * Handle markdown storage completed message
   */
  private async handleMarkdownStorageCompleted(
    message: MarkdownStorageCompletedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing markdown storage completed for item: ${message.itemId}`,
    );

    try {
      // Update item status to completed
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.COMPLETED,
        'Markdown storage completed successfully',
        100,
        undefined,
        message.processingTime,
      );

      logger.info(`Markdown storage completion processed for item: ${message.itemId}`);
    } catch (error) {
      logger.error(
        `Failed to handle markdown storage completed for item ${message.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle markdown storage failed message
   */
  private async handleMarkdownStorageFailed(
    message: MarkdownStorageFailedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing markdown storage failed for item: ${message.itemId}, error: ${message.error}`,
    );

    try {
      // Update item status to failed
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `Markdown storage failed: ${message.error}`,
        undefined,
        message.error,
      );

      logger.info(`Markdown storage failure processed for item: ${message.itemId}`);
    } catch (error) {
      logger.error(
        `Failed to handle markdown storage failed for item ${message.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle markdown part storage completed message
   */
  private async handleMarkdownPartStorageCompleted(
    message: MarkdownPartStorageCompletedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing markdown part storage completed for item: ${message.itemId}, part: ${message.partIndex + 1}/${message.totalParts}`,
    );

    try {
      // Update part-specific status
      await this.updatePartStatus(
        message.itemId,
        message.partIndex,
        PdfProcessingStatus.COMPLETED,
        `Part ${message.partIndex + 1} storage completed successfully`,
      );

      logger.info(`Markdown part storage completion processed for item: ${message.itemId}, part: ${message.partIndex + 1}`);
    } catch (error) {
      logger.error(
        `Failed to handle markdown part storage completed for item ${message.itemId}, part ${message.partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle markdown part storage failed message
   */
  private async handleMarkdownPartStorageFailed(
    message: MarkdownPartStorageFailedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing markdown part storage failed for item: ${message.itemId}, part: ${message.partIndex + 1}/${message.totalParts}, error: ${message.error}`,
    );

    try {
      // Update part-specific status
      await this.updatePartStatus(
        message.itemId,
        message.partIndex,
        PdfProcessingStatus.FAILED,
        `Part ${message.partIndex + 1} storage failed: ${message.error}`,
        message.error,
      );

      logger.info(`Markdown part storage failure processed for item: ${message.itemId}, part: ${message.partIndex + 1}`);
    } catch (error) {
      logger.error(
        `Failed to handle markdown part storage failed for item ${message.itemId}, part ${message.partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Handle markdown part storage progress message
   */
  private async handleMarkdownPartStorageProgress(
    message: MarkdownPartStorageProgressMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.debug(
      `Processing markdown part storage progress for item: ${message.itemId}, part: ${message.partIndex + 1}/${message.totalParts}, status: ${message.status}, progress: ${message.progress}%`,
    );

    try {
      // Update part-specific status and progress
      await this.updatePartStatus(
        message.itemId,
        message.partIndex,
        message.status,
        `Part ${message.partIndex + 1}: ${message.message || 'Processing'}`,
        message.error,
      );

      logger.debug(`Markdown part storage progress processed for item: ${message.itemId}, part: ${message.partIndex + 1}`);
    } catch (error) {
      logger.error(
        `Failed to handle markdown part storage progress for item ${message.itemId}, part ${message.partIndex}:`,
        error,
      );
      // Don't throw for progress messages as they are less critical
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
   * Update part status in storage
   */
  private async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: PdfProcessingStatus,
    message?: string,
    error?: string,
  ): Promise<void> {
    try {
      // For now, we'll just log the part status update
      // In a full implementation, this would update part-specific tracking
      logger.info(`Part status updated for item ${itemId}, part ${partIndex + 1}: ${status} - ${message || ''}`);
      
      // If needed, we could update the main item status based on part status
      // This would require more complex logic to track all parts
    } catch (updateError) {
      logger.error(`Failed to update part status for item ${itemId}, part ${partIndex}:`, updateError);
      // Don't throw here, as this is a secondary operation
    }
  }

  async getWorkerStats(): Promise<{
    isRunning: boolean;
    consumerTags: Map<string, string>;
    rabbitMQConnected: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTags: new Map(this.consumerTags),
      rabbitMQConnected: this.rabbitMQService.isConnected(),
    };
  }
}

/**
 * Create and start a PDF processing coordinator worker
 */
export async function createPdfProcessingCoordinatorWorker(
  storage: AbstractLibraryStorage,
): Promise<PdfProcessingCoordinatorWorker> {
  const worker = new PdfProcessingCoordinatorWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF processing coordinator worker
 */
export async function stopPdfProcessingCoordinatorWorker(
  worker: PdfProcessingCoordinatorWorker,
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
      const worker = await createPdfProcessingCoordinatorWorker(storage);
      logger.info('PDF Processing Coordinator Worker started successfully');

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
        'PDF Processing Coordinator Worker is running. Press Ctrl+C to stop.',
      );
    } catch (error) {
      logger.error('Failed to start PDF Processing Coordinator Worker:', error);
      process.exit(1);
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
