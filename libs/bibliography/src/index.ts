// Main bibliography exports
export * from './library/index.js';
export * from './storage/index.js';
export * from './item/index.js';

// Re-export commonly used types and interfaces
export type {
  BookMetadata,
  Author,
  Collection,
  Citation,
  SearchFilter,
  ItemChunk,
  ChunkSearchFilter,
  ItemVectorStorageStatus,
  ItemChunkSemanticSearchQuery,
} from './library/types.js';

export type {
  IItemVectorStorage,
  ChunkingEmbeddingGroup,
} from './item/types.js';

// Export interfaces from library.ts and storage.ts
export type { AbstractLibrary } from './library/library.js';
export type { AbstractLibraryStorage } from './library/storage.js';

// Export utility classes
export { HashUtils, IdUtils, CitationFormatter } from './library/utils.js';
