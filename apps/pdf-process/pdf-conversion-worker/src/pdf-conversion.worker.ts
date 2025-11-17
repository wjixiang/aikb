import {
  MinerUPdfConvertor,
  createMinerUConvertorFromEnv,
} from '@aikb/pdf-converter';
import {
  IPdfPartTracker as IPdfPartTrackerLib,
  getPdfPartTracker,
} from '@aikb/pdf-part-tracker';
import { IPdfPartTracker } from './pdf-part-tracker';
import {
  IMarkdownPartCache as IMarkdownPartCacheLib,
  getMarkdownPartCache,
} from '@aikb/markdown-part-cache';
import { MarkdownPartCache } from './markdown-part-cache';
import { IRabbitMQService } from './rabbitmq-service.interface';
import { RabbitMQService } from './rabbitmq.service';
import { IPdfConversionService } from './pdf-conversion.service.interface.js';
import { PdfConversionService } from './pdf-conversion.service.js';
import { IPdfConversionMessageHandler } from './pdf-conversion-message-handler.interface.js';
import { PdfConversionMessageHandler } from './pdf-conversion-message-handler.js';
import createLoggerWithPrefix from 'log-management/logger';

const logger = createLoggerWithPrefix('PdfConversionWorker');

/**
 * PDF Conversion Worker (Refactored)
 * Processes PDF conversion requests from RabbitMQ queue using separated service modules
 */
export class PdfConversionWorker {
  private messageService: IRabbitMQService;
  private pdfConversionService: IPdfConversionService;
  private messageHandler: IPdfConversionMessageHandler;
  private isInitialized = false;

  constructor(
    messageService?: IRabbitMQService,
    pdfConversionService?: IPdfConversionService,
    messageHandler?: IPdfConversionMessageHandler,
  ) {
    // Initialize message Service
    // If no message Service is provided, get RabbitMQ service
    if (messageService) {
      this.messageService = messageService;
    } else {
      const rabbitMQServiceImpl = new RabbitMQService();
      this.messageService = rabbitMQServiceImpl;
    }

    // Initialize PDF conversion service with dependencies
    const pdfConvertor = createMinerUConvertorFromEnv();
    const partTracker = getPdfPartTracker();
    const markdownPartCache = getMarkdownPartCache();

    this.pdfConversionService =
      pdfConversionService ||
      new PdfConversionService(
        pdfConvertor,
        partTracker as unknown as IPdfPartTracker,
        markdownPartCache as unknown as MarkdownPartCache,
      );

    // Initialize message handler with dependencies
    this.messageHandler =
      messageHandler ||
      new PdfConversionMessageHandler(
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
    // Check if message Service has isConnected method, otherwise assume it's connected
    const messageServiceConnected =
      typeof this.messageService.isConnected === 'function'
        ? this.messageService.isConnected()
        : true;

    return {
      isRunning: this.isWorkerRunning(),
      isInitialized: this.isInitialized,
      messageHandlerStats: this.messageHandler.getStats(),
      conversionServiceStats: this.pdfConversionService.getStats(),
      messageServiceConnected,
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
