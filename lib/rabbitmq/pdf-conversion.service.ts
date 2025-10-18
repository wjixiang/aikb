import {
  ConversionResult,
  MinerUPdfConvertor,
  createMinerUConvertorFromEnv,
} from '../../knowledgeBase/knowledgeImport/PdfConvertor';
import { getPdfDownloadUrl } from '../s3Service/S3Service';
import { IPdfPartTracker } from './pdf-part-tracker';
import { MarkdownPartCache } from './markdown-part-cache';
import {
  IPdfConversionService,
  PdfConversionRequest,
  PdfPartConversionRequest,
  PdfConversionResult,
  PdfPartConversionResult,
  ProgressCallback,
} from './pdf-conversion.service.interface';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('PdfConversionService');

/**
 * PDF Conversion Service implementation
 * Handles the core PDF conversion functionality
 */
export class PdfConversionService implements IPdfConversionService {
  private pdfConvertor: MinerUPdfConvertor | null = null;
  private partTracker: IPdfPartTracker;
  private markdownPartCache: MarkdownPartCache;
  private isInitialized = false;

  constructor(
    pdfConvertor?: MinerUPdfConvertor,
    partTracker?: IPdfPartTracker,
    markdownPartCache?: MarkdownPartCache,
  ) {
    this.pdfConvertor = pdfConvertor || createMinerUConvertorFromEnv();
    // Note: These would be injected in a real implementation
    // For now, we'll use factory functions
    this.partTracker = partTracker || (null as any);
    this.markdownPartCache = markdownPartCache || (null as any);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('PDF conversion service is already initialized');
      return;
    }

    try {
      // Initialize markdown part cache if provided
      if (this.markdownPartCache) {
        logger.info('Initializing Markdown Part Cache...');
        await this.markdownPartCache.initialize();
        logger.info('Markdown Part Cache initialized successfully');
      }

      this.isInitialized = true;
      logger.info('PDF conversion service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PDF conversion service:', error);
      throw error;
    }
  }

  /**
   * Convert a PDF file to Markdown
   */
  async convertPdfToMarkdown(
    request: PdfConversionRequest,
    onProgress?: ProgressCallback,
  ): Promise<PdfConversionResult> {
    const startTime = Date.now();
    const { itemId, s3Key, pdfMetadata } = request;

    logger.info(`Converting PDF to Markdown for item: ${itemId}, S3 Key: ${s3Key}`);

    try {
      // Notify progress if callback provided
      if (onProgress) {
        await onProgress(itemId, 'processing', 10, 'Preparing PDF conversion');
      }

      // Check if PDF converter is available
      if (!this.pdfConvertor) {
        throw new Error('PDF converter not available');
      }

      // Log PDF metadata if available
      if (pdfMetadata) {
        logger.info(
          `Using PDF metadata from analysis phase for item ${itemId}:`,
          {
            pageCount: pdfMetadata.pageCount,
            fileSize: pdfMetadata.fileSize,
            title: pdfMetadata.title,
            author: pdfMetadata.author,
          },
        );
        logger.info(
          `OPTIMIZATION: Skipping PDF analysis for item ${itemId} - using metadata from previous analysis`,
        );
      } else {
        logger.info(
          `No PDF metadata available for item ${itemId} - will analyze during conversion`,
        );
      }

      // Notify progress
      if (onProgress) {
        await onProgress(itemId, 'processing', 30, 'Converting PDF to Markdown');
      }

      // Generate presigned URL from s3Key
      const s3Url = await getPdfDownloadUrl(s3Key);
      logger.info(
        `Starting PDF conversion with generated S3 URL for item ${itemId}`,
      );

      // Convert PDF to Markdown
      let conversionResult: ConversionResult;
      try {
        conversionResult =
          await this.pdfConvertor.convertPdfToMarkdownFromS3(s3Url);

        // Enhanced diagnostic logging for conversion result
        logger.info(
          `PDF conversion completed for item ${itemId}. Enhanced result diagnostics: ${JSON.stringify(
            {
              success: conversionResult.success,
              hasData: !!conversionResult.data,
              hasError: !!conversionResult.error,
              error: conversionResult.error,
              taskId: conversionResult.taskId,
              taskIdType: typeof conversionResult.taskId,
              downloadedFilesCount:
                conversionResult.downloadedFiles?.length || 0,
            },
            null,
            2,
          )}`,
        );

        if (!conversionResult.taskId || conversionResult.taskId === 'unknown') {
          logger.error(
            `CRITICAL: conversionResult.taskId is missing or invalid for item ${itemId}`,
          );
          logger.error(
            `Full conversion result:`,
            JSON.stringify(conversionResult, null, 2),
          );
        }
      } catch (conversionError) {
        logger.error(
          `PDF conversion failed with error for item ${itemId}:`,
          conversionError,
        );
        logger.error(`Error type:`, typeof conversionError);
        logger.error(
          `Error message:`,
          conversionError instanceof Error
            ? conversionError.message
            : String(conversionError),
        );
        logger.error(
          `Error stack:`,
          conversionError instanceof Error
            ? conversionError.stack
            : 'No stack trace',
        );
        throw conversionError;
      }

      if (!conversionResult.success || !conversionResult.data) {
        logger.error(
          `PDF conversion failed for item ${itemId}: ${JSON.stringify(
            {
              success: conversionResult.success,
              hasData: !!conversionResult.data,
              error: conversionResult.error,
              taskId: conversionResult.taskId,
            },
            null,
            2,
          )}`,
        );
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

      const processingTime = Date.now() - startTime;
      
      logger.info(
        `PDF conversion completed successfully for item: ${itemId}`,
      );

      return {
        success: true,
        markdownContent,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `PDF conversion failed for item ${itemId}: ${JSON.stringify(error)}`,
      );

      return {
        success: false,
        markdownContent: '',
        processingTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert a part of a PDF file to Markdown
   */
  async convertPdfPartToMarkdown(
    request: PdfPartConversionRequest,
    onProgress?: ProgressCallback,
  ): Promise<PdfPartConversionResult> {
    const startTime = Date.now();
    const { itemId, s3Key, partIndex, totalParts, pdfMetadata } = request;

    logger.info(
      `Converting PDF part ${partIndex + 1} to Markdown for item: ${itemId}`,
    );

    try {
      // Initialize PDF processing if not already done
      if (this.partTracker) {
        const processingStatus = await this.partTracker.getPdfProcessingStatus(
          itemId,
        );
        if (!processingStatus) {
          logger.info(`Initializing PDF processing for item ${itemId}`);
          await this.partTracker.initializePdfProcessing(itemId, totalParts);
        }

        // Update part status to processing
        await this.partTracker.updatePartStatus(
          itemId,
          partIndex,
          'processing' as any,
        );
      }

      // Log PDF metadata if available
      if (pdfMetadata) {
        logger.info(
          `Using PDF metadata from analysis phase for item ${itemId}, part ${partIndex + 1}:`,
          {
            pageCount: pdfMetadata.pageCount,
            fileSize: pdfMetadata.fileSize,
            title: pdfMetadata.title,
            author: pdfMetadata.author,
          },
        );
        logger.info(
          `OPTIMIZATION: Skipping PDF analysis for item ${itemId}, part ${partIndex + 1} - using metadata from previous analysis`,
        );
      }

      // Check if PDF converter is available
      if (!this.pdfConvertor) {
        throw new Error('PDF converter not available');
      }

      // Notify progress
      if (onProgress) {
        await onProgress(
          itemId,
          'processing',
          30,
          `Converting PDF part ${partIndex + 1} to Markdown`,
        );
      }

      // Generate presigned URL from s3Key
      const s3Url = await getPdfDownloadUrl(s3Key);
      logger.info(
        `OPTIMIZATION: Generating presigned URL from s3Key for item ${itemId}, part ${partIndex + 1}`,
      );

      // Convert PDF part to Markdown
      let conversionResult: ConversionResult;
      try {
        conversionResult =
          await this.pdfConvertor.convertPdfToMarkdownFromS3(s3Url);

        // Enhanced diagnostic logging for part conversion result
        logger.info(
          `PDF part conversion completed for item ${itemId}, part ${partIndex + 1}. Enhanced diagnostics:`,
          {
            success: conversionResult.success,
            hasData: !!conversionResult.data,
            hasError: !!conversionResult.error,
            error: conversionResult.error,
            taskId: conversionResult.taskId,
            taskIdType: typeof conversionResult.taskId,
            downloadedFilesCount: conversionResult.downloadedFiles?.length || 0,
          },
        );

        if (!conversionResult.taskId || conversionResult.taskId === 'unknown') {
          logger.error(
            `CRITICAL: conversionResult.taskId is missing or invalid for item ${itemId}, part ${partIndex + 1}`,
          );
          logger.error(
            `Full conversion result:`,
            JSON.stringify(conversionResult, null, 2),
          );
        }
      } catch (conversionError) {
        logger.error(
          `PDF part conversion failed with error for item ${itemId}, part ${partIndex + 1}:`,
          conversionError,
        );
        logger.error(`Error type:`, typeof conversionError);
        logger.error(
          `Error message:`,
          conversionError instanceof Error
            ? conversionError.message
            : String(conversionError),
        );
        logger.error(
          `Error stack:`,
          conversionError instanceof Error
            ? conversionError.stack
            : 'No stack trace',
        );
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

      // Update part status to completed in tracker
      if (this.partTracker) {
        await this.partTracker.updatePartStatus(
          itemId,
          partIndex,
          'completed' as any,
        );
      }

      const processingTime = Date.now() - startTime;
      
      logger.info(
        `PDF part conversion completed for item: ${itemId}, part: ${partIndex + 1}`,
      );

      return {
        success: true,
        markdownContent,
        processingTime,
        partIndex,
        totalParts,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        `PDF part conversion failed for item ${itemId}, part ${partIndex + 1}:`,
        error,
      );

      // Update part status with error
      if (this.partTracker) {
        await this.partTracker.updatePartStatus(
          itemId,
          partIndex,
          'failed' as any,
          errorMessage,
        );
      }

      return {
        success: false,
        markdownContent: '',
        processingTime,
        partIndex,
        totalParts,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.pdfConvertor !== null;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    isReady: boolean;
    pdfConvertorAvailable: boolean;
  } {
    return {
      isReady: this.isReady(),
      pdfConvertorAvailable: this.pdfConvertor !== null,
    };
  }
}