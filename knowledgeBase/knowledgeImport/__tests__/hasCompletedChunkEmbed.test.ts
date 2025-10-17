import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryItem, BookMetadata, BookChunk } from '../library';
import { MockLibraryStorage } from '../MockLibraryStorage';
import { EmbeddingProvider, OpenAIModel } from '../../../lib/embedding/embedding';

describe('LibraryItem.hasCompletedChunkEmbed', () => {
  let mockStorage: MockLibraryStorage;
  let libraryItem: LibraryItem;
  let metadata: BookMetadata;

  beforeEach(() => {
    mockStorage = new MockLibraryStorage();
    metadata = {
      id: 'test-item-id',
      title: 'Test Book',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: [],
      collections: [],
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'pdf',
    };
    libraryItem = new LibraryItem(metadata, mockStorage);
  });

  it('should return false when no chunks exist', async () => {
    // Mock empty chunks array
    vi.spyOn(mockStorage, 'getChunksByItemId').mockResolvedValue([]);

    const result = await libraryItem.hasCompletedChunkEmbed();
    expect(result).toBe(false);
  });

  it('should return false when chunks exist but have no embeddings', async () => {
    // Mock chunks without embeddings
    const chunksWithoutEmbeddings: BookChunk[] = [
      {
        id: 'chunk-1',
        itemId: 'test-item-id',
        title: 'Chunk 1',
        content: 'Content 1',
        index: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        denseVectorIndexGroupId: 'test-group',
        embedding: [],
        strategyMetadata: {
          chunkingStrategy: 'test-strategy',
          chunkingConfig: {},
          embeddingConfig: {
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
            dimension: 1536,
            batchSize: 100,
            maxRetries: 3,
            timeout: 30000,
            provider: EmbeddingProvider.OPENAI,
          },
          processingTimestamp: new Date(),
          processingDuration: 1000
        }
      },
      {
        id: 'chunk-2',
        itemId: 'test-item-id',
        title: 'Chunk 2',
        content: 'Content 2',
        index: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        denseVectorIndexGroupId: 'test-group',
        embedding: [],
        strategyMetadata: {
          chunkingStrategy: 'test-strategy',
          chunkingConfig: {},
          embeddingConfig: {
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
            dimension: 1536,
            batchSize: 100,
            maxRetries: 3,
            timeout: 30000,
            provider: EmbeddingProvider.OPENAI,
          },
          processingTimestamp: new Date(),
          processingDuration: 1000
        }
      },
    ];

    vi.spyOn(mockStorage, 'getChunksByItemId').mockResolvedValue(
      chunksWithoutEmbeddings,
    );

    const result = await libraryItem.hasCompletedChunkEmbed();
    expect(result).toBe(false);
  });

  it('should return false when some chunks have embeddings but not all', async () => {
    // Mock chunks with mixed embedding status
    const chunksWithMixedEmbeddings: BookChunk[] = [
      {
        id: 'chunk-1',
        itemId: 'test-item-id',
        title: 'Chunk 1',
        content: 'Content 1',
        index: 0,
        embedding: [0.1, 0.2, 0.3], // Has embedding
        createdAt: new Date(),
        updatedAt: new Date(),
        denseVectorIndexGroupId: 'test-group',
        strategyMetadata: {
          chunkingStrategy: 'test-strategy',
          chunkingConfig: {},
          embeddingConfig: {
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
            dimension: 1536,
            batchSize: 100,
            maxRetries: 3,
            timeout: 30000,
            provider: EmbeddingProvider.OPENAI,
          },
          processingTimestamp: new Date(),
          processingDuration: 1000
        }
      },
      {
        id: 'chunk-2',
        itemId: 'test-item-id',
        title: 'Chunk 2',
        content: 'Content 2',
        index: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        denseVectorIndexGroupId: 'test-group',
        
        embedding: [],
        strategyMetadata: {
          chunkingStrategy: 'test-strategy',
          chunkingConfig: {},
          embeddingConfig: {
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
            dimension: 1536,
            batchSize: 100,
            maxRetries: 3,
            timeout: 30000,
            provider: EmbeddingProvider.OPENAI,
          },
          processingTimestamp: new Date(),
          processingDuration: 1000
        }
        // No embedding
      },
    ];

    vi.spyOn(mockStorage, 'getChunksByItemId').mockResolvedValue(
      chunksWithMixedEmbeddings,
    );

    const result = await libraryItem.hasCompletedChunkEmbed();
    expect(result).toBe(false);
  });

  it('should return true when all chunks have embeddings', async () => {
    // Mock chunks with all embeddings
    const chunksWithEmbeddings: BookChunk[] = [
      {
        id: 'chunk-1',
        itemId: 'test-item-id',
        title: 'Chunk 1',
        content: 'Content 1',
        index: 0,
        embedding: [0.1, 0.2, 0.3],
        createdAt: new Date(),
        updatedAt: new Date(),
        denseVectorIndexGroupId: 'test-group',
        strategyMetadata: {
          chunkingStrategy: 'test-strategy',
          chunkingConfig: {},
          embeddingConfig: {
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
            dimension: 1536,
            batchSize: 100,
            maxRetries: 3,
            timeout: 30000,
            provider: EmbeddingProvider.OPENAI,
          },
          processingTimestamp: new Date(),
          processingDuration: 1000
        }
      },
      {
        id: 'chunk-2',
        itemId: 'test-item-id',
        title: 'Chunk 2',
        content: 'Content 2',
        index: 1,
        embedding: [0.4, 0.5, 0.6],
        createdAt: new Date(),
        updatedAt: new Date(),
        denseVectorIndexGroupId: 'test-group',
        strategyMetadata: {
          chunkingStrategy: 'test-strategy',
          chunkingConfig: {},
          embeddingConfig: {
            model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
            dimension: 1536,
            batchSize: 100,
            maxRetries: 3,
            timeout: 30000,
            provider: EmbeddingProvider.OPENAI,
          },
          processingTimestamp: new Date(),
          processingDuration: 1000
        }
      },
    ];

    vi.spyOn(mockStorage, 'getChunksByItemId').mockResolvedValue(
      chunksWithEmbeddings,
    );

    const result = await libraryItem.hasCompletedChunkEmbed();
    expect(result).toBe(true);
  });

  it('should return false when an error occurs', async () => {
    // Mock an error
    vi.spyOn(mockStorage, 'getChunksByItemId').mockRejectedValue(
      new Error('Storage error'),
    );

    const result = await libraryItem.hasCompletedChunkEmbed();
    expect(result).toBe(false);
  });
});
