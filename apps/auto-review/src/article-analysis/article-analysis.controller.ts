import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ArticleAnalysisService, PdfExtractOptions, PdfExtractResult } from './article-analysis.service.js';

export class ExtractPdfDto {
  url?: string;
  language?: 'en' | 'ch';
  isOcr?: boolean;
  enableFormula?: boolean;
  enableTable?: boolean;
  pageRanges?: string;
  useAgentApi?: boolean;
  useDocling?: boolean;
}

export class ExtractResultResponse {
  success: boolean;
  data?: PdfExtractResult;
  error?: string;
}

@Controller('article-analysis')
export class ArticleAnalysisController {
  constructor(private readonly articleAnalysisService: ArticleAnalysisService) {}

  /**
   * Extract PDF content from URL
   */
  @Post('extract/url')
  @HttpCode(HttpStatus.OK)
  async extractFromUrl(
    @Body() dto: ExtractPdfDto,
  ): Promise<ExtractResultResponse> {
    try {
      if (!dto.url) {
        return { success: false, error: 'URL is required' };
      }

      const result = await this.articleAnalysisService.extractFromUrl({
        url: dto.url,
        language: dto.language || 'ch',
        isOcr: dto.isOcr ?? false,
        enableFormula: dto.enableFormula ?? true,
        enableTable: dto.enableTable ?? true,
        pageRanges: dto.pageRanges,
        useAgentApi: dto.useAgentApi ?? false,
        useDocling: dto.useDocling ?? false,
      });

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract PDF content from local file upload
   */
  @Post('extract/file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, callback) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  async extractFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('language') language?: 'en' | 'ch',
  ): Promise<ExtractResultResponse> {
    try {
      if (!file) {
        return { success: false, error: 'File is required' };
      }

      const result = await this.articleAnalysisService.extractFromFile(file.path, {
        language: language || 'ch',
        useAgentApi: true,
      });

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get task result by ID (Precision API)
   */
  @Get('task/:taskId')
  async getTaskResult(@Param('taskId') taskId: string) {
    try {
      const result = await this.articleAnalysisService.getTaskResult(taskId);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate MinerU token
   */
  @Get('validate-token')
  async validateToken() {
    try {
      const isValid = await this.articleAnalysisService.validateToken();
      return { success: true, data: { isValid } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
