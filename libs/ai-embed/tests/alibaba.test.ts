import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlibabaEmbeddingProvider } from '../src/providers/alibaba.js';
import { EmbeddingProvider } from '../src/types.js';

describe('AlibabaEmbeddingProvider', () => {
  let provider: AlibabaEmbeddingProvider;

  const mockConfig = {
    provider: EmbeddingProvider.ALIBABA,
    model: 'text-embedding-v4',
    dimension: 1024,
    batchSize: 20,
    maxRetries: 3,
    timeout: 20000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AlibabaEmbeddingProvider('test-api-key');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should accept API key in constructor', () => {
      const customProvider = new AlibabaEmbeddingProvider('custom-key');
      expect(customProvider).toBeDefined();
    });

    it('should use environment variable when no API key provided', () => {
      const envProvider = new AlibabaEmbeddingProvider();
      expect(envProvider).toBeDefined();
    });
  });

  describe('embed', () => {
    it('should throw when API key is missing', async () => {
      const noKeyProvider = new AlibabaEmbeddingProvider('');
      const config = { ...mockConfig, provider: EmbeddingProvider.ALIBABA };

      await expect(noKeyProvider.embed('test', config)).rejects.toThrow('ALIBABA_API_KEY is not set');
    });
  });
});
