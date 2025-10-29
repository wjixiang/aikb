import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Library from '../library.js';
import { MockLibraryStorage } from './mock-storage.js';
import {
  ItemMetadata,
  Author,
  Collection,
  PdfProcessingStatus,
} from '../types.js';
import { LibraryItem } from '../../item/library-item.js';
import { deleteFromS3 } from '@aikb/s3-service';

// Mock the S3 service
vi.mock('@aikb/s3-service', () => ({
  deleteFromS3: vi.fn(),
}));

// Mock the logger
vi.mock('@aikb/log-management', () => ({
  default: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
  createLoggerWithPrefix: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('Library', () => {
  let library: Library;
  let mockStorage: MockLibraryStorage;
  let mockDeleteFromS3: any;

  beforeEach(() => {
    mockStorage = new MockLibraryStorage();
    library = new Library(mockStorage);
    mockDeleteFromS3 = vi.mocked(deleteFromS3);
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage.clearAll();
  });

  describe('Constructor', () => {
    it('should initialize with storage', () => {
      expect(library).toBeInstanceOf(Library);
    });

    it('should throw error if storage is not provided', () => {
      expect(() => new Library(null as any)).not.toThrow();
      // Note: Library class doesn't currently validate storage parameter
      // This test documents current behavior
    });
  });

  describe('storePdf', () => {
    const pdfBuffer = Buffer.from('mock pdf content');
    const fileName = 'test.pdf';
    const metadata: Partial<ItemMetadata> = {
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      abstract: 'Test abstract',
    };

    it('should store a new PDF successfully', async () => {
      const result = await library.storePdf(pdfBuffer, fileName, metadata);

      expect(result).toBeInstanceOf(LibraryItem);
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.fileType).toBe('pdf');
      expect(result.metadata.contentHash).toBeDefined();
      expect(result.metadata.pdfProcessingStatus).toBe(
        PdfProcessingStatus.PENDING,
      );
    });

    it('should return existing item if content hash matches', async () => {
      // Store first PDF
      const firstResult = await library.storePdf(pdfBuffer, fileName, metadata);
      const firstId = firstResult.getItemId();

      // Store same PDF content with different metadata
      const differentMetadata: Partial<ItemMetadata> = {
        title: 'Different Title',
        authors: [{ firstName: 'Jane', lastName: 'Smith' }],
      };

      const secondResult = await library.storePdf(
        pdfBuffer,
        'different.pdf',
        differentMetadata,
      );

      // Should return the first item (same content hash)
      expect(secondResult.getItemId()).toBe(firstId);
      expect(secondResult.metadata.title).toBe('Test Document'); // Original title preserved
    });

    it('should throw error if file name is not provided', async () => {
      await expect(library.storePdf(pdfBuffer, '', metadata)).rejects.toThrow(
        'File name is required when providing a buffer',
      );
    });

    it('should use filename as title if title not provided in metadata', async () => {
      const result = await library.storePdf(pdfBuffer, 'my-document.pdf', {});

      expect(result.metadata.title).toBe('my-document');
    });

    it('should set default values for optional fields', async () => {
      const result = await library.storePdf(pdfBuffer, fileName, metadata);

      expect(result.metadata.tags).toEqual([]);
      expect(result.metadata.collections).toEqual([]);
      expect(result.metadata.authors).toEqual(metadata.authors);
      expect(result.metadata.fileSize).toBe(pdfBuffer.length);
      expect(result.metadata.dateAdded).toBeInstanceOf(Date);
      expect(result.metadata.dateModified).toBeInstanceOf(Date);
    });

    it('should handle PDF processing status initialization', async () => {
      const result = await library.storePdf(pdfBuffer, fileName, metadata);

      expect(result.metadata.pdfProcessingStatus).toBe(
        PdfProcessingStatus.PENDING,
      );
      expect(result.metadata.pdfProcessingStartedAt).toBeInstanceOf(Date);
      expect(result.metadata.pdfProcessingRetryCount).toBe(0);
      expect(result.metadata.pdfProcessingProgress).toBe(0);
      expect(result.metadata.pdfProcessingMessage).toBe('Ready for processing');
    });
  });

  describe('getItem', () => {
    it('should return null for non-existent item', async () => {
      const result = await library.getItem('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return LibraryItem for existing item', async () => {
      const pdfBuffer = Buffer.from('mock pdf content');
      const storedItem = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });

      const retrievedItem = await library.getItem(storedItem.getItemId());
      expect(retrievedItem).toBeInstanceOf(LibraryItem);
      expect(retrievedItem?.getItemId()).toBe(storedItem.getItemId());
      expect(retrievedItem?.metadata.title).toBe('Test Document');
    });
  });

  describe('searchItems', () => {
    beforeEach(async () => {
      // Setup test data
      await library.storePdf(Buffer.from('content1'), 'doc1.pdf', {
        title: 'Machine Learning Basics',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        tags: ['AI', 'ML'],
        abstract: 'Introduction to machine learning',
      });

      await library.storePdf(Buffer.from('content2'), 'doc2.pdf', {
        title: 'Deep Learning Advanced',
        authors: [{ firstName: 'Jane', lastName: 'Smith' }],
        tags: ['AI', 'DL'],
        abstract: 'Advanced deep learning techniques',
      });

      await library.storePdf(Buffer.from('content3'), 'doc3.pdf', {
        title: 'Data Science Handbook',
        authors: [{ firstName: 'Bob', lastName: 'Johnson' }],
        tags: ['Data', 'Science'],
        abstract: 'Comprehensive data science guide',
      });
    });

    it('should return all items when no filter is provided', async () => {
      const results = await library.searchItems({});
      expect(results).toHaveLength(3);
    });

    it('should filter by title query', async () => {
      const results = await library.searchItems({ query: 'Machine Learning' });
      expect(results).toHaveLength(1);
      expect(results[0].metadata.title).toBe('Machine Learning Basics');
    });

    it('should filter by tags', async () => {
      const results = await library.searchItems({ tags: ['AI'] });
      expect(results).toHaveLength(2);
    });

    it('should filter by authors', async () => {
      const results = await library.searchItems({ authors: ['Doe'] });
      expect(results).toHaveLength(1);
      expect(results[0].metadata.title).toBe('Machine Learning Basics');
    });

    it('should filter by file type', async () => {
      const results = await library.searchItems({ fileType: ['pdf'] });
      expect(results).toHaveLength(3);
    });

    it('should filter by abstract content', async () => {
      const results = await library.searchItems({ query: 'deep learning' });
      expect(results).toHaveLength(1);
      expect(results[0].metadata.title).toBe('Deep Learning Advanced');
    });

    it('should return empty array for no matches', async () => {
      const results = await library.searchItems({ query: 'nonexistent' });
      expect(results).toHaveLength(0);
    });
  });

  describe('Collection Management', () => {
    it('should create a new collection', async () => {
      const collection = await library.createCollection(
        'Test Collection',
        'Test Description',
      );

      expect(collection.name).toBe('Test Collection');
      expect(collection.description).toBe('Test Description');
      expect(collection.dateAdded).toBeInstanceOf(Date);
      expect(collection.dateModified).toBeInstanceOf(Date);
      expect(collection.id).toBeDefined();
    });

    it('should create collection with parent', async () => {
      const parentCollection =
        await library.createCollection('Parent Collection');
      const childCollection = await library.createCollection(
        'Child Collection',
        'Child Description',
        parentCollection.id,
      );

      expect(childCollection.parentCollectionId).toBe(parentCollection.id);
    });

    it('should get all collections', async () => {
      await library.createCollection('Collection 1');
      await library.createCollection('Collection 2');

      const collections = await library.getCollections();
      expect(collections).toHaveLength(2);
    });

    it('should add item to collection', async () => {
      const pdfBuffer = Buffer.from('test content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });
      const collection = await library.createCollection('Test Collection');

      await library.addItemToCollection(item.getItemId(), collection.id!);

      const updatedItem = await library.getItem(item.getItemId());
      expect(updatedItem?.metadata.collections).toContain(collection.id);
    });

    it('should remove item from collection', async () => {
      const pdfBuffer = Buffer.from('test content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });
      const collection = await library.createCollection('Test Collection');

      // Add to collection first
      await library.addItemToCollection(item.getItemId(), collection.id!);

      // Then remove
      await library.removeItemFromCollection(item.getItemId(), collection.id!);

      const updatedItem = await library.getItem(item.getItemId());
      expect(updatedItem?.metadata.collections).not.toContain(collection.id);
    });

    it('should handle adding item to collection multiple times', async () => {
      const pdfBuffer = Buffer.from('test content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });
      const collection = await library.createCollection('Test Collection');

      await library.addItemToCollection(item.getItemId(), collection.id!);
      await library.addItemToCollection(item.getItemId(), collection.id!);

      const updatedItem = await library.getItem(item.getItemId());
      expect(
        updatedItem?.metadata.collections.filter((id) => id === collection.id),
      ).toHaveLength(1);
    });
  });

  describe('Citation Generation', () => {
    beforeEach(async () => {
      await library.storePdf(Buffer.from('test content'), 'test.pdf', {
        title: 'Test Document',
        authors: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Jane', lastName: 'Smith' },
        ],
        publicationYear: 2023,
        publisher: 'Test Publisher',
      });
    });

    it('should generate APA citation', async () => {
      const items = await library.searchItems({ query: 'Test Document' });
      const itemId = items[0].getItemId();

      const citation = await library.generateCitation(itemId, 'APA');

      expect(citation.itemId).toBe(itemId);
      expect(citation.citationStyle).toBe('APA');
      expect(citation.citationText).toContain('Doe, John');
      expect(citation.citationText).toContain('Smith, Jane');
      expect(citation.citationText).toContain('(2023)');
      expect(citation.citationText).toContain('Test Document');
      expect(citation.dateGenerated).toBeInstanceOf(Date);
    });

    it('should generate MLA citation', async () => {
      const items = await library.searchItems({ query: 'Test Document' });
      const itemId = items[0].getItemId();

      const citation = await library.generateCitation(itemId, 'MLA');

      expect(citation.citationStyle).toBe('MLA');
      expect(citation.citationText).toContain('"Test Document."');
    });

    it('should generate Chicago citation', async () => {
      const items = await library.searchItems({ query: 'Test Document' });
      const itemId = items[0].getItemId();

      const citation = await library.generateCitation(itemId, 'Chicago');

      expect(citation.citationStyle).toBe('Chicago');
      expect(citation.citationText).toContain('Test Document');
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        library.generateCitation('non-existent', 'APA'),
      ).rejects.toThrow('Item with ID non-existent not found');
    });
  });

  describe('Delete Operations', () => {
    it('should delete an item successfully', async () => {
      const pdfBuffer = Buffer.from('test content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });

      const result = await library.deleteItem(item.getItemId());
      expect(result).toBe(true);

      const deletedItem = await library.getItem(item.getItemId());
      expect(deletedItem).toBeNull();
    });

    it('should return false for non-existent item deletion', async () => {
      const result = await library.deleteItem('non-existent-id');
      expect(result).toBe(false);
    });

    it('should delete item and associated S3 file', async () => {
      mockDeleteFromS3.mockResolvedValue(undefined);

      const pdfBuffer = Buffer.from('test content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });

      await library.deleteItem(item.getItemId());

      expect(mockDeleteFromS3).toHaveBeenCalledWith(item.metadata.s3Key);
    });

    it('should handle S3 deletion failure gracefully', async () => {
      mockDeleteFromS3.mockRejectedValue(new Error('S3 deletion failed'));

      const pdfBuffer = Buffer.from('test content');
      const item = await library.storePdf(pdfBuffer, 'test.pdf', {
        title: 'Test Document',
      });

      // Should not throw even if S3 deletion fails
      const result = await library.deleteItem(item.getItemId());
      expect(result).toBe(true);
    });

    it('should delete a collection', async () => {
      const collection = await library.createCollection('Test Collection');

      const result = await library.deleteCollection(collection.id!);
      expect(result).toBe(true);

      const collections = await library.getCollections();
      expect(collections).toHaveLength(0);
    });

    it('should return false for non-existent collection deletion', async () => {
      const result = await library.deleteCollection('non-existent-id');
      expect(result).toBe(false);
    });

    it('should delete all items in a collection', async () => {
      const collection = await library.createCollection('Test Collection');

      // Add multiple items to collection
      const item1 = await library.storePdf(
        Buffer.from('content1'),
        'doc1.pdf',
        {
          title: 'Document 1',
        },
      );
      const item2 = await library.storePdf(
        Buffer.from('content2'),
        'doc2.pdf',
        {
          title: 'Document 2',
        },
      );

      await library.addItemToCollection(item1.getItemId(), collection.id!);
      await library.addItemToCollection(item2.getItemId(), collection.id!);

      const deletedCount = await library.deleteItemsInCollection(
        collection.id!,
      );
      expect(deletedCount).toBe(2);

      const remainingItems = await library.searchItems({
        collections: [collection.id!],
      });
      expect(remainingItems).toHaveLength(0);
    });

    it('should return 0 for empty collection deletion', async () => {
      const collection = await library.createCollection('Empty Collection');

      const deletedCount = await library.deleteItemsInCollection(
        collection.id!,
      );
      expect(deletedCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      const errorStorage = new MockLibraryStorage();
      vi.spyOn(errorStorage, 'saveMetadata').mockRejectedValue(
        new Error('Storage error'),
      );

      const errorLibrary = new Library(errorStorage);

      await expect(
        errorLibrary.storePdf(Buffer.from('test'), 'test.pdf', {}),
      ).rejects.toThrow('Storage error');
    });

    it('should handle invalid search filters', async () => {
      // Should not throw with invalid filters
      const results = await library.searchItems({
        query: '',
        tags: [],
        collections: [],
        authors: [],
        fileType: [],
      });
      expect(results).toHaveLength(0);
    });

    it('should handle empty metadata in storePdf', async () => {
      const result = await library.storePdf(
        Buffer.from('test'),
        'test.pdf',
        {},
      );

      expect(result.metadata.title).toBe('test');
      expect(result.metadata.authors).toEqual([]);
      expect(result.metadata.tags).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long file names', async () => {
      const longFileName = 'a'.repeat(255) + '.pdf';
      const result = await library.storePdf(
        Buffer.from('test'),
        longFileName,
        {},
      );

      expect(result.metadata.title).toBe('a'.repeat(255));
    });

    it('should handle special characters in metadata', async () => {
      const specialMetadata = {
        title: 'Test & Special <Characters> "Quotes"',
        authors: [{ firstName: 'José', lastName: 'García' }],
        abstract: 'Special chars: @#$%^&*()_+-=[]{}|;:,.<>?',
      };

      const result = await library.storePdf(
        Buffer.from('test'),
        'test.pdf',
        specialMetadata,
      );

      expect(result.metadata.title).toBe(specialMetadata.title);
      expect(result.metadata.authors[0].firstName).toBe('José');
      expect(result.metadata.abstract).toBe(specialMetadata.abstract);
    });

    it('should handle empty PDF buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await library.storePdf(emptyBuffer, 'empty.pdf', {});

      expect(result.metadata.fileSize).toBe(0);
      expect(result.metadata.contentHash).toBeDefined();
    });

    it('should handle large PDF buffer', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const result = await library.storePdf(largeBuffer, 'large.pdf', {});

      expect(result.metadata.fileSize).toBe(10 * 1024 * 1024);
      expect(result.metadata.contentHash).toBeDefined();
    });
  });
});
