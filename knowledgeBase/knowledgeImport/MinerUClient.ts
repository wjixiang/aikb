import axios, { AxiosInstance, AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import {
  uploadToS3,
  uploadPdfFromPath,
  getSignedUploadUrl,
} from '../lib/s3Service/S3Service';

/**
 * MinerU API Client for document parsing and conversion
 * Supports single file parsing, batch file upload, and batch URL parsing
 */

// ==================== Types and Interfaces ====================

export interface MinerUConfig {
  token: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  downloadDir: string;
  defaultOptions: {
    is_ocr: boolean;
    enable_formula: boolean;
    enable_table: boolean;
    language: 'en' | 'ch';
    model_version: 'pipeline';
  };
}

export interface SingleFileRequest {
  url: string;
  is_ocr?: boolean;
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  data_id?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  page_ranges?: string;
  model_version?: 'pipeline' | 'vlm';
}

export interface BatchFileRequest {
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  model_version?: 'pipeline' | 'vlm';
  files: BatchFileItem[];
}

export interface BatchFileItem {
  name: string;
  is_ocr?: boolean;
  data_id?: string;
  page_ranges?: string;
}

export interface BatchUrlRequest {
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  model_version?: 'pipeline' | 'vlm';
  files: BatchUrlItem[];
}

export interface BatchUrlItem {
  url: string;
  is_ocr?: boolean;
  data_id?: string;
  page_ranges?: string;
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  trace_id: string;
  data: T;
}

export interface SingleFileResponse {
  task_id: string;
}

export interface BatchFileResponse {
  batch_id: string;
  file_urls: string[];
}

export interface BatchUrlResponse {
  batch_id: string;
}

export interface ExtractProgress {
  extracted_pages: number;
  total_pages: number;
  start_time: string;
}

export interface TaskResult {
  task_id?: string;
  data_id?: string;
  file_name?: string;
  state:
    | 'done'
    | 'pending'
    | 'running'
    | 'failed'
    | 'converting'
    | 'waiting-file';
  full_zip_url?: string;
  err_msg?: string;
  extract_progress?: ExtractProgress;
}

export interface BatchTaskResult {
  batch_id: string;
  extract_result: TaskResult[];
}

export interface FileUploadInfo {
  fileName: string;
  filePath: string;
  uploadUrl: string;
  s3Url?: string;
}

// ==================== Error Classes ====================

export class MinerUApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public traceId?: string,
  ) {
    super(`MinerU API Error [${code}]: ${message}`);
    this.name = 'MinerUApiError';
  }
}

export class MinerUTimeoutError extends Error {
  constructor(message: string) {
    super(`MinerU Timeout Error: ${message}`);
    this.name = 'MinerUTimeoutError';
  }
}

export const MinerUDefaultConfig: MinerUConfig = {
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
    model_version: 'pipeline',
  },
  token: process.env.MINERU_TOKEN as string,
};

// ==================== Main Client Class ====================

export class MinerUClient {
  private client: AxiosInstance;
  private config: Required<MinerUConfig>;

  constructor(config: MinerUConfig) {
    this.config = {
      baseUrl: 'https://mineru.net/api/v4',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    if (!this.config.token) {
      throw new Error('Token is required for MinerU API authentication');
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.token}`,
        Accept: '*/*',
      },
    });

    // Add request interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => this.handleApiError(error),
    );
  }

  private handleApiError(error: any): never {
    if (error.response) {
      const { data, status, headers } = error.response;
      const errorMessage = data.msg || data.message || `HTTP ${status} error`;
      const errorCode = data.code || this.getErrorCodeFromStatus(status);

      // Add detailed logging for debugging
      console.error('MinerU API Error Details:', {
        status,
        errorCode,
        errorMessage,
        traceId: data.trace_id,
        headers: {
          'content-type': headers['content-type'],
          'x-request-id': headers['x-request-id'],
        },
        url: error.config?.url,
        method: error.config?.method,
      });

      throw new MinerUApiError(errorCode, errorMessage, data.trace_id);
    } else if (error.request) {
      console.error('MinerU Network Error:', {
        message: error.message,
        code: error.code,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        },
      });
      throw new MinerUTimeoutError(`Network request failed: ${error.message}`);
    } else {
      console.error('MinerU Request Error:', {
        message: error.message,
        stack: error.stack,
      });
      throw new MinerUApiError('REQUEST_ERROR', error.message);
    }
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 429:
        return 'RATE_LIMITED';
      case 500:
        return 'INTERNAL_SERVER_ERROR';
      case 502:
        return 'BAD_GATEWAY';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return `HTTP_${status}`;
    }
  }

  private async retryRequest<T>(
    requestFn: () => Promise<AxiosResponse<ApiResponse<T>>>,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await requestFn();
        return response.data.data;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate the API token by making a simple request
   * @returns Promise<boolean> - true if token is valid
   */
  async validateToken(): Promise<boolean> {
    try {
      // Try to get a non-existent task to check authentication
      // This will return 404 if token is valid, 401/403 if invalid
      await this.client.get('/extract/task/validate-token-test');
      return true; // Should not reach here
    } catch (error) {
      if (error instanceof MinerUApiError) {
        if (error.code === 'NOT_FOUND' || error.code === 'HTTP_404') {
          console.log('✅ Token is valid (404 expected for test task)');
          return true;
        } else if (error.code === 'UNAUTHORIZED' || error.code === 'HTTP_401') {
          console.error('❌ Token is invalid or expired');
          return false;
        } else if (error.code === 'FORBIDDEN' || error.code === 'HTTP_403') {
          console.error('❌ Token does not have sufficient permissions');
          return false;
        }
      }
      console.error('❌ Token validation failed:', error);
      return false;
    }
  }

  /**
   * Get API account information and quota status
   * @returns Promise<object> - Account information
   */
  async getAccountInfo(): Promise<any> {
    try {
      // Note: This endpoint may not exist in the actual API
      // This is a placeholder for future implementation
      const response = await this.retryRequest(async () =>
        this.client.get('/account/info'),
      );
      return response;
    } catch (error) {
      console.warn('Account info endpoint not available:', error);
      return null;
    }
  }

  // ==================== Single File Parsing ====================

  /**
   * Create a single file parsing task
   */
  async createSingleFileTask(request: SingleFileRequest): Promise<string> {
    console.log(
      `[MinerUClient] Creating single file task with request:`,
      JSON.stringify(request, null, 2),
    );
    return this.retryRequest(async () =>
      this.client.post<ApiResponse<SingleFileResponse>>(
        '/extract/task',
        request,
      ),
    ).then((data) => {
      console.log(
        `[MinerUClient] Single file task created successfully. Task ID: ${data.task_id}`,
      );
      return data.task_id;
    });
  }

  /**
   * Get single file task result
   */
  async getTaskResult(taskId: string): Promise<TaskResult> {
    console.log(`[MinerUClient] Getting task result for ID: ${taskId}`);
    return this.retryRequest(async () =>
      this.client.get<ApiResponse<TaskResult>>(`/extract/task/${taskId}`),
    ).then((data) => {
      console.log(
        `[MinerUClient] Task result received:`,
        JSON.stringify(data, null, 2),
      );
      return data;
    });
  }

  /**
   * Wait for single file task completion and download result
   */
  async waitForTaskCompletion(
    taskId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      downloadDir?: string;
    } = {},
  ): Promise<{ result: TaskResult; downloadedFiles?: string[] }> {
    const {
      pollInterval = 5000,
      timeout = 300000, // 5 minutes
      downloadDir = './downloads',
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.getTaskResult(taskId);

      if (result.state === 'done') {
        if (result.full_zip_url) {
          const downloadedFiles = await this.downloadResultZip(
            result.full_zip_url,
            downloadDir,
            taskId,
          );
          return { result, downloadedFiles };
        }
        return { result };
      } else if (result.state === 'failed') {
        throw new MinerUApiError(
          'TASK_FAILED',
          result.err_msg || 'Task processing failed',
        );
      }

      await this.delay(pollInterval);
    }

    throw new MinerUTimeoutError(
      `Task ${taskId} did not complete within ${timeout}ms`,
    );
  }

  /**
   * Processes a single file from start to finish, including task creation, monitoring, and result download.
   *
   * This is a convenience method that combines the entire workflow for processing a single file:
   * 1. Creates a new parsing task with the provided request parameters
   * 2. Monitors the task progress until completion or failure
   * 3. Downloads the result ZIP file if the task completes successfully
   *
   * @param request - The single file processing request containing:
   *   - url: URL of the file to process (local files should be uploaded to S3 first)
   *   - is_ocr: Whether to use OCR for scanned documents (default: false)
   *   - enable_formula: Whether to extract mathematical formulas (default: true)
   *   - enable_table: Whether to extract tables (default: true)
   *   - language: Document language code (default: 'ch' for Chinese)
   *   - data_id: Optional custom identifier for the document
   *   - callback: Optional callback URL for completion notifications
   *   - seed: Optional random seed for reproducible results
   *   - extra_formats: Optional additional output formats ('docx', 'html', 'latex')
   *   - page_ranges: Optional page range to process (e.g., '1-10', '1,3,5-7')
   *   - model_version: Model version to use ('pipeline' or 'vlm')
   *
   * @param options - Optional processing configuration:
   *   - pollInterval: Polling interval in milliseconds for checking task status (default: 5000)
   *   - timeout: Maximum time to wait for task completion in milliseconds (default: 300000)
   *   - downloadDir: Directory to save downloaded result files (default: './downloads')
   *
   * @returns Promise resolving to an object containing:
   *   - result: TaskResult object with task status and metadata:
   *     - task_id: Unique identifier for the processing task
   *     - data_id: Custom identifier provided in the request
   *     - file_name: Original file name
   *     - state: Task state ('done', 'pending', 'running', 'failed', 'converting', 'waiting-file')
   *     - full_zip_url: URL to download the result ZIP file (when state is 'done')
   *     - err_msg: Error message if the task failed
   *     - extract_progress: Progress information with extracted_pages, total_pages, and start_time
   *   - downloadedFiles: Array containing the absolute path of the downloaded ZIP file
   *
   * @throws {MinerUApiError} When the API returns an error response
   * @throws {MinerUTimeoutError} When the task doesn't complete within the specified timeout
   * @throws {Error} When file operations fail or network issues occur
   *
   * @example
   * ```typescript
   * // Process a PDF file with default options
   * const result = await client.processSingleFile({
   *   url: 'https://example.com/document.pdf',
   *   is_ocr: true,
   *   language: 'en'
   * });
   *
   * if (result.result.state === 'done') {
   *   console.log('Processing completed successfully');
   *   console.log('Downloaded files:', result.downloadedFiles);
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Process with custom options
   * const result = await client.processSingleFile({
   *   url: 'https://example.com/document.pdf',
   *   data_id: 'my-document-001',
   *   page_ranges: '1-5',
   *   extra_formats: ['docx', 'html']
   * }, {
   *   pollInterval: 10000,
   *   timeout: 600000,
   *   downloadDir: './my-downloads'
   * });
   * ```
   */
  async processSingleFile(
    request: SingleFileRequest,
    options?: {
      pollInterval?: number;
      timeout?: number;
      downloadDir?: string;
    },
  ): Promise<{ result: TaskResult; downloadedFiles?: string[] }> {
    const taskId = await this.createSingleFileTask(request);

    const { result, downloadedFiles } = await this.waitForTaskCompletion(
      taskId,
      options,
    );

    return { result, downloadedFiles };
  }

  // ==================== Batch File Upload and Parsing ====================

  /**
   * Request upload URLs for batch file processing
   */
  async requestBatchFileUrls(request: BatchFileRequest): Promise<{
    batchId: string;
    uploadUrls: string[];
  }> {
    const response = await this.retryRequest(async () =>
      this.client.post<ApiResponse<BatchFileResponse>>(
        '/file-urls/batch',
        request,
      ),
    );

    return {
      batchId: response.batch_id,
      uploadUrls: response.file_urls,
    };
  }

  /**
   * Upload files to provided URLs and S3
   */
  async uploadFiles(uploadInfos: FileUploadInfo[]): Promise<void> {
    console.log(
      `[MinerUClient] Starting uploadFiles for ${uploadInfos.length} files`,
    );

    const uploadPromises = uploadInfos.map(async (info, index) => {
      try {
        console.log(
          `[MinerUClient] Processing file ${index + 1}/${uploadInfos.length}: ${info.fileName}`,
        );

        // First upload to S3
        console.log(`[MinerUClient] Uploading to S3: ${info.filePath}`);
        const s3Url = await uploadPdfFromPath(info.filePath);
        info.s3Url = s3Url;
        console.log(`[MinerUClient] S3 upload successful: ${s3Url}`);

        // For MinerU, we don't need to upload the file content again
        // MinerU will use the S3 URL that was provided in the batch request
        // The uploadUrl is just for confirmation purposes
        console.log(
          `[MinerUClient] Skipping MinerU upload - using S3 URL: ${s3Url}`,
        );

        console.log(`[MinerUClient] Successfully processed: ${info.fileName}`);
      } catch (error) {
        console.error(
          `[MinerUClient] Error uploading ${info.fileName}:`,
          error,
        );
        throw new Error(`Failed to upload ${info.fileName}: ${error}`);
      }
    });

    console.log(`[MinerUClient] Waiting for all uploads to complete...`);
    await Promise.all(uploadPromises);
    console.log(`[MinerUClient] All files uploaded successfully`);
  }

  /**
   * Process batch files from local files
   */
  async processBatchFiles(
    files: Array<{
      filePath: string;
      is_ocr?: boolean;
      data_id?: string;
      page_ranges?: string;
    }>,
    options: {
      enable_formula?: boolean;
      enable_table?: boolean;
      language?: string;
      callback?: string;
      seed?: string;
      extra_formats?: ('docx' | 'html' | 'latex')[];
      model_version?: 'pipeline' | 'vlm';
    } = {},
  ): Promise<{ batchId: string; s3Urls: string[] }> {
    console.log(
      `[MinerUClient] processBatchFiles: Processing ${files.length} files`,
    );

    // First upload all files to S3
    console.log(`[MinerUClient] Uploading files to S3 first...`);
    const uploadInfos: FileUploadInfo[] = files.map((file) => ({
      fileName: path.basename(file.filePath),
      filePath: file.filePath,
      uploadUrl: '', // Not needed for URL-based processing
    }));

    await this.uploadFiles(uploadInfos);

    // Extract S3 URLs from upload infos
    const s3Urls = uploadInfos.map((info) => info.s3Url!).filter((url) => url);
    console.log(`[MinerUClient] Uploaded ${s3Urls.length} files to S3`);

    // Prepare batch URL request with S3 URLs
    const request: BatchUrlRequest = {
      ...options,
      files: files.map((file, index) => ({
        url: s3Urls[index],
        is_ocr: file.is_ocr,
        data_id: file.data_id,
        page_ranges: file.page_ranges,
      })),
    };

    console.log(
      `[MinerUClient] Creating batch URL task with ${s3Urls.length} S3 URLs...`,
    );
    // Create batch task with URLs
    const batchId = await this.createBatchUrlTask(request);
    console.log(`[MinerUClient] Created batch task with ID: ${batchId}`);

    console.log(`[MinerUClient] processBatchFiles completed successfully`);
    return { batchId, s3Urls };
  }

  // ==================== Batch URL Parsing ====================

  /**
   * Create batch URL parsing task
   */
  async createBatchUrlTask(request: BatchUrlRequest): Promise<string> {
    console.log(
      `[MinerUClient] Creating batch URL task with request:`,
      JSON.stringify(request, null, 2),
    );
    return this.retryRequest(async () =>
      this.client.post<ApiResponse<BatchUrlResponse>>(
        '/extract/task/batch',
        request,
      ),
    ).then((data) => {
      console.log(
        `[MinerUClient] Batch URL task created successfully. Batch ID: ${data.batch_id}`,
      );
      return data.batch_id;
    });
  }

  /**
   * Get batch task results
   */
  async getBatchTaskResults(batchId: string): Promise<BatchTaskResult> {
    console.log(`[MinerUClient] Getting batch task results for ID: ${batchId}`);
    return this.retryRequest(async () =>
      this.client.get<ApiResponse<BatchTaskResult>>(
        `/extract-results/batch/${batchId}`,
      ),
    ).then((data) => {
      console.log(
        `[MinerUClient] Batch task results received:`,
        JSON.stringify(data, null, 2),
      );
      return data;
    });
  }

  /**
   * Wait for batch task completion and download results
   */
  async waitForBatchTaskCompletion(
    batchId: string,
    options: {
      pollInterval?: number;
      timeout?: number;
      downloadDir?: string;
    } = {},
  ): Promise<{ results: BatchTaskResult; downloadedFiles: string[] }> {
    const {
      pollInterval = 5000,
      timeout = 600000, // 10 minutes for batch
      downloadDir = './downloads',
    } = options;

    const startTime = Date.now();
    const downloadedFiles: string[] = [];

    while (Date.now() - startTime < timeout) {
      const results = await this.getBatchTaskResults(batchId);

      const allCompleted = results.extract_result.every(
        (result) => result.state === 'done' || result.state === 'failed',
      );

      if (allCompleted) {
        // Download completed files
        for (const result of results.extract_result) {
          if (result.state === 'done' && result.full_zip_url) {
            // For batch results, use data_id as the task identifier since task_id is not provided
            const taskIdentifier =
              result.data_id || result.file_name || 'unknown';
            const files = await this.downloadResultZip(
              result.full_zip_url,
              downloadDir,
              taskIdentifier,
            );
            downloadedFiles.push(...files);
          }
        }

        return { results, downloadedFiles };
      }

      await this.delay(pollInterval);
    }

    throw new MinerUTimeoutError(
      `Batch task ${batchId} did not complete within ${timeout}ms`,
    );
  }

  /**
   * Process batch URLs from start to finish
   */
  async processBatchUrls(
    request: BatchUrlRequest,
    options?: {
      pollInterval?: number;
      timeout?: number;
      downloadDir?: string;
    },
  ): Promise<{ results: BatchTaskResult; downloadedFiles: string[] }> {
    const batchId = await this.createBatchUrlTask(request);
    return this.waitForBatchTaskCompletion(batchId, options);
  }

  // ==================== Utility Methods ====================

  /**
   * Downloads the result ZIP file from the provided URL to the local filesystem.
   *
   * @param zipUrl - The URL of the ZIP file to download
   * @param downloadDir - The directory where the ZIP file should be saved
   * @param taskId - The task ID used to generate the filename
   * @returns Promise resolving to an array containing the absolute path of the downloaded ZIP file
   */
  private async downloadResultZip(
    zipUrl: string,
    downloadDir: string,
    taskId: string,
  ): Promise<string[]> {
    console.log(
      `[MinerUClient] downloadResultZip: taskId=${taskId}, zipUrl=${zipUrl}`,
    );

    const zipFileName = `${taskId}.zip`;
    const absoluteZipPath = path.resolve(path.join(downloadDir, zipFileName));

    // Ensure download directory exists
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    console.log(`[MinerUClient] Downloading ZIP file to: ${absoluteZipPath}`);

    // Download the file
    const downloadResponse = await axios({
      method: 'GET',
      url: zipUrl,
      responseType: 'stream',
    });

    const fileWriter = createWriteStream(absoluteZipPath);
    downloadResponse.data.pipe(fileWriter);

    await new Promise<void>((resolve, reject) => {
      fileWriter.on('finish', () => {
        console.log(
          `[MinerUClient] ZIP download completed: ${absoluteZipPath}`,
        );
        resolve();
      });
      fileWriter.on('error', reject);
    });

    console.log(
      `[MinerUClient] Successfully downloaded result file to: ${absoluteZipPath}`,
    );

    // Return the absolute path of the downloaded ZIP file
    return [absoluteZipPath];
  }

  /**
   * Validate file format
   */
  static isValidFileFormat(fileName: string): boolean {
    const validExtensions = [
      '.pdf',
      '.doc',
      '.docx',
      '.ppt',
      '.pptx',
      '.png',
      '.jpg',
      '.jpeg',
    ];
    const ext = path.extname(fileName).toLowerCase();
    return validExtensions.includes(ext);
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return [
      'ch',
      'en',
      'japan',
      'korean',
      'fr',
      'german',
      'spanish',
      'russian',
      'arabic',
      'italian',
      'portuguese',
      'romanian',
      'bulgarian',
      'ukrainian',
      'belarusian',
      'tamil',
      'telugu',
      'kannada',
      'thai',
      'vietnamese',
      'devanagari',
    ];
  }
}
