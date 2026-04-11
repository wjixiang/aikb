import { ClientPool } from '../client/pool.js';
import {
  QuotaExceededError,
  RateLimitError,
  ValidationError,
  ContentPolicyError,
} from '../errors/errors.js';
import type { ApiClient, ApiResponse } from '../types/api-client.js';

const mockResponse: ApiResponse = {
  toolCalls: [],
  textResponse: 'ok',
  requestTime: 10,
  tokenUsage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
};

function createMockFactory(): (settings: any) => ApiClient {
  return () => ({
    makeRequest: async () => ({ ...mockResponse }),
  } as ApiClient);
}

function createFailingFactory(errorMessage: string): (settings: any) => ApiClient {
  return () => ({
    makeRequest: async () => {
      throw new Error(errorMessage);
    },
  } as ApiClient);
}

describe('ClientPool - Singleton', () => {
  it('should return the same instance', () => {
    ClientPool.resetInstance();
    const a = ClientPool.getInstance();
    const b = ClientPool.getInstance();
    expect(a).toBe(b);
    ClientPool.resetInstance();
  });
});

describe('ClientPool - Registration', () => {
  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should throw when registering with duplicate name', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'test',
      settings: { apiProvider: 'openai', apiKey: 'key', apiModelId: 'gpt-4' },
    });
    expect(() =>
      pool.register({
        name: 'test',
        settings: { apiProvider: 'openai', apiKey: 'key2', apiModelId: 'gpt-4' },
      }),
    ).toThrow('already registered');
  });

  it('should list registered client names', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'anthropic', apiKey: 'k', apiModelId: 'm' },
    });
    expect(pool.list()).toEqual(['a', 'b']);
  });

  it('should check if a client exists', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'exists',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    expect(pool.has('exists')).toBe(true);
    expect(pool.has('nope')).toBe(false);
  });

  it('should unregister a client', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'temp',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    expect(pool.unregister('temp')).toBe(true);
    expect(pool.has('temp')).toBe(false);
  });

  it('should return false when unregistering non-existent client', () => {
    const pool = ClientPool.getInstance();
    expect(pool.unregister('ghost')).toBe(false);
  });

  it('should clear all clients', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.clear();
    expect(pool.list()).toEqual([]);
  });

  it('should register multiple clients at once', () => {
    const pool = ClientPool.getInstance();
    const names = pool.registerMany([
      {
        name: 'a',
        settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
      },
      {
        name: 'b',
        settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
      },
    ]);
    expect(names).toEqual(['a', 'b']);
  });
});

describe('ClientPool - Get / GetOrCreate', () => {
  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should return undefined for non-existent client', () => {
    const pool = ClientPool.getInstance();
    expect(pool.get('ghost')).toBeUndefined();
  });

  it('should return undefined for disabled client', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'off',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.disable('off');
    expect(pool.get('off')).toBeUndefined();
  });

  it('should return a proxied client that is callable', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'test',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    const client = pool.get('test')!;
    const result = await client.makeRequest('sys', 'ctx', []);
    expect(result.textResponse).toBe('ok');
    expect(result.tokenUsage.totalTokens).toBe(150);
  });

  it('should getOrCreate return existing client', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'existing',
      settings: { apiProvider: 'openai', apiKey: 'k1', apiModelId: 'm' },
    });
    const client = pool.getOrCreate(
      { apiProvider: 'openai', apiKey: 'k2', apiModelId: 'm' },
      'existing',
    );
    expect(client).toBeDefined();
    expect(pool.list()).toEqual(['existing']);
  });

  it('should getOrCreate register new client if not found', () => {
    const pool = ClientPool.getInstance();
    const client = pool.getOrCreate(
      { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
      'new',
    );
    expect(client).toBeDefined();
    expect(pool.has('new')).toBe(true);
  });

  it('should auto-generate ID when name is omitted in register', () => {
    const pool = ClientPool.getInstance();
    const name = pool.register({
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    expect(name).toMatch(/^client-\d+$/);
    expect(pool.has(name)).toBe(true);
  });

  it('should auto-generate ID when name is omitted in getOrCreate', () => {
    const pool = ClientPool.getInstance();
    const client = pool.getOrCreate({
      apiProvider: 'openai',
      apiKey: 'k',
      apiModelId: 'm',
    });
    expect(client).toBeDefined();
    expect(pool.list().length).toBe(1);
    expect(pool.list()[0]).toMatch(/^client-\d+$/);
  });
});

describe('ClientPool - Enable / Disable', () => {
  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should enable and disable clients', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'toggle',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    pool.disable('toggle');
    expect(pool.get('toggle')).toBeUndefined();

    pool.enable('toggle');
    expect(pool.get('toggle')).toBeDefined();
  });

  it('should not throw when enabling non-existent client', () => {
    const pool = ClientPool.getInstance();
    expect(() => pool.enable('ghost')).not.toThrow();
  });
});

describe('ClientPool - Stats', () => {
  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should collect stats on successful requests', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'stats',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    const client = pool.get('stats')!;
    await client.makeRequest('sys', 'ctx', []);
    await client.makeRequest('sys', 'ctx', []);

    const stats = pool.getStats('stats')!;
    expect(stats.totalRequests).toBe(2);
    expect(stats.successRequests).toBe(2);
    expect(stats.failedRequests).toBe(0);
    expect(stats.totalPromptTokens).toBe(200);
    expect(stats.totalCompletionTokens).toBe(100);
    expect(stats.lastUsedAt).not.toBeNull();
    expect(stats.lastError).toBeNull();
  });

  it('should collect stats on failed requests', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createFailingFactory('something broke');

    pool.register({
      name: 'fail',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    const client = pool.get('fail')!;
    try {
      await client.makeRequest('sys', 'ctx', []);
    } catch {
      // expected
    }

    const stats = pool.getStats('fail')!;
    expect(stats.totalRequests).toBe(1);
    expect(stats.successRequests).toBe(0);
    expect(stats.failedRequests).toBe(1);
    expect(stats.lastError).not.toBeNull();
  });

  it('should return undefined for non-existent client stats', () => {
    const pool = ClientPool.getInstance();
    expect(pool.getStats('ghost')).toBeUndefined();
  });

  it('should return aggregate pool stats', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    const clientA = pool.get('a')!;
    await clientA.makeRequest('sys', 'ctx', []);

    const clientB = pool.get('b')!;
    await clientB.makeRequest('sys', 'ctx', []);

    const poolStats = pool.getPoolStats();
    expect(poolStats.totalClients).toBe(2);
    expect(poolStats.enabledClients).toBe(2);
    expect(poolStats.totalRequests).toBe(2);
    expect(poolStats.totalPromptTokens).toBe(200);
    expect(poolStats.totalCompletionTokens).toBe(100);
    expect(poolStats.entries.a).toBeDefined();
    expect(poolStats.entries.b).toBeDefined();
  });

  it('should count disabled clients in total but not enabled', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'on',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'off',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.disable('off');

    const stats = pool.getPoolStats();
    expect(stats.totalClients).toBe(2);
    expect(stats.enabledClients).toBe(1);
  });
});

describe('ClientPool - Quota', () => {
  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should throw QuotaExceededError when request quota exceeded', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'quota',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.setQuota('quota', { maxRequests: 2 });

    const client = pool.get('quota')!;
    await client.makeRequest('sys', 'ctx', []);
    await client.makeRequest('sys', 'ctx', []);

    await expect(
      client.makeRequest('sys', 'ctx', []),
    ).rejects.toThrow(QuotaExceededError);
  });

  it('should throw QuotaExceededError when token quota exceeded', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'token-quota',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.setQuota('token-quota', { maxTokens: 100 });

    const client = pool.get('token-quota')!;
    await client.makeRequest('sys', 'ctx', []);

    await expect(
      client.makeRequest('sys', 'ctx', []),
    ).rejects.toThrow(QuotaExceededError);
  });

  it('should return quota usage', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'usage',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.setQuota('usage', { maxTokens: 1000, maxRequests: 100 });

    const client = pool.get('usage')!;
    await client.makeRequest('sys', 'ctx', []);

    const usage = pool.getQuotaUsage('usage')!;
    expect(usage.usedTokens).toBe(150);
    expect(usage.usedRequests).toBe(1);
  });

  it('should throw when setting quota for non-existent client', () => {
    const pool = ClientPool.getInstance();
    expect(() => pool.setQuota('ghost', { maxRequests: 10 })).toThrow(
      'not found',
    );
  });

  it('should return undefined for non-existent client quota usage', () => {
    const pool = ClientPool.getInstance();
    expect(pool.getQuotaUsage('ghost')).toBeUndefined();
  });

  it('should not enforce quota when no quota is set', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'no-quota',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    const client = pool.get('no-quota')!;
    for (let i = 0; i < 10; i++) {
      await client.makeRequest('sys', 'ctx', []);
    }
    expect(pool.getStats('no-quota')!.totalRequests).toBe(10);
  });
});

describe('ClientPool - Round Robin', () => {
  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should return clients in round-robin order', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'c',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    // The first call returns 'a', then 'b', then 'c', then cycles back
    const results: string[] = [];
    for (let i = 0; i < 6; i++) {
      const client = pool.getNext()!;
      // We can't directly read the name from the proxy, so verify via stats
      await client.makeRequest('sys', 'ctx', []);
    }

    const stats = pool.getPoolStats();
    // Each client should have been called exactly 2 times
    expect(stats.entries.a!.totalRequests).toBe(2);
    expect(stats.entries.b!.totalRequests).toBe(2);
    expect(stats.entries.c!.totalRequests).toBe(2);
  });

  it('should skip disabled clients', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'c',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.disable('b');

    for (let i = 0; i < 4; i++) {
      const client = pool.getNext()!;
      await client.makeRequest('sys', 'ctx', []);
    }

    const stats = pool.getPoolStats();
    expect(stats.entries.a!.totalRequests).toBe(2);
    expect(stats.entries.b!.totalRequests).toBe(0);
    expect(stats.entries.c!.totalRequests).toBe(2);
  });

  it('should return undefined when no clients are enabled', () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'off',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.disable('off');
    expect(pool.getNext()).toBeUndefined();
  });

  it('should return undefined when pool is empty', () => {
    const pool = ClientPool.getInstance();
    expect(pool.getNext()).toBeUndefined();
  });

  it('should handle client disabled between calls', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'c',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    // First call gets 'a' (index 0), index advances to 1
    const first = pool.getNext()!;
    await first.makeRequest('sys', 'ctx', []);

    // Disable 'b' — enabled list becomes ['a', 'c']
    // index=1 % 2 = 1, so gets 'c', index advances to 0
    pool.disable('b');
    const second = pool.getNext()!;
    await second.makeRequest('sys', 'ctx', []);
    // index=0 % 2 = 0, so gets 'a', index advances to 1
    const third = pool.getNext()!;
    await third.makeRequest('sys', 'ctx', []);

    const stats = pool.getPoolStats();
    expect(stats.entries.a!.totalRequests).toBe(2);
    expect(stats.entries.b!.totalRequests).toBe(0);
    expect(stats.entries.c!.totalRequests).toBe(1);
  });

  it('should reset round-robin index', async () => {
    const pool = ClientPool.getInstance();
    pool.register({
      name: 'a',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });
    pool.register({
      name: 'b',
      settings: { apiProvider: 'openai', apiKey: 'k', apiModelId: 'm' },
    });

    // index=0 → gets 'a', index→1
    await pool.getNext()!.makeRequest('sys', 'ctx', []);
    // index=1 → gets 'b', index→0
    await pool.getNext()!.makeRequest('sys', 'ctx', []);
    // reset → index=0
    pool.resetRoundRobin();
    // index=0 → gets 'a', index→1
    await pool.getNext()!.makeRequest('sys', 'ctx', []);

    const stats = pool.getPoolStats();
    // 'a' was called 2 times (before reset + after reset)
    // 'b' was called 1 time
    expect(stats.entries.a!.totalRequests).toBe(2);
    expect(stats.entries.b!.totalRequests).toBe(1);
  });
});

describe('ClientPool - Fallback', () => {
  const baseSettings = {
    apiProvider: 'openai' as const,
    apiKey: 'k',
    apiModelId: 'm',
  };

  function createRetryableFactory(): (settings: any) => ApiClient {
    return () => ({
      makeRequest: async () => {
        throw new RateLimitError('Rate limited', 429);
      },
    } as ApiClient);
  }

  function createNonRetryableFactory(): (settings: any) => ApiClient {
    return () => ({
      makeRequest: async () => {
        throw new ValidationError('Bad input', 'field');
      },
    } as ApiClient);
  }

  function createContentPolicyFactory(): (settings: any) => ApiClient {
    return () => ({
      makeRequest: async () => {
        throw new ContentPolicyError('Policy violation', 400);
      },
    } as ApiClient);
  }

  beforeEach(() => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createMockFactory();
  });

  afterEach(() => {
    ClientPool.resetInstance();
  });

  it('should succeed on first client without fallback', async () => {
    const pool = ClientPool.getInstance();
    pool.register({ name: 'a', settings: baseSettings });
    pool.register({ name: 'b', settings: baseSettings });

    const result = await pool.makeRequestWithFallback('sys', 'ctx', []);
    expect(result.textResponse).toBe('ok');
    // Only first client should have been called
    expect(pool.getStats('a')!.totalRequests).toBe(1);
    expect(pool.getStats('b')!.totalRequests).toBe(0);
  });

  it('should fall back to next client on retryable error', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    // Override factory to make 'a' fail and 'b' succeed
    const callLog: string[] = [];
    pool._clientFactory = (settings: any) => {
      const name = settings._name;
      return {
        makeRequest: async () => {
          callLog.push(name);
          if (name === 'a') {
            throw new RateLimitError('Rate limited', 429);
          }
          return { ...mockResponse };
        },
      } as ApiClient;
    };

    pool.register({ name: 'a', settings: { ...baseSettings, _name: 'a' } as any });
    pool.register({ name: 'b', settings: { ...baseSettings, _name: 'b' } as any });

    const result = await pool.makeRequestWithFallback('sys', 'ctx', []);
    expect(result.textResponse).toBe('ok');
    expect(callLog).toEqual(['a', 'b']);
    expect(pool.getStats('a')!.failedRequests).toBe(1);
    expect(pool.getStats('b')!.successRequests).toBe(1);
  });

  it('should try all clients until one succeeds', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    const callLog: string[] = [];
    pool._clientFactory = (settings: any) => {
      const name = settings._name;
      return {
        makeRequest: async () => {
          callLog.push(name);
          if (name === 'c') return { ...mockResponse };
          throw new RateLimitError('Rate limited', 429);
        },
      } as ApiClient;
    };

    pool.register({ name: 'a', settings: { ...baseSettings, _name: 'a' } as any });
    pool.register({ name: 'b', settings: { ...baseSettings, _name: 'b' } as any });
    pool.register({ name: 'c', settings: { ...baseSettings, _name: 'c' } as any });

    const result = await pool.makeRequestWithFallback('sys', 'ctx', []);
    expect(result.textResponse).toBe('ok');
    expect(callLog).toEqual(['a', 'b', 'c']);
  });

  it('should throw last error when all clients fail with retryable errors', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createRetryableFactory();

    pool.register({ name: 'a', settings: baseSettings });
    pool.register({ name: 'b', settings: baseSettings });

    await expect(
      pool.makeRequestWithFallback('sys', 'ctx', []),
    ).rejects.toThrow('Rate limited');
  });

  it('should NOT fall back on non-retryable error', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createNonRetryableFactory();

    pool.register({ name: 'a', settings: baseSettings });
    pool.register({ name: 'b', settings: baseSettings });

    await expect(
      pool.makeRequestWithFallback('sys', 'ctx', []),
    ).rejects.toThrow('Bad input');

    // Only 'a' should have been called
    expect(pool.getStats('a')!.totalRequests).toBe(1);
    expect(pool.getStats('b')!.totalRequests).toBe(0);
  });

  it('should NOT fall back on ContentPolicyError', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    pool._clientFactory = createContentPolicyFactory();

    pool.register({ name: 'a', settings: baseSettings });
    pool.register({ name: 'b', settings: baseSettings });

    await expect(
      pool.makeRequestWithFallback('sys', 'ctx', []),
    ).rejects.toThrow('Policy violation');

    expect(pool.getStats('a')!.totalRequests).toBe(1);
    expect(pool.getStats('b')!.totalRequests).toBe(0);
  });

  it('should respect maxAttempts option', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    const callLog: string[] = [];
    pool._clientFactory = (settings: any) => {
      const name = settings._name;
      return {
        makeRequest: async () => {
          callLog.push(name);
          throw new RateLimitError('Rate limited', 429);
        },
      } as ApiClient;
    };

    pool.register({ name: 'a', settings: { ...baseSettings, _name: 'a' } as any });
    pool.register({ name: 'b', settings: { ...baseSettings, _name: 'b' } as any });
    pool.register({ name: 'c', settings: { ...baseSettings, _name: 'c' } as any });

    await expect(
      pool.makeRequestWithFallback('sys', 'ctx', [], undefined, undefined, {
        maxAttempts: 2,
      }),
    ).rejects.toThrow('Rate limited');

    expect(callLog).toEqual(['a', 'b']);
  });

  it('should respect skipClients option', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    const callLog: string[] = [];
    pool._clientFactory = (settings: any) => {
      const name = settings._name;
      return {
        makeRequest: async () => {
          callLog.push(name);
          return { ...mockResponse };
        },
      } as ApiClient;
    };

    pool.register({ name: 'a', settings: { ...baseSettings, _name: 'a' } as any });
    pool.register({ name: 'b', settings: { ...baseSettings, _name: 'b' } as any });

    await pool.makeRequestWithFallback('sys', 'ctx', [], undefined, undefined, {
      skipClients: ['a'],
    });

    // Should skip 'a' and start from 'b'
    expect(callLog).toEqual(['b']);
  });

  it('should throw when no enabled clients', async () => {
    const pool = ClientPool.getInstance();

    await expect(
      pool.makeRequestWithFallback('sys', 'ctx', []),
    ).rejects.toThrow('No enabled LLM clients available');
  });

  it('should track fallback stats', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    const callLog: string[] = [];
    pool._clientFactory = (settings: any) => {
      const name = settings._name;
      return {
        makeRequest: async () => {
          callLog.push(name);
          if (name === 'a') throw new RateLimitError('Rate limited', 429);
          return { ...mockResponse };
        },
      } as ApiClient;
    };

    pool.register({ name: 'a', settings: { ...baseSettings, _name: 'a' } as any });
    pool.register({ name: 'b', settings: { ...baseSettings, _name: 'b' } as any });

    await pool.makeRequestWithFallback('sys', 'ctx', []);

    const stats = pool.getPoolStats();
    expect(stats.totalFallbackRequests).toBe(1);
    expect(stats.successfulFallbackRequests).toBe(1);
  });

  it('should fall back on QuotaExceededError', async () => {
    ClientPool.resetInstance();
    const pool = ClientPool.getInstance();
    const callLog: string[] = [];
    pool._clientFactory = (settings: any) => {
      const name = settings._name;
      return {
        makeRequest: async () => {
          callLog.push(name);
          if (name === 'a') {
            throw new QuotaExceededError('Quota exceeded', 'tokens');
          }
          return { ...mockResponse };
        },
      } as ApiClient;
    };

    pool.register({ name: 'a', settings: { ...baseSettings, _name: 'a' } as any });
    pool.register({ name: 'b', settings: { ...baseSettings, _name: 'b' } as any });

    const result = await pool.makeRequestWithFallback('sys', 'ctx', []);
    expect(result.textResponse).toBe('ok');
    expect(callLog).toEqual(['a', 'b']);
    expect(pool.getStats('a')!.failedRequests).toBe(1);
    expect(pool.getStats('b')!.successRequests).toBe(1);
  });

  it('should reset fallback stats on clear', async () => {
    const pool = ClientPool.getInstance();
    pool.register({ name: 'a', settings: baseSettings });

    await pool.makeRequestWithFallback('sys', 'ctx', []);
    expect(pool.getPoolStats().totalFallbackRequests).toBe(1);

    pool.clear();
    // After clear, need to re-register. Factory is already set by beforeEach.
    pool.register({ name: 'a', settings: baseSettings });
    expect(pool.getPoolStats().totalFallbackRequests).toBe(0);
  });
});
