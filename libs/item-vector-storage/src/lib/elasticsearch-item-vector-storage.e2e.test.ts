import { ElasticsearchItemVectorStorage } from './elasticsearch-item-vector-storage';
import {
  ItemVectorStorageStatus,
  ItemChunk,
  ChunkEmbedGroupMetadata,
} from './types';
import { EmbeddingConfig, EmbeddingProvider, OpenAIModel } from 'embedding';
import { ChunkingStrategy } from '@aikb/chunking';

describe('ElasticsearchItemVectorStorage E2E Tests', () => {
  let storage: ElasticsearchItemVectorStorage;
  const testIndexName = 'test_item_chunks_e2e';
  const testGroupsIndexName = 'test_chunk_embedding_groups_e2e';

  beforeAll(async () => {
    // Use a test-specific Elasticsearch instance
    storage = new ElasticsearchItemVectorStorage();

    // Clean up any existing test indices
    try {
      await storage['client'].indices.delete({ index: testIndexName });
      await storage['client'].indices.delete({ index: testGroupsIndexName });
    } catch (error) {
      // Ignore if indices don't exist
    }
  });

  afterAll(async () => {
    // Clean up test indices
    try {
      await storage['client'].indices.delete({ index: testIndexName });
      await storage['client'].indices.delete({ index: testGroupsIndexName });
    } catch (error) {
      // Ignore if indices don't exist
    }
  });

  describe('Group Management E2E', () => {
    const testGroupConfig: Omit<ChunkEmbedGroupMetadata, 'id'> = {
      name: 'Test Group',
      description: 'Test group for E2E testing',
      chunkingConfig: {
        strategy: ChunkingStrategy.PARAGRAPH,
        maxChunkSize: 1000,
        overlap: 100,
      },
      embeddingConfig: {
        model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
        dimension: 1536,
        batchSize: 20,
        maxRetries: 3,
        timeout: 20000,
        provider: EmbeddingProvider.OPENAI,
      },
      isDefault: false,
      isActive: true,
      createdBy: 'e2e-test',
      tags: ['test', 'e2e'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create and retrieve a chunk embedding group', async () => {
      let createdGroup: ChunkEmbedGroupMetadata;
      createdGroup =
        await storage.createNewChunkEmbedGroupInfo(testGroupConfig);

      expect(createdGroup).toBeDefined();
      expect(createdGroup.id).toBeDefined();
      expect(createdGroup.name).toBe(testGroupConfig.name);
      expect(createdGroup.description).toBe(testGroupConfig.description);
      expect(createdGroup.embeddingConfig.dimension).toBe(
        testGroupConfig.embeddingConfig.dimension,
      );
      expect(createdGroup.isActive).toBe(true);

      // Retrieve the group
      const retrievedGroup = await storage.getChunkEmbedGroupInfoById(
        createdGroup.id,
      );

      expect(retrievedGroup.id).toBe(createdGroup.id);
      expect(retrievedGroup.name).toBe(createdGroup.name);
      expect(retrievedGroup.embeddingConfig.dimension).toBe(
        createdGroup.embeddingConfig.dimension,
      );
    });

    it('should get status for a group', async () => {
      const createdGroup =
        await storage.createNewChunkEmbedGroupInfo(testGroupConfig);

      // Initially should be pending (no chunks yet)
      const status = await storage.getStatus(createdGroup.id);
      expect(status).toBe(ItemVectorStorageStatus.PENDING);
    });

    it('should delete a group and associated chunks', async () => {
      const createdGroup =
        await storage.createNewChunkEmbedGroupInfo(testGroupConfig);

      // Add some chunks first
      const testChunk: ItemChunk = {
        id: 'test-chunk-1',
        itemId: 'test-item-1',
        denseVectorIndexGroupId: createdGroup.id,
        title: 'Test Chunk',
        content: 'This is a test chunk for E2E testing',
        index: 0,
        embedding: new Array(testGroupConfig.embeddingConfig.dimension).fill(
          0.1,
        ),
        strategyMetadata: {
          chunkingStrategy: 'paragraph',
          chunkingConfig: testGroupConfig.chunkingConfig,
          embeddingConfig: testGroupConfig.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.insertItemChunk(createdGroup, testChunk);

      // Delete the group
      const deleteResult = await storage.deleteChunkEmbedGroupById(
        createdGroup.id,
      );

      expect(deleteResult.deletedGroupId).toBe(createdGroup.id);
      expect(deleteResult.deletedChunkNum).toBe(1);

      // Verify group is gone
      await expect(
        storage.getChunkEmbedGroupInfoById(createdGroup.id),
      ).rejects.toThrow();
    });
  });

  describe('Chunk Operations E2E', () => {
    let testGroup: ChunkEmbedGroupMetadata;

    beforeEach(async () => {
      testGroup = await storage.createNewChunkEmbedGroupInfo({
        name: 'E2E Test Group',
        description: 'Group for chunk operations testing',
        chunkingConfig: {
          strategy: ChunkingStrategy.SEMANTIC,
          maxChunkSize: 500,
          overlap: 50,
        },
        embeddingConfig: {
          model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
          dimension: 1536,
          batchSize: 10,
          maxRetries: 2,
          timeout: 15000,
          provider: EmbeddingProvider.OPENAI,
        },
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should insert a single item chunk', async () => {
      const testChunk: ItemChunk = {
        id: 'single-chunk-test',
        itemId: 'test-item-single',
        denseVectorIndexGroupId: testGroup.id,
        title: 'Single Test Chunk',
        content: 'This is a single test chunk for E2E testing',
        index: 0,
        embedding: new Array(testGroup.embeddingConfig.dimension).fill(0.2),
        strategyMetadata: {
          chunkingStrategy: 'semantic',
          chunkingConfig: testGroup.chunkingConfig,
          embeddingConfig: testGroup.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 150,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await storage.insertItemChunk(testGroup, testChunk);
      expect(result).toBe(true);

      // Verify status is now completed
      const status = await storage.getStatus(testGroup.id);
      expect(status).toBe(ItemVectorStorageStatus.COMPLETED);
    });

    it('should batch insert multiple item chunks', async () => {
      const testChunks: ItemChunk[] = [
        {
          id: 'batch-chunk-1',
          itemId: 'test-item-batch',
          denseVectorIndexGroupId: testGroup.id,
          title: 'Batch Test Chunk 1',
          content: 'First batch test chunk for E2E testing',
          index: 0,
          embedding: new Array(testGroup.embeddingConfig.dimension).fill(0.3),
          strategyMetadata: {
            chunkingStrategy: 'semantic',
            chunkingConfig: testGroup.chunkingConfig,
            embeddingConfig: testGroup.embeddingConfig,
            processingTimestamp: new Date(),
            processingDuration: 200,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'batch-chunk-2',
          itemId: 'test-item-batch',
          denseVectorIndexGroupId: testGroup.id,
          title: 'Batch Test Chunk 2',
          content: 'Second batch test chunk for E2E testing',
          index: 1,
          embedding: new Array(testGroup.embeddingConfig.dimension).fill(0.4),
          strategyMetadata: {
            chunkingStrategy: 'semantic',
            chunkingConfig: testGroup.chunkingConfig,
            embeddingConfig: testGroup.embeddingConfig,
            processingTimestamp: new Date(),
            processingDuration: 250,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = await storage.batchInsertItemChunks(testGroup, testChunks);
      expect(result).toBe(true);

      // Verify status is completed
      const status = await storage.getStatus(testGroup.id);
      expect(status).toBe(ItemVectorStorageStatus.COMPLETED);
    });

    it('should reject chunks with wrong dimensions', async () => {
      const wrongDimensionChunk: ItemChunk = {
        id: 'wrong-dim-chunk',
        itemId: 'test-item-wrong',
        denseVectorIndexGroupId: testGroup.id,
        title: 'Wrong Dimension Chunk',
        content: 'This chunk has wrong dimensions',
        index: 0,
        embedding: new Array(512).fill(0.5), // Wrong dimension
        strategyMetadata: {
          chunkingStrategy: 'semantic',
          chunkingConfig: testGroup.chunkingConfig,
          embeddingConfig: testGroup.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(
        storage.insertItemChunk(testGroup, wrongDimensionChunk),
      ).rejects.toThrow(
        `Vector dimensions mismatch. Expected: ${testGroup.embeddingConfig.dimension}, Got: 512`,
      );
    });
  });

  describe('Multi-Dimension Support E2E', () => {
    it('should support groups with different dimensions', async () => {
      // Create group with 1536 dimensions
      const group1536 = await storage.createNewChunkEmbedGroupInfo({
        name: '1536 Dimension Group',
        embeddingConfig: {
          model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
          dimension: 1536,
          batchSize: 20,
          maxRetries: 3,
          timeout: 20000,
          provider: EmbeddingProvider.OPENAI,
        },
        chunkingConfig: {
          strategy: ChunkingStrategy.PARAGRAPH,
          maxChunkSize: 1000,
          overlap: 100,
        },
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create group with 768 dimensions
      const group768 = await storage.createNewChunkEmbedGroupInfo({
        name: '768 Dimension Group',
        embeddingConfig: {
          model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
          dimension: 768,
          batchSize: 20,
          maxRetries: 3,
          timeout: 20000,
          provider: EmbeddingProvider.OPENAI,
        },
        chunkingConfig: {
          strategy: ChunkingStrategy.PARAGRAPH,
          maxChunkSize: 1000,
          overlap: 100,
        },
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert chunks for each group
      const chunk1536: ItemChunk = {
        id: 'chunk-1536',
        itemId: 'item-1536',
        denseVectorIndexGroupId: group1536.id,
        title: '1536 Dim Chunk',
        content: 'Chunk with 1536 dimensions',
        index: 0,
        embedding: new Array(1536).fill(0.1),
        strategyMetadata: {
          chunkingStrategy: 'paragraph',
          chunkingConfig: group1536.chunkingConfig,
          embeddingConfig: group1536.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chunk768: ItemChunk = {
        id: 'chunk-768',
        itemId: 'item-768',
        denseVectorIndexGroupId: group768.id,
        title: '768 Dim Chunk',
        content: 'Chunk with 768 dimensions',
        index: 0,
        embedding: new Array(768).fill(0.2),
        strategyMetadata: {
          chunkingStrategy: 'paragraph',
          chunkingConfig: group768.chunkingConfig,
          embeddingConfig: group768.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Both should succeed
      await expect(storage.insertItemChunk(group1536, chunk1536)).resolves.toBe(
        true,
      );
      await expect(storage.insertItemChunk(group768, chunk768)).resolves.toBe(
        true,
      );

      // Verify both groups have completed status
      const status1536 = await storage.getStatus(group1536.id);
      const status768 = await storage.getStatus(group768.id);

      expect(status1536).toBe(ItemVectorStorageStatus.COMPLETED);
      expect(status768).toBe(ItemVectorStorageStatus.COMPLETED);
    });
  });

  describe('Error Handling E2E', () => {
    it('should handle non-existent group operations gracefully', async () => {
      // Test getting non-existent group
      await expect(
        storage.getChunkEmbedGroupInfoById('non-existent'),
      ).rejects.toThrow();

      // Test getting status for non-existent group
      const status = await storage.getStatus('non-existent');
      expect(status).toBe(ItemVectorStorageStatus.FAILED);

      // Test deleting non-existent group
      const deleteResult =
        await storage.deleteChunkEmbedGroupById('non-existent');
      expect(deleteResult.deletedGroupId).toBe('non-existent');
      expect(deleteResult.deletedChunkNum).toBe(0);
    });
  });
});
