import { ChunkingConfig } from '@aikb/chunking';
import { EmbeddingConfig } from '@aikb/embedding';

// Enhanced metadata interfaces for Zotero-like functionality
export interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
}

/**
 * PDF processing status enum
 * @deprecated need to migrate to rabbitmq shared service
 */
export enum PdfProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ANALYZING = 'analyzing',
  SPLITTING = 'splitting',
  MERGING = 'merging',
  CONVERTING = 'converting',
}

export interface BookMetadata {
  id?: string;
  title: string;
  authors: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[]; // Collection IDs this item belongs to
  dateAdded: Date;
  dateModified: Date;
  fileType: 'pdf' | 'article' | 'book' | 'other';
  s3Key?: string;
  fileSize?: number;
  pageCount?: number;
  language?: string;
  contentHash?: string; // Hash of the content for deduplication
  markdownContent?: string; // Converted markdown content from PDF
  markdownUpdatedDate?: Date; // When the markdown was last updated

  // PDF processing status fields
  pdfProcessingStatus?: PdfProcessingStatus; // Current processing status
  pdfProcessingStartedAt?: Date; // When processing started
  pdfProcessingCompletedAt?: Date; // When processing completed
  pdfProcessingError?: string; // Error message if processing failed
  pdfProcessingRetryCount?: number; // Number of retry attempts
  pdfProcessingProgress?: number; // Processing progress (0-100)
  pdfProcessingMessage?: string; // Current processing message
  pdfProcessingMergingStartedAt?: Date; // When merging started

  // PDF splitting fields (for large files)
  pdfSplittingInfo?: {
    itemId: string;
    originalFileName: string;
    totalParts: number;
    parts: Array<{
      partIndex: number;
      startPage: number;
      endPage: number;
      pageCount: number;
      s3Key: string;
      status: string;
      processingTime?: number;
      error?: string;
    }>;
    processingTime: number;
  };

  // PDF part processing status
  pdfPartStatuses?: Record<
    number,
    {
      status: string;
      message: string;
      error?: string;
      updatedAt: Date;
    }
  >;
}

export interface Collection {
  id?: string;
  name: string;
  description?: string;
  parentCollectionId?: string; // For nested collections
  dateAdded: Date;
  dateModified: Date;
}

export interface Citation {
  id: string;
  itemId: string;
  citationStyle: string; // APA, MLA, Chicago, etc.
  citationText: string;
  dateGenerated: Date;
}

export interface SearchFilter {
  query?: string;
  tags?: string[];
  collections?: string[];
  authors?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  fileType?: string[];
}

// Chunk-related interfaces
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
  searchText: string;
  resultNum: number;
  threshold: number;
}

export enum ItemVectorStorageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
