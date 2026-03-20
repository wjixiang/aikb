import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SearchService } from './search.service.js';
import {
  SearchQueryDto,
  SortOrder,
  SearchResponseDto,
  ArticleDetailResponseDto,
} from './dto/search.dto.js';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('pubmed')
  @HttpCode(HttpStatus.OK)
  async searchPubMed(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    try {
      if (!query.q) {
        throw new BadRequestException('Query parameter "q" is required');
      }

      const result = await this.searchService.searchPubMed({
        term: query.q,
        sort: query.sort || SortOrder.MATCH,
        filter: query.filter || [],
        page: query.page || null,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Get('pubmed/:pmid')
  @HttpCode(HttpStatus.OK)
  async getArticleDetail(@Param('pmid') pmid: string): Promise<ArticleDetailResponseDto> {
    try {
      if (!pmid || !/^\d+$/.test(pmid)) {
        throw new BadRequestException('Valid PMID is required');
      }

      const article = await this.searchService.getArticleDetail(pmid);

      if (!article.title) {
        throw new NotFoundException(`Article with PMID ${pmid} not found`);
      }

      return {
        success: true,
        data: article,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
