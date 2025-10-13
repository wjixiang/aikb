import {
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfConversionRequestMessage,
  PdfSplittingRequestMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeImport/library';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('PdfProcessingCoordinator');

/**
 * PDF Processing Coordinator Worker
 * Coordinates the PDF processing workflow by listening to analysis and splitting completion events
 * and triggering the next steps in the processing pipeline
 */
export class PdfProcessingCoordinatorWorker {
  private rabbitMQService = getRabbitMQService();
  private analysisConsumerTag: string | null = null;
  private splittingConsumerTag: string | null = null;
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
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-coordinator',
          noAck: false, // Manual acknowledgment
        }
      );

      // Note: Splitting completion handling is disabled for now
      // The splitting worker will handle sending part conversion requests directly
      // this.splittingConsumerTag = await this.rabbitMQService.consumeMessages(
      //   RABBITMQ_QUEUES.PDF_SPLITTING_COMPLETED,
      //   this.handleSplittingCompleted.bind(this),
      //   {
      //     consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_SPLITTING_WORKER + '-coordinator',
      //     noAck: false, // Manual acknowledgment
      //   }
      // );

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

      if (this.splittingConsumerTag) {
        await this.rabbitMQService.stopConsuming(this.splittingConsumerTag);
        this.splittingConsumerTag = null;
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
    originalMessage: any
  ): Promise<void> {
    logger.info(`Processing analysis completed for item: ${message.itemId}, requires splitting: ${message.requiresSplitting}`);

    try {
      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);

      // Get Item directly
      if(!itemMetadata?.s3Key) throw new Error(`s3 key not found for library item: ${itemMetadata?.id}`)
      const s3Url = await this.storage.getPdfDownloadUrl(itemMetadata?.s3Key)

      if (!itemMetadata) {
        logger.error(`Item ${message.itemId} not found`);
        return;
      }

      if (message.requiresSplitting) {
        // Send PDF splitting request
        logger.info(`Sending PDF splitting request for item: ${message.itemId}`);
        
        const splittingRequest: PdfSplittingRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_SPLITTING_REQUEST',
          itemId: message.itemId,
          s3Url: s3Url,
          s3Key: itemMetadata.s3Key!,
          fileName: itemMetadata.s3Key!.split('/').pop() || 'document.pdf',
          pageCount: message.pageCount,
          splitSize: message.suggestedSplitSize || 25,
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        await this.rabbitMQService.publishPdfSplittingRequest(splittingRequest);
        logger.info(`PDF splitting request sent for item: ${message.itemId}`);
      } else {
        // Send PDF conversion request directly
        logger.info(`Sending PDF conversion request for item: ${message.itemId}`);
        
        const conversionRequest: PdfConversionRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_CONVERSION_REQUEST',
          itemId: message.itemId,
          s3Url: s3Url,
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
        };

        await this.rabbitMQService.publishPdfConversionRequest(conversionRequest);
        logger.info(`PDF conversion request sent for item: ${message.itemId} \n s3Url: ${s3Url}`);
      }

      // Update item status
      await this.storage.updateMetadata({
        ...itemMetadata,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: message.requiresSplitting ? 'PDF splitting in progress' : 'PDF conversion in progress',
        dateModified: new Date(),
      });

    } catch (error) {
      logger.error(`Failed to handle analysis completed for item ${message.itemId}:`, error);
      throw error;
    }
  }

  // Note: Splitting completion handling is disabled for now
  // /**
  //  * Handle PDF splitting completed message
  //  */
  // private async handleSplittingCompleted(
  //   message: PdfSplittingCompletedMessage,
  //   originalMessage: any
  // ): Promise<void> {
  //   logger.info(`Processing splitting completed for item: ${message.itemId}, total parts: ${message.totalParts}`);

  //   try {
  //     // Get the item metadata
  //     const itemMetadata = await this.storage.getMetadata(message.itemId);
  //     if (!itemMetadata) {
  //       logger.error(`Item ${message.itemId} not found`);
  //       return;
  //     }

  //     // Update item status to indicate merging will start
  //     await this.storage.updateMetadata({
  //       ...itemMetadata,
  //       pdfProcessingStatus: PdfProcessingStatus.MERGING,
  //       pdfProcessingMessage: 'PDF parts conversion completed, starting merging process',
  //       pdfProcessingMergingStartedAt: new Date(),
  //       dateModified: new Date(),
  //     });

  //     logger.info(`Splitting completed processed for item: ${message.itemId}, merging process initiated`);

  //   } catch (error) {
  //     logger.error(`Failed to handle splitting completed for item ${message.itemId}:`, error);
  //     throw error;
  //   }
  // }

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
  storage: AbstractLibraryStorage
): Promise<PdfProcessingCoordinatorWorker> {
  const worker = new PdfProcessingCoordinatorWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF processing coordinator worker
 */
export async function stopPdfProcessingCoordinatorWorker(worker: PdfProcessingCoordinatorWorker): Promise<void> {
  await worker.stop();
}

// Direct execution support
if (require.main === module) {
  const { S3ElasticSearchLibraryStorage } = require('../../knowledgeImport/library');
  
  async function main() {
    try {
      // Create storage instance
      const elasticsearchUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
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
      logger.info('PDF Processing Coordinator Worker is running. Press Ctrl+C to stop.');
      
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