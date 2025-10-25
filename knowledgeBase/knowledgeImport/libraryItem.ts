import { getRabbitMQService } from 'lib/rabbitmq/rabbitmq.service';
import {
  AbstractLibraryStorage,
  BookMetadata,
  ChunkSearchFilter,
  ItemChunk,
} from './library';
import { createLoggerWithPrefix } from '@aikb/log-management';
import { createMinerUConvertorFromEnv } from '@aikb/pdf-converter';
import {
  ChunkingStrategy,
  ChunkingConfig,
  defaultChunkingConfig,
} from '@aikb/chunking';
import { getAvailableStrategies } from '@aikb/chunking';
import { EmbeddingConfig, defaultEmbeddingConfig } from '@aikb/embedding';

import {
  ChunkingEmbeddingRequestMessage,
  PdfProcessingStatus,
} from 'lib/rabbitmq';

import { deleteFromS3 } from '@aikb/s3-service';
import { v4 } from 'uuid';

const logger = createLoggerWithPrefix('LibraryItem');

export class LibraryItem {
  private rabbitMQService = getRabbitMQService();

  constructor(
    public metadata: BookMetadata,
    private storage: AbstractLibraryStorage,
  ) {}

  /**
   * Get the ID of this library item
   */
  getItemId(): string {
    if (!this.metadata.id) {
      throw new Error('Library item does not have an ID');
    }
    return this.metadata.id;
  }

  /**
   * Check if this item has an associated PDF file
   */
  hasPdf(): boolean {
    return !!this.metadata.s3Key;
  }

  /**
   * Get the PDF file if available
   */
  async getPdf(): Promise<Buffer | null> {
    if (!this.metadata.s3Key) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdf(this.metadata.s3Key);
  }

  /**
   * Get the PDF download URL if available
   */
  async getPdfDownloadUrl(): Promise<string> {
    if (!this.metadata.s3Key) {
      throw new Error('No PDF file associated with this item');
    }
    return await this.storage.getPdfDownloadUrl(this.metadata.s3Key);
  }

  /**
   * Get markdown representation of the item
   */
  async getMarkdown(): Promise<string> {
    // First try to get stored markdown content
    const storedMarkdown = await this.storage.getMarkdown(this.metadata.id!);
    if (storedMarkdown) {
      return storedMarkdown;
    }

    // If no stored markdown, return a placeholder
    return `# ${this.metadata.title}\n\n${this.metadata.abstract || ''}`;
  }

  /**
   * Update the metadata of this item
   */
  async updateMetadata(updates: Partial<BookMetadata>): Promise<void> {
    this.metadata = { ...this.metadata, ...updates, dateModified: new Date() };
    await this.storage.updateMetadata(this.metadata);
  }

  /**
   * Add a tag to this item
   */
  async addTag(tag: string): Promise<void> {
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
      await this.updateMetadata({ tags: this.metadata.tags });
    }
  }

  /**
   * Remove a tag from this item
   */
  async removeTag(tag: string): Promise<void> {
    const index = this.metadata.tags.indexOf(tag);
    if (index > -1) {
      this.metadata.tags.splice(index, 1);
      await this.updateMetadata({ tags: this.metadata.tags });
    }
  }

  /**
   * Add this item to a collection
   */
  async addToCollection(collectionId: string): Promise<void> {
    if (!this.metadata.collections.includes(collectionId)) {
      this.metadata.collections.push(collectionId);
      await this.updateMetadata({ collections: this.metadata.collections });
    }
  }

  /**
   * Remove this item from a collection
   */
  async removeFromCollection(collectionId: string): Promise<void> {
    const index = this.metadata.collections.indexOf(collectionId);
    if (index > -1) {
      this.metadata.collections.splice(index, 1);
      await this.updateMetadata({ collections: this.metadata.collections });
    }
  }

  async extractMarkdown(): Promise<void> {
    logger.info(
      `[LibraryItem.extractMarkdown] Starting markdown extraction for item: ${this.metadata.id}`,
    );

    // Check if this item has an associated PDF file
    if (!this.hasPdf()) {
      throw new Error('No PDF file associated with this item');
    }

    try {
      logger.info(`[LibraryItem.extractMarkdown] Getting PDF download URL...`);
      // Get the PDF download URL
      const pdfUrl = await this.getPdfDownloadUrl();
      logger.info(`[LibraryItem.extractMarkdown] PDF URL obtained: ${pdfUrl}`);

      logger.info(
        `[LibraryItem.extractMarkdown] Creating MinerUPdfConvertor instance...`,
      );
      // Create a new MinerUPdfConvertor instance
      const pdfConvertor = createMinerUConvertorFromEnv();

      logger.info(
        `[LibraryItem.extractMarkdown] Converting PDF to markdown...`,
      );
      // Convert the PDF to markdown using the MinerUPdfConvertor
      const conversionResult = await pdfConvertor.convertPdfToMarkdown(pdfUrl);
      logger.info(
        `[LibraryItem.extractMarkdown] Conversion completed. Success: ${conversionResult.success}`,
      );

      if (!conversionResult.success) {
        throw new Error(
          `Failed to convert PDF to markdown: ${conversionResult.error}`,
        );
      }

      logger.info(
        `[LibraryItem.extractMarkdown] Extracting markdown content from result...`,
      );
      // Extract markdown content from the conversion result
      let markdownContent = '';

      if (typeof conversionResult.data === 'string') {
        markdownContent = conversionResult.data;
        logger.info(
          `[LibraryItem.extractMarkdown] Markdown extracted as string (${markdownContent.length} chars)`,
        );
      } else if (conversionResult.data && conversionResult.data.markdown) {
        markdownContent = conversionResult.data.markdown;
        logger.info(
          `[LibraryItem.extractMarkdown] Markdown extracted from data.markdown (${markdownContent.length} chars)`,
        );
      } else if (conversionResult.data && conversionResult.data.content) {
        markdownContent = conversionResult.data.content;
        logger.info(
          `[LibraryItem.extractMarkdown] Markdown extracted from data.content (${markdownContent.length} chars)`,
        );
      } else {
        logger.error(
          `[LibraryItem.extractMarkdown] No markdown content found in conversion result:`,
          conversionResult.data,
        );
        throw new Error('No markdown content found in conversion result');
      }

      logger.info(
        `[LibraryItem.extractMarkdown] Saving markdown content to storage...`,
      );
      // Save the markdown content to storage
      await this.storage.saveMarkdown(this.metadata.id!, markdownContent);

      logger.info(`[LibraryItem.extractMarkdown] Updating metadata...`);
      // Update the metadata with the markdown content and timestamp
      await this.updateMetadata({
        markdownContent,
        markdownUpdatedDate: new Date(),
      });

      logger.info(
        `Successfully extracted and saved markdown for item: ${this.metadata.id}`,
      );
    } catch (error) {
      logger.error(
        `Error extracting markdown for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all chunks for this item
   * @param options Optional filtering options
   */
  async getChunks(options?: {
    denseVectorIndexGroupId?: string;
    groups?: string[];
    chunkingStrategies?: string[];
    embeddingProviders?: string[];
  }): Promise<ItemChunk[]> {
    const logger = createLoggerWithPrefix('LibraryItem.getChunks');
    logger.info(`Retrieving chunks for item: ${this.metadata.id}`);

    // If no options specified, use legacy method
    if (!options) {
      const chunks = await this.storage.getChunksByItemId(this.metadata.id!);
      logger.info(
        `Retrieved ${chunks.length} chunks for item: ${this.metadata.id}`,
      );
      return chunks;
    }

    // Use storage if available
    let chunks: ItemChunk[] = [];

    if (
      options.denseVectorIndexGroupId &&
      typeof (this.storage as any).getChunksByItemAndGroup === 'function'
    ) {
      chunks = await (this.storage as any).getChunksByItemAndGroup(
        this.metadata.id!,
        options.denseVectorIndexGroupId,
      );
    } else if (
      options.groups &&
      typeof (this.storage as any).getChunksByGroups === 'function'
    ) {
      const allChunks = await (this.storage as any).getChunksByGroups(
        options.groups,
      );
      chunks = allChunks.filter((chunk) => chunk.itemId === this.metadata.id!);
    } else if (
      options.chunkingStrategies &&
      typeof (this.storage as any).getChunksByStrategy === 'function'
    ) {
      // For multiple strategies, we need to combine results
      for (const strategy of options.chunkingStrategies) {
        const strategyChunks = await (this.storage as any).getChunksByStrategy(
          strategy,
        );
        chunks.push(
          ...strategyChunks.filter(
            (chunk) => chunk.itemId === this.metadata.id!,
          ),
        );
      }
    } else if (
      options.embeddingProviders &&
      typeof (this.storage as any).getChunksByProvider === 'function'
    ) {
      // For multiple providers, we need to combine results
      for (const provider of options.embeddingProviders) {
        const providerChunks = await (this.storage as any).getChunksByProvider(
          provider,
        );
        chunks.push(
          ...providerChunks.filter(
            (chunk) => chunk.itemId === this.metadata.id!,
          ),
        );
      }
    } else {
      // Fallback to legacy method
      chunks = await this.storage.getChunksByItemId(this.metadata.id!);
    }

    logger.info(
      `Retrieved ${chunks.length} chunks for item: ${this.metadata.id}`,
    );
    return chunks;
  }

  /**
   * Search within this item's chunks
   * @param query The search query
   * @param limit Maximum number of results
   * @deprecated library storage will no longer support vector search
   */
  async semanticSearchWithDenseVector(
    query: string,
    limit: number = 10,
  ): Promise<ItemChunk[]> {
    return await this.storage.searchChunks({
      query,
      itemId: this.metadata.id!,
      limit,
    });
  }

  /**
   * Find similar chunks within this item
   * @param queryVector The query vector
   * @param limit Maximum number of results
   * @param threshold Similarity threshold
   * @param options Optional search options
   * @deprecated library storage will no longer support vector search
   */
  async findSimilarInChunks(
    queryVector: number[],
    limit: number = 10,
    threshold: number = 0.7,
    options?: {
      denseVectorIndexGroupId?: string;
      groups?: string[];
      chunkingStrategies?: string[];
      embeddingProviders?: string[];
      provider?: string;
    },
  ): Promise<Array<ItemChunk & { similarity: number }>> {
    // Use the enhanced findSimilarChunksWithFilter method if available
    if (
      typeof (this.storage as any).findSimilarChunksWithFilter === 'function'
    ) {
      const filter: ChunkSearchFilter = {
        limit,
        similarityThreshold: threshold,
        itemId: this.metadata.id!,
        denseVectorIndexGroupId: options?.denseVectorIndexGroupId,
        groups: options?.groups,
        chunkingStrategies: options?.chunkingStrategies,
        embeddingProviders: options?.embeddingProviders,
      };

      return await (this.storage as any).findSimilarChunksWithFilter(
        queryVector,
        filter,
        options?.provider,
      );
    }

    // Fallback to legacy method
    return await this.storage.findSimilarChunks(queryVector, limit, threshold, [
      this.metadata.id!,
    ]);
  }

  /**
   * Delete all chunks for this item
   * @deprecated will migrate to chunkEmbedGroup service
   */
  async deleteChunks(): Promise<number> {
    return await this.storage.deleteChunksByItemId(this.metadata.id!);
  }

  /**
   * Get chunk statistics for this item
   * @deprecated will migrate to chunkEmbedGroup service
   */
  async getChunkStats(): Promise<{
    totalChunks: number;
    totalWords: number;
    averageWordsPerChunk: number;
    chunkType: string | null;
    lastUpdated: Date | null;
  }> {
    const chunks = await this.getChunks();

    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalWords: 0,
        averageWordsPerChunk: 0,
        chunkType: null,
        lastUpdated: null,
      };
    }

    const totalWords = chunks.reduce(
      (sum, chunk) =>
        sum + (chunk.metadata?.wordCount || chunk.content.split(/\s+/).length),
      0,
    );

    const chunkTypes = new Set(
      chunks.map((chunk) => chunk.metadata?.chunkType).filter(Boolean),
    );
    const lastUpdated = new Date(
      Math.max(...chunks.map((chunk) => chunk.updatedAt.getTime())),
    );

    return {
      totalChunks: chunks.length,
      totalWords,
      averageWordsPerChunk: Math.round(totalWords / chunks.length),
      chunkType: chunkTypes.size > 0 ? Array.from(chunkTypes).join(', ') : null,
      lastUpdated,
    };
  }

  /**
   * Advanced chunk embedding using the new unified chunking interface
   * This method will create new chunking&embedding group
   * @param chunkingStrategy The chunking strategy to use
   * @param forceReprocess Whether to force reprocessing existing chunks
   * @param chunkingConfig Optional chunking configuration
   * @returns Array of created chunks
   */
  async chunkEmbed(
    chunkingStrategy: ChunkingStrategy = ChunkingStrategy.H1,
    forceReprocess: boolean = false,
    chunkingConfig?: ChunkingConfig,
    embeddingConfig?: EmbeddingConfig,
    groupName?: string,
  ): Promise<ItemChunk[]> {
    const logger = createLoggerWithPrefix('LibraryItem.chunkEmbed');
    try {
      logger.info(
        `Starting chunkEmbed for item: ${this.metadata.id}, strategy: ${chunkingStrategy}, forceReprocess: ${forceReprocess}`,
      );

      // Check if markdown content exists
      if (!this.metadata.markdownContent) {
        throw new Error(
          `No markdown content available for item: ${this.metadata.id}. Please extract markdown first.`,
        );
      }

      logger.info(
        `Markdown content length: ${this.metadata.markdownContent.length} characters`,
      );

      // DEBUG: Log RabbitMQ service status
      logger.info(`DEBUG: RabbitMQ service status:`, {
        isConnected: this.rabbitMQService.isConnected(),
        serviceExists: !!this.rabbitMQService,
        nodeIdEnv: process.env.NODE_ENV,
        isVitest:
          typeof globalThis !== 'undefined' &&
          (globalThis as any).__vitest__ !== undefined,
      });

      // For testing or when RabbitMQ is not available, use the library's processItemChunks method directly
      // Check if we're in a test environment (vitest sets process.env.NODE_ENV to 'test' but sometimes it doesn't work)

      // Send chunking and embedding request to the microservice
      logger.info(
        `Sending chunking and embedding request for item: ${this.metadata.id}`,
      );

      const chunkingEmbeddingRequest: ChunkingEmbeddingRequestMessage = {
        messageId: v4(),
        timestamp: Date.now(),
        eventType: 'CHUNKING_EMBEDDING_REQUEST',
        itemId: this.metadata.id!,
        markdownContent: this.metadata.markdownContent,
        embeddingConfig: embeddingConfig,
        chunkingConfig: chunkingConfig,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        groupConfig: {
          name: groupName ?? `chunk-embed-${Date.now()}`,
          chunkingConfig: chunkingConfig ?? defaultChunkingConfig,
          embeddingConfig: embeddingConfig ?? defaultEmbeddingConfig,
          isDefault: false,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Publish the request to RabbitMQ
      await this.rabbitMQService.publishChunkingEmbeddingRequest(
        chunkingEmbeddingRequest,
      );

      logger.info(
        `Chunking and embedding request sent for item: ${this.metadata.id}`,
      );

      // Return empty array since processing is now asynchronous
      // The chunks will be processed by the chunking embedding worker
      return [];
    } catch (error) {
      logger.error(
        `Error sending chunking and embedding request for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get available chunk/embed group
   * @returns Array of available strategies
   */
  getAvailableChunkEmbedGroup(): Array<{
    name: string;
    description: string;
    version: string;
  }> {
    return getAvailableStrategies();
  }

  /**
   * Check if chunking and embedding is in progress for this item
   * @returns Promise<boolean> - true if chunking and embedding is in progress
   */
  async isChunkEmbedInProgress(): Promise<boolean> {
    const status = this.metadata.pdfProcessingStatus;
    return (
      status === PdfProcessingStatus.PROCESSING &&
      this.metadata.pdfProcessingMessage?.includes('chunking') === true
    );
  }

  /**
   * Wait for chunking and embedding to complete
   * @param timeoutMs Timeout in milliseconds (default: 5 minutes)
   * @param intervalMs Check interval in milliseconds (default: 2 seconds)
   * @returns Promise<{success: boolean, chunks?: ItemChunk[], error?: string}>
   */
  async waitForChunkEmbedCompletion(
    timeoutMs: number = 300000, // 5 minutes default
    intervalMs: number = 2000, // 2 seconds default
  ): Promise<{ success: boolean; chunks?: ItemChunk[]; error?: string }> {
    const logger = createLoggerWithPrefix(
      'LibraryItem.waitForChunkEmbedCompletion',
    );
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      // Refresh metadata to get latest status
      const updatedItem = await this.storage.getMetadata(this.metadata.id!);
      if (updatedItem) {
        this.metadata = updatedItem;
      }

      const status = this.metadata.pdfProcessingStatus;

      if (status === PdfProcessingStatus.COMPLETED) {
        // Check if chunks are available
        const chunks = await this.getChunks();
        if (chunks.length > 0) {
          logger.info(
            `Chunking and embedding completed for item: ${this.metadata.id}`,
          );
          return { success: true, chunks };
        }
      }

      if (status === PdfProcessingStatus.FAILED) {
        logger.error(
          `Chunking and embedding failed for item: ${this.metadata.id}`,
          this.metadata.pdfProcessingError,
        );
        return {
          success: false,
          error: this.metadata.pdfProcessingError || 'Unknown error',
        };
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return {
      success: false,
      error: `Chunking and embedding timeout after ${timeoutMs}ms`,
    };
  }

  /**
   * Get the default configuration for a specific chunking strategy
   * @param strategyName The strategy name
   * @returns Default configuration
   */
  getChunkingStrategyDefaultConfig(strategyName: ChunkingStrategy): any {
    // Import dynamically to avoid circular dependencies
    const {
      getStrategyDefaultConfig,
    } = require('@aikb/chunking/chunking-tool');
    return getStrategyDefaultConfig(strategyName);
  }

  /**
   * Check if this item has completed chunkEmbed (has chunks with embeddings)
   * @returns Promise<boolean> - true if the item has chunks with embeddings, false otherwise
   */
  async hasCompletedChunkEmbed(): Promise<boolean> {
    const logger = createLoggerWithPrefix('LibraryItem.hasCompletedChunkEmbed');
    try {
      logger.info(
        `Checking chunkEmbed completion for item: ${this.metadata.id}`,
      );

      // Get all chunks for this item
      const chunks = await this.getChunks();
      logger.info(
        `Retrieved ${chunks.length} chunks for item: ${this.metadata.id}`,
      );

      // If no chunks exist, chunkEmbed has not been completed
      if (chunks.length === 0) {
        logger.warn(`No chunks found for item: ${this.metadata.id}`);
        return false;
      }

      // Log chunk details
      chunks.forEach((chunk, index) => {
        logger.debug(
          `Chunk ${index}: id=${chunk.id}, hasEmbedding=${!!chunk.embedding}, embeddingLength=${chunk.embedding?.length || 0}`,
        );
      });

      // Check if all chunks have simplified embedding structure
      const chunksWithEmbeddings = chunks.filter(
        (chunk) =>
          chunk.embedding &&
          Array.isArray(chunk.embedding) &&
          chunk.embedding.length > 0,
      );

      logger.info(
        `Chunks with embeddings: ${chunksWithEmbeddings.length}/${chunks.length}`,
      );

      // Return true only if all chunks have embeddings
      const result = chunksWithEmbeddings.length === chunks.length;
      logger.info(
        `ChunkEmbed completion status for item ${this.metadata.id}: ${result}`,
      );
      return result;
    } catch (error) {
      logger.error(
        `Error checking chunkEmbed completion for item ${this.metadata.id}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get all available dense vector index groups for this item
   * @returns Promise<string[]> - Array of unique denseVectorIndexGroupId values for this item
   * @document documents/README-getDenseVectorIndexGroup.md
   */
  async getDenseVectorIndexGroupId(): Promise<string[]> {
    const logger = createLoggerWithPrefix(
      'LibraryItem.getDenseVectorIndexGroupId',
    );
    try {
      logger.info(
        `Getting dense vector index groups for item: ${this.metadata.id}`,
      );

      // Get all chunks for this item
      const chunks = await this.getChunks();
      logger.info(
        `Retrieved ${chunks.length} chunks for item: ${this.metadata.id}`,
      );

      // If no chunks exist, return empty array
      if (chunks.length === 0) {
        logger.warn(`No chunks found for item: ${this.metadata.id}`);
        return [];
      }

      // Extract all unique denseVectorIndexGroupId values
      const denseVectorIndexGroupIds = [
        ...new Set(
          chunks.map((chunk) => chunk.denseVectorIndexGroupId).filter(Boolean),
        ),
      ];

      logger.info(
        `Found ${denseVectorIndexGroupIds.length} unique dense vector index groups for item: ${this.metadata.id}: ${JSON.stringify(denseVectorIndexGroupIds)}`,
      );

      return denseVectorIndexGroupIds;
    } catch (error) {
      logger.error(
        `Error getting dense vector index groups for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete this item and all associated data including:
   * - PDF file from S3
   * - Metadata from database
   * - Markdown content
   * - All chunks and embeddings
   * - Citations
   * @returns Promise<boolean> - true if deletion was successful, false otherwise
   */
  async selfDelete(): Promise<boolean> {
    const logger = createLoggerWithPrefix('LibraryItem.selfDelete');
    try {
      logger.info(`Starting self-delete for item: ${this.metadata.id}`);

      if (!this.metadata.id) {
        throw new Error('Cannot delete item without ID');
      }

      // Step 1: Delete all chunks and embeddings
      logger.info(`Deleting chunks for item: ${this.metadata.id}`);
      const deletedChunksCount = await this.deleteChunks();
      logger.info(
        `Deleted ${deletedChunksCount} chunks for item: ${this.metadata.id}`,
      );

      // Step 2: Delete citations
      logger.info(`Deleting citations for item: ${this.metadata.id}`);
      await this.storage.deleteCitations(this.metadata.id);
      logger.info(`Deleted citations for item: ${this.metadata.id}`);

      // Step 3: Delete markdown content
      logger.info(`Deleting markdown content for item: ${this.metadata.id}`);
      await this.storage.deleteMarkdown(this.metadata.id);
      logger.info(`Deleted markdown content for item: ${this.metadata.id}`);

      // Step 4: Delete PDF file from S3 if it exists
      if (this.metadata.s3Key) {
        logger.info(`Deleting PDF file from S3: ${this.metadata.s3Key}`);
        try {
          await deleteFromS3(this.metadata.s3Key);
          logger.info(`Deleted PDF file from S3: ${this.metadata.s3Key}`);
        } catch (error) {
          logger.error(
            `Failed to delete PDF file from S3: ${this.metadata.s3Key}`,
            error,
          );
          // Continue with other deletions even if S3 deletion fails
        }
      }

      // Step 5: Delete PDF split parts if they exist
      if (this.metadata.pdfSplittingInfo) {
        logger.info(`Deleting PDF split parts for item: ${this.metadata.id}`);
        for (const part of this.metadata.pdfSplittingInfo.parts) {
          try {
            await deleteFromS3(part.s3Key);
            logger.info(`Deleted PDF part from S3: ${part.s3Key}`);
          } catch (error) {
            logger.error(
              `Failed to delete PDF part from S3: ${part.s3Key}`,
              error,
            );
            // Continue with other deletions even if S3 deletion fails
          }
        }
      }

      // Step 6: Delete metadata (this should be the last step)
      logger.info(`Deleting metadata for item: ${this.metadata.id}`);
      const metadataDeleted = await this.storage.deleteMetadata(
        this.metadata.id,
      );

      if (metadataDeleted) {
        logger.info(
          `Successfully deleted all data for item: ${this.metadata.id}`,
        );
        return true;
      } else {
        logger.warn(`Failed to delete metadata for item: ${this.metadata.id}`);
        return false;
      }
    } catch (error) {
      logger.error(
        `Error during self-delete for item ${this.metadata.id}:`,
        error,
      );
      throw error;
    }
  }
}
