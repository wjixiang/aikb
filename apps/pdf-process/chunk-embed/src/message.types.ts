/**
 * Base interface for all RabbitMQ messages
 */
export interface BaseRabbitMQMessage {
  messageId: string;
  timestamp: number;
  eventType: string;
}

// Import required types for multi-version support
import { ChunkingEmbeddingGroup } from '@aikb/bibliography';
import { EmbeddingConfig, EmbeddingProvider } from '@aikb/embedding';
import { ChunkingConfig, ChunkingStrategy } from '@aikb/chunking';

/**
 * PDF processing status enum
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

/**
 * Multi-version chunking and embedding request message
 */
export interface ChunkingEmbeddingRequestMessage extends BaseRabbitMQMessage {
  eventType: 'CHUNKING_EMBEDDING_REQUEST';
  itemId: string;
  markdownContent?: string;

  // Multi-version support
  groupConfig: Omit<ChunkingEmbeddingGroup, 'id'>; // Create new group with this config
  embeddingConfig?: EmbeddingConfig; // Optional embedding configuration override
  chunkingConfig?: ChunkingConfig; // Optional chunking configuration override

  // Processing options
  priority?: 'low' | 'normal' | 'high';
  retryCount?: number;
  maxRetries?: number;

  // Version control
  forceReprocess?: boolean; // Force reprocessing even if chunks exist
  preserveExisting?: boolean; // Keep existing chunks from other groups
}

/**
 * Multi-version chunking and embedding progress message
 */
export interface MultiVersionChunkingEmbeddingProgressMessage
  extends BaseRabbitMQMessage {
  eventType: 'MULTI_VERSION_CHUNKING_EMBEDDING_PROGRESS';
  itemId: string;
  groupId?: string;
  status: PdfProcessingStatus;
  progress: number;
  message?: string;
  chunksProcessed?: number;
  totalChunks?: number;
  currentGroup?: string;
  totalGroups?: number;
  startedAt?: number;
  estimatedCompletion?: number;
}

/**
 * Multi-version chunking and embedding completed message
 */
export interface MultiVersionChunkingEmbeddingCompletedMessage
  extends BaseRabbitMQMessage {
  eventType: 'MULTI_VERSION_CHUNKING_EMBEDDING_COMPLETED';
  itemId: string;
  groupId: string;
  status: PdfProcessingStatus.COMPLETED;
  chunksCount: number;
  processingTime: number;
  strategy: string;
  provider: string;
  version: string;
}

/**
 * Chunking and embedding progress message
 */
export interface ChunkingEmbeddingProgressMessage extends BaseRabbitMQMessage {
  eventType: 'CHUNKING_EMBEDDING_PROGRESS';
  itemId: string;
  status: PdfProcessingStatus;
  progress: number; // 0-100
  message?: string;
  error?: string;
  startedAt?: number;
  estimatedCompletion?: number;
  chunksProcessed?: number;
  totalChunks?: number;
}

/**
 * Chunking and embedding completed message
 */
export interface ChunkingEmbeddingCompletedMessage extends BaseRabbitMQMessage {
  eventType: 'CHUNKING_EMBEDDING_COMPLETED';
  itemId: string;
  status: PdfProcessingStatus.COMPLETED;
  chunksCount: number;
  processingTime: number; // in milliseconds
  chunkingStrategy: ChunkingStrategy;
}

/**
 * Chunking and embedding failed message
 */
export interface ChunkingEmbeddingFailedMessage extends BaseRabbitMQMessage {
  eventType: 'CHUNKING_EMBEDDING_FAILED';
  itemId: string;
  status: PdfProcessingStatus.FAILED;
  error: string;
  errorCode?: string;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  processingTime: number; // in milliseconds
}

/**
 * Queue and exchange names
 */
export const RABBITMQ_QUEUES = {
  CHUNKING_EMBEDDING_REQUEST: 'chunking-embedding-request',
  CHUNKING_EMBEDDING_PROGRESS: 'chunking-embedding-progress',
  CHUNKING_EMBEDDING_COMPLETED: 'chunking-embedding-completed',
  CHUNKING_EMBEDDING_FAILED: 'chunking-embedding-failed',
} as const;

/**
 * Exchange names
 */
export const RABBITMQ_EXCHANGES = {
  CHUNKING_EMBEDDING: 'chunking-embedding-exchange',
} as const;

/**
 * Routing keys
 */
export const RABBITMQ_ROUTING_KEYS = {
  CHUNKING_EMBEDDING_REQUEST: 'chunking-embedding-request',
  CHUNKING_EMBEDDING_PROGRESS: 'chunking-embedding-progress',
  CHUNKING_EMBEDDING_COMPLETED: 'chunking-embedding-completed',
  CHUNKING_EMBEDDING_FAILED: 'chunking-embedding-failed',
} as const;

/**
 * Consumer tags
 */
export const RABBITMQ_CONSUMER_TAGS = {
  CHUNKING_EMBEDDING_WORKER: 'chunking-embedding-worker',
} as const;