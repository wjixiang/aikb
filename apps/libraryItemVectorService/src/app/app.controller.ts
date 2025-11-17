import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { libraryItemVectorProto } from 'proto-ts';
import { AppService } from './app.service';

@Controller()
@libraryItemVectorProto.LibraryItemVectorServiceControllerMethods()
export class AppController
  implements libraryItemVectorProto.LibraryItemVectorServiceController
{
  constructor(private readonly libraryItemVectorService: AppService) {}

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
}
