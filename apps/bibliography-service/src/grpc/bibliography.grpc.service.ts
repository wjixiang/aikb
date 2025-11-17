import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { bibliographyProto } from 'proto-ts';

interface BibliographyServiceGrpc {
  createLibraryItem(
    request: bibliographyProto.CreateLibraryItemRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }>;
  createLibraryItemWithPdf(
    request: any,
  ): Promise<{ item: bibliographyProto.LibraryItem }>;
  getLibraryItem(
    request: bibliographyProto.GetLibraryItemRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }>;
  searchLibraryItems(
    request: bibliographyProto.SearchLibraryItemsRequest,
  ): Promise<{ items: bibliographyProto.LibraryItem[] }>;
  deleteLibraryItem(
    request: bibliographyProto.DeleteLibraryItemRequest,
  ): Promise<{ success: boolean; message: string }>;
  updateLibraryItemMetadata(
    request: bibliographyProto.UpdateLibraryItemMetadataRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }>;
  updateLibraryItemMarkdown(
    request: bibliographyProto.UpdateLibraryItemMarkdownRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }>;
  getPdfDownloadUrl(
    request: bibliographyProto.GetPdfDownloadUrlRequest,
  ): Promise<{ downloadUrl: string; expiresAt: string }>;
  getPdfUploadUrl(
    request: bibliographyProto.GetPdfUploadUrlRequest,
  ): Promise<{ uploadUrl: string; s3Key: string; expiresAt: string }>;
  addArchiveToItem(
    request: bibliographyProto.AddArchiveToItemRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }>;
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
    this.bibliographyService = this.client.getService<BibliographyServiceGrpc>(
      'BibliographyService',
    );
  }

  async createLibraryItem(
    request: bibliographyProto.CreateLibraryItemRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }> {
    return this.bibliographyService.createLibraryItem(request);
  }

  async getLibraryItem(
    request: bibliographyProto.GetLibraryItemRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }> {
    return this.bibliographyService.getLibraryItem(request);
  }

  async searchLibraryItems(
    request: bibliographyProto.SearchLibraryItemsRequest,
  ): Promise<{ items: bibliographyProto.LibraryItem[] }> {
    return this.bibliographyService.searchLibraryItems(request);
  }

  async deleteLibraryItem(
    request: bibliographyProto.DeleteLibraryItemRequest,
  ): Promise<{ success: boolean; message: string }> {
    return this.bibliographyService.deleteLibraryItem(request);
  }

  async updateLibraryItemMetadata(
    request: bibliographyProto.UpdateLibraryItemMetadataRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }> {
    return this.bibliographyService.updateLibraryItemMetadata(request);
  }

  async updateLibraryItemMarkdown(
    request: bibliographyProto.UpdateLibraryItemMarkdownRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }> {
    return this.bibliographyService.updateLibraryItemMarkdown(request);
  }

  async getPdfDownloadUrl(
    request: bibliographyProto.GetPdfDownloadUrlRequest,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    return this.bibliographyService.getPdfDownloadUrl(request);
  }

  async getPdfUploadUrl(
    request: bibliographyProto.GetPdfUploadUrlRequest,
  ): Promise<{ uploadUrl: string; s3Key: string; expiresAt: string }> {
    return this.bibliographyService.getPdfUploadUrl(request);
  }

  async addArchiveToItem(
    request: bibliographyProto.AddArchiveToItemRequest,
  ): Promise<{ item: bibliographyProto.LibraryItem }> {
    return this.bibliographyService.addArchiveToItem(request);
  }
}
