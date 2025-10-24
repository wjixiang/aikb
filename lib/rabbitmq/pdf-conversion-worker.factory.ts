import {
  MinerUPdfConvertor,
  createMinerUConvertorFromEnv,
} from '../../knowledgeBase/knowledgeImport/PdfConvertor';
import { IPdfPartTracker } from './pdf-part-tracker';
import { MarkdownPartCache } from './markdown-part-cache';
import { getPdfPartTracker } from './pdf-part-tracker-factory';
import { getMarkdownPartCache } from './markdown-part-cache-factory';
import { getRabbitMQService, RabbitMQService } from './rabbitmq.service';
import { IMessageService } from './message-service.interface';
import { IPdfConversionService } from './pdf-conversion.service.interface';
import { PdfConversionService } from './pdf-conversion.service';
import { IPdfConversionMessageHandler } from './pdf-conversion-message-handler.interface';
import { PdfConversionMessageHandler } from './pdf-conversion-message-handler';
import { PdfConversionWorker } from './pdf-conversion.worker';
import createLoggerWithPrefix from 'lib/logManagement/logger';
import { IRabbitMQService } from './rabbitmq-service.interface';

const logger = createLoggerWithPrefix('PdfConversionWorkerFactory');

/**
 * Configuration options for PDF conversion worker
 */
export interface PdfConversionWorkerConfig {
  // Message service configuration
  messageService?: IRabbitMQService;

  // PDF conversion service configuration
  pdfConvertor?: MinerUPdfConvertor;
  partTracker?: IPdfPartTracker;
  markdownPartCache?: MarkdownPartCache;

  // Message handler configuration
  messageHandler?: IPdfConversionMessageHandler;

  // Worker configuration
  autoStart?: boolean;
}

/**
 * Factory class for creating PDF conversion workers with dependency injection
 */
export class PdfConversionWorkerFactory {
  /**
   * Create a PDF conversion worker with default dependencies
   */
  static createDefault(
    config: Partial<PdfConversionWorkerConfig> = {},
  ): PdfConversionWorker {
    logger.info('Creating PDF conversion worker with default dependencies');

    // Create message service
    let messageService: IRabbitMQService;
    if (config.messageService) {
      messageService = config.messageService;
    } else {
      const rabbitMQService = getRabbitMQService();
      // Access the internal message service from RabbitMQService
      messageService =
        (rabbitMQService as any).messageService || rabbitMQService;
    }

    // Create PDF conversion service
    const pdfConvertor = config.pdfConvertor || createMinerUConvertorFromEnv();
    const partTracker = config.partTracker || getPdfPartTracker();
    const markdownPartCache =
      config.markdownPartCache || getMarkdownPartCache();

    const pdfConversionService = config.messageHandler
      ? undefined
      : new PdfConversionService(pdfConvertor, partTracker, markdownPartCache);

    // Create message handler
    const messageHandler =
      config.messageHandler ||
      new PdfConversionMessageHandler(messageService, pdfConversionService!);

    // Create worker
    const worker = new PdfConversionWorker(
      messageService,
      pdfConversionService,
      messageHandler,
    );

    return worker;
  }

  /**
   * Create a PDF conversion worker with custom dependencies
   */
  static createWithDependencies(
    config: PdfConversionWorkerConfig,
  ): PdfConversionWorker {
    logger.info('Creating PDF conversion worker with custom dependencies');

    // Use provided services or create defaults
    let messageService: IRabbitMQService;
    if (config.messageService) {
      messageService = config.messageService;
    } else {
      const rabbitMQService = getRabbitMQService();
      // Access the internal message service from RabbitMQService
      messageService =
        (rabbitMQService as any).messageService || rabbitMQService;
    }

    // Create PDF conversion service if not provided
    let pdfConversionService = config.messageHandler
      ? undefined
      : config.pdfConvertor
        ? new PdfConversionService(
            config.pdfConvertor,
            config.partTracker || getPdfPartTracker(),
            config.markdownPartCache || getMarkdownPartCache(),
          )
        : undefined;

    // Create message handler if not provided
    const messageHandler =
      config.messageHandler ||
      (pdfConversionService
        ? new PdfConversionMessageHandler(messageService, pdfConversionService)
        : undefined);

    // Create worker
    const worker = new PdfConversionWorker(
      messageService,
      pdfConversionService,
      messageHandler,
    );

    return worker;
  }

  /**
   * Create and start a PDF conversion worker with default dependencies
   */
  static async createAndStart(
    config: Partial<PdfConversionWorkerConfig> = {},
  ): Promise<PdfConversionWorker> {
    const worker = this.createDefault(config);

    if (config.autoStart !== false) {
      await worker.start();
    }

    return worker;
  }

  /**
   * Create and start a PDF conversion worker with custom dependencies
   */
  static async createAndStartWithDependencies(
    config: PdfConversionWorkerConfig,
  ): Promise<PdfConversionWorker> {
    const worker = this.createWithDependencies(config);

    if (config.autoStart !== false) {
      await worker.start();
    }

    return worker;
  }

  /**
   * Create a PDF conversion worker for testing with mock dependencies
   */
  static createForTesting(
    config: {
      messageService?: IRabbitMQService;
      pdfConversionService?: IPdfConversionService;
      messageHandler?: IPdfConversionMessageHandler;
    } = {},
  ): PdfConversionWorker {
    logger.info('Creating PDF conversion worker for testing');

    return new PdfConversionWorker(
      config.messageService,
      config.pdfConversionService,
      config.messageHandler,
    );
  }
}

/**
 * Convenience function to create a PDF conversion worker with default dependencies
 */
export function createPdfConversionWorker(
  config: Partial<PdfConversionWorkerConfig> = {},
): PdfConversionWorker {
  return PdfConversionWorkerFactory.createDefault(config);
}

/**
 * Convenience function to create and start a PDF conversion worker with default dependencies
 */
export async function createAndStartPdfConversionWorker(
  config: Partial<PdfConversionWorkerConfig> = {},
): Promise<PdfConversionWorker> {
  return PdfConversionWorkerFactory.createAndStart(config);
}

/**
 * Convenience function to stop a PDF conversion worker
 */
export async function stopPdfConversionWorker(
  worker: PdfConversionWorker,
): Promise<void> {
  await worker.stop();
}
