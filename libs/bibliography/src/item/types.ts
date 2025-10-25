// Re-export ItemChunk and ItemVectorStorageStatus from library/types to avoid duplication
export type { ItemChunk, ItemVectorStorageStatus } from '../library/types.js';

// Import required types for the remaining interfaces
import { ChunkingConfig } from "@aikb/chunking";
import { EmbeddingConfig } from "@aikb/embedding";

// Import types from library/types for use in interfaces
import type { ItemChunk, ItemVectorStorageStatus } from '../library/types.js';

export interface ChunkSearchFilter {
  query?: string;
  itemId?: string;
  itemIds?: string[];

  // Group filtering
  denseVectorIndexGroupId?: string; // Specific group to search in
  groups?: string[]; // Multiple groups to search across

  // Strategy filtering
  chunkingStrategies?: string[]; // Filter by chunking strategies
  embeddingProviders?: string[]; // Filter by embedding providers

  chunkType?: string; // Changed to string to support any chunking strategy
  similarityThreshold?: number;
  limit?: number;

  // Additional filters
  metadataFilters?: Record<string, any>; // Generic metadata filtering
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ChunkingEmbeddingGroup {
  id: string; // Unique identifier for this group
  name: string; // Human-readable name
  description?: string;

  // Strategy and model configuration
  chunkingConfig: ChunkingConfig;
  embeddingConfig: EmbeddingConfig;

  // Group settings
  isDefault: boolean; // Whether this is the default group for new items
  isActive: boolean; // Whether this group is currently active

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // User or system that created this group
  tags?: string[]; // For categorization and filtering
}

export interface ItemChunkSemanticSearchQuery {
  searchText: string;
  resultNum: number;
  threshold: number;
}


export interface IItemVectorStorage {
  itemId: string;
  groupInfo: ChunkingEmbeddingGroup;
  getStatus: () => Promise<ItemVectorStorageStatus>;
  semanticSearch: (
    query: ItemChunkSemanticSearchQuery,
  ) => Promise<Omit<ItemChunk, 'embedding'>>;
  // insertItemChunk: (ItemChunk: ItemChunk)=> Promise<boolean>;
  // batchInsertItemChunks: (ItemChunks: ItemChunk[]) => Promise<boolean>;
  chunkEmbed: (text: string) => Promise<void>;
}