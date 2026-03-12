import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Embedding, embedding } from '../src/embedding.js';
import { EmbeddingProvider, defaultEmbeddingConfig } from '../src/types.js';

describe('Embedding', () => {
  let embeddingInstance: Embedding;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingInstance = new Embedding();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default provider', () => {
      const instance = new Embedding();
      expect(instance.getDefaultProvider()).toBe(EmbeddingProvider.ALIBABA);
    });

    it('should create instance with custom default provider', () => {
      const instance = new Embedding(EmbeddingProvider.OPENAI);
      expect(instance.getDefaultProvider()).toBe(EmbeddingProvider.OPENAI);
    });

    it('should create instance with ollama provider', () => {
      const instance = new Embedding(EmbeddingProvider.OLLAMA);
      expect(instance.getDefaultProvider()).toBe(EmbeddingProvider.OLLAMA);
    });

    it('should initialize all providers', () => {
      const instance = new Embedding();
      expect(instance).toBeDefined();
    });
  });

  describe('getDefaultProvider', () => {
    it('should return current default provider', () => {
      expect(embeddingInstance.getDefaultProvider()).toBe(EmbeddingProvider.ALIBABA);
    });
  });

  describe('setDefaultProvider', () => {
    it('should change default provider to openai', () => {
      embeddingInstance.setDefaultProvider(EmbeddingProvider.OPENAI);
      expect(embeddingInstance.getDefaultProvider()).toBe(EmbeddingProvider.OPENAI);
    });

    it('should change default provider to ollama', () => {
      embeddingInstance.setDefaultProvider(EmbeddingProvider.OLLAMA);
      expect(embeddingInstance.getDefaultProvider()).toBe(EmbeddingProvider.OLLAMA);
    });

    it('should change default provider back to alibaba', () => {
      embeddingInstance.setDefaultProvider(EmbeddingProvider.OPENAI);
      embeddingInstance.setDefaultProvider(EmbeddingProvider.ALIBABA);
      expect(embeddingInstance.getDefaultProvider()).toBe(EmbeddingProvider.ALIBABA);
    });
  });

  describe('embed', () => {
    it('should return error for unknown provider', async () => {
      const result = await embeddingInstance.embed('test', {
        provider: 'unknown' as any,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('embedBatch', () => {
    it('should return error for unknown provider', async () => {
      const result = await embeddingInstance.embedBatch(['text1', 'text2'], {
        provider: 'unknown' as any,
      });

      expect(result.successCount).toBe(0);
      expect(result.errorCount).toBe(2);
      expect(result.results[0].error).toContain('not found');
    });
  });

  describe('defaultEmbeddingConfig', () => {
    it('should have all required fields', () => {
      expect(defaultEmbeddingConfig.provider).toBeDefined();
      expect(defaultEmbeddingConfig.model).toBeDefined();
      expect(defaultEmbeddingConfig.dimension).toBeDefined();
      expect(defaultEmbeddingConfig.batchSize).toBeDefined();
      expect(defaultEmbeddingConfig.maxRetries).toBeDefined();
      expect(defaultEmbeddingConfig.timeout).toBeDefined();
    });
  });

  describe('singleton export', () => {
    it('should export singleton instance', () => {
      expect(embedding).toBeDefined();
      expect(embedding).toBeInstanceOf(Embedding);
    });

    it('singleton should have default provider', () => {
      expect(embedding.getDefaultProvider()).toBe(EmbeddingProvider.ALIBABA);
    });
  });
});
