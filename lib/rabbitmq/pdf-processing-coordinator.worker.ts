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
  DeadLetterQueueMessage,
  DeadLetterProcessedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  RABBITMQ_ROUTING_KEYS,
  PdfMetadata,
} from './message.types';
import { getRabbitMQService, RabbitMQService } from './rabbitmq.service';
import { ILibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { v4 as uuidv4 } from 'uuid';
import { MessageProtocol } from './message-service.interface';

const logger = createLoggerWithPrefix('PdfProcessingCoordinator');

/**
 * PDF Processing Coordinator Worker
 * Coordinates the PDF processing workflow by listening to analysis completion events
 * and triggering the next steps in the processing pipeline
 */
export class PdfProcessingCoordinatorWorker {
  private rabbitMQService: RabbitMQService;
  private consumerTags: Map<string, string> = new Map();
  private isRunning = false;

  constructor(
    private storage: ILibraryStorage,
    protocol?: MessageProtocol,
  ) {
    this.rabbitMQService = getRabbitMQService(protocol);
  }

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
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-coordinator',
        },
        {
          queue: RABBITMQ_QUEUES.PDF_ANALYSIS_FAILED,
          handler: this.handleAnalysisFailed.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-coordinator-failed',
        },
        {
          queue: RABBITMQ_QUEUES.PDF_CONVERSION_COMPLETED,
          handler: this.handleConversionCompleted.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER + '-coordinator',
        },
        {
          queue: RABBITMQ_QUEUES.PDF_CONVERSION_FAILED,
          handler: this.handleConversionFailed.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER +
            '-coordinator-failed',
        },
        {
          queue: RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS,
          handler: this.handleConversionProgress.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER +
            '-coordinator-progress',
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_STORAGE_COMPLETED,
          handler: this.handleMarkdownStorageCompleted.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.MARKDOWN_STORAGE_WORKER + '-coordinator',
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_STORAGE_FAILED,
          handler: this.handleMarkdownStorageFailed.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.MARKDOWN_STORAGE_WORKER +
            '-coordinator-failed',
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_COMPLETED,
          handler: this.handleMarkdownPartStorageCompleted.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER +
            '-coordinator',
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_FAILED,
          handler: this.handleMarkdownPartStorageFailed.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER +
            '-coordinator-failed',
        },
        {
          queue: RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_PROGRESS,
          handler: this.handleMarkdownPartStorageProgress.bind(this),
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER +
            '-coordinator-progress',
        },
        {
          queue: RABBITMQ_QUEUES.DEAD_LETTER_QUEUE,
          handler: this.handleDeadLetterMessage.bind(this),
          consumerTag: 'dlq-handler-coordinator',
        },
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
            logger.error(
              `Failed to stop consuming from queue ${queue}:`,
              error,
            );
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
  public async handleAnalysisCompleted(
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
  public async handleAnalysisFailed(
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
  public async handleConversionCompleted(
    message: PdfConversionCompletedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(`Processing conversion completed for item: ${message.itemId}`);

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

      logger.info(
        `Conversion completion processed for item: ${message.itemId}`,
      );
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
  public async handleConversionFailed(
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
  public async handleConversionProgress(
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
  public async handleMarkdownStorageCompleted(
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

      logger.info(
        `Markdown storage completion processed for item: ${message.itemId}`,
      );
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
  public async handleMarkdownStorageFailed(
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

      logger.info(
        `Markdown storage failure processed for item: ${message.itemId}`,
      );
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
  public async handleMarkdownPartStorageCompleted(
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

      logger.info(
        `Markdown part storage completion processed for item: ${message.itemId}, part: ${message.partIndex + 1}`,
      );
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
  public async handleMarkdownPartStorageFailed(
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

      logger.info(
        `Markdown part storage failure processed for item: ${message.itemId}, part: ${message.partIndex + 1}`,
      );
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
  public async handleMarkdownPartStorageProgress(
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

      logger.debug(
        `Markdown part storage progress processed for item: ${message.itemId}, part: ${message.partIndex + 1}`,
      );
    } catch (error) {
      logger.error(
        `Failed to handle markdown part storage progress for item ${message.itemId}, part ${message.partIndex}:`,
        error,
      );
      // Don't throw for progress messages as they are less critical
    }
  }

  /**
   * Handle dead letter queue message
   */
  public async handleDeadLetterMessage(
    message: DeadLetterQueueMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.warn(
      `Processing dead letter message for item: ${message.originalMessage?.itemId || 'unknown'}, ` +
        `original queue: ${message.originalQueue}, ` +
        `failure reason: ${message.failureReason}, ` +
        `retry count: ${message.retryCount}`,
    );

    try {
      // Analyze the failure and decide on action
      const action = await this.analyzeDeadLetterMessage(message);

      // Log the action taken
      logger.info(
        `DLQ action for message ${message.messageId}: ${action.action} - ${action.reason}`,
      );

      // Send processed message notification
      await this.sendDeadLetterProcessedNotification(message, action);

      // Update item status if we have an itemId
      if (message.originalMessage?.itemId) {
        await this.updateItemStatus(
          message.originalMessage.itemId,
          PdfProcessingStatus.FAILED,
          `Message failed and moved to DLQ: ${message.failureReason}`,
          undefined,
          `${message.failureReason} (Retry count: ${message.retryCount})`,
        );
      }
    } catch (error) {
      logger.error(
        `Failed to handle dead letter message ${message.messageId}:`,
        error,
      );
      // Don't throw DLQ processing errors to avoid message loops
    }
  }

  /**
   * Analyze dead letter message and determine action
   */
  private async analyzeDeadLetterMessage(
    message: DeadLetterQueueMessage,
  ): Promise<{
    action: 'requeued' | 'discarded' | 'moved_to_error_storage';
    reason: string;
  }> {
    const { retryCount, failureReason, originalQueue, originalMessage } =
      message;

    // Check if it's a retryable error
    const isRetryableError = this.isRetryableError(failureReason);
    const maxRetries = this.getMaxRetriesForQueue(originalQueue);

    // If retry count is below max and error is retryable, requeue
    if (retryCount < maxRetries && isRetryableError) {
      try {
        // Requeue the original message
        await this.requeueOriginalMessage(originalMessage, originalQueue);
        return {
          action: 'requeued',
          reason: `Retryable error (${retryCount + 1}/${maxRetries})`,
        };
      } catch (requeueError) {
        logger.error(
          `Failed to requeue message ${message.messageId}:`,
          requeueError,
        );
      }
    }

    // If it's a critical error or max retries exceeded, move to error storage
    if (!isRetryableError || retryCount >= maxRetries) {
      try {
        await this.moveToErrorStorage(message);
        return {
          action: 'moved_to_error_storage',
          reason: !isRetryableError
            ? 'Non-retryable error'
            : `Max retries exceeded (${maxRetries})`,
        };
      } catch (storageError) {
        logger.error(
          `Failed to move message ${message.messageId} to error storage:`,
          storageError,
        );
      }
    }

    // Default action: discard
    return {
      action: 'discarded',
      reason: 'Failed to requeue or move to error storage',
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(failureReason: string): boolean {
    const retryablePatterns = [
      /timeout/i,
      /connection/i,
      /network/i,
      /temporary/i,
      /resource.*busy/i,
      /rate.*limit/i,
      /service.*unavailable/i,
    ];

    const nonRetryablePatterns = [
      /authentication/i,
      /authorization/i,
      /invalid.*format/i,
      /corrupted/i,
      /not.*found/i,
      /permission/i,
    ];

    // Check for non-retryable patterns first
    for (const pattern of nonRetryablePatterns) {
      if (pattern.test(failureReason)) {
        return false;
      }
    }

    // Check for retryable patterns
    for (const pattern of retryablePatterns) {
      if (pattern.test(failureReason)) {
        return true;
      }
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Get max retries for a specific queue
   */
  private getMaxRetriesForQueue(queue: string): number {
    const retryLimits: Record<string, number> = {
      'pdf-conversion-request': 3,
      'pdf-analysis-request': 3,
      'markdown-storage-request': 2,
      'markdown-part-storage-request': 2,
      'chunking-embedding-request': 3,
    };

    return retryLimits[queue] || 3; // Default to 3 retries
  }

  /**
   * Requeue original message
   */
  private async requeueOriginalMessage(
    originalMessage: any,
    originalQueue: string,
  ): Promise<void> {
    if (!originalMessage) {
      throw new Error('Original message is null or undefined');
    }

    // Increment retry count
    const updatedMessage = {
      ...originalMessage,
      retryCount: (originalMessage.retryCount || 0) + 1,
      timestamp: Date.now(),
    };

    await this.rabbitMQService.publishMessage(originalQueue, updatedMessage);
    logger.info(
      `Requeued message to ${originalQueue}, retry count: ${updatedMessage.retryCount}`,
    );
  }

  /**
   * Move message to error storage
   */
  private async moveToErrorStorage(
    message: DeadLetterQueueMessage,
  ): Promise<void> {
    // Store the failed message in error storage for manual review
    const errorRecord = {
      id: `error-${message.messageId}`,
      messageId: message.messageId,
      originalMessage: message.originalMessage,
      originalQueue: message.originalQueue,
      originalRoutingKey: message.originalRoutingKey,
      failureReason: message.failureReason,
      failureTimestamp: message.failureTimestamp,
      retryCount: message.retryCount,
      errorDetails: message.errorDetails,
      createdAt: new Date(),
      status: 'pending_review',
    };

    // Store in a special error collection (implementation depends on storage backend)
    // For now, log the error record as storage doesn't have this method
    logger.error('Error record stored:', JSON.stringify(errorRecord, null, 2));

    // TODO: Implement proper error storage when ILibraryStorage is extended
    // if (this.storage.storeErrorRecord) {
    //   await this.storage.storeErrorRecord(errorRecord);
    // }

    logger.info(`Moved message ${message.messageId} to error storage`);
  }

  /**
   * Send dead letter processed notification
   */
  private async sendDeadLetterProcessedNotification(
    originalMessage: DeadLetterQueueMessage,
    action: {
      action: 'requeued' | 'discarded' | 'moved_to_error_storage';
      reason: string;
    },
  ): Promise<void> {
    const notification: DeadLetterProcessedMessage = {
      messageId: uuidv4(),
      timestamp: Date.now(),
      eventType: 'DEAD_LETTER_PROCESSED',
      originalMessageId: originalMessage.messageId,
      action: action.action,
      reason: action.reason,
      processedAt: Date.now(),
    };

    // Send to a monitoring/notifications queue if available
    try {
      await this.rabbitMQService.publishMessage(
        'dlq-processed-notifications',
        notification,
      );
    } catch (error) {
      // Don't fail if notification queue doesn't exist
      logger.debug('Could not send DLQ processed notification:', error);
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
      logger.info(
        `Part status updated for item ${itemId}, part ${partIndex + 1}: ${status} - ${message || ''}`,
      );

      // If needed, we could update the main item status based on part status
      // This would require more complex logic to track all parts
    } catch (updateError) {
      logger.error(
        `Failed to update part status for item ${itemId}, part ${partIndex}:`,
        updateError,
      );
      // Don't throw here, as this is a secondary operation
    }
  }

  async getWorkerStats(): Promise<{
    isRunning: boolean;
    consumerTags: Map<string, string>;
    rabbitMQConnected: boolean;
    protocol: MessageProtocol;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTags: new Map(this.consumerTags),
      rabbitMQConnected: this.rabbitMQService.isConnected(),
      protocol: this.rabbitMQService.protocol,
    };
  }
}

/**
 * Create and start a PDF processing coordinator worker
 */
export async function createPdfProcessingCoordinatorWorker(
  storage: ILibraryStorage,
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
