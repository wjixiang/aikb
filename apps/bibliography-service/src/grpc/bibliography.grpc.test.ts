import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BibliographyGrpcController } from './bibliography.grpc.controller';
import { LibraryItemService } from '../app/library-item/library-item.service';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { S3Service } from '@aikb/s3-service';

describe('BibliographyGrpcController', () => {
  let controller: BibliographyGrpcController;
  let service: LibraryItemService;

  const mockLibraryItemService = {
    createLibraryItem: vi.fn(),
    createLibraryItemWithPdfBuffer: vi.fn(),
    getLibraryItem: vi.fn(),
    searchLibraryItems: vi.fn(),
    deleteLibraryItem: vi.fn(),
    updateLibraryItemMetadata: vi.fn(),
    updateLibraryItemMarkdown: vi.fn(),
    getPdfDownloadUrl: vi.fn(),
    getPdfUploadUrl: vi.fn(),
    addArchiveToItem: vi.fn(),
  };

  beforeEach(() => {
    controller = new BibliographyGrpcController(mockLibraryItemService as any);
    service = mockLibraryItemService as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createLibraryItem', () => {
    it('should create a library item', async () => {
      const request = {
        title: 'Test Book',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        tags: ['test'],
        collections: ['default'],
      };

      const mockItem = {
        getItemId: () => 'test-id',
        metadata: {
          title: 'Test Book',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['default'],
          dateAdded: new Date(),
          dateModified: new Date(),
          archives: [],
        },
      };

      mockLibraryItemService.createLibraryItem.mockResolvedValue(mockItem);

      const result = await controller.createLibraryItem(request);

      expect(service.createLibraryItem).toHaveBeenCalledWith({
        title: 'Test Book',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        tags: ['test'],
        collections: ['default'],
      });
      expect(result.item.id).toBe('test-id');
      expect(result.item.title).toBe('Test Book');
    });
  });

  describe('getLibraryItem', () => {
    it('should get a library item by ID', async () => {
      const request = { id: 'test-id' };

      const mockItem = {
        getItemId: () => 'test-id',
        metadata: {
          title: 'Test Book',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['default'],
          dateAdded: new Date(),
          dateModified: new Date(),
          archives: [],
        },
      };

      mockLibraryItemService.getLibraryItem.mockResolvedValue(mockItem);

      const result = await controller.getLibraryItem(request);

      expect(service.getLibraryItem).toHaveBeenCalledWith('test-id');
      expect(result.item.id).toBe('test-id');
    });

    it('should throw error if item not found', async () => {
      const request = { id: 'non-existent-id' };

      mockLibraryItemService.getLibraryItem.mockResolvedValue(null);

      await expect(controller.getLibraryItem(request)).rejects.toThrow(
        'Library item with ID non-existent-id not found',
      );
    });
  });

  describe('searchLibraryItems', () => {
    it('should search library items', async () => {
      const request = {
        query: 'test',
        tags: ['test'],
        collections: ['default'],
      };

      const mockItems = [
        {
          getItemId: () => 'test-id-1',
          metadata: {
            title: 'Test Book 1',
            authors: [{ firstName: 'John', lastName: 'Doe' }],
            tags: ['test'],
            collections: ['default'],
            dateAdded: new Date(),
            dateModified: new Date(),
            archives: [],
          },
        },
        {
          getItemId: () => 'test-id-2',
          metadata: {
            title: 'Test Book 2',
            authors: [{ firstName: 'Jane', lastName: 'Smith' }],
            tags: ['test'],
            collections: ['default'],
            dateAdded: new Date(),
            dateModified: new Date(),
            archives: [],
          },
        },
      ];

      mockLibraryItemService.searchLibraryItems.mockResolvedValue(mockItems);

      const result = await controller.searchLibraryItems(request);

      expect(service.searchLibraryItems).toHaveBeenCalledWith(
        'test',
        ['test'],
        ['default'],
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title).toBe('Test Book 1');
      expect(result.items[1].title).toBe('Test Book 2');
    });
  });

  describe('deleteLibraryItem', () => {
    it('should delete a library item', async () => {
      const request = { id: 'test-id' };

      mockLibraryItemService.deleteLibraryItem.mockResolvedValue(true);

      const result = await controller.deleteLibraryItem(request);

      expect(service.deleteLibraryItem).toHaveBeenCalledWith('test-id');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Library item deleted successfully');
    });

    it('should throw error if item not found', async () => {
      const request = { id: 'non-existent-id' };

      mockLibraryItemService.deleteLibraryItem.mockResolvedValue(false);

      await expect(controller.deleteLibraryItem(request)).rejects.toThrow(
        'Library item with ID non-existent-id not found',
      );
    });
  });
});
