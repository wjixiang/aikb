import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from '../app/app.service';

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

@Controller()
export class Pdf2MdGrpcController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod('Pdf2MdService', 'ConvertPdfToMarkdown')
  async convertPdfToMarkdown(request: Pdf2MarkdownRequest): Promise<Pdf2MarkdownResponse> {
    const pdf2MarkdownDto = {
      itemId: request.itemId,
      fileType: request.fileType as 'pdf',
      fileSize: request.fileSize,
      fileHash: request.fileHash,
      addDate: new Date(request.addDate),
      s3Key: request.s3Key,
      pageCount: request.pageCount,
      wordCount: request.wordCount,
    };

    const result = await this.appService.handlePdf2MdRequest(pdf2MarkdownDto);
    
    return {
      itemId: result.itemId,
      pageNum: result.pageNum,
      chunked: result.chunked,
      chunkCount: result.chunkCount,
      chunkSize: result.chunkSize,
      markdownContent: result.markdownContent,
      chunks: result.chunks?.map(chunk => ({
        chunkIndex: chunk.chunkIndex,
        startPage: chunk.startPage,
        endPage: chunk.endPage,
        s3Url: chunk.s3Url,
        fileName: chunk.fileName,
      })) || [],
    };
  }
}