import { AbstractPdfConvertor } from '../AbstractPdfConvertor';
import { MinerUClient, SingleFileRequest, TaskResult } from './MinerUClient';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import * as zlib from 'zlib';
import * as yauzl from 'yauzl';
import { uploadPdfFromPath } from '../../lib/s3Service/S3Service';
import createLoggerWithPrefix from '../../lib/logger';
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
   * Convert PDF to markdown using S3 download URL
   * @param s3Url The S3 download URL of the PDF
   * @param options Conversion options
   * @returns Promise<ConversionResult>
   */
  async convertPdfToMarkdownFromS3(
    s3Url: string,
    options: Partial<SingleFileRequest> = {},
  ): Promise<ConversionResult> {
    try {
      this.logger.info(`convertPdfToMarkdownFromS3: s3Url=${s3Url}`);
      
      // Use the S3 URL directly
      const request: SingleFileRequest = {
        url: s3Url,
        ...this.config.defaultOptions,
        ...options,
      };

      this.logger.info(`Processing file with MinerU... Request: ${JSON.stringify(request)}`);
      // Process the file
      const result = await this.client.processSingleFile(request, {
        downloadDir: this.config.downloadDir,
      });
      
      // Enhanced diagnostic logging to identify task_id issue
      this.logger.info(`MinerU processing completed. Full result structure: ${JSON.stringify({
        hasResult: !!result.result,
        resultType: typeof result.result,
        resultIsNullOrUndefined: result.result == null,
        resultKeys: result.result ? Object.keys(result.result) : [],
        resultString: JSON.stringify(result.result),
        downloadedFilesCount: result.downloadedFiles?.length || 0,
        fullResultStructure: JSON.stringify(result, null, 2)
      })}`);
      
      if (result.result) {
        this.logger.info(`Result details: ${JSON.stringify({
          task_id: result.result?.task_id || 'undefined',
          task_idType: typeof result.result?.task_id,
          state: result.result?.state || 'undefined',
          data_id: result.result?.data_id || 'undefined',
          file_name: result.result?.file_name || 'undefined',
          err_msg: result.result?.err_msg || 'undefined'
        })}`);
      } else {
        this.logger.error(`CRITICAL: result.result is undefined or null. This is likely the source of the task_id error.`);
        this.logger.error(`Result object structure: ${JSON.stringify(result, null, 2)}`);
      }
      
      this.logger.info(
        `MinerU processing completed, taskId: ${result.result?.task_id || 'unknown'}`,
      );

      this.logger.info(
        `Extracting markdown from downloaded files...`,
      );
      // Extract and parse the markdown content
      const markdownData = await this.extractMarkdownFromDownloadedFiles(
        result.downloadedFiles || [],
      );
      this.logger.info(`Markdown extraction completed`);

      // Robust task_id extraction with multiple fallbacks
      let taskId = 'unknown';
      
      if (result.result && result.result.task_id) {
        taskId = result.result.task_id;
      } else if (result.result && typeof result.result === 'object') {
        // Try to find task_id in the result object
        const resultKeys = Object.keys(result.result);
        this.logger.info(`Available result keys: ${resultKeys.join(', ')}`);
        
        // Check for alternative field names that might contain the task ID
        const taskIdCandidates = ['taskId', 'task_id', 'id', 'task_id', 'taskid'];
        for (const candidate of taskIdCandidates) {
          if (result.result[candidate]) {
            taskId = result.result[candidate];
            this.logger.info(`Found task ID in alternative field: ${candidate} = ${taskId}`);
            break;
          }
        }
        
        // If still no task_id, check if we can use other identifiers
        if (taskId === 'unknown') {
          if (result.result.data_id) {
            taskId = `data-${result.result.data_id}`;
            this.logger.info(`Using data_id as fallback identifier: ${taskId}`);
          } else if (result.result.file_name) {
            taskId = `file-${result.result.file_name}`;
            this.logger.info(`Using file_name as fallback identifier: ${taskId}`);
          }
        }
      } else {
        this.logger.warn(`result.result is undefined or null. Using fallback identifier generation.`);
        // Generate a unique identifier based on timestamp and random string
        taskId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.info(`Generated fallback task ID: ${taskId}`);
      }
      
      return {
        success: true,
        data: markdownData,
        downloadedFiles: result.downloadedFiles,
        taskId: taskId,
      };
    } catch (error) {
      this.logger.error(`Error in convertPdfToMarkdownFromS3:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Convert PDF file to JSON using MinerU API from local
   * @param pdfPath Path to the PDF file or URL
   * @param options Conversion options
   * @returns Promise<ConversionResult>
   */
  async convertPdfToMarkdown(
    pdfPath: string,
    options: Partial<SingleFileRequest> = {},
  ): Promise<ConversionResult> {
    try {
      this.logger.info(`convertPdfToJSON: pdfPath=${pdfPath}`);

      // Determine if pdfPath is a URL or local file
      const isUrl =
        pdfPath.startsWith('http://') || pdfPath.startsWith('https://');
      this.logger.info(`Is URL: ${isUrl}`);

      let request: SingleFileRequest;

      if (isUrl) {
        // Use URL directly
        this.logger.info(`Using URL directly: ${pdfPath}`);
        request = {
          url: pdfPath,
          ...this.config.defaultOptions,
          ...options,
        };
      } else {
        // For local files, we need to handle file upload
        this.logger.info(`Processing local file: ${pdfPath}`);
        if (!fs.existsSync(pdfPath)) {
          this.logger.error(`File not found: ${pdfPath}`);
          return {
            success: false,
            error: `File not found: ${pdfPath}`,
          };
        }

        // Validate file format
        if (!MinerUClient.isValidFileFormat(pdfPath)) {
          this.logger.error(
            `Unsupported file format: ${pdfPath}`,
          );
          return {
            success: false,
            error: `Unsupported file format: ${pdfPath}`,
          };
        }

        this.logger.info(`Uploading to S3...`);
        const s3Url = await uploadPdfFromPath(pdfPath);
        this.logger.info(`S3 upload successful: ${s3Url}`);

        request = {
          url: s3Url,
          ...this.config.defaultOptions,
          ...options,
        };

        this.logger.debug(
          `update pdf to s3 successfully: ${JSON.stringify(request)}`,
        );
      }

      this.logger.info(`Processing file with MinerU...`);
      // Process the file
      const result = await this.client.processSingleFile(request, {
        downloadDir: this.config.downloadDir,
      });
      
      // Enhanced diagnostic logging for convertPdfToMarkdown method
      this.logger.info(`MinerU processing completed. Full result structure: ${JSON.stringify({
        hasResult: !!result.result,
        resultType: typeof result.result,
        resultIsNullOrUndefined: result.result == null,
        resultKeys: result.result ? Object.keys(result.result) : [],
        downloadedFilesCount: result.downloadedFiles?.length || 0,
        fullResultStructure: JSON.stringify(result, null, 2)
      })}`);
      
      if (result.result) {
        this.logger.info(`Result details: ${JSON.stringify({
          task_id: result.result?.task_id || 'undefined',
          task_idType: typeof result.result?.task_id,
          state: result.result?.state || 'undefined',
          data_id: result.result?.data_id || 'undefined',
          file_name: result.result?.file_name || 'undefined',
          err_msg: result.result?.err_msg || 'undefined'
        })}`);
      } else {
        this.logger.error(`CRITICAL: result.result is undefined or null in convertPdfToMarkdown method.`);
        this.logger.error(`Result object structure: ${JSON.stringify(result, null, 2)}`);
      }
      
      this.logger.info(
        `MinerU processing completed, taskId: ${result.result?.task_id || 'unknown'}`,
      );

      this.logger.info(
        `Extracting markdown from downloaded files...`,
      );
      // Extract and parse the markdown content
      const markdownData = await this.extractMarkdownFromDownloadedFiles(
        result.downloadedFiles || [],
      );
      this.logger.info(`Markdown extraction completed`);

      // Robust task_id extraction with multiple fallbacks
      let taskId = 'unknown';
      
      if (result.result && result.result.task_id) {
        taskId = result.result.task_id;
      } else if (result.result && typeof result.result === 'object') {
        // Try to find task_id in the result object
        const resultKeys = Object.keys(result.result);
        this.logger.info(`Available result keys: ${resultKeys.join(', ')}`);
        
        // Check for alternative field names that might contain the task ID
        const taskIdCandidates = ['taskId', 'task_id', 'id', 'task_id', 'taskid'];
        for (const candidate of taskIdCandidates) {
          if (result.result[candidate]) {
            taskId = result.result[candidate];
            this.logger.info(`Found task ID in alternative field: ${candidate} = ${taskId}`);
            break;
          }
        }
        
        // If still no task_id, check if we can use other identifiers
        if (taskId === 'unknown') {
          if (result.result.data_id) {
            taskId = `data-${result.result.data_id}`;
            this.logger.info(`Using data_id as fallback identifier: ${taskId}`);
          } else if (result.result.file_name) {
            taskId = `file-${result.result.file_name}`;
            this.logger.info(`Using file_name as fallback identifier: ${taskId}`);
          }
        }
      } else {
        this.logger.warn(`result.result is undefined or null. Using fallback identifier generation.`);
        // Generate a unique identifier based on timestamp and random string
        taskId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.logger.info(`Generated fallback task ID: ${taskId}`);
      }
      
      return {
        success: true,
        data: markdownData,
        downloadedFiles: result.downloadedFiles,
        taskId: taskId,
      };
    } catch (error) {
      this.logger.error(`Error in convertPdfToJSON:`, error);
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
      this.logger.info(
        `processLocalFile: filePath=${filePath}`,
      );

      if (!fs.existsSync(filePath)) {
        this.logger.error(`File not found: ${filePath}`);
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      if (!MinerUClient.isValidFileFormat(filePath)) {
        this.logger.error(
          `Unsupported file format: ${filePath}`,
        );
        return {
          success: false,
          error: `Unsupported file format: ${filePath}`,
        };
      }

      this.logger.info(`Starting batch file upload...`);
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
      this.logger.info(
        `Batch upload completed, batchId: ${batchResult.batchId}`,
      );

      this.logger.info(`Waiting for batch task completion...`);
      // Wait for completion
      const taskResult = await this.client.waitForBatchTaskCompletion(
        batchResult.batchId,
        {
          downloadDir: this.config.downloadDir,
        },
      );
      this.logger.info(`Batch task completed`);

      // Extract results
      const result = taskResult.results.extract_result[0];
      this.logger.info(`Task result state: ${result.state}`);

      if (result.state === 'failed') {
        this.logger.error(`Task failed: ${result.err_msg}`);
        
        // Robust task_id extraction for error case
        let taskId = 'unknown';
        if (result && result.task_id) {
          taskId = result.task_id;
        } else if (result && result.data_id) {
          taskId = `data-${result.data_id}`;
        } else if (result && result.file_name) {
          taskId = `file-${result.file_name}`;
        } else {
          taskId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        return {
          success: false,
          error: result.err_msg || 'Processing failed',
          taskId: taskId,
        };
      }

      this.logger.info(
        `Extracting markdown from downloaded files...`,
      );
      // Extract and parse the markdown content
      const markdownData = await this.extractMarkdownFromDownloadedFiles(
        taskResult.downloadedFiles,
      );

      // Robust task_id extraction for successful case
      let taskId = 'unknown';
      if (result && result.task_id) {
        taskId = result.task_id;
      } else if (result && result.data_id) {
        taskId = `data-${result.data_id}`;
      } else if (result && result.file_name) {
        taskId = `file-${result.file_name}`;
      } else {
        taskId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      return {
        success: true,
        data: markdownData,
        downloadedFiles: taskResult.downloadedFiles,
        taskId: taskId,
      };
    } catch (error) {
      this.logger.error(`Error in processLocalFile:`, error);
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
            // Robust task_id extraction for error case
            let taskId = 'unknown';
            if (result && result.task_id) {
              taskId = result.task_id;
            } else if (result && result.data_id) {
              taskId = `data-${result.data_id}`;
            } else if (result && result.file_name) {
              taskId = `file-${result.file_name}`;
            } else {
              taskId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            
            results.push({
              success: false,
              error: result.err_msg || 'Processing failed',
              taskId: taskId,
            });
          } else {
            // Enhanced task identifier extraction
            let taskIdentifier = 'unknown';
            if (result.task_id) {
              taskIdentifier = result.task_id;
            } else if (result.data_id) {
              taskIdentifier = `data-${result.data_id}`;
            } else if (result.file_name) {
              taskIdentifier = `file-${result.file_name}`;
            } else {
              taskIdentifier = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            const filteredFiles = taskResult.downloadedFiles.filter((file) =>
              file.includes(taskIdentifier),
            );

            const markdownData =
              await this.extractMarkdownFromDownloadedFiles(filteredFiles);

            // Use the robust taskIdentifier instead of directly accessing result.task_id
            results.push({
              success: true,
              data: markdownData,
              downloadedFiles: filteredFiles,
              taskId: taskIdentifier,
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
          // Enhanced task identifier extraction
          let taskIdentifier = 'unknown';
          if (taskResult.task_id) {
            taskIdentifier = taskResult.task_id;
          } else if (taskResult.data_id) {
            taskIdentifier = `data-${taskResult.data_id}`;
          } else if (taskResult.file_name) {
            taskIdentifier = `file-${taskResult.file_name}`;
          } else {
            taskIdentifier = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }

          if (taskResult.state === 'failed') {
            allResults.push({
              success: false,
              error: taskResult.err_msg || 'Processing failed',
              taskId: taskIdentifier, // Use the robust taskIdentifier
            });
          } else {
            const filteredFiles = batchResult.downloadedFiles.filter((file) =>
              file.includes(taskIdentifier),
            );

            const markdownData =
              await this.extractMarkdownFromDownloadedFiles(filteredFiles);

            // Use the robust taskIdentifier instead of directly accessing taskResult.task_id
            allResults.push({
              success: true,
              data: markdownData,
              downloadedFiles: filteredFiles,
              taskId: taskIdentifier,
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
   * @returns Promise<any> The extracted markdown content
   */
  private async extractMarkdownFromDownloadedFiles(
    downloadedFiles: string[],
  ): Promise<any> {
    try {
      this.logger.info(
        `Extracting markdown from ${downloadedFiles.length} files: ${downloadedFiles.join(', ')}`,
      );

      // Find the ZIP file in the downloaded files
      const zipFile = downloadedFiles.find((file) => file.endsWith('.zip'));
      if (!zipFile) {
        this.logger.error(`No ZIP file found in downloaded files. Available files: ${downloadedFiles.join(', ')}`);
        return null;
      }

      this.logger.info(`Processing ZIP file: ${zipFile}`);

      // Extract markdown from the ZIP file
      const markdownContent = await this.extractFullMdFromZip(zipFile);
      if (!markdownContent) {
        this.logger.error(`Failed to extract markdown from ZIP`);
        return null;
      }

      this.logger.info(
        `Successfully extracted markdown (${markdownContent.length} characters)`,
      );
      return markdownContent;
    } catch (error) {
      this.logger.error(
        `Error extracting markdown from downloaded files:`,
        error,
      );
      return null;
    }
  }

  /**
   * Extract full.md content from a ZIP file
   * @param zipPath Path to the ZIP file
   * @returns Promise<string | null> The extracted markdown content
   */
  private async extractFullMdFromZip(zipPath: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.logger.info(`Opening ZIP file: ${zipPath}`);
      
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          this.logger.error(`Error opening ZIP file:`, err);
          return reject(err);
        }

        this.logger.info(`ZIP file opened successfully`);
        let markdownContent = '';
        let foundMarkdown = false;

        zipfile.on('entry', (entry) => {
          this.logger.info(`Processing entry: ${entry.fileName}`);
          
          // Check if this is the markdown file we're looking for
          if (entry.fileName.endsWith('.md') || entry.fileName.endsWith('.markdown')) {
            this.logger.info(`Found markdown file: ${entry.fileName}`);
            foundMarkdown = true;

            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                this.logger.error(`Error opening entry:`, err);
                return reject(err);
              }

              this.logger.info(`Reading markdown content...`);
              const chunks: Buffer[] = [];
              
              readStream.on('data', (chunk) => {
                chunks.push(chunk);
              });

              readStream.on('end', () => {
                markdownContent = Buffer.concat(chunks).toString('utf8');
                this.logger.info(`Markdown content read successfully`);
                this.logger.info(`Content length: ${markdownContent.length} characters`);
                // Continue reading next entries
                zipfile.readEntry();
              });

              readStream.on('error', (err) => {
                this.logger.error(`Error reading entry:`, err);
                reject(err);
              });
            });
          } else {
            // Skip other entries
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          this.logger.info(`ZIP file processing completed`);
          this.logger.info(`Found markdown: ${foundMarkdown}`);
          if (foundMarkdown) {
            this.logger.info(`Resolving with markdown content (${markdownContent.length} chars)`);
            resolve(markdownContent);
          } else {
            this.logger.error(`No markdown file found in ZIP`);
            resolve(null);
          }
        });

        zipfile.on('error', (err) => {
          this.logger.error(`ZIP file error:`, err);
          reject(err);
        });

        // Start reading entries
        zipfile.readEntry();
      });
    });
  }

  /**
   * Cancel a running task
   * @param taskId The ID of the task to cancel
   * @returns Promise<boolean> True if cancellation was successful
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      this.logger.info(`Cancelling task: ${taskId}`);
      const result = await this.client.cancelTask(taskId);
      this.logger.info(`Task cancellation result:`, result);
      return result;
    } catch (error) {
      this.logger.error(`Error cancelling task:`, error);
      return false;
    }
  }

  /**
   * Get the status of a task
   * @param taskId The ID of the task to check
   * @returns Promise<TaskResult> The task result
   */
  async getTaskStatus(taskId: string): Promise<TaskResult> {
    return this.client.getTaskResult(taskId);
  }

  /**
   * Validate the MinerU API token
   * @returns Promise<boolean> True if token is valid
   */
  async validateToken(): Promise<boolean> {
    return this.client.validateToken();
  }

  /**
   * Clean up downloaded files older than specified hours
   * @param olderThanHours Age in hours for files to be considered old
   */
  async cleanupDownloadedFiles(olderThanHours: number = 24): Promise<void> {
    try {
      this.logger.info(
        `Cleaning up files older than ${olderThanHours} hours`,
      );
      const downloadDir = this.config.downloadDir;
      
      if (!fs.existsSync(downloadDir)) {
        this.logger.info(`Download directory does not exist: ${downloadDir}`);
        return;
      }

      const files = fs.readdirSync(downloadDir);
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(downloadDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          try {
            if (stats.isDirectory()) {
              // Recursively delete directory
              fs.rmSync(filePath, { recursive: true, force: true });
              this.logger.info(`Deleted old directory: ${file}`);
            } else {
              // Delete file
              fs.unlinkSync(filePath);
              this.logger.info(`Deleted old file: ${file}`);
            }
            deletedCount++;
          } catch (error) {
            this.logger.error(`Error deleting ${file}:`, error);
          }
        }
      }

      this.logger.info(`Cleanup completed. Deleted ${deletedCount} files.`);
    } catch (error) {
      this.logger.error(`Error during cleanup:`, error);
    }
  }

  /**
   * Get the current download directory
   * @returns The current download directory path
   */
  getDownloadDirectory(): string {
    return this.config.downloadDir;
  }

  /**
   * Set the download directory
   * @param directory The new download directory
   */
  setDownloadDirectory(directory: string): void {
    this.logger.info(`Setting download directory to: ${directory}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    this.config.downloadDir = directory;
  }
}
