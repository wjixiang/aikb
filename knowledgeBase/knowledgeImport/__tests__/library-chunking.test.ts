import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Library, { S3ElasticSearchLibraryStorage } from '../liberary';
import { MockLibraryStorage } from '../MockLibraryStorage';
import { BookMetadata, BookChunk, ChunkSearchFilter } from '../liberary';
import { embeddingService } from '../../lib/embedding/embedding';

// Mock the embedding service
vi.mock('../../lib/embedding/embedding', () => ({
  embeddingService: {
    embedBatch: vi.fn(),
  },
}));

describe('Library Chunking and Embedding', () => {
  let library: Library;
  let mockStorage: MockLibraryStorage;

  beforeEach(() => {
    mockStorage = new MockLibraryStorage();
    library = new Library(mockStorage);
    
    // Mock embedding service to return predictable vectors
    vi.mocked(embeddingService.embedBatch).mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      [0.7, 0.8, 0.9],
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('processItemChunks', () => {
    it('should process markdown content into chunks with embeddings', async () => {
      // Create a test item with markdown content
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      // Manually set markdown content for testing
      await mockStorage.saveMarkdown(item.metadata.id!, `# Introduction

This is the introduction paragraph.

# Chapter 1

This is the first chapter content.

# Chapter 2

This is the second chapter content.`);

      // Process chunks
      await library.processItemChunks(item.metadata.id!, 'h1');

      // Verify chunks were created
      const chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(3);

      // Verify chunk content
      expect(chunks[0].title).toBe('Introduction');
      expect(chunks[0].content).toContain('This is the introduction paragraph');
      expect(chunks[0].metadata?.chunkType).toBe('h1');

      expect(chunks[1].title).toBe('Chapter 1');
      expect(chunks[1].content).toContain('This is the first chapter content');

      expect(chunks[2].title).toBe('Chapter 2');
      expect(chunks[2].content).toContain('This is the second chapter content');

      // Verify embeddings were generated
      expect(embeddingService.embedBatch).toHaveBeenCalledWith([
        expect.stringContaining('Introduction'),
        expect.stringContaining('Chapter 1'),
        expect.stringContaining('Chapter 2'),
      ]);

      // Verify chunks have embeddings
      expect(chunks[0].embedding).toEqual([0.1, 0.2, 0.3]);
      expect(chunks[1].embedding).toEqual([0.4, 0.5, 0.6]);
      expect(chunks[2].embedding).toEqual([0.7, 0.8, 0.9]);
    });

    it('should handle paragraph chunking', async () => {
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      // Set markdown content without H1 headers
      await mockStorage.saveMarkdown(item.metadata.id!, 
        `This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three.`);

      // Process chunks with paragraph strategy
      await library.processItemChunks(item.metadata.id!, 'paragraph');

      // Verify chunks were created
      const chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(3);

      // Verify chunk content
      expect(chunks[0].title).toBe('Paragraph 1');
      expect(chunks[0].content).toBe('This is paragraph one.');
      expect(chunks[0].metadata?.chunkType).toBe('paragraph');

      expect(chunks[1].title).toBe('Paragraph 2');
      expect(chunks[1].content).toBe('This is paragraph two.');

      expect(chunks[2].title).toBe('Paragraph 3');
      expect(chunks[2].content).toBe('This is paragraph three.');
    });

    it('should handle items without markdown content', async () => {
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      // Try to process chunks without markdown content
      await library.processItemChunks(item.metadata.id!, 'h1');

      // Should not create any chunks
      const chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(0);
    });

    it('should replace existing chunks when re-processing', async () => {
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      // Set initial markdown content
      await mockStorage.saveMarkdown(item.metadata.id!, `# Chapter 1\nContent 1`);

      // Process initial chunks
      await library.processItemChunks(item.metadata.id!, 'h1');
      let chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].title).toBe('Chapter 1');

      // Update markdown content
      await mockStorage.saveMarkdown(item.metadata.id!, 
        `# Chapter 1\nUpdated content 1\n\n# Chapter 2\nNew content 2`);

      // Re-process chunks
      await library.processItemChunks(item.metadata.id!, 'h1');

      // Verify chunks were replaced
      chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].title).toBe('Chapter 1');
      expect(chunks[0].content).toContain('Updated content 1');
      expect(chunks[1].title).toBe('Chapter 2');
      expect(chunks[1].content).toContain('New content 2');
    });
  });

  describe('searchChunks', () => {
    beforeEach(async () => {
      // Set up test data
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      await mockStorage.saveMarkdown(item.metadata.id!, 
        `# Introduction\nThis is about machine learning.\n\n# Methods\nWe use neural networks.`);

      await library.processItemChunks(item.metadata.id!, 'h1');
    });

    it('should search chunks by query', async () => {
      const filter: ChunkSearchFilter = {
        query: 'machine learning',
      };

      const results = await library.searchChunks(filter);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Introduction');
      expect(results[0].content).toContain('machine learning');
    });

    it('should search chunks by item ID', async () => {
      // Get the first item
      const items = await library.searchItems({});
      const itemId = items[0].metadata.id!;

      const filter: ChunkSearchFilter = {
        itemId,
      };

      const results = await library.searchChunks(filter);
      expect(results).toHaveLength(2); // Introduction and Methods
    });

    it('should search chunks by chunk type', async () => {
      const filter: ChunkSearchFilter = {
        chunkType: 'h1',
      };

      const results = await library.searchChunks(filter);
      expect(results).toHaveLength(2); // All chunks are H1 type
    });

    it('should limit search results', async () => {
      const filter: ChunkSearchFilter = {
        limit: 1,
      };

      const results = await library.searchChunks(filter);
      expect(results).toHaveLength(1);
    });
  });

  describe('findSimilarChunks', () => {
    beforeEach(async () => {
      // Set up test data
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      await mockStorage.saveMarkdown(item.metadata.id!, 
        `# Introduction\nThis is about machine learning.\n\n# Methods\nWe use neural networks.`);

      await library.processItemChunks(item.metadata.id!, 'h1');
    });

    it('should find similar chunks based on query vector', async () => {
      const queryVector = [0.1, 0.2, 0.3]; // Similar to first chunk's embedding

      const results = await library.findSimilarChunks(queryVector, 2, 0.5);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0]).toHaveProperty('content');
    });

    it('should filter by item IDs', async () => {
      const items = await library.searchItems({});
      const itemId = items[0].metadata.id!;

      const queryVector = [0.1, 0.2, 0.3];
      const results = await library.findSimilarChunks(queryVector, 10, 0.5, [itemId]);
      
      // All results should be from the specified item
      results.forEach(result => {
        expect(result.itemId).toBe(itemId);
      });
    });

    it('should respect similarity threshold', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      
      // High threshold should return fewer results
      const highThresholdResults = await library.findSimilarChunks(queryVector, 10, 0.9);
      
      // Low threshold should return more results
      const lowThresholdResults = await library.findSimilarChunks(queryVector, 10, 0.1);
      
      expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length);
    });
  });

  describe('reProcessChunks', () => {
    it('should re-process chunks for a specific item', async () => {
      const metadata: Partial<BookMetadata> = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        fileType: 'pdf',
      };

      const pdfBuffer = Buffer.from('mock pdf content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', metadata);

      await mockStorage.saveMarkdown(item.metadata.id!, `# Chapter 1\nOriginal content`);

      // Process initial chunks
      await library.processItemChunks(item.metadata.id!, 'h1');
      let chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Original content');

      // Update markdown content
      await mockStorage.saveMarkdown(item.metadata.id!, `# Chapter 1\nUpdated content\n\n# Chapter 2\nNew chapter`);

      // Re-process chunks
      await library.reProcessChunks(item.metadata.id!, 'h1');

      // Verify chunks were updated
      chunks = await library.getItemChunks(item.metadata.id!);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toContain('Updated content');
      expect(chunks[1].title).toBe('Chapter 2');
    });
  });
});