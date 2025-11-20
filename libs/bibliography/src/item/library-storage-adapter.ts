import { ILibraryStorage } from '../library/storage.js';
import { IItemStorage } from './item-storage.js';

/**
 * Adapter class that implements IItemStorage using an ILibraryStorage instance
 * This allows existing ILibraryStorage implementations to work with LibraryItem
 * without requiring them to directly implement IItemStorage
 */
export class LibraryStorageAdapter implements IItemStorage {
  constructor(private libraryStorage: ILibraryStorage) {}

  // PDF operations
  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    return this.libraryStorage.getPdfDownloadUrl(s3Key);
  }


  // Metadata operations
  async getMetadata(id: string): Promise<any> {
    return this.libraryStorage.getMetadata(id);
  }

  async updateMetadata(metadata: any): Promise<void> {
    return this.libraryStorage.updateMetadata(metadata);
  }

  async addArchiveToMetadata(id: string, archive: any): Promise<void> {
    return this.libraryStorage.addArchiveToMetadata(id, archive);
  }

  async deleteMetadata(id: string): Promise<boolean> {
    return this.libraryStorage.deleteMetadata(id);
  }

  // Citation operations
  async deleteCitations(itemId: string): Promise<boolean> {
    return this.libraryStorage.deleteCitations(itemId);
  }

  // Markdown operations
  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    return this.libraryStorage.saveMarkdown(itemId, markdownContent);
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    return this.libraryStorage.getMarkdown(itemId);
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    return this.libraryStorage.deleteMarkdown(itemId);
  }
}