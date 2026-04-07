import axios from 'axios';
import { config } from '../config.js';

interface TaskDetail {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    content?: string;
    output_s3_key?: string;
    metadata?: Record<string, unknown>;
  };
  error_message?: string;
}

class FileConvertService {
  private client = axios.create({
    baseURL: config.fileRenderer.baseUrl,
    timeout: config.fileRenderer.timeout,
  });

  async convertS3ToMarkdown(s3Key: string): Promise<string> {
    // Step 1: Submit conversion task
    const form = new URLSearchParams();
    form.append('s3_key', s3Key);
    form.append('output_format', 'markdown');

    const { data: task } = await this.client.post<{ task_id: string }>(
      '/conversion/convert-s3',
      form,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const taskId = task.task_id;

    // Step 2: Poll until completed
    const result = await this.pollTask(taskId);

    if (result.status === 'failed') {
      throw new Error(`Conversion failed: ${result.error_message ?? 'unknown error'}`);
    }

    const content = result.result?.content;
    if (!content) {
      throw new Error('Conversion completed but no content in result');
    }

    return content;
  }

  private async pollTask(taskId: string): Promise<TaskDetail> {
    const interval = config.fileRenderer.pollInterval;
    const deadline = Date.now() + config.fileRenderer.timeout;

    while (Date.now() < deadline) {
      const { data: task } = await this.client.get<TaskDetail>(`/tasks/${taskId}`);

      if (task.status === 'completed' || task.status === 'failed') {
        return task;
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Conversion timed out after ${config.fileRenderer.timeout}ms`);
  }
}

export const fileConvertService = new FileConvertService();
