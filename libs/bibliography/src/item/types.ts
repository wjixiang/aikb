// Import required types for the remaining interfaces
import { ChunkingConfig } from '@aikb/chunking';
import { EmbeddingConfig } from '@aikb/embedding';

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
