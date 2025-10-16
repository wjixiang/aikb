import Library, { LibraryItem, S3MongoLibraryStorage } from '../library';
import { BookMetadata } from '../library';
import { MockLibraryStorage } from '../MockLibraryStorage';
import { deleteFromS3 } from '../../../lib/s3Service/S3Service';
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';

// Mock the S3Service to avoid real S3 operations
vi.mock('/lib/s3Service/S3Service', () => ({
  deleteFromS3: vi.fn().mockResolvedValue(true),
}));

// Mock the MinerU PDF converter to avoid real PDF conversion
vi.mock('/lib/chunking/chunkingTool', () => ({
  chunkTextAdvanced: vi.fn().mockResolvedValue([
    {
      index: 0,
      content: 'Test chunk content',
      title: 'Test chunk',
      metadata: { chunkType: 'text' },
    },
  ]),
  getAvailableStrategies: vi.fn().mockReturnValue(['paragraph']),
}));

// Mock the embedding service
vi.mock('/lib/embedding/embedding', () => ({
  embeddingService: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  },
}));

describe('LibraryItem.selfDelete', () => {
  let library: Library;
  let storage: MockLibraryStorage;
  let testItem: LibraryItem;
  let mockDeleteFromS3: any;

  beforeAll(async () => {
    storage = new MockLibraryStorage();
    library = new Library(storage);
    mockDeleteFromS3 = deleteFromS3 as any;
  });

  afterAll(async () => {
    // Clean up any test data
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Reset mocks before each test
    mockDeleteFromS3.mockClear();

    // Create a test PDF buffer directly without file system operations
    const minimalPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000204 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n299\n%%EOF',
    );

    const metadata: Partial<BookMetadata> = {
      title: 'Test Document for Self Delete',
      authors: [{ firstName: 'Test', lastName: 'Author' }],
      tags: ['test', 'self-delete'],
      abstract:
        'This is a test document for testing the selfDelete functionality',
    };

    testItem = await library.storePdf(
      minimalPdf,
      'test-self-delete.pdf',
      metadata,
    );

    // Manually add markdown content to avoid PDF conversion
    await storage.saveMarkdown(
      testItem.metadata.id!,
      '# Test Document\n\nThis is a test document for self-delete functionality.',
    );

    // Manually add chunks to avoid chunkEmbed process
    await storage.saveChunk({
      id: 'test-chunk-id',
      itemId: testItem.metadata.id!,
      index: 0,
      content: 'Test chunk content',
      title: 'Test chunk',
      metadata: { chunkType: 'text' },
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      createdAt: new Date(),
      updatedAt: new Date(),
      denseVectorIndexGroup: 'test-group',
      version: '1.0.0',
      embeddings: {
        'test-provider': [0.1, 0.2, 0.3, 0.4, 0.5]
      },
      strategyMetadata: {
        chunkingStrategy: 'test-strategy',
        chunkingConfig: {},
        embeddingProvider: 'test-provider',
        embeddingConfig: {},
        processingTimestamp: new Date(),
        processingDuration: 1000
      }
    });
  });

  afterEach(async () => {
    // Clean up after each test if the item wasn't properly deleted
    if (testItem && testItem.metadata.id) {
      try {
        await library.deleteBook(testItem.metadata.id);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  it('should delete all associated data for a LibraryItem', async () => {
    const itemId = testItem.metadata.id!;

    // Verify the item exists before deletion
    const existingItem = await library.getItem(itemId);
    expect(existingItem).toBeTruthy();
    expect(existingItem?.metadata.id).toBe(itemId);

    // Verify chunks exist
    const chunks = await testItem.getChunks();
    expect(chunks.length).toBeGreaterThan(0);

    // Verify markdown exists
    const markdown = await testItem.getMarkdown();
    expect(markdown).toBeTruthy();
    expect(markdown.length).toBeGreaterThan(0);

    // Verify PDF exists
    expect(testItem.hasPdf()).toBe(true);

    // Perform self deletion
    const deleteResult = await testItem.selfDelete();
    expect(deleteResult).toBe(true);

    // Verify the item no longer exists
    const deletedItem = await library.getItem(itemId);
    expect(deletedItem).toBeNull();

    // Verify chunks are deleted
    const deletedChunks = await storage.getChunksByItemId(itemId);
    expect(deletedChunks.length).toBe(0);

    // Verify S3 delete was called
    expect(mockDeleteFromS3).toHaveBeenCalledWith(testItem.metadata.s3Key);
  });

  it('should handle deletion of item without PDF', async () => {
    // Create an item without PDF
    const metadata: BookMetadata = {
      title: 'Test Item without PDF',
      authors: [{ firstName: 'Test', lastName: 'Author' }],
      tags: ['test', 'no-pdf'],
      abstract: 'This is a test item without PDF',
      dateAdded: new Date(),
      dateModified: new Date(),
      fileType: 'other',
      collections: [],
    };

    const savedMetadata = await storage.saveMetadata(metadata);
    const itemWithoutPdf = new LibraryItem(savedMetadata, storage);

    // Add some markdown content manually
    await storage.saveMarkdown(
      itemWithoutPdf.metadata.id!,
      '# Test Markdown\n\nThis is test content',
    );

    // Verify the item exists
    const existingItem = await library.getItem(itemWithoutPdf.metadata.id!);
    expect(existingItem).toBeTruthy();

    // Perform self deletion
    const deleteResult = await itemWithoutPdf.selfDelete();
    expect(deleteResult).toBe(true);

    // Verify the item no longer exists
    const deletedItem = await library.getItem(itemWithoutPdf.metadata.id!);
    expect(deletedItem).toBeNull();

    // Verify S3 delete was not called since there's no PDF
    expect(mockDeleteFromS3).not.toHaveBeenCalled();
  });

  it('should handle deletion of item with PDF splitting info', async () => {
    // Create an item with PDF splitting info
    const itemId = testItem.metadata.id!;

    // Manually add PDF splitting info to test deletion of split parts
    await testItem.updateMetadata({
      pdfSplittingInfo: {
        itemId: itemId,
        originalFileName: 'test-split.pdf',
        totalParts: 2,
        parts: [
          {
            partIndex: 0,
            startPage: 1,
            endPage: 5,
            pageCount: 5,
            s3Key: 'test-split-part-1.pdf',
            status: 'completed',
          },
          {
            partIndex: 1,
            startPage: 6,
            endPage: 10,
            pageCount: 5,
            s3Key: 'test-split-part-2.pdf',
            status: 'completed',
          },
        ],
        processingTime: 1000,
      },
    });

    // Perform self deletion
    const deleteResult = await testItem.selfDelete();
    expect(deleteResult).toBe(true);

    // Verify the item no longer exists
    const deletedItem = await library.getItem(itemId);
    expect(deletedItem).toBeNull();

    // Verify S3 delete was called for the main PDF and split parts
    expect(mockDeleteFromS3).toHaveBeenCalledWith(testItem.metadata.s3Key);
    expect(mockDeleteFromS3).toHaveBeenCalledWith('test-split-part-1.pdf');
    expect(mockDeleteFromS3).toHaveBeenCalledWith('test-split-part-2.pdf');
  });
});
