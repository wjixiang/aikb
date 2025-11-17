import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryItem } from '../library-item.js';
import { MockLibraryStorage } from '../../library/__tests__/mock-storage.js';
import { ItemMetadata, ItemArchive, Author } from '../../library/types.js';

// Mock the logger
vi.mock('log-management', () => ({
  createLoggerWithPrefix: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('LibraryItem', () => {
  let mockStorage: MockLibraryStorage;
  let libraryItem: LibraryItem;
  let testMetadata: ItemMetadata;

  beforeEach(async () => {
    mockStorage = new MockLibraryStorage();

    testMetadata = {
      id: 'test-item-id',
      title: 'Test Document',
      authors: [{ firstName: 'John', lastName: 'Doe' }],
      abstract: 'Test abstract',
      tags: ['test'],
      collections: [],
      dateAdded: new Date(),
      dateModified: new Date(),
      archives: [],
    };

    // Save the metadata to storage
    await mockStorage.saveMetadata(testMetadata);

    // Create LibraryItem instance with a fresh copy of metadata
    libraryItem = new LibraryItem({ ...testMetadata }, mockStorage);
  });

  describe('addArchiveToMetadata', () => {
    it('should add a new archive to metadata successfully', async () => {
      const newArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-123',
        addDate: new Date(),
        s3Key: 'test-s3-key',
        pageCount: 10,
        wordCount: 5000,
      };

      const result = await libraryItem.addArchiveToMetadata(newArchive);

      expect(result).toBe(true);
      expect(libraryItem.metadata.archives).toHaveLength(1);
      expect(libraryItem.metadata.archives[0]).toEqual(newArchive);
    });

    it('should throw error if item has no ID', async () => {
      const metadataWithoutId = { ...testMetadata, id: undefined };
      const itemWithoutId = new LibraryItem(metadataWithoutId, mockStorage);

      const newArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-123',
        addDate: new Date(),
        s3Key: 'test-s3-key',
      };

      await expect(
        itemWithoutId.addArchiveToMetadata(newArchive),
      ).rejects.toThrow('Cannot add archive to item without ID');
    });

    it('should update the dateModified when adding archive', async () => {
      const originalDateModified = libraryItem.metadata.dateModified;

      // Wait a bit to ensure the date will be different
      await new Promise((resolve) => setTimeout(resolve, 10));

      const newArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-123',
        addDate: new Date(),
        s3Key: 'test-s3-key',
      };

      await libraryItem.addArchiveToMetadata(newArchive);

      expect(libraryItem.metadata.dateModified.getTime()).toBeGreaterThan(
        originalDateModified.getTime(),
      );
    });

    it('should handle multiple archives correctly', async () => {
      const firstArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-1',
        addDate: new Date(),
        s3Key: 'test-s3-key-1',
      };

      const secondArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 2048,
        fileHash: 'test-hash-2',
        addDate: new Date(),
        s3Key: 'test-s3-key-2',
      };

      await libraryItem.addArchiveToMetadata(firstArchive);
      await libraryItem.addArchiveToMetadata(secondArchive);

      expect(libraryItem.metadata.archives).toHaveLength(2);
      expect(libraryItem.metadata.archives[0]).toEqual(firstArchive);
      expect(libraryItem.metadata.archives[1]).toEqual(secondArchive);
    });

    it('should propagate storage errors', async () => {
      // Mock storage to throw error
      vi.spyOn(mockStorage, 'addArchiveToMetadata').mockRejectedValue(
        new Error('Storage error'),
      );

      const newArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-123',
        addDate: new Date(),
        s3Key: 'test-s3-key',
      };

      await expect(
        libraryItem.addArchiveToMetadata(newArchive),
      ).rejects.toThrow('Storage error');
    });
  });

  describe('listArchives', () => {
    it('should return an empty array when no archives exist', () => {
      const archives = libraryItem.listArchives();
      expect(archives).toEqual([]);
      expect(archives).toHaveLength(0);
    });

    it('should return all archives when archives exist', async () => {
      const firstArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-1',
        addDate: new Date(),
        s3Key: 'test-s3-key-1',
      };

      const secondArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 2048,
        fileHash: 'test-hash-2',
        addDate: new Date(),
        s3Key: 'test-s3-key-2',
      };

      await libraryItem.addArchiveToMetadata(firstArchive);
      await libraryItem.addArchiveToMetadata(secondArchive);

      const archives = libraryItem.listArchives();
      expect(archives).toHaveLength(2);
      expect(archives[0]).toEqual(firstArchive);
      expect(archives[1]).toEqual(secondArchive);
    });

    it('should return a copy of the archives array', async () => {
      const newArchive: ItemArchive = {
        fileType: 'pdf',
        fileSize: 1024,
        fileHash: 'test-hash-123',
        addDate: new Date(),
        s3Key: 'test-s3-key',
      };

      await libraryItem.addArchiveToMetadata(newArchive);
      const archives = libraryItem.listArchives();

      // Modify the returned array
      archives.push({
        fileType: 'pdf',
        fileSize: 999,
        fileHash: 'modified-hash',
        addDate: new Date(),
        s3Key: 'modified-s3-key',
      } as ItemArchive);

      // Check that the original metadata is not affected
      expect(libraryItem.metadata.archives).toHaveLength(1);
      expect(libraryItem.metadata.archives[0]).toEqual(newArchive);
    });
  });
});
