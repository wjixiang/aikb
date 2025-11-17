import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { pdf2mdProto } from 'proto-ts';

@Injectable()
export class Pdf2MdGrpcClient {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'pdf2md',
      protoPath: '/workspace/protos/pdf2md.proto',
      url: process.env['PDF2MD_SERVICE_GRPC_URL'] || 'localhost:50052',
    },
  })
  private client!: ClientGrpc;

  private pdf2MdService!: pdf2mdProto.Pdf2MdServiceClient;

  onModuleInit() {
    this.pdf2MdService =
      this.client.getService<pdf2mdProto.Pdf2MdServiceClient>('Pdf2MdService');
  }

  async convertPdfToMarkdown(
    request: pdf2mdProto.Pdf2MarkdownRequest,
  ): Promise<pdf2mdProto.Pdf2MarkdownResponse> {
    try {
      const response = await this.pdf2MdService
        .convertPdfToMarkdown(request)
        .toPromise();
      if (!response) {
        throw new Error('Invalid response: missing pdf2md response');
      }
      return response;
    } catch (error) {
      console.error('Error in convertPdfToMarkdown:', error);
      throw error;
    }
  }
}
