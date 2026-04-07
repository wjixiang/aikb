import type { AxiosInstance } from 'axios';

import type {
  SingleFileRequest,
  BatchFileRequest,
  BatchUrlRequest,
  SingleFileResponse,
  BatchFileResponse,
  BatchUrlResponse,
  TaskResult,
  BatchTaskResult,
} from '../types';
import type { ApiResponse } from '../types';
import type { MinerUResolvedConfig } from '../constants';
import { MinerUApiError, MinerUTimeoutError } from '../errors';
import { pollTask, downloadResultZip, retryRequest } from '../utils';

// ---- Mixin host interface ----

export interface PrecisionApiHost {
  precisionClient: AxiosInstance;
  config: MinerUResolvedConfig;
  logger: import('pino').Logger;
}

// ---- Mixin ----

export function PrecisionApiMixin<TBase extends new (...args: any[]) => PrecisionApiHost>(
  Base: TBase,
) {
  return class extends Base {
    // ==================== Token Validation ====================

    async validateToken(): Promise<boolean> {
      if (!this.config.token) {
        this.logger.error('No token configured');
        return false;
      }

      try {
        await this.precisionClient.get('/extract/task/validate-token-test');
        return true;
      } catch (error) {
        if (error instanceof MinerUApiError) {
          if (error.code === 'NOT_FOUND' || error.code === 'HTTP_404') {
            this.logger.info('Token is valid (404 expected for test task)');
            return true;
          } else if (error.code === 'UNAUTHORIZED' || error.code === 'HTTP_401') {
            this.logger.error('Token is invalid or expired');
            return false;
          } else if (error.code === 'FORBIDDEN' || error.code === 'HTTP_403') {
            this.logger.error('Token does not have sufficient permissions');
            return false;
          }
        }
        this.logger.error({ err: error }, 'Token validation failed');
        return false;
      }
    }

    // ==================== Single File ====================

    async createSingleFileTask(request: SingleFileRequest): Promise<string> {
      this.logger.info({ request }, 'Creating single file task');

      return retryRequest(
        () => this.precisionClient.post<ApiResponse<SingleFileResponse>>('/extract/task', request),
        this.config.maxRetries,
        this.config.retryDelay,
      ).then((data) => {
        if (!data || !data.task_id) {
          const fallbackId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          this.logger.warn({ fallbackId }, 'Generated fallback task_id');
          return fallbackId;
        }
        this.logger.info({ taskId: data.task_id }, 'Single file task created');
        return data.task_id;
      });
    }

    async getTaskResult(taskId: string): Promise<TaskResult> {
      this.logger.info({ taskId }, 'Getting task result');
      return retryRequest(
        () => this.precisionClient.get<ApiResponse<TaskResult>>(`/extract/task/${taskId}`),
        this.config.maxRetries,
        this.config.retryDelay,
      );
    }

    async cancelTask(taskId: string): Promise<boolean> {
      this.logger.info({ taskId }, 'Cancelling task');
      return retryRequest(
        () => this.precisionClient.delete<ApiResponse<{ cancelled: boolean }>>(`/extract/task/${taskId}`),
        this.config.maxRetries,
        this.config.retryDelay,
      ).then((data) => data.cancelled);
    }

    async waitForTaskCompletion(
      taskId: string,
      options: {
        pollInterval?: number;
        timeout?: number;
        downloadDir?: string;
      } = {},
    ): Promise<{ result: TaskResult; downloadedFiles?: string[] }> {
      const { downloadDir = './downloads' } = options;

      const result = await pollTask<TaskResult>(
        this.logger,
        taskId,
        async () => {
          const r = await this.getTaskResult(taskId);
          if (r.state === 'failed') {
            throw new MinerUApiError(
              'TASK_FAILED',
              r.err_msg || 'Task processing failed',
            );
          }
          return { done: r.state === 'done', value: r };
        },
        options,
      );

      this.logger.info({ taskId }, 'Task completed');
      if (result.full_zip_url) {
        const downloadedFiles = await downloadResultZip(
          result.full_zip_url,
          downloadDir,
          taskId,
        );
        return { result, downloadedFiles };
      }
      return { result };
    }

    async processSingleFile(
      request: SingleFileRequest,
      options?: {
        pollInterval?: number;
        timeout?: number;
        downloadDir?: string;
      },
    ): Promise<{ result: TaskResult; downloadedFiles?: string[] }> {
      const taskId = await this.createSingleFileTask(request);
      return this.waitForTaskCompletion(taskId, options);
    }

    // ==================== Batch ====================

    async requestBatchFileUrls(request: BatchFileRequest): Promise<{
      batchId: string;
      uploadUrls: string[];
    }> {
      const response = await retryRequest(
        () => this.precisionClient.post<ApiResponse<BatchFileResponse>>('/file-urls/batch', request),
        this.config.maxRetries,
        this.config.retryDelay,
      );

      return {
        batchId: response.batch_id,
        uploadUrls: response.file_urls,
      };
    }

    async createBatchUrlTask(request: BatchUrlRequest): Promise<string> {
      this.logger.info('Creating batch URL task');
      return retryRequest(
        () => this.precisionClient.post<ApiResponse<BatchUrlResponse>>('/extract/task/batch', request),
        this.config.maxRetries,
        this.config.retryDelay,
      ).then((data) => data.batch_id);
    }

    async getBatchTaskResults(batchId: string): Promise<BatchTaskResult> {
      this.logger.info({ batchId }, 'Getting batch results');
      return retryRequest(
        () => this.precisionClient.get<ApiResponse<BatchTaskResult>>(`/extract-results/batch/${batchId}`),
        this.config.maxRetries,
        this.config.retryDelay,
      );
    }

    async waitForBatchTaskCompletion(
      batchId: string,
      options: {
        pollInterval?: number;
        timeout?: number;
        downloadDir?: string;
      } = {},
    ): Promise<{ results: BatchTaskResult; downloadedFiles: string[] }> {
      const { downloadDir = './downloads' } = options;
      const downloadedFiles: string[] = [];

      const results = await pollTask<BatchTaskResult>(
        this.logger,
        batchId,
        async () => {
          const r = await this.getBatchTaskResults(batchId);
          const allCompleted = r.extract_result.every(
            (result) => result.state === 'done' || result.state === 'failed',
          );
          return { done: allCompleted, value: r };
        },
        options,
      );

      for (const result of results.extract_result) {
        if (result.state === 'done' && result.full_zip_url) {
          const taskIdentifier = result.data_id || result.file_name || 'unknown';
          const files = await downloadResultZip(
            result.full_zip_url,
            downloadDir,
            taskIdentifier,
          );
          downloadedFiles.push(...files);
        }
      }

      return { results, downloadedFiles };
    }

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

  };
}
