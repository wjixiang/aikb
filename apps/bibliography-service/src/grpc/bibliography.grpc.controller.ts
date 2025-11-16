import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { LibraryItemService } from '../app/library-item/library-item.service';

// Define interfaces based on our protobuf definition
interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
}

interface ItemArchive {
  fileType: string;
  fileSize: number;
  fileHash: string;
  addDate: string;
  s3Key: string;
  pageCount: number;
  wordCount?: number;
}

interface LibraryItem {
  id: string;
  title: string;
  authors: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[];
  dateAdded: string;
  dateModified: string;
  language?: string;
  markdownContent?: string;
  markdownUpdatedDate?: string;
  archives: ItemArchive[];
}

interface CreateLibraryItemRequest {
  title: string;
  authors: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[];
  language?: string;
}

interface CreateLibraryItemWithPdfRequest {
  title: string;
  authors: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags: string[];
  notes?: string;
  collections: string[];
  language?: string;
  pdfBuffer: Uint8Array;
  fileName?: string;
  pageCount: number;
}

interface GetLibraryItemRequest {
  id: string;
}

interface SearchLibraryItemsRequest {
  query?: string;
  tags?: string[];
  collections?: string[];
}

interface SearchLibraryItemsResponse {
  items: LibraryItem[];
}

interface DeleteLibraryItemRequest {
  id: string;
}

interface DeleteLibraryItemResponse {
  success: boolean;
  message: string;
}

interface UpdateLibraryItemMetadataRequest {
  id: string;
  title?: string;
  authors?: Author[];
  abstract?: string;
  publicationYear?: number;
  publisher?: string;
  isbn?: string;
  doi?: string;
  url?: string;
  tags?: string[];
  notes?: string;
  collections?: string[];
  language?: string;
  markdownContent?: string;
  archives?: ItemArchive[];
}

interface UpdateLibraryItemMarkdownRequest {
  id: string;
  markdownContent: string;
}

interface GetPdfDownloadUrlRequest {
  id: string;
}

interface PdfDownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

interface GetPdfUploadUrlRequest {
  fileName: string;
  expiresIn?: number;
}

interface PdfUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
}

interface AddArchiveToItemRequest {
  id: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  s3Key: string;
  pageCount: number;
  wordCount?: number;
}

interface LibraryItemResponse {
  item: LibraryItem;
}

@Controller()
export class BibliographyGrpcController {
  constructor(private readonly libraryItemService: LibraryItemService) {}

  @GrpcMethod('BibliographyService', 'CreateLibraryItem')
  async createLibraryItem(request: CreateLibraryItemRequest): Promise<LibraryItemResponse> {
    const createLibraryItemDto = {
      title: request.title,
      authors: request.authors.map(author => ({
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

    const item = await this.libraryItemService.createLibraryItem(createLibraryItemDto);
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'CreateLibraryItemWithPdf')
  async createLibraryItemWithPdf(request: CreateLibraryItemWithPdfRequest): Promise<LibraryItemResponse> {
    const createLibraryItemWithPdfDto = {
      title: request.title,
      authors: request.authors.map(author => ({
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

    const item = await this.libraryItemService.createLibraryItemWithPdfBuffer(createLibraryItemWithPdfDto);
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'GetLibraryItem')
  async getLibraryItem(request: GetLibraryItemRequest): Promise<LibraryItemResponse> {
    const item = await this.libraryItemService.getLibraryItem(request.id);
    if (!item) {
      throw new Error(`Library item with ID ${request.id} not found`);
    }
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'SearchLibraryItems')
  async searchLibraryItems(request: SearchLibraryItemsRequest): Promise<SearchLibraryItemsResponse> {
    const items = await this.libraryItemService.searchLibraryItems(
      request.query,
      request.tags,
      request.collections,
    );
    return { items: items.map(item => this.mapLibraryItemToProto(item)) };
  }

  @GrpcMethod('BibliographyService', 'DeleteLibraryItem')
  async deleteLibraryItem(request: DeleteLibraryItemRequest): Promise<DeleteLibraryItemResponse> {
    const deleted = await this.libraryItemService.deleteLibraryItem(request.id);
    if (!deleted) {
      throw new Error(`Library item with ID ${request.id} not found`);
    }
    return { success: true, message: 'Library item deleted successfully' };
  }

  @GrpcMethod('BibliographyService', 'UpdateLibraryItemMetadata')
  async updateLibraryItemMetadata(request: UpdateLibraryItemMetadataRequest): Promise<LibraryItemResponse> {
    const updateMetadataDto = {
      title: request.title,
      authors: request.authors?.map(author => ({
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
      archives: request.archives?.map(archive => ({
        fileType: archive.fileType as 'pdf',
        fileSize: archive.fileSize,
        fileHash: archive.fileHash,
        addDate: new Date(archive.addDate),
        s3Key: archive.s3Key,
        pageCount: archive.pageCount,
        wordCount: archive.wordCount,
      })),
    };

    const item = await this.libraryItemService.updateLibraryItemMetadata(request.id, updateMetadataDto);
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'UpdateLibraryItemMarkdown')
  async updateLibraryItemMarkdown(request: UpdateLibraryItemMarkdownRequest): Promise<LibraryItemResponse> {
    const item = await this.libraryItemService.updateLibraryItemMarkdown(request.id, request.markdownContent);
    return { item: this.mapLibraryItemToProto(item) };
  }

  @GrpcMethod('BibliographyService', 'GetPdfDownloadUrl')
  async getPdfDownloadUrl(request: GetPdfDownloadUrlRequest): Promise<PdfDownloadUrlResponse> {
    const result = await this.libraryItemService.getPdfDownloadUrl(request.id);
    return {
      downloadUrl: result.downloadUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @GrpcMethod('BibliographyService', 'GetPdfUploadUrl')
  async getPdfUploadUrl(request: GetPdfUploadUrlRequest): Promise<PdfUploadUrlResponse> {
    const pdfUploadUrlDto = {
      fileName: request.fileName,
      expiresIn: request.expiresIn,
    };

    const result = await this.libraryItemService.getPdfUploadUrl(pdfUploadUrlDto);
    return {
      uploadUrl: result.uploadUrl,
      s3Key: result.s3Key,
      expiresAt: result.expiresAt,
    };
  }

  @GrpcMethod('BibliographyService', 'AddArchiveToItem')
  async addArchiveToItem(request: AddArchiveToItemRequest): Promise<LibraryItemResponse> {
    const addItemArchiveDto = {
      fileType: request.fileType as 'pdf',
      fileSize: request.fileSize,
      fileHash: request.fileHash,
      s3Key: request.s3Key,
      pageCount: request.pageCount,
      wordCount: request.wordCount,
    };

    const item = await this.libraryItemService.addArchiveToItem(request.id, addItemArchiveDto);
    return { item: this.mapLibraryItemToProto(item) };
  }

  private mapLibraryItemToProto(item: any): LibraryItem {
    return {
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
      dateAdded: item.metadata.dateAdded.toISOString(),
      dateModified: item.metadata.dateModified.toISOString(),
      language: item.metadata.language,
      markdownContent: item.metadata.markdownContent,
      markdownUpdatedDate: item.metadata.markdownUpdatedDate?.toISOString(),
      archives: item.metadata.archives.map((archive: any) => ({
        fileType: archive.fileType,
        fileSize: archive.fileSize,
        fileHash: archive.fileHash,
        addDate: archive.addDate.toISOString(),
        s3Key: archive.s3Key,
        pageCount: archive.pageCount,
        wordCount: archive.wordCount,
      })),
    };
  }
}