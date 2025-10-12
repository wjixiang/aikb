import {
  PdfConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfPartConversionRequestMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  PdfMergingRequestMessage,
  MarkdownStorageRequestMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import {
  MinerUPdfConvertor,
  createMinerUConvertorFromEnv,
} from '../../knowledgeImport/PdfConvertor';
import { ChunkingStrategyType } from '../../lib/chunking/chunkingStrategy';
import createLoggerWithPrefix from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('PdfConversionWorker');

/**
 * PDF Conversion Worker
 * Processes PDF conversion requests from RabbitMQ queue
 */
export class PdfConversionWorker {
  private rabbitMQService = getRabbitMQService();
  private pdfConvertor: MinerUPdfConvertor | null = null;
  private consumerTag: string | null = null;
  private partConsumerTag: string | null = null;
  private isRunning = false;

  constructor(pdfConvertor?: MinerUPdfConvertor) {
    this.pdfConvertor = pdfConvertor || createMinerUConvertorFromEnv();
  }

  /**
   * Start the PDF conversion worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF conversion worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF conversion worker...');

      // Start consuming messages from the request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        this.handlePdfConversionRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER,
          noAck: false, // Manual acknowledgment
        }
      );

      // Start consuming messages from the part conversion request queue
      this.partConsumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_REQUEST,
        this.handlePdfPartConversionRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_PART_CONVERSION_WORKER,
          noAck: false, // Manual acknowledgment
        }
      );

      this.isRunning = true;
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
    if (!this.isRunning) {
      logger.warn('PDF conversion worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF conversion worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      if (this.partConsumerTag) {
        await this.rabbitMQService.stopConsuming(this.partConsumerTag);
        this.partConsumerTag = null;
      }

      this.isRunning = false;
      logger.info('PDF conversion worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF conversion worker:', error);
      throw error;
    }
  }

  /**
   * Handle PDF conversion request
   */
  private async handlePdfConversionRequest(
    message: PdfConversionRequestMessage,
    originalMessage: any
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(`Processing PDF conversion request for item: ${message.itemId}`);

    try {
      // Update status to processing
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 0, 'Starting PDF conversion');

      // We no longer need to get item metadata from storage since we're not updating it directly
      // All status updates will be sent via RabbitMQ messages

      if (!this.pdfConvertor) {
        throw new Error('PDF converter not available');
      }

      // Publish progress
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 10, 'Downloading PDF from S3');

      // Convert PDF to Markdown
      logger.info(`Converting PDF to Markdown for item: ${message.itemId}`);
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 30, 'Converting PDF to Markdown');

      const conversionResult = await this.pdfConvertor.convertPdfToMarkdownFromS3(message.s3Url);

      if (!conversionResult.success || !conversionResult.data) {
        throw new Error(conversionResult.error || 'PDF conversion failed');
      }

      // Extract markdown content
      let markdownContent = '';
      if (typeof conversionResult.data === 'string') {
        markdownContent = conversionResult.data;
      } else if (conversionResult.data.markdown) {
        markdownContent = conversionResult.data.markdown;
      } else if (conversionResult.data.content) {
        markdownContent = conversionResult.data.content;
      } else {
        markdownContent = JSON.stringify(conversionResult.data, null, 2);
      }

      // Send markdown storage request instead of saving directly
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 60, 'Sending markdown storage request');
      
      const conversionTime = Date.now() - startTime;
      await this.sendMarkdownStorageRequest(message.itemId, markdownContent, conversionTime);

      // Update progress via message instead of updating storage directly
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.PROCESSING,
        80,
        'PDF conversion completed, waiting for markdown storage'
      );

      // Publish conversion completion message (not final completion)
      await this.publishConversionCompletionMessage(message.itemId, markdownContent, conversionTime);

      logger.info(`PDF conversion completed successfully for item: ${message.itemId}, markdown storage request sent`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`PDF conversion failed for item ${message.itemId}:`, error);

      // Update status via message instead of updating storage directly
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.FAILED,
        0,
        `PDF conversion failed: ${errorMessage}`
      );

      // Check if should retry
      const retryCount = message.retryCount || 0;
      const maxRetries = message.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;
      
      if (shouldRetry) {
        logger.info(`Retrying PDF conversion for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.rabbitMQService.publishPdfConversionRequest(retryRequest);
      } else {
        // Publish failure message
        await this.publishFailureMessage(message.itemId, errorMessage, retryCount, maxRetries, processingTime);
      }
    }
  }

  /**
   * Handle PDF part conversion request
   */
  private async handlePdfPartConversionRequest(
    message: PdfPartConversionRequestMessage,
    originalMessage: any
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(`Processing PDF part conversion request for item: ${message.itemId}, part: ${message.partIndex + 1}/${message.totalParts}`);

    try {
      // Update part status to processing
      await this.updatePartStatus(message.itemId, message.partIndex, 'processing', 'Converting PDF part to Markdown');

      if (!this.pdfConvertor) {
        throw new Error('PDF converter not available');
      }

      // Convert PDF part to Markdown
      logger.info(`Converting PDF part ${message.partIndex + 1} to Markdown for item: ${message.itemId}`);
      const conversionResult = await this.pdfConvertor.convertPdfToMarkdownFromS3(message.s3Url);

      if (!conversionResult.success || !conversionResult.data) {
        throw new Error(conversionResult.error || 'PDF part conversion failed');
      }

      // Extract markdown content
      let markdownContent = '';
      if (typeof conversionResult.data === 'string') {
        markdownContent = conversionResult.data;
      } else if (conversionResult.data.markdown) {
        markdownContent = conversionResult.data.markdown;
      } else if (conversionResult.data.content) {
        markdownContent = conversionResult.data.content;
      } else {
        markdownContent = JSON.stringify(conversionResult.data, null, 2);
      }

      // Save part markdown content (parts still need to be saved for merging)
      await this.savePartMarkdown(message.itemId, message.partIndex, markdownContent);

      // Update part status to completed
      await this.updatePartStatus(message.itemId, message.partIndex, 'completed', 'PDF part conversion completed');

      // Publish part completion message
      const processingTime = Date.now() - startTime;
      await this.publishPartCompletionMessage(message.itemId, message.partIndex, message.totalParts, markdownContent, processingTime);

      logger.info(`PDF part conversion completed for item: ${message.itemId}, part: ${message.partIndex + 1}`);

      // Check if all parts are completed and trigger merging if needed
      await this.checkAndTriggerMerging(message.itemId, message.totalParts);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`PDF part conversion failed for item ${message.itemId}, part ${message.partIndex + 1}:`, error);

      // Update part status with error
      await this.updatePartStatus(message.itemId, message.partIndex, 'failed', `PDF part conversion failed: ${errorMessage}`, errorMessage);

      // Check if should retry
      const retryCount = message.retryCount || 0;
      const maxRetries = message.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;
      
      if (shouldRetry) {
        logger.info(`Retrying PDF part conversion for item ${message.itemId}, part ${message.partIndex + 1} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.rabbitMQService.publishPdfPartConversionRequest(retryRequest);
      } else {
        // Publish part failure message
        await this.publishPartFailureMessage(message.itemId, message.partIndex, message.totalParts, errorMessage, retryCount, maxRetries, processingTime);
      }
    }
  }

  /**
   * Save part markdown content
   */
  private async savePartMarkdown(itemId: string, partIndex: number, markdownContent: string): Promise<void> {
    try {
      // Instead of saving directly to storage, send a markdown storage request
      // The markdown storage worker will handle the actual storage
      const partSeparator = `\n\n--- PART ${partIndex + 1} ---\n\n`;
      const updatedMarkdown = partSeparator + markdownContent;
      
      await this.sendPartMarkdownStorageRequest(itemId, partIndex, updatedMarkdown);
    } catch (error) {
      logger.error(`Failed to send part markdown storage request for item ${itemId}, part ${partIndex}:`, error);
      throw error;
    }
  }

  /**
   * Update part status in storage
   */
  private async updatePartStatus(
    itemId: string,
    partIndex: number,
    status: string,
    message: string,
    error?: string
  ): Promise<void> {
    try {
      // Instead of updating storage directly, publish a part status update message
      // This allows other services to handle the status update
      await this.publishPartStatusUpdateMessage(itemId, partIndex, status, message, error);
    } catch (updateError) {
      logger.error(`Failed to publish part status update for item ${itemId}, part ${partIndex}:`, updateError);
    }
  }

  /**
   * Check if all parts are completed and trigger merging if needed
   */
  private async checkAndTriggerMerging(itemId: string, totalParts: number): Promise<void> {
    try {
      // Since we no longer track part status in storage, we need to handle this differently
      // For now, we'll assume that when a part is completed, it will trigger a check
      // The merging logic will need to be handled by a separate service that tracks part completion
      logger.info(`Part completed for item ${itemId}, part merging check would be triggered here`);
      
      // In a real implementation, you would:
      // 1. Query a separate tracking service for part completion status
      // 2. If all parts are completed, send a merging request
      
      // For now, we'll just log that this would happen
      logger.info(`Would trigger merging for item ${itemId} if all ${totalParts} parts were completed`);
    } catch (error) {
      logger.error(`Failed to check and trigger merging for item ${itemId}:`, error);
    }
  }

  /**
   * Publish part completion message
   */
  private async publishPartCompletionMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    markdownContent: string,
    processingTime: number
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

      await this.rabbitMQService.publishPdfPartConversionCompleted(completionMessage);
    } catch (error) {
      logger.error(`Failed to publish part completion message for item ${itemId}, part ${partIndex}:`, error);
    }
  }

  /**
   * Publish part failure message
   */
  private async publishPartFailureMessage(
    itemId: string,
    partIndex: number,
    totalParts: number,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number
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

      await this.rabbitMQService.publishPdfPartConversionFailed(failureMessage);
    } catch (publishError) {
      logger.error(`Failed to publish part failure message for item ${itemId}, part ${partIndex}:`, publishError);
    }
  }

  /**
   * Process chunks and embeddings for the converted markdown
   */
  private async processChunksAndEmbeddings(itemId: string, markdownContent: string): Promise<void> {
    try {
      // This is a simplified version - in a real implementation, you would
      // use the proper chunking and embedding services
      
      // For now, we'll just log that chunks are being processed
      // The actual chunking logic would be similar to what's in the Library class
      logger.info(`Processing chunks for item: ${itemId}`);
      
      // Update progress
      await this.publishProgressMessage(itemId, PdfProcessingStatus.PROCESSING, 80, 'Generating text chunks');
      
      // Here you would implement the actual chunking logic
      // For now, we'll simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.publishProgressMessage(itemId, PdfProcessingStatus.PROCESSING, 90, 'Generating embeddings');
      
      // Here you would implement the actual embedding generation
      // For now, we'll simulate it with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info(`Chunks and embeddings processed for item: ${itemId}`);
    } catch (error) {
      logger.error(`Failed to process chunks and embeddings for item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Update item status in storage
   */
  private async updateItemStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message: string,
    progress?: number,
    error?: string,
    processingTime?: number
  ): Promise<void> {
    try {
      // Instead of updating storage directly, publish a status update message
      await this.publishProgressMessage(itemId, status, progress || 0, message);
    } catch (error) {
      logger.error(`Failed to publish status update for ${itemId}:`, error);
    }
  }

  /**
   * Publish progress message
   */
  private async publishProgressMessage(
    itemId: string,
    status: PdfProcessingStatus,
    progress: number,
    message: string
  ): Promise<void> {
    try {
      const progressMessage: PdfConversionProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId,
        status,
        progress,
        message,
        startedAt: Date.now(),
      };

      await this.rabbitMQService.publishPdfConversionProgress(progressMessage);
    } catch (error) {
      logger.error(`Failed to publish progress message for item ${itemId}:`, error);
    }
  }

  /**
   * Publish completion message
   */
  private async publishCompletionMessage(
    itemId: string,
    markdownContent: string,
    processingTime: number
  ): Promise<void> {
    try {
      const completionMessage: PdfConversionCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_COMPLETED',
        itemId,
        status: PdfProcessingStatus.COMPLETED,
        markdownContent,
        processingTime,
      };

      await this.rabbitMQService.publishPdfConversionCompleted(completionMessage);
    } catch (error) {
      logger.error(`Failed to publish completion message for item ${itemId}:`, error);
    }
  }

  /**
   * Publish conversion completion message (intermediate step)
   */
  private async publishConversionCompletionMessage(
    itemId: string,
    markdownContent: string,
    processingTime: number
  ): Promise<void> {
    try {
      const completionMessage: PdfConversionCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_COMPLETED',
        itemId,
        status: PdfProcessingStatus.COMPLETED, // PDF conversion is completed, but markdown storage is pending
        markdownContent,
        processingTime,
      };

      await this.rabbitMQService.publishPdfConversionCompleted(completionMessage);
    } catch (error) {
      logger.error(`Failed to publish conversion completion message for item ${itemId}:`, error);
    }
  }

  /**
   * Send markdown storage request
   */
  private async sendMarkdownStorageRequest(
    itemId: string,
    markdownContent: string,
    processingTime: number
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

      await this.rabbitMQService.publishMarkdownStorageRequest(storageRequest);
      logger.info(`Markdown storage request sent for item: ${itemId}`);
    } catch (error) {
      logger.error(`Failed to send markdown storage request for item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Publish failure message
   */
  private async publishFailureMessage(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number
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

      await this.rabbitMQService.publishPdfConversionFailed(failureMessage);
    } catch (error) {
      logger.error(`Failed to publish failure message for item ${itemId}:`, error);
    }
  }

  /**
   * Send part markdown storage request
   */
  private async sendPartMarkdownStorageRequest(
    itemId: string,
    partIndex: number,
    markdownContent: string
  ): Promise<void> {
    try {
      const storageRequest: MarkdownStorageRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        metadata: {
          partIndex,
          isPart: true,
        },
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };

      await this.rabbitMQService.publishMarkdownStorageRequest(storageRequest);
      logger.info(`Part markdown storage request sent for item: ${itemId}, part: ${partIndex}`);
    } catch (error) {
      logger.error(`Failed to send part markdown storage request for item ${itemId}, part ${partIndex}:`, error);
      throw error;
    }
  }

  /**
   * Publish part status update message
   */
  private async publishPartStatusUpdateMessage(
    itemId: string,
    partIndex: number,
    status: string,
    message: string,
    error?: string
  ): Promise<void> {
    try {
      // Since we don't have a specific message type for part status updates,
      // we'll use a progress message with part information
      const progressMessage: PdfConversionProgressMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId,
        status: status as PdfProcessingStatus,
        progress: 0, // Progress would be calculated by a tracking service
        message: `Part ${partIndex + 1}: ${message}`,
        error,
        startedAt: Date.now(),
      };

      await this.rabbitMQService.publishPdfConversionProgress(progressMessage);
    } catch (error) {
      logger.error(`Failed to publish part status update for item ${itemId}, part ${partIndex}:`, error);
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
    partConsumerTag: string | null;
    rabbitMQConnected: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      partConsumerTag: this.partConsumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
    };
  }
}

/**
 * Create and start a PDF conversion worker
 */
export async function createPdfConversionWorker(
  pdfConvertor?: MinerUPdfConvertor
): Promise<PdfConversionWorker> {
  const worker = new PdfConversionWorker(pdfConvertor);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF conversion worker
 */
export async function stopPdfConversionWorker(worker: PdfConversionWorker): Promise<void> {
  await worker.stop();
}