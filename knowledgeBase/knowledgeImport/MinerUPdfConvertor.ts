import { AbstractPdfConvertor } from './PdfConvertor';
import { MinerUClient, SingleFileRequest, TaskResult } from './MinerUClient';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import * as zlib from 'zlib';
import { uploadPdfFromPath } from 'knowledgeBase/lib/s3Service/S3Service';
import createLoggerWithPrefix from 'knowledgeBase/lib/logger';

/**
 * MinerU-based PDF converter implementation
 * Extends AbstractPdfConvertor to provide MinerU API integration
 */

export interface MinerUPdfConvertorConfig {
  token: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  defaultOptions?: Partial<SingleFileRequest>;
  downloadDir?: string;
}

export interface ConversionResult {
  success: boolean;
  data?: any;
  error?: string;
  downloadedFiles?: string[];
  taskId?: string;
}

export class MinerUPdfConvertor extends AbstractPdfConvertor {
  private logger = createLoggerWithPrefix("MinerUPdfConvertor")
  private client: MinerUClient;
  private config: Required<Omit<MinerUPdfConvertorConfig, 'defaultOptions'>> & {
    defaultOptions: Partial<SingleFileRequest>;
  };

  constructor(config: MinerUPdfConvertorConfig) {
    super();
    
    this.config = {
      baseUrl: 'https://mineru.net/api/v4',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      downloadDir: './mineru-downloads',
      defaultOptions: {
        is_ocr: false,
        enable_formula: true,
        enable_table: true,
        language: 'ch',
        model_version: 'pipeline'
      },
      ...config
    };

    this.client = new MinerUClient({
      token: this.config.token,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    });

    // Ensure download directory exists
    if (!fs.existsSync(this.config.downloadDir)) {
      fs.mkdirSync(this.config.downloadDir, { recursive: true });
    }
  }

  /**
   * Convert PDF file to JSON using MinerU API
   * @param pdfPath Path to the PDF file or URL
   * @param options Conversion options
   * @returns Promise<ConversionResult>
   */
  async convertPdfToJSON(
    pdfPath: string,
    options: Partial<SingleFileRequest> = {}
  ): Promise<ConversionResult> {
    try {
      console.log(`[MinerUPdfConvertor] convertPdfToJSON: pdfPath=${pdfPath}`);
      
      // Determine if pdfPath is a URL or local file
      const isUrl = pdfPath.startsWith('http://') || pdfPath.startsWith('https://');
      console.log(`[MinerUPdfConvertor] Is URL: ${isUrl}`);
      
      let request: SingleFileRequest;
      
      if (isUrl) {
        // Use URL directly
        console.log(`[MinerUPdfConvertor] Using URL directly: ${pdfPath}`);
        request = {
          url: pdfPath,
          ...this.config.defaultOptions,
          ...options
        };
      } else {
        // For local files, we need to handle file upload
        console.log(`[MinerUPdfConvertor] Processing local file: ${pdfPath}`);
        if (!fs.existsSync(pdfPath)) {
          console.error(`[MinerUPdfConvertor] File not found: ${pdfPath}`);
          return {
            success: false,
            error: `File not found: ${pdfPath}`
          };
        }

        // Validate file format
        if (!MinerUClient.isValidFileFormat(pdfPath)) {
          console.error(`[MinerUPdfConvertor] Unsupported file format: ${pdfPath}`);
          return {
            success: false,
            error: `Unsupported file format: ${pdfPath}`
          };
        }
        
        console.log(`[MinerUPdfConvertor] Uploading to S3...`);
        const s3Url = await uploadPdfFromPath(pdfPath);
        console.log(`[MinerUPdfConvertor] S3 upload successful: ${s3Url}`);
        
        request = {
          url: s3Url,
          ...this.config.defaultOptions,
          ...options
        };

        this.logger.debug(`update pdf to s3 successfully: ${JSON.stringify(request)}`)
      }

      console.log(`[MinerUPdfConvertor] Processing file with MinerU...`);
      // Process the file
      const result = await this.client.processSingleFile(request, {
        downloadDir: this.config.downloadDir
      });
      console.log(`[MinerUPdfConvertor] MinerU processing completed, taskId: ${result.result.task_id}`);

      console.log(`[MinerUPdfConvertor] Extracting JSON from downloaded files...`);
      // Extract and parse the JSON content
      const jsonData = await this.extractJsonFromDownloadedFiles(result.downloadedFiles || []);
      console.log(`[MinerUPdfConvertor] JSON extraction completed`);

      return {
        success: true,
        data: jsonData,
        downloadedFiles: result.downloadedFiles,
        taskId: result.result.task_id
      };

    } catch (error) {
      console.error(`[MinerUPdfConvertor] Error in convertPdfToJSON:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Process local PDF file using batch upload
   * @param filePath Path to the local PDF file
   * @param options Processing options
   * @returns Promise<ConversionResult>
   */
  async processLocalFile(
    filePath: string,
    options: Partial<SingleFileRequest> = {}
  ): Promise<ConversionResult> {
    try {
      console.log(`[MinerUPdfConvertor] processLocalFile: filePath=${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`[MinerUPdfConvertor] File not found: ${filePath}`);
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      if (!MinerUClient.isValidFileFormat(filePath)) {
        console.error(`[MinerUPdfConvertor] Unsupported file format: ${filePath}`);
        return {
          success: false,
          error: `Unsupported file format: ${filePath}`
        };
      }

      console.log(`[MinerUPdfConvertor] Starting batch file upload...`);
      // Process using batch file upload
      const batchResult = await this.client.processBatchFiles([{
        filePath,
        is_ocr: options.is_ocr,
        data_id: options.data_id,
        page_ranges: options.page_ranges
      }], {
        enable_formula: options.enable_formula ?? this.config.defaultOptions.enable_formula,
        enable_table: options.enable_table ?? this.config.defaultOptions.enable_table,
        language: options.language ?? this.config.defaultOptions.language,
        model_version: options.model_version ?? this.config.defaultOptions.model_version,
        extra_formats: options.extra_formats,
        callback: options.callback,
        seed: options.seed
      });
      console.log(`[MinerUPdfConvertor] Batch upload completed, batchId: ${batchResult.batchId}`);

      console.log(`[MinerUPdfConvertor] Waiting for batch task completion...`);
      // Wait for completion
      const taskResult = await this.client.waitForBatchTaskCompletion(batchResult.batchId, {
        downloadDir: this.config.downloadDir
      });
      console.log(`[MinerUPdfConvertor] Batch task completed`);

      // Extract results
      const result = taskResult.results.extract_result[0];
      console.log(`[MinerUPdfConvertor] Task result state: ${result.state}`);
      
      if (result.state === 'failed') {
        console.error(`[MinerUPdfConvertor] Task failed: ${result.err_msg}`);
        return {
          success: false,
          error: result.err_msg || 'Processing failed',
          taskId: result.task_id
        };
      }

      console.log(`[MinerUPdfConvertor] Extracting JSON from downloaded files...`);
      // Extract and parse the JSON content
      const jsonData = await this.extractJsonFromDownloadedFiles(taskResult.downloadedFiles);

      return {
        success: true,
        data: jsonData,
        downloadedFiles: taskResult.downloadedFiles,
        taskId: result.task_id
      };

    } catch (error) {
      console.error(`[MinerUPdfConvertor] Error in processLocalFile:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Process multiple local files
   * @param filePaths Array of file paths
   * @param options Processing options
   * @returns Promise<ConversionResult[]>
   */
  async processMultipleFiles(
    filePaths: string[],
    options: Partial<SingleFileRequest> = {}
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];

    try {
      // Validate all files first
      const validFiles = filePaths.filter(filePath => {
        if (!fs.existsSync(filePath)) {
          results.push({
            success: false,
            error: `File not found: ${filePath}`
          });
          return false;
        }

        if (!MinerUClient.isValidFileFormat(filePath)) {
          results.push({
            success: false,
            error: `Unsupported file format: ${filePath}`
          });
          return false;
        }

        return true;
      });

      if (validFiles.length === 0) {
        return results;
      }

      // Process files in batches (max 200 per API limit)
      const batchSize = 200;
      const batches: string[][] = [];
      
      for (let i = 0; i < validFiles.length; i += batchSize) {
        batches.push(validFiles.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchResult = await this.client.processBatchFiles(
          batch.map(filePath => ({
            filePath,
            is_ocr: options.is_ocr,
            data_id: options.data_id,
            page_ranges: options.page_ranges
          })),
          {
            enable_formula: options.enable_formula ?? this.config.defaultOptions.enable_formula,
            enable_table: options.enable_table ?? this.config.defaultOptions.enable_table,
            language: options.language ?? this.config.defaultOptions.language,
            model_version: options.model_version ?? this.config.defaultOptions.model_version,
            extra_formats: options.extra_formats,
            callback: options.callback,
            seed: options.seed
          }
        );

        const taskResult = await this.client.waitForBatchTaskCompletion(batchResult.batchId, {
          downloadDir: this.config.downloadDir
        });

        // Process each result
        for (const result of taskResult.results.extract_result) {
          if (result.state === 'failed') {
            results.push({
              success: false,
              error: result.err_msg || 'Processing failed',
              taskId: result.task_id
            });
          } else {
            const jsonData = await this.extractJsonFromDownloadedFiles(
              taskResult.downloadedFiles.filter(file =>
                file.includes(result.task_id)
              )
            );

            results.push({
              success: true,
              data: jsonData,
              downloadedFiles: taskResult.downloadedFiles.filter(file =>
                file.includes(result.task_id)
              ),
              taskId: result.task_id
            });
          }
        }
      }

      return results;

    } catch (error) {
      // If batch processing fails, return error for remaining files
      const remainingFiles = filePaths.slice(results.length);
      remainingFiles.forEach(filePath => {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
      
      return results;
    }
  }

  /**
   * Process URLs in batch
   * @param urls Array of URLs to process
   * @param options Processing options
   * @returns Promise<ConversionResult[]>
   */
  async processUrls(
    urls: string[],
    options: Partial<SingleFileRequest> = {}
  ): Promise<ConversionResult[]> {
    try {
      // Process URLs in batches (max 200 per API limit)
      const batchSize = 200;
      const batches: string[][] = [];
      
      for (let i = 0; i < urls.length; i += batchSize) {
        batches.push(urls.slice(i, i + batchSize));
      }

      const allResults: ConversionResult[] = [];

      for (const batch of batches) {
        const batchId = await this.client.createBatchUrlTask({
          enable_formula: options.enable_formula ?? this.config.defaultOptions.enable_formula,
          enable_table: options.enable_table ?? this.config.defaultOptions.enable_table,
          language: options.language ?? this.config.defaultOptions.language,
          model_version: options.model_version ?? this.config.defaultOptions.model_version,
          extra_formats: options.extra_formats,
          callback: options.callback,
          seed: options.seed,
          files: batch.map(url => ({
            url,
            is_ocr: options.is_ocr,
            data_id: options.data_id,
            page_ranges: options.page_ranges
          }))
        });

        const batchResult = await this.client.waitForBatchTaskCompletion(batchId, {
          downloadDir: this.config.downloadDir
        });

        // Process each result
        for (const taskResult of batchResult.results.extract_result) {
          if (taskResult.state === 'failed') {
            allResults.push({
              success: false,
              error: taskResult.err_msg || 'Processing failed',
              taskId: taskResult.task_id
            });
          } else {
            const jsonData = await this.extractJsonFromDownloadedFiles(
              batchResult.downloadedFiles.filter(file => 
                file.includes(taskResult.task_id)
              )
            );

            allResults.push({
              success: true,
              data: jsonData,
              downloadedFiles: batchResult.downloadedFiles.filter(file => 
                file.includes(taskResult.task_id)
              ),
              taskId: taskResult.task_id
            });
          }
        }
      }

      return allResults;

    } catch (error) {
      return urls.map(url => ({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  /**
   * Extract JSON content from downloaded ZIP files
   * @param downloadedFiles Array of downloaded file paths
   * @returns Promise<any>
   */
  private async extractJsonFromDownloadedFiles(downloadedFiles: string[]): Promise<any> {
    const jsonFiles: any[] = [];

    for (const filePath of downloadedFiles) {
      if (!filePath.endsWith('.zip')) {
        continue;
      }

      try {
        // For now, we'll return the file path as the data
        // In a real implementation, you would extract the ZIP and parse JSON
        // This requires a ZIP extraction library like yauzl or node-stream-zip
        console.log(`ZIP file downloaded: ${filePath}`);
        console.log('Note: JSON extraction from ZIP requires additional implementation');
        
        // Return a placeholder structure
        jsonFiles.push({
          zipFilePath: filePath,
          extractedAt: new Date().toISOString(),
          message: 'JSON extraction from ZIP requires additional implementation with a ZIP library'
        });
      } catch (error) {
        console.error(`Failed to extract JSON from ${filePath}:`, error);
      }
    }

    // Return the first JSON file if multiple, or merge if needed
    return jsonFiles.length > 0 ? jsonFiles[0] : null;
  }

  /**
   * Get task status
   * @param taskId Task ID
   * @returns Promise<TaskResult>
   */
  async getTaskStatus(taskId: string): Promise<TaskResult> {
    return this.client.getTaskResult(taskId);
  }

  /**
   * Cancel a task (if supported by API)
   * @param taskId Task ID
   * @returns Promise<boolean>
   */
  async cancelTask(taskId: string): Promise<boolean> {
    // Note: MinerU API doesn't seem to have a cancel endpoint
    // This is a placeholder for future implementation
    throw new Error('Task cancellation not supported by MinerU API');
  }

  /**
   * Clean up downloaded files
   * @param olderThanHours Remove files older than specified hours
   */
  async cleanupDownloadedFiles(olderThanHours: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.downloadDir);
      const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.config.downloadDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old file: ${filePath}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup downloaded files:', error);
    }
  }

  /**
   * Get download directory
   */
  getDownloadDirectory(): string {
    return this.config.downloadDir;
  }

  /**
   * Set download directory
   */
  setDownloadDirectory(directory: string): void {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    this.config.downloadDir = directory;
  }

  /**
   * Validate the API token
   * @returns Promise<boolean> - true if token is valid
   */
  async validateToken(): Promise<boolean> {
    return this.client.validateToken();
  }

  /**
   * Get account information
   * @returns Promise<any> - Account information
   */
  async getAccountInfo(): Promise<any> {
    return this.client.getAccountInfo();
  }
}