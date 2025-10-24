import {
  MarkdownPartStorageRequestMessage,
  MarkdownPartStorageProgressMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  PdfProcessingStatus,
  PdfPartStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  PdfMergingRequestMessage,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { MessageProtocol } from './message-service.interface';
import { MarkdownPartCache } from './markdown-part-cache';
import { getMarkdownPartCache } from './markdown-part-cache-factory';
import { IPdfPartTracker } from './pdf-part-tracker';
import { getPdfPartTracker } from './pdf-part-tracker-factory';
import createLoggerWithPrefix from 'lib/logManagement/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('MarkdownPartStorageWorker');

/**
 * Markdown Part Storage Worker
 * Processes markdown part storage requests from RabbitMQ queue
 */
export class MarkdownPartStorageWorker {
  private rabbitMQService;
  private consumerTag: string | null = null;
  private isRunning = false;
  private markdownPartCache: MarkdownPartCache;
  private partTracker: IPdfPartTracker;

  constructor(
    markdownPartCache?: MarkdownPartCache,
    partTracker?: IPdfPartTracker,
    protocol?: MessageProtocol,
  ) {
    this.markdownPartCache = markdownPartCache || getMarkdownPartCache();
    this.partTracker = partTracker || getPdfPartTracker();
    this.rabbitMQService = getRabbitMQService(protocol);
  }

  /**
   * Start the markdown part storage worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Markdown part storage worker is already running');
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

      logger.info('Starting markdown part storage worker...');

      // Start consuming messages from the request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_REQUEST,
        this.handleMarkdownPartStorageRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_PART_STORAGE_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info('Markdown part storage worker started successfully');
    } catch (error) {
      logger.error('Failed to start markdown part storage worker:', error);
      throw error;
    }
  }

  /**
   * Stop the markdown part storage worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Markdown part storage worker is not running');
      return;
    }

    try {
      logger.info('Stopping markdown part storage worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('Markdown part storage worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop markdown part storage worker:', error);
      throw error;
    }
  }

  /**
   * Handle markdown part storage request
   */
  async handleMarkdownPartStorageRequest(
    message: MarkdownPartStorageRequestMessage,
    originalMessage: any,
  ): Promise<void> {
    const startTime = Date.now();
    logger.debug(
      `[DEBUG] handleMarkdownPartStorageRequest START: itemId=${message.itemId}, partIndex=${message.partIndex}`,
    );
    logger.info(
      `Processing markdown part storage request for item: ${message.itemId}, part: ${message.partIndex + 1}/${message.totalParts}`,
    );

    // Check retry status before processing
    const retryCount = message.retryCount || 0;
    const maxRetries = message.maxRetries || 3;
    const isFinalAttempt = retryCount >= maxRetries;

    if (isFinalAttempt) {
      logger.info(
        `Processing final attempt for item ${message.itemId}, part ${message.partIndex + 1} (retryCount: ${retryCount}, maxRetries: ${maxRetries})`,
      );
    }
    try {
      // Initialize PDF processing if not already done
      logger.debug(
        `[DEBUG] About to call getPdfProcessingStatus for itemId=${message.itemId}, partIndex=${message.partIndex}`,
      );
      logger.debug(`Initialize PDF processing if not already done`);
      const processingStatus = await this.partTracker.getPdfProcessingStatus(
        message.itemId,
      );
      logger.debug(
        `[DEBUG] getPdfProcessingStatus returned for itemId=${message.itemId}, partIndex=${message.partIndex}, result:`,
        processingStatus,
      );
      if (!processingStatus) {
        logger.info(
          `[WORKER-${message.partIndex}] Initializing PDF processing for item ${message.itemId}`,
        );
        logger.debug(
          `[DEBUG] [WORKER-${message.partIndex}] About to call initializePdfProcessing for itemId=${message.itemId}`,
        );
        await this.partTracker.initializePdfProcessing(
          message.itemId,
          message.totalParts,
        );
        logger.debug(
          `[DEBUG] [WORKER-${message.partIndex}] initializePdfProcessing completed for itemId=${message.itemId}`,
        );
      } else {
        logger.info(
          `[WORKER-${message.partIndex}] PDF processing already exists for item ${message.itemId}`,
        );
      }

      // Update part status to processing
      logger.debug(`Update part status to processing`);
      await this.updatePartStatus(
        message.itemId,
        message.partIndex,
        PdfProcessingStatus.PROCESSING,
        10,
        'Starting markdown part storage',
      );

      // Publish progress
      await this.publishProgressMessage(
        message.itemId,
        message.partIndex,
        message.totalParts,
        PdfProcessingStatus.PROCESSING,
        20,
        'Validating markdown content',
      );

      // Validate markdown content
      if (
        !message.markdownContent ||
        message.markdownContent.trim().length === 0
      ) {
        throw new Error('Markdown content is empty or invalid');
      }

      // Publish progress
      await this.publishProgressMessage(
        message.itemId,
        message.partIndex,
        message.totalParts,
        PdfProcessingStatus.PROCESSING,
        40,
        'Storing markdown part in cache',
      );

      // Store the markdown part in cache
      await this.markdownPartCache.storePartMarkdown(
        message.itemId,
        message.partIndex,
        message.markdownContent,
      );

      // Publish progress
      await this.publishProgressMessage(
        message.itemId,
        message.partIndex,
        message.totalParts,
        PdfProcessingStatus.PROCESSING,
        60,
        'Updating part status',
      );

      // Update part status in tracker
      try {
        await this.partTracker.updatePartStatus(
          message.itemId,
          message.partIndex,
          PdfPartStatus.COMPLETED,
        );
      } catch (trackerError) {
        logger.warn(
          `Failed to update part status in tracker for item ${message.itemId}, part ${message.partIndex}:`,
          trackerError,
        );
        // Continue processing even if tracker fails
      }

      // Update part status in cache
      await this.markdownPartCache.updatePartStatus(
        message.itemId,
        message.partIndex,
        'completed',
      );

      // Publish progress
      await this.publishProgressMessage(
        message.itemId,
        message.partIndex,
        message.totalParts,
        PdfProcessingStatus.PROCESSING,
        80,
        'Checking for merge readiness',
      );

      // Check if all parts are completed and trigger merging if needed
      logger.debug(
        `Check if all parts are completed and trigger merging if needed`,
      );
      await this.checkAndTriggerMerging(message.itemId, message.totalParts);

      // Publish progress
      await this.publishProgressMessage(
        message.itemId,
        message.partIndex,
        message.totalParts,
        PdfProcessingStatus.PROCESSING,
        90,
        'Finalizing storage',
      );

      // Publish completion message
      const processingTime = Date.now() - startTime;
      logger.debug(
        `[DEBUG] About to publish completion message for itemId=${message.itemId}, partIndex=${message.partIndex}`,
      );
      await this.publishCompletionMessage(
        message.itemId,
        message.partIndex,
        message.totalParts,
        processingTime,
        message.markdownContent.length,
      );
      logger.debug(`[DEBUG] Completion message published successfully`);

      // Update part status to completed
      await this.updatePartStatus(
        message.itemId,
        message.partIndex,
        PdfProcessingStatus.COMPLETED,
        100,
        'Markdown part storage completed successfully',
      );

      logger.info(
        `Markdown part storage completed for item: ${message.itemId}, part: ${message.partIndex + 1}`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `Markdown part storage failed for item ${message.itemId}, part ${message.partIndex + 1}:`,
        error,
      );

      // Update part status with error
      await this.updatePartStatus(
        message.itemId,
        message.partIndex,
        PdfProcessingStatus.FAILED,
        0,
        `Markdown part storage failed: ${errorMessage}`,
      );

      // Update part status in tracker
      try {
        await this.partTracker.updatePartStatus(
          message.itemId,
          message.partIndex,
          PdfPartStatus.FAILED,
          errorMessage,
        );
      } catch (trackerError) {
        console.log(`[DEBUG] Tracker error during failure:`, trackerError);
        logger.warn(
          `Failed to update part status in tracker for item ${message.itemId}, part ${message.partIndex}:`,
          trackerError,
        );
        // Continue processing even if tracker fails
      }

      // Update part status in cache
      try {
        console.log(
          `[DEBUG] About to update part status to 'failed' for itemId=${message.itemId}, partIndex=${message.partIndex}`,
        );
        await this.markdownPartCache.updatePartStatus(
          message.itemId,
          message.partIndex,
          'failed',
        );
        console.log(`[DEBUG] Part status updated to 'failed' successfully`);
      } catch (statusUpdateError) {
        console.log(
          `[DEBUG] Failed to update part status to 'failed':`,
          statusUpdateError,
        );
        logger.warn(
          `Failed to update failed status for markdown part ${message.partIndex + 1} for item ${message.itemId} in cache:`,
          statusUpdateError,
        );
      }

      // Check if should retry
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying markdown part storage for item ${message.itemId}, part ${message.partIndex + 1} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Publish failure message for this attempt before retrying
        logger.debug(
          `[DEBUG] About to publish failure message for itemId=${message.itemId}, partIndex=${message.partIndex}`,
        );
        await this.publishFailureMessage(
          message.itemId,
          message.partIndex,
          message.totalParts,
          errorMessage,
          retryCount + 1, // Use incremented retry count for failure message
          maxRetries,
          processingTime,
        );
        logger.debug(`[DEBUG] Failure message published successfully`);

        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        logger.debug(
          `[DEBUG] About to publish retry request for itemId=${message.itemId}, partIndex=${message.partIndex}`,
        );
        await this.rabbitMQService.publishMarkdownPartStorageRequest(
          retryRequest,
        );
        logger.debug(`[DEBUG] Retry request published successfully`);
      } else {
        // Final failure - publish failure message
        logger.debug(
          `[DEBUG] About to publish final failure message for itemId=${message.itemId}, partIndex=${message.partIndex}`,
        );
        await this.publishFailureMessage(
          message.itemId,
          message.partIndex,
          message.totalParts,
          errorMessage,
          retryCount,
          maxRetries,
          processingTime,
        );
        logger.debug(`[DEBUG] Final failure message published successfully`);
      }
    }
  }

  /**
   * Check if all parts are completed and trigger merging if needed
   */
  private async checkAndTriggerMerging(
    itemId: string,
    totalParts: number,
    retryCount: number = 0,
  ): Promise<void> {
    const maxRetries = 5;
    const baseDelayMs = 1000; // 1 second base delay
    try {
      logger.info(
        `Checking if all parts are completed for item ${itemId} (attempt ${retryCount + 1}/${maxRetries})`,
      );

      // Get all parts from MarkdownPartCache to check their status
      const allParts = await this.markdownPartCache.getAllParts(itemId);
      logger.info(`Found ${allParts.length} parts in cache for item ${itemId}`);

      // Check if we have all parts
      if (allParts.length < totalParts) {
        logger.info(
          `Not all parts are available yet for item ${itemId}. Have ${allParts.length}/${totalParts} parts. Continuing to wait...`,
        );

        // Retry if we haven't reached max retries
        if (retryCount < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, retryCount);
          setTimeout(() => {
            this.checkAndTriggerMerging(itemId, totalParts, retryCount + 1);
          }, delayMs);
        } else {
          logger.error(
            `Max retries reached for item ${itemId}. Still missing ${totalParts - allParts.length} parts.`,
          );
        }
        return;
      }

      // Check if all parts are completed by checking their status in the cache
      let completedCount = 0;
      let failedCount = 0;

      for (const part of allParts) {
        try {
          const status = await this.markdownPartCache.getPartStatus(
            itemId,
            part.partIndex,
          );
          if (status === 'completed') {
            completedCount++;
          } else if (status === 'failed') {
            failedCount++;
          }
        } catch (statusError) {
          logger.warn(
            `Failed to get status for part ${part.partIndex} of item ${itemId}:`,
            statusError,
          );
        }
      }

      logger.info(
        `Part status summary for item ${itemId}: ${completedCount} completed, ${failedCount} failed, ${allParts.length - completedCount - failedCount} pending`,
      );

      // If all parts are completed, trigger merging
      if (completedCount === totalParts) {
        logger.info(
          `All parts completed for item ${itemId}, triggering merging`,
        );

        try {
          // Merge all parts using MarkdownPartCache
          const mergedMarkdown =
            await this.markdownPartCache.mergeAllParts(itemId);
          logger.info(
            `Successfully merged ${allParts.length} parts for item ${itemId}. Merged content length: ${mergedMarkdown.length}`,
          );

          // Create and publish merging request
          const mergingRequest: PdfMergingRequestMessage = {
            messageId: uuidv4(),
            timestamp: Date.now(),
            eventType: 'PDF_MERGING_REQUEST',
            itemId,
            totalParts,
            completedParts: allParts.map((part) => part.partIndex),
            priority: 'normal',
          };

          await this.rabbitMQService.publishPdfMergingRequest(mergingRequest);
          logger.info(
            `Published merging request for item ${itemId} with ${allParts.length} parts`,
          );

          // Store the merged markdown content for later use by the merger service
          // The merger service can retrieve it from the cache using the itemId
          logger.info(
            `Merged markdown content is available in cache for item ${itemId}`,
          );
        } catch (mergeError) {
          logger.error(`Failed to merge parts for item ${itemId}:`, mergeError);
          throw mergeError;
        }
      } else if (
        failedCount > 0 &&
        completedCount + failedCount === totalParts
      ) {
        // All parts have been processed but some failed
        logger.error(
          `Processing completed for item ${itemId} but ${failedCount} parts failed. Merging not possible.`,
        );

        // Here you could publish a failure message or trigger a different workflow
        // For now, we'll just log the error
      } else {
        logger.info(
          `Not all parts are completed yet for item ${itemId}. ${completedCount}/${totalParts} completed. Continuing to wait...`,
        );

        // Retry if we haven't reached max retries
        if (retryCount < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, retryCount);
          logger.debug(
            `[DEBUG] Retrying checkAndTriggerMerging in ${delayMs}ms for itemId=${itemId}`,
          );
          setTimeout(() => {
            this.checkAndTriggerMerging(itemId, totalParts, retryCount + 1);
          }, delayMs);
        } else {
          logger.error(
            `Max retries reached for item ${itemId}. Only ${completedCount}/${totalParts} parts completed.`,
          );
        }
      }
    } catch (error) {
      logger.debug(
        `[DEBUG] Exception in checkAndTriggerMerging for itemId=${itemId}:`,
        error,
      );
      logger.error(
        `Failed to check and trigger merging for item ${itemId}:`,
        error,
      );

      // Retry on error if we haven't reached max retries
      if (retryCount < maxRetries) {
        const delayMs = baseDelayMs * Math.pow(2, retryCount);
        console.log(
          `[DEBUG] Retrying checkAndTriggerMerging after error in ${delayMs}ms for itemId=${itemId}`,
        );
        setTimeout(() => {
          this.checkAndTriggerMerging(itemId, totalParts, retryCount + 1);
        }, delayMs);
      } else {
        logger.error(`Max retries reached for item ${itemId} after error.`);
      }
    }
  }

  /**
   * Update part status
   */
  private async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: PdfProcessingStatus,
    progress: number,
    message: string,
  ): Promise<void> {
    try {
      await this.publishProgressMessage(
        itemId,
        partIndex,
        0, // totalParts not needed for status update
        status,
        progress,
        message,
      );
    } catch (error) {
      logger.error(
        `Failed to update part status for item ${itemId}, part ${partIndex}:`,
        error,
      );
    }
  }

  /**
   * Publish progress message
   */
  private async publishProgressMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    status: PdfProcessingStatus,
    progress: number,
    message: string,
  ): Promise<void> {
    try {
      const progressMessage: MarkdownPartStorageProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_PROGRESS',
        itemId,
        partIndex,
        totalParts,
        status,
        progress,
        message,
        startedAt: Date.now(),
      };

      await this.rabbitMQService.publishMarkdownPartStorageProgress(
        progressMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish progress message for item ${itemId}, part ${partIndex}:`,
        error,
      );
    }
  }

  /**
   * Publish completion message
   */
  private async publishCompletionMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    processingTime: number,
    contentSize: number,
  ): Promise<void> {
    try {
      const completionMessage: MarkdownPartStorageCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_COMPLETED',
        itemId,
        partIndex,
        totalParts,
        status: PdfProcessingStatus.COMPLETED,
        processingTime,
        metadata: {
          contentSize,
          cachedAt: Date.now(),
        },
      };

      await this.rabbitMQService.publishMarkdownPartStorageCompleted(
        completionMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish completion message for item ${itemId}, part ${partIndex}:`,
        error,
      );
    }
  }

  /**
   * Publish failure message
   */
  private async publishFailureMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const failureMessage: MarkdownPartStorageFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_FAILED',
        itemId,
        partIndex,
        totalParts,
        status: PdfProcessingStatus.FAILED,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.rabbitMQService.publishMarkdownPartStorageFailed(
        failureMessage,
      );
    } catch (publishError) {
      logger.error(
        `Failed to publish failure message for item ${itemId}, part ${partIndex}:`,
        publishError,
      );
    }
  }

  /**
   * Check if worker is running
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
    markdownPartCacheAvailable: boolean;
    partTrackerAvailable: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
      markdownPartCacheAvailable: this.markdownPartCache !== null,
      partTrackerAvailable: this.partTracker !== null,
    };
  }
}

/**
 * Create and start a markdown part storage worker
 */
export async function createMarkdownPartStorageWorker(
  markdownPartCache?: MarkdownPartCache,
  partTracker?: IPdfPartTracker,
): Promise<MarkdownPartStorageWorker> {
  const worker = new MarkdownPartStorageWorker(markdownPartCache, partTracker);
  await worker.start();
  return worker;
}

/**
 * Stop a markdown part storage worker
 */
export async function stopMarkdownPartStorageWorker(
  worker: MarkdownPartStorageWorker,
): Promise<void> {
  await worker.stop();
}

// Direct execution support
if (require.main === module) {
  async function main() {
    try {
      // Create and start worker
      const worker = await createMarkdownPartStorageWorker();
      logger.info('Markdown Part Storage Worker started successfully');

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
        'Markdown Part Storage Worker is running. Press Ctrl+C to stop.',
      );
    } catch (error) {
      logger.error('Failed to start Markdown Part Storage Worker:', error);
      process.exit(1);
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
