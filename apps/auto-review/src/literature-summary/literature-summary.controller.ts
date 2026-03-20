import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LiteratureSummaryService, LiteratureSummaryResult, PICOExtractionResult } from './literature-summary.service.js';

/**
 * Request DTO for literature summarization
 */
export class SummarizeLiteratureDto {
  /** Full text or extracted content from the paper */
  content: string;
}

/**
 * Request DTO for PICO extraction
 */
export class ExtractPICODto {
  /** Text content to extract PICO from */
  content: string;
}

/**
 * Request DTO for multiple paper summarization
 */
export class SummarizeMultiplePapersDto {
  papers: Array<{
    content: string;
    title?: string;
    citation?: string;
  }>;
}

/**
 * Response wrapper
 */
export class ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  processingTimeMs?: number;
}

@Controller('literature-summary')
export class LiteratureSummaryController {
  constructor(private readonly literatureSummaryService: LiteratureSummaryService) {}

  /**
   * Summarize a single medical literature article
   */
  @Post('summarize')
  @HttpCode(HttpStatus.OK)
  async summarizeLiterature(
    @Body() dto: SummarizeLiteratureDto,
  ): Promise<ApiResponse<any>> {
    try {
      const result: LiteratureSummaryResult =
        await this.literatureSummaryService.summarizeLiterature(dto.content);

      return {
        success: result.success,
        data: result.summary,
        error: result.error,
        processingTimeMs: result.processingTimeMs,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract PICO elements from literature
   */
  @Post('extract-pico')
  @HttpCode(HttpStatus.OK)
  async extractPICO(@Body() dto: ExtractPICODto): Promise<ApiResponse<any>> {
    try {
      const result: PICOExtractionResult =
        await this.literatureSummaryService.extractPICO(dto.content);

      return {
        success: result.success,
        data: {
          population: result.population,
          intervention: result.intervention,
          outcome: result.outcome,
        },
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Summarize multiple papers for systematic review
   */
  @Post('summarize-batch')
  @HttpCode(HttpStatus.OK)
  async summarizeBatch(
    @Body() dto: SummarizeMultiplePapersDto,
  ): Promise<ApiResponse<any>> {
    try {
      const result = await this.literatureSummaryService.summarizeMultiplePapers(
        dto.papers,
      );

      return {
        success: result.success,
        data: {
          summaries: result.summaries,
          synthesis: result.synthesis,
          themes: result.themes,
          conflicts: result.conflicts,
          gaps: result.gaps,
        },
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
