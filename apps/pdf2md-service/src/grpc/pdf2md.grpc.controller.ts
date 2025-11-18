import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AppService } from '../app/app.service';
import { pdf2mdProto } from 'proto-ts';

@Controller()
export class Pdf2MdGrpcController {
  constructor(private readonly appService: AppService) {}

  @GrpcMethod('Pdf2MdService', 'ConvertPdfToMarkdown')
  async convertPdfToMarkdown(
    request: pdf2mdProto.Pdf2MarkdownRequest,
  ): Promise<pdf2mdProto.Pdf2MarkdownResponse> {
    const result = await this.appService.handlePdf2MdRequest({
      itemId: request.itemId,
      fileType: 'pdf' as const, // FileType is constrained to 'pdf'
      fileSize: request.fileSize,
      fileHash: request.fileHash,
      addDate: new Date(request.addDate), // Convert string to Date
      s3Key: request.s3Key,
      pageCount: request.pageCount,
      wordCount: request.wordCount,
    });

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