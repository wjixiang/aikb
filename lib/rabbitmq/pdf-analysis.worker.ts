import {
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService, RabbitMQService } from './rabbitmq.service';
import {
  PdfAnalyzerService,
  createPdfAnalyzerService,
} from './pdf-analyzer.service';
import { AbstractLibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import createLoggerWithPrefix from '../logger';
import { IMessageService, MessageProtocol } from './message-service.interface';

const logger = createLoggerWithPrefix('PdfAnalysisWorker');

/**
 * PDF Analysis Worker
 * Processes PDF analysis requests from RabbitMQ queue
 */
export class PdfAnalysisWorker {
  private rabbitMQService: RabbitMQService
  private analyzerService: PdfAnalyzerService;
  private consumerTag: string | null = null;
  private isRunning = false;

  constructor(storage: AbstractLibraryStorage, protocol?: MessageProtocol) {
    this.analyzerService = createPdfAnalyzerService(storage);
    this.rabbitMQService = getRabbitMQService(protocol)
  }

  /**
   * Start the PDF analysis worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF analysis worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF analysis worker...');

      // Start consuming messages from the analysis request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_ANALYSIS_REQUEST,
        this.handlePdfAnalysisRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info('PDF analysis worker started successfully');
    } catch (error) {
      logger.error('Failed to start PDF analysis worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF analysis worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF analysis worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF analysis worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('PDF analysis worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF analysis worker:', error);
      throw error;
    }
  }

  /**
   * Handle PDF analysis request
   */
  async handlePdfAnalysisRequest(
    message: PdfAnalysisRequestMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(`Processing PDF analysis request for item: ${message.itemId}`);

    try {
      // Process the analysis using the analyzer service
      await this.analyzerService.analyzePdf(message);

      logger.info(
        `PDF analysis completed successfully for item: ${message.itemId}`,
      );
    } catch (error) {
      logger.error(`PDF analysis failed for item ${message.itemId}:`, error);
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
    protocol: MessageProtocol;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
      protocol: this.rabbitMQService.protocol
    };
  }
}

/**
 * Create and start a PDF analysis worker
 */
export async function createPdfAnalysisWorker(
  storage: AbstractLibraryStorage,
): Promise<PdfAnalysisWorker> {
  const worker = new PdfAnalysisWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF analysis worker
 */
export async function stopPdfAnalysisWorker(
  worker: PdfAnalysisWorker,
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
      const worker = await createPdfAnalysisWorker(storage);
      logger.info('PDF Analysis Worker started successfully');

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
      logger.info('PDF Analysis Worker is running. Press Ctrl+C to stop.');
    } catch (error) {
      logger.error('Failed to start PDF Analysis Worker:', error);
      process.exit(1);
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}
