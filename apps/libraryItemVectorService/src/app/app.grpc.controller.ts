import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { libraryItemVectorProto } from 'proto-ts';
import { VectorService } from 'bibliography-lib';
import { Observable } from 'rxjs';

@Controller()
@libraryItemVectorProto.LibraryItemVectorServiceControllerMethods()
export class AppGrpcController
  implements libraryItemVectorProto.LibraryItemVectorServiceController
{
  constructor(private readonly vectorService: VectorService) {}
  @GrpcMethod('ListChunkEmbedGroupMetadata')
  async listChunkEmbedGroupMetadata(
    request: libraryItemVectorProto.ListItemChunkEmbedGroupMetadataRequest,
  ): Promise<libraryItemVectorProto.ListItemChunkEmbedGroupMetadataResponse> {
    try {
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
      const group = await this.vectorService.createChunkEmbedGroup(request);
      return { group };
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
      return await this.vectorService.embedChunks(request);
    } catch (error) {
      throw new Error(
        `Failed to embed chunks: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @GrpcMethod('SemanticSearchByItemidAndGroupid')
  async semanticSearchByItemidAndGroupid(
    request: libraryItemVectorProto.SemanticSearchByItemidAndGroupidRequest,
  ): Promise<libraryItemVectorProto.SemanticSearchByItemidAndGroupidResponse> {
    try {
      return await this.vectorService.semanticSearchByItemidAndGroupid(request);
    } catch (error) {
      throw new Error(
        `Failed to perform semantic search: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
