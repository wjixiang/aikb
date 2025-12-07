import { Injectable } from '@nestjs/common';
import { ItemChunk, PrismaItemVectorStorage } from 'item-vector-storage';
import { ChunkingStrategy } from 'chunking';
import {
  EmbeddingProvider,
  OpenAIModel,
  AlibabaModel,
  OnnxModel,
  EmbeddingConfig,
} from 'embedding';
import { libraryItemVectorProto } from 'proto-ts';
import { IdUtils } from 'utils';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ChunkEmbedItemDto } from 'library-shared';

@Injectable()
export class VectorService {
  private readonly itemVectorStorage: PrismaItemVectorStorage;

  constructor(private amqpConnection: AmqpConnection) {
    this.itemVectorStorage = new PrismaItemVectorStorage();
  }

  async createChunkEmbedGroup(
    request: libraryItemVectorProto.CreateChunkEmbedGroupRequest,
  ): Promise<libraryItemVectorProto.ChunkEmbedGroupMetadata> {
    // Convert protobuf types to internal types
    const chunkingConfig = {
      strategy: (request.chunkingConfig?.strategy ||
        'paragraph') as ChunkingStrategy,
      parameters: request.chunkingConfig?.parameters || {},
    };

    // Convert string provider to enum
    let provider: EmbeddingProvider;
    let model: OpenAIModel | AlibabaModel | OnnxModel;

    switch (request.embeddingConfig?.provider) {
      case 'openai':
        provider = EmbeddingProvider.OPENAI;
        model = (request.embeddingConfig?.model ||
          'text-embedding-ada-002') as OpenAIModel;
        break;
      case 'alibaba':
        provider = EmbeddingProvider.ALIBABA;
        model = (request.embeddingConfig?.model ||
          'text-embedding-v3') as AlibabaModel;
        break;
      case 'onnx':
        provider = EmbeddingProvider.ONNX;
        model = (request.embeddingConfig?.model ||
          'default') as unknown as OnnxModel;
        break;
      default:
        provider = EmbeddingProvider.ALIBABA;
        model = AlibabaModel.TEXT_EMBEDDING_V3;
    }

    const embeddingConfig = {
      provider,
      model,
      dimension: request.embeddingConfig?.dimension || 1536,
      batchSize: parseInt(request.embeddingConfig?.parameters?.['batchSize'] || '20'),
      maxRetries: parseInt(request.embeddingConfig?.parameters?.['maxRetries'] || '3'),
      timeout: parseInt(request.embeddingConfig?.parameters?.['timeout'] || '20000'),
    };

    // Create the chunk embedding group using the storage implementation
    const now = new Date();
    const groupConfig = {
      itemId: request.itemId,
      name: request.name,
      description: request.description,
      chunkingConfig,
      embeddingConfig,
      isDefault: request.isDefault,
      isActive: request.isActive,
      createdBy: request.createdBy,
      tags: request.tags,
      createdAt: now,
      updatedAt: now,
    };

    const createdGroup =
      await this.itemVectorStorage.createNewChunkEmbedGroupInfo(groupConfig);

    // Produce chunkEmbed message
    const chunEmbedRequest: ChunkEmbedItemDto = {
      itemId: request.itemId,
      chunkEmbedGroupMetadata: createdGroup,
    };
    await this.amqpConnection.publish(
      'library',
      'item.vector.chunkEmbed',
      chunEmbedRequest,
    );
    console.log('Produce chunkEmbed message after creating chunkEmbedGroup');

    // Convert internal type back to protobuf type
    return {
      id: createdGroup.id,
      itemId: createdGroup.itemId,
      name: createdGroup.name,
      description: createdGroup.description || '',
      chunkingConfig: {
        strategy: createdGroup.chunkingConfig.strategy || 'paragraph',
        parameters: {},
      },
      embeddingConfig: {
        provider: createdGroup.embeddingConfig.provider,
        model: createdGroup.embeddingConfig.model as string,
        dimension: createdGroup.embeddingConfig.dimension,
        parameters: {},
      },
      isDefault: createdGroup.isDefault,
      isActive: createdGroup.isActive,
      createdAt: createdGroup.createdAt.getTime(),
      updatedAt: createdGroup.updatedAt.getTime(),
      createdBy: createdGroup.createdBy || '',
      tags: createdGroup.tags || [],
    };
  }

  async listChunkEmbedGroupMetadata(
    request: libraryItemVectorProto.ListItemChunkEmbedGroupMetadataRequest,
  ): Promise<libraryItemVectorProto.ListItemChunkEmbedGroupMetadataResponse> {
    // Get the list of chunk embed groups from storage
    const result = await this.itemVectorStorage.listChunkEmbedGroupInfo(
      request.itemId, // itemId
      request.pageSize || 10,
      request.pageToken,
      request.filter,
      request.orderBy,
    );

    // Convert internal types to protobuf types
    const groups = result.groups.map((group) => ({
      id: group.id,
      itemId: group.itemId,
      name: group.name,
      description: group.description || '',
      chunkingConfig: {
        strategy: group.chunkingConfig.strategy || 'paragraph',
        parameters: {}, // ChunkingConfig doesn't have parameters in the internal type
      },
      embeddingConfig: {
        provider: group.embeddingConfig.provider,
        model: group.embeddingConfig.model as string,
        dimension: group.embeddingConfig.dimension,
        parameters: {}, // EmbeddingConfig doesn't have parameters in the internal type
      },
      isDefault: group.isDefault,
      isActive: group.isActive,
      createdAt: group.createdAt.getTime(),
      updatedAt: group.updatedAt.getTime(),
      createdBy: group.createdBy || '',
      tags: group.tags || [],
    }));

    return {
      groups,
      nextPageToken: result.nextPageToken || '',
      totalSize: result.totalSize,
    };
  }

  async embedChunks(
    request: libraryItemVectorProto.EmbedChunksRequest,
  ): Promise<libraryItemVectorProto.EmbedChunksResponse> {
    try {
      // Get the chunk embed group info to validate it exists and get configuration
      const group = await this.itemVectorStorage.getChunkEmbedGroupInfoById(
        request.chunkEmbedGroupId,
      );

      if (!group.isActive) {
        return {
          success: false,
          message: `Chunk embed group ${request.chunkEmbedGroupId} is not active`,
          chunkIds: [],
        };
      }

      // Extract content from all chunks for batch embedding
      const chunkContents = request.chunks.map((chunk) => chunk.content);

      // Generate embeddings for all chunks using batch functionality
      const embeddings = await this.generateBatchEmbeddings(
        chunkContents,
        group.embeddingConfig,
      );

      // Check if any embeddings failed
      const failedEmbeddings = embeddings.some(
        (embedding) => embedding === null,
      );
      if (failedEmbeddings) {
        return {
          success: false,
          message: 'Failed to generate embeddings for one or more chunks',
          chunkIds: [],
        };
      }

      // Create item chunks with embeddings
      const now = new Date();
      const itemChunks: ItemChunk[] = request.chunks.map((chunk, index) => {
        const chunkId = IdUtils.generateChunkId(chunk.itemId, index);

        return {
          id: chunkId,
          itemId: chunk.itemId,
          denseVectorIndexGroupId: request.chunkEmbedGroupId,
          title: chunk.title,
          content: chunk.content,
          index: chunk.index,
          embedding: embeddings[index]!, // We know it's not null from the check above
          strategyMetadata: {
            chunkingStrategy: group.chunkingConfig.strategy || 'paragraph',
            chunkingConfig: group.chunkingConfig,
            embeddingConfig: group.embeddingConfig,
            processingTimestamp: now,
            processingDuration: 0, // Will be calculated
          },
          metadata: this.convertMetadataFromProto(chunk.metadata),
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
        return {
          success: true,
          message: `${itemChunks.length} chunks embedded successfully`,
          chunkIds,
        };
      } else {
        return {
          success: false,
          message: 'Failed to insert chunks into storage',
          chunkIds: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error embedding chunks: ${error instanceof Error ? error.message : String(error)}`,
        chunkIds: [],
      };
    }
  }

  private async generateEmbedding(
    content: string,
    embeddingConfig: EmbeddingConfig,
  ): Promise<number[] | null> {
    try {
      // Import embedding service dynamically to avoid circular dependencies
      const { embeddingService } = await import('embedding');

      // Set the provider based on the configuration
      embeddingService.setProvider(embeddingConfig.provider);

      // Generate embedding using batch functionality for better performance
      const embeddings = await embeddingService.embedBatch([content]);

      // Return the first (and only) embedding from the batch result
      return embeddings[0] || null;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return null;
    }
  }

  private async generateBatchEmbeddings(
    contents: string[],
    embeddingConfig: EmbeddingConfig,
  ): Promise<(number[] | null)[]> {
    try {
      // Import embedding service dynamically to avoid circular dependencies
      const { embeddingService } = await import('embedding');

      // Set the provider based on the configuration
      embeddingService.setProvider(embeddingConfig.provider);

      // Generate embeddings using batch functionality
      const embeddings = await embeddingService.embedBatch(
        contents,
        embeddingConfig.provider,
      );

      return embeddings;
    } catch (error) {
      console.error('Failed to generate batch embeddings:', error);
      return new Array(contents.length).fill(null);
    }
  }

  private convertMetadataFromProto(
    protoMetadata: { [key: string]: string } | undefined,
  ): ItemChunk['metadata'] {
    if (!protoMetadata) return undefined;

    const metadata: ItemChunk['metadata'] = {};

    // Convert string values to appropriate types based on common keys
    for (const [key, value] of Object.entries(protoMetadata)) {
      switch (key) {
        case 'startPosition':
        case 'endPosition':
        case 'wordCount':
          (metadata as any)[key] = parseInt(value, 10);
          break;
        case 'chunkType':
          (metadata as any)[key] = value;
          break;
        default:
          // Keep as string for unknown keys
          (metadata as any)[key] = value;
          break;
      }
    }

    return metadata;
  }

  async semanticSearchByItemidAndGroupid(
    request: {
      itemId: string;
      chunkEmbedGroupId: string;
      query: string;
      topK: number;
      scoreThreshold: number;
      filter: { [key: string]: string };
    }
    
  ): Promise<libraryItemVectorProto.SemanticSearchByItemidAndGroupidResponse> {
    try {
      // Validate that the chunk embed group exists and is active
      const group = await this.itemVectorStorage.getChunkEmbedGroupInfoById(
        request.chunkEmbedGroupId,
      );

      if (!group.isActive) {
        return {
          success: false,
          message: `Chunk embed group ${request.chunkEmbedGroupId} is not active`,
          results: [],
        };
      }

      // Generate embedding for the search query
      const queryEmbedding = await this.generateEmbedding(
        request.query,
        group.embeddingConfig,
      );

      if (!queryEmbedding) {
        return {
          success: false,
          message: 'Failed to generate embedding for search query',
          results: [],
        };
      }

      // Perform semantic search using the storage layer's new method
      const searchResults =
        await this.itemVectorStorage.semanticSearchByItemidAndGroupid(
          request.itemId,
          request.chunkEmbedGroupId,
          queryEmbedding,
          request.topK || 10,
          request.scoreThreshold || 0.0,
          request.filter || {},
        );

      // Convert internal results to protobuf format
      const protobufResults = searchResults.map((result) => ({
        chunkId: result.id,
        itemId: result.itemId,
        title: result.title,
        content: result.content,
        score: result.similarity || 0.0,
        metadata: this.convertMetadataToProto(result.metadata || {}),
      }));

      return {
        success: true,
        message: `Found ${protobufResults.length} matching chunks`,
        results: protobufResults,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error performing semantic search: ${error instanceof Error ? error.message : String(error)}`,
        results: [],
      };
    }
  }

  /**
   * Convert internal metadata to protobuf format
   */
  private convertMetadataToProto(metadata: ItemChunk['metadata']): {
    [key: string]: string;
  } {
    if (!metadata) return {};

    const protoMetadata: { [key: string]: string } = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        protoMetadata[key] = String(value);
      }
    }

    return protoMetadata;
  }
}