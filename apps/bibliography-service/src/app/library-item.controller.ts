import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LibraryItemService } from './library-item.service';
import {
  CreateLibraryItemDto,
  CreateLibraryItemWithPdfDto,
  UpdateMetadataDto,
  PdfDownloadUrlDto,
  UpdateMarkdownDto,
} from 'library-shared';
import { LibraryItem } from '@aikb/bibliography';

@Controller('library-items')
export class LibraryItemController {
  constructor(private readonly libraryItemService: LibraryItemService) {}

  /**
   * Create a new library item
   * @param createLibraryItemDto The data to create the library item
   * @returns The created library item
   */
  @Post()
  async create(
    @Body() createLibraryItemDto: CreateLibraryItemDto,
  ): Promise<LibraryItem> {
    try {
      return await this.libraryItemService.createLibraryItem(
        createLibraryItemDto,
      );
    } catch (error) {
      throw new HttpException(
        `Failed to create library item: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new library item with PDF buffer
   * @param createLibraryItemWithPdfDto The data to create the library item with PDF buffer
   * @returns The created library item
   */
  @Post('with-pdf')
  async createWithPdf(
    @Body() createLibraryItemWithPdfDto: CreateLibraryItemWithPdfDto,
  ): Promise<LibraryItem> {
    try {
      return await this.libraryItemService.createLibraryItemWithPdfBuffer(
        createLibraryItemWithPdfDto,
      );
    } catch (error) {
      throw new HttpException(
        `Failed to create library item with PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a library item by ID
   * @param id The ID of the library item
   * @returns The library item or null if not found
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LibraryItem | null> {
    try {
      const item = await this.libraryItemService.getLibraryItem(id);
      if (!item) {
        throw new HttpException('Library item not found', HttpStatus.NOT_FOUND);
      }
      return item;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get library item: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for library items
   * @param query The search query
   * @param tags Optional tags to filter by
   * @param collections Optional collections to filter by
   * @returns Array of matching library items
   */
  @Get()
  async search(
    @Query('query') query?: string,
    @Query('tags') tags?: string,
    @Query('collections') collections?: string,
  ): Promise<LibraryItem[]> {
    try {
      const tagsArray = tags
        ? tags.split(',').map((tag) => tag.trim())
        : undefined;
      const collectionsArray = collections
        ? collections.split(',').map((collection) => collection.trim())
        : undefined;

      return await this.libraryItemService.searchLibraryItems(
        query,
        tagsArray,
        collectionsArray,
      );
    } catch (error) {
      throw new HttpException(
        `Failed to search library items: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a library item by ID
   * @param id The ID of the library item to delete
   * @returns Success message
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<{ message: string; success: boolean }> {
    try {
      const deleted = await this.libraryItemService.deleteLibraryItem(id);
      if (!deleted) {
        throw new HttpException('Library item not found', HttpStatus.NOT_FOUND);
      }
      return { message: 'Library item deleted successfully', success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete library item: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update library item metadata
   * @param id The ID of the library item
   * @param updateMetadataDto The metadata to update
   * @returns The updated library item
   */
  @Put(':id/metadata')
  async updateMetadata(
    @Param('id') id: string,
    @Body() updateMetadataDto: UpdateMetadataDto,
  ): Promise<LibraryItem> {
    try {
      return await this.libraryItemService.updateLibraryItemMetadata(
        id,
        updateMetadataDto,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update library item metadata: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // /**
  //  * Update PDF processing status
  //  * @param id The ID of the library item
  //  * @param updateProcessingStatusDto The processing status update
  //  * @returns The updated library item
  //  */
  // @Put(':id/processing-status')
  // async updateProcessingStatus(
  //   @Param('id') id: string,
  //   @Body() updateProcessingStatusDto: UpdateProcessingStatusDto,
  // ): Promise<LibraryItem> {
  //   try {
  //     return await this.libraryItemService.updatePdfProcessingStatus(
  //       id,
  //       updateProcessingStatusDto,
  //     );
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error;
  //     }
  //     throw new HttpException(
  //       `Failed to update PDF processing status: ${error.message}`,
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  /**
   * Update markdown content for a library item
   * @param id The ID of the library item
   * @param updateMarkdownDto The markdown content to update
   * @returns The updated library item
   */
  @Put(':id/markdown')
  async updateMarkdown(
    @Param('id') id: string,
    @Body() updateMarkdownDto: UpdateMarkdownDto,
  ): Promise<LibraryItem> 
  {
    try {
      return await this.libraryItemService.updateLibraryItemMarkdown(
        id,
        updateMarkdownDto.markdownContent,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update library item markdown: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get PDF download URL
   * @param id The ID of the library item
   * @returns The download URL and expiration time
   */
  @Get(':id/download-url')
  async getDownloadUrl(@Param('id') id: string): Promise<PdfDownloadUrlDto> {
    try {
      return await this.libraryItemService.getPdfDownloadUrl(id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get PDF download URL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
