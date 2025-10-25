import { BookMetadata, Collection, Citation, SearchFilter, ItemChunk, ChunkSearchFilter } from './types.js';

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
export interface AbstractLibraryStorage {
  // PDF operations
  uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf>;
  uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf>;
  getPdfDownloadUrl(s3Key: string): Promise<string>;
  getPdf(s3Key: string): Promise<Buffer>;

  // Metadata operations
  saveMetadata(metadata: BookMetadata): Promise<BookMetadata & { id: string }>;
  getMetadata(id: string): Promise<BookMetadata | null>;
  getMetadataByHash(contentHash: string): Promise<BookMetadata | null>;
  updateMetadata(metadata: BookMetadata): Promise<void>;
  searchMetadata(filter: SearchFilter): Promise<BookMetadata[]>;
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

  // Chunk operations
  saveChunk(chunk: ItemChunk): Promise<ItemChunk>;
  getChunk(chunkId: string): Promise<ItemChunk | null>;
  getChunksByItemId(itemId: string): Promise<ItemChunk[]>;
  updateChunk(chunk: ItemChunk): Promise<void>;
  deleteChunk(chunkId: string): Promise<boolean>;
  deleteChunksByItemId(itemId: string): Promise<number>;
  searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]>;
  findSimilarChunks(
    queryVector: number[],
    limit?: number,
    threshold?: number,
    itemIds?: string[],
  ): Promise<Array<ItemChunk & { similarity: number }>>;
  batchSaveChunks(chunks: ItemChunk[]): Promise<void>;

  // Multi-version support methods
  getChunksByItemAndGroup?(itemId: string, groupId: string): Promise<ItemChunk[]>;
  deleteChunksByGroup?(groupId: string): Promise<number>;
}