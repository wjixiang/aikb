import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaItemStorage } from '../prisma-item-storage.js';
import { ItemMetadata, ItemArchive, Author } from '../../library/types.js';

// Mock the Prisma Client for e2e testing
const mockPrisma = {
  items: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  },
  item_authors: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
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
    createMany: vi.fn(),
  },
  markdowns: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
};

// Mock the logger
import { vi } from 'vitest';

vi.mock('log-management', () => ({
  createLoggerWithPrefix: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('PrismaItemStorage E2E Tests', () => {
  let storage: PrismaItemStorage;
  let testItemId: string;

  beforeEach(() => {
    storage = new PrismaItemStorage(mockPrisma as any);
    vi.clearAllMocks();

    testItemId = 'test-item-id-' + Math.random().toString(36).substr(2, 9);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Item Workflow', () => {
    it('should handle complete item lifecycle with all operations', async () => {
      // 1. Setup mock data for getMetadata test
      const mockItem = {
        id: testItemId,
        title: 'Test E2E Item',
        abstract: 'This is a test abstract',
        publication_year: 2023,
        publisher: 'Test Publisher',
        isbn: '1234567890',
        doi: '10.1000/test123',
        url: 'https://example.com/test',
        tags: ['test', 'e2e'],
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
          {
            authors: {
              first_name: 'Jane',
              last_name: 'Smith',
              middle_name: null,
            },
          },
        ],
        item_collections: [
          {
            collection_id: 'collection-1',
          },
          {
            collection_id: 'collection-2',
          },
        ],
        item_archives: [
          {
            file_type: 'pdf',
            file_size: 1024,
            file_hash: 'test-hash-123',
            add_date: new Date('2023-01-01'),
            s3_key: 'test-s3-key',
            page_count: 10,
            word_count: 5000,
          },
        ],
      };

      mockPrisma.items.findUnique.mockResolvedValue(mockItem);

      // Test getMetadata
      const metadata = await storage.getMetadata(testItemId);
      expect(metadata).not.toBeNull();
      expect(metadata!.title).toBe('Test E2E Item');
      expect(metadata!.authors).toHaveLength(2);
      expect(metadata!.collections).toHaveLength(2);
      expect(metadata!.archives).toHaveLength(1);
      expect(metadata!.tags).toEqual(['test', 'e2e']);

      // 2. Test updateMetadata
      mockPrisma.items.update.mockResolvedValue({});
      mockPrisma.item_authors.deleteMany.mockResolvedValue({});
      mockPrisma.authors.findFirst.mockResolvedValue(null);
      mockPrisma.authors.create.mockResolvedValue({ id: 'new-author-id' });
      mockPrisma.item_authors.create.mockResolvedValue({});
      mockPrisma.item_collections.deleteMany.mockResolvedValue({});
      mockPrisma.item_collections.create.mockResolvedValue({});

      const updatedMetadata: ItemMetadata = {
        ...metadata!,
        title: 'Updated Test Item',
        tags: ['test', 'e2e', 'updated'],
        dateModified: new Date('2023-01-04'),
        authors: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'New', lastName: 'Author' },
        ],
        collections: ['collection-1', 'collection-3'],
      };

      await storage.updateMetadata(updatedMetadata);

      expect(mockPrisma.items.update).toHaveBeenCalledWith({
        where: { id: testItemId },
        data: {
          title: 'Updated Test Item',
          abstract: 'This is a test abstract',
          publication_year: 2023,
          publisher: 'Test Publisher',
          isbn: '1234567890',
          doi: '10.1000/test123',
          url: 'https://example.com/test',
          tags: ['test', 'e2e', 'updated'],
          notes: 'Test notes',
          date_modified: updatedMetadata.dateModified,
          language: 'en',
          markdown_content: '# Test Markdown',
          markdown_updated_date: new Date('2023-01-03'),
        },
      });

      // 3. Test addArchiveToMetadata
      mockPrisma.item_archives.create.mockResolvedValue({});

      const newArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 2048,
        fileHash: 'test-hash-456',
        addDate: new Date('2023-01-05'),
        s3Key: 'test-s3-key-2',
        pageCount: 20,
        wordCount: 10000,
      };

      await storage.addArchiveToMetadata(testItemId, newArchive);

      expect(mockPrisma.item_archives.create).toHaveBeenCalledWith({
        data: {
          item_id: testItemId,
          file_type: 'pdf',
          file_size: 2048,
          file_hash: 'test-hash-456',
          add_date: newArchive.addDate,
          s3_key: 'test-s3-key-2',
          page_count: 20,
          word_count: 10000,
        },
      });

      // 4. Test markdown operations
      mockPrisma.markdowns.upsert.mockResolvedValue({});
      const markdownContent = '# Updated Test Markdown\n\nThis is updated test content.';
      await storage.saveMarkdown(testItemId, markdownContent);

      expect(mockPrisma.markdowns.upsert).toHaveBeenCalledWith({
        where: { item_id: testItemId },
        update: {
          content: markdownContent,
          date_modified: expect.any(Date),
        },
        create: {
          item_id: testItemId,
          content: markdownContent,
        },
      });

      // 5. Test getMarkdown
      mockPrisma.markdowns.findUnique.mockResolvedValue({
        content: markdownContent,
      });
      const retrievedMarkdown = await storage.getMarkdown(testItemId);
      expect(retrievedMarkdown).toBe(markdownContent);

      // 6. Test deleteMarkdown
      mockPrisma.markdowns.delete.mockResolvedValue({});
      const deleteResult = await storage.deleteMarkdown(testItemId);
      expect(deleteResult).toBe(true);

      // 7. Test deleteCitations
      mockPrisma.citations.deleteMany.mockResolvedValue({ count: 2 });
      const citationsDeleted = await storage.deleteCitations(testItemId);
      expect(citationsDeleted).toBe(true);

      // 8. Test deleteMetadata
      mockPrisma.items.delete.mockResolvedValue({});
      const itemDeleted = await storage.deleteMetadata(testItemId);
      expect(itemDeleted).toBe(true);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle non-existent item operations', async () => {
      const nonExistentId = 'non-existent-item-id';

      // Test getMetadata for non-existent item
      mockPrisma.items.findUnique.mockResolvedValue(null);
      const metadata = await storage.getMetadata(nonExistentId);
      expect(metadata).toBeNull();

      // Test deleteMetadata for non-existent item
      mockPrisma.items.delete.mockRejectedValue(new Error('Item not found'));
      const deleteResult = await storage.deleteMetadata(nonExistentId);
      expect(deleteResult).toBe(false);

      // Test getMarkdown for non-existent item
      mockPrisma.markdowns.findUnique.mockResolvedValue(null);
      const markdown = await storage.getMarkdown(nonExistentId);
      expect(markdown).toBeNull();

      // Test deleteMarkdown for non-existent item
      mockPrisma.markdowns.delete.mockRejectedValue(new Error('Markdown not found'));
      const deleteMarkdownResult = await storage.deleteMarkdown(nonExistentId);
      expect(deleteMarkdownResult).toBe(false);

      // Test deleteCitations for non-existent item
      mockPrisma.citations.deleteMany.mockRejectedValue(new Error('Citations not found'));
      const deleteCitationsResult = await storage.deleteCitations(nonExistentId);
      expect(deleteCitationsResult).toBe(false);
    });

    it('should handle updateMetadata with missing ID', async () => {
      const metadataWithoutId = {
        title: 'Test Item',
        authors: [],
        tags: [],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        archives: [],
      };

      await expect(storage.updateMetadata(metadataWithoutId)).rejects.toThrow(
        'Item ID is required for update',
      );
    });
  });

  describe('getPdfDownloadUrl', () => {
    it('should return a properly formatted URL', async () => {
      const s3Key = 'test/example.pdf';
      const url = await storage.getPdfDownloadUrl(s3Key);
      expect(url).toBe('https://s3.amazonaws.com/bucket/test/example.pdf');
    });
  });
});