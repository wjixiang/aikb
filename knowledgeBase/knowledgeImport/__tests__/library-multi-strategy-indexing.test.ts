import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import Library from '../library';
import { MockLibraryStorage } from '../MockLibraryStorage';
import { MultiVersionVectorStorage } from '../../storage/multiVersionVectorStorage';
import { DefaultGroupManager } from '../../../lib/chunking/defaultGroupManager';
import { ChunkSearchUtils } from '../../../lib/chunking/chunkSearchUtils';
import { ChunkingErrorHandler } from '../../../lib/error/errorHandler';
import { Client } from '@elastic/elasticsearch';
import { BookChunk, ChunkSearchFilter } from '../library';
import { EmbeddingConfig, EmbeddingProvider, OpenAIModel } from '../../../lib/embedding/embedding';
import { ChunkingConfig } from '../../../lib/chunking/chunkingStrategy';
import { embeddingService } from '../../../lib/embedding/embedding';
import { ChunkingStrategyType } from '../../../lib/chunking/chunkingStrategy';

// Mock embedding service
vi.mock('../../lib/embedding/embedding', () => ({
  embeddingService: {
    embedBatch: vi.fn().mockResolvedValue([
      [0.1, 0.2, 0.3, 0.4, 0.5],
      [0.2, 0.3, 0.4, 0.5, 0.6],
    ]),
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
    getProvider: vi.fn().mockReturnValue(EmbeddingProvider.OPENAI),
  },
}));

// Mock Elasticsearch client
vi.mock('@elastic/elasticsearch', () => ({
  Client: vi.fn().mockImplementation(() => ({
    indices: {
      exists: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    search: vi.fn().mockResolvedValue({
      hits: {
        hits: []
      }
    }),
    bulk: vi.fn().mockResolvedValue({}),
    updateByQuery: vi.fn().mockResolvedValue({}),
    deleteByQuery: vi.fn().mockResolvedValue({ deleted: 0 }),
    get: vi.fn().mockResolvedValue({ found: false }),
    index: vi.fn().mockResolvedValue({}),
  })),
}));

describe('Library Multi-Strategy Multi-Version Indexing', () => {
  let library: Library;
  let mockStorage: MockLibraryStorage;
  let mockVectorStorage: MultiVersionVectorStorage;
  let mockClient: any;

  beforeAll(() => {
    // Initialize mock client
    mockClient = new Client({ node: 'http://localhost:9200' });
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock storage
    mockStorage = new MockLibraryStorage();
    mockVectorStorage = new MultiVersionVectorStorage(mockClient);
    
    // Create library instance
    library = new Library(mockStorage);
    
    // Initialize the default group manager
    DefaultGroupManager.getInstance();
  });

  describe('Default Group Manager', () => {
    it('should provide default groups for different strategies', () => {
      const groupManager = DefaultGroupManager.getInstance();
      
      const h1Group = groupManager.getDefaultGroup('h1');
      expect(h1Group).not.toBeNull();
      expect(h1Group?.chunkingStrategy).toBe('h1');
      expect(h1Group?.id).toBe('default-h1');
      
      const paragraphGroup = groupManager.getDefaultGroup('paragraph');
      expect(paragraphGroup).not.toBeNull();
      expect(paragraphGroup?.chunkingStrategy).toBe('paragraph');
      expect(paragraphGroup?.id).toBe('default-paragraph');
    });

    it('should provide fallback for unknown strategies', () => {
      const groupManager = DefaultGroupManager.getInstance();
      
      const unknownGroup = groupManager.getDefaultGroup('unknown');
      expect(unknownGroup).not.toBeNull();
      // Should fallback to a known strategy
    });

    it('should get group config for search with fallback', () => {
      const groupManager = DefaultGroupManager.getInstance();
      
      const config = groupManager.getGroupConfigForSearch({
        chunkingStrategy: 'h1',
      });
      
      expect(config).not.toBeNull();
      expect(config?.groupId).toBe('default-h1');
      expect(config?.group.chunkingStrategy).toBe('h1');
    });
  });

  describe('Advanced Search Functionality', () => {
    it('should search chunks with group priorities', async () => {
      // Create test chunks
      const chunks: BookChunk[] = [
        {
          id: 'chunk1',
          itemId: 'item1',
          title: 'Test Chunk 1',
          content: 'This is test content 1',
          index: 0,
          denseVectorIndexGroupId: 'default-h1',
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'chunk2',
          itemId: 'item1',
          title: 'Test Chunk 2',
          content: 'This is test content 2',
          index: 1,
          denseVectorIndexGroupId: 'custom-paragraph',
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
          strategyMetadata: {
            chunkingStrategy: 'paragraph',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 200,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock storage search
      mockStorage.getChunksByItemId = vi.fn().mockResolvedValue(chunks);

      const filter: ChunkSearchFilter = {
        itemId: 'item1',
      };

      const results = await library.searchChunksAdvanced(filter, {
        groupPriorities: { 'default-h1': 2, 'custom-paragraph': 1 },
        sortBy: 'relevance',
        sortOrder: 'desc',
      });

      expect(results).toHaveLength(2);
      expect(mockStorage.getChunksByItemId).toHaveBeenCalledWith('item1');
    });

    it('should find similar chunks with rank fusion', async () => {
      const filter: ChunkSearchFilter = {
        itemId: 'item1',
        groups: ['default-h1', 'custom-paragraph'],
      };

      // Test the basic functionality - the method should not throw and should return something
      const results = await library.findSimilarChunksAdvanced(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        filter,
        {
          rankFusion: true,
          weights: { 'default-h1': 2, 'custom-paragraph': 1 },
        }
      );

      // The method should return an array (could be empty if no similar chunks found)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should apply advanced filtering with deduplication', async () => {
      // Create test chunks with similar content
      const chunks: BookChunk[] = [
        {
          id: 'chunk1',
          itemId: 'item1',
          title: 'Test Chunk 1',
          content: 'This is test content that should be similar to another chunk',
          index: 0,
          denseVectorIndexGroupId: 'default-h1',
          
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'chunk2',
          itemId: 'item1',
          title: 'Test Chunk 2',
          content: 'This is test content that should be similar to another chunk',
          index: 1,
          denseVectorIndexGroupId: 'custom-paragraph',
          
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
          strategyMetadata: {
            chunkingStrategy: 'paragraph',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 200,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock storage search
      mockStorage.getChunksByItemId = vi.fn().mockResolvedValue(chunks);

      const filter: ChunkSearchFilter = {
        itemId: 'item1',
      };

      const results = await library.searchChunksAdvanced(filter, {
        deduplicate: true,
        deduplicationThreshold: 0.9,
      });

      expect(results).toHaveLength(1); // One chunk should be removed due to deduplication
    });
  });

  describe('Chunk Search Utils', () => {
    it('should filter chunks by multiple criteria', () => {
      const chunks: BookChunk[] = [
        {
          id: 'chunk1',
          itemId: 'item1',
          title: 'Test Chunk 1',
          content: 'This is test content 1',
          index: 0,
          denseVectorIndexGroupId: 'default-h1',
          
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'chunk2',
          itemId: 'item2',
          title: 'Test Chunk 2',
          content: 'This is test content 2',
          index: 0,
          denseVectorIndexGroupId: 'custom-paragraph',
          
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
          strategyMetadata: {
            chunkingStrategy: 'paragraph',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 200,
          },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
      ];

      const filter: ChunkSearchFilter = {
        itemId: 'item1',
        chunkingStrategies: ['h1'],
        embeddingProviders: [EmbeddingProvider.OPENAI],
      };

      const filteredChunks = ChunkSearchUtils.filterChunks(chunks, filter);
      
      expect(filteredChunks).toHaveLength(1);
      expect(filteredChunks[0].id).toBe('chunk1');
    });

    it('should sort chunks by different criteria', () => {
      const chunks: BookChunk[] = [
        {
          id: 'chunk1',
          itemId: 'item1',
          title: 'A Chunk',
          content: 'Content 1',
          index: 0,
          denseVectorIndexGroupId: 'default-h1',
          
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
        {
          id: 'chunk2',
          itemId: 'item1',
          title: 'Z Chunk',
          content: 'Content 2',
          index: 1,
          denseVectorIndexGroupId: 'default-h1',
          
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 200,
          },
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
        },
      ];

      // Sort by title ascending
      const sortedByTitle = ChunkSearchUtils.sortChunks(chunks, 'title', 'asc');
      expect(sortedByTitle[0].title).toBe('A Chunk');
      expect(sortedByTitle[1].title).toBe('Z Chunk');

      // Sort by title descending
      const sortedByTitleDesc = ChunkSearchUtils.sortChunks(chunks, 'title', 'desc');
      expect(sortedByTitleDesc[0].title).toBe('Z Chunk');
      expect(sortedByTitleDesc[1].title).toBe('A Chunk');

      // Sort by date descending
      const sortedByDate = ChunkSearchUtils.sortChunks(chunks, 'date', 'desc');
      expect(sortedByDate[0].id).toBe('chunk2'); // More recent date
      expect(sortedByDate[1].id).toBe('chunk1');
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors with fallback', async () => {
      // Mock storage to throw an error
      mockStorage.getChunksByItemId = vi.fn().mockRejectedValue(new Error('Storage error'));

      const filter: ChunkSearchFilter = {
        itemId: 'item1',
      };

      const results = await library.searchChunksAdvanced(filter);
      
      expect(results).toEqual([]); // Should return empty results as fallback
    });

    it('should validate parameters for advanced search', async () => {
      const filter: ChunkSearchFilter = {
        itemId: 'item1',
      };

      // Should not throw for valid parameters
      await expect(library.searchChunksAdvanced(filter)).resolves.not.toThrow();
    });

    it('should validate required parameters', async () => {
      const invalidFilter = null as any;
      
      await expect(library.searchChunksAdvanced(invalidFilter)).rejects.toThrow();
    });
  });

  describe('Multi-Version Vector Storage', () => {
    beforeEach(() => {
      // Reset the mock before each test
      vi.clearAllMocks();
    });

    it('should store chunks with versioning information', async () => {
      const chunks: BookChunk[] = [
        {
          id: 'chunk1',
          itemId: 'item1',
          title: 'Test Chunk 1',
          content: 'This is test content 1',
          index: 0,
          denseVectorIndexGroupId: 'default-h1',
          
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock index exists check to return false
      mockClient.indices.exists = vi.fn().mockResolvedValue(false);
      
      // Mock index creation to succeed
      mockClient.indices.create = vi.fn().mockResolvedValue({});

      await mockVectorStorage.storeChunks(chunks);
      
      expect(mockClient.indices.exists).toHaveBeenCalled();
      expect(mockClient.indices.create).toHaveBeenCalled();
    });

    it('should find similar chunks with rank fusion', async () => {
      const chunks: BookChunk[] = [
        {
          id: 'chunk1',
          itemId: 'item1',
          title: 'Test Chunk 1',
          content: 'This is test content 1',
          index: 0,
          denseVectorIndexGroupId: 'default-h1',
          
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: 'h1',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'chunk2',
          itemId: 'item1',
          title: 'Test Chunk 2',
          content: 'This is test content 2',
          index: 1,
          denseVectorIndexGroupId: 'custom-paragraph',
          
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
          strategyMetadata: {
            chunkingStrategy: 'paragraph',
            chunkingConfig: { maxChunkSize: 1000, minChunkSize: 100 },
            embeddingConfig: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            processingTimestamp: new Date(),
            processingDuration: 200,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock search response
      mockClient.search = vi.fn().mockResolvedValue({
        hits: {
          hits: chunks.map(chunk => ({
            _source: chunk,
            _score: 1.5 // Similarity + 1
          }))
        }
      });

      const filter: ChunkSearchFilter = {
        itemId: 'item1',
        groups: ['default-h1', 'custom-paragraph'],
        limit: 10,
      };

      const results = await mockVectorStorage.findSimilarChunksWithRankFusion(
        [0.1, 0.2, 0.3, 0.4, 0.5],
        filter,
        {
          provider: EmbeddingProvider.OPENAI,
          weights: { 'default-h1': 2, 'custom-paragraph': 1 }
        }
      );

      expect(results).toHaveLength(2);
      expect(mockClient.search).toHaveBeenCalled();
    });
  });
});