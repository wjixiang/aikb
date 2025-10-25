import {
  uploadToS3,
  uploadPdfFromPath,
  getSignedUrlForDownload,
  deleteFromS3,
} from '@aikb/s3-service';
import { connectToDatabase } from '../../libs/utils/mongodb';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from '@aikb/log-management/logger';

// Create a global logger for the Library module
const logger = createLoggerWithPrefix('Library');
import { MinerUPdfConvertor } from './PdfConvertor';
import { ChunkingConfig } from '@aikb/chunking';
import { EmbeddingConfig, defaultEmbeddingConfig } from '@aikb/embedding';
import {
  PdfProcessingStatus,
  PdfAnalysisRequestMessage,
} from '../../lib/rabbitmq/message.types';
import { getRabbitMQService } from '../../lib/rabbitmq/rabbitmq.service';
import { v4 as uuidv4 } from 'uuid';
import { LibraryItem } from './libraryItem';

// Enhanced metadata interfaces for Zotero-like functionality
export interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
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

/**
 * Utility functions for generating content hashes
 */
export class HashUtils {
  /**
   * Generate SHA-256 hash from file buffer
   */
  static generateHashFromBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate SHA-256 hash from file path
   */
  static async generateHashFromPath(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    return this.generateHashFromBuffer(fileBuffer);
  }

  /**
   * Generate hash from metadata fields (for articles without files)
   */
  static generateHashFromMetadata(metadata: Partial<BookMetadata>): string {
    const hashInput = {
      title: metadata.title || '',
      authors:
        metadata.authors
          ?.map(
            (author) =>
              `${author.lastName},${author.firstName}${author.middleName ? ',' + author.middleName : ''}`,
          )
          .sort()
          .join('|') || '',
      abstract: metadata.abstract || '',
      publicationYear: metadata.publicationYear || 0,
      publisher: metadata.publisher || '',
      doi: metadata.doi || '',
      isbn: metadata.isbn || '',
    };

    const hashString = JSON.stringify(hashInput);
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }
}

/**
 * Utility functions for generating IDs without database dependency
 */
export class IdUtils {
  /**
   * Generate a unique ID using uuidv4
   */
  static generateId(): string {
    return uuidv4();
  }

  /**
   * Generate a UUID using uuidv4
   */
  static generateUUID(): string {
    return uuidv4();
  }
}

/**
 * Manage overall storage & retrieve of books/literatures/articles
 */
export interface AbstractLibrary {
  /**
   * Store a PDF file from a buffer
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param metadata PDF metadata
   */
  storePdf(
    pdfBuffer: Buffer,
    fileName: string,
    metadata: Partial<BookMetadata>,
  ): Promise<LibraryItem>;

  /**
   * Re-extract markdown for a specific item or all items
   * @param itemId Optional ID of the item to re-extract markdown for
   */
  reExtractMarkdown(itemId?: string): Promise<void>;

  /**
   * Get a item by ID
   */
  getItem(id: string): Promise<LibraryItem | null>;

  /**
   * Search for items with filters
   */
  searchItems(filter: SearchFilter): Promise<LibraryItem[]>;

  /**
   * Create a new collection
   */
  createCollection(
    name: string,
    description?: string,
    parentCollectionId?: string,
  ): Promise<Collection>;

  /**
   * Get all collections
   */
  getCollections(): Promise<Collection[]>;

  /**
   * Add item to collection
   */
  addItemToCollection(itemId: string, collectionId: string): Promise<void>;

  /**
   * Remove item from collection
   */
  removeItemFromCollection(itemId: string, collectionId: string): Promise<void>;

  /**
   * Generate citation for an item
   */
  generateCitation(itemId: string, style: string): Promise<Citation>;

  /**
   * Delete a book by ID
   */
  deleteItem(id: string): Promise<boolean>;

  /**
   * Delete a collection by ID
   */
  deleteCollection(id: string): Promise<boolean>;

  /**
   * Delete all items in a collection
   */
  deleteItemsInCollection(collectionId: string): Promise<number>;

  // // Chunk-related methods
  // /**
  //  * Process markdown content into chunks and generate embeddings
  //  * @param itemId The ID of the item to process
  //  * @param chunkingStrategy The chunking strategy to use
  //  * @param options Optional configuration for chunking and embedding
  //  */
  // processItemChunks(
  //   itemId: string,
  //   chunkingStrategy?: ChunkingStrategy,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     embeddingProvider?: string;
  //     embeddingConfig?: EmbeddingConfig;
  //     chunkingConfig?: ChunkingConfig;
  //     forceReprocess?: boolean;
  //     preserveExisting?: boolean;
  //   },
  // ): Promise<void>;

  // /**
  //  * Get chunks for a specific item
  //  * @param itemId The ID of the item
  //  * @param options Optional filtering options
  //  */
  // getItemChunks(
  //   itemId: string,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //   },
  // ): Promise<ItemChunk[]>;

  // /**
  //  * Search chunks with filters
  //  * @param filter Search filters
  //  */
  // searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]>;

  // /**
  //  * Find similar chunks based on a query vector
  //  * @param queryVector The query vector
  //  * @param limit Maximum number of results
  //  * @param threshold Similarity threshold
  //  * @param itemIds Optional list of item IDs to search within
  //  * @param options Optional search options
  //  */
  // findSimilarChunks(
  //   queryVector: number[],
  //   limit?: number,
  //   threshold?: number,
  //   itemIds?: string[],
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //     provider?: string;
  //   },
  // ): Promise<Array<ItemChunk & { similarity: number }>>;

  // /**
  //  * Find similar chunks within a specific LibraryItem
  //  * @param itemId The LibraryItem ID to search within
  //  * @param queryVector The query vector
  //  * @param limit Maximum number of results
  //  * @param threshold Similarity threshold
  //  * @param options Optional search options
  //  */
  // findSimilarChunksInItem(
  //   itemId: string,
  //   queryVector: number[],
  //   limit?: number,
  //   threshold?: number,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //     provider?: string;
  //   },
  // ): Promise<Array<ItemChunk & { similarity: number }>>;

  // /**
  //  * Search chunks within a specific LibraryItem
  //  * @param itemId The LibraryItem ID to search within
  //  * @param query The search query
  //  * @param limit Maximum number of results
  //  * @param options Optional search options
  //  */
  // searchChunksInItem(
  //   itemId: string,
  //   query: string,
  //   limit?: number,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //   },
  // ): Promise<ItemChunk[]>;

  // /**
  //  * Re-process chunks for a specific item or all items
  //  * @param itemId Optional ID of the item to re-process
  //  * @param chunkingStrategy The chunking strategy to use
  //  * @param options Optional configuration for chunking and embedding
  //  */
  // reProcessChunks(
  //   itemId?: string,
  //   chunkingStrategy?: ChunkingStrategy,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     embeddingProvider?: string;
  //     embeddingConfig?: EmbeddingConfig;
  //     chunkingConfig?: ChunkingConfig;
  //     forceReprocess?: boolean;
  //     preserveExisting?: boolean;
  //   },
  // ): Promise<void>;
}

/**
 * Utility functions for formatting citations
 */
export class CitationFormatter {
  /**
   * Helper method to format citation
   */
  static formatCitation(metadata: BookMetadata, style: string): string {
    const authors = metadata.authors
      .map(
        (author) =>
          `${author.lastName}, ${author.firstName}${author.middleName ? ' ' + author.middleName[0] + '.' : ''}`,
      )
      .join(', ');

    switch (style.toLowerCase()) {
      case 'apa':
        return `${authors} (${metadata.publicationYear}). ${metadata.title}. ${metadata.publisher || ''}.`;
      case 'mla':
        return `${authors}. "${metadata.title}." ${metadata.publisher || ''}, ${metadata.publicationYear}.`;
      case 'chicago':
        return `${authors}. ${metadata.title}. ${metadata.publisher || ''}, ${metadata.publicationYear}.`;
      default:
        return `${authors}. ${metadata.title}. ${metadata.publicationYear}.`;
    }
  }
}

/**
 * Default implementation of Library
 */
export default class Library implements AbstractLibrary {
  private rabbitMQService = getRabbitMQService();
  protected storage: AbstractLibraryStorage;
  protected pdfConvertor?: MinerUPdfConvertor;

  constructor(storage: AbstractLibraryStorage) {
    this.storage = storage;
    logger.debug('Library constructor - RabbitMQ service instance', {
      serviceId: this.rabbitMQService.constructor.name,
      isConnected: this.rabbitMQService.isConnected(),
    });
  }

  /**
   * Store a PDF file from a buffer
   * @param pdfBuffer The PDF file buffer
   * @param fileName The file name
   * @param metadata PDF metadata
   */
  async storePdf(
    pdfBuffer: Buffer,
    fileName: string,
    metadata: Partial<BookMetadata>,
  ): Promise<LibraryItem> {
    // Validate inputs
    if (!fileName) {
      throw new Error('File name is required when providing a buffer');
    }

    // Generate hash from file content
    const contentHash = HashUtils.generateHashFromBuffer(pdfBuffer);

    // Check if item with same hash already exists
    const existingItem = await this.storage.getMetadataByHash(contentHash);
    if (existingItem) {
      logger.info(
        `Item with same content already exists (ID: ${existingItem.id}), returning existing item. Status: ${existingItem.pdfProcessingStatus}`,
      );
      return new LibraryItem(existingItem, this.storage);
    }

    // Upload to S3
    logger.info(`Pdf not exist, uploading to s3...`);
    const pdfInfo = await this.storage.uploadPdf(pdfBuffer, fileName);

    const fullMetadata: BookMetadata = {
      ...metadata,
      title: metadata.title || path.basename(fileName, '.pdf'),
      s3Key: pdfInfo.s3Key,
      fileSize: pdfBuffer.length,
      contentHash,
      dateAdded: new Date(),
      dateModified: new Date(),
      tags: metadata.tags || [],
      collections: metadata.collections || [],
      authors: metadata.authors || [],
      fileType: 'pdf',
      // Initialize processing status fields
      pdfProcessingStatus: PdfProcessingStatus.PENDING,
      pdfProcessingStartedAt: new Date(),
      pdfProcessingRetryCount: 0,
      pdfProcessingProgress: 0,
      pdfProcessingMessage: 'Queued for processing',
    };

    // Save metadata first to get the ID
    const savedMetadata = await this.storage.saveMetadata(fullMetadata);
    const libraryItem = new LibraryItem(savedMetadata, this.storage);

    // Send PDF analysis request to RabbitMQ for async processing
    // Generate a presigned URL for the PDF analysis worker
    const presignedUrl = await this.storage.getPdfDownloadUrl(pdfInfo.s3Key);
    await this.sendPdfAnalysisRequest(
      savedMetadata.id!,
      presignedUrl,
      pdfInfo.s3Key,
      fileName,
    );

    return libraryItem;
  }

  /**
   * Update processing status for a library item
   * @deprecated
   */
  private async updateProcessingStatus(
    itemId: string,
    status: PdfProcessingStatus,
    message?: string,
    progress?: number,
    error?: string,
  ): Promise<void> {
    try {
      const item = await this.getItem(itemId);
      if (!item) {
        logger.warn(`Item ${itemId} not found for status update`);
        return;
      }

      const updates: Partial<BookMetadata> = {
        pdfProcessingStatus: status,
        pdfProcessingMessage: message,
        pdfProcessingProgress: progress,
        pdfProcessingError: error,
        dateModified: new Date(),
      };

      // Update timestamps based on status
      if (
        status === PdfProcessingStatus.PROCESSING &&
        !item.metadata.pdfProcessingStartedAt
      ) {
        updates.pdfProcessingStartedAt = new Date();
      } else if (status === PdfProcessingStatus.COMPLETED) {
        updates.pdfProcessingCompletedAt = new Date();
        updates.pdfProcessingProgress = 100;
      } else if (status === PdfProcessingStatus.FAILED) {
        updates.pdfProcessingRetryCount =
          (item.metadata.pdfProcessingRetryCount || 0) + 1;
      }

      await item.updateMetadata(updates);
      logger.info(
        `Updated processing status for item ${itemId}: ${status}${message ? ` - ${message}` : ''}`,
      );
    } catch (error) {
      logger.error(
        `Failed to update processing status for item ${itemId}:`,
        error,
      );
    }
  }

  /**
   * Send PDF analysis request to RabbitMQ for async processing
   */
  async sendPdfAnalysisRequest(
    itemId: string,
    s3Url: string,
    s3Key: string,
    fileName: string,
  ): Promise<void> {
    try {
      logger.info(
        `Sending PDF analysis request to RabbitMQ for item: ${itemId}`,
      );

      // Ensure RabbitMQ service is initialized before publishing
      if (!this.rabbitMQService.isConnected()) {
        logger.info('RabbitMQ service not connected, initializing...');
        await this.rabbitMQService.initialize();
        logger.info('RabbitMQ service initialized successfully');
      }

      const analysisRequest: PdfAnalysisRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId,

        s3Key,
        fileName,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };

      logger.debug('About to publish PDF analysis request', {
        itemId,
        serviceConnected: this.rabbitMQService.isConnected(),
      });

      await this.rabbitMQService.publishPdfAnalysisRequest(analysisRequest);

      // Don't update status to processing here - keep it as pending until the worker starts processing
      // The status will be updated to 'processing' by the worker when it starts processing

      logger.info(`PDF analysis request sent successfully for item: ${itemId}`);
    } catch (error) {
      logger.error(
        `Failed to send PDF analysis request for item ${itemId}:`,
        error,
      );

      // Update status to failed
      await this.updateProcessingStatus(
        itemId,
        PdfProcessingStatus.FAILED,
        `Failed to queue for processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        `Failed to queue for processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Don't fail the entire operation, but log the error
    }
  }

  /**
   * Get processing status for a library item
   * @deprecated
   */
  async getProcessingStatus(itemId: string): Promise<{
    status: PdfProcessingStatus;
    progress?: number;
    message?: string;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
    retryCount?: number;
  } | null> {
    try {
      const item = await this.getItem(itemId);
      if (!item) {
        return null;
      }

      return {
        status:
          item.metadata.pdfProcessingStatus || PdfProcessingStatus.PENDING,
        progress: item.metadata.pdfProcessingProgress,
        message: item.metadata.pdfProcessingMessage,
        error: item.metadata.pdfProcessingError,
        startedAt: item.metadata.pdfProcessingStartedAt,
        completedAt: item.metadata.pdfProcessingCompletedAt,
        retryCount: item.metadata.pdfProcessingRetryCount,
      };
    } catch (error) {
      logger.error(
        `Failed to get processing status for item ${itemId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Check if PDF processing is completed for an item
   * @deprecated
   */
  async isProcessingCompleted(itemId: string): Promise<boolean> {
    const status = await this.getProcessingStatus(itemId);
    return status?.status === PdfProcessingStatus.COMPLETED;
  }

  /**
   * Check if PDF processing failed for an item
   * @deprecated
   */
  async isProcessingFailed(itemId: string): Promise<boolean> {
    const status = await this.getProcessingStatus(itemId);
    return status?.status === PdfProcessingStatus.FAILED;
  }

  /**
   * Wait for PDF processing to complete (with timeout)
   * @deprecated
   */
  async waitForProcessingCompletion(
    itemId: string,
    timeoutMs: number = 300000, // 5 minutes default
    intervalMs: number = 2000, // 2 seconds default
  ): Promise<{
    success: boolean;
    status?: PdfProcessingStatus;
    error?: string;
  }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getProcessingStatus(itemId);

      if (!status) {
        return { success: false, error: 'Item not found' };
      }

      if (status.status === PdfProcessingStatus.COMPLETED) {
        return { success: true, status: status.status };
      }

      if (status.status === PdfProcessingStatus.FAILED) {
        return {
          success: false,
          status: status.status,
          error: status.error || 'Processing failed',
        };
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return {
      success: false,
      error: `Processing timeout after ${timeoutMs}ms`,
    };
  }

  /**
   * @deprecated
   * @param itemId
   */
  async reExtractMarkdown(itemId?: string): Promise<void> {
    try {
      if (itemId) {
        // Re-extract markdown for a specific item
        const item = await this.getItem(itemId);
        if (!item) {
          throw new Error(`Item with ID ${itemId} not found`);
        }

        logger.info(`Re-extracting markdown for item: ${itemId}`);
        await item.extractMarkdown();
        logger.info(`Successfully re-extracted markdown for item: ${itemId}`);
      } else {
        // Re-extract markdown for all items that have PDFs
        logger.info('Re-extracting markdown for all items with PDFs...');

        // Get all items with PDF files
        const allItems = await this.searchItems({ fileType: ['pdf'] });

        for (const item of allItems) {
          if (item.hasPdf()) {
            try {
              logger.info(
                `Re-extracting markdown for item: ${item.metadata.id}`,
              );
              await item.extractMarkdown();
              logger.info(
                `Successfully re-extracted markdown for item: ${item.metadata.id}`,
              );
            } catch (error) {
              logger.error(
                `Failed to re-extract markdown for item ${item.metadata.id}:`,
                error,
              );
              // Continue with other items even if one fails
            }
          }
        }

        logger.info('Completed re-extraction of markdown for all items');
      }
    } catch (error) {
      logger.error('Error in reExtractMarkdown:', error);
      throw error;
    }
  }

  /**
   * Get a book by ID
   */
  async getItem(id: string): Promise<LibraryItem | null> {
    const metadata = await this.storage.getMetadata(id);
    if (!metadata) return null;
    return new LibraryItem(metadata, this.storage);
  }

  /**
   * Search for items with filters
   */
  async searchItems(filter: SearchFilter): Promise<LibraryItem[]> {
    const metadataList = await this.storage.searchMetadata(filter);
    return metadataList.map(
      (metadata) => new LibraryItem(metadata, this.storage),
    );
  }

  /**
   * Create a new collection
   */
  async createCollection(
    name: string,
    description?: string,
    parentCollectionId?: string,
  ): Promise<Collection> {
    const collection: Collection = {
      name,
      description,
      parentCollectionId,
      dateAdded: new Date(),
      dateModified: new Date(),
    };

    return await this.storage.saveCollection(collection);
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<Collection[]> {
    return await this.storage.getCollections();
  }

  /**
   * Add item to collection
   */
  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.storage.addItemToCollection(itemId, collectionId);
  }

  /**
   * Remove item from collection
   */
  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.storage.removeItemFromCollection(itemId, collectionId);
  }

  /**
   * Generate citation for an item
   */
  async generateCitation(itemId: string, style: string): Promise<Citation> {
    const metadata = await this.storage.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    // This is a simplified citation generator
    // In a real implementation, you would use a proper citation library
    const citationText = CitationFormatter.formatCitation(metadata, style);

    const citation: Citation = {
      id: IdUtils.generateId(),
      itemId,
      citationStyle: style,
      citationText,
      dateGenerated: new Date(),
    };

    await this.storage.saveCitation(citation);
    return citation;
  }

  /**
   * Delete a book by ID
   */
  async deleteItem(id: string): Promise<boolean> {
    const metadata = await this.storage.getMetadata(id);
    if (!metadata) {
      return false;
    }

    // Delete from storage
    return await this.storage.deleteMetadata(id);
  }

  /**
   * Delete a collection by ID
   */
  async deleteCollection(id: string): Promise<boolean> {
    return await this.storage.deleteCollection(id);
  }

  /**
   * Delete all items in a collection
   */
  async deleteItemsInCollection(collectionId: string): Promise<number> {
    const items = await this.searchItems({ collections: [collectionId] });
    let deletedCount = 0;

    for (const item of items) {
      const success = await this.deleteItem(item.metadata.id!);
      if (success) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // // Chunk-related methods implementation
  // /**
  //  * @deprecated
  //  * @param itemId
  //  * @param chunkingStrategy
  //  * @param options
  //  * @returns
  //  */
  // async processItemChunks(
  //   itemId: string,
  //   chunkingStrategy: ChunkingStrategy = ChunkingStrategy.H1,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     embeddingProvider?: string;
  //     embeddingConfig?: EmbeddingConfig;
  //     chunkingConfig?: ChunkingConfig;
  //     forceReprocess?: boolean;
  //     preserveExisting?: boolean;
  //   },
  // ): Promise<void> {
  //   try {
  //     // Get the item metadata
  //     const item = await this.getItem(itemId);
  //     if (!item) {
  //       throw new Error(`Item with ID ${itemId} not found`);
  //     }

  //     // Get the markdown content
  //     const markdownContent = await item.getMarkdown();
  //     if (!markdownContent) {
  //       logger.warn(`No markdown content found for item: ${itemId}`);
  //       return;
  //     }

  //     // Check if the markdown content is just a placeholder (no actual markdown was stored)
  //     const storedMarkdown = await this.storage.getMarkdown(itemId);
  //     if (!storedMarkdown) {
  //       logger.warn(
  //         `No actual markdown content stored for item: ${itemId}, skipping chunking`,
  //       );
  //       return;
  //     }

  //     logger.info(
  //       `Chunking markdown content for item: ${itemId} using strategy: ${chunkingStrategy}`,
  //     );

  //     // Handle chunking with default group manager
  //     const defaultGroupManager = DefaultGroupManager.getInstance();
  //     const defaultGroup =
  //       defaultGroupManager.getDefaultGroup(chunkingStrategy);

  //     const denseVectorIndexGroupId =
  //       options?.denseVectorIndexGroupId ||
  //       defaultGroup?.id ||
  //       `default-${chunkingStrategy}`;

  //     const embeddingProvider =
  //       options?.embeddingProvider ||
  //       defaultGroup?.embeddingProvider ||
  //       embeddingService.getProvider();

  //     const embeddingConfig: EmbeddingConfig = options?.embeddingConfig ||
  //       defaultGroup?.embeddingConfig || {
  //         model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
  //         dimension: 1536,
  //         batchSize: 32,
  //         maxRetries: 3,
  //         timeout: 30000,
  //         provider: EmbeddingProvider.OPENAI,
  //       };

  //     const chunkingConfig = options?.chunkingConfig ||
  //       defaultGroup?.chunkingConfig || {
  //         maxChunkSize: 1000,
  //         minChunkSize: 100,
  //         overlap: 50,
  //       };

  //     const forceReprocess = options?.forceReprocess || false;
  //     const preserveExisting = options?.preserveExisting || false;

  //     logger.info(
  //       `Processing chunks for item ${itemId} with group: ${denseVectorIndexGroupId}, strategy: ${chunkingStrategy}, provider: ${embeddingProvider}`,
  //     );

  //     // Check if we need to delete existing chunks
  //     if (forceReprocess) {
  //       if (
  //         preserveExisting &&
  //         denseVectorIndexGroupId &&
  //         typeof (this.storage as any).deleteChunksByGroup === 'function'
  //       ) {
  //         // Only delete chunks for this specific group
  //         logger.info(
  //           `Deleting existing chunks for group: ${denseVectorIndexGroupId}`,
  //         );
  //         await (this.storage as any).deleteChunksByGroup(
  //           denseVectorIndexGroupId,
  //         );
  //       } else {
  //         // Delete all chunks for this item
  //         logger.info(`Deleting all existing chunks for item: ${itemId}`);
  //         await this.storage.deleteChunksByItemId(itemId);
  //       }
  //     } else {
  //       // Check if chunks already exist for this group
  //       if (
  //         denseVectorIndexGroupId &&
  //         typeof (this.storage as any).getChunksByItemAndGroup === 'function'
  //       ) {
  //         const existingChunks = await (
  //           this.storage as any
  //         ).getChunksByItemAndGroup(itemId, denseVectorIndexGroupId);
  //         if (existingChunks.length > 0) {
  //           logger.info(
  //             `Chunks already exist for item ${itemId} in group ${denseVectorIndexGroupId}, skipping processing`,
  //           );
  //           return;
  //         }
  //       }
  //     }

  //     // Chunk the markdown content
  //     let chunkResults: ChunkResult[] | string[];
  //     if (chunkingStrategy === ChunkingStrategy.H1) {
  //       chunkResults = h1Chunking(markdownContent);
  //     } else {
  //       chunkResults = paragraphChunking(markdownContent);
  //     }

  //     if (chunkResults.length === 0) {
  //       logger.warn(`No chunks generated for item: ${itemId}`);
  //       return;
  //     }

  //     logger.info(
  //       `Generated ${chunkResults.length} chunks for item: ${itemId}`,
  //     );

  //     // Prepare chunks for storage
  //     const chunks: ItemChunk[] = [];
  //     const chunkTexts: string[] = [];

  //     const processingStartTime = new Date();

  //     // The effective configurations are already set above
  //     const effectiveChunkingConfig = chunkingConfig;
  //     const effectiveEmbeddingConfig = embeddingConfig;

  //     for (let i = 0; i < chunkResults.length; i++) {
  //       const chunkResult = chunkResults[i];

  //       let title: string;
  //       let content: string;

  //       if (typeof chunkResult === 'string') {
  //         // Paragraph chunking
  //         title = `Paragraph ${i + 1}`;
  //         content = chunkResult;
  //       } else {
  //         // H1 chunking
  //         title = chunkResult.title || `Chunk ${i + 1}`;
  //         content = chunkResult.content;
  //       }

  //       const chunk: ItemChunk = {
  //         id: IdUtils.generateId(),
  //         itemId,
  //         title,
  //         content,
  //         index: i,

  //         // Dense vector index group for organization
  //         denseVectorIndexGroupId: denseVectorIndexGroupId,

  //         // Simplified single embedding field (will be populated after embedding generation)
  //         embedding: [], // Will be populated with a single vector array

  //         // Strategy and configuration metadata
  //         strategyMetadata: {
  //           chunkingStrategy,
  //           chunkingConfig: effectiveChunkingConfig,
  //           embeddingConfig: effectiveEmbeddingConfig,
  //           processingTimestamp: processingStartTime,
  //           processingDuration: 0, // Will be updated after processing
  //         },

  //         // Legacy metadata for backward compatibility
  //         metadata: {
  //           chunkType: chunkingStrategy,
  //           wordCount: content.split(/\s+/).length,
  //         },

  //         createdAt: new Date(),
  //         updatedAt: new Date(),
  //       };

  //       chunks.push(chunk);
  //       chunkTexts.push(content);
  //     }

  //     // Generate embeddings for all chunks
  //     logger.info(`Generating embeddings for ${chunkTexts.length} chunks`);
  //     const embeddings = await embeddingService.embedBatch(chunkTexts);

  //     const processingEndTime = new Date();
  //     const processingDuration =
  //       processingEndTime.getTime() - processingStartTime.getTime();

  //     // Assign embeddings to chunks using simplified structure
  //     for (let i = 0; i < chunks.length; i++) {
  //       if (embeddings[i] && Array.isArray(embeddings[i])) {
  //         // Update the embedding with simplified structure (single vector array)
  //         chunks[i].embedding = embeddings[i]!;

  //         // Update processing duration
  //         chunks[i].strategyMetadata.processingDuration = processingDuration;
  //       } else {
  //         logger.warn(`Invalid embedding for chunk ${i}, skipping`);
  //       }
  //     }

  //     // Save chunks to storage
  //     await this.storage.batchSaveChunks(chunks);
  //     logger.info(
  //       `Successfully saved ${chunks.length} chunks to storage for item: ${itemId}`,
  //     );
  //   } catch (error) {
  //     const errorMessage =
  //       error instanceof Error ? error.message : 'Unknown error';
  //     const errorStack = error instanceof Error ? error.stack : undefined;

  //     logger.error(`Error processing chunks for item ${itemId}:`, {
  //       error: errorMessage,
  //       stack: errorStack,
  //       itemId,
  //       chunkingStrategy,
  //       denseVectorIndexGroupId: options?.denseVectorIndexGroupId,
  //       embeddingProvider: options?.embeddingProvider,
  //     });

  //     // Update item status with error
  //     try {
  //       await this.updateProcessingStatus(
  //         itemId,
  //         PdfProcessingStatus.FAILED,
  //         `Chunking and embedding failed: ${errorMessage}`,
  //         undefined,
  //         errorMessage,
  //       );
  //     } catch (statusUpdateError) {
  //       logger.error(
  //         `Failed to update processing status for item ${itemId}:`,
  //         statusUpdateError,
  //       );
  //     }

  //     throw error;
  //   }
  // }

  /**
   * @deprecated
   * @param itemId
   * @param options
   * @returns
   */
  async getItemChunks(
    itemId: string,
    options?: {
      denseVectorIndexGroupId?: string;
      groups?: string[];
      chunkingStrategies?: string[];
      embeddingProviders?: string[];
    },
  ): Promise<ItemChunk[]> {
    // If no options specified, use legacy method
    if (!options) {
      return await this.storage.getChunksByItemId(itemId);
    }

    // Use storage if available
    if (
      options.denseVectorIndexGroupId &&
      typeof (this.storage as any).getChunksByItemAndGroup === 'function'
    ) {
      return await (this.storage as any).getChunksByItemAndGroup(
        itemId,
        options.denseVectorIndexGroupId,
      );
    }

    if (
      options.groups &&
      typeof (this.storage as any).getChunksByGroups === 'function'
    ) {
      return await (this.storage as any).getChunksByGroups(options.groups);
    }

    if (
      options.chunkingStrategies &&
      typeof (this.storage as any).getChunksByStrategy === 'function'
    ) {
      // For multiple strategies, we need to combine results
      const allChunks: ItemChunk[] = [];
      for (const strategy of options.chunkingStrategies) {
        const chunks = await (this.storage as any).getChunksByStrategy(
          strategy,
        );
        allChunks.push(...chunks.filter((chunk) => chunk.itemId === itemId));
      }
      return allChunks;
    }

    if (
      options.embeddingProviders &&
      typeof (this.storage as any).getChunksByProvider === 'function'
    ) {
      // For multiple providers, we need to combine results
      const allChunks: ItemChunk[] = [];
      for (const provider of options.embeddingProviders) {
        const chunks = await (this.storage as any).getChunksByProvider(
          provider,
        );
        allChunks.push(...chunks.filter((chunk) => chunk.itemId === itemId));
      }
      return allChunks;
    }

    // Fallback to legacy method
    return await this.storage.getChunksByItemId(itemId);
  }

  /**
   * @deprecated
   * @param filter
   * @returns
   */
  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]> {
    return await this.storage.searchChunks(filter);
  }

  // /**
  //  * @deprecated
  //  * @param queryVector
  //  * @param limit
  //  * @param threshold
  //  * @param itemIds
  //  * @param options
  //  * @returns
  //  */
  // async findSimilarChunks(
  //   queryVector: number[],
  //   limit: number = 10,
  //   threshold: number = 0.7,
  //   itemIds?: string[],
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //     provider?: string;
  //   },
  // ): Promise<Array<ItemChunk & { similarity: number }>> {
  //   // Handle fallback logic for strategy groups
  //   let denseVectorIndexGroupId = options?.denseVectorIndexGroupId;
  //   let groups = options?.groups;

  //   if (
  //     !denseVectorIndexGroupId &&
  //     !groups &&
  //     options?.chunkingStrategies &&
  //     options.chunkingStrategies.length > 0
  //   ) {
  //     // If no group specified but strategies are, try to get group from strategy
  //     const defaultGroupManager = DefaultGroupManager.getInstance();
  //     const strategy = options.chunkingStrategies[0]; // Use first strategy
  //     const group = defaultGroupManager.getDefaultGroup(strategy);
  //     if (group) {
  //       denseVectorIndexGroupId = group.id;
  //     }
  //   }

  //   // Create filter
  //   const filter: ChunkSearchFilter = {
  //     limit,
  //     similarityThreshold: threshold,
  //     itemIds: itemIds
  //       ? Array.isArray(itemIds)
  //         ? itemIds
  //         : [itemIds]
  //       : undefined,
  //     denseVectorIndexGroupId,
  //     groups,
  //     chunkingStrategies: options?.chunkingStrategies,
  //     embeddingProviders: options?.embeddingProviders,
  //   };

  //   // Use the enhanced findSimilarChunksWithFilter method if available
  //   if (
  //     typeof (this.storage as any).findSimilarChunksWithFilter === 'function'
  //   ) {
  //     return await (this.storage as any).findSimilarChunksWithFilter(
  //       queryVector,
  //       filter,
  //       options?.provider,
  //     );
  //   }

  //   // Fallback to legacy method
  //   return await this.storage.findSimilarChunks(
  //     queryVector,
  //     limit,
  //     threshold,
  //     itemIds,
  //   );
  // }

  // /**
  //  * @deprecated
  //  * @param itemId
  //  * @param queryVector
  //  * @param limit
  //  * @param threshold
  //  * @param options
  //  * @returns
  //  */
  // async findSimilarChunksInItem(
  //   itemId: string,
  //   queryVector: number[],
  //   limit: number = 10,
  //   threshold: number = 0.7,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //     provider?: string;
  //   },
  // ): Promise<Array<ItemChunk & { similarity: number }>> {
  //   return await this.findSimilarChunks(
  //     queryVector,
  //     limit,
  //     threshold,
  //     [itemId],
  //     options,
  //   );
  // }

  // /**
  //  * @deprecated
  //  * @param itemId
  //  * @param query
  //  * @param limit
  //  * @param options
  //  * @returns
  //  */
  // async searchChunksInItem(
  //   itemId: string,
  //   query: string,
  //   limit: number = 10,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     groups?: string[];
  //     chunkingStrategies?: string[];
  //     embeddingProviders?: string[];
  //   },
  // ): Promise<ItemChunk[]> {
  //   return await this.searchChunks({
  //     query,
  //     itemId,
  //     limit,
  //     denseVectorIndexGroupId: options?.denseVectorIndexGroupId,
  //     groups: options?.groups,
  //     chunkingStrategies: options?.chunkingStrategies,
  //     embeddingProviders: options?.embeddingProviders,
  //   });
  // }

  // /**
  //  * Advanced search with enhanced filtering and sorting capabilities
  //  * @deprecated
  //  */
  // async searchChunksAdvanced(
  //   filter: ChunkSearchFilter,
  //   options?: {
  //     groupPriorities?: Record<string, number>;
  //     strategyWeights?: Record<string, number>;
  //     providerPreferences?: Record<string, number>;
  //     deduplicate?: boolean;
  //     deduplicationThreshold?: number;
  //     sortBy?: 'relevance' | 'date' | 'title' | 'group' | 'similarity';
  //     sortOrder?: 'asc' | 'desc';
  //     rankFusion?: boolean;
  //     weights?: Record<string, number>;
  //     maxResultsPerGroup?: number;
  //   },
  // ): Promise<ItemChunk[]> {
  //   // Validate parameters
  //   ChunkingErrorHandler.validateParams(
  //     { filter, options },
  //     'searchChunksAdvanced',
  //     ['filter'],
  //   );

  //   const startTime = Date.now();

  //   return ChunkingErrorHandler.withRetry(
  //     async () => {
  //       // Get initial results from storage
  //       let chunks: ItemChunk[];

  //       if (filter.query || Object.keys(filter).length > 1) {
  //         // Use storage search for complex queries
  //         chunks = await this.storage.searchChunks(filter);
  //       } else {
  //         // For simple queries, get all chunks and filter locally
  //         chunks = await this.storage.getChunksByItemId(filter.itemId || '');
  //       }

  //       // Apply advanced filtering using ChunkSearchUtils
  //       const filteredChunks = ChunkSearchUtils.applyAdvancedFiltering(
  //         chunks,
  //         filter,
  //         options,
  //       );

  //       logger.info(`Advanced search returned ${filteredChunks.length} chunks`);
  //       return filteredChunks;
  //     },
  //     {
  //       operation: 'searchChunksAdvanced',
  //       maxRetries: 2,
  //     },
  //   )
  //     .catch((error) => {
  //       return ChunkingErrorHandler.handleSearchError(
  //         error,
  //         {
  //           operation: 'searchChunksAdvanced',
  //           query: filter.query,
  //           filter,
  //         },
  //         () => [], // Return empty results as fallback
  //       );
  //     })
  //     .finally(() => {
  //       // Log performance metrics
  //       ChunkingErrorHandler.logPerformance('searchChunksAdvanced', startTime, {
  //         itemId: filter.itemId,
  //         chunkCount: options?.maxResultsPerGroup,
  //       });
  //     });
  // }

  // /**
  //  * Find similar chunks with advanced filtering and rank fusion
  //  * @deprecated
  //  */
  // async findSimilarChunksAdvanced(
  //   queryVector: number[],
  //   filter: ChunkSearchFilter,
  //   options?: {
  //     groupPriorities?: Record<string, number>;
  //     strategyWeights?: Record<string, number>;
  //     providerPreferences?: Record<string, number>;
  //     deduplicate?: boolean;
  //     deduplicationThreshold?: number;
  //     sortBy?: 'relevance' | 'date' | 'title' | 'group' | 'similarity';
  //     sortOrder?: 'asc' | 'desc';
  //     rankFusion?: boolean;
  //     weights?: Record<string, number>;
  //     maxResultsPerGroup?: number;
  //     provider?: string;
  //   },
  // ): Promise<Array<ItemChunk & { similarity: number }>> {
  //   // Validate parameters
  //   ChunkingErrorHandler.validateParams(
  //     { queryVector, filter, options },
  //     'findSimilarChunksAdvanced',
  //     ['queryVector', 'filter'],
  //   );

  //   const startTime = Date.now();

  //   return ChunkingErrorHandler.withRetry(
  //     async () => {
  //       // Use enhanced findSimilarChunksWithFilter method if available
  //       if (
  //         typeof (this.storage as any).findSimilarChunksWithFilter ===
  //         'function'
  //       ) {
  //         const results = await (
  //           this.storage as any
  //         ).findSimilarChunksWithFilter(
  //           queryVector,
  //           filter,
  //           options?.provider,
  //           {
  //             rankFusion: options?.rankFusion,
  //             weights: options?.weights,
  //             maxResultsPerGroup: options?.maxResultsPerGroup,
  //           },
  //         );

  //         // Apply advanced filtering using ChunkSearchUtils
  //         const filteredResults = ChunkSearchUtils.applyAdvancedFiltering(
  //           results,
  //           filter,
  //           options,
  //         );

  //         logger.info(
  //           `Advanced similarity search returned ${filteredResults.length} chunks`,
  //         );
  //         return filteredResults as Array<ItemChunk & { similarity: number }>;
  //       }

  //       // Fallback to legacy method
  //       return await this.findSimilarChunks(
  //         queryVector,
  //         filter.limit,
  //         filter.similarityThreshold,
  //         filter.itemIds,
  //         {
  //           denseVectorIndexGroupId: filter.denseVectorIndexGroupId,
  //           groups: filter.groups,
  //           chunkingStrategies: filter.chunkingStrategies,
  //           embeddingProviders: filter.embeddingProviders,
  //           provider: options?.provider,
  //         },
  //       );
  //     },
  //     {
  //       operation: 'findSimilarChunksAdvanced',
  //       maxRetries: 2,
  //     },
  //   )
  //     .catch((error) => {
  //       return ChunkingErrorHandler.handleSearchError(
  //         error,
  //         {
  //           operation: 'findSimilarChunksAdvanced',
  //           filter,
  //         },
  //         () => [], // Return empty results as fallback
  //       );
  //     })
  //     .finally(() => {
  //       // Log performance metrics
  //       ChunkingErrorHandler.logPerformance(
  //         'findSimilarChunksAdvanced',
  //         startTime,
  //         {
  //           itemId: filter.itemId,
  //           chunkCount: options?.maxResultsPerGroup,
  //           provider: options?.provider,
  //         },
  //       );
  //     });
  // }

  // async reProcessChunks(
  //   itemId?: string,
  //   chunkingStrategy: ChunkingStrategy = ChunkingStrategy.H1,
  //   options?: {
  //     denseVectorIndexGroupId?: string;
  //     embeddingProvider?: string;
  //     embeddingConfig?: EmbeddingConfig;
  //     chunkingConfig?: ChunkingConfig;
  //     forceReprocess?: boolean;
  //     preserveExisting?: boolean;
  //   },
  // ): Promise<void> {
  //   try {
  //     // Set forceReprocess to true by default for re-processing
  //     const reProcessOptions = {
  //       ...options,
  //       forceReprocess: true,
  //     };

  //     if (itemId) {
  //       // Re-process chunks for a specific item
  //       logger.info(`Re-processing chunks for item: ${itemId}`);
  //       await this.processItemChunks(
  //         itemId,
  //         chunkingStrategy,
  //         reProcessOptions,
  //       );
  //       logger.info(`Successfully re-processed chunks for item: ${itemId}`);
  //     } else {
  //       // Re-process chunks for all items that have markdown content
  //       logger.info(
  //         'Re-processing chunks for all items with markdown content...',
  //       );

  //       // Get all items
  //       const allItems = await this.searchItems({});

  //       for (const item of allItems) {
  //         try {
  //           const markdownContent = await item.getMarkdown();
  //           if (markdownContent) {
  //             logger.info(`Re-processing chunks for item: ${item.metadata.id}`);
  //             await this.processItemChunks(
  //               item.metadata.id!,
  //               chunkingStrategy,
  //               reProcessOptions,
  //             );
  //             logger.info(
  //               `Successfully re-processed chunks for item: ${item.metadata.id}`,
  //             );
  //           }
  //         } catch (error) {
  //           logger.error(
  //             `Failed to re-process chunks for item ${item.metadata.id}:`,
  //             error,
  //           );
  //           // Continue with other items even if one fails
  //         }
  //       }

  //       logger.info('Completed re-processing of chunks for all items');
  //     }
  //   } catch (error) {
  //     logger.error('Error in reProcessChunks:', error);
  //     throw error;
  //   }
  // }
}

interface AbstractPdf {
  id: string;
  name: string;
  s3Key: string;
  url: string;
  fileSize?: number;
  createDate: Date;
}

export interface AbstractLibraryStorage {
  uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf>;
  uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf>;
  getPdfDownloadUrl(s3Key: string): Promise<string>;
  getPdf(s3Key: string): Promise<Buffer>;
  saveMetadata(metadata: BookMetadata): Promise<BookMetadata & { id: string }>;
  getMetadata(id: string): Promise<BookMetadata | null>;
  getMetadataByHash(contentHash: string): Promise<BookMetadata | null>;
  updateMetadata(metadata: BookMetadata): Promise<void>;
  searchMetadata(filter: SearchFilter): Promise<BookMetadata[]>;
  saveCollection(collection: Collection): Promise<Collection>;
  getCollections(): Promise<Collection[]>;
  addItemToCollection(itemId: string, collectionId: string): Promise<void>;
  removeItemFromCollection(itemId: string, collectionId: string): Promise<void>;
  saveCitation(citation: Citation): Promise<Citation>;
  getCitations(itemId: string): Promise<Citation[]>;
  saveMarkdown(itemId: string, markdownContent: string): Promise<void>;
  getMarkdown(itemId: string): Promise<string | null>;
  deleteMarkdown(itemId: string): Promise<boolean>;
  deleteMetadata(id: string): Promise<boolean>;
  deleteCollection(id: string): Promise<boolean>;
  deleteCitations(itemId: string): Promise<boolean>;

  // Chunk-related methods
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
}

export class S3MongoLibraryStorage implements AbstractLibraryStorage {
  private pdfCollection = 'library_pdfs';
  private metadataCollection = 'library_metadata';
  private collectionsCollection = 'library_collections';
  private citationsCollection = 'library_citations';
  private chunksCollection = 'library_chunks';

  constructor() {
    this.ensureIndexes();
  }

  /**
   * Ensure database indexes for better performance
   */
  private async ensureIndexes(): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.metadataCollection);

      // Create index on contentHash for fast duplicate detection
      await collection.createIndex(
        { contentHash: 1 },
        { unique: false, sparse: true },
      );

      // Create text index on title for text search
      await collection.createIndex({ title: 'text' });

      // Create index on authors.lastName for author-based searches (using wildcard for array)
      await collection.createIndex({ 'authors.lastName': 1 });

      // Create compound index on title and publicationYear for common searches
      await collection.createIndex({ title: 1, publicationYear: -1 });

      // Create indexes for chunks collection
      const chunksCollection = db.collection(this.chunksCollection);
      await chunksCollection.createIndex({ itemId: 1 });
      await chunksCollection.createIndex({ 'metadata.chunkType': 1 });
      await chunksCollection.createIndex({ itemId: 1, index: 1 });
      await chunksCollection.createIndex({ content: 'text' });

      logger.info('Library storage indexes created successfully');
    } catch (error) {
      logger.warn('Failed to create library storage indexes:', error);
    }
  }

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadToS3(pdfData, s3Key, 'application/pdf');

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date(),
    };
    const { db } = await connectToDatabase();
    // Save to database
    await db.collection(this.pdfCollection).insertOne(pdfInfo);
    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fileName = path.basename(pdfPath);
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadPdfFromPath(pdfPath, s3Key);

    const stats = fs.statSync(pdfPath);

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date(),
    };

    // Save to database
    const { db } = await connectToDatabase();
    await db.collection(this.pdfCollection).insertOne(pdfInfo);
    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    // In a real implementation, you would generate a presigned URL
    // For now, return the stored URL
    const { db } = await connectToDatabase();
    const pdfInfo = await db.collection(this.pdfCollection).findOne({ s3Key });
    if (!pdfInfo) {
      throw new Error(`PDF with S3 key ${s3Key} not found`);
    }

    const url = await getSignedUrlForDownload(
      process.env.PDF_OSS_BUCKET_NAME as string,
      s3Key,
    );
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(
    metadata: BookMetadata,
  ): Promise<BookMetadata & { id: string }> {
    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: metadata.id }, { $set: metadata }, { upsert: true });

    return metadata as BookMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection<BookMetadata>(this.metadataCollection)
      .findOne({ id });
    return (metadata as BookMetadata) || null;
  }

  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection<BookMetadata>(this.metadataCollection)
      .findOne({ contentHash });
    return (metadata as BookMetadata) || null;
  }

  async updateMetadata(metadata: BookMetadata): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: metadata.id }, { $set: metadata });
  }

  async searchMetadata(filter: SearchFilter): Promise<BookMetadata[]> {
    const query: any = {};

    if (filter.query) {
      query.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { abstract: { $regex: filter.query, $options: 'i' } },
        { notes: { $regex: filter.query, $options: 'i' } },
        { contentHash: { $regex: filter.query, $options: 'i' } },
      ];
    }

    if (filter.tags && filter.tags.length > 0) {
      query.tags = { $in: filter.tags };
    }

    if (filter.collections && filter.collections.length > 0) {
      query.collections = { $in: filter.collections };
    }

    if (filter.authors && filter.authors.length > 0) {
      query['authors.lastName'] = { $in: filter.authors };
    }

    if (filter.dateRange) {
      query.publicationYear = {
        $gte: filter.dateRange.start.getFullYear(),
        $lte: filter.dateRange.end.getFullYear(),
      };
    }

    if (filter.fileType && filter.fileType.length > 0) {
      query.fileType = { $in: filter.fileType };
    }
    const { db } = await connectToDatabase();
    const results = await db
      .collection<BookMetadata>(this.metadataCollection)
      .find(query)
      .toArray();
    return results as BookMetadata[];
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    if (!collection.id) {
      collection.id = IdUtils.generateId();
    }
    const { db } = await connectToDatabase();
    await db
      .collection(this.collectionsCollection)
      .updateOne({ id: collection.id }, { $set: collection }, { upsert: true });

    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    const { db } = await connectToDatabase();
    const results = await db
      .collection<Collection>(this.collectionsCollection)
      .find({})
      .toArray();
    return results as Collection[];
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne({ id: itemId }, { $addToSet: { collections: collectionId } });
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    const { db } = await connectToDatabase();
    await db.collection(this.metadataCollection).updateOne({ id: itemId }, {
      $pull: { collections: collectionId },
    } as any);
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.citationsCollection)
      .updateOne({ id: citation.id }, { $set: citation }, { upsert: true });

    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    const { db } = await connectToDatabase();
    const results = await db
      .collection<Citation>(this.citationsCollection)
      .find({ itemId })
      .toArray();
    return results as Citation[];
  }

  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    const { db } = await connectToDatabase();
    await db
      .collection(this.metadataCollection)
      .updateOne(
        { id: itemId },
        { $set: { markdownContent, markdownUpdatedDate: new Date() } },
      );
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    const { db } = await connectToDatabase();
    const metadata = await db
      .collection(this.metadataCollection)
      .findOne({ id: itemId }, { projection: { markdownContent: 1 } });
    return metadata?.markdownContent || null;
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db.collection(this.metadataCollection).updateOne(
      { id: itemId },
      {
        $unset: { markdownContent: 1, markdownUpdatedDate: 1 },
        $set: { dateModified: new Date() },
      },
    );

    return result.modifiedCount > 0;
  }

  async deleteMetadata(id: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.metadataCollection)
      .deleteOne({ id });

    // Also delete associated citations
    await this.deleteCitations(id);

    return result.deletedCount > 0;
  }

  async deleteCollection(id: string): Promise<boolean> {
    const { db } = await connectToDatabase();

    // First, remove this collection from all items
    await db
      .collection(this.metadataCollection)
      .updateMany({ collections: id }, {
        $pull: { collections: { $in: [id] } },
      } as any);

    // Then delete the collection
    const result = await db
      .collection(this.collectionsCollection)
      .deleteOne({ id });

    return result.deletedCount > 0;
  }

  async deleteCitations(itemId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.citationsCollection)
      .deleteMany({ itemId });

    return result.deletedCount > 0;
  }

  // Chunk-related methods implementation (MongoDB version)
  async saveChunk(chunk: ItemChunk): Promise<ItemChunk> {
    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    const { db } = await connectToDatabase();
    await db
      .collection(this.chunksCollection)
      .updateOne({ id: chunk.id }, { $set: chunk }, { upsert: true });

    return chunk;
  }

  async getChunk(chunkId: string): Promise<ItemChunk | null> {
    const { db } = await connectToDatabase();
    const chunk = await db
      .collection<ItemChunk>(this.chunksCollection)
      .findOne({ id: chunkId });
    return chunk || null;
  }

  async getChunksByItemId(itemId: string): Promise<ItemChunk[]> {
    const { db } = await connectToDatabase();
    const chunks = await db
      .collection<ItemChunk>(this.chunksCollection)
      .find({ itemId })
      .sort({ index: 1 })
      .toArray();
    return chunks;
  }

  async updateChunk(chunk: ItemChunk): Promise<void> {
    const { db } = await connectToDatabase();
    await db.collection(this.chunksCollection).updateOne(
      { id: chunk.id },
      {
        $set: {
          ...chunk,
          updatedAt: new Date(),
        },
      },
    );
  }

  async deleteChunk(chunkId: string): Promise<boolean> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.chunksCollection)
      .deleteOne({ id: chunkId });
    return result.deletedCount > 0;
  }

  async deleteChunksByItemId(itemId: string): Promise<number> {
    const { db } = await connectToDatabase();
    const result = await db
      .collection(this.chunksCollection)
      .deleteMany({ itemId });
    return result.deletedCount;
  }

  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]> {
    const { db } = await connectToDatabase();
    const query: any = {};

    if (filter.query) {
      query.$or = [
        { title: { $regex: filter.query, $options: 'i' } },
        { content: { $regex: filter.query, $options: 'i' } },
      ];
    }

    if (filter.itemId) {
      query.itemId = filter.itemId;
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      query.itemId = { $in: filter.itemIds };
    }

    if (filter.chunkType) {
      query['metadata.chunkType'] = filter.chunkType;
    }

    const chunks = await db
      .collection<ItemChunk>(this.chunksCollection)
      .find(query)
      .limit(filter.limit || 100)
      .toArray();
    return chunks;
  }

  async findSimilarChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    itemIds?: string[],
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    // MongoDB doesn't have native vector similarity search like Elasticsearch
    // This is a simplified implementation that would need to be enhanced
    // with a proper vector search solution (e.g., MongoDB Atlas Vector Search)

    const query: any = {};
    if (itemIds && itemIds.length > 0) {
      query.itemId = { $in: itemIds };
    }

    const { db } = await connectToDatabase();
    const chunks = await db
      .collection<ItemChunk>(this.chunksCollection)
      .find(query)
      .limit(limit)
      .toArray();

    // Calculate cosine similarity manually (this is inefficient and should be replaced with proper vector search)
    const similarChunks: Array<ItemChunk & { similarity: number }> = [];

    for (const chunk of chunks) {
      // Check for simplified embedding structure
      if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
        continue;
      }

      // Simple cosine similarity calculation
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < queryVector.length; i++) {
        dotProduct += queryVector[i] * (chunk.embedding[i] || 0);
        normA += queryVector[i] * queryVector[i];
        normB += (chunk.embedding[i] || 0) * (chunk.embedding[i] || 0);
      }

      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

      if (similarity >= threshold) {
        similarChunks.push({
          ...chunk,
          similarity,
        });
      }
    }

    // Sort by similarity and limit
    similarChunks.sort((a, b) => b.similarity - a.similarity);
    return similarChunks.slice(0, limit);
  }

  async batchSaveChunks(chunks: ItemChunk[]): Promise<void> {
    const { db } = await connectToDatabase();

    // Ensure all chunks have IDs
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
    }

    const bulkOps = chunks.map((chunk) => ({
      updateOne: {
        filter: { id: chunk.id },
        update: { $set: chunk },
        upsert: true,
      },
    }));

    await db.collection(this.chunksCollection).bulkWrite(bulkOps);
  }
}

export class S3ElasticSearchLibraryStorage implements AbstractLibraryStorage {
  private readonly metadataIndexName = 'library_metadata';
  private readonly collectionsIndexName = 'library_collections';
  private readonly citationsIndexName = 'library_citations';
  private readonly chunksIndexName = 'library_chunks';
  private client: Client;
  private isInitialized = false;
  private vectorDimensions: number;

  logger = createLoggerWithPrefix('S3ElasticSearchLibraryStorage');

  // Performance optimization caches
  private searchCache: Map<string, { results: any; timestamp: number }> =
    new Map();
  private groupCache: Map<string, string[]> = new Map();
  private itemCache: Map<string, any> = new Map();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 1000;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    elasticsearchUrl: string = 'http://elasticsearch:9200',
    vectorDimensions: number = 1536,
  ) {
    this.vectorDimensions = vectorDimensions;
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });

    // Start periodic cache cleanup
    this.startCacheCleanup();

    // Don't initialize indexes in constructor to avoid blocking
    // Initialize lazily when first operation is called
  }

  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, this.cacheTtlMs);
  }

  /**
   * Stop periodic cache cleanup
   */
  private stopCacheCleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.cacheTtlMs;
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredCache(): void {
    const now = Date.now();

    // Clean search cache
    for (const [key, entry] of this.searchCache.entries()) {
      if (this.isCacheExpired(entry.timestamp)) {
        this.searchCache.delete(key);
      }
    }

    // Clean group cache
    for (const [key] of this.groupCache.entries()) {
      // Group cache entries don't have timestamps, use a simple size limit
      if (this.groupCache.size > this.maxCacheSize) {
        this.groupCache.delete(key);
      }
    }

    // Clean item cache
    for (const [key, entry] of this.itemCache.entries()) {
      if (this.isCacheExpired(entry.timestamp)) {
        this.itemCache.delete(key);
      }
    }
  }

  /**
   * Generate cache key for search requests - updated for simplified embedding structure
   */
  private generateSearchCacheKey(
    filter: ChunkSearchFilter,
    queryVector?: number[],
  ): string {
    const keyParts = [
      filter.query || '',
      filter.itemId || '',
      filter.denseVectorIndexGroupId || '',
      filter.limit?.toString() || '10',
      filter.similarityThreshold?.toString() || '0.7',
      (filter.groups || []).join(','),
      (filter.chunkingStrategies || []).join(','),
      (filter.embeddingProviders || []).join(','),
      'simplified-embed-v1', // Version identifier for simplified embedding structure
    ];

    if (queryVector) {
      // Use first few dimensions of vector for cache key (for privacy and performance)
      keyParts.push(queryVector.slice(0, 5).join(','));
    }

    return keyParts.join('|');
  }

  /**
   * Get cached search results - updated for simplified embedding structure
   */
  private getCachedSearchResults(cacheKey: string): any | null {
    const entry = this.searchCache.get(cacheKey);
    if (entry && !this.isCacheExpired(entry.timestamp)) {
      // Validate that cached results have simplified embedding structure
      if (Array.isArray(entry.results)) {
        const hasValidStructure = entry.results.every(
          (result: any) =>
            result && (!result.embedding || Array.isArray(result.embedding)),
        );

        if (hasValidStructure) {
          this.logger.debug(`Cache hit for search key: ${cacheKey}`);
          return entry.results;
        } else {
          // Invalid structure in cache, delete and return null
          this.logger.debug(
            `Cache hit but invalid structure for key: ${cacheKey}, invalidating`,
          );
          this.searchCache.delete(cacheKey);
        }
      }
    }

    if (entry) {
      this.searchCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache search results - updated for simplified embedding structure
   */
  private cacheSearchResults(cacheKey: string, results: any): void {
    // Validate results have simplified embedding structure before caching
    if (Array.isArray(results)) {
      const hasValidStructure = results.every(
        (result: any) =>
          result && (!result.embedding || Array.isArray(result.embedding)),
      );

      if (!hasValidStructure) {
        this.logger.debug(
          `Not caching results with invalid embedding structure for key: ${cacheKey}`,
        );
        return;
      }
    }

    // Clean cache if it's getting too large
    if (this.searchCache.size >= this.maxCacheSize) {
      this.cleanExpiredCache();

      // If still too large, remove oldest entries
      if (this.searchCache.size >= this.maxCacheSize) {
        const keysToDelete = Array.from(this.searchCache.keys()).slice(0, 100);
        for (const key of keysToDelete) {
          this.searchCache.delete(key);
        }
      }
    }

    this.searchCache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    this.logger.debug(`Cached search results for key: ${cacheKey}`);
  }

  /**
   * Get cached item metadata
   */
  private getCachedItem(itemId: string): any | null {
    const entry = this.itemCache.get(itemId);
    if (entry && !this.isCacheExpired(entry.timestamp)) {
      return entry.data;
    }

    if (entry) {
      this.itemCache.delete(itemId);
    }

    return null;
  }

  /**
   * Cache item metadata
   */
  private cacheItem(itemId: string, data: any): void {
    // Clean cache if it's getting too large
    if (this.itemCache.size >= this.maxCacheSize) {
      this.cleanExpiredCache();

      // If still too large, remove oldest entries
      if (this.itemCache.size >= this.maxCacheSize) {
        const keysToDelete = Array.from(this.itemCache.keys()).slice(0, 100);
        for (const key of keysToDelete) {
          this.itemCache.delete(key);
        }
      }
    }

    this.itemCache.set(itemId, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache for a specific item
   */
  private invalidateItemCache(itemId: string): void {
    this.itemCache.delete(itemId);

    // Also invalidate any search results that might include this item
    for (const [key, entry] of this.searchCache.entries()) {
      // Simple heuristic: if the cache key contains the item ID, invalidate it
      if (key.includes(itemId)) {
        this.searchCache.delete(key);
      }
    }

    // Invalidate group cache as it might be affected
    this.groupCache.clear();

    this.logger.debug(`Invalidated cache for item: ${itemId}`);
  }

  /**
   * Initialize the indexes with proper mappings
   */
  private async ensureIndexes(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if Elasticsearch is available
      await this.client.ping();
      // this.logger.info('Connected to Elasticsearch');

      // Initialize metadata index
      const metadataExists = await this.client.indices.exists({
        index: this.metadataIndexName,
      });

      if (!metadataExists) {
        await this.client.indices.create({
          index: this.metadataIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              title: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              authors: {
                type: 'nested',
                properties: {
                  firstName: { type: 'text' },
                  lastName: {
                    type: 'text',
                    fields: { keyword: { type: 'keyword' } },
                  },
                  middleName: { type: 'text' },
                },
              },
              abstract: { type: 'text' },
              publicationYear: { type: 'integer' },
              publisher: { type: 'text' },
              isbn: { type: 'keyword' },
              doi: { type: 'keyword' },
              url: { type: 'keyword' },
              tags: { type: 'keyword' },
              notes: { type: 'text' },
              collections: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' },
              fileType: { type: 'keyword' },
              s3Key: { type: 'keyword' },
              s3Url: { type: 'keyword' },
              fileSize: { type: 'long' },
              pageCount: { type: 'integer' },
              language: { type: 'keyword' },
              contentHash: { type: 'keyword' },
            },
          },
        } as any);
        this.logger.info(`Created metadata index: ${this.metadataIndexName}`);
      }

      // Initialize collections index
      const collectionsExists = await this.client.indices.exists({
        index: this.collectionsIndexName,
      });

      if (!collectionsExists) {
        await this.client.indices.create({
          index: this.collectionsIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: { type: 'text' },
              parentCollectionId: { type: 'keyword' },
              dateAdded: { type: 'date' },
              dateModified: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(
          `Created collections index: ${this.collectionsIndexName}`,
        );
      }

      // Initialize citations index
      const citationsExists = await this.client.indices.exists({
        index: this.citationsIndexName,
      });

      if (!citationsExists) {
        await this.client.indices.create({
          index: this.citationsIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              itemId: { type: 'keyword' },
              citationStyle: { type: 'keyword' },
              citationText: { type: 'text' },
              dateGenerated: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(`Created citations index: ${this.citationsIndexName}`);
      }

      // Initialize chunks index
      const chunksExists = await this.client.indices.exists({
        index: this.chunksIndexName,
      });

      let needsToCreateChunksIndex = !chunksExists;

      // If index exists, check if vector dimensions match
      if (chunksExists) {
        try {
          const indexMapping = await this.client.indices.getMapping({
            index: this.chunksIndexName,
          });

          const currentDims = (
            indexMapping[this.chunksIndexName]?.mappings?.properties
              ?.embedding as any
          )?.dims;

          if (currentDims && currentDims !== this.vectorDimensions) {
            this.logger.warn(
              `Existing chunks index has ${currentDims} dimensions, but ${this.vectorDimensions} are required. Recreating index...`,
            );

            // Delete the existing index
            await this.client.indices.delete({
              index: this.chunksIndexName,
            });

            needsToCreateChunksIndex = true;
          }
        } catch (error) {
          this.logger.error('Error checking chunks index mapping:', error);
          // If we can't check the mapping, try to recreate the index
          needsToCreateChunksIndex = true;
        }
      }

      if (needsToCreateChunksIndex) {
        await this.client.indices.create({
          index: this.chunksIndexName,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              itemId: { type: 'keyword' },

              // Dense vector index group for organization
              denseVectorIndexGroupId: { type: 'keyword' },

              title: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              content: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              index: { type: 'integer' },

              // Single embedding field - simplified structure
              embedding: {
                type: 'dense_vector',
                dims: this.vectorDimensions,
                index: true,
                similarity: 'cosine',
              },

              // Strategy and configuration metadata
              strategyMetadata: {
                type: 'object',
                properties: {
                  chunkingStrategy: { type: 'keyword' },
                  chunkingConfig: { type: 'object' },
                  embeddingProvider: { type: 'keyword' },
                  embeddingConfig: { type: 'object' },
                  processingTimestamp: { type: 'date' },
                  processingDuration: { type: 'float' },
                },
              },

              // Legacy metadata for backward compatibility
              metadata: {
                type: 'object',
                properties: {
                  chunkType: { type: 'keyword' },
                  startPosition: { type: 'integer' },
                  endPosition: { type: 'integer' },
                  wordCount: { type: 'integer' },
                  chunkingConfig: { type: 'text' },
                },
              },

              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        } as any);
        this.logger.info(`Created chunks index: ${this.chunksIndexName}`);
      }
    } catch (error: any) {
      if (
        error?.meta?.body?.error?.type === 'resource_already_exists_exception'
      ) {
        this.logger.info('Indexes already exist, continuing');
        this.isInitialized = true;
        return;
      }
      if (error.meta?.statusCode === 0 || error.code === 'ECONNREFUSED') {
        this.logger.error(
          'Elasticsearch is not available. Please ensure Elasticsearch is running.',
        );
        throw new Error(
          'Elasticsearch is not available. Please check your configuration and ensure Elasticsearch is running.',
        );
      }
      this.logger.error('Failed to initialize indexes:', error);
      throw error;
    }
  }

  /**
   * Ensure indexes are initialized before performing operations
   */
  private async checkInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.ensureIndexes();
      this.isInitialized = true;
    }
  }

  async uploadPdf(pdfData: Buffer, fileName: string): Promise<AbstractPdf> {
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadToS3(pdfData, s3Key, 'application/pdf');

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: pdfData.length,
      createDate: new Date(),
    };

    return pdfInfo;
  }

  async uploadPdfFromPath(pdfPath: string): Promise<AbstractPdf> {
    const fileName = path.basename(pdfPath);
    const s3Key = `library/pdfs/${new Date().getFullYear()}/${Date.now()}-${fileName}`;
    const url = await uploadPdfFromPath(pdfPath, s3Key);

    const stats = fs.statSync(pdfPath);

    const pdfInfo: AbstractPdf = {
      id: IdUtils.generateId(),
      name: fileName,
      s3Key,
      url,
      fileSize: stats.size,
      createDate: new Date(),
    };

    return pdfInfo;
  }

  async getPdfDownloadUrl(s3Key: string): Promise<string> {
    const url = await getSignedUrlForDownload(
      process.env.PDF_OSS_BUCKET_NAME as string,
      s3Key,
    );
    return url;
  }

  async getPdf(s3Key: string): Promise<Buffer> {
    // This would download the PDF from S3
    // For now, throw an error as this is not implemented
    throw new Error('Direct PDF download not implemented');
  }

  async saveMetadata(
    metadata: BookMetadata,
  ): Promise<BookMetadata & { id: string }> {
    await this.checkInitialized();

    if (!metadata.id) {
      metadata.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.metadataIndexName,
      id: metadata.id,
      body: metadata,
      refresh: true, // Refresh index to make document immediately available
    } as any);

    return metadata as BookMetadata & { id: string };
  }

  async getMetadata(id: string): Promise<BookMetadata | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.metadataIndexName,
        id: id,
      });

      if (result.found) {
        return result._source as BookMetadata;
      }
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getMetadataByHash(contentHash: string): Promise<BookMetadata | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query: {
            term: {
              contentHash: contentHash,
            },
          },
        },
      } as any);

      const hits = result.hits.hits;
      if (hits.length > 0) {
        return hits[0]._source as BookMetadata;
      }
      return null;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return null;
      }
      throw error;
    }
  }

  async updateMetadata(metadata: BookMetadata): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.metadataIndexName,
      id: metadata.id!,
      body: {
        doc: metadata,
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async searchMetadata(filter: SearchFilter): Promise<BookMetadata[]> {
    await this.checkInitialized();

    const query: any = {};

    if (filter.query) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        multi_match: {
          query: filter.query,
          fields: ['title', 'abstract', 'notes'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (filter.tags && filter.tags.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          tags: filter.tags,
        },
      });
    }

    if (filter.collections && filter.collections.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          collections: filter.collections,
        },
      });
    }

    if (filter.authors && filter.authors.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        nested: {
          path: 'authors',
          query: {
            terms: {
              'authors.lastName': filter.authors,
            },
          },
        },
      });
    }

    if (filter.dateRange) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        range: {
          publicationYear: {
            gte: filter.dateRange.start.getFullYear(),
            lte: filter.dateRange.end.getFullYear(),
          },
        },
      });
    }

    if (filter.fileType && filter.fileType.length > 0) {
      query.bool = query.bool || { must: [] };
      query.bool.must.push({
        terms: {
          fileType: filter.fileType,
        },
      });
    }

    // If no filters specified, match all
    if (!query.bool) {
      query.match_all = {};
    }

    try {
      const result = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query,
          size: 10000, // Adjust based on expected results
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as BookMetadata);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async saveCollection(collection: Collection): Promise<Collection> {
    await this.checkInitialized();

    if (!collection.id) {
      collection.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.collectionsIndexName,
      id: collection.id,
      body: collection,
      refresh: true, // Refresh index to make collection immediately available
    } as any);

    return collection;
  }

  async getCollections(): Promise<Collection[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.collectionsIndexName,
        body: {
          query: {
            match_all: {},
          },
          size: 10000,
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as Collection);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async addItemToCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.checkInitialized();

    const metadata = await this.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    if (!metadata.collections.includes(collectionId)) {
      metadata.collections.push(collectionId);
      await this.updateMetadata(metadata);
    }
  }

  async removeItemFromCollection(
    itemId: string,
    collectionId: string,
  ): Promise<void> {
    await this.checkInitialized();

    const metadata = await this.getMetadata(itemId);
    if (!metadata) {
      throw new Error(`Item with ID ${itemId} not found`);
    }

    const index = metadata.collections.indexOf(collectionId);
    if (index > -1) {
      metadata.collections.splice(index, 1);
      await this.updateMetadata(metadata);
    }
  }

  async saveCitation(citation: Citation): Promise<Citation> {
    await this.checkInitialized();

    await this.client.index({
      index: this.citationsIndexName,
      id: citation.id,
      body: citation,
      refresh: true, // Refresh index to make citation immediately available
    } as any);

    return citation;
  }

  async getCitations(itemId: string): Promise<Citation[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.citationsIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as Citation);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async saveMarkdown(itemId: string, markdownContent: string): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.metadataIndexName,
      id: itemId,
      body: {
        doc: {
          markdownContent,
          markdownUpdatedDate: new Date(),
        },
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async getMarkdown(itemId: string): Promise<string | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.metadataIndexName,
        id: itemId,
        _source: ['markdownContent'],
      });

      if (result.found) {
        const source = result._source as any;
        return source?.markdownContent || null;
      }
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteMarkdown(itemId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.update({
        index: this.metadataIndexName,
        id: itemId,
        body: {
          script: {
            source: `
              ctx._source.remove('markdownContent');
              ctx._source.remove('markdownUpdatedDate');
              ctx._source.dateModified = params.dateModified;
            `,
            params: {
              dateModified: new Date().toISOString(),
            },
          },
        },
        refresh: true,
      } as any);

      return result.result === 'updated';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Document not found
      }
      throw error;
    }
  }

  async deleteMetadata(id: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      // Delete the metadata document
      const result = await this.client.delete({
        index: this.metadataIndexName,
        id: id,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      // Also delete associated citations
      await this.deleteCitations(id);

      return result.result === 'deleted';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Document not found
      }
      throw error;
    }
  }

  async deleteCollection(id: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      // First, remove this collection from all items
      const searchResult = await this.client.search({
        index: this.metadataIndexName,
        body: {
          query: {
            term: {
              collections: id,
            },
          },
          size: 10000, // Adjust based on expected number of items
        },
      } as any);

      // Update each item to remove the collection
      for (const hit of searchResult.hits.hits) {
        const metadata = hit._source as BookMetadata;
        const index = metadata.collections.indexOf(id);
        if (index > -1) {
          metadata.collections.splice(index, 1);
          await this.updateMetadata(metadata);
        }
      }

      // Then delete the collection
      const result = await this.client.delete({
        index: this.collectionsIndexName,
        id: id,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return result.result === 'deleted';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Collection not found
      }
      throw error;
    }
  }

  async deleteCitations(itemId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.deleteByQuery({
        index: this.citationsIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return (result.deleted || 0) > 0;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return false; // Index not found
      }
      throw error;
    }
  }

  // Chunk-related methods implementation
  async saveChunk(chunk: ItemChunk): Promise<ItemChunk> {
    await this.checkInitialized();

    if (!chunk.id) {
      chunk.id = IdUtils.generateId();
    }

    await this.client.index({
      index: this.chunksIndexName,
      id: chunk.id,
      body: chunk,
      refresh: true, // Refresh index to make chunk immediately available
    } as any);

    return chunk;
  }

  async getChunk(chunkId: string): Promise<ItemChunk | null> {
    await this.checkInitialized();

    try {
      const result = await this.client.get({
        index: this.chunksIndexName,
        id: chunkId,
      });

      if (result.found) {
        return result._source as ItemChunk;
      }
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getChunksByItemId(itemId: string): Promise<ItemChunk[]> {
    await this.checkInitialized();

    try {
      const result = await this.client.search({
        index: this.chunksIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
          sort: [{ index: { order: 'asc' } }],
          size: 10000, // Adjust based on expected number of chunks
        },
      } as any);

      const hits = result.hits.hits;
      return hits.map((hit) => hit._source as ItemChunk);
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  async updateChunk(chunk: ItemChunk): Promise<void> {
    await this.checkInitialized();

    await this.client.update({
      index: this.chunksIndexName,
      id: chunk.id!,
      body: {
        doc: {
          ...chunk,
          updatedAt: new Date(),
        },
      },
      refresh: true, // Refresh index to make update immediately available
    } as any);
  }

  async deleteChunk(chunkId: string): Promise<boolean> {
    await this.checkInitialized();

    try {
      const result = await this.client.delete({
        index: this.chunksIndexName,
        id: chunkId,
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return result.result === 'deleted';
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        return false; // Chunk not found
      }
      throw error;
    }
  }

  async deleteChunksByItemId(itemId: string): Promise<number> {
    await this.checkInitialized();

    try {
      const result = await this.client.deleteByQuery({
        index: this.chunksIndexName,
        body: {
          query: {
            term: {
              itemId: itemId,
            },
          },
        },
        refresh: true, // Refresh index to make deletion immediately available
      } as any);

      return result.deleted || 0;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return 0; // Index not found
      }
      throw error;
    }
  }

  // Implementation from AbstractLibraryStorage
  async findSimilarChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    itemIds?: string[],
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    const filter: ChunkSearchFilter = {
      limit,
      similarityThreshold: threshold,
      itemIds: itemIds
        ? Array.isArray(itemIds)
          ? itemIds
          : [itemIds]
        : undefined,
    };

    return this.findSimilarChunksWithFilter(queryVector, filter);
  }

  // Enhanced findSimilarChunks implementation
  async findSimilarChunksWithFilter(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: string,
    options?: {
      rankFusion?: boolean;
      weights?: Record<string, number>; // Group-specific weights
      maxResultsPerGroup?: number;
    },
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    await this.checkInitialized();

    // Check cache first
    const cacheKey = this.generateSearchCacheKey(filter, queryVector);
    const cachedResults = this.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    // Validate vector dimensions
    if (queryVector.length !== this.vectorDimensions) {
      throw new Error(
        `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${queryVector.length}`,
      );
    }

    // If rank fusion is requested and we have multiple groups, use rank fusion
    if (options?.rankFusion && filter.groups && filter.groups.length > 1) {
      const rankFusionResults = await this.findSimilarChunksWithRankFusion(
        queryVector,
        filter,
        provider,
        options,
      );

      return rankFusionResults.map((result) => ({
        ...result,
        similarity: result.similarity,
      }));
    }

    // Use the simplified embedding field
    const embeddingField = 'embedding';

    const must: any[] = [];
    const should: any[] = [];

    // Apply filters
    if (filter.itemId) {
      must.push({ term: { itemId: filter.itemId } });
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      must.push({ terms: { itemId: filter.itemIds } });
    }

    if (filter.denseVectorIndexGroupId) {
      must.push({
        term: { denseVectorIndexGroupId: filter.denseVectorIndexGroupId },
      });
    }

    if (filter.groups && filter.groups.length > 0) {
      must.push({ terms: { denseVectorIndexGroupId: filter.groups } });
    }

    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.chunkingStrategy': filter.chunkingStrategies,
        },
      });
    }

    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.embeddingProvider': filter.embeddingProviders,
        },
      });
    }

    // Date range filtering
    if (filter.dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: filter.dateRange.start.toISOString(),
            lte: filter.dateRange.end.toISOString(),
          },
        },
      });
    }

    // Build similarity search query using simplified embedding structure
    const similarityQuery = {
      script_score: {
        query: { match_all: {} },
        script: {
          source: `cosineSimilarity(params.query_vector, doc['${embeddingField}']) + 1.0`,
          params: {
            query_vector: queryVector,
          },
        },
      },
    };

    // If we have multiple groups, we might want to rank results by group
    if (filter.groups && filter.groups.length > 1) {
      // Add group-based scoring to prefer certain groups
      const weights = options?.weights || {};
      for (const group of filter.groups) {
        const groupWeight = weights[group] || 1.0;
        should.push({
          script_score: {
            query: { term: { denseVectorIndexGroupId: group } },
            script: {
              source: `(${groupWeight} * (cosineSimilarity(params.query_vector, doc['${embeddingField}']) + 1.0))`,
              params: {
                query_vector: queryVector,
              },
            },
          },
        });
      }
    } else {
      should.push(similarityQuery);
    }

    // Build query
    const query: any = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        should: should,
        minimum_should_match: 1,
      },
    };

    try {
      const result = await this.client.search({
        index: this.chunksIndexName,
        query,
        min_score: filter.similarityThreshold
          ? filter.similarityThreshold + 1
          : 0.5,
        size: filter.limit || 10,
        sort: [
          { _score: { order: 'desc' } },
          { denseVectorIndexGroupId: { order: 'asc' } },
          { index: { order: 'asc' } },
        ],
      });

      const hits = result.hits.hits;
      const results = hits
        .map((hit) => {
          const { _source, _score } = hit;
          const chunk = _source as ItemChunk;

          // Ensure the chunk has the simplified embedding structure
          if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
            this.logger.warn(
              `Chunk ${chunk.id} has invalid embedding structure`,
            );
            return null;
          }

          const similarity = (_score || 0) - 1; // Convert back from cosine similarity + 1

          return {
            ...chunk,
            similarity,
          };
        })
        .filter(
          (chunk) =>
            chunk !== null &&
            chunk.similarity >= (filter.similarityThreshold || 0),
        ) as Array<ItemChunk & { similarity: number }>;

      // Cache the results
      this.cacheSearchResults(cacheKey, results);

      return results;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Find similar chunks across multiple groups with rank fusion
   */
  private async findSimilarChunksWithRankFusion(
    queryVector: number[],
    filter: ChunkSearchFilter,
    provider?: string,
    options?: {
      weights?: Record<string, number>; // Group-specific weights
      maxResultsPerGroup?: number;
    },
  ): Promise<
    Array<ItemChunk & { similarity: number; rank: number; group: string }>
  > {
    const maxResultsPerGroup =
      options?.maxResultsPerGroup ||
      Math.ceil((filter.limit || 10) / filter.groups!.length);
    const weights = options?.weights || {};

    // Get results from each group
    const groupResults: Array<{
      group: string;
      chunks: Array<ItemChunk & { similarity: number }>;
    }> = [];

    for (const group of filter.groups!) {
      const groupFilter = {
        ...filter,
        groups: [group],
        limit: maxResultsPerGroup,
      };
      const chunks = await this.findSimilarChunksWithFilter(
        queryVector,
        groupFilter,
        provider,
        { rankFusion: false },
      );

      groupResults.push({
        group,
        chunks,
      });
    }

    // Perform rank fusion
    return this.performRankFusion(groupResults, weights);
  }

  /**
   * Perform rank fusion on results from multiple groups
   */
  private performRankFusion(
    groupResults: Array<{
      group: string;
      chunks: Array<ItemChunk & { similarity: number }>;
    }>,
    weights: Record<string, number>,
  ): Array<ItemChunk & { similarity: number; rank: number; group: string }> {
    const allResults: Array<{
      chunk: ItemChunk & { similarity: number };
      group: string;
      rank: number;
      weightedScore: number;
    }> = [];

    // Collect all results with their ranks and weighted scores
    for (const { group, chunks } of groupResults) {
      const groupWeight = weights[group] || 1.0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const rank = i + 1;

        // Calculate weighted score using reciprocal rank fusion
        const weightedScore = (chunk.similarity * groupWeight) / (rank + 60); // k=60 for RRF

        allResults.push({
          chunk,
          group,
          rank,
          weightedScore,
        });
      }
    }

    // Sort by weighted score (descending)
    allResults.sort((a, b) => b.weightedScore - a.weightedScore);

    // Remove duplicates (keep the highest scoring version)
    const seenChunks = new Set<string>();
    const finalResults: Array<
      ItemChunk & { similarity: number; rank: number; group: string }
    > = [];

    for (const { chunk, group, rank } of allResults) {
      const chunkKey = `${chunk.itemId}-${chunk.index}`;

      if (!seenChunks.has(chunkKey)) {
        seenChunks.add(chunkKey);
        finalResults.push({
          ...chunk,
          rank: finalResults.length + 1,
          group,
        });
      }
    }

    return finalResults;
  }

  async batchSaveChunks(chunks: ItemChunk[]): Promise<void> {
    const logger = createLoggerWithPrefix(
      'S3ElasticSearchLibraryStorage.batchSaveChunks',
    );
    await this.checkInitialized();

    logger.info(`Starting batch save for ${chunks.length} chunks`);

    // Ensure all chunks have IDs
    for (const chunk of chunks) {
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }
    }

    // Validate all embeddings have correct dimensions and simplified structure
    let embeddingsValid = true;
    for (const chunk of chunks) {
      if (!chunk.embedding) {
        logger.error(`Chunk ID ${chunk.id} has no embedding`);
        embeddingsValid = false;
        continue;
      }

      if (!Array.isArray(chunk.embedding)) {
        logger.error(
          `Chunk ID ${chunk.id} has invalid embedding structure (not an array)`,
        );
        embeddingsValid = false;
        continue;
      }

      if (chunk.embedding.length !== this.vectorDimensions) {
        logger.error(
          `Vector dimensions mismatch for chunk ID ${chunk.id}. Expected: ${this.vectorDimensions}, Got: ${chunk.embedding.length}`,
        );
        embeddingsValid = false;
      }
    }

    if (!embeddingsValid) {
      throw new Error(
        `Vector validation failed. Expected: ${this.vectorDimensions} dimensions, simplified array structure`,
      );
    }

    // Log chunk details before saving
    chunks.forEach((chunk, index) => {
      logger.debug(
        `Chunk ${index}: id=${chunk.id}, itemId=${chunk.itemId}, hasEmbedding=${!!chunk.embedding}, embeddingLength=${chunk.embedding?.length || 0}`,
      );
    });

    const body = chunks.flatMap((chunk) => [
      { index: { _index: this.chunksIndexName, _id: chunk.id } },
      chunk,
    ]);

    logger.info(`Executing bulk operation on index: ${this.chunksIndexName}`);
    const bulkResponse = await this.client.bulk({
      body,
      refresh: true, // Refresh index to make chunks immediately available
    });

    // Check for errors in bulk response
    if ((bulkResponse as any).errors) {
      logger.error(
        'Bulk operation had errors:',
        (bulkResponse as any).items?.filter((item: any) => item.index?.error),
      );
    } else {
      logger.info(`Bulk operation completed successfully`);
    }

    logger.info(
      `Batch saved ${chunks.length} chunks to index: ${this.chunksIndexName}`,
    );
  }

  // Enhanced storage implementation methods

  /**
   * Store chunks
   */
  async storeChunks(chunks: ItemChunk[]): Promise<void> {
    return this.batchSaveChunks(chunks);
  }

  /**
   * Get chunks for a specific item and group
   */
  async getChunksByItemAndGroup(
    itemId: string,
    groupId: string,
  ): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        bool: {
          must: [
            { term: { itemId } },
            { term: { denseVectorIndexGroupId: groupId } },
          ],
        },
      },
      sort: [{ index: { order: 'asc' } }],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks for a specific item across all groups
   */
  async getChunksByItem(itemId: string): Promise<ItemChunk[]> {
    return this.getChunksByItemId(itemId);
  }

  /**
   * Search chunks with filtering support
   */
  async searchChunks(filter: ChunkSearchFilter): Promise<ItemChunk[]> {
    await this.checkInitialized();

    // Check cache first
    const cacheKey = this.generateSearchCacheKey(filter);
    const cachedResults = this.getCachedSearchResults(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    const must: any[] = [];
    const should: any[] = [];

    // Basic text search
    if (filter.query) {
      must.push({
        multi_match: {
          query: filter.query,
          fields: ['title^2', 'content'],
          type: 'best_fields',
        },
      });
    }

    // Item filtering
    if (filter.itemId) {
      must.push({ term: { itemId: filter.itemId } });
    }

    if (filter.itemIds && filter.itemIds.length > 0) {
      must.push({ terms: { itemId: filter.itemIds } });
    }

    // Group filtering
    if (filter.denseVectorIndexGroupId) {
      must.push({
        term: { denseVectorIndexGroupId: filter.denseVectorIndexGroupId },
      });
    }

    if (filter.groups && filter.groups.length > 0) {
      must.push({ terms: { denseVectorIndexGroupId: filter.groups } });
    }

    // Strategy filtering
    if (filter.chunkingStrategies && filter.chunkingStrategies.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.chunkingStrategy': filter.chunkingStrategies,
        },
      });
    }

    // Provider filtering
    if (filter.embeddingProviders && filter.embeddingProviders.length > 0) {
      must.push({
        terms: {
          'strategyMetadata.embeddingProvider': filter.embeddingProviders,
        },
      });
    }

    // Legacy chunk type filtering
    if (filter.chunkType) {
      should.push({
        term: { 'metadata.chunkType': filter.chunkType },
      });
      should.push({
        term: { 'strategyMetadata.chunkingStrategy': filter.chunkType },
      });
    }

    // Date range filtering
    if (filter.dateRange) {
      must.push({
        range: {
          createdAt: {
            gte: filter.dateRange.start.toISOString(),
            lte: filter.dateRange.end.toISOString(),
          },
        },
      });
    }

    // Build query
    const query: any = {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
      },
    };

    if (should.length > 0) {
      query.bool.should = should;
      query.bool.minimum_should_match = 1;
    }

    // Execute search
    const response = await this.client.search({
      index: this.chunksIndexName,
      query,
      size: filter.limit || 100,
    });

    const results = response.hits.hits.map((hit: any) => hit._source);

    // Cache the results
    this.cacheSearchResults(cacheKey, results);

    return results;
  }

  /**
   * Get available groups for an item
   */
  async getAvailableGroups(itemId: string): Promise<string[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { itemId },
      },
      aggs: {
        groups: {
          terms: {
            field: 'denseVectorIndexGroupId',
          },
        },
      },
      size: 0,
    });

    return (
      (response.aggregations?.groups as any)?.buckets?.map(
        (bucket: any) => bucket.key,
      ) || []
    );
  }

  /**
   * Get group statistics
   */
  async getGroupStats(groupId: string): Promise<{
    chunkCount: number;
    averageChunkSize: number;
    processingTime: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { denseVectorIndexGroupId: groupId },
      },
      aggs: {
        chunkCount: {
          value_count: {
            field: '_id',
          },
        },
        avgChunkSize: {
          avg: {
            script: {
              source: "doc['content'].value.length()",
            },
          },
        },
        avgProcessingTime: {
          avg: {
            field: 'strategyMetadata.processingDuration',
          },
        },
        oldestChunk: {
          min: {
            field: 'createdAt',
          },
        },
        newestChunk: {
          max: {
            field: 'updatedAt',
          },
        },
      },
      size: 0,
    });

    const aggregations = response.aggregations as any;
    return {
      chunkCount: aggregations?.chunkCount?.value || 0,
      averageChunkSize: aggregations?.avgChunkSize?.value || 0,
      processingTime: aggregations?.avgProcessingTime?.value || 0,
      createdAt: new Date(
        aggregations?.oldestChunk?.value_as_string || Date.now(),
      ),
      updatedAt: new Date(
        aggregations?.newestChunk?.value_as_string || Date.now(),
      ),
    };
  }

  /**
   * Delete chunks for a specific group (soft delete)
   */
  async deleteChunksByGroup(groupId: string): Promise<number> {
    await this.checkInitialized();

    const response = await this.client.deleteByQuery({
      index: this.chunksIndexName,
      query: {
        term: { denseVectorIndexGroupId: groupId },
      },
      refresh: true,
    });

    return response.deleted || 0;
  }

  /**
   * Get chunks by multiple groups
   */
  async getChunksByGroups(groupIds: string[]): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        terms: { denseVectorIndexGroupId: groupIds },
      },
      sort: [
        { denseVectorIndexGroupId: { order: 'asc' } },
        { index: { order: 'asc' } },
      ],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by chunking strategy
   */
  async getChunksByStrategy(strategy: string): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { 'strategyMetadata.chunkingStrategy': strategy },
      },
      sort: [{ itemId: { order: 'asc' } }, { index: { order: 'asc' } }],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Get chunks by embedding provider
   */
  async getChunksByProvider(provider: string): Promise<ItemChunk[]> {
    await this.checkInitialized();

    const response = await this.client.search({
      index: this.chunksIndexName,
      query: {
        term: { 'strategyMetadata.embeddingProvider': provider },
      },
      sort: [{ itemId: { order: 'asc' } }, { index: { order: 'asc' } }],
    });

    return response.hits.hits.map((hit: any) => hit._source);
  }

  /**
   * Update chunks for a specific group
   */
  async updateChunksByGroup(
    groupId: string,
    updates: Partial<ItemChunk>,
  ): Promise<number> {
    await this.checkInitialized();

    const response = await this.client.updateByQuery({
      index: this.chunksIndexName,
      query: {
        term: { denseVectorIndexGroupId: groupId },
      },
      script: {
        source: Object.entries(updates)
          .map(([key, value]) => {
            if (typeof value === 'object') {
              return `ctx._source.${key} = params.${key}`;
            }
            return `ctx._source.${key} = '${value}'`;
          })
          .join('; '),
        params: updates,
      },
      refresh: true,
    });

    return response.updated || 0;
  }

  /**
   * Migrate legacy chunks to the new format
   */
  async migrateLegacyChunks(itemId?: string): Promise<number> {
    // Implementation would depend on specific migration requirements
    // For now, return 0 as a placeholder
    this.logger.info('Legacy chunk migration not yet implemented');
    return 0;
  }

  /**
   * Validate chunk embeddings for consistency
   */
  async validateChunkEmbeddings(groupId?: string): Promise<{
    totalChunks: number;
    validChunks: number;
    invalidChunks: number;
    errors: string[];
  }> {
    await this.checkInitialized();

    const query = groupId
      ? { term: { denseVectorIndexGroupId: groupId } }
      : { match_all: {} };

    const response = await this.client.search({
      index: this.chunksIndexName,
      query,
      size: 1000, // Limit for validation
    });

    const chunks = response.hits.hits.map((hit: any) => hit._source);
    const errors: string[] = [];
    let validChunks = 0;

    for (const chunk of chunks) {
      // Check if chunk has simplified embedding structure
      if (!chunk.embedding) {
        errors.push(`Chunk ${chunk.id} has no embedding`);
        continue;
      }

      if (!Array.isArray(chunk.embedding)) {
        errors.push(
          `Chunk ${chunk.id} has invalid embedding structure (expected array)`,
        );
        continue;
      }

      if (chunk.embedding.length === 0) {
        errors.push(`Chunk ${chunk.id} has empty embedding`);
        continue;
      }

      if (chunk.embedding.length !== this.vectorDimensions) {
        errors.push(
          `Chunk ${chunk.id} has incorrect embedding dimensions: ${chunk.embedding.length}, expected: ${this.vectorDimensions}`,
        );
        continue;
      }

      validChunks++;
    }

    return {
      totalChunks: chunks.length,
      validChunks,
      invalidChunks: chunks.length - validChunks,
      errors,
    };
  }
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

export enum ItemVectorStorageStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
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
