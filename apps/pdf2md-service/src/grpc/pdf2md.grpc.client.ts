import { Client, Transport, type ClientGrpc } from '@nestjs/microservices';
import { Injectable } from '@nestjs/common';
import { join } from 'path';

// Define interfaces based on our protobuf definition
interface PdfChunk {
  chunkIndex: number;
  startPage: number;
  endPage: number;
  s3Url: string;
  fileName: string;
}

interface Pdf2MarkdownRequest {
  itemId: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  addDate: string;
  s3Key: string;
  pageCount: number;
  wordCount?: number;
}

interface Pdf2MarkdownResponse {
  itemId: string;
  pageNum: number;
  chunked: boolean;
  chunkCount?: number;
  chunkSize?: number;
  markdownContent: string;
  chunks: PdfChunk[];
}

interface Pdf2MdServiceGrpc {
  convertPdfToMarkdown(request: Pdf2MarkdownRequest): Promise<Pdf2MarkdownResponse>;
}

@Injectable()
export class Pdf2MdGrpcClient {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'pdf2md',
      protoPath: join(__dirname, '../proto/pdf2md.proto'),
      url: 'localhost:50052',
    },
  })
  private client!: ClientGrpc;

  private pdf2MdService!: Pdf2MdServiceGrpc;

  onModuleInit() {
    this.pdf2MdService = this.client.getService<Pdf2MdServiceGrpc>('Pdf2MdService');
  }

  async convertPdfToMarkdown(request: Pdf2MarkdownRequest): Promise<Pdf2MarkdownResponse> {
    return this.pdf2MdService.convertPdfToMarkdown(request);
  }
}