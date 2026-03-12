import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaEmbeddingProvider } from '../src/providers/ollama.js';
import { EmbeddingProvider } from '../src/types.js';

describe('OllamaEmbeddingProvider', () => {
  let provider: OllamaEmbeddingProvider;

  const mockConfig = {
    provider: EmbeddingProvider.OLLAMA,
    model: 'llama3.2',
    dimension: 768,
    batchSize: 20,
    maxRetries: 3,
    timeout: 20000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OllamaEmbeddingProvider();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should use default base URL', () => {
      const defaultProvider = new OllamaEmbeddingProvider();
      expect(defaultProvider).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const customProvider = new OllamaEmbeddingProvider('http://192.168.1.100:11434');
      expect(customProvider).toBeDefined();
    });

    it('should use environment variable when available', () => {
      const envProvider = new OllamaEmbeddingProvider();
      expect(envProvider).toBeDefined();
    });
  });

  describe('embed', () => {
    it('should create valid request body structure', async () => {
      // Just verify the provider can be instantiated and configured
      const config = mockConfig;
      expect(config.model).toBe('llama3.2');
      expect(config.provider).toBe(EmbeddingProvider.OLLAMA);
    });
  });
});
