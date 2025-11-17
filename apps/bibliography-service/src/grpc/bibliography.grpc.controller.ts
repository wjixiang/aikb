import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LibraryItemService } from '../app/library-item/library-item.service';
import { bibliographyProto } from 'proto-ts';

@Controller()
export class BibliographyGrpcController {
  constructor(private readonly libraryItemService: LibraryItemService) {}

  @GrpcMethod('BibliographyService', 'CreateLibraryItem')
  async createLibraryItem(
    request: bibliographyProto.CreateLibraryItemRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    const createLibraryItemDto = {
      title: request.title,
      authors: request.authors.map((author) => ({
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName,
      })),
      abstract: request.abstract,
      publicationYear: request.publicationYear,
      publisher: request.publisher,
      isbn: request.isbn,
      doi: request.doi,
      url: request.url,
      tags: request.tags,
      notes: request.notes,
      collections: request.collections,
      language: request.language,
    };

    const item =
      await this.libraryItemService.createLibraryItem(createLibraryItemDto);
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'CreateLibraryItemWithPdf')
  async createLibraryItemWithPdf(
    request: bibliographyProto.CreateLibraryItemWithPdfRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    const createLibraryItemWithPdfDto = {
      title: request.title,
      authors: request.authors.map((author) => ({
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName,
      })),
      abstract: request.abstract,
      publicationYear: request.publicationYear,
      publisher: request.publisher,
      isbn: request.isbn,
      doi: request.doi,
      url: request.url,
      tags: request.tags,
      notes: request.notes,
      collections: request.collections,
      language: request.language,
      pdfBuffer: Buffer.from(request.pdfBuffer),
      fileName: request.fileName,
      pageCount: request.pageCount,
    };

    const item = await this.libraryItemService.createLibraryItemWithPdfBuffer(
      createLibraryItemWithPdfDto,
    );
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'GetLibraryItem')
  async getLibraryItem(
    request: bibliographyProto.GetLibraryItemRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    const item = await this.libraryItemService.getLibraryItem(request.id);
    if (!item) {
      throw new Error(`Library item with ID ${request.id} not found`);
    }
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'SearchLibraryItems')
  async searchLibraryItems(
    request: bibliographyProto.SearchLibraryItemsRequest,
  ): Promise<bibliographyProto.SearchLibraryItemsResponse> {
    const items = await this.libraryItemService.searchLibraryItems(
      request.query,
      request.tags,
      request.collections,
    );
    return { items: items.map((item) => this.mapLibraryItemToProto(item)) };
  }

  @GrpcMethod('BibliographyService', 'DeleteLibraryItem')
  async deleteLibraryItem(
    request: bibliographyProto.DeleteLibraryItemRequest,
  ): Promise<bibliographyProto.DeleteLibraryItemResponse> {
    const deleted = await this.libraryItemService.deleteLibraryItem(request.id);
    if (!deleted) {
      throw new Error(`Library item with ID ${request.id} not found`);
    }
    return { success: true, message: 'Library item deleted successfully' };
  }

  @GrpcMethod('BibliographyService', 'UpdateLibraryItemMetadata')
  async updateLibraryItemMetadata(
    request: bibliographyProto.UpdateLibraryItemMetadataRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    const updateMetadataDto = {
      title: request.title,
      authors: request.authors?.map((author) => ({
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName,
      })),
      abstract: request.abstract,
      publicationYear: request.publicationYear,
      publisher: request.publisher,
      isbn: request.isbn,
      doi: request.doi,
      url: request.url,
      tags: request.tags,
      notes: request.notes,
      collections: request.collections,
      language: request.language,
      markdownContent: request.markdownContent,
      archives: request.archives?.map((archive) => ({
        fileType: archive.fileType as 'pdf',
        fileSize: archive.fileSize,
        fileHash: archive.fileHash,
        addDate: new Date(archive.addDate),
        s3Key: archive.s3Key,
        pageCount: archive.pageCount,
        wordCount: archive.wordCount,
      })),
    };

    const item = await this.libraryItemService.updateLibraryItemMetadata(
      request.id,
      updateMetadataDto,
    );
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'UpdateLibraryItemMarkdown')
  async updateLibraryItemMarkdown(
    request: bibliographyProto.UpdateLibraryItemMarkdownRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    try {
      const item = await this.libraryItemService.updateLibraryItemMarkdown(
        request.id,
        request.markdownContent,
      );
      console.debug(
        `[DEBUG] Successfully updated item: ${JSON.stringify(item)}`,
      );

      const protoItem = this.mapLibraryItemToProto(item);
      console.debug(
        `[DEBUG] Mapped to proto item: ${JSON.stringify(protoItem)}`,
      );

      return { item: protoItem };
    } catch (error) {
      console.error(`[ERROR] Failed to update library item markdown:`, error);
      throw error;
    }
  }

  @GrpcMethod('BibliographyService', 'GetPdfDownloadUrl')
  async getPdfDownloadUrl(
    request: bibliographyProto.GetPdfDownloadUrlRequest,
  ): Promise<bibliographyProto.PdfDownloadUrlResponse> {
    const result = await this.libraryItemService.getPdfDownloadUrl(request.id);
    return {
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @GrpcMethod('BibliographyService', 'GetPdfUploadUrl')
  async getPdfUploadUrl(
    request: bibliographyProto.GetPdfUploadUrlRequest,
  ): Promise<bibliographyProto.PdfUploadUrlResponse> {
    const pdfUploadUrlDto = {
      fileName: request.fileName,
      expiresIn: request.expiresIn,
    };

    const result =
      await this.libraryItemService.getPdfUploadUrl(pdfUploadUrlDto);
    return {
      uploadUrl: result.uploadUrl,
      s3Key: result.s3Key,
      expiresAt: result.expiresAt,
    };
  }

  @GrpcMethod('BibliographyService', 'AddArchiveToItem')
  async addArchiveToItem(
    request: bibliographyProto.AddArchiveToItemRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    const addItemArchiveDto = {
      fileType: request.fileType as 'pdf',
      fileSize: request.fileSize,
      fileHash: request.fileHash,
      s3Key: request.s3Key,
      pageCount: request.pageCount,
      wordCount: request.wordCount,
    };

    const item = await this.libraryItemService.addArchiveToItem(
      request.id,
      addItemArchiveDto,
    );
    return { item: this.mapLibraryItemToProto(item) };
  }

  private mapLibraryItemToProto(item: any): bibliographyProto.LibraryItem {
    console.debug(
      `[DEBUG] Mapping item to proto: ${JSON.stringify(item.metadata)}`,
    );

    // Helper function to handle date conversion (handles both Date objects and ISO strings)
    const toISOString = (
      date: Date | string | undefined,
      fallback: Date = new Date(),
    ): string => {
      if (!date) return fallback.toISOString();
      if (date instanceof Date) {
        return date.toISOString();
      }
      // If it's already a string, assume it's in ISO format
      return typeof date === 'string' ? date : fallback.toISOString();
    };

    const protoItem = {
      id: item.getItemId(),
      title: item.metadata.title,
      authors: item.metadata.authors.map((author: any) => ({
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName,
      })),
      abstract: item.metadata.abstract,
      publicationYear: item.metadata.publicationYear,
      publisher: item.metadata.publisher,
      isbn: item.metadata.isbn,
      doi: item.metadata.doi,
      url: item.metadata.url,
      tags: item.metadata.tags,
      notes: item.metadata.notes,
      collections: item.metadata.collections,
      dateAdded: toISOString(item.metadata.dateAdded),
      dateModified: toISOString(item.metadata.dateModified),
      language: item.metadata.language,
      markdownContent: item.metadata.markdownContent,
      markdownUpdatedDate: item.metadata.markdownUpdatedDate
        ? toISOString(item.metadata.markdownUpdatedDate)
        : undefined,
      archives: item.metadata.archives.map((archive: any) => ({
        fileType: archive.fileType,
        fileSize: archive.fileSize,
        fileHash: archive.fileHash,
        addDate: toISOString(archive.addDate),
        s3Key: archive.s3Key,
        pageCount: archive.pageCount,
        wordCount: archive.wordCount,
      })),
    };

    console.debug(`[DEBUG] Mapped proto item: ${JSON.stringify(protoItem)}`);
    return protoItem;
  }
}
