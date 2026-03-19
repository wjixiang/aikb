import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';

/**
 * MinerU API Client for document parsing and conversion
 * Supports Precision API (token auth, ≤200MB, ≤600 pages) and Agent Lightweight API (no auth, ≤10MB, ≤20 pages)
 */

// ==================== Types and Interfaces ====================

export interface MinerUConfig {
  token?: string;
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
    model_version: 'pipeline' | 'vlm' | 'MinerU-HTML';
  };
}

// ==================== Precision API Types ====================

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
  model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
}

export interface BatchFileRequest {
  enable_formula?: boolean;
  enable_table?: boolean;
  language?: string;
  callback?: string;
  seed?: string;
  extra_formats?: ('docx' | 'html' | 'latex')[];
  model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
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
  model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
  files: BatchUrlItem[];
}

export interface BatchUrlItem {
  url: string;
  is_ocr?: boolean;
  data_id?: string;
  page_ranges?: string;
}

// ==================== Agent API Types ====================

export interface AgentUrlParseRequest {
  url: string;
  language?: string;
  page_range?: string;
}

export interface AgentFileUploadResponse {
  task_id: string;
  file_url: string;
}

// ==================== Common Response Types ====================

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  trace_id: string;
  data: T;
}

export interface SingleFileResponse {
  task_id: string;
  [key: string]: any;
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

// Precision API task states: done, pending, running, failed, converting, waiting-file
export type PrecisionTaskState = 'done' | 'pending' | 'running' | 'failed' | 'converting' | 'waiting-file';

// Agent API task states: waiting-file, uploading, pending, running, done, failed
export type AgentTaskState = 'waiting-file' | 'uploading' | 'pending' | 'running' | 'done' | 'failed';

export interface TaskResult {
  task_id?: string;
  data_id?: string;
  file_name?: string;
  state: PrecisionTaskState;
  full_zip_url?: string;
  err_msg?: string;
  extract_progress?: ExtractProgress;
}

export interface AgentTaskResult {
  task_id: string;
  state: AgentTaskState;
  markdown?: string;
  err_msg?: string;
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

// ==================== Constants ====================

export const MINERU_DEFAULT_CONFIG = {
  baseUrl: 'https://mineru.net/api/v4',
  agentBaseUrl: 'https://mineru.net/api/v1/agent',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  downloadDir: './mineru-downloads',
  defaultOptions: {
    is_ocr: false,
    enable_formula: true,
    enable_table: true,
    language: 'ch' as const,
    model_version: 'pipeline' as const,
  },
} as const;

// ==================== Main Client Class ====================

export class MinerUClient {
  private precisionClient: AxiosInstance;
  private agentClient: AxiosInstance;
  public config: Required<MinerUConfig>;

  constructor(config: MinerUConfig) {
    const baseUrl = config.baseUrl || MINERU_DEFAULT_CONFIG.baseUrl!;
    const agentBaseUrl = MINERU_DEFAULT_CONFIG.agentBaseUrl!;

    // Precision API client (requires token)
    this.precisionClient = axios.create({
      baseURL: baseUrl,
      timeout: config.timeout || MINERU_DEFAULT_CONFIG.timeout!,
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
      },
    });

    // Add token auth for Precision API
    if (config.token) {
      this.precisionClient.defaults.headers.common['Authorization'] = `Bearer ${config.token}`;
    }

    // Agent API client (no auth required)
    this.agentClient = axios.create({
      baseURL: agentBaseUrl,
      timeout: config.timeout || MINERU_DEFAULT_CONFIG.timeout!,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add interceptors for error handling
    this.precisionClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleApiError(error),
    );

    this.agentClient.interceptors.response.use(
      (response) => response,
      (error) => this.handleApiError(error),
    );

    this.config = {
      baseUrl,
      timeout: config.timeout || MINERU_DEFAULT_CONFIG.timeout!,
      maxRetries: config.maxRetries || MINERU_DEFAULT_CONFIG.maxRetries!,
      retryDelay: config.retryDelay || MINERU_DEFAULT_CONFIG.retryDelay!,
      downloadDir: config.downloadDir,
      defaultOptions: config.defaultOptions || MINERU_DEFAULT_CONFIG.defaultOptions!,
      token: config.token || '',
    } as Required<MinerUConfig>;
  }

  private handleApiError(error: any): never {
    if (error.response) {
      const { data, status, headers } = error.response;
      const errorMessage = data.msg || data.message || `HTTP ${status} error`;
      const errorCode = data.code || this.getErrorCodeFromStatus(status);

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
      throw new MinerUTimeoutError(`Request failed: ${error.message}`);
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

  // ==================== Token Validation ====================

  /**
   * Validate the API token by making a simple request
   */
  async validateToken(): Promise<boolean> {
    if (!this.config.token) {
      console.error('❌ No token configured');
      return false;
    }

    try {
      await this.precisionClient.get('/extract/task/validate-token-test');
      return true;
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

  // ==================== Precision API: Single File ====================

  /**
   * Create a single file parsing task (Precision API)
   */
  async createSingleFileTask(request: SingleFileRequest): Promise<string> {
    console.log(
      `[MinerUClient] Creating single file task:`,
      JSON.stringify(request, null, 2),
    );

    return this.retryRequest(async () =>
      this.precisionClient.post<ApiResponse<SingleFileResponse>>(
        '/extract/task',
        request,
      ),
    ).then((data) => {
      if (!data || !data.task_id) {
        const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.warn(`[MinerUClient] Generated fallback task_id: ${fallbackId}`);
        return fallbackId;
      }
      console.log(`[MinerUClient] Single file task created. Task ID: ${data.task_id}`);
      return data.task_id;
    });
  }

  /**
   * Get single file task result (Precision API)
   */
  async getTaskResult(taskId: string): Promise<TaskResult> {
    console.log(`[MinerUClient] Getting task result for ID: ${taskId}`);
    return this.retryRequest(async () =>
      this.precisionClient.get<ApiResponse<TaskResult>>(`/extract/task/${taskId}`),
    );
  }

  /**
   * Cancel a running task (Precision API)
   */
  async cancelTask(taskId: string): Promise<boolean> {
    console.log(`[MinerUClient] Cancelling task: ${taskId}`);
    try {
      return this.retryRequest(async () =>
        this.precisionClient.delete<ApiResponse<{ cancelled: boolean }>>(
          `/extract/task/${taskId}`,
        ),
      ).then((data) => data.cancelled);
    } catch (error) {
      console.error(`[MinerUClient] Error cancelling task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Wait for single file task completion and download result (Precision API)
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
      timeout = 300000,
      downloadDir = './downloads',
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await this.getTaskResult(taskId);

      console.log(`[MinerUClient] Task ${taskId} status:`, {
        state: result.state,
        elapsed: Date.now() - startTime,
      });

      if (result.state === 'done') {
        console.log(`[MinerUClient] Task ${taskId} completed`);
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
   * Process a single file from start to finish (Precision API)
   */
  async processSingleFile(
    request: SingleFileRequest,
    options: {
      pollInterval?: number;
      timeout?: number;
      downloadDir?: string;
    } = {},
  ): Promise<{ result: TaskResult; downloadedFiles?: string[] }> {
    const taskId = await this.createSingleFileTask(request);
    return this.waitForTaskCompletion(taskId, options);
  }

  // ==================== Precision API: Batch ====================

  /**
   * Request upload URLs for batch file processing (Precision API)
   */
  async requestBatchFileUrls(request: BatchFileRequest): Promise<{
    batchId: string;
    uploadUrls: string[];
  }> {
    const response = await this.retryRequest(async () =>
      this.precisionClient.post<ApiResponse<BatchFileResponse>>(
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
   * Upload files to provided URLs (Precision API)
   */
  async uploadFiles(uploadInfos: FileUploadInfo[]): Promise<void> {
    console.log(`[MinerUClient] Starting upload for ${uploadInfos.length} files`);

    const uploadPromises = uploadInfos.map(async (info) => {
      console.log(`[MinerUClient] Please install @aikb/s3-service for file upload`);
      throw new Error('S3 upload requires @aikb/s3-service package');
    });

    await Promise.all(uploadPromises);
  }

  /**
   * Process batch files (Precision API)
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
      model_version?: 'pipeline' | 'vlm' | 'MinerU-HTML';
    } = {},
  ): Promise<{ batchId: string; s3Urls: string[] }> {
    console.log(`[MinerUClient] processBatchFiles: ${files.length} files`);
    throw new Error('Batch file processing requires @aikb/s3-service package');
  }

  /**
   * Create batch URL parsing task (Precision API)
   */
  async createBatchUrlTask(request: BatchUrlRequest): Promise<string> {
    console.log(`[MinerUClient] Creating batch URL task`);
    return this.retryRequest(async () =>
      this.precisionClient.post<ApiResponse<BatchUrlResponse>>(
        '/extract/task/batch',
        request,
      ),
    ).then((data) => data.batch_id);
  }

  /**
   * Get batch task results (Precision API)
   */
  async getBatchTaskResults(batchId: string): Promise<BatchTaskResult> {
    console.log(`[MinerUClient] Getting batch results for ID: ${batchId}`);
    return this.retryRequest(async () =>
      this.precisionClient.get<ApiResponse<BatchTaskResult>>(
        `/extract-results/batch/${batchId}`,
      ),
    );
  }

  /**
   * Wait for batch task completion (Precision API)
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
      timeout = 600000,
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
        for (const result of results.extract_result) {
          if (result.state === 'done' && result.full_zip_url) {
            const taskIdentifier = result.data_id || result.file_name || 'unknown';
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
   * Process batch URLs (Precision API)
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

  // ==================== Agent API ====================

  /**
   * Parse URL directly (Agent API - no auth required)
   */
  async agentParseUrl(
    request: AgentUrlParseRequest,
    options: {
      pollInterval?: number;
      timeout?: number;
    } = {},
  ): Promise<AgentTaskResult> {
    const { pollInterval = 5000, timeout = 300000 } = options;
    const startTime = Date.now();

    // Create task
    const createResponse = await this.agentClient.post<
      ApiResponse<{ task_id: string }>
    >('/parse/url', request);

    const taskId = createResponse.data.data.task_id;
    console.log(`[MinerUClient] Agent task created: ${taskId}`);

    // Poll for result
    while (Date.now() - startTime < timeout) {
      const result = await this.agentClient.get<ApiResponse<AgentTaskResult>>(
        `/parse/${taskId}`,
      );

      const taskResult = result.data.data;
      console.log(`[MinerUClient] Agent task ${taskId} status: ${taskResult.state}`);

      if (taskResult.state === 'done') {
        return taskResult;
      } else if (taskResult.state === 'failed') {
        throw new MinerUApiError('TASK_FAILED', taskResult.err_msg || 'Task failed');
      }

      await this.delay(pollInterval);
    }

    throw new MinerUTimeoutError(`Agent task ${taskId} did not complete within ${timeout}ms`);
  }

  /**
   * Get file upload URL for Agent API (no auth required)
   */
  async agentGetUploadUrl(fileName: string): Promise<AgentFileUploadResponse> {
    const response = await this.agentClient.post<ApiResponse<AgentFileUploadResponse>>(
      '/parse/file',
      { file_name: fileName },
    );
    return response.data.data;
  }

  /**
   * Upload file to signed URL (Agent API)
   */
  async agentUploadFile(filePath: string, uploadUrl: string): Promise<void> {
    const fileContent = await fs.promises.readFile(filePath);
    await axios.put(uploadUrl, fileContent, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }

  /**
   * Get Agent task result (Agent API)
   */
  async agentGetTaskResult(taskId: string): Promise<AgentTaskResult> {
    const response = await this.agentClient.get<ApiResponse<AgentTaskResult>>(
      `/parse/${taskId}`,
    );
    return response.data.data;
  }

  // ==================== Utility Methods ====================

  private async downloadResultZip(
    zipUrl: string,
    downloadDir: string,
    taskId: string,
  ): Promise<string[]> {
    console.log(`[MinerUClient] Downloading ZIP: ${zipUrl}`);

    const zipFileName = `${taskId}.zip`;
    const absoluteZipPath = path.resolve(path.join(downloadDir, zipFileName));

    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const downloadResponse = await axios({
      method: 'GET',
      url: zipUrl,
      responseType: 'stream',
    });

    const fileWriter = createWriteStream(absoluteZipPath);
    downloadResponse.data.pipe(fileWriter);

    await new Promise<void>((resolve, reject) => {
      fileWriter.on('finish', () => {
        console.log(`[MinerUClient] ZIP downloaded: ${absoluteZipPath}`);
        resolve();
      });
      fileWriter.on('error', reject);
    });

    return [absoluteZipPath];
  }

  /**
   * Validate file format
   */
  static isValidFileFormat(fileName: string): boolean {
    const validExtensions = [
      '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg',
    ];
    const ext = path.extname(fileName).toLowerCase();
    return validExtensions.includes(ext);
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return [
      'ch', 'en', 'japan', 'korean', 'fr', 'german', 'spanish', 'russian',
      'arabic', 'italian', 'portuguese', 'romanian', 'bulgarian', 'ukrainian',
      'belarusian', 'tamil', 'telugu', 'kannada', 'thai', 'vietnamese', 'devanagari',
    ];
  }
}
