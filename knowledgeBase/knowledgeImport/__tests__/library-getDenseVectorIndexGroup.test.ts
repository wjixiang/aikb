import { LibraryItem, BookChunk } from '../library';
import { AbstractLibraryStorage } from '../library';
import { BookMetadata } from '../library';
import { ObjectId } from 'mongodb';

// Mock storage implementation for testing
class MockStorage implements AbstractLibraryStorage {
  private chunks: BookChunk[] = [];
  private metadata: Record<string, BookMetadata> = {};

  constructor() {
  }

  // Mock implementation for required abstract methods
  async getChunksByItemId(itemId: string): Promise<BookChunk[]> {
    return this.chunks.filter(chunk => chunk.itemId === itemId);
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    return this.metadata[id] || null;
  }

  // Add test data
  addTestChunks(chunks: BookChunk[]) {
    this.chunks.push(...chunks);
  }

  addTestMetadata(id: string, metadata: BookMetadata) {
    this.metadata[id] = metadata;
  }

  // Other required methods with basic implementations
  async uploadPdf(pdfData: Buffer, fileName: string): Promise<any> { throw new Error('Not implemented'); }
  async uploadPdfFromPath(pdfPath: string): Promise<any> { throw new Error('Not implemented'); }
  async getPdfDownloadUrl(s3Key: string): Promise<string> { throw new Error('Not implemented'); }
  async getPdf(s3Key: string): Promise<Buffer> { throw new Error('Not implemented'); }
  async saveMetadata(metadata: BookMetadata): Promise<BookMetadata & { id: string }> {
    this.metadata[metadata.id!] = { ...metadata, id: metadata.id! };
    return { ...metadata, id: metadata.id! };
  }
  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> { throw new Error('Not implemented'); }
  async updateMetadata(metadata: BookMetadata): Promise<void> { throw new Error('Not implemented'); }
  async searchMetadata(filter: any): Promise<BookMetadata[]> { throw new Error('Not implemented'); }
  async saveCollection(collection: any): Promise<any> { throw new Error('Not implemented'); }
  async getCollections(): Promise<any[]> { throw new Error('Not implemented'); }
  async addItemToCollection(itemId: string, collectionId: string): Promise<void> { throw new Error('Not implemented'); }
  async removeItemFromCollection(itemId: string, collectionId: string): Promise<void> { throw new Error('Not implemented'); }
  async saveCitation(citation: any): Promise<any> { throw new Error('Not implemented'); }
  async getCitations(itemId: string): Promise<any[]> { throw new Error('Not implemented'); }
  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> { throw new Error('Not implemented'); }
  async getMarkdown(itemId: string): Promise<string | null> { throw new Error('Not implemented'); }
  async deleteMarkdown(itemId: string): Promise<boolean> { throw new Error('Not implemented'); }
  async deleteMetadata(id: string): Promise<boolean> { throw new Error('Not implemented'); }
  async deleteCollection(id: string): Promise<boolean> { throw new Error('Not implemented'); }
  async deleteCitations(itemId: string): Promise<boolean> { throw new Error('Not implemented'); }
  async saveChunk(chunk: BookChunk): Promise<BookChunk> { throw new Error('Not implemented'); }
  async getChunk(chunkId: string): Promise<BookChunk | null> { throw new Error('Not implemented'); }
  async updateChunk(chunk: BookChunk): Promise<void> { throw new Error('Not implemented'); }
  async deleteChunk(chunkId: string): Promise<boolean> { throw new Error('Not implemented'); }
  async deleteChunksByItemId(itemId: string): Promise<number> { throw new Error('Not implemented'); }
  async searchChunks(filter: any): Promise<BookChunk[]> { throw new Error('Not implemented'); }
  async findSimilarChunks(queryVector: number[], limit?: number, threshold?: number, itemIds?: string[]): Promise<Array<BookChunk & { similarity: number }>> { throw new Error('Not implemented'); }
  async batchSaveChunks(chunks: BookChunk[]): Promise<void> { throw new Error('Not implemented'); }
}

describe('LibraryItem.getDenseVectorIndexGroupId', () => {
  let mockStorage: MockStorage;
  let testItem: LibraryItem;
  let itemId: string;

  beforeEach(() => {
    mockStorage = new MockStorage();
    itemId = new ObjectId().toString();
    
    // Create test metadata
    const metadata: BookMetadata = {
      id: itemId,
      title: 'Test Book',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      tags: [],
      collections: [],
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'book',
    };

    mockStorage.addTestMetadata(itemId, metadata);
    testItem = new LibraryItem(metadata, mockStorage);
  });

  test('should return empty array when no chunks exist', async () => {
    const result = await testItem.getDenseVectorIndexGroupId();
    expect(result).toEqual([]);
  });

  test('should return single denseVectorIndexGroup when all chunks have the same group', async () => {
    const chunks: BookChunk[] = [
      {
        id: 'chunk1',
        itemId: itemId,
        denseVectorIndexGroupId: 'group1',
        title: 'Chapter 1',
        content: 'Content of chapter 1',
        index: 0,
        embedding: [0.1, 0.2, 0.3],
        strategyMetadata: {
          chunkingStrategy: 'h1',
          chunkingConfig: {},
          embeddingProvider: 'openai',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'chunk2',
        itemId: itemId,
        denseVectorIndexGroupId: 'group1',
        title: 'Chapter 2',
        content: 'Content of chapter 2',
        index: 1,
        embedding: [0.4, 0.5, 0.6],
        strategyMetadata: {
          chunkingStrategy: 'h1',
          chunkingConfig: {},
          embeddingProvider: 'openai',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockStorage.addTestChunks(chunks);

    const result = await testItem.getDenseVectorIndexGroupId();
    expect(result).toEqual(['group1']);
  });

  test('should return multiple denseVectorIndexGroups when chunks have different groups', async () => {
    const chunks: BookChunk[] = [
      {
        id: 'chunk1',
        itemId: itemId,
        denseVectorIndexGroupId: 'group1',
        title: 'Chapter 1',
        content: 'Content of chapter 1',
        index: 0,
        embedding: [0.1, 0.2, 0.3],
        strategyMetadata: {
          chunkingStrategy: 'h1',
          chunkingConfig: {},
          embeddingProvider: 'openai',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'chunk2',
        itemId: itemId,
        denseVectorIndexGroupId: 'group2',
        title: 'Chapter 2',
        content: 'Content of chapter 2',
        index: 1,
        embedding: [0.4, 0.5, 0.6],
        strategyMetadata: {
          chunkingStrategy: 'paragraph',
          chunkingConfig: {},
          embeddingProvider: 'alibaba',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'chunk3',
        itemId: itemId,
        denseVectorIndexGroupId: 'group1',
        title: 'Chapter 3',
        content: 'Content of chapter 3',
        index: 2,
        embedding: [0.7, 0.8, 0.9],
        strategyMetadata: {
          chunkingStrategy: 'h1',
          chunkingConfig: {},
          embeddingProvider: 'openai',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockStorage.addTestChunks(chunks);

    const result = await testItem.getDenseVectorIndexGroupId();
    expect(result).toEqual(['group1', 'group2']);
  });

  test('should filter out empty or null denseVectorIndexGroup values', async () => {
    const chunks: BookChunk[] = [
      {
        id: 'chunk1',
        itemId: itemId,
        denseVectorIndexGroupId: 'group1',
        title: 'Chapter 1',
        content: 'Content of chapter 1',
        index: 0,
        embedding: [0.1, 0.2, 0.3],
        strategyMetadata: {
          chunkingStrategy: 'h1',
          chunkingConfig: {},
          embeddingProvider: 'openai',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'chunk2',
        itemId: itemId,
        denseVectorIndexGroupId: '',
        title: 'Chapter 2',
        content: 'Content of chapter 2',
        index: 1,
        embedding: [0.4, 0.5, 0.6],
        strategyMetadata: {
          chunkingStrategy: 'paragraph',
          chunkingConfig: {},
          embeddingProvider: 'alibaba',
          embeddingConfig: {},
          processingTimestamp: new Date(),
          processingDuration: 100,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockStorage.addTestChunks(chunks);

    const result = await testItem.getDenseVectorIndexGroupId();
    expect(result).toEqual(['group1']);
  });
});