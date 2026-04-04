import { BaseApiClient, BaseClientConfig } from '../client/base.js';
import { ApiClientError, ConfigurationError, parseError, ValidationError, TimeoutError } from '../errors/errors.js';

/**
 * Minimal concrete implementation for testing BaseApiClient shared logic
 */
class TestableBaseApiClient extends BaseApiClient {
  constructor(config: BaseClientConfig) {
    super(config, 'TestClient');
  }

  protected get maxTemperature(): number {
    return 2;
  }

  protected parseProviderError(error: unknown, context?: { timeout?: number }) {
    return parseError(error, context);
  }

  protected async executeApiRequest(): Promise<any> {
    return {
      toolCalls: [],
      textResponse: 'test',
      requestTime: 0,
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

describe('BaseApiClient - validateRequestInputs', () => {
  const client = new TestableBaseApiClient({ apiKey: 'test-key', model: 'test' });

  it('should throw ValidationError when systemPrompt is not a string', () => {
    expect(() =>
      (client as any).validateRequestInputs(123, 'ctx', []),
    ).toThrow(ValidationError);
  });

  it('should throw ValidationError when workspaceContext is not a string', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 123, []),
    ).toThrow(ValidationError);
  });

  it('should throw ValidationError when memoryContext is not an array', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', 'not-array'),
    ).toThrow(ValidationError);
  });

  it('should throw ValidationError when tools is not an array', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', [], 'not-array'),
    ).toThrow(ValidationError);
  });

  it('should throw ValidationError for tool with invalid type', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', [], [
        { type: 'invalid' },
      ]),
    ).toThrow(ValidationError);
  });

  it('should throw ValidationError for function tool missing name', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', [], [
        { type: 'function', function: {} },
      ]),
    ).toThrow(ValidationError);
  });

  it('should accept valid inputs', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', []),
    ).not.toThrow();
  });

  it('should accept valid inputs with tools', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', [], [
        {
          type: 'function',
          function: { name: 'test_tool', parameters: {} },
        },
      ]),
    ).not.toThrow();
  });

  it('should accept custom tool type', () => {
    expect(() =>
      (client as any).validateRequestInputs('prompt', 'ctx', [], [
        { type: 'custom', custom: { name: 'custom_tool' } },
      ]),
    ).not.toThrow();
  });
});

describe('BaseApiClient - calculateRetryDelay', () => {
  it('should use exponential backoff', () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
      retryDelay: 1000,
    });
    const delay1 = (client as any).calculateRetryDelay(1);
    const delay2 = (client as any).calculateRetryDelay(2);
    const delay3 = (client as any).calculateRetryDelay(3);

    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThanOrEqual(1600);
    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThanOrEqual(3200);
    expect(delay3).toBeGreaterThanOrEqual(4000);
    expect(delay3).toBeLessThanOrEqual(6400);
  });

  it('should cap delay at 30 seconds', () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
      retryDelay: 10000,
    });
    expect((client as any).calculateRetryDelay(3)).toBe(30000);
  });

  it('should add jitter', () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
      retryDelay: 1000,
    });
    const delays = new Set<number>();
    for (let i = 0; i < 10; i++) {
      delays.add((client as any).calculateRetryDelay(1));
    }
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe('BaseApiClient - sleep', () => {
  it('should resolve after the specified time', async () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
    });
    const start = Date.now();
    await (client as any).sleep(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(200);
  });
});

describe('BaseApiClient - getStats', () => {
  it('should return initial stats', () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
    });
    const stats = client.getStats();
    expect(stats.requestCount).toBe(0);
    expect(stats.lastError).toBeNull();
  });
});

describe('BaseApiClient - getLastError', () => {
  it('should return null initially', () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
    });
    expect(client.getLastError()).toBeNull();
  });
});

describe('BaseApiClient - withTimeout', () => {
  it('should resolve when promise completes before timeout', async () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
    });
    const result = await (client as any).withTimeout(
      Promise.resolve('hello'),
      1000,
    );
    expect(result).toBe('hello');
  });

  it('should reject when promise exceeds timeout', async () => {
    const client = new TestableBaseApiClient({
      apiKey: 'test-key',
      model: 'test',
    });
    await expect(
      (client as any).withTimeout(
        new Promise((resolve) => setTimeout(resolve, 5000)),
        50,
      ),
    ).rejects.toThrow(TimeoutError);
  });
});

describe('BaseApiClient - validateConfig', () => {
  it('should throw ConfigurationError for missing apiKey', () => {
    expect(() => new TestableBaseApiClient({ apiKey: '', model: 'test' })).toThrow(
      ConfigurationError,
    );
  });

  it('should throw ConfigurationError for missing model', () => {
    expect(() => new TestableBaseApiClient({ apiKey: 'key', model: '' })).toThrow(
      ConfigurationError,
    );
  });

  it('should throw ConfigurationError for out-of-range temperature', () => {
    expect(() =>
      new TestableBaseApiClient({ apiKey: 'key', model: 'test', temperature: 3 }),
    ).toThrow(ConfigurationError);
  });

  it('should throw ConfigurationError for negative maxTokens', () => {
    expect(() =>
      new TestableBaseApiClient({ apiKey: 'key', model: 'test', maxTokens: -1 }),
    ).toThrow(ConfigurationError);
  });
});

describe('BaseApiClient - getMaskedConfig', () => {
  it('should mask apiKey in config output', () => {
    const client = new TestableBaseApiClient({
      apiKey: 'my-secret-api-key-12345',
      model: 'test-model',
    });
    const masked = (client as any).getMaskedConfig();
    expect(masked.apiKey).toBe('my-secre...');
    expect(masked.model).toBe('test-model');
  });
});
