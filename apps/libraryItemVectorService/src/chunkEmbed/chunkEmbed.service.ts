import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaItemVectorStorage,
  ItemChunk,
  ChunkEmbedGroupMetadata,
  ChunkEmbedGroupConfig,
} from 'item-vector-storage';
import { ChunkEmbedItemDto } from 'library-shared';
import { chunkTextWithEnum, ChunkingStrategy } from 'chunking';
import { embeddingService, EmbeddingProvider } from 'embedding';
import { IdUtils } from 'utils';
import { BibliographyGrpcClient } from 'proto-ts';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChunkEmbedService {
  private readonly logger = new Logger(ChunkEmbedService.name);
  private readonly itemVectorStorage: PrismaItemVectorStorage;

  constructor(private bibliographyGrpcClient: BibliographyGrpcClient) {
    this.itemVectorStorage = new PrismaItemVectorStorage();
  }

  /**
   * Handle chunk embedding request for a library item
   * This method:
   * 1. Retrieves the item content (assuming it's already converted to markdown)
   * 2. Chunks the content using the specified strategy
   * 3. Generates embeddings for each chunk
   * 4. Stores the chunks with embeddings in the vector storage
   */
  async handleChunkEmbedRequest(data: ChunkEmbedItemDto): Promise<{
    success: boolean;
    message: string;
    chunkIds?: string[];
  }> {
    try {
      this.logger.log(
        `Processing chunk embed request for item: ${data.itemId}`,
      );

      // Get the chunk embed group metadata to validate it exists and get configuration
      const group = await this.itemVectorStorage.getChunkEmbedGroupInfoById(
        data.chunkEmbedGroupMetadata.id,
      );

      if (!group.isActive) {
        return {
          success: false,
          message: `Chunk embed group ${data.chunkEmbedGroupMetadata.id} is not active`,
        };
      }

      // For now, we assume the item content is already available and converted to markdown
      // In a real implementation, you might need to fetch the content from a storage service
      const itemContent = await this.getItemContent(data.itemId);

      if (!itemContent) {
        return {
          success: false,
          message: `Could not retrieve content for item: ${data.itemId}`,
        };
      }

      // Chunk the content using the specified strategy
      const chunkingConfig = data.chunkEmbedGroupMetadata.chunkingConfig;
      const chunks = await this.chunkContent(
        itemContent,
        chunkingConfig.strategy || ChunkingStrategy.PARAGRAPH,
        {
          maxChunkSize: chunkingConfig.maxChunkSize || 1000,
          minChunkSize: chunkingConfig.minChunkSize || 100,
          overlap: chunkingConfig.overlap || 0,
        },
      );

      if (chunks.length === 0) {
        return {
          success: false,
          message: 'No chunks were generated from the content',
        };
      }

      // Generate embeddings for all chunks
      const chunkContents = chunks.map((chunk) => chunk.content);
      const embeddings = await this.generateBatchEmbeddings(
        chunkContents,
        data.chunkEmbedGroupMetadata.embeddingConfig,
      );

      // Check if any embeddings failed
      const failedEmbeddings = embeddings.some(
        (embedding) => embedding === null,
      );
      if (failedEmbeddings) {
        return {
          success: false,
          message: 'Failed to generate embeddings for one or more chunks',
        };
      }

      // Create item chunks with embeddings
      const now = new Date();
      const itemChunks: ItemChunk[] = chunks.map((chunk, index) => {
        const chunkId = IdUtils.generateChunkId(data.itemId, index);

        return {
          id: chunkId,
          itemId: data.itemId,
          denseVectorIndexGroupId: data.chunkEmbedGroupMetadata.id,
          title: chunk.title || `Chunk ${index + 1}`,
          content: chunk.content,
          index: index,
          embedding: embeddings[index]!, // We know it's not null from the check above
          strategyMetadata: {
            chunkingStrategy:
              chunkingConfig.strategy || ChunkingStrategy.PARAGRAPH,
            chunkingConfig: {
              strategy: chunkingConfig.strategy || ChunkingStrategy.PARAGRAPH,
              parameters: {
                maxChunkSize: chunkingConfig.maxChunkSize || 1000,
                minChunkSize: chunkingConfig.minChunkSize || 100,
                overlap: chunkingConfig.overlap || 0,
              },
            },
            embeddingConfig: data.chunkEmbedGroupMetadata.embeddingConfig,
            processingTimestamp: now,
            processingDuration: 0, // Will be calculated in a real implementation
          },
          metadata: {
            startPosition: chunk.startPosition,
            endPosition: chunk.endPosition,
            wordCount: chunk.wordCount,
            chunkType: chunk.chunkType,
          },
          createdAt: now,
          updatedAt: now,
        };
      });

      // Insert all chunks using batch insert for better performance
      const success = await this.itemVectorStorage.batchInsertItemChunks(
        group,
        itemChunks,
      );

      if (success) {
        const chunkIds = itemChunks.map((chunk) => chunk.id);
        this.logger.log(
          `Successfully processed ${itemChunks.length} chunks for item: ${data.itemId}`,
        );
        return {
          success: true,
          message: `${itemChunks.length} chunks embedded and stored successfully`,
          chunkIds,
        };
      } else {
        return {
          success: false,
          message: 'Failed to insert chunks into storage',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error processing chunk embed request for item ${data.itemId}:`,
        error,
      );
      return {
        success: false,
        message: `Error processing chunk embed request: ${error.message}`,
      };
    }
  }

  /**
   * Get the markdown content of a library item using BibliographyGrpcClient
   */
  private async getItemContent(itemId: string): Promise<string | null> {
    try {
      this.logger.log(`Fetching markdown content for item: ${itemId}`);

      // Use BibliographyGrpcClient to get the library item
      const response = await firstValueFrom(
        this.bibliographyGrpcClient.getLibraryItem({ id: itemId }),
      );

      const libraryItem = response.item;

      if (!libraryItem) {
        this.logger.warn(`Library item not found: ${itemId}`);
        return null;
      }

      if (!libraryItem.markdownContent) {
        this.logger.warn(`No markdown content found for item: ${itemId}`);
        return null;
      }

      this.logger.log(
        `Successfully retrieved markdown content for item: ${itemId}`,
      );
      return libraryItem.markdownContent;
    } catch (error) {
      this.logger.error(
        `Error fetching markdown content for item ${itemId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Chunk content using the specified strategy
   */
  private async chunkContent(
    content: string,
    strategy: ChunkingStrategy,
    config: {
      maxChunkSize: number;
      minChunkSize: number;
      overlap: number;
    },
  ): Promise<
    Array<{
      title?: string;
      content: string;
      startPosition?: number;
      endPosition?: number;
      wordCount?: number;
      chunkType?: string;
    }>
  > {
    try {
      const chunks = await chunkTextWithEnum(content, strategy, config);

      return chunks.map((chunk, index) => ({
        title: (chunk as any).title || `Chunk ${index + 1}`,
        content: chunk.content,
        startPosition: (chunk as any).startPosition,
        endPosition: (chunk as any).endPosition,
        wordCount: (chunk as any).wordCount,
        chunkType: (chunk as any).chunkType,
      }));
    } catch (error) {
      this.logger.error('Error chunking content:', error);
      throw new Error(`Failed to chunk content: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts using batch processing
   */
  private async generateBatchEmbeddings(
    contents: string[],
    embeddingConfig: any,
  ): Promise<(number[] | null)[]> {
    try {
      // Set the provider based on the configuration
      embeddingService.setProvider(
        embeddingConfig.provider as EmbeddingProvider,
      );

      // Generate embeddings using batch functionality
      const embeddings = await embeddingService.embedBatch(
        contents,
        embeddingConfig.provider as EmbeddingProvider,
      );

      return embeddings;
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings:', error);
      return new Array(contents.length).fill(null);
    }
  }

  async createChunkEmbedGroup(config: ChunkEmbedGroupConfig) {
    return await this.itemVectorStorage.createNewChunkEmbedGroupInfo(config);
  }
}
