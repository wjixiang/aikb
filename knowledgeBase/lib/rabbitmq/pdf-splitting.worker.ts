import {
  PdfSplittingRequestMessage,
  PdfPartConversionRequestMessage,
  PdfProcessingStatus,
  PDF_PROCESSING_CONFIG,
  PdfPartInfo,
  PdfSplittingResult,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
  PdfPartStatus,
} from './message.types';
import { getRabbitMQService } from './rabbitmq.service';
import { AbstractLibraryStorage } from '../../knowledgeImport/liberary';
import createLoggerWithPrefix from '../logger';
import { v4 as uuidv4 } from 'uuid';
import * as axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const logger = createLoggerWithPrefix('PdfSplittingWorker');

/**
 * PDF Splitting Worker
 * Splits large PDF files into smaller parts for parallel processing
 */
export class PdfSplittingWorker {
  private rabbitMQService = getRabbitMQService();
  private consumerTag: string | null = null;
  private isRunning = false;
  private storage: AbstractLibraryStorage;

  constructor(storage: AbstractLibraryStorage) {
    this.storage = storage;
  }

  /**
   * Start the PDF splitting worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('PDF splitting worker is already running');
      return;
    }

    try {
      // Ensure RabbitMQ service is initialized
      if (!this.rabbitMQService.isConnected()) {
        await this.rabbitMQService.initialize();
      }

      logger.info('Starting PDF splitting worker...');

      // Start consuming messages from the splitting request queue
      this.consumerTag = await this.rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_SPLITTING_REQUEST,
        this.handlePdfSplittingRequest.bind(this),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.PDF_SPLITTING_WORKER,
          noAck: false, // Manual acknowledgment
        }
      );

      this.isRunning = true;
      logger.info('PDF splitting worker started successfully');
    } catch (error) {
      logger.error('Failed to start PDF splitting worker:', error);
      throw error;
    }
  }

  /**
   * Stop the PDF splitting worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('PDF splitting worker is not running');
      return;
    }

    try {
      logger.info('Stopping PDF splitting worker...');

      if (this.consumerTag) {
        await this.rabbitMQService.stopConsuming(this.consumerTag);
        this.consumerTag = null;
      }

      this.isRunning = false;
      logger.info('PDF splitting worker stopped successfully');
    } catch (error) {
      logger.error('Failed to stop PDF splitting worker:', error);
      throw error;
    }
  }

  /**
   * Handle PDF splitting request
   */
  private async handlePdfSplittingRequest(
    message: PdfSplittingRequestMessage,
    originalMessage: any
  ): Promise<void> {
    const startTime = Date.now();
    logger.info(`Processing PDF splitting request for item: ${message.itemId}`);

    try {
      // Get the item metadata
      const itemMetadata = await this.storage.getMetadata(message.itemId);
      if (!itemMetadata) {
        throw new Error(`Item ${message.itemId} not found`);
      }

      // Update item status to splitting
      await this.updateItemStatus(message.itemId, PdfProcessingStatus.SPLITTING, 'Splitting PDF into parts');

      // Download PDF from S3
      logger.info(`Downloading PDF from S3 for item: ${message.itemId}`);
      const pdfBuffer = await this.downloadPdfFromS3(message.s3Url);

      // Create temporary directory for splitting
      const tempDir = await this.createTempDirectory();
      const originalPdfPath = path.join(tempDir, 'original.pdf');
      fs.writeFileSync(originalPdfPath, pdfBuffer);

      try {
        // Split PDF into parts
        logger.info(`Splitting PDF for item: ${message.itemId}`);
        const splittingResult = await this.splitPdf(
          originalPdfPath,
          tempDir,
          message.itemId,
          message.fileName,
          message.pageCount,
          message.splitSize
        );

        // Upload split parts to S3
        logger.info(`Uploading split parts to S3 for item: ${message.itemId}`);
        const uploadedParts = await this.uploadSplitPartsToS3(splittingResult.parts, tempDir, message.itemId);

        // Save splitting metadata
        await this.saveSplittingMetadata(message.itemId, {
          ...splittingResult,
          parts: uploadedParts,
        });

        // Update item status
        await this.updateItemStatus(
          message.itemId,
          PdfProcessingStatus.PROCESSING,
          `PDF split into ${splittingResult.totalParts} parts`
        );

        // Send part conversion requests for each part
        await this.sendPartConversionRequests(message.itemId, uploadedParts, message);

        const processingTime = Date.now() - startTime;
        logger.info(`PDF splitting completed for item: ${message.itemId}, parts: ${splittingResult.totalParts}, time: ${processingTime}ms`);

      } finally {
        // Clean up temporary directory
        await this.cleanupTempDirectory(tempDir);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`PDF splitting failed for item ${message.itemId}:`, error);

      // Update item status with error
      await this.updateItemStatus(
        message.itemId,
        PdfProcessingStatus.FAILED,
        `PDF splitting failed: ${errorMessage}`,
        undefined,
        errorMessage
      );

      // Check if should retry
      const retryCount = message.retryCount || 0;
      const maxRetries = message.maxRetries || 3;
      const shouldRetry = retryCount < maxRetries;
      
      if (shouldRetry) {
        logger.info(`Retrying PDF splitting for item ${message.itemId} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Republish the request with incremented retry count
        const retryRequest = {
          ...message,
          messageId: uuidv4(),
          timestamp: Date.now(),
          retryCount: retryCount + 1,
        };

        await this.rabbitMQService.publishPdfSplittingRequest(retryRequest);
      } else {
        logger.error(`Max retries reached for PDF splitting of item ${message.itemId}`);
      }
    }
  }

  /**
   * Download PDF from S3 URL
   */
  private async downloadPdfFromS3(s3Url: string): Promise<Buffer> {
    try {
      const response = await axios.default.get(s3Url, {
        responseType: 'arraybuffer',
        timeout: 60000, // 60 seconds timeout for large files
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Failed to download PDF from S3:', error);
      throw new Error(`Failed to download PDF from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create temporary directory for PDF splitting
   */
  private async createTempDirectory(): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp', `pdf-split-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Clean up temporary directory
   */
  private async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      logger.warn(`Failed to cleanup temporary directory ${tempDir}:`, error);
    }
  }

  /**
   * Split PDF into parts using Python script
   */
  private async splitPdf(
    pdfPath: string,
    outputDir: string,
    itemId: string,
    fileName: string,
    pageCount: number,
    splitSize: number
  ): Promise<PdfSplittingResult> {
    try {
      // Calculate number of parts needed
      const totalParts = Math.ceil(pageCount / splitSize);
      const parts: PdfPartInfo[] = [];

      // Create Python script for PDF splitting
      const pythonScript = `
import sys
import os
from PyPDF2 import PdfReader, PdfWriter

def split_pdf(input_path, output_dir, split_size):
    reader = PdfReader(input_path)
    total_pages = len(reader.pages)
    total_parts = (total_pages + split_size - 1) // split_size
    
    parts = []
    
    for part_index in range(total_parts):
        start_page = part_index * split_size
        end_page = min((part_index + 1) * split_size, total_pages)
        
        writer = PdfWriter()
        for page_num in range(start_page, end_page):
            writer.add_page(reader.pages[page_num])
        
        part_filename = f"part_{part_index + 1:03d}.pdf"
        part_path = os.path.join(output_dir, part_filename)
        
        with open(part_path, 'wb') as output_file:
            writer.write(output_file)
        
        parts.append({
            'part_index': part_index,
            'start_page': start_page + 1,  # 1-based indexing
            'end_page': end_page,  # 1-based indexing
            'page_count': end_page - start_page,
            'filename': part_filename,
            'path': part_path
        })
    
    return parts

if __name__ == "__main__":
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    split_size = int(sys.argv[3])
    
    parts = split_pdf(input_path, output_dir, split_size)
    print(f"Created {len(parts)} parts")
    for part in parts:
        print(f"Part {part['part_index'] + 1}: pages {part['start_page']}-{part['end_page']} ({part['page_count']} pages)")
`;

      // Write Python script to file
      const scriptPath = path.join(outputDir, 'split_pdf.py');
      fs.writeFileSync(scriptPath, pythonScript);

      // Execute Python script
      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${pdfPath}" "${outputDir}" ${splitSize}`);

      if (stderr) {
        logger.warn('PDF splitting script stderr:', stderr);
      }

      logger.info('PDF splitting script output:', stdout);

      // Parse the output to create part information
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (line.startsWith('Part ')) {
          const match = line.match(/Part (\d+): pages (\d+)-(\d+) \((\d+) pages\)/);
          if (match) {
            const partIndex = parseInt(match[1]) - 1; // Convert to 0-based
            const startPage = parseInt(match[2]);
            const endPage = parseInt(match[3]);
            const pageCount = parseInt(match[4]);
            const filename = `part_${partIndex + 1}.pdf`;
            const partPath = path.join(outputDir, filename);

            parts.push({
              partIndex,
              startPage,
              endPage,
              pageCount,
              s3Key: '', // Will be filled after upload
              s3Url: '', // Will be filled after upload
              status: PdfPartStatus.PENDING,
            });
          }
        }
      }

      if (parts.length === 0) {
        throw new Error('No parts were created during PDF splitting');
      }

      return {
        itemId,
        originalFileName: fileName,
        totalParts: parts.length,
        parts,
        processingTime: 0, // Will be updated by caller
      };

    } catch (error) {
      logger.error('Failed to split PDF:', error);
      throw new Error(`PDF splitting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload split parts to S3
   */
  private async uploadSplitPartsToS3(parts: PdfPartInfo[], tempDir: string, itemId: string): Promise<PdfPartInfo[]> {
    const uploadedParts: PdfPartInfo[] = [];

    for (const part of parts) {
      try {
        const partPath = path.join(tempDir, `part_${part.partIndex + 1}.pdf`);
        const partBuffer = fs.readFileSync(partPath);

        // Generate S3 key for the part
        const s3Key = `pdf-parts/${itemId}/part_${part.partIndex + 1}.pdf`;

        // Upload to S3
        const uploadResult = await this.storage.uploadPdf(partBuffer, `part_${part.partIndex + 1}.pdf`);

        uploadedParts.push({
          ...part,
          s3Key: uploadResult.s3Key,
          s3Url: uploadResult.url,
        });

        logger.info(`Uploaded part ${part.partIndex + 1} to S3: ${uploadResult.s3Key}`);
      } catch (error) {
        logger.error(`Failed to upload part ${part.partIndex + 1} to S3:`, error);
        throw new Error(`Failed to upload part ${part.partIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return uploadedParts;
  }

  /**
   * Save splitting metadata to storage
   */
  private async saveSplittingMetadata(itemId: string, splittingResult: PdfSplittingResult): Promise<void> {
    try {
      // In a real implementation, you would save this to a separate collection
      // For now, we'll store it as part of the item metadata
      const itemMetadata = await this.storage.getMetadata(itemId);
      if (itemMetadata) {
        await this.storage.updateMetadata({
          ...itemMetadata,
          // Store splitting info in a custom field (would need to be added to BookMetadata interface)
          ...(itemMetadata as any).pdfSplittingInfo ? { pdfSplittingInfo: splittingResult } : {},
          dateModified: new Date(),
        });
      }
    } catch (error) {
      logger.error(`Failed to save splitting metadata for item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Send part conversion requests for each part
   */
  private async sendPartConversionRequests(
    itemId: string,
    parts: PdfPartInfo[],
    originalRequest: PdfSplittingRequestMessage
  ): Promise<void> {
    const concurrentLimit = PDF_PROCESSING_CONFIG.CONCURRENT_PART_PROCESSING;
    
    // Process parts in batches to avoid overwhelming the system
    for (let i = 0; i < parts.length; i += concurrentLimit) {
      const batch = parts.slice(i, i + concurrentLimit);
      
      const promises = batch.map(async (part) => {
        const partRequest: PdfPartConversionRequestMessage = {
          messageId: uuidv4(),
          timestamp: Date.now(),
          eventType: 'PDF_PART_CONVERSION_REQUEST',
          itemId,
          partIndex: part.partIndex,
          totalParts: parts.length,
          s3Url: part.s3Url,
          s3Key: part.s3Key,
          fileName: `${originalRequest.fileName}_part_${part.partIndex + 1}`,
          startPage: part.startPage,
          endPage: part.endPage,
          priority: originalRequest.priority,
          retryCount: 0,
          maxRetries: originalRequest.maxRetries,
        };

        await this.rabbitMQService.publishPdfPartConversionRequest(partRequest);
        logger.info(`Sent part conversion request for item ${itemId}, part ${part.partIndex + 1}/${parts.length}`);
      });

      await Promise.all(promises);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + concurrentLimit < parts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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

      if (status === PdfProcessingStatus.FAILED) {
        updates.pdfProcessingRetryCount = (metadata.pdfProcessingRetryCount || 0) + 1;
      }

      await this.storage.updateMetadata({ ...metadata, ...updates });
    } catch (error) {
      logger.error(`Failed to update item status for ${itemId}:`, error);
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
    rabbitMQConnected: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      consumerTag: this.consumerTag,
      rabbitMQConnected: this.rabbitMQService.isConnected(),
    };
  }
}

/**
 * Create and start a PDF splitting worker
 */
export async function createPdfSplittingWorker(
  storage: AbstractLibraryStorage
): Promise<PdfSplittingWorker> {
  const worker = new PdfSplittingWorker(storage);
  await worker.start();
  return worker;
}

/**
 * Stop a PDF splitting worker
 */
export async function stopPdfSplittingWorker(worker: PdfSplittingWorker): Promise<void> {
  await worker.stop();
}