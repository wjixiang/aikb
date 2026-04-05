import { checkClientHealth } from '../client/pool.health.js';
import type { ApiClient } from '../types/api-client.js';

describe('checkClientHealth', () => {
  it('should return healthy for a working client', async () => {
    const client: ApiClient = {
      makeRequest: async () => ({
        toolCalls: [],
        textResponse: 'ok',
        requestTime: 5,
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      }),
    } as ApiClient;

    const result = await checkClientHealth(client, 5000);
    expect(result.healthy).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('should return unhealthy for a failing client', async () => {
    const client: ApiClient = {
      makeRequest: async () => {
        throw new Error('API key invalid');
      },
    } as ApiClient;

    const result = await checkClientHealth(client, 5000);
    expect(result.healthy).toBe(false);
    expect(result.error).toBe('API key invalid');
  });

  it('should return unhealthy for a timeout error', async () => {
    const client: ApiClient = {
      makeRequest: async () => {
        throw new Error('Request timed out after 100ms');
      },
    } as ApiClient;

    const result = await checkClientHealth(client, 5000);
    expect(result.healthy).toBe(false);
    expect(result.error).toContain('timed out');
  });
});
