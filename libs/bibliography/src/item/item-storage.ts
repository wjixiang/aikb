import {
  ItemMetadata,
  ItemArchive,
} from '../library/types.js';

/**
 * Storage interface for item-specific operations
 * This interface separates item-level storage concerns from library-level operations
 */
export interface IItemStorage {
  // PDF operations
  getPdfDownloadUrl(s3Key: string): Promise<string>;
  getPdf(s3Key: string): Promise<Buffer>;

  // Metadata operations
  getMetadata(id: string): Promise<ItemMetadata | null>;
  updateMetadata(metadata: ItemMetadata): Promise<void>;
  addArchiveToMetadata(id: string, archive: ItemArchive): Promise<void>;
  deleteMetadata(id: string): Promise<boolean>;

  // Citation operations
  deleteCitations(itemId: string): Promise<boolean>;

  // Markdown operations
  saveMarkdown(itemId: string, markdownContent: string): Promise<void>;
  getMarkdown(itemId: string): Promise<string | null>;
  deleteMarkdown(itemId: string): Promise<boolean>;
}