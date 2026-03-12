import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIEmbeddingProvider } from '../src/providers/openai.js';
import { EmbeddingProvider } from '../src/types.js';

describe('OpenAIEmbeddingProvider', () => {
  let provider: OpenAIEmbeddingProvider;

  const mockConfig = {
    provider: EmbeddingProvider.OPENAI,
    model: 'text-embedding-3-small',
    dimension: 1536,
    batchSize: 20,
    maxRetries: 3,
    timeout: 20000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIEmbeddingProvider('test-openai-key');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should accept API key and base URL in constructor', () => {
      const customProvider = new OpenAIEmbeddingProvider('custom-key', 'https://custom.api.com/v1');
      expect(customProvider).toBeDefined();
    });

    it('should use environment variables when no parameters provided', () => {
      const envProvider = new OpenAIEmbeddingProvider();
      expect(envProvider).toBeDefined();
    });

    it('should use custom base URL when provided', () => {
      const customProvider = new OpenAIEmbeddingProvider('key', 'https://custom.api.com/v1');
      expect(customProvider).toBeDefined();
    });
  });

  describe('embed', () => {
    it('should throw when API key is missing', async () => {
      const noKeyProvider = new OpenAIEmbeddingProvider('');

      await expect(noKeyProvider.embed('test', mockConfig)).rejects.toThrow('OPENAI_API_KEY is not set');
    });
  });
});
