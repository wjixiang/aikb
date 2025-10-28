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
import { MessageProtocol } from './message-service.interface';
import { PdfMergerService, createPdfMergerService } from './pdf-merger.service';
import { ILibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('PdfMergerWorker');

/**
 * PDF Merger Worker
 * Processes PDF merging requests from RabbitMQ queue
 */
export class PdfMergerWorker {
  private rabbitMQService;
  private mergerService: PdfMergerService;
  private consumerTag: string | null = null;
  private isRunning = false;
  private storage: ILibraryStorage;
  private workerId: string;

  constructor(storage: ILibraryStorage, protocol?: MessageProtocol) {
    this.storage = storage;
    this.mergerService = new PdfMergerService(storage);
    this.rabbitMQService = getRabbitMQService(protocol);
    // Generate unique worker ID to avoid consumer tag conflicts
    this.workerId = `pdf-merger-worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the PDF merger worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF merger worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF merger worker...');

      // Start the merger service
      await this.mergerService.start();

      // Start consuming messages from the merging request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_MERGING_REQUEST,
        this.handlePdfMergingRequest.bind(this),
        {
          consumerTag: this.workerId,
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info('PDF merger worker started successfully');
    } catch (error) {
      logger.error('Failed to start PDF merger worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF merger worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF merger worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF merger worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      // Stop the merger service
      await this.mergerService.stop();

      this.isRunning = false;
      logger.info('PDF merger worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF merger worker:', error);
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
    logger.info(`Processing PDF merging request for item: ${message.itemId}`);

    try {
      // The merger service already handles the merging logic
      // We just need to trigger it by calling the handlePdfMergingRequest method
      await (this.mergerService as any).handlePdfMergingRequest(
        message,
        originalMessage,
      );

      logger.info(
        `PDF merging completed successfully for item: ${message.itemId}`,
      );
    } catch (error) {
      logger.error(`PDF merging failed for item ${message.itemId}:`, error);
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
 * Create and start a PDF merger worker
 */
export async function createPdfMergerWorker(
  storage: ILibraryStorage,
): Promise<PdfMergerWorker> {
  const worker = new PdfMergerWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF merger worker
 */
export async function stopPdfMergerWorker(
  worker: PdfMergerWorker,
): Promise<void> {
  await worker.stop();
}

// Direct execution support
const main = async () => {
  try {
    const {
      S3ElasticSearchLibraryStorage,
    } = require('../../knowledgeBase/knowledgeImport/library');

    // Create storage instance
    const elasticsearchUrl =
      process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl, 1024);

    // Create and start worker
    const worker = await createPdfMergerWorker(storage);
    logger.info('PDF Merger Worker started successfully');

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

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      // Don't exit, let the worker continue running
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      // Don't exit, let the worker continue running
    });

    // Keep the process running
    logger.info('PDF Merger Worker is running. Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Failed to start PDF Merger Worker:', error);
    // Don't exit immediately, give the worker a chance to recover
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }
};

if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error:', error);
    // Don't exit immediately, give the worker a chance to recover
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  });
}
