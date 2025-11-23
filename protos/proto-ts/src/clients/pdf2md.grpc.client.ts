import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { pdf2mdProto } from 'proto-ts';

@Injectable()
export class Pdf2mdGrpcClient {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'pdf2md',
      protoPath: '/workspace/protos/pdf2md.proto',
      url: process.env['PDF2MD_SERVICE_GRPC_URL'] || 'localhost:50051',
    },
  })
  private client!: ClientGrpc;

  private pdf2MdServiceService!: pdf2mdProto.Pdf2MdServiceClient;

  onModuleInit() {
    this.pdf2MdServiceService =
      this.client.getService<pdf2mdProto.Pdf2MdServiceClient>('Pdf2MdService');
  }

  convertPdfToMarkdown(
    request: pdf2mdProto.Pdf2MarkdownRequest,
  ): Observable<pdf2mdProto.Pdf2MarkdownResponse> {
    return this.pdf2MdServiceService.convertPdfToMarkdown(request);
  }
}
