import {
  PdfConversionRequestMessage,
  PdfPartConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  MarkdownStorageRequestMessage,
  MarkdownPartStorageRequestMessage,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  PdfProcessingStatus,
} from './message.types';
import { IMessageService } from './message-service.interface';
import { IPdfConversionService } from './pdf-conversion.service.interface';
import {
  IPdfConversionMessageHandler,
  MessageHandlerResult,
} from './pdf-conversion-message-handler.interface';
import { v4 as uuidv4 } from 'uuid';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { RabbitMQService } from './rabbitmq.service';
import { IRabbitMQService } from './rabbitmq-service.interface';

const logger = createLoggerWithPrefix('PdfConversionMessageHandler');

/**
 * PDF Conversion Message Handler implementation
 * Handles message processing and communication for PDF conversion
 */
export class PdfConversionMessageHandler
  implements IPdfConversionMessageHandler
{
  private messageService: IRabbitMQService;
  private pdfConversionService: IPdfConversionService;
  private consumerTag: string | null = null;
  private partConsumerTag: string | null = null;
  private _isRunning = false;

  constructor(
    messageService: IRabbitMQService,
    pdfConversionService: IPdfConversionService,
  ) {
    this.messageService = messageService;
    this.pdfConversionService = pdfConversionService;
  }

  /**
   * Initialize the message handler
   */
  async initialize(): Promise<void> {
    if (this._isRunning) {
      logger.warn('PDF conversion message handler is already running');
      return;
    }

    try {
      // Ensure message service is initialized
      if (
        typeof this.messageService.isConnected === 'function' &&
        !this.messageService.isConnected()
      ) {
        await this.messageService.initialize();
      } else if (typeof this.messageService.initialize === 'function') {
        await this.messageService.initialize();
      }

      // Initialize PDF conversion service
      await this.pdfConversionService.initialize();

      logger.info('PDF conversion message handler initialized successfully');
    } catch (error) {
      logger.error(
        'Failed to initialize PDF conversion message handler:',
        error,
      );
      throw error;
    }
  }

  /**
   * Start consuming messages
   */
  async startConsuming(): Promise<void> {
    if (this._isRunning) {
      logger.warn('PDF conversion message handler is already running');
      return;
    }

    try {
      logger.info('Starting PDF conversion message handler...');

      // Start consuming messages from the request queue
      this.consumerTag = await this.messageService.consumeMessages(
        RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        this.handlePdfConversionRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      // Start consuming messages from the part conversion request queue
      this.partConsumerTag = await this.messageService.consumeMessages(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_REQUEST,
        this.handlePdfPartConversionRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_PART_CONVERSION_WORKER,
          noAck: false, // Manual acknowledgment
        },
      );

      this._isRunning = true;
      logger.info('PDF conversion message handler started successfully');
    } catch (error) {
      logger.error('Failed to start PDF conversion message handler:', error);
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsuming(): Promise<void> {
    if (!this._isRunning) {
      logger.warn('PDF conversion message handler is not running');
      return;
    }

    try {
      logger.info('Stopping PDF conversion message handler...');

      if (this.consumerTag) {
        await this.messageService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      if (this.partConsumerTag) {
        await this.messageService.stopConsuming(this.partConsumerTag);
        this.partConsumerTag = null;
      }

      this._isRunning = false;
      logger.info('PDF conversion message handler stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF conversion message handler:', error);
      throw error;
    }
  }

  /**
   * Handle PDF conversion request message
   */
  async handlePdfConversionRequest(
    message: PdfConversionRequestMessage,
    originalMessage: any,
  ): Promise<MessageHandlerResult> {
    const startTime = Date.now();
    logger.info(
      `Processing PDF conversion request for item: ${message.itemId}`,
    );

    // Check retry status before processing
    const retryCount = message.retryCount || 0;
    const maxRetries = message.maxRetries || 3;
    const isFinalAttempt = retryCount >= maxRetries;

    if (isFinalAttempt) {
      logger.info(
        `Processing final attempt for item ${message.itemId} (retryCount: ${retryCount}, maxRetries: ${maxRetries})`,
      );
    }

    try {
      // Update status to processing
      await this.messageService.publishPdfConversionProgress({
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId: message.itemId,
        status: PdfProcessingStatus.CONVERTING,
        progress: 0,
        messageId: uuidv4(),
        timestamp: Date.now(),
      });

      // Convert PDF using the conversion service
      const conversionResult =
        await this.pdfConversionService.convertPdfToMarkdown(
          {
            itemId: message.itemId,
            s3Key: message.s3Key,
            pdfMetadata: message.pdfMetadata,
            retryCount,
            maxRetries,
          },
          async (itemId, status, progress, progressMessage) => {
            await this.publishProgressMessage(
              itemId,
              status,
              progress,
              progressMessage,
            );
          },
        );

      if (!conversionResult.success) {
        await this.messageService.publishPdfConversionProgress({
          eventType: 'PDF_CONVERSION_PROGRESS',
          itemId: message.itemId,
          status: PdfProcessingStatus.FAILED,
          progress: 0,
          messageId: uuidv4(),
          timestamp: Date.now(),
        });
        throw new Error(conversionResult.error || 'PDF conversion failed');
      }

      // Send markdown storage request

      await this.messageService.publishMarkdownStorageRequest({
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId: message.itemId,
        markdownContent: conversionResult.markdownContent,
        messageId: uuidv4(),
        timestamp: Date.now(),
      });

      // Publish conversion completion message
      await this.publishConversionCompletionMessage(
        message.itemId,
        conversionResult.processingTime,
      );

      await this.publishConversionCompletionMessage(
        message.itemId,
        conversionResult.processingTime,
      );

      logger.info(
        `PDF conversion completed successfully for item: ${message.itemId}, markdown storage request sent`,
      );

      return {
        success: true,
        shouldAcknowledge: true,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `PDF conversion failed for item ${message.itemId}: ${JSON.stringify(error)}`,
      );

      // Update status
      await this.publishProgressMessage(
        message.itemId,
        'failed',
        0,
        `PDF conversion failed: ${errorMessage}`,
      );

      // Check if should retry
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying PDF conversion for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.messageService.publishPdfConversionRequest(retryRequest);

        return {
          success: false,
          shouldAcknowledge: true,
          shouldRetry: false, // We've already retried by republishing
        };
      } else {
        // Publish failure message
        await this.publishFailureMessage(
          message.itemId,
          errorMessage,
          retryCount,
          maxRetries,
          processingTime,
        );

        return {
          success: false,
          shouldAcknowledge: true,
        };
      }
    }
  }

  /**
   * Handle PDF part conversion request message
   */
  async handlePdfPartConversionRequest(
    message: PdfPartConversionRequestMessage,
    originalMessage: any,
  ): Promise<MessageHandlerResult> {
    const startTime = Date.now();
    logger.info(
      `Processing PDF part conversion request for item: ${message.itemId}, part: ${message.partIndex + 1}/${message.totalParts}`,
    );

    try {
      // Convert PDF part using the conversion service
      const conversionResult =
        await this.pdfConversionService.convertPdfPartToMarkdown(
          {
            itemId: message.itemId,
            s3Key: message.s3Key,
            partIndex: message.partIndex,
            totalParts: message.totalParts,
            startPage: message.startPage,
            endPage: message.endPage,
            pdfMetadata: message.pdfMetadata,
            retryCount: message.retryCount,
            maxRetries: message.maxRetries,
          },
          async (itemId, status, progress, progressMessage) => {
            await this.publishProgressMessage(
              itemId,
              status,
              progress,
              progressMessage,
            );
          },
        );

      if (!conversionResult.success) {
        throw new Error(conversionResult.error || 'PDF part conversion failed');
      }

      // Send markdown part storage request
      await this.sendMarkdownPartStorageRequest(
        message.itemId,
        conversionResult.partIndex,
        conversionResult.totalParts,
        conversionResult.markdownContent,
        message.startPage,
        message.endPage,
      );

      // Publish part completion message
      await this.publishPartCompletionMessage(
        message.itemId,
        conversionResult.partIndex,
        conversionResult.totalParts,
        conversionResult.markdownContent,
        conversionResult.processingTime,
      );

      logger.info(
        `PDF part conversion completed for item: ${message.itemId}, part: ${conversionResult.partIndex + 1}`,
      );

      return {
        success: true,
        shouldAcknowledge: true,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `PDF part conversion failed for item ${message.itemId}, part ${message.partIndex + 1}:`,
        error,
      );

      // Check if should retry
      const retryCount = message.retryCount || 0;
      const maxRetries = message.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying PDF part conversion for item ${message.itemId}, part ${message.partIndex + 1} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.messageService.publishPdfPartConversionRequest(retryRequest);

        return {
          success: false,
          shouldAcknowledge: true,
          shouldRetry: false, // We've already retried by republishing
        };
      } else {
        // Publish part failure message
        await this.publishPartFailureMessage(
          message.itemId,
          message.partIndex,
          message.totalParts,
          errorMessage,
          retryCount,
          maxRetries,
          processingTime,
        );

        return {
          success: false,
          shouldAcknowledge: true,
        };
      }
    }
  }

  /**
   * Publish progress message
   */
  async publishProgressMessage(
    itemId: string,
    status: string,
    progress: number,
    message: string,
  ): Promise<void> {
    try {
      const progressMessage: PdfConversionProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId,
        status: status as any,
        progress,
        message,
        startedAt: Date.now(),
      };

      await this.messageService.publishPdfConversionProgress(progressMessage);
    } catch (error) {
      logger.error(
        `Failed to publish progress message for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Publish conversion completion message
   */
  async publishConversionCompletionMessage(
    itemId: string,
    processingTime: number,
  ): Promise<void> {
    try {
      const completionMessage: PdfConversionCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_COMPLETED',
        itemId,
        status: 'completed' as any,
        processingTime,
      };

      await this.messageService.publishPdfConversionCompleted(
        completionMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish conversion completion message for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Publish failure message
   */
  async publishFailureMessage(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const failureMessage: PdfConversionFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_FAILED',
        itemId,
        status: PdfProcessingStatus.FAILED,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.messageService.publishPdfConversionFailed(failureMessage);
    } catch (error) {
      logger.error(
        `Failed to publish failure message for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Publish part completion message
   */
  async publishPartCompletionMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    markdownContent: string,
    processingTime: number,
  ): Promise<void> {
    try {
      const completionMessage: PdfPartConversionCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_COMPLETED',
        itemId,
        partIndex,
        totalParts,
        markdownContent,
        pageCount: 0, // Would be filled if we had page count info
        processingTime,
      };

      await this.messageService.publishPdfPartConversionCompleted(
        completionMessage,
      );
    } catch (error) {
      logger.error(
        `Failed to publish part completion message for item ${itemId}, part ${partIndex}:`,
        error,
      );
    }
  }

  /**
   * Publish part failure message
   */
  async publishPartFailureMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const failureMessage: PdfPartConversionFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_FAILED',
        itemId,
        partIndex,
        totalParts,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.messageService.publishPdfPartConversionFailed(failureMessage);
    } catch (publishError) {
      logger.error(
        `Failed to publish part failure message for item ${itemId}, part ${partIndex}:`,
        publishError,
      );
    }
  }

  /**
   * Send markdown storage request
   */
  async sendMarkdownStorageRequest(
    itemId: string,
    markdownContent: string,
    processingTime: number,
  ): Promise<void> {
    try {
      const storageRequest: MarkdownStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        metadata: {
          processingTime,
        },
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };

      await this.messageService.publishMarkdownStorageRequest(storageRequest);
      logger.info(`Markdown storage request sent for item: ${itemId}`);
    } catch (error) {
      logger.error(
        `Failed to send markdown storage request for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send markdown part storage request
   */
  async sendMarkdownPartStorageRequest(
    itemId: string,
    partIndex: number,
    totalParts: number,
    markdownContent: string,
    startPage?: number,
    endPage?: number,
  ): Promise<void> {
    try {
      const storageRequest: MarkdownPartStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId,
        partIndex,
        totalParts,
        markdownContent,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        metadata: {
          startPage,
          endPage,
        },
      };

      await this.messageService.publishMarkdownPartStorageRequest(
        storageRequest,
      );
      logger.info(
        `Markdown part storage request sent for item: ${itemId}, part: ${partIndex + 1}/${totalParts}`,
      );
    } catch (error) {
      logger.error(
        `Failed to send markdown part storage request for item ${itemId}, part ${partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if the handler is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get handler statistics
   */
  getStats(): {
    isRunning: boolean;
    consumerTag: string | null;
    partConsumerTag: string | null;
    messageServiceConnected: boolean;
  } {
    return {
      isRunning: this._isRunning,
      consumerTag: this.consumerTag,
      partConsumerTag: this.partConsumerTag,
      messageServiceConnected: this.messageService.isConnected(),
    };
  }
}
