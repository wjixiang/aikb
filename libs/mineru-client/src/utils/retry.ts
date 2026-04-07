import type { AxiosResponse } from 'axios';

import type { ApiResponse } from '../types';
import type { Logger } from 'pino';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryRequest<T>(
  requestFn: () => Promise<AxiosResponse<ApiResponse<T>>>,
  maxRetries: number,
  retryDelay: number,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await requestFn();
      return response.data.data;
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        await delay(retryDelay * attempt);
      }
    }
  }

  throw lastError!;
}

export interface PollOptions {
  pollInterval?: number;
  timeout?: number;
}

export interface PollResult<T> {
  done: boolean;
  value?: T;
}

export async function pollTask<T>(
  logger: Logger,
  taskLabel: string,
  fetchState: () => Promise<PollResult<T>>,
  options: PollOptions = {},
): Promise<T> {
  const { pollInterval = 5000, timeout = 300000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await fetchState();

    if (result.done) {
      return result.value!;
    }

    logger.info(
      { task: taskLabel, elapsed: Date.now() - startTime },
      'Task still running, polling...',
    );

    await delay(pollInterval);
  }

  throw new Error(`Task ${taskLabel} did not complete within ${timeout}ms`);
}
