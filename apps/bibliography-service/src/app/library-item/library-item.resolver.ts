import { Resolver, Query, Mutation, Args, ResolveField } from '@nestjs/graphql';
import { LibraryItemService } from './library-item.service';
import * as graphql from '../../graphql';
import { CreateLibraryItemDto } from 'library-shared';
import { LibraryItem } from '@/libs/bibliography/src';

@Resolver()
export class LibraryItemResolver {
  constructor(private readonly libraryItemService: LibraryItemService) {}

  private transformLibraryItemToMetadata(item: LibraryItem): graphql.LibraryItemMetadata {
    return {
      id: item.getItemId(),
      title: item.metadata.title,
      authors: item.metadata.authors.map((author: any) => ({
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName || null
      })),
      abstract: item.metadata.abstract || null,
      publicationYear: item.metadata.publicationYear || null,
      publisher: item.metadata.publisher || null,
      isbn: item.metadata.isbn || null,
      doi: item.metadata.doi || null,
      url: item.metadata.url || null,
      tags: item.metadata.tags,
      notes: item.metadata.notes || null,
      collections: item.metadata.collections,
      dateAdded: item.metadata.dateAdded.toISOString(),
      dateModified: item.metadata.dateModified.toISOString(),
      language: item.metadata.language || null,
      markdownContent: item.metadata.markdownContent || null,
      markdownUpdatedDate: item.metadata.markdownUpdatedDate?.toISOString() || null,
      archives: item.metadata.archives.map(e => ({
        fileType: e.fileType,
        fileSize: e.fileSize,
        fileHash: e.fileHash,
        addDate: e.addDate.toISOString(),
        s3Key: e.s3Key,
        pageCount: e.pageCount,
        wordCount: e.wordCount || null
      }))
    };
  }

  @Query('libraryItems')
  async getLibraryItems(): Promise<graphql.LibraryItemMetadata[]> {
    try {
      const items = await this.libraryItemService.searchLibraryItems();
      
      // Transform LibraryItem objects to match GraphQL schema
      return items.map(item => this.transformLibraryItemToMetadata(item));
    } catch (error) {
      console.error('Error fetching library items:', error);
      return [];
    }
  }

  @Query('itemArchives')
  async getItemArchives(@Args('itemId') itemId: string): Promise<graphql.ItemArchive[]> {
    try {
      const item = await this.libraryItemService.getLibraryItem(itemId);
      if (!item) {
        throw new Error(`Library item with ID ${itemId} not found`);
      }
      
      return item.metadata.archives.map((archive: any): graphql.ItemArchive => ({
        fileType: archive.fileType,
        fileSize: archive.fileSize,
        fileHash: archive.fileHash,
        addDate: archive.addDate.toISOString(),
        s3Key: archive.s3Key,
        pageCount: archive.pageCount,
        wordCount: archive.wordCount || null
      }));
    } catch (error) {
      console.error(`Error fetching archives for item ${itemId}:`, error);
      throw new Error(`Failed to fetch archives: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @Query('signedUploadUrl')
  async getSignedUploadUrl(
    @Args('request') request: graphql.RegisterPdfUploadUrlRequest
  ): Promise<graphql.SignedS3UploadResult> {
    try {
      const result = await this.libraryItemService.getPdfUploadUrl({
        fileName: request.fileName
      });

      return {
        uploadUrl: result.uploadUrl,
        s3Key: result.s3Key,
        expiresAt: result.expiresAt
      };

    } catch (error) {
      throw error;
    }
  }

  @Mutation('createLibraryItem')
  async createLibraryItem(@Args('title') title: string): Promise<graphql.LibraryItemMetadata> {
    try {
      const createLibraryItemDto: CreateLibraryItemDto = {
        title,
        authors: [],
        tags: [],
        collections: []
      };
      
      const newItem = await this.libraryItemService.createLibraryItem(createLibraryItemDto);
      
      // Return the item in the format expected by the GraphQL schema
      return this.transformLibraryItemToMetadata(newItem);
    } catch (error) {
      console.error('Error creating library item:', error);
      throw new Error(`Failed to create library item: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}