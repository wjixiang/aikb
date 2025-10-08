import { AbstractPdfConvertor } from './AbstractPdfConvertor';
import { MinerUClient, SingleFileRequest, TaskResult } from './MinerUClient';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import * as zlib from 'zlib';
import * as yauzl from 'yauzl';
import { uploadPdfFromPath } from '../lib/s3Service/S3Service';
import createLoggerWithPrefix from '../lib/logger';
import { app_config } from 'knowledgeBase/config';

/**
 * MinerU-based PDF converter implementation
 * Extends AbstractPdfConvertor to provide MinerU API integration
 */

export interface MinerUPdfConvertorConfig {
  token?: string;
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
  private logger = createLoggerWithPrefix('MinerUPdfConvertor');
  private client: MinerUClient;
  private config: Omit<MinerUPdfConvertorConfig, 'defaultOptions'> & {
    defaultOptions: Partial<SingleFileRequest>;
    token: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
    retryDelay: number;
    downloadDir: string;
  };

  constructor(config: MinerUPdfConvertorConfig) {
    super();

    this.config = {
      token: config.token || app_config.MinerU.token,
      baseUrl: config.baseUrl || 'https://mineru.net/api/v4',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      downloadDir: config.downloadDir || './mineru-downloads',
      defaultOptions: {
        is_ocr: false,
        enable_formula: true,
        enable_table: true,
        language: 'ch',
        model_version: 'pipeline',
        ...config.defaultOptions,
      },
    };

    this.client = new MinerUClient({
      ...app_config.MinerU,
      token: this.config.token,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
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
  async convertPdfToMarkdown(
    pdfPath: string,
    options: Partial<SingleFileRequest> = {},
  ): Promise<ConversionResult> {
    try {
      console.log(`[MinerUPdfConvertor] convertPdfToJSON: pdfPath=${pdfPath}`);

      // Determine if pdfPath is a URL or local file
      const isUrl =
        pdfPath.startsWith('http://') || pdfPath.startsWith('https://');
      console.log(`[MinerUPdfConvertor] Is URL: ${isUrl}`);

      let request: SingleFileRequest;

      if (isUrl) {
        // Use URL directly
        console.log(`[MinerUPdfConvertor] Using URL directly: ${pdfPath}`);
        request = {
          url: pdfPath,
          ...this.config.defaultOptions,
          ...options,
        };
      } else {
        // For local files, we need to handle file upload
        console.log(`[MinerUPdfConvertor] Processing local file: ${pdfPath}`);
        if (!fs.existsSync(pdfPath)) {
          console.error(`[MinerUPdfConvertor] File not found: ${pdfPath}`);
          return {
            success: false,
            error: `File not found: ${pdfPath}`,
          };
        }

        // Validate file format
        if (!MinerUClient.isValidFileFormat(pdfPath)) {
          console.error(
            `[MinerUPdfConvertor] Unsupported file format: ${pdfPath}`,
          );
          return {
            success: false,
            error: `Unsupported file format: ${pdfPath}`,
          };
        }

        console.log(`[MinerUPdfConvertor] Uploading to S3...`);
        const s3Url = await uploadPdfFromPath(pdfPath);
        console.log(`[MinerUPdfConvertor] S3 upload successful: ${s3Url}`);

        request = {
          url: s3Url,
          ...this.config.defaultOptions,
          ...options,
        };

        this.logger.debug(
          `update pdf to s3 successfully: ${JSON.stringify(request)}`,
        );
      }

      console.log(`[MinerUPdfConvertor] Processing file with MinerU...`);
      // Process the file
      const result = await this.client.processSingleFile(request, {
        downloadDir: this.config.downloadDir,
      });
      console.log(
        `[MinerUPdfConvertor] MinerU processing completed, taskId: ${result.result.task_id}`,
      );

      console.log(
        `[MinerUPdfConvertor] Extracting markdown from downloaded files...`,
      );
      // Extract and parse the markdown content
      const markdownData = await this.extractMarkdownFromDownloadedFiles(
        result.downloadedFiles || [],
      );
      console.log(`[MinerUPdfConvertor] Markdown extraction completed`);

      return {
        success: true,
        data: markdownData,
        downloadedFiles: result.downloadedFiles,
        taskId: result.result.task_id,
      };
    } catch (error) {
      console.error(`[MinerUPdfConvertor] Error in convertPdfToJSON:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
    options: Partial<SingleFileRequest> = {},
  ): Promise<ConversionResult> {
    try {
      console.log(
        `[MinerUPdfConvertor] processLocalFile: filePath=${filePath}`,
      );

      if (!fs.existsSync(filePath)) {
        console.error(`[MinerUPdfConvertor] File not found: ${filePath}`);
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      if (!MinerUClient.isValidFileFormat(filePath)) {
        console.error(
          `[MinerUPdfConvertor] Unsupported file format: ${filePath}`,
        );
        return {
          success: false,
          error: `Unsupported file format: ${filePath}`,
        };
      }

      console.log(`[MinerUPdfConvertor] Starting batch file upload...`);
      // Process using batch file upload
      const batchResult = await this.client.processBatchFiles(
        [
          {
            filePath,
            is_ocr: options.is_ocr,
            data_id: options.data_id,
            page_ranges: options.page_ranges,
          },
        ],
        {
          enable_formula:
            options.enable_formula ?? this.config.defaultOptions.enable_formula,
          enable_table:
            options.enable_table ?? this.config.defaultOptions.enable_table,
          language: options.language ?? this.config.defaultOptions.language,
          model_version:
            options.model_version ?? this.config.defaultOptions.model_version,
          extra_formats: options.extra_formats,
          callback: options.callback,
          seed: options.seed,
        },
      );
      console.log(
        `[MinerUPdfConvertor] Batch upload completed, batchId: ${batchResult.batchId}`,
      );

      console.log(`[MinerUPdfConvertor] Waiting for batch task completion...`);
      // Wait for completion
      const taskResult = await this.client.waitForBatchTaskCompletion(
        batchResult.batchId,
        {
          downloadDir: this.config.downloadDir,
        },
      );
      console.log(`[MinerUPdfConvertor] Batch task completed`);

      // Extract results
      const result = taskResult.results.extract_result[0];
      console.log(`[MinerUPdfConvertor] Task result state: ${result.state}`);

      if (result.state === 'failed') {
        console.error(`[MinerUPdfConvertor] Task failed: ${result.err_msg}`);
        return {
          success: false,
          error: result.err_msg || 'Processing failed',
          taskId: result.task_id,
        };
      }

      console.log(
        `[MinerUPdfConvertor] Extracting markdown from downloaded files...`,
      );
      // Extract and parse the markdown content
      const markdownData = await this.extractMarkdownFromDownloadedFiles(
        taskResult.downloadedFiles,
      );

      return {
        success: true,
        data: markdownData,
        downloadedFiles: taskResult.downloadedFiles,
        taskId: result.task_id,
      };
    } catch (error) {
      console.error(`[MinerUPdfConvertor] Error in processLocalFile:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
    options: Partial<SingleFileRequest> = {},
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];

    try {
      // Validate all files first
      const validFiles = filePaths.filter((filePath) => {
        if (!fs.existsSync(filePath)) {
          results.push({
            success: false,
            error: `File not found: ${filePath}`,
          });
          return false;
        }

        if (!MinerUClient.isValidFileFormat(filePath)) {
          results.push({
            success: false,
            error: `Unsupported file format: ${filePath}`,
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
          batch.map((filePath) => ({
            filePath,
            is_ocr: options.is_ocr,
            data_id: options.data_id,
            page_ranges: options.page_ranges,
          })),
          {
            enable_formula:
              options.enable_formula ??
              this.config.defaultOptions.enable_formula,
            enable_table:
              options.enable_table ?? this.config.defaultOptions.enable_table,
            language: options.language ?? this.config.defaultOptions.language,
            model_version:
              options.model_version ?? this.config.defaultOptions.model_version,
            extra_formats: options.extra_formats,
            callback: options.callback,
            seed: options.seed,
          },
        );

        const taskResult = await this.client.waitForBatchTaskCompletion(
          batchResult.batchId,
          {
            downloadDir: this.config.downloadDir,
          },
        );

        // Process each result
        for (const result of taskResult.results.extract_result) {
          if (result.state === 'failed') {
            results.push({
              success: false,
              error: result.err_msg || 'Processing failed',
              taskId: result.task_id,
            });
          } else {
            const taskIdentifier =
              result.task_id || result.data_id || result.file_name || 'unknown';
            const filteredFiles = taskResult.downloadedFiles.filter((file) =>
              file.includes(taskIdentifier),
            );

            const markdownData =
              await this.extractMarkdownFromDownloadedFiles(filteredFiles);

            results.push({
              success: true,
              data: markdownData,
              downloadedFiles: filteredFiles,
              taskId: result.task_id || taskIdentifier,
            });
          }
        }
      }

      return results;
    } catch (error) {
      // If batch processing fails, return error for remaining files
      const remainingFiles = filePaths.slice(results.length);
      remainingFiles.forEach((filePath) => {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : String(error),
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
    options: Partial<SingleFileRequest> = {},
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
          enable_formula:
            options.enable_formula ?? this.config.defaultOptions.enable_formula,
          enable_table:
            options.enable_table ?? this.config.defaultOptions.enable_table,
          language: options.language ?? this.config.defaultOptions.language,
          model_version:
            options.model_version ?? this.config.defaultOptions.model_version,
          extra_formats: options.extra_formats,
          callback: options.callback,
          seed: options.seed,
          files: batch.map((url) => ({
            url,
            is_ocr: options.is_ocr,
            data_id: options.data_id,
            page_ranges: options.page_ranges,
          })),
        });

        const batchResult = await this.client.waitForBatchTaskCompletion(
          batchId,
          {
            downloadDir: this.config.downloadDir,
          },
        );

        // Process each result
        for (const taskResult of batchResult.results.extract_result) {
          const taskIdentifier =
            taskResult.task_id ||
            taskResult.data_id ||
            taskResult.file_name ||
            'unknown';

          if (taskResult.state === 'failed') {
            allResults.push({
              success: false,
              error: taskResult.err_msg || 'Processing failed',
              taskId: taskResult.task_id || taskIdentifier,
            });
          } else {
            const filteredFiles = batchResult.downloadedFiles.filter((file) =>
              file.includes(taskIdentifier),
            );

            const markdownData =
              await this.extractMarkdownFromDownloadedFiles(filteredFiles);

            allResults.push({
              success: true,
              data: markdownData,
              downloadedFiles: filteredFiles,
              taskId: taskResult.task_id || taskIdentifier,
            });
          }
        }
      }

      return allResults;
    } catch (error) {
      return urls.map((url) => ({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  /**
   * Extract markdown content from downloaded ZIP files
   * @param downloadedFiles Array of downloaded file paths
   * @returns Promise<any>
   */
  private async extractMarkdownFromDownloadedFiles(
    downloadedFiles: string[],
  ): Promise<any> {
    for (const filePath of downloadedFiles) {
      if (!filePath.endsWith('.zip')) {
        continue;
      }

      try {
        console.log(`[MinerUPdfConvertor] Processing ZIP file: ${filePath}`);

        // Extract ZIP file and read full.md content
        const markdownContent = await this.extractFullMdFromZip(filePath);

        if (markdownContent) {
          console.log(
            `[MinerUPdfConvertor] Successfully extracted markdown from ZIP`,
          );
          return {
            markdown: markdownContent,
            zipFilePath: filePath,
            extractedAt: new Date().toISOString(),
          };
        }
      } catch (error) {
        console.error(
          `[MinerUPdfConvertor] Failed to extract markdown from ${filePath}:`,
          error,
        );
      }
    }

    return null;
  }

  /**
   * Extract full.md content from a ZIP file
   * @param zipPath Path to the ZIP file
   * @returns Promise<string|null> The markdown content or null if not found
   */
  private async extractFullMdFromZip(zipPath: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          return reject(err);
        }

        if (!zipfile) {
          return reject(new Error('Failed to open ZIP file'));
        }

        let fullMdContent = '';
        let fullMdFound = false;

        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            // Directory entry, skip
            zipfile.readEntry();
            return;
          }

          // Check if this is the full.md file
          if (entry.fileName.endsWith('full.md')) {
            fullMdFound = true;
            console.log(
              `[MinerUPdfConvertor] Found full.md in ZIP: ${entry.fileName}`,
            );

            // Open the entry stream
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                return reject(err);
              }

              if (!readStream) {
                return reject(
                  new Error('Failed to open read stream for full.md'),
                );
              }

              let content = '';
              readStream.on('data', (chunk) => {
                content += chunk.toString();
              });

              readStream.on('end', () => {
                fullMdContent = content;
                zipfile.readEntry();
              });

              readStream.on('error', (err) => {
                reject(err);
              });
            });
          } else {
            // Skip other files
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          if (fullMdFound) {
            resolve(fullMdContent);
          } else {
            console.warn(
              `[MinerUPdfConvertor] full.md not found in ZIP: ${zipPath}`,
            );
            resolve(null);
          }
        });

        zipfile.on('error', (err) => {
          reject(err);
        });

        // Start reading entries
        zipfile.readEntry();
      });
    });
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
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

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
