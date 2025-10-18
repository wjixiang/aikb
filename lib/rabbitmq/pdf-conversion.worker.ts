import {
  MinerUPdfConvertor,
  createMinerUConvertorFromEnv,
} from '../../knowledgeBase/knowledgeImport/PdfConvertor';
import { IPdfPartTracker } from './pdf-part-tracker';
import { MarkdownPartCache } from './markdown-part-cache';
import { getPdfPartTracker } from './pdf-part-tracker-factory';
import { getMarkdownPartCache } from './markdown-part-cache-factory';
import { getRabbitMQService } from './rabbitmq.service';
import { IMessageService } from './message-service.interface';
import {
  IPdfConversionService,
} from './pdf-conversion.service.interface';
import { PdfConversionService } from './pdf-conversion.service';
import {
  IPdfConversionMessageHandler,
} from './pdf-conversion-message-handler.interface';
import { PdfConversionMessageHandler } from './pdf-conversion-message-handler';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('PdfConversionWorker');

/**
 * PDF Conversion Worker (Refactored)
 * Processes PDF conversion requests from RabbitMQ queue using separated service modules
 */
export class PdfConversionWorker {
  private messageService: IMessageService;
  private pdfConversionService: IPdfConversionService;
  private messageHandler: IPdfConversionMessageHandler;
  private isInitialized = false;

  constructor(
    messageService?: IMessageService,
    pdfConversionService?: IPdfConversionService,
    messageHandler?: IPdfConversionMessageHandler,
  ) {
    // Initialize message service
    // If no message service is provided, get the RabbitMQ service and extract its internal message service
    if (messageService) {
      this.messageService = messageService;
    } else {
      const rabbitMQService = getRabbitMQService();
      // Access the internal message service from RabbitMQService
      // This is a workaround since RabbitMQService doesn't implement IMessageService directly
      this.messageService = (rabbitMQService as any).messageService || rabbitMQService;
    }

    // Initialize PDF conversion service with dependencies
    const pdfConvertor = createMinerUConvertorFromEnv();
    const partTracker = getPdfPartTracker();
    const markdownPartCache = getMarkdownPartCache();
    
    this.pdfConversionService = pdfConversionService || new PdfConversionService(
      pdfConvertor,
      partTracker,
      markdownPartCache,
    );

    // Initialize message handler with dependencies
    this.messageHandler = messageHandler || new PdfConversionMessageHandler(
      this.messageService,
      this.pdfConversionService,
    );
  }

  /**
   * Start the PDF conversion worker
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('PDF conversion worker is already initialized');
      return;
    }

    try {
      logger.info('Starting PDF conversion worker...');

      // Initialize the message handler which will initialize all dependencies
      await this.messageHandler.initialize();

      // Start consuming messages
      await this.messageHandler.startConsuming();

      this.isInitialized = true;
      logger.info('PDF conversion worker started successfully');
    } catch (error) {
      logger.error('Failed to start PDF conversion worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF conversion worker
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('PDF conversion worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF conversion worker...');

      // Stop consuming messages
      await this.messageHandler.stopConsuming();

      this.isInitialized = false;
      logger.info('PDF conversion worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF conversion worker:', error);
      throw error;
    }
  }

  /**
   * Check if worker is running
   */
  isWorkerRunning(): boolean {
    return this.isInitialized && this.messageHandler.isRunning();
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<{
    isRunning: boolean;
    isInitialized: boolean;
    messageHandlerStats: any;
    conversionServiceStats: any;
    messageServiceConnected: boolean;
  }> {
    return {
      isRunning: this.isWorkerRunning(),
      isInitialized: this.isInitialized,
      messageHandlerStats: this.messageHandler.getStats(),
      conversionServiceStats: this.pdfConversionService.getStats(),
      messageServiceConnected: this.messageService.isConnected(),
    };
  }
}

/**
 * Create and start a PDF conversion worker with default dependencies
 */
export async function createPdfConversionWorker(
  pdfConvertor?: MinerUPdfConvertor,
  partTracker?: IPdfPartTracker,
  markdownPartCache?: MarkdownPartCache,
): Promise<PdfConversionWorker> {
  const worker = new PdfConversionWorker();
  await worker.start();
  return worker;
}

/**
 * Stop a PDF conversion worker
 */
export async function stopPdfConversionWorker(
  worker: PdfConversionWorker,
): Promise<void> {
  await worker.stop();
}

// Direct execution support
if (require.main === module) {
  async function main() {
    try {
      // Create and start worker
      const worker = await createPdfConversionWorker();
      logger.info('PDF Conversion Worker started successfully');

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
      logger.info('PDF Conversion Worker is running. Press Ctrl+C to stop.');
    } catch (error) {
      logger.error('Failed to start PDF Conversion Worker:', error);
      process.exit(1);
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}