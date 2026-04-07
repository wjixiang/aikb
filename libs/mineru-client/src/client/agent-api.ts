import axios from 'axios';
import * as fs from 'fs';
import type { AxiosInstance } from 'axios';

import type {
  AgentUrlParseRequest,
  AgentFileUploadResponse,
  AgentTaskResult,
} from '../types';
import type { ApiResponse } from '../types';
import type { MinerUResolvedConfig } from '../constants';
import { MinerUApiError, MinerUTimeoutError } from '../errors';
import { pollTask } from '../utils';

// ---- Mixin host interface ----

export interface AgentApiHost {
  agentClient: AxiosInstance;
  config: MinerUResolvedConfig;
  logger: import('pino').Logger;
}

// ---- Mixin ----

export function AgentApiMixin<TBase extends new (...args: any[]) => AgentApiHost>(
  Base: TBase,
) {
  return class extends Base {
    async agentParseUrl(
      request: AgentUrlParseRequest,
      options: {
        pollInterval?: number;
        timeout?: number;
      } = {},
    ): Promise<AgentTaskResult> {
      const createResponse = await this.agentClient.post<
        ApiResponse<{ task_id: string }>
      >('/parse/url', request);

      const taskId = createResponse.data.data.task_id;
      this.logger.info({ taskId }, 'Agent task created');

      return pollTask<AgentTaskResult>(
        this.logger,
        taskId,
        async () => {
          const result = await this.agentClient.get<ApiResponse<AgentTaskResult>>(
            `/parse/${taskId}`,
          );
          const taskResult = result.data.data;
          if (taskResult.state === 'failed') {
            throw new MinerUApiError(
              'TASK_FAILED',
              taskResult.err_msg || 'Task failed',
            );
          }
          return { done: taskResult.state === 'done', value: taskResult };
        },
        options,
      );
    }

    async agentGetUploadUrl(fileName: string): Promise<AgentFileUploadResponse> {
      const response = await this.agentClient.post<ApiResponse<AgentFileUploadResponse>>(
        '/parse/file',
        { file_name: fileName },
      );
      return response.data.data;
    }

    async agentUploadFile(filePath: string, uploadUrl: string): Promise<void> {
      const fileContent = await fs.promises.readFile(filePath);
      await axios.put(uploadUrl, fileContent, {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    }

    async agentGetTaskResult(taskId: string): Promise<AgentTaskResult> {
      const response = await this.agentClient.get<ApiResponse<AgentTaskResult>>(
        `/parse/${taskId}`,
      );
      return response.data.data;
    }
  };
}
