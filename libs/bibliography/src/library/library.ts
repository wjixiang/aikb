import * as path from 'path';
import { createLoggerWithPrefix } from 'log-management';

// Create a global logger for the Library module
const logger = createLoggerWithPrefix('Library');
import { MinerUPdfConvertor } from '@aikb/pdf-converter';
import { LibraryItem } from '../item/library-item.js';

import {
  Author,
  ItemMetadata,
  Collection,
  Citation,
  SearchFilter,
  PdfProcessingStatus,
  ItemArchive,
} from './types.js';

import { ILibraryStorage, AbstractPdf } from './storage.js';
import { HashUtils, CitationFormatter } from './utils.js';
import { IdUtils } from 'utils';

/**
 * Manage overall storage & retrieve of books/literatures/articles
 */
export interface ILibrary {
  /**
   * Store a PDF file from a buffer
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param metadata PDF metadata
   * @deprecated Use createItem and addArchiveToItem separately
   */
  storePdf(
    pdfBuffer: Buffer,
    fileName: string,
    metadata: Partial<ItemMetadata>,
  ): Promise<LibraryItem>;

  /**
   * Create a new library item without any archives
   * @param metadata The item metadata
   * @returns The created library item
   */
  createItem(metadata: Partial<ItemMetadata>): Promise<LibraryItem>;

  /**
   * Add an archive to an existing library item
   * @param itemId The ID of the library item
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param pageCount The page count of the PDF
   * @returns The updated library item
   */
  addArchiveToItem(
    itemId: string,
    pdfBuffer: Buffer,
    fileName: string,
    pageCount?: number,
  ): Promise<LibraryItem>;

  /**
   * Get a item by ID
   */
  getItem(id: string): Promise<LibraryItem | null>;

  /**
   * Search for items with filters
   */
  searchItems(filter: SearchFilter): Promise<LibraryItem[]>;

  /**
   * Create a new collection
   */
  createCollection(
    name: string,
    description?: string,
    parentCollectionId?: string,
  ): Promise<Collection>;

  /**
   * Get all collections
   */
  getCollections(): Promise<Collection[]>;

  /**
   * Add item to collection
   */
  addItemToCollection(itemId: string, collectionId: string): Promise<void>;

  /**
   * Remove item from collection
   */
  removeItemFromCollection(itemId: string, collectionId: string): Promise<void>;

  /**
   * Generate citation for an item
   */
  generateCitation(itemId: string, style: string): Promise<Citation>;

  /**
   * Delete a book by ID
   */
  deleteItem(id: string): Promise<boolean>;

  /**
   * Delete a collection by ID
   */
  deleteCollection(id: string): Promise<boolean>;

  /**
   * Delete all items in a collection
   */
  deleteItemsInCollection(collectionId: string): Promise<number>;
}

/**
 * Default implementation of Library
 */
export class Library implements ILibrary {
  protected storage: ILibraryStorage;

  constructor(storage: ILibraryStorage) {
    this.storage = storage;
    logger.debug('Library constructor initialized');
  }

  /**
   * Store a PDF file from a buffer
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param metadata PDF metadata
   * @deprecated seperate item creating and pdf data appending
   */
  async storePdf(
    pdfBuffer: Buffer,
    fileName: string,
    metadata: Partial<ItemMetadata>,
    pageCount?: number,
  ): Promise<LibraryItem> {
    // Validate inputs
    if (!fileName) {
      throw new Error('File name is required when providing a buffer');
    }

    // Generate hash from file content
    const contentHash = HashUtils.generateHashFromBuffer(pdfBuffer);

    // Check if item with same hash already exists
    const existingItem = await this.storage.getMetadataByHash(contentHash);
    if (existingItem) {
      logger.info(
        `Item with same content already exists (ID: ${existingItem.id}), returning existing item.`,
      );
      return new LibraryItem(existingItem, this.storage);
    }

    // Upload to S3
    logger.info(`Pdf not exist, uploading to s3...`);
    const pdfInfo = await this.storage.uploadPdf(pdfBuffer, fileName);

    const fullMetadata: ItemMetadata = {
      ...metadata,
      title: metadata.title || path.basename(fileName, '.pdf'),
      dateAdded: new Date(),
      dateModified: new Date(),
      tags: metadata.tags || [],
      collections: metadata.collections || [],
      authors: metadata.authors || [],
      archives: [
        {
          fileType: 'pdf',
          fileSize: pdfBuffer.length,
          fileHash: contentHash,
          addDate: new Date(),
          s3Key: pdfInfo.s3Key,
          pageCount: pageCount || 0, // Default to 0 if not provided, but should be provided for PDF files
        },
      ],
    };

    // Save metadata first to get the ID
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    const libraryItem = new LibraryItem(savedMetadata, this.storage);

    // Note: RabbitMQ integration removed for simplified version
    // In a full implementation, you would queue this for processing here

    return libraryItem;
  }

  /**
   * Create a new library item without any archives
   * @param metadata The item metadata
   * @returns The created library item
   */
  async createItem(metadata: Partial<ItemMetadata>): Promise<LibraryItem> {
    const fullMetadata: ItemMetadata = {
      title: metadata.title || 'Untitled',
      dateAdded: new Date(),
      dateModified: new Date(),
      tags: metadata.tags || [],
      collections: metadata.collections || [],
      authors: metadata.authors || [],
      archives: [], // Start with empty archives
      ...metadata,
    };

    // Save metadata to get the ID
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    return new LibraryItem(savedMetadata, this.storage);
  }

  /**
   * Add an archive to an existing library item
   * @param itemId The ID of the library item
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param pageCount The page count of the PDF
   * @returns The updated library item
   */
  async addArchiveToItem(
    itemId: string,
    pdfBuffer: Buffer,
    fileName: string,
    pageCount?: number,
  ): Promise<LibraryItem> {
    // Validate inputs
    if (!fileName) {
      throw new Error('File name is required when providing a buffer');
    }

    // Get the existing item
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error(`Library item with ID ${itemId} not found`);
    }

    // Generate hash from file content
    const contentHash = HashUtils.generateHashFromBuffer(pdfBuffer);

    // Check if archive with same hash already exists for this item
    const existingArchive = item.metadata.archives.find(
      (archive) => archive.fileHash === contentHash,
    );
    if (existingArchive) {
      logger.info(
        `Archive with same content already exists for item ${itemId}, returning existing item.`,
      );
      return item;
    }

    // Upload to S3
    logger.info(`Uploading PDF to S3 for item ${itemId}...`);
    const pdfInfo = await this.storage.uploadPdf(pdfBuffer, fileName);

    // Create the new archive
    const newArchive: ItemArchive = {
      fileType: 'pdf',
      fileSize: pdfBuffer.length,
      fileHash: contentHash,
      addDate: new Date(),
      s3Key: pdfInfo.s3Key,
      pageCount: pageCount || 0,
    };

    // Add the archive to the item's metadata
    await this.storage.addArchiveToMetadata(itemId, newArchive);

    // Return the updated item
    const updatedItem = await this.getItem(itemId);
    if (!updatedItem) {
      throw new Error(`Failed to retrieve updated library item ${itemId}`);
    }

    return updatedItem;
  }

  /**
   * Get a book by ID
   */
  async getItem(id: string): Promise<LibraryItem | null> {
    const metadata = await this.storage.getMetadata(id);
    if (!metadata) return null;
    return new LibraryItem(metadata, this.storage);
  }

  /**
   * Search for items with filters
   */
  async searchItems(filter: SearchFilter): Promise<LibraryItem[]> {
    const metadataList = await this.storage.searchMetadata(filter);
    return metadataList.map(
      (metadata) => new LibraryItem(metadata, this.storage),
    );
  }

  /**
   * Create a new collection
   */
  async createCollection(
    name: string,
    description?: string,
    parentCollectionId?: string,
  ): Promise<Collection> {
    const collection: Collection = {
      name,
      description,
      parentCollectionId,
      dateAdded: new Date(),
      dateModified: new Date(),
    };

    return await this.storage.saveCollection(collection);
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    return await this.storage.getCollections();
  }

  /**
   * Add item to collection
   */
  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.storage.addItemToCollection(itemId, collectionId);
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.storage.removeItemFromCollection(itemId, collectionId);
  }

  /**
   * Generate citation for an item
   */
  async generateCitation(itemId: string, style: string): Promise<Citation> {
    const item = await this.getItem(itemId);
    if (!item) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    const citationText = CitationFormatter.formatCitation(item.metadata, style);
    const citation: Citation = {
      id: IdUtils.generateId(),
      itemId,
      citationStyle: style,
      citationText,
      dateGenerated: new Date(),
    };

    return await this.storage.saveCitation(citation);
  }

  /**
   * Delete a book by ID
   */
  async deleteItem(id: string): Promise<boolean> {
    const item = await this.getItem(id);
    if (!item) {
      return false;
    }

    // Delete PDF files from S3 if they exist
    for (const archive of item.metadata.archives) {
      try {
        // Lazy import s3-service to avoid eager initialization
        const { deleteFromS3 } = await import('@aikb/s3-service');
        await deleteFromS3(archive.s3Key);
      } catch (error) {
        logger.error(
          `Failed to delete PDF from S3 for item ${id} (s3Key: ${archive.s3Key}):`,
          error,
        );
        // Continue with metadata deletion even if S3 deletion fails
      }
    }

    // Delete metadata
    return await this.storage.deleteMetadata(id);
  }

  /**
   * Delete a collection by ID
   */
  async deleteCollection(id: string): Promise<boolean> {
    return await this.storage.deleteCollection(id);
  }

  /**
   * Delete all items in a collection
   */
  async deleteItemsInCollection(collectionId: string): Promise<number> {
    const items = await this.searchItems({ collections: [collectionId] });
    let deletedCount = 0;

    for (const item of items) {
      if (await this.deleteItem(item.getItemId())) {
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
