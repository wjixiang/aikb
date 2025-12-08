import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { libraryItemVectorProto } from 'proto-ts';
import { VectorService } from './vector.service';
import { Observable } from 'rxjs';
import { CreateChunkEmbedGroupRequest } from './types';

@Controller()
@libraryItemVectorProto.LibraryItemVectorServiceControllerMethods()
export class VectorGrpcController
  implements libraryItemVectorProto.LibraryItemVectorServiceController
{
  constructor(private readonly vectorService: VectorService) {}

  /**
   * Convert protobuf CreateChunkEmbedGroupRequest to internal CreateChunkEmbedGroupRequest
   */
  private convertCreateChunkEmbedGroupRequestFromProto(
    protoRequest: libraryItemVectorProto.CreateChunkEmbedGroupRequest,
  ): CreateChunkEmbedGroupRequest {
    return {
      name: protoRequest.name,
      description: protoRequest.description,
      chunkingConfig: protoRequest.chunkingConfig ? {
        strategy: protoRequest.chunkingConfig.strategy as any,
      } : undefined,
      embeddingConfig: protoRequest.embeddingConfig ? {
        provider: protoRequest.embeddingConfig.provider as any,
        model: protoRequest.embeddingConfig.model as any,
        dimension: protoRequest.embeddingConfig.dimension,
        batchSize: parseInt(protoRequest.embeddingConfig.parameters?.['batchSize'] || '20', 10),
        maxRetries: parseInt(protoRequest.embeddingConfig.parameters?.['maxRetries'] || '3', 10),
        timeout: parseInt(protoRequest.embeddingConfig.parameters?.['timeout'] || '20000', 10),
      } : undefined,
      isDefault: protoRequest.isDefault,
      isActive: protoRequest.isActive,
      createdBy: protoRequest.createdBy,
      tags: protoRequest.tags,
      itemId: protoRequest.itemId,
    };
  }

  /**
   * Convert internal ChunkEmbedGroupMetadata to protobuf ChunkEmbedGroupMetadata
   */
  private convertChunkEmbedGroupMetadataToProto(
    group: any,
  ): libraryItemVectorProto.ChunkEmbedGroupMetadata {
    return {
      id: group.id,
      itemId: group.itemId,
      name: group.name,
      description: group.description || '',
      chunkingConfig: {
        strategy: group.chunkingConfig.strategy || 'paragraph',
        parameters: {}
      },
      embeddingConfig: {
        provider: group.embeddingConfig.provider,
        model: group.embeddingConfig.model as string,
        dimension: group.embeddingConfig.dimension,
        parameters: {
          batchSize: group.embeddingConfig.batchSize?.toString() || '30',
          maxRetries: group.embeddingConfig.maxRetries?.toString() || '5',
          timeout: group.embeddingConfig.timeout?.toString() || '30000'
        }
      },
      isDefault: group.isDefault,
      isActive: group.isActive,
      createdAt: group.createdAt.getTime(),
      updatedAt: group.updatedAt.getTime(),
      createdBy: group.createdBy || '',
      tags: group.tags || []
    };
  }

  /**
   * Convert protobuf SemanticSearchByItemidAndGroupidRequest to internal request format
   */
  private convertSemanticSearchRequestFromProto(
    protoRequest: libraryItemVectorProto.SemanticSearchByItemidAndGroupidRequest,
  ): any {
    return {
      itemId: protoRequest.itemId,
      chunkEmbedGroupId: protoRequest.chunkEmbedGroupId,
      query: protoRequest.query,
      topK: protoRequest.topK,
      scoreThreshold: protoRequest.scoreThreshold,
      filter: protoRequest.filter || {},
    };
  }

  @GrpcMethod('ListChunkEmbedGroupMetadata')
  async listChunkEmbedGroupMetadata(
    request: libraryItemVectorProto.ListItemChunkEmbedGroupMetadataRequest,
  ): Promise<libraryItemVectorProto.ListItemChunkEmbedGroupMetadataResponse> {
    try {
      // The service already handles the conversion from internal types to protobuf
      return await this.vectorService.listChunkEmbedGroupMetadata(request);
    } catch (error) {
      throw new Error(
        `Failed to list chunk embedding group metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @GrpcMethod('CreateChunkEmbedGroup')
  async createChunkEmbedGroup(
    request: libraryItemVectorProto.CreateChunkEmbedGroupRequest,
  ): Promise<libraryItemVectorProto.CreateChunkEmbedGroupResponse> {
    try {
      // Convert protobuf request to internal format
      const internalRequest = this.convertCreateChunkEmbedGroupRequestFromProto(request);
      
      const group = await this.vectorService.createChunkEmbedGroup(internalRequest);
      
      // Convert the group to the expected protobuf format
      const protobufGroup = this.convertChunkEmbedGroupMetadataToProto(group);
      
      return { group: protobufGroup };
    } catch (error) {
      throw new Error(
        `Failed to create chunk embedding group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @GrpcMethod('EmbedChunks')
  async embedChunks(
    request: libraryItemVectorProto.EmbedChunksRequest,
  ): Promise<libraryItemVectorProto.EmbedChunksResponse> {
    try {
      // The service already handles the conversion from protobuf to internal types
      return await this.vectorService.embedChunks(request);
    } catch (error) {
      throw new Error(`Failed to embed chunks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @GrpcMethod('SemanticSearchByItemidAndGroupid')
  async semanticSearchByItemidAndGroupid(
    request: libraryItemVectorProto.SemanticSearchByItemidAndGroupidRequest,
  ): Promise<libraryItemVectorProto.SemanticSearchByItemidAndGroupidResponse> {
    try {
      // Convert protobuf request to internal format
      const internalRequest = this.convertSemanticSearchRequestFromProto(request);
      
      return await this.vectorService.semanticSearchByItemidAndGroupid(internalRequest);
    } catch (error) {
      throw new Error(`Failed to perform semantic search: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}