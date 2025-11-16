import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { join } from 'path';

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

interface GetLibraryItemRequest {
  id: string;
}

interface SearchLibraryItemsRequest {
  query?: string;
  tags?: string[];
  collections?: string[];
}

interface DeleteLibraryItemRequest {
  id: string;
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

interface GetPdfUploadUrlRequest {
  fileName: string;
  expiresIn?: number;
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

interface BibliographyServiceGrpc {
  createLibraryItem(request: CreateLibraryItemRequest): Promise<{ item: LibraryItem }>;
  createLibraryItemWithPdf(request: any): Promise<{ item: LibraryItem }>;
  getLibraryItem(request: GetLibraryItemRequest): Promise<{ item: LibraryItem }>;
  searchLibraryItems(request: SearchLibraryItemsRequest): Promise<{ items: LibraryItem[] }>;
  deleteLibraryItem(request: DeleteLibraryItemRequest): Promise<{ success: boolean; message: string }>;
  updateLibraryItemMetadata(request: UpdateLibraryItemMetadataRequest): Promise<{ item: LibraryItem }>;
  updateLibraryItemMarkdown(request: UpdateLibraryItemMarkdownRequest): Promise<{ item: LibraryItem }>;
  getPdfDownloadUrl(request: GetPdfDownloadUrlRequest): Promise<{ downloadUrl: string; expiresAt: string }>;
  getPdfUploadUrl(request: GetPdfUploadUrlRequest): Promise<{ uploadUrl: string; s3Key: string; expiresAt: string }>;
  addArchiveToItem(request: AddArchiveToItemRequest): Promise<{ item: LibraryItem }>;
}

@Injectable()
export class BibliographyGrpcClient {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'bibliography',
      protoPath: join(__dirname, '../proto/bibliography.proto'),
      url: 'localhost:50051',
    },
  })
  private client: ClientGrpc;

  private bibliographyService: BibliographyServiceGrpc;

  onModuleInit() {
    this.bibliographyService = this.client.getService<BibliographyServiceGrpc>('BibliographyService');
  }

  async createLibraryItem(request: CreateLibraryItemRequest): Promise<{ item: LibraryItem }> {
    return this.bibliographyService.createLibraryItem(request);
  }

  async getLibraryItem(request: GetLibraryItemRequest): Promise<{ item: LibraryItem }> {
    return this.bibliographyService.getLibraryItem(request);
  }

  async searchLibraryItems(request: SearchLibraryItemsRequest): Promise<{ items: LibraryItem[] }> {
    return this.bibliographyService.searchLibraryItems(request);
  }

  async deleteLibraryItem(request: DeleteLibraryItemRequest): Promise<{ success: boolean; message: string }> {
    return this.bibliographyService.deleteLibraryItem(request);
  }

  async updateLibraryItemMetadata(request: UpdateLibraryItemMetadataRequest): Promise<{ item: LibraryItem }> {
    return this.bibliographyService.updateLibraryItemMetadata(request);
  }

  async updateLibraryItemMarkdown(request: UpdateLibraryItemMarkdownRequest): Promise<{ item: LibraryItem }> {
    return this.bibliographyService.updateLibraryItemMarkdown(request);
  }

  async getPdfDownloadUrl(request: GetPdfDownloadUrlRequest): Promise<{ downloadUrl: string; expiresAt: string }> {
    return this.bibliographyService.getPdfDownloadUrl(request);
  }

  async getPdfUploadUrl(request: GetPdfUploadUrlRequest): Promise<{ uploadUrl: string; s3Key: string; expiresAt: string }> {
    return this.bibliographyService.getPdfUploadUrl(request);
  }

  async addArchiveToItem(request: AddArchiveToItemRequest): Promise<{ item: LibraryItem }> {
    return this.bibliographyService.addArchiveToItem(request);
  }
}