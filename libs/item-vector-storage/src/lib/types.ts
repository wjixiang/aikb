import { ChunkingConfig } from '@aikb/chunking';
import { Embedding, EmbeddingConfig } from '@aikb/embedding';

export enum ItemVectorStorageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ItemChunk {
  id: string;
  itemId: string; // Reference to the parent book item

  // Dense vector index group for organization
  denseVectorIndexGroupId: string; // Group identifier for this chunking/embedding combination

  // Content and metadata
  title: string;
  content: string;
  index: number; // Position in the document

  // Simplified embedding field - single dense vector
  embedding: number[]; // Vector embedding of the content (single vector, not versioned)

  // Strategy and configuration metadata
  strategyMetadata: {
    chunkingStrategy: string; // e.g., 'h1', 'paragraph', 'semantic'
    chunkingConfig: ChunkingConfig; // Original chunking configuration
    embeddingConfig: EmbeddingConfig; // Original embedding configuration
    processingTimestamp: Date;
    processingDuration: number;
  };

  // Additional metadata
  metadata?: {
    chunkType?: string; // Changed to string to support any chunking strategy
    startPosition?: number;
    endPosition?: number;
    wordCount?: number;
    chunkingConfig?: string; // JSON string of chunking configuration (deprecated, use strategyMetadata instead)
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkSearchFilter {
  query?: string;
  itemId?: string;
  itemIds?: string[];
  chunkType?: string;
  limit?: number;
  similarityThreshold?: number;
  denseVectorIndexGroupId?: string;
  groups?: string[];
  chunkingStrategies?: string[];
  embeddingProviders?: string[];
}

export interface ItemChunkSemanticSearchQuery {
  itemId: string[];
  groupId: string;
  searchVector: number[];
  resultNum: number;
  threshold: number;
}

export interface ChunkingEmbeddingGroupInfo {
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

export interface IItemVectorStorage {
  getStatus: (groupId: string) => Promise<ItemVectorStorageStatus>;
  semanticSearch: (
    query: ItemChunkSemanticSearchQuery,
  ) => Promise<Omit<ItemChunk, 'embedding'>>;
  insertItemChunk: (
    group: ChunkingEmbeddingGroupInfo,
    ItemChunk: ItemChunk,
  ) => Promise<boolean>;
  batchInsertItemChunks: (
    group: ChunkingEmbeddingGroupInfo,
    ItemChunks: ItemChunk[],
  ) => Promise<boolean>;
  createNewChunkEmbedGroupInfo: (
    config: Omit<ChunkingEmbeddingGroupInfo, 'id'>,
  ) => Promise<ChunkingEmbeddingGroupInfo>;
  getChunkEmbedGroupInfoById: (
    groupId: string,
  ) => Promise<ChunkingEmbeddingGroupInfo>;
  deleteChunkEmbedGroupById: (groupId: string) => Promise<{
    deletedGroupId: string;
    deletedChunkNum: number;
  }>;
}
