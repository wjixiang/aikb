import { describe, it, expect } from 'vitest';
import {
  EmbeddingProvider,
  defaultEmbeddingConfig,
  EmbedResult,
  BatchEmbedResult,
} from '../src/types.js';

describe('Types', () => {
  describe('EmbeddingProvider', () => {
    it('should have correct enum values', () => {
      expect(EmbeddingProvider.OPENAI).toBe('openai');
      expect(EmbeddingProvider.ALIBABA).toBe('alibaba');
      expect(EmbeddingProvider.OLLAMA).toBe('ollama');
    });

    it('should have all expected providers', () => {
      const providers = Object.values(EmbeddingProvider);
      expect(providers).toContain('openai');
      expect(providers).toContain('alibaba');
      expect(providers).toContain('ollama');
    });
  });

  describe('defaultEmbeddingConfig', () => {
    it('should have default provider as alibaba', () => {
      expect(defaultEmbeddingConfig.provider).toBe(EmbeddingProvider.ALIBABA);
    });

    it('should have default model', () => {
      expect(defaultEmbeddingConfig.model).toBe('text-embedding-v4');
    });

    it('should have default dimension', () => {
      expect(defaultEmbeddingConfig.dimension).toBe(1024);
    });

    it('should have default batch size', () => {
      expect(defaultEmbeddingConfig.batchSize).toBe(20);
    });

    it('should have default max retries', () => {
      expect(defaultEmbeddingConfig.maxRetries).toBe(3);
    });

    it('should have default timeout', () => {
      expect(defaultEmbeddingConfig.timeout).toBe(20000);
    });
  });

  describe('EmbedResult', () => {
    it('should create successful result with embedding', () => {
      const embedding = [0.1, 0.2, 0.3];
      const result: EmbedResult = { success: true, embedding };

      expect(result.success).toBe(true);
      expect(result.embedding).toEqual(embedding);
      expect(result.error).toBeUndefined();
    });

    it('should create failed result with error', () => {
      const result: EmbedResult = { success: false, error: 'API error' };

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
      expect(result.embedding).toBeUndefined();
    });
  });

  describe('BatchEmbedResult', () => {
    it('should create valid batch result', () => {
      const results: EmbedResult[] = [
        { success: true, embedding: [0.1, 0.2] },
        { success: false, error: 'Failed' },
        { success: true, embedding: [0.3, 0.4] },
      ];
      const batchResult: BatchEmbedResult = {
        results,
        successCount: 2,
        errorCount: 1,
      };

      expect(batchResult.successCount).toBe(2);
      expect(batchResult.errorCount).toBe(1);
      expect(batchResult.results).toHaveLength(3);
    });
  });
});
