import {
  MinerUClient,
  SingleFileRequest,
  TaskResult,
} from '@aikb/mineru-client';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import * as yauzl from 'yauzl';
import { uploadPdfFromPath, uploadToS3 } from '@aikb/s3-service';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { app_config } from '../../knowledgeBase/config';
import { ConversionResult, ImageUploadResult } from './pdfConvert';
import { IPdfConvertor } from './pdfConvert';

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



export class MinerUPdfConvertor implements IPdfConvertor {
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
   * Extract S3 key from URL
   * @param url The S3 URL
   * @returns The S3 key extracted from the URL
   */
  private extractS3KeyFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove leading slash from pathname
      return urlObj.pathname.startsWith('/')
        ? urlObj.pathname.substring(1)
        : urlObj.pathname;
    } catch (error) {
      this.logger.error(`Error extracting S3 key from URL: ${url}`, error);
      // Fallback to a default key based on filename
      const fileName = path.basename(url);
      return `pdfs/${fileName}`;
    }
  }

  /**
   * Extract task ID from result with fallback options
   * @param result The result object containing task information
   * @returns A valid task ID string
   */
  private extractTaskId(result: any): string {
    // Try direct task_id first
    if (result?.task_id) {
      return result.task_id;
    }

    // Try alternative field names
    if (result && typeof result === 'object') {
      const taskIdCandidates = ['taskId', 'task_id', 'id', 'taskid'];
      for (const candidate of taskIdCandidates) {
        if (result[candidate]) {
          return result[candidate];
        }
      }

      // Use other identifiers as fallbacks
      if (result.data_id) {
        return `data-${result.data_id}`;
      }
      if (result.file_name) {
        return `file-${result.file_name}`;
      }
    }

    // Generate a unique fallback identifier
    return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert PDF to markdown using S3 download URL
   * @param s3Url The S3 download URL of the PDF
   * @param options Conversion options
   * @returns Promise<ConversionResult>
   */
  async convertPdfToMarkdownFromS3(
    s3Url: string,
    options: any = {},
  ): Promise<ConversionResult> {
    try {
      this.logger.info(`convertPdfToMarkdownFromS3: s3Url=${s3Url}`);

      // Extract S3 key from URL for image path organization
      const s3Key = this.extractS3KeyFromUrl(s3Url);
      this.logger.info(`Extracted S3 key: ${s3Key}`);

      // Use the S3 URL directly
      const request: SingleFileRequest = {
        url: s3Url,
        ...this.config.defaultOptions,
        ...options,
      };

      this.logger.info(
        `Processing file with MinerU... Request: ${JSON.stringify(request)}`,
      );
      // Process the file
      const result = await this.client.processSingleFile(request, {
        downloadDir: this.config.downloadDir,
      });

      this.logger.info(`MinerU processing completed`);
      this.logger.info(`Extracting markdown from downloaded files...`);

      // Extract and parse the markdown content and upload images
      const extractionResult = await this.extractMarkdownFromDownloadedFiles(
        result.downloadedFiles || [],
        s3Key, // Pass S3 key for image path organization
      );
      this.logger.info(`Markdown extraction completed`);

      // Extract task ID using the helper method
      const taskId = this.extractTaskId(result.result);

      return {
        success: true,
        data: extractionResult?.markdownContent,
        downloadedFiles: result.downloadedFiles,
        taskId: taskId,
        uploadedImages: extractionResult?.uploadedImages,
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
    options: any = {},
  ): Promise<ConversionResult> {
    try {
      this.logger.info(`convertPdfToJSON: pdfPath=${pdfPath}`);

      // Determine if pdfPath is a URL or local file
      const isUrl =
        pdfPath.startsWith('http://') || pdfPath.startsWith('https://');
      this.logger.info(`Is URL: ${isUrl}`);

      let request: SingleFileRequest;
      let s3Key: string | undefined;

      if (isUrl) {
        // Use URL directly
        this.logger.info(`Using URL directly: ${pdfPath}`);
        s3Key = this.extractS3KeyFromUrl(pdfPath);
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
          this.logger.error(`Unsupported file format: ${pdfPath}`);
          return {
            success: false,
            error: `Unsupported file format: ${pdfPath}`,
          };
        }

        this.logger.info(`Uploading to S3...`);
        const s3Url = await uploadPdfFromPath(pdfPath);
        this.logger.info(`S3 upload successful: ${s3Url}`);

        // Extract S3 key from the uploaded URL
        s3Key = this.extractS3KeyFromUrl(s3Url);

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

      this.logger.info(`MinerU processing completed`);
      this.logger.info(`Extracting markdown from downloaded files...`);

      // Extract and parse the markdown content and upload images
      const extractionResult = await this.extractMarkdownFromDownloadedFiles(
        result.downloadedFiles || [],
        s3Key, // Pass S3 key for image path organization
      );
      this.logger.info(`Markdown extraction completed`);

      // Extract task ID using the helper method
      const taskId = this.extractTaskId(result.result);

      return {
        success: true,
        data: extractionResult?.markdownContent,
        downloadedFiles: result.downloadedFiles,
        taskId: taskId,
        uploadedImages: extractionResult?.uploadedImages,
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
    options: any = {},
  ): Promise<ConversionResult> {
    try {
      this.logger.info(`processLocalFile: filePath=${filePath}`);

      if (!fs.existsSync(filePath)) {
        this.logger.error(`File not found: ${filePath}`);
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      if (!MinerUClient.isValidFileFormat(filePath)) {
        this.logger.error(`Unsupported file format: ${filePath}`);
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

        return {
          success: false,
          error: result.err_msg || 'Processing failed',
          taskId: this.extractTaskId(result),
        };
      }

      this.logger.info(`Extracting markdown from downloaded files...`);
      // Extract and parse the markdown content and upload images
      const extractionResult = await this.extractMarkdownFromDownloadedFiles(
        taskResult.downloadedFiles,
        undefined, // No S3 key available for batch local files
      );

      // Extract task ID using the helper method
      const taskId = this.extractTaskId(result);

      return {
        success: true,
        data: extractionResult?.markdownContent,
        downloadedFiles: taskResult.downloadedFiles,
        taskId: taskId,
        uploadedImages: extractionResult?.uploadedImages,
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
    options: any = {},
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
              taskId: this.extractTaskId(result),
            });
          } else {
            const taskIdentifier = this.extractTaskId(result);
            const filteredFiles = taskResult.downloadedFiles.filter((file) =>
              file.includes(taskIdentifier),
            );

            const extractionResult =
              await this.extractMarkdownFromDownloadedFiles(
                filteredFiles,
                undefined,
              );

            results.push({
              success: true,
              data: extractionResult?.markdownContent,
              downloadedFiles: filteredFiles,
              taskId: taskIdentifier,
              uploadedImages: extractionResult?.uploadedImages,
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
    options: any = {},
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
          const taskIdentifier = this.extractTaskId(taskResult);

          if (taskResult.state === 'failed') {
            allResults.push({
              success: false,
              error: taskResult.err_msg || 'Processing failed',
              taskId: taskIdentifier,
            });
          } else {
            const filteredFiles = batchResult.downloadedFiles.filter((file) =>
              file.includes(taskIdentifier),
            );

            const extractionResult =
              await this.extractMarkdownFromDownloadedFiles(
                filteredFiles,
                undefined,
              );

            allResults.push({
              success: true,
              data: extractionResult?.markdownContent,
              downloadedFiles: filteredFiles,
              taskId: taskIdentifier,
              uploadedImages: extractionResult?.uploadedImages,
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
   * @param pdfS3Key Optional S3 key of the original PDF for organizing images
   * @returns Promise<any> The extracted markdown content
   */
  async extractMarkdownFromDownloadedFiles(
    downloadedFiles: string[],
    pdfS3Key?: string,
  ): Promise<any> {
    try {
      this.logger.info(
        `Extracting markdown from ${downloadedFiles.length} files: ${downloadedFiles.join(', ')}`,
      );

      // Find the ZIP file in the downloaded files
      const zipFile = downloadedFiles.find((file) => file.endsWith('.zip'));
      if (!zipFile) {
        this.logger.error(
          `No ZIP file found in downloaded files. Available files: ${downloadedFiles.join(', ')}`,
        );
        return null;
      }

      this.logger.info(`Processing ZIP file: ${zipFile}`);

      // Extract markdown and images from the ZIP file
      const result = await this.extractFullMdAndImagesFromZip(
        zipFile,
        pdfS3Key,
      );
      if (!result) {
        this.logger.error(`Failed to extract markdown from ZIP`);
        return null;
      }

      this.logger.info(
        `Successfully extracted markdown (${result.markdownContent.length} characters) and ${result.uploadedImages.length} images`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error extracting markdown from downloaded files:`,
        error,
      );
      return null;
    }
  }

  /**
   * Extract full.md content and images from a ZIP file
   * @param zipPath Path to the ZIP file
   * @param pdfS3Key Optional S3 key of the original PDF for organizing images
   * @returns Promise<{markdownContent: string, uploadedImages: ImageUploadResult[]} | null> The extracted markdown content and uploaded image information
   */
  private async extractFullMdAndImagesFromZip(
    zipPath: string,
    pdfS3Key?: string,
  ): Promise<{
    markdownContent: string;
    uploadedImages: ImageUploadResult[];
  } | null> {
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
        const uploadedImages: ImageUploadResult[] = [];
        const imageBuffers: { [key: string]: Buffer } = {};
        let imageProcessingQueue: Promise<void>[] = [];

        zipfile.on('entry', (entry) => {
          this.logger.info(`Processing entry: ${entry.fileName}`);

          // Check if this is the markdown file we're looking for
          if (
            entry.fileName.endsWith('.md') ||
            entry.fileName.endsWith('.markdown')
          ) {
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
                this.logger.info(
                  `Content length: ${markdownContent.length} characters`,
                );
                // Continue reading next entries
                zipfile.readEntry();
              });

              readStream.on('error', (err) => {
                this.logger.error(`Error reading entry:`, err);
                reject(err);
              });
            });
          } else if (
            entry.fileName.startsWith('images/') ||
            entry.fileName.startsWith('./images/')
          ) {
            // Process image files
            this.logger.info(`Found image file: ${entry.fileName}`);

            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) {
                this.logger.error(`Error opening image entry:`, err);
                return reject(err);
              }

              this.logger.info(`Reading image content...`);
              const chunks: Buffer[] = [];

              readStream.on('data', (chunk) => {
                chunks.push(chunk);
              });

              readStream.on('end', () => {
                const imageBuffer = Buffer.concat(chunks);
                const imageFileName = path.basename(entry.fileName);
                imageBuffers[entry.fileName] = imageBuffer;
                this.logger.info(
                  `Image content read: ${imageFileName} (${imageBuffer.length} bytes)`,
                );
                // Continue reading next entries
                zipfile.readEntry();
              });

              readStream.on('error', (err) => {
                this.logger.error(`Error reading image entry:`, err);
                reject(err);
              });
            });
          } else {
            // Skip other entries
            zipfile.readEntry();
          }
        });

        zipfile.on('end', async () => {
          this.logger.info(`ZIP file processing completed`);
          this.logger.info(`Found markdown: ${foundMarkdown}`);
          this.logger.info(`Found images: ${Object.keys(imageBuffers).length}`);

          if (foundMarkdown) {
            try {
              // Upload all images to S3
              this.logger.info(`Starting image upload process...`);

              for (const [imagePath, imageBuffer] of Object.entries(
                imageBuffers,
              )) {
                try {
                  const imageFileName = path.basename(imagePath);
                  const imageExtension = path
                    .extname(imageFileName)
                    .toLowerCase();

                  // Determine content type based on file extension
                  let contentType = 'application/octet-stream';
                  switch (imageExtension) {
                    case '.jpg':
                    case '.jpeg':
                      contentType = 'image/jpeg';
                      break;
                    case '.png':
                      contentType = 'image/png';
                      break;
                    case '.gif':
                      contentType = 'image/gif';
                      break;
                    case '.svg':
                      contentType = 'image/svg+xml';
                      break;
                    case '.webp':
                      contentType = 'image/webp';
                      break;
                  }

                  // Generate S3 key based on PDF S3 key and original image filename
                  let s3Key: string;
                  if (pdfS3Key) {
                    // Remove file extension from PDF S3 key and use as directory
                    const pdfKeyWithoutExt = pdfS3Key.replace(/\.[^/.]+$/, '');
                    s3Key = `images/${pdfKeyWithoutExt}/${imageFileName}`;
                  } else {
                    // Fallback to images directory with filename
                    s3Key = `images/${imageFileName}`;
                  }

                  // Upload to S3
                  const s3Url = await uploadToS3(
                    imageBuffer,
                    s3Key,
                    contentType,
                  );

                  uploadedImages.push({
                    originalPath: imagePath,
                    s3Url: s3Url,
                    fileName: s3Key,
                  });

                  this.logger.info(
                    `Successfully uploaded image: ${imageFileName} to ${s3Url}`,
                  );
                } catch (uploadError) {
                  this.logger.error(
                    `Failed to upload image ${imagePath}:`,
                    uploadError,
                  );
                  // Continue with other images even if one fails
                }
              }

              // Update markdown content to use S3 URLs
              let updatedMarkdownContent = markdownContent;
              for (const uploadedImage of uploadedImages) {
                // Replace relative image paths with S3 URLs
                const relativePath = uploadedImage.originalPath;
                const fileName = path.basename(relativePath);

                // Replace various possible image reference formats
                updatedMarkdownContent = updatedMarkdownContent
                  .replace(
                    new RegExp(`\\./?images/${fileName}`, 'g'),
                    uploadedImage.s3Url,
                  )
                  .replace(
                    new RegExp(`images/${fileName}`, 'g'),
                    uploadedImage.s3Url,
                  )
                  .replace(
                    new RegExp(`/${relativePath}`, 'g'),
                    uploadedImage.s3Url,
                  )
                  .replace(new RegExp(relativePath, 'g'), uploadedImage.s3Url);
              }

              this.logger.info(
                `Updated markdown content with ${uploadedImages.length} S3 image URLs`,
              );

              this.logger.info(
                `Resolving with markdown content (${updatedMarkdownContent.length} chars) and ${uploadedImages.length} images`,
              );
              resolve({
                markdownContent: updatedMarkdownContent,
                uploadedImages: uploadedImages,
              });
            } catch (error) {
              this.logger.error(`Error during image upload process:`, error);
              // Still return the markdown content even if image upload fails
              resolve({
                markdownContent: markdownContent,
                uploadedImages: uploadedImages,
              });
            }
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
      this.logger.info(`Cleaning up files older than ${olderThanHours} hours`);
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

  setDownloadDirectory(directory: string): void {
    this.logger.info(`Setting download directory to: ${directory}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    this.config.downloadDir = directory;
  }
}


