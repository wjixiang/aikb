import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { LibraryItemService } from './library-item.service';
import type { RegisterPdfUploadUrlRequest } from '../../graphql';

@Resolver('LibraryItem')
export class LibraryItemResolver {
  constructor(private readonly libraryItemService: LibraryItemService) {}

  @Query('items')
  getAllItems() {
    return [{
      id: "abc1",
      name: "test_item1"
    }]
  }

  @Query('upload_url')
  async getUploadUrl(
    @Args('request') request: RegisterPdfUploadUrlRequest
  ) {
    try {
      const result =  await this.libraryItemService.getPdfUploadUrl({
        fileName: request.fileName
      });

      return result.uploadUrl

    } catch (error) {
      // throw new HttpException(
      //   `Failed to get PDF upload URL: ${error instanceof Error ? error.message : String(error)}`,
      //   HttpStatus.INTERNAL_SERVER_ERROR,
      // );
    }
  }
}