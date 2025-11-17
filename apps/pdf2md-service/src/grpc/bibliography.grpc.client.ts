import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { join } from 'path';
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

  private bibliographyService!: bibliographyProto.BibliographyServiceClient;

  onModuleInit() {
    this.bibliographyService =
      this.client.getService<bibliographyProto.BibliographyServiceClient>(
        'BibliographyService',
      );
  }

  async updateLibraryItemMarkdown(
    request: bibliographyProto.UpdateLibraryItemMarkdownRequest,
  ): Promise<bibliographyProto.LibraryItemResponse> {
    try {
      const response = await this.bibliographyService
        .updateLibraryItemMarkdown(request)
        .toPromise();
      if (!response || !response.item) {
        throw new Error('Invalid response: missing library item');
      }
      return response;
    } catch (error) {
      console.error('Error in updateLibraryItemMarkdown:', error);
      throw error;
    }
  }
}
