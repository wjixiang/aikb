import {
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfConversionRequestMessage,
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
  private analysisConsumerTag: string | null = null;
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

      // Start consuming messages from the analysis completed queue
      this.analysisConsumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_ANALYSIS_COMPLETED,
        this.handleAnalysisCompleted.bind(this),
        {
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-coordinator',
          noAck: false, // Manual acknowledgment
        },
      );

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

      if (this.analysisConsumerTag) {
        await this.rabbitMQService.stopConsuming(this.analysisConsumerTag);
        this.analysisConsumerTag = null;
      }

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
    analysisConsumerTag: string | null;
    rabbitMQConnected: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      analysisConsumerTag: this.analysisConsumerTag,
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
