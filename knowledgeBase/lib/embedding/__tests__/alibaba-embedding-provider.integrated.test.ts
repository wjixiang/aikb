import { describe, beforeEach, it, expect } from 'vitest';
import { AlibabaEmbeddingProvider } from '../embedding-providers';

// Mock the logger to avoid console output during tests
vi.mock('../../logger', () => ({
  default: vi.fn().mockImplementation((prefix: string) => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('AlibabaEmbeddingProvider Native API Tests', () => {
  let provider: AlibabaEmbeddingProvider;
  const apiKey = process.env.ALIBABA_API_KEY;

  // Skip all tests if API key is not available
  beforeEach(() => {
    if (!apiKey) {
      console.warn('ALIBABA_API_KEY not found in environment variables. Skipping native API tests.');
    }
    provider = new AlibabaEmbeddingProvider(apiKey || '');
  });

  describe('embed method with real API calls', () => {
    it.skipIf(!apiKey)('should successfully embed a single text', async () => {
      const testText = 'This is a test text for embedding generation.';
      
      const result = await provider.embed(testText);
      
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1024); // Alibaba embedding dimension
      
      // Verify all values are numbers and within expected range
      result!.forEach((value) => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      });
    }, 30000); // 30 second timeout for API call

    it.skipIf(!apiKey)('should handle empty string input', async () => {
      const testText = '';
      
      const result = await provider.embed(testText);
      
      // Empty string might return null (API limitation) or a valid embedding
      if (result !== null) {
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      } else {
        // If null is returned, that's also acceptable behavior for empty input
        expect(result).toBeNull();
      }
    }, 30000);

    it.skipIf(!apiKey)('should handle special characters in text', async () => {
      const testText = 'Hello 世界! @#$%^&*()_+{}|:"<>?[]\\;\',./`~';
      
      const result = await provider.embed(testText);
      
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1024);
    }, 30000);

    it.skipIf(!apiKey)('should handle long text input', async () => {
      const testText = 'A'.repeat(2000); // 2000 character string
      
      const result = await provider.embed(testText);
      
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1024);
    }, 30000);

    it.skipIf(!apiKey)('should handle array input and return first embedding', async () => {
      const testTexts = ['First text', 'Second text', 'Third text'];
      
      const result = await provider.embed(testTexts);
      
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1024);
      
      // Verify all values are numbers
      result!.forEach((value) => {
        expect(typeof value).toBe('number');
      });
    }, 30000);

    it.skipIf(!apiKey)('should handle empty array input', async () => {
      const testTexts: string[] = [];
      
      const result = await provider.embed(testTexts);
      
      // Based on the implementation, this might return null or an embedding
      // The exact behavior depends on the API response
      if (result !== null) {
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      }
    }, 30000);

    it.skipIf(!apiKey)('should return consistent embeddings for identical inputs', async () => {
      const testText = 'Consistency test text';
      
      const result1 = await provider.embed(testText);
      const result2 = await provider.embed(testText);
      
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1).toEqual(result2);
    }, 45000); // 45 second timeout for two API calls

    it.skipIf(!apiKey)('should return different embeddings for different inputs', async () => {
      const testText1 = 'First unique text';
      const testText2 = 'Second unique text';
      
      const result1 = await provider.embed(testText1);
      const result2 = await provider.embed(testText2);
      
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1).not.toEqual(result2);
    }, 45000);

    it.skipIf(!apiKey)('should handle multilingual text', async () => {
      const testTexts = [
        'Hello world in English',
        'Bonjour le monde en français',
        'Hola mundo en español',
        '你好世界中文',
        'こんにちは世界の日本語',
        '안녕하세요 세계 한국어'
      ];
      
      for (const text of testTexts) {
        const result = await provider.embed(text);
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      }
    }, 60000); // 60 second timeout for multiple API calls
  });

  describe('embed method error handling with real API', () => {
    it.skipIf(!apiKey)('should handle invalid API key gracefully', async () => {
      // Create a provider with minimal retries to avoid long test times
      const invalidProvider = new AlibabaEmbeddingProvider('invalid-api-key', 2, 100);
      const testText = 'Test text';
      
      const startTime = Date.now();
      const result = await invalidProvider.embed(testText);
      const endTime = Date.now();
      
      expect(result).toBeNull();
      // Should fail quickly with minimal retries
      expect(endTime - startTime).toBeLessThan(5000);
    }, 10000);

    it.skipIf(!apiKey)('should handle null/undefined API key', async () => {
      const nullProvider = new AlibabaEmbeddingProvider(null as any);
      const testText = 'Test text';
      
      const result = await nullProvider.embed(testText);
      
      expect(result).toBeNull();
    });

    it.skipIf(!apiKey)('should handle empty string API key', async () => {
      const emptyProvider = new AlibabaEmbeddingProvider('');
      const testText = 'Test text';
      
      const result = await emptyProvider.embed(testText);
      
      expect(result).toBeNull();
    });
  });

  describe('performance tests with real API', () => {
    it.skipIf(!apiKey)('should complete single embedding within reasonable time', async () => {
      const testText = 'Performance test text';
      const startTime = Date.now();
      
      const result = await provider.embed(testText);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result).not.toBeNull();
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      console.log(`Single embedding completed in ${duration}ms`);
    }, 30000);

    it.skipIf(!apiKey)('should handle concurrent requests', async () => {
      const testTexts = [
        'Concurrent test 1',
        'Concurrent test 2',
        'Concurrent test 3',
        'Concurrent test 4',
        'Concurrent test 5'
      ];
      
      const startTime = Date.now();
      
      // Make concurrent requests
      const promises = testTexts.map(text => provider.embed(text));
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // All results should be valid
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
        console.log(`Concurrent request ${index + 1} completed successfully`);
      });
      
      console.log(`5 concurrent embeddings completed in ${duration}ms`);
    }, 60000);
  });

  describe('embedBatch method with real API calls', () => {
    it.skipIf(!apiKey)('should successfully embed a small batch of texts', async () => {
      const testTexts = [
        'First test text for batch processing',
        'Second test text for batch processing',
        'Third test text for batch processing'
      ];
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
        console.log(`Batch embedding ${index + 1} completed successfully`);
      });
    }, 45000);

    it.skipIf(!apiKey)('should handle a batch of 10 texts (maximum batch size)', async () => {
      const testTexts = Array.from({ length: 10 }, (_, i) => `Test text ${i + 1} for batch processing`);
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      });
      console.log('Maximum batch size (10) processed successfully');
    }, 60000);

    it.skipIf(!apiKey)('should handle a batch larger than maximum size (15 texts)', async () => {
      const testTexts = Array.from({ length: 15 }, (_, i) => `Test text ${i + 1} for large batch processing`);
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(15);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      });
      console.log('Large batch (15 texts) processed successfully with automatic batching');
    }, 90000);

    it.skipIf(!apiKey)('should handle empty array input', async () => {
      const testTexts: string[] = [];
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toEqual([]);
      console.log('Empty batch handled correctly');
    }, 30000);

    it.skipIf(!apiKey)('should handle batch with special characters', async () => {
      const testTexts = [
        'Text with special chars: @#$%^&*()',
        'Text with emojis: 🚀🌟💡',
        'Text with unicode: 中文测试',
        'Text with math: ∑∏∫∆∇∂',
        'Mixed: Hello 世界! @#$% 🌟'
      ];
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      });
      console.log('Batch with special characters processed successfully');
    }, 45000);

    it.skipIf(!apiKey)('should handle batch with varying text lengths', async () => {
      const testTexts = [
        'Short',
        'Medium length text with some content',
        'Very long text that contains a lot of words and should test how the API handles longer inputs in batch mode. This text is designed to be significantly longer than the others to ensure the batch processing can handle variable length inputs properly.',
        'A',
        'Another medium length text that falls somewhere between the short and very long examples'
      ];
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      });
      console.log('Batch with varying text lengths processed successfully');
    }, 45000);

    it.skipIf(!apiKey)('should return consistent embeddings for identical inputs in batch', async () => {
      const testTexts = [
        'Consistency test text 1',
        'Consistency test text 2',
        'Consistency test text 1', // Duplicate of first
        'Consistency test text 3',
        'Consistency test text 2'  // Duplicate of second
      ];
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(5);
      
      // Check that identical texts produce identical embeddings
      expect(results[0]).toEqual(results[2]); // Text 1 and Text 3 should be identical
      expect(results[1]).toEqual(results[4]); // Text 2 and Text 5 should be identical
      
      // Check that different texts produce different embeddings
      expect(results[0]).not.toEqual(results[1]);
      expect(results[0]).not.toEqual(results[3]);
      expect(results[1]).not.toEqual(results[3]);
      
      console.log('Batch consistency test passed - identical inputs produce identical embeddings');
    }, 45000);

    it.skipIf(!apiKey)('should handle multilingual text in batch', async () => {
      const testTexts = [
        'Hello world in English',
        'Bonjour le monde en français',
        'Hola mundo en español',
        '你好世界中文',
        'こんにちは世界の日本語',
        '안녕하세요 세계 한국어',
        'Привет мир на русском',
        'Hallo Welt auf Deutsch'
      ];
      
      const results = await provider.embedBatch(testTexts);
      
      expect(results).toHaveLength(8);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      });
      console.log('Multilingual batch processed successfully');
    }, 90000);
  });

  describe('embedBatch performance tests with real API', () => {
    it.skipIf(!apiKey)('should complete batch processing within reasonable time', async () => {
      const testTexts = Array.from({ length: 10 }, (_, i) => `Performance test text ${i + 1}`);
      const startTime = Date.now();
      
      const results = await provider.embedBatch(testTexts);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(1024);
      });
      
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      console.log(`Batch of 10 embeddings completed in ${duration}ms`);
    }, 30000);

    it.skipIf(!apiKey)('should handle concurrent batch requests', async () => {
      const batch1 = Array.from({ length: 5 }, (_, i) => `Concurrent batch 1 - text ${i + 1}`);
      const batch2 = Array.from({ length: 5 }, (_, i) => `Concurrent batch 2 - text ${i + 1}`);
      const batch3 = Array.from({ length: 5 }, (_, i) => `Concurrent batch 3 - text ${i + 1}`);
      
      const startTime = Date.now();
      
      // Make concurrent batch requests
      const promises = [
        provider.embedBatch(batch1),
        provider.embedBatch(batch2),
        provider.embedBatch(batch3)
      ];
      const allResults = await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Verify all batches completed successfully
      allResults.forEach((results, batchIndex) => {
        expect(results).toHaveLength(5);
        results.forEach((result) => {
          expect(result).not.toBeNull();
          expect(Array.isArray(result)).toBe(true);
          expect(result).toHaveLength(1024);
        });
        console.log(`Concurrent batch ${batchIndex + 1} completed successfully`);
      });
      
      console.log(`3 concurrent batches (15 total embeddings) completed in ${duration}ms`);
    }, 60000);
  });

  describe('embedBatch error handling with real API', () => {
    it.skipIf(!apiKey)('should handle batch with invalid API key gracefully', async () => {
      const invalidProvider = new AlibabaEmbeddingProvider('invalid-api-key', 2, 100);
      const testTexts = ['Text 1', 'Text 2', 'Text 3'];
      
      const startTime = Date.now();
      const results = await invalidProvider.embedBatch(testTexts);
      const endTime = Date.now();
      
      // Should return array of nulls when API key is invalid
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeNull();
      });
      
      // Should fail quickly with minimal retries
      expect(endTime - startTime).toBeLessThan(10000);
      console.log('Invalid API key batch test completed');
    }, 15000);

    it.skipIf(!apiKey)('should handle batch with null/undefined API key', async () => {
      const nullProvider = new AlibabaEmbeddingProvider(null as any, 2, 100);
      const testTexts = ['Text 1', 'Text 2'];
      
      const startTime = Date.now();
      const results = await nullProvider.embedBatch(testTexts);
      const endTime = Date.now();
      
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result).toBeNull();
      });
      
      // Should fail quickly with minimal retries
      expect(endTime - startTime).toBeLessThan(5000);
      console.log('Null API key batch test completed');
    }, 10000);

    it.skipIf(!apiKey)('should handle batch with empty string API key', async () => {
      const emptyProvider = new AlibabaEmbeddingProvider('', 2, 100);
      const testTexts = ['Text 1', 'Text 2'];
      
      const startTime = Date.now();
      const results = await emptyProvider.embedBatch(testTexts);
      const endTime = Date.now();
      
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result).toBeNull();
      });
      
      // Should fail quickly with minimal retries
      expect(endTime - startTime).toBeLessThan(5000);
      console.log('Empty API key batch test completed');
    }, 10000);
  });
});