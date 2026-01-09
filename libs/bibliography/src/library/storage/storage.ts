import {
  ItemMetadata,
  Collection,
  Citation,
  SearchFilter,
  ItemArchive,
} from '../types.js';

// Define AbstractPdf interface for PDF handling
export interface AbstractPdf {
  id: string;
  name: string;
  s3Key: string;
  url: string;
  fileSize?: number;
  createDate: Date;
}

/**
 * Storage interface for library operations
 */
export interface ILibraryStorage {
  // PDF operations
  uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf>;
  getPdfDownloadUrl(s3Key: string): Promise<string>;
  getPdf(s3Key: string): Promise<Buffer>;

  // Metadata operations
  saveMetadata(metadata: ItemMetadata): Promise<ItemMetadata & { id: string }>;
  getMetadata(id: string): Promise<ItemMetadata | null>;
  getMetadataByHash(contentHash: string): Promise<ItemMetadata | null>;
  updateMetadata(metadata: ItemMetadata): Promise<void>;
  addArchiveToMetadata(id: string, archive: ItemArchive): Promise<void>;
  searchMetadata(filter: SearchFilter): Promise<ItemMetadata[]>;
  deleteMetadata(id: string): Promise<boolean>;

  // Collection operations
  saveCollection(collection: Collection): Promise<Collection>;
  getCollections(): Promise<Collection[]>;
  addItemToCollection(itemId: string, collectionId: string): Promise<void>;
  removeItemFromCollection(itemId: string, collectionId: string): Promise<void>;
  deleteCollection(id: string): Promise<boolean>;

  // Citation operations
  saveCitation(citation: Citation): Promise<Citation>;
  getCitations(itemId: string): Promise<Citation[]>;
  deleteCitations(itemId: string): Promise<boolean>;

  // Markdown operations
  saveMarkdown(itemId: string, markdownContent: string): Promise<void>;
  getMarkdown(itemId: string): Promise<string | null>;
  deleteMarkdown(itemId: string): Promise<boolean>;
}
