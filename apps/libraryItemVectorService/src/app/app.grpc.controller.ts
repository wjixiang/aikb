import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { libraryItemVectorProto } from 'proto-ts';
import { AppService } from './app.service';
import { Observable } from 'rxjs';

@Controller()
@libraryItemVectorProto.LibraryItemVectorServiceControllerMethods()
export class AppGrpcController
  implements libraryItemVectorProto.LibraryItemVectorServiceController
{
  constructor(private readonly libraryItemVectorService: AppService) {}
  @GrpcMethod('ListChunkEmbedGroupMetadata')
  async listChunkEmbedGroupMetadata(
    request: libraryItemVectorProto.ListItemChunkEmbedGroupMetadataRequest,
  ): Promise<libraryItemVectorProto.ListItemChunkEmbedGroupMetadataResponse> {
    try {
      return await this.libraryItemVectorService.listChunkEmbedGroupMetadata(
        request,
      );
    } catch (error) {
      throw new Error(
        `Failed to list chunk embedding group metadata: ${error.message}`,
      );
    }
  }

  @GrpcMethod('CreateChunkEmbedGroup')
  async createChunkEmbedGroup(
    request: libraryItemVectorProto.CreateChunkEmbedGroupRequest,
  ): Promise<libraryItemVectorProto.CreateChunkEmbedGroupResponse> {
    try {
      const group =
        await this.libraryItemVectorService.createChunkEmbedGroup(request);
      return { group };
    } catch (error) {
      throw new Error(
        `Failed to create chunk embedding group: ${error.message}`,
      );
    }
  }

  @GrpcMethod('EmbedChunks')
  async embedChunks(
    request: libraryItemVectorProto.EmbedChunksRequest,
  ): Promise<libraryItemVectorProto.EmbedChunksResponse> {
    try {
      return await this.libraryItemVectorService.embedChunks(request);
    } catch (error) {
      throw new Error(
        `Failed to embed chunks: ${error.message}`,
      );
    }
  }

  @GrpcMethod('SemanticSearchByItemidAndGroupid')
  async semanticSearchByItemidAndGroupid(
    request: libraryItemVectorProto.SemanticSearchByItemidAndGroupidRequest,
  ): Promise<libraryItemVectorProto.SemanticSearchByItemidAndGroupidResponse> {
    try {
      return await this.libraryItemVectorService.semanticSearchByItemidAndGroupid(
        request,
      );
    } catch (error) {
      throw new Error(
        `Failed to perform semantic search: ${error.message}`,
      );
    }
  }
}
