import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { bibliographyProto } from 'proto-ts';

@Injectable()
export class BibliographyGrpcClient {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'bibliography',
      protoPath: '/workspace/protos/bibliography.proto',
      url: process.env['BIBLIOGRAPHY_SERVICE_GRPC_URL'] || 'localhost:50051',
    },
  })
  private client!: ClientGrpc;

  private bibliographyServiceService!: bibliographyProto.BibliographyServiceClient;

  onModuleInit() {
    this.bibliographyServiceService =
      this.client.getService<bibliographyProto.BibliographyServiceClient>(
        'BibliographyService',
      );
  }

  createLibraryItem(
    request: bibliographyProto.CreateLibraryItemRequest,
  ): Observable<bibliographyProto.LibraryItemResponse> {
    return this.bibliographyServiceService
      .createLibraryItem(request);
  }

  createLibraryItemWithPdf(
    request: bibliographyProto.CreateLibraryItemWithPdfRequest,
  ): Observable<bibliographyProto.LibraryItemResponse> {
    return this.bibliographyServiceService
      .createLibraryItemWithPdf(request);
  }

  getLibraryItem(
    request: bibliographyProto.GetLibraryItemRequest,
  ): Observable<bibliographyProto.LibraryItemResponse> {
    return this.bibliographyServiceService
      .getLibraryItem(request);
  }

  searchLibraryItems(
    request: bibliographyProto.SearchLibraryItemsRequest,
  ): Observable<bibliographyProto.SearchLibraryItemsResponse> {
    return this.bibliographyServiceService
      .searchLibraryItems(request);
  }

  deleteLibraryItem(
    request: bibliographyProto.DeleteLibraryItemRequest,
  ): Observable<bibliographyProto.DeleteLibraryItemResponse> {
    return this.bibliographyServiceService
      .deleteLibraryItem(request);
  }

  updateLibraryItemMetadata(
    request: bibliographyProto.UpdateLibraryItemMetadataRequest,
  ): Observable<bibliographyProto.LibraryItemResponse> {
    return this.bibliographyServiceService
      .updateLibraryItemMetadata(request);
  }

  updateLibraryItemMarkdown(
    request: bibliographyProto.UpdateLibraryItemMarkdownRequest,
  ): Observable<bibliographyProto.LibraryItemResponse> {
    return this.bibliographyServiceService
      .updateLibraryItemMarkdown(request);
  }

  getPdfDownloadUrl(
    request: bibliographyProto.GetPdfDownloadUrlRequest,
  ): Observable<bibliographyProto.PdfDownloadUrlResponse> {
    return this.bibliographyServiceService
      .getPdfDownloadUrl(request);
  }

  getPdfUploadUrl(
    request: bibliographyProto.GetPdfUploadUrlRequest,
  ): Observable<bibliographyProto.PdfUploadUrlResponse> {
    return this.bibliographyServiceService
      .getPdfUploadUrl(request);
  }

  addArchiveToItem(
    request: bibliographyProto.AddArchiveToItemRequest,
  ): Observable<bibliographyProto.LibraryItemResponse> {
    return this.bibliographyServiceService
      .addArchiveToItem(request);
  }
}