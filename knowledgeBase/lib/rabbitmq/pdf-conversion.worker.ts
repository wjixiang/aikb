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
  PdfPartStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { getPdfDownloadUrl } from '../s3Service/S3Service';
import {
  MinerUPdfConvertor,
  createMinerUConvertorFromEnv,
} from '../../knowledgeImport/PdfConvertor';
import { ChunkingStrategyType } from '../../lib/chunking/chunkingStrategy';
import createLoggerWithPrefix from '../../lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { IPdfPartTracker } from './pdf-part-tracker';
import { getPdfPartTracker } from './pdf-part-tracker-factory';

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
  private partTracker: IPdfPartTracker;

  constructor(pdfConvertor?: MinerUPdfConvertor, partTracker?: IPdfPartTracker) {
    this.pdfConvertor = pdfConvertor || createMinerUConvertorFromEnv();
    this.partTracker = partTracker || getPdfPartTracker();
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

    // Check retry status before processing
    const retryCount = message.retryCount || 0;
    const maxRetries = message.maxRetries || 3;
    const isFinalAttempt = retryCount >= maxRetries;
    
    if (isFinalAttempt) {
      logger.info(`Processing final attempt for item ${message.itemId} (retryCount: ${retryCount}, maxRetries: ${maxRetries})`);
    }

    try {
      // Update status to processing
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 0, 'Starting PDF conversion');

      // Log PDF metadata if available (optimization: no need to re-analyze)
      if (message.pdfMetadata) {
        logger.info(`Using PDF metadata from analysis phase for item ${message.itemId}:`, {
          pageCount: message.pdfMetadata.pageCount,
          fileSize: message.pdfMetadata.fileSize,
          title: message.pdfMetadata.title,
          author: message.pdfMetadata.author,
        });
        logger.info(`OPTIMIZATION: Skipping PDF analysis for item ${message.itemId} - using metadata from previous analysis`);
      } else {
        logger.info(`No PDF metadata available for item ${message.itemId} - will analyze during conversion`);
      }

      if (!this.pdfConvertor) {
        throw new Error('PDF converter not available');
      }

      // Publish progress
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 10, 'Preparing PDF conversion');

      // Convert PDF to Markdown
      logger.info(`Converting PDF to Markdown for item: ${message.itemId}, S3 Key: ${message.s3Key}`);
      await this.publishProgressMessage(message.itemId, PdfProcessingStatus.PROCESSING, 30, 'Converting PDF to Markdown');

      // Generate presigned URL from s3Key
      const s3Url = await getPdfDownloadUrl(message.s3Key);
      logger.info(`Starting PDF conversion with generated S3 URL for item ${message.itemId}`);
      
      let conversionResult;
      try {
        conversionResult = await this.pdfConvertor.convertPdfToMarkdownFromS3(s3Url);
        
        // Enhanced diagnostic logging for conversion result
        logger.info(`PDF conversion completed for item ${message.itemId}. Enhanced result diagnostics: ${JSON.stringify({
          success: conversionResult.success,
          hasData: !!conversionResult.data,
          hasError: !!conversionResult.error,
          error: conversionResult.error,
          taskId: conversionResult.taskId,
          taskIdType: typeof conversionResult.taskId,
          downloadedFilesCount: conversionResult.downloadedFiles?.length || 0,
          fullConversionResult: JSON.stringify(conversionResult, null, 2)
        }, null , 2)}`);
        
        if (!conversionResult.taskId || conversionResult.taskId === 'unknown') {
          logger.error(`CRITICAL: conversionResult.taskId is missing or invalid for item ${message.itemId}`);
          logger.error(`Full conversion result:`, JSON.stringify(conversionResult, null, 2));
        }
      } catch (conversionError) {
        logger.error(`PDF conversion failed with error for item ${message.itemId}:`, conversionError);
        logger.error(`Error type:`, typeof conversionError);
        logger.error(`Error message:`, conversionError instanceof Error ? conversionError.message : String(conversionError));
        logger.error(`Error stack:`, conversionError instanceof Error ? conversionError.stack : 'No stack trace');
        throw conversionError;
      }

      if (!conversionResult.success || !conversionResult.data) {
        logger.error(`PDF conversion failed for item ${message.itemId}:`, {
          success: conversionResult.success,
          hasData: !!conversionResult.data,
          error: conversionResult.error,
          taskId: conversionResult.taskId
        });
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
      
      logger.error(`PDF conversion failed for item ${message.itemId}: ${JSON.stringify(error)}`);

      // Update status via message instead of updating storage directly
      await this.publishProgressMessage(
        message.itemId,
        PdfProcessingStatus.FAILED,
        0,
        `PDF conversion failed: ${errorMessage}`
      );

      // Check if should retry
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
      // Initialize PDF processing if not already done
      const processingStatus = await this.partTracker.getPdfProcessingStatus(message.itemId);
      if (!processingStatus) {
        logger.info(`Initializing PDF processing for item ${message.itemId}`);
        await this.partTracker.initializePdfProcessing(message.itemId, message.totalParts);
      }

      // Update part status to processing
      await this.updatePartStatus(message.itemId, message.partIndex, 'processing', 'Converting PDF part to Markdown');
      await this.partTracker.updatePartStatus(message.itemId, message.partIndex, PdfPartStatus.PROCESSING);

      // Log PDF metadata if available (optimization: no need to re-analyze)
      if (message.pdfMetadata) {
        logger.info(`Using PDF metadata from analysis phase for item ${message.itemId}, part ${message.partIndex + 1}:`, {
          pageCount: message.pdfMetadata.pageCount,
          fileSize: message.pdfMetadata.fileSize,
          title: message.pdfMetadata.title,
          author: message.pdfMetadata.author,
        });
        logger.info(`OPTIMIZATION: Skipping PDF analysis for item ${message.itemId}, part ${message.partIndex + 1} - using metadata from previous analysis`);
      }

      if (!this.pdfConvertor) {
        throw new Error('PDF converter not available');
      }

      // Convert PDF part to Markdown
      logger.info(`Converting PDF part ${message.partIndex + 1} to Markdown for item: ${message.itemId}`);
      logger.info(`OPTIMIZATION: Generating presigned URL from s3Key for item ${message.itemId}, part ${message.partIndex + 1}`);
      
      // Generate presigned URL from s3Key
      const s3Url = await getPdfDownloadUrl(message.s3Key);
      
      let conversionResult;
      try {
        conversionResult = await this.pdfConvertor.convertPdfToMarkdownFromS3(s3Url);
        
        // Enhanced diagnostic logging for part conversion result
        logger.info(`PDF part conversion completed for item ${message.itemId}, part ${message.partIndex + 1}. Enhanced diagnostics:`, {
          success: conversionResult.success,
          hasData: !!conversionResult.data,
          hasError: !!conversionResult.error,
          error: conversionResult.error,
          taskId: conversionResult.taskId,
          taskIdType: typeof conversionResult.taskId,
          downloadedFilesCount: conversionResult.downloadedFiles?.length || 0,
          fullConversionResult: JSON.stringify(conversionResult, null, 2)
        });
        
        if (!conversionResult.taskId || conversionResult.taskId === 'unknown') {
          logger.error(`CRITICAL: conversionResult.taskId is missing or invalid for item ${message.itemId}, part ${message.partIndex + 1}`);
          logger.error(`Full conversion result:`, JSON.stringify(conversionResult, null, 2));
        }
      } catch (conversionError) {
        logger.error(`PDF part conversion failed with error for item ${message.itemId}, part ${message.partIndex + 1}:`, conversionError);
        logger.error(`Error type:`, typeof conversionError);
        logger.error(`Error message:`, conversionError instanceof Error ? conversionError.message : String(conversionError));
        logger.error(`Error stack:`, conversionError instanceof Error ? conversionError.stack : 'No stack trace');
        throw conversionError;
      }

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
      await this.partTracker.updatePartStatus(message.itemId, message.partIndex, PdfPartStatus.COMPLETED);

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
      await this.partTracker.updatePartStatus(message.itemId, message.partIndex, PdfPartStatus.FAILED, errorMessage);

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
      logger.info(`Checking if all parts are completed for item ${itemId}`);
      
      // Check if all parts are completed
      const allCompleted = await this.partTracker.areAllPartsCompleted(itemId);
      
      if (allCompleted) {
        logger.info(`All parts completed for item ${itemId}, triggering merging`);
        
        // Get completed parts
        const completedParts = await this.partTracker.getCompletedParts(itemId);
        
        // Create and publish merging request
        const mergingRequest: PdfMergingRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_MERGING_REQUEST',
          itemId,
          totalParts,
          completedParts,
          priority: 'normal',
        };
        
        await this.rabbitMQService.publishPdfMergingRequest(mergingRequest);
        logger.info(`Published merging request for item ${itemId} with ${completedParts.length} parts`);
      } else {
        // Check if any parts failed
        const hasFailedParts = await this.partTracker.hasAnyPartFailed(itemId);
        
        if (hasFailedParts) {
          logger.warn(`Some parts failed for item ${itemId}, checking retry options`);
          
          const failedParts = await this.partTracker.getFailedParts(itemId);
          const failedPartsDetails = await this.partTracker.getFailedPartsDetails(itemId);
          
          // Check if any failed parts can be retried
          const retryableParts = failedPartsDetails.filter(part => {
            const retryCount = part.retryCount || 0;
            const maxRetries = part.maxRetries || 3;
            return retryCount < maxRetries;
          });
          
          if (retryableParts.length > 0) {
            logger.info(`Retrying ${retryableParts.length} failed parts for item ${itemId}`);
            const retriedParts = await this.partTracker.retryFailedParts(itemId);
            
            // Republish retry requests for retried parts
            for (const partIndex of retriedParts) {
              // This would require the original part conversion request details
              // For now, we'll log that retry would happen here
              logger.info(`Would retry part ${partIndex} for item ${itemId}`);
            }
          } else {
            logger.error(`All failed parts for item ${itemId} have exceeded max retries`);
            // Here you could publish a failure message or trigger a different workflow
          }
        } else {
          logger.info(`Not all parts are completed yet for item ${itemId}. Continuing to wait...`);
        }
      }
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
    pdfConvertorAvailable: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      partConsumerTag: this.partConsumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
      pdfConvertorAvailable: this.pdfConvertor !== null,
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