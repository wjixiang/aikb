import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaItemStorage } from '../prisma-item-storage.js';
import { ItemMetadata, ItemArchive, Author } from '../../library/types.js';

// Mock the Prisma Client
const mockPrisma = {
  items: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  item_authors: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  authors: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  item_collections: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  item_archives: {
    create: vi.fn(),
  },
  citations: {
    deleteMany: vi.fn(),
  },
  markdowns: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
};

// Mock the logger
vi.mock('log-management', () => ({
  createLoggerWithPrefix: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('PrismaItemStorage', () => {
  let storage: PrismaItemStorage;
  let testMetadata: ItemMetadata;
  let testArchive: ItemArchive;

  beforeEach(() => {
    storage = new PrismaItemStorage(mockPrisma as any);
    vi.clearAllMocks();

    testMetadata = {
      id: 'test-item-id',
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      abstract: 'Test abstract',
      publicationYear: 2023,
      publisher: 'Test Publisher',
      tags: ['test'],
      notes: 'Test notes',
      collections: ['collection-1'],
      dateAdded: new Date('2023-01-01'),
      dateModified: new Date('2023-01-02'),
      language: 'en',
      markdownContent: '# Test Markdown',
      markdownUpdatedDate: new Date('2023-01-03'),
      archives: [],
    };

    testArchive = {
      fileType: 'pdf',
      fileSize: 1024,
      fileHash: 'test-hash-123',
      addDate: new Date('2023-01-01'),
      s3Key: 'test-s3-key',
      pageCount: 10,
      wordCount: 5000,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPdfDownloadUrl', () => {
    it('should return a download URL', async () => {
      const url = await storage.getPdfDownloadUrl('test-s3-key');
      expect(url).toBe('https://s3.amazonaws.com/bucket/test-s3-key');
    });
  });

  describe('getPdf', () => {
    it('should throw an error for PDF retrieval', async () => {
      await expect(storage.getPdf('test-s3-key')).rejects.toThrow(
        'PDF retrieval not implemented in PrismaItemStorage',
      );
    });
  });

  describe('getMetadata', () => {
    it('should return null when item is not found', async () => {
      mockPrisma.items.findUnique.mockResolvedValue(null);
      const result = await storage.getMetadata('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return mapped metadata when item is found', async () => {
      const mockItem = {
        id: 'test-id',
        title: 'Test Title',
        abstract: 'Test Abstract',
        publication_year: 2023,
        publisher: 'Test Publisher',
        isbn: '1234567890',
        doi: '10.1000/182',
        url: 'https://example.com',
        tags: ['tag1', 'tag2'],
        notes: 'Test notes',
        date_added: new Date('2023-01-01'),
        date_modified: new Date('2023-01-02'),
        language: 'en',
        markdown_content: '# Test Markdown',
        markdown_updated_date: new Date('2023-01-03'),
        item_authors: [
          {
            authors: {
              first_name: 'John',
              last_name: 'Doe',
              middle_name: 'Middle',
            },
          },
        ],
        item_collections: [
          {
            collection_id: 'collection-1',
          },
        ],
        item_archives: [
          {
            file_type: 'pdf',
            file_size: 1024,
            file_hash: 'test-hash',
            add_date: new Date('2023-01-01'),
            s3_key: 'test-s3-key',
            page_count: 10,
            word_count: 5000,
          },
        ],
      };

      mockPrisma.items.findUnique.mockResolvedValue(mockItem);
      const result = await storage.getMetadata('test-id');

      expect(result).toEqual({
        id: 'test-id',
        title: 'Test Title',
        abstract: 'Test Abstract',
        publicationYear: 2023,
        publisher: 'Test Publisher',
        isbn: '1234567890',
        doi: '10.1000/182',
        url: 'https://example.com',
        tags: ['tag1', 'tag2'],
        notes: 'Test notes',
        dateAdded: new Date('2023-01-01'),
        dateModified: new Date('2023-01-02'),
        language: 'en',
        markdownContent: '# Test Markdown',
        markdownUpdatedDate: new Date('2023-01-03'),
        authors: [
          {
            firstName: 'John',
            lastName: 'Doe',
            middleName: 'Middle',
          },
        ],
        collections: ['collection-1'],
        archives: [
          {
            fileType: 'pdf',
            fileSize: 1024,
            fileHash: 'test-hash',
            addDate: new Date('2023-01-01'),
            s3Key: 'test-s3-key',
            pageCount: 10,
            wordCount: 5000,
          },
        ],
      });
    });
  });

  describe('updateMetadata', () => {
    it('should throw error when ID is missing', async () => {
      const metadataWithoutId = { ...testMetadata, id: undefined };
      await expect(storage.updateMetadata(metadataWithoutId)).rejects.toThrow(
        'Item ID is required for update',
      );
    });

    it('should update item metadata', async () => {
      mockPrisma.items.update.mockResolvedValue({});
      mockPrisma.item_authors.deleteMany.mockResolvedValue({});
      mockPrisma.authors.findFirst.mockResolvedValue(null);
      mockPrisma.authors.create.mockResolvedValue({ id: 'author-id' });
      mockPrisma.item_authors.create.mockResolvedValue({});
      mockPrisma.item_collections.deleteMany.mockResolvedValue({});
      mockPrisma.item_collections.create.mockResolvedValue({});

      await storage.updateMetadata(testMetadata);

      expect(mockPrisma.items.update).toHaveBeenCalledWith({
        where: { id: 'test-item-id' },
        data: {
          title: 'Test Document',
          abstract: 'Test abstract',
          publication_year: 2023,
          publisher: 'Test Publisher',
          isbn: undefined,
          doi: undefined,
          url: undefined,
          tags: ['test'],
          notes: 'Test notes',
          date_modified: testMetadata.dateModified,
          language: 'en',
          markdown_content: '# Test Markdown',
          markdown_updated_date: testMetadata.markdownUpdatedDate,
        },
      });
    });
  });

  describe('addArchiveToMetadata', () => {
    it('should create archive for item', async () => {
      mockPrisma.item_archives.create.mockResolvedValue({});

      await storage.addArchiveToMetadata('test-item-id', testArchive);

      expect(mockPrisma.item_archives.create).toHaveBeenCalledWith({
        data: {
          item_id: 'test-item-id',
          file_type: 'pdf',
          file_size: 1024,
          file_hash: 'test-hash-123',
          add_date: testArchive.addDate,
          s3_key: 'test-s3-key',
          page_count: 10,
          word_count: 5000,
        },
      });
    });
  });

  describe('deleteMetadata', () => {
    it('should return true when deletion succeeds', async () => {
      mockPrisma.items.delete.mockResolvedValue({});
      const result = await storage.deleteMetadata('test-id');
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockPrisma.items.delete.mockRejectedValue(new Error('Delete failed'));
      const result = await storage.deleteMetadata('test-id');
      expect(result).toBe(false);
    });
  });

  describe('deleteCitations', () => {
    it('should return true when deletion succeeds', async () => {
      mockPrisma.citations.deleteMany.mockResolvedValue({ count: 1 });
      const result = await storage.deleteCitations('test-id');
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockPrisma.citations.deleteMany.mockRejectedValue(new Error('Delete failed'));
      const result = await storage.deleteCitations('test-id');
      expect(result).toBe(false);
    });
  });

  describe('saveMarkdown', () => {
    it('should upsert markdown content', async () => {
      mockPrisma.markdowns.upsert.mockResolvedValue({});

      await storage.saveMarkdown('test-id', '# Test Markdown');

      expect(mockPrisma.markdowns.upsert).toHaveBeenCalledWith({
        where: { item_id: 'test-id' },
        update: {
          content: '# Test Markdown',
          date_modified: expect.any(Date),
        },
        create: {
          item_id: 'test-id',
          content: '# Test Markdown',
        },
      });
    });
  });

  describe('getMarkdown', () => {
    it('should return markdown content when found', async () => {
      mockPrisma.markdowns.findUnique.mockResolvedValue({
        content: '# Test Markdown',
      });
      const result = await storage.getMarkdown('test-id');
      expect(result).toBe('# Test Markdown');
    });

    it('should return null when not found', async () => {
      mockPrisma.markdowns.findUnique.mockResolvedValue(null);
      const result = await storage.getMarkdown('test-id');
      expect(result).toBeNull();
    });
  });

  describe('deleteMarkdown', () => {
    it('should return true when deletion succeeds', async () => {
      mockPrisma.markdowns.delete.mockResolvedValue({});
      const result = await storage.deleteMarkdown('test-id');
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      mockPrisma.markdowns.delete.mockRejectedValue(new Error('Delete failed'));
      const result = await storage.deleteMarkdown('test-id');
      expect(result).toBe(false);
    });
  });
});