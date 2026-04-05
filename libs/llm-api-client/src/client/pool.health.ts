import type { ApiClient } from '../types/api-client.js';
import type { HealthCheckResult } from './pool.types.js';

/**
 * Check the health of an API client by sending a minimal request.
 *
 * Uses a tiny prompt to minimize token cost. If the request completes
 * within the timeout without throwing, the client is considered healthy.
 *
 * @param client - The API client to check
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Health check result with latency and status
 */
export async function checkClientHealth(
  client: ApiClient,
  timeout: number = 10000,
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    await client.makeRequest(
      'Reply with a single word: ok',
      '',
      [],
      { timeout },
    );

    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown health check error';
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      error: message,
    };
  }
}
