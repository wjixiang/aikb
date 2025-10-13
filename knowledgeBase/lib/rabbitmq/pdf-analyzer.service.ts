import {
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfProcessingStatus,
  PDF_PROCESSING_CONFIG,
  PdfMetadata,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeImport/library';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';
import * as axios from 'axios';

const logger = createLoggerWithPrefix('PdfAnalyzerService');

/**
 * PDF Analysis Service
 * Analyzes PDF files to determine page count and splitting requirements
 */
export class PdfAnalyzerService {
  private rabbitMQService = getRabbitMQService();

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
      await this.updateItemStatus(request.itemId, PdfProcessingStatus.ANALYZING, 'Analyzing PDF structure');

      // Download PDF from S3 (only once for analysis)
      logger.info(`Downloading PDF from S3 for item: ${request.itemId}`);
      const pdfBuffer = await this.downloadPdfFromS3(request.s3Url);

      // Analyze PDF to get page count and metadata
      logger.info(`Analyzing PDF page count and metadata for item: ${request.itemId}`);
      const pageCount = await this.getPageCount(pdfBuffer);
      const pdfMetadata = await this.extractPdfMetadata(pdfBuffer, request.s3Url);

      if (pageCount <= 0) {
        throw new Error(`Invalid page count detected: ${pageCount}`);
      }

      // Determine if splitting is required
      const requiresSplitting = pageCount > PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_THRESHOLD;
      let suggestedSplitSize: number = PDF_PROCESSING_CONFIG.DEFAULT_SPLIT_SIZE;

      if (requiresSplitting) {
        // Calculate optimal split size based on page count
        suggestedSplitSize = Math.min(
          Math.max(
            Math.ceil(pageCount / 10), // Aim for around 10 parts max
            PDF_PROCESSING_CONFIG.MIN_SPLIT_SIZE
          ),
          PDF_PROCESSING_CONFIG.MAX_SPLIT_SIZE
        );
        
        logger.info(`PDF requires splitting for item ${request.itemId}: ${pageCount} pages, suggested split size: ${suggestedSplitSize}`);
      } else {
        logger.info(`PDF does not require splitting for item ${request.itemId}: ${pageCount} pages`);

        
      }

      // Update item metadata with analysis results
      await this.storage.updateMetadata({
        ...itemMetadata,
        pageCount,
        pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
        pdfProcessingMessage: requiresSplitting ? 'PDF requires splitting' : 'PDF ready for conversion',
        dateModified: new Date(),
      });

      // Publish analysis completed message with PDF metadata and S3 info
      const processingTime = Date.now() - startTime;
      await this.publishAnalysisCompleted(request.itemId, pageCount, requiresSplitting, suggestedSplitSize, processingTime, pdfMetadata, request.s3Url, request.s3Key);

      logger.info(`PDF analysis completed for item: ${request.itemId}, pages: ${pageCount}, requires splitting: ${requiresSplitting}`);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`PDF analysis failed for item ${request.itemId}:`, error);

      // Update item status with error
      await this.updateItemStatus(
        request.itemId,
        PdfProcessingStatus.FAILED,
        `PDF analysis failed: ${errorMessage}`,
        undefined,
        errorMessage
      );

      // Check if should retry
      const retryCount = request.retryCount || 0;
      const maxRetries = request.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;
      
      if (shouldRetry) {
        logger.info(`Retrying PDF analysis for item ${request.itemId} (attempt ${retryCount + 1}/${maxRetries})`);
        
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
        await this.publishAnalysisFailed(request.itemId, errorMessage, retryCount, maxRetries, processingTime);
      }
    }
  }

  /**
   * Download PDF from S3 URL
   */
  private async downloadPdfFromS3(s3Url: string): Promise<Buffer> {
    try {
      logger.info(`Attempting to download PDF from presigned S3 URL: ${s3Url}`);
      
      // The s3Url should now be a presigned URL that includes authentication
      // No need for AWS SDK credentials, just use axios to download
      const response = await axios.default.get(s3Url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
      });

      logger.info(`Successfully downloaded PDF from presigned S3 URL, size: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download PDF from presigned S3 URL:', {
        url: s3Url,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        headers: (error as any)?.response?.headers
      });
      throw new Error(`Failed to download PDF from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to determine page count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract PDF metadata from buffer
   * This is a simplified implementation - in production, you would use a proper PDF library
   */
  private async extractPdfMetadata(pdfBuffer: Buffer, s3Url: string): Promise<PdfMetadata> {
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
          String.fromCharCode(parseInt(hex, 16))
        );
      }
      
      // Extract author if available
      let author = '';
      const authorMatch = pdfString.match(/\/Author\s*\(([^)]+)\)/);
      if (authorMatch && authorMatch[1]) {
        author = authorMatch[1].replace(/\\([0-9A-Fa-f]{2})/g, (match, hex) => 
          String.fromCharCode(parseInt(hex, 16))
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
    error?: string
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

      if (status === PdfProcessingStatus.ANALYZING && !metadata.pdfProcessingStartedAt) {
        updates.pdfProcessingStartedAt = new Date();
      } else if (status === PdfProcessingStatus.FAILED) {
        updates.pdfProcessingRetryCount = (metadata.pdfProcessingRetryCount || 0) + 1;
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
    s3Key?: string
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
        s3Url,
        s3Key,
      };

      await this.rabbitMQService.publishPdfAnalysisCompleted(completedMessage);
    } catch (error) {
      logger.error(`Failed to publish analysis completed message for item ${itemId}:`, error);
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
    processingTime: number
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
      logger.error(`Failed to publish analysis failed message for item ${itemId}:`, publishError);
    }
  }
}

/**
 * Create PDF analyzer service
 */
export function createPdfAnalyzerService(storage: AbstractLibraryStorage): PdfAnalyzerService {
  return new PdfAnalyzerService(storage);
}