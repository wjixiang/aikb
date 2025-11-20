// Main bibliography exports
export * from './library/index.js';
export * from './library/storage/index.js';
export * from './item/index.js';

// Re-export commonly used types and interfaces
export type {
  ItemMetadata,
  Author,
  Collection,
  Citation,
  SearchFilter,
} from './library/types.js';

// Export interfaces from library.ts and storage.ts
export type { ILibrary } from './library/library.js';
export type { ILibraryStorage } from './library/storage.js';

// Export utility classes
export { HashUtils, CitationFormatter } from './library/utils.js';

// Export mock storage for testing
export { MockLibraryStorage } from './library/__tests__/mock-storage.js';
