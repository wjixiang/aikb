import {
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  PdfProcessingStatus,
  PDF_PROCESSING_CONFIG,
  PdfMetadata,
  PdfPartInfo,
  PdfPartStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeBase/knowledgeImport/library';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { PdfSpliterWorker } from '../pdfProcess-ts/pdfSpliter';
import {
  uploadToS3,
  getPdfDownloadUrl,
  deleteFromS3,
} from '../s3Service/S3Service';

const logger = createLoggerWithPrefix('PdfAnalyzerService');

/**
 * PDF Analysis Service
 * Analyzes PDF files to determine page count and splitting requirements
 */
export class PdfAnalyzerService {
  private rabbitMQService = getRabbitMQService();
  private pdfSpliter = new PdfSpliterWorker();
  private isRunning = false;
  private partCompletedConsumerTag: string | null = null;
  private partFailedConsumerTag: string | null = null;

  constructor(private storage: AbstractLibraryStorage) {}

  /**
   * Analyze a PDF file to determine if it needs to be split
   */
  async analyzePdf(request: PdfAnalysisRequestMessage): Promise<void> {
    const startTime = Date.now();
    logger.info(`Analyzing PDF for item: ${request.itemId}`);

    try {
      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(request.itemId);
      if (!itemMetadata) {
        throw new Error(`Item ${request.itemId} not found`);
      }

      // Update item status to analyzing
      await this.updateItemStatus(
        request.itemId,
        PdfProcessingStatus.ANALYZING,
        'Analyzing PDF structure',
      );

      // Download PDF from S3 (only once for analysis)
      logger.info(`Downloading PDF from S3 for item: ${request.itemId}`);
      const pdfBuffer = await this.downloadPdfFromS3(request.s3Key);

      // Analyze PDF to get page count and metadata
      logger.info(
        `Analyzing PDF page count and metadata for item: ${request.itemId}`,
      );
      const pageCount = await this.getPageCount(pdfBuffer);
      const pdfMetadata = await this.extractPdfMetadata(
        pdfBuffer,
        request.s3Key,
      );

      if (pageCount <= 0) {
        throw new Error(`Invalid page count detected: ${pageCount}`);
      }

      // Get split threshold from message or environment variable
      const splitThreshold =
        request.splitThreshold ||
        parseInt(process.env.PDF_SPLIT_THRESHOLD || '') ||
        PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_THRESHOLD;

      // Determine if splitting is required (strictly greater than threshold)
      const requiresSplitting = pageCount > splitThreshold;
      let suggestedSplitSize: number;
      let splitParts: PdfPartInfo[] = [];

      if (requiresSplitting) {
        // If a specific split size was provided in the request, use it
        if (request.splitSize) {
          suggestedSplitSize = request.splitSize;
          logger.info(`Using splitSize from request: ${suggestedSplitSize}`);
        } else {
          // Check if we should use environment variable or default
          const envSplitSize = parseInt(process.env.PDF_SPLIT_SIZE || '');

          if (envSplitSize) {
            suggestedSplitSize = envSplitSize;
            logger.info(
              `Using splitSize from environment: ${suggestedSplitSize}`,
            );
          } else {
            // Calculate optimal split size based on page count
            // Target around 10 parts total to optimize processing
            const calculatedSplitSize = Math.ceil(pageCount / 10);

            // Use the calculated size but ensure it's within min/max bounds
            suggestedSplitSize = Math.min(
              Math.max(
                calculatedSplitSize,
                parseInt(process.env.PDF_MIN_SPLIT_SIZE || '') ||
                  PDF_PROCESSING_CONFIG.MIN_SPLIT_SIZE,
              ),
              parseInt(process.env.PDF_MAX_SPLIT_SIZE || '') ||
                PDF_PROCESSING_CONFIG.MAX_SPLIT_SIZE,
            );
            logger.info(
              `Using calculated splitSize: ${suggestedSplitSize} (pageCount=${pageCount}, calculated=${calculatedSplitSize}, min=${PDF_PROCESSING_CONFIG.MIN_SPLIT_SIZE}, max=${PDF_PROCESSING_CONFIG.MAX_SPLIT_SIZE})`,
            );
          }
        }

        logger.info(
          `PDF requires splitting for item ${request.itemId}: ${pageCount} pages, suggested split size: ${suggestedSplitSize}`,
        );

        // Update status to splitting
        await this.updateItemStatus(
          request.itemId,
          PdfProcessingStatus.SPLITTING,
          'Splitting PDF into parts',
        );

        // Split the PDF directly
        splitParts = await this.splitPdfAndUploadParts(
          request.itemId,
          request.fileName,
          pdfBuffer,
          pageCount,
          suggestedSplitSize,
        );

        logger.info(
          `PDF splitting completed for item ${request.itemId}: created ${splitParts.length} parts`,
        );
      } else {
        // Set suggestedSplitSize even when not splitting
        suggestedSplitSize =
          parseInt(process.env.PDF_SPLIT_SIZE || '') ||
          PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_SIZE;

        logger.info(
          `PDF does not require splitting for item ${request.itemId}: ${pageCount} pages`,
        );
      }

      // Update item metadata with analysis results
      const updatedMetadata = {
        ...itemMetadata,
        pageCount,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: requiresSplitting
          ? 'PDF split into parts'
          : 'PDF ready for conversion',
        dateModified: new Date(),
      };

      // Add split parts information if available
      if (requiresSplitting && splitParts.length > 0) {
        updatedMetadata.pdfSplittingInfo = {
          itemId: request.itemId,
          originalFileName: request.fileName,
          totalParts: splitParts.length,
          parts: splitParts.map((part) => ({
            partIndex: part.partIndex,
            startPage: part.startPage,
            endPage: part.endPage,
            pageCount: part.pageCount,
            s3Key: part.s3Key,
            status: part.status,
            processingTime: part.processingTime,
            error: part.error,
          })),
          processingTime: Date.now() - startTime,
        };
      }

      await this.storage.updateMetadata(updatedMetadata);

      // Publish analysis completed message with PDF metadata and S3 info
      const processingTime = Date.now() - startTime;
      await this.publishAnalysisCompleted(
        request.itemId,
        pageCount,
        requiresSplitting,
        suggestedSplitSize,
        processingTime,
        pdfMetadata,
        undefined,
        request.s3Key,
      );

      // If splitting was done, publish individual part conversion requests
      if (requiresSplitting && splitParts.length > 0) {
        await this.publishPartConversionRequests(
          request.itemId,
          request.fileName,
          splitParts,
          request.priority,
          pdfMetadata,
        );
      }

      logger.info(
        `PDF analysis completed for item: ${request.itemId}, pages: ${pageCount}, requires splitting: ${requiresSplitting}`,
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(`PDF analysis failed for item ${request.itemId}:`, error);

      // Update item status with error
      await this.updateItemStatus(
        request.itemId,
        PdfProcessingStatus.FAILED,
        `PDF analysis failed: ${errorMessage}`,
        undefined,
        errorMessage,
      );

      // Check if should retry
      const retryCount = request.retryCount || 0;
      const maxRetries = request.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;

      if (shouldRetry) {
        logger.info(
          `Retrying PDF analysis for item ${request.itemId} (attempt ${retryCount + 1}/${maxRetries})`,
        );

        // Republish the request with incremented retry count
        const retryRequest = {
          ...request,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.rabbitMQService.publishPdfAnalysisRequest(retryRequest);
      } else {
        // Publish failure message
        await this.publishAnalysisFailed(
          request.itemId,
          errorMessage,
          retryCount,
          maxRetries,
          processingTime,
        );
      }
    }
  }

  /**
   * Download PDF from S3 using s3Key
   */
  private async downloadPdfFromS3(s3Key: string): Promise<Buffer> {
    try {
      logger.info(`Attempting to download PDF from S3 using s3Key: ${s3Key}`);

      // Generate a presigned URL for downloading
      const presignedUrl = await getPdfDownloadUrl(s3Key);

      // Use axios to download the PDF using the presigned URL
      const response = await axios.get(presignedUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
      });

      logger.info(
        `Successfully downloaded PDF from S3, size: ${response.data.byteLength} bytes`,
      );
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download PDF from S3:', {
        s3Key,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        headers: (error as any)?.response?.headers,
      });
      throw new Error(
        `Failed to download PDF from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get page count from PDF buffer
   * This is a simplified implementation - in production, you would use a proper PDF library
   */
  private async getPageCount(pdfBuffer: Buffer): Promise<number> {
    try {
      // For now, we'll use a simple heuristic to estimate page count
      // In a real implementation, you would use a PDF parsing library like pdf-parse or pdf2pic

      // Simple heuristic: look for page object patterns in the PDF
      const pdfString = pdfBuffer.toString('latin1');
      const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);

      if (pageMatches && pageMatches.length > 0) {
        return pageMatches.length;
      }

      // Alternative heuristic: look for endobj patterns which often indicate pages
      const endObjMatches = pdfString.match(/endobj/g);
      if (endObjMatches && endObjMatches.length > 0) {
        // Rough estimate: assume every 10 endobj markers might be a page
        return Math.ceil(endObjMatches.length / 10);
      }

      // Fallback: estimate based on file size (very rough heuristic)
      // Average PDF page is around 50KB
      const estimatedPages = Math.ceil(pdfBuffer.length / (50 * 1024));
      return Math.max(1, Math.min(estimatedPages, 1000)); // Cap at 1000 pages
    } catch (error) {
      logger.error('Failed to get page count:', error);
      throw new Error(
        `Failed to determine page count: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Extract PDF metadata from buffer
   * This is a simplified implementation - in production, you would use a proper PDF library
   */
  private async extractPdfMetadata(
    pdfBuffer: Buffer,
    s3Key: string,
  ): Promise<PdfMetadata> {
    try {
      // For now, we'll use a simple heuristic to extract basic metadata
      // In a real implementation, you would use a PDF parsing library like pdf-parse or pdf2pic

      const pdfString = pdfBuffer.toString('latin1');

      // Extract page count (reuse existing logic)
      const pageCount = await this.getPageCount(pdfBuffer);

      // Extract title if available
      let title = '';
      const titleMatch = pdfString.match(/\/Title\s*\(([^)]+)\)/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(/\\([0-9A-Fa-f]{2})/g, (match, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
      }

      // Extract author if available
      let author = '';
      const authorMatch = pdfString.match(/\/Author\s*\(([^)]+)\)/);
      if (authorMatch && authorMatch[1]) {
        author = authorMatch[1].replace(/\\([0-9A-Fa-f]{2})/g, (match, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
      }

      // Extract creation date if available
      let creationDate = '';
      const creationDateMatch = pdfString.match(/\/CreationDate\s*\(([^)]+)\)/);
      if (creationDateMatch && creationDateMatch[1]) {
        creationDate = creationDateMatch[1];
      }

      return {
        pageCount,
        fileSize: pdfBuffer.length,
        title: title || undefined,
        author: author || undefined,
        creationDate: creationDate || undefined,
      };
    } catch (error) {
      logger.error('Failed to extract PDF metadata:', error);
      // Return basic metadata if extraction fails
      return {
        pageCount: await this.getPageCount(pdfBuffer),
        fileSize: pdfBuffer.length,
      };
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
  ): Promise<void> {
    try {
      const metadata = await this.storage.getMetadata(itemId);
      if (!metadata) {
        logger.warn(`Item ${itemId} not found for status update`);
        return;
      }

      const updates: any = {
        pdfProcessingStatus: status,
        pdfProcessingMessage: message,
        pdfProcessingProgress: progress,
        pdfProcessingError: error,
        dateModified: new Date(),
      };

      if (
        status === PdfProcessingStatus.ANALYZING &&
        !metadata.pdfProcessingStartedAt
      ) {
        updates.pdfProcessingStartedAt = new Date();
      } else if (status === PdfProcessingStatus.FAILED) {
        updates.pdfProcessingRetryCount =
          (metadata.pdfProcessingRetryCount || 0) + 1;
      }

      await this.storage.updateMetadata({ ...metadata, ...updates });
    } catch (error) {
      logger.error(`Failed to update item status for ${itemId}:`, error);
    }
  }

  /**
   * Publish analysis completed message
   */
  private async publishAnalysisCompleted(
    itemId: string,
    pageCount: number,
    requiresSplitting: boolean,
    suggestedSplitSize: number,
    processingTime: number,
    pdfMetadata?: PdfMetadata,
    s3Url?: string,
    s3Key?: string,
  ): Promise<void> {
    try {
      const completedMessage: PdfAnalysisCompletedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_COMPLETED',
        itemId,
        pageCount,
        requiresSplitting,
        suggestedSplitSize,
        processingTime,
        pdfMetadata,
        s3Key,
      };

      await this.rabbitMQService.publishPdfAnalysisCompleted(completedMessage);
    } catch (error) {
      logger.error(
        `Failed to publish analysis completed message for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Publish analysis failed message
   */
  private async publishAnalysisFailed(
    itemId: string,
    error: string,
    retryCount: number,
    maxRetries: number,
    processingTime: number,
  ): Promise<void> {
    try {
      const failedMessage: PdfAnalysisFailedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_FAILED',
        itemId,
        error,
        retryCount,
        maxRetries,
        canRetry: retryCount < maxRetries,
        processingTime,
      };

      await this.rabbitMQService.publishPdfAnalysisFailed(failedMessage);
    } catch (publishError) {
      logger.error(
        `Failed to publish analysis failed message for item ${itemId}:`,
        publishError,
      );
    }
  }

  /**
   * Split PDF and upload parts to S3
   */
  private async splitPdfAndUploadParts(
    itemId: string,
    fileName: string,
    pdfBuffer: Buffer,
    pageCount: number,
    splitSize: number,
  ): Promise<PdfPartInfo[]> {
    const splitParts: PdfPartInfo[] = [];
    const totalParts = Math.ceil(pageCount / splitSize);

    // 输出PDF相关参数和大小信息
    const fileSizeInMB = (pdfBuffer.length / (1024 * 1024)).toFixed(2);
    const avgPageSizeKB = Math.round(pdfBuffer.length / pageCount / 1024);

    logger.info(`[DEBUG] splitPdfAndUploadParts called for item ${itemId}`, {
      itemId,
      fileName,
      pdfBufferSize: pdfBuffer.length,
      pdfFileSizeMB: parseFloat(fileSizeInMB),
      pageCount,
      splitSize,
      totalParts,
      avgPageSizeKB,
      estimatedPartsSize:
        totalParts > 0 ? Math.round(pdfBuffer.length / totalParts / 1024) : 0, // KB
    });

    try {
      logger.info(`[DEBUG] Starting PDF splitting for item ${itemId}`, {
        itemId,
        pageCount,
        splitSize,
        expectedParts: totalParts,
        originalPdfSizeMB: parseFloat(fileSizeInMB),
        avgPageSizeKB,
      });

      // Split the PDF into chunks
      logger.info(`[DEBUG] Attempting to split PDF`, {
        itemId,
        pdfBufferSize: pdfBuffer.length,
        splitSize,
        pdfBufferStart: pdfBuffer.slice(0, 100).toString('latin1'),
      });

      const pdfChunks = await this.pdfSpliter.splitPdfIntoChunks(
        pdfBuffer,
        splitSize,
      );

      logger.info(`[DEBUG] PDF splitting completed successfully`, {
        itemId,
        chunksCount: pdfChunks.length,
      });

      // 计算分割后的统计信息
      const chunkStats = pdfChunks.map((chunk, index) => {
        const chunkSizeMB = (chunk.length / (1024 * 1024)).toFixed(2);
        const startPage = index * splitSize;
        const endPage = Math.min(startPage + splitSize - 1, pageCount - 1);
        const actualPageCount = endPage - startPage + 1;

        return {
          partIndex: index,
          size: chunk.length,
          sizeMB: parseFloat(chunkSizeMB),
          startPage,
          endPage,
          pageCount: actualPageCount,
          avgPageSizeInChunkKB: Math.round(
            chunk.length / actualPageCount / 1024,
          ),
        };
      });

      const totalChunkSize = pdfChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0,
      );
      const totalChunkSizeMB = (totalChunkSize / (1024 * 1024)).toFixed(2);
      const compressionRatio = (
        (totalChunkSize / pdfBuffer.length) *
        100
      ).toFixed(2);

      logger.info(`[DEBUG] PDF splitting completed for item ${itemId}`, {
        itemId,
        expectedParts: totalParts,
        actualChunks: pdfChunks.length,
        originalPdfSizeMB: parseFloat(fileSizeInMB),
        totalChunkSizeMB: parseFloat(totalChunkSizeMB),
        compressionRatio: parseFloat(compressionRatio),
        chunkStats,
      });

      if (pdfChunks.length !== totalParts) {
        logger.warn(`[DEBUG] Chunk count mismatch for item ${itemId}`, {
          itemId,
          expectedParts: totalParts,
          actualChunks: pdfChunks.length,
        });
      }

      // Upload each part to S3
      for (let i = 0; i < pdfChunks.length; i++) {
        const chunk = pdfChunks[i];
        const startPage = i * splitSize;
        const endPage = Math.min(startPage + splitSize - 1, pageCount - 1);
        const partPageCount = endPage - startPage + 1;

        // Generate S3 key for this part
        const fileExtension = fileName.split('.').pop() || 'pdf';
        const baseFileName = fileName.substring(0, fileName.lastIndexOf('.'));
        const partS3Key = `${baseFileName}_part_${i + 1}_${startPage + 1}-${endPage + 1}.${fileExtension}`;

        logger.info(
          `[DEBUG] Processing part ${i + 1}/${pdfChunks.length} for item ${itemId}`,
          {
            itemId,
            partIndex: i,
            startPage,
            endPage,
            partPageCount,
            chunkSize: chunk.length,
            partS3Key,
          },
        );

        // Convert Uint8Array to Buffer for upload
        const chunkBuffer = Buffer.from(chunk);

        logger.info(
          `[DEBUG] Starting S3 upload for part ${i + 1} of item ${itemId}`,
          {
            itemId,
            partIndex: i,
            bufferSize: chunkBuffer.length,
            s3Key: partS3Key,
          },
        );

        // Upload to S3
        const partS3Url = await uploadToS3(
          chunkBuffer,
          partS3Key,
          'application/pdf',
          'private',
        );

        logger.info(
          `[DEBUG] S3 upload completed for part ${i + 1} of item ${itemId}`,
          {
            itemId,
            partIndex: i,
            s3Url: partS3Url,
            s3Key: partS3Key,
          },
        );

        // Create part info
        const partInfo: PdfPartInfo = {
          partIndex: i,
          startPage,
          endPage,
          pageCount: partPageCount,
          s3Key: partS3Key,
          status: PdfPartStatus.PENDING,
        };

        splitParts.push(partInfo);
        logger.info(
          `[DEBUG] Part ${i + 1} processing completed for item ${itemId}`,
          {
            itemId,
            partIndex: i,
            partInfo: {
              partIndex: partInfo.partIndex,
              startPage: partInfo.startPage,
              endPage: partInfo.endPage,
              pageCount: partInfo.pageCount,
              s3Key: partInfo.s3Key,
              status: partInfo.status,
            },
          },
        );
      }

      logger.info(`[DEBUG] All parts processing completed for item ${itemId}`, {
        itemId,
        totalProcessedParts: splitParts.length,
        partsInfo: splitParts.map((part) => ({
          partIndex: part.partIndex,
          startPage: part.startPage,
          endPage: part.endPage,
          pageCount: part.pageCount,
          s3Key: part.s3Key,
          status: part.status,
        })),
      });

      return splitParts;
    } catch (error) {
      logger.error(
        `[DEBUG] Error in splitPdfAndUploadParts for item ${itemId}`,
        {
          itemId,
          fileName,
          pageCount,
          splitSize,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                }
              : error,
          processedPartsCount: splitParts.length,
        },
      );
      throw new Error(
        `Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Publish part conversion requests for each split part
   */
  private async publishPartConversionRequests(
    itemId: string,
    fileName: string,
    splitParts: PdfPartInfo[],
    priority?: 'low' | 'normal' | 'high',
    pdfMetadata?: PdfMetadata,
  ): Promise<void> {
    logger.info(
      `Publishing conversion requests for ${splitParts.length} parts of item ${itemId}`,
    );

    try {
      const totalParts = splitParts.length;

      for (const part of splitParts) {
        const partConversionRequest = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_PART_CONVERSION_REQUEST' as const,
          itemId,
          partIndex: part.partIndex,
          totalParts,
          s3Url: undefined,
          s3Key: part.s3Key,
          fileName: `${fileName}_part_${part.partIndex + 1}_pages_${part.startPage + 1}-${part.endPage + 1}.pdf`,
          startPage: part.startPage,
          endPage: part.endPage,
          priority,
          retryCount: 0,
          maxRetries: 3,
          pdfMetadata,
        };

        await this.rabbitMQService.publishPdfPartConversionRequest(
          partConversionRequest,
        );
        logger.info(
          `Published conversion request for part ${part.partIndex + 1}/${totalParts} of item ${itemId}`,
        );
      }

      logger.info(
        `Successfully published all conversion requests for item ${itemId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to publish part conversion requests for item ${itemId}:`,
        error,
      );
      throw new Error(
        `Failed to publish part conversion requests: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Start the PDF analyzer service with part cleanup functionality
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF analyzer service is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF analyzer service with part cleanup...');

      // Start consuming messages from the part conversion completed queue
      this.partCompletedConsumerTag =
        await this.rabbitMQService.consumeMessages(
          RABBITMQ_QUEUES.PDF_PART_CONVERSION_COMPLETED,
          this.handlePdfPartConversionCompleted.bind(this),
          {
            consumerTag:
              RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-part-completed',
            noAck: false, // Manual acknowledgment
          },
        );

      // Start consuming messages from the part conversion failed queue
      this.partFailedConsumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_FAILED,
        this.handlePdfPartConversionFailed.bind(this),
        {
          consumerTag:
            RABBITMQ_CONSUMER_TAGS.PDF_ANALYSIS_WORKER + '-part-failed',
          noAck: false, // Manual acknowledgment
        },
      );

      this.isRunning = true;
      logger.info(
        'PDF analyzer service with part cleanup started successfully',
      );
    } catch (error) {
      logger.error(
        'Failed to start PDF analyzer service with part cleanup:',
        error,
      );
      throw error;
    }
  }

  /**
   * Stop the PDF analyzer service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF analyzer service is not running');
      return;
    }

    try {
      logger.info('Stopping PDF analyzer service...');

      if (this.partCompletedConsumerTag) {
        await this.rabbitMQService.stopConsuming(this.partCompletedConsumerTag);
        this.partCompletedConsumerTag = null;
      }

      if (this.partFailedConsumerTag) {
        await this.rabbitMQService.stopConsuming(this.partFailedConsumerTag);
        this.partFailedConsumerTag = null;
      }

      this.isRunning = false;
      logger.info('PDF analyzer service stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF analyzer service:', error);
      throw error;
    }
  }

  /**
   * Handle PDF part conversion completed message
   */
  private async handlePdfPartConversionCompleted(
    message: PdfPartConversionCompletedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing PDF part conversion completed for item: ${message.itemId}, part: ${message.partIndex}`,
    );

    try {
      // Get the item metadata to find the S3 key for this part
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        logger.warn(`Item ${message.itemId} not found for part cleanup`);
        return;
      }

      // Check if the item has splitting information
      const splittingInfo = (itemMetadata as any).pdfSplittingInfo;
      if (!splittingInfo || !splittingInfo.parts) {
        logger.warn(
          `No splitting information found for item ${message.itemId}`,
        );
        return;
      }

      // Find the part information for this part
      const partInfo = splittingInfo.parts.find(
        (part: any) => part.partIndex === message.partIndex,
      );
      if (!partInfo || !partInfo.s3Key) {
        logger.warn(
          `No S3 key found for part ${message.partIndex} of item ${message.itemId}`,
        );
        return;
      }

      // Update the part status in metadata
      partInfo.status = PdfPartStatus.COMPLETED;
      partInfo.processingTime = message.processingTime;
      await this.storage.updateMetadata(itemMetadata);

      // Delete the PDF part from S3
      await this.deletePdfPartFromS3(
        partInfo.s3Key,
        message.itemId,
        message.partIndex,
      );

      logger.info(
        `Successfully processed PDF part conversion completed for item: ${message.itemId}, part: ${message.partIndex}`,
      );
    } catch (error) {
      logger.error(
        `Failed to process PDF part conversion completed for item ${message.itemId}, part ${message.partIndex}:`,
        error,
      );
    }
  }

  /**
   * Handle PDF part conversion failed message
   */
  private async handlePdfPartConversionFailed(
    message: PdfPartConversionFailedMessage,
    originalMessage: any,
  ): Promise<void> {
    logger.info(
      `Processing PDF part conversion failed for item: ${message.itemId}, part: ${message.partIndex}`,
    );

    try {
      // Get the item metadata to find the S3 key for this part
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        logger.warn(`Item ${message.itemId} not found for part cleanup`);
        return;
      }

      // Check if the item has splitting information
      const splittingInfo = (itemMetadata as any).pdfSplittingInfo;
      if (!splittingInfo || !splittingInfo.parts) {
        logger.warn(
          `No splitting information found for item ${message.itemId}`,
        );
        return;
      }

      // Find the part information for this part
      const partInfo = splittingInfo.parts.find(
        (part: any) => part.partIndex === message.partIndex,
      );
      if (!partInfo || !partInfo.s3Key) {
        logger.warn(
          `No S3 key found for part ${message.partIndex} of item ${message.itemId}`,
        );
        return;
      }

      // Update the part status in metadata
      partInfo.status = PdfPartStatus.FAILED;
      partInfo.error = message.error;
      partInfo.processingTime = message.processingTime;
      await this.storage.updateMetadata(itemMetadata);

      // Delete the PDF part from S3 even if it failed
      await this.deletePdfPartFromS3(
        partInfo.s3Key,
        message.itemId,
        message.partIndex,
      );

      logger.info(
        `Successfully processed PDF part conversion failed for item: ${message.itemId}, part: ${message.partIndex}`,
      );
    } catch (error) {
      logger.error(
        `Failed to process PDF part conversion failed for item ${message.itemId}, part ${message.partIndex}:`,
        error,
      );
    }
  }

  /**
   * Delete a PDF part from S3
   */
  private async deletePdfPartFromS3(
    s3Key: string,
    itemId: string,
    partIndex: number,
  ): Promise<void> {
    try {
      logger.info(
        `Deleting PDF part from S3 for item ${itemId}, part ${partIndex}, s3Key: ${s3Key}`,
      );

      const deleted = await deleteFromS3(s3Key);
      if (deleted) {
        logger.info(
          `Successfully deleted PDF part from S3 for item ${itemId}, part ${partIndex}, s3Key: ${s3Key}`,
        );
      } else {
        logger.warn(
          `Failed to delete PDF part from S3 for item ${itemId}, part ${partIndex}, s3Key: ${s3Key}`,
        );
      }
    } catch (error) {
      logger.error(
        `Error deleting PDF part from S3 for item ${itemId}, part ${partIndex}, s3Key: ${s3Key}:`,
        error,
      );
      // Don't throw here, as this is a cleanup operation
    }
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Create PDF analyzer service
 */
export function createPdfAnalyzerService(
  storage: AbstractLibraryStorage,
): PdfAnalyzerService {
  return new PdfAnalyzerService(storage);
}
