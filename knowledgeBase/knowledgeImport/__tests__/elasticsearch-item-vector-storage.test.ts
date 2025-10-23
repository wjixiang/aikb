import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Client } from '@elastic/elasticsearch';
import {
  ElasticSearchItemVectorStorage,
  createItemVectorStorage,
} from '../elasticsearch-item-vector-storage';
import {
  ItemChunk,
  ItemVectorStorageStatus,
  ItemChunkSemanticSearchQuery,
} from '../library';
import {
  ChunkingStrategy,
  ChunkingConfig,
} from '../../../lib/chunking/chunkingStrategy';
import {
  EmbeddingProvider,
  EmbeddingConfig,
  Embedding,
} from '../../../lib/embedding/embedding';
import { ChunkingManager } from 'lib/chunking/chunkingManager';

// Mock the embedding service
vi.mock('../../../lib/embedding/embedding', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    Embedding: vi.fn().mockImplementation(() => ({
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
    })),
  };
});

describe('ElasticSearchItemVectorStorage', () => {
  let storage: ElasticSearchItemVectorStorage;
  let mockClient: any;
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
  const testItemId = 'test-item-id';
  const vectorDimensions = 5;

  const mockGroupInfo = {
    name: 'Test Group',
    description: 'Test group for unit tests',
    // chunkingStrategy: ChunkingStrategy.PARAGRAPH,
    chunkingConfig: {
      maxChunkSize: 1000,
      overlap: 200,
    } as ChunkingConfig,
    embeddingProvider: EmbeddingProvider.OPENAI,
    embeddingConfig: {
      model: 'text-embedding-ada-002',
      dimension: vectorDimensions,
      batchSize: 100,
      maxRetries: 3,
      timeout: 30000,
      provider: EmbeddingProvider.OPENAI,
    } as EmbeddingConfig,
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
    tags: ['test'],
  };

  beforeAll(async () => {
    // Create a real client for integration testing
    try {
      mockClient = new Client({
        node: elasticsearchUrl,
        auth: {
          apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
        },
      });

      // Try to ping the server to see if it's available
      await mockClient.ping();
      console.log('Elasticsearch is available, running integration tests');

      // Create storage instance
      const mockEmbeddingService = new Embedding();
      const mockChunkingService = new ChunkingManager();
      storage = new ElasticSearchItemVectorStorage(
        testItemId,
        { ...mockGroupInfo, id: 'test-group-id' },
        mockEmbeddingService,
        mockChunkingService,
        elasticsearchUrl,
      );
    } catch (error) {
      console.log('Elasticsearch is not available, skipping integration tests');
      mockClient = null;
    }
  });

  afterAll(async () => {
    if (mockClient) {
      try {
        // Clean up test data
        await mockClient.deleteByQuery({
          index: 'library_chunks',
          body: {
            query: {
              term: { itemId: testItemId },
            },
          },
        });
      } catch (error) {
        console.log('Error cleaning up test data:', error);
      }
    }
  });

  // Skip all tests if Elasticsearch is not available
  const testOrSkip = mockClient ? it : it.skip;

  describe('constructor', () => {
    it('should create an instance with correct properties', () => {
      if (!mockClient) return;

      expect(storage.itemId).toBe(testItemId);
      expect(storage.groupInfo.name).toBe(mockGroupInfo.name);
      expect(storage.groupInfo.chunkingConfig.strategy).toBe(
        mockGroupInfo.chunkingConfig.strategy,
      );
    });
  });

  describe('getStatus', () => {
    testOrSkip('should return FAILED status when no chunks exist', async () => {
      const status = await storage.getStatus();
      expect(status).toBe(ItemVectorStorageStatus.FAILED);
    });
  });

  describe('insertItemChunk', () => {
    testOrSkip('should insert a chunk successfully', async () => {
      const chunk: ItemChunk = {
        id: 'test-chunk-1',
        itemId: testItemId,
        denseVectorIndexGroupId: storage.groupInfo.id,
        title: 'Test Chunk',
        content: 'This is a test chunk',
        index: 0,
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        strategyMetadata: {
          chunkingStrategy: mockGroupInfo.chunkingConfig.strategy || 'h1',
          chunkingConfig: mockGroupInfo.chunkingConfig,
          embeddingConfig: mockGroupInfo.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await storage.insertItemChunk(chunk);
      expect(result).toBe(true);
    });

    testOrSkip('should reject chunk with wrong itemId', async () => {
      const chunk: ItemChunk = {
        id: 'test-chunk-2',
        itemId: 'wrong-item-id',
        denseVectorIndexGroupId: storage.groupInfo.id,
        title: 'Test Chunk',
        content: 'This is a test chunk',
        index: 0,
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        strategyMetadata: {
          chunkingStrategy: mockGroupInfo.chunkingConfig.strategy || 'h1',
          chunkingConfig: mockGroupInfo.chunkingConfig,
          embeddingConfig: mockGroupInfo.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(storage.insertItemChunk(chunk)).rejects.toThrow();
    });
  });

  describe('batchInsertItemChunks', () => {
    testOrSkip('should insert multiple chunks successfully', async () => {
      const chunks: ItemChunk[] = [
        {
          id: 'test-chunk-3',
          itemId: testItemId,
          denseVectorIndexGroupId: storage.groupInfo.id,
          title: 'Test Chunk 3',
          content: 'This is test chunk 3',
          index: 1,
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: mockGroupInfo.chunkingConfig.strategy || 'h1',
            chunkingConfig: mockGroupInfo.chunkingConfig,
            embeddingConfig: mockGroupInfo.embeddingConfig,
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'test-chunk-4',
          itemId: testItemId,
          denseVectorIndexGroupId: storage.groupInfo.id,
          title: 'Test Chunk 4',
          content: 'This is test chunk 4',
          index: 2,
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
          strategyMetadata: {
            chunkingStrategy: mockGroupInfo.chunkingConfig.strategy || 'h1',
            chunkingConfig: mockGroupInfo.chunkingConfig,
            embeddingConfig: mockGroupInfo.embeddingConfig,
            processingTimestamp: new Date(),
            processingDuration: 100,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = await storage.batchInsertItemChunks(chunks);
      expect(result).toBe(true);
    });
  });

  describe('getStatus after insertion', () => {
    testOrSkip('should return COMPLETED status when chunks exist', async () => {
      const status = await storage.getStatus();
      expect(status).toBe(ItemVectorStorageStatus.COMPLETED);
    });
  });

  describe('semanticSearch', () => {
    testOrSkip('should perform semantic search successfully', async () => {
      const query: ItemChunkSemanticSearchQuery = {
        searchText: 'test chunk',
        resultNum: 5,
        threshold: 0.5,
      };

      const results = await storage.semanticSearch(query);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});

describe('createItemVectorStorage', () => {
  it('should create an ElasticSearchItemVectorStorage instance', () => {
    const mockGroupInfo = {
      name: 'Test Group',
      description: 'Test group for unit tests',
      chunkingStrategy: ChunkingStrategy.PARAGRAPH,
      chunkingConfig: {
        maxChunkSize: 1000,
        overlap: 200,
      } as ChunkingConfig,
      embeddingProvider: EmbeddingProvider.OPENAI,
      embeddingConfig: {
        model: 'text-embedding-ada-002',
        dimension: 1536,
        batchSize: 100,
        maxRetries: 3,
        timeout: 30000,
        provider: EmbeddingProvider.OPENAI,
      } as EmbeddingConfig,
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user',
      tags: ['test'],
    };

    const mockEmbeddingService = new Embedding();
    const mockChunkingService = new ChunkingManager();
    const storage = createItemVectorStorage(
      'test-item-id',
      mockGroupInfo,
      mockEmbeddingService,
      mockChunkingService,
    );

    expect(storage.itemId).toBe('test-item-id');
    expect(storage.groupInfo.name).toBe(mockGroupInfo.name);
    expect(storage.groupInfo.id).toContain('test-item-id-Test Group-');
  });
});
