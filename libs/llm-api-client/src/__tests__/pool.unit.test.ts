import { ClientPool } from '../client/pool.js';
import { QuotaExceededError } from '../errors/errors.js';
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
    const client = pool.getOrCreate('existing', {
      apiProvider: 'openai',
      apiKey: 'k2',
      apiModelId: 'm',
    });
    expect(client).toBeDefined();
    expect(pool.list()).toEqual(['existing']);
  });

  it('should getOrCreate register new client if not found', () => {
    const pool = ClientPool.getInstance();
    const client = pool.getOrCreate('new', {
      apiProvider: 'openai',
      apiKey: 'k',
      apiModelId: 'm',
    });
    expect(client).toBeDefined();
    expect(pool.has('new')).toBe(true);
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
