import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ImportService } from './import.service.js';
import {
  ImportArticleDto,
  ImportArticleOptions,
  ImportArticleResult,
} from './dto.js';

@Controller('api/articles')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * Import a single article
   * POST /api/articles/import
   *
   * Example request body:
   * {
   *   "title": "Article Title",
   *   "abstract": "Full abstract text...",
   *   "doi": "10.1234/example",
   *   "pmid": "12345678",
   *   "authors": [
   *     { "lastName": "Smith", "foreName": "John", "initials": "J" }
   *   ],
   *   "journal": {
   *     "title": "Nature",
   *     "isoAbbreviation": "Nature",
   *     "issn": "0028-0836"
   *   },
   *   "publicationDate": "2024-01-15",
   *   "meshHeadings": [
   *     { "descriptorName": "Neoplasms", "majorTopicYN": true }
   *   ],
   *   "embed": true,
   *   "textField": "titleAndAbstract"
   * }
   */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importArticle(
    @Body() data: ImportArticleDto & ImportArticleOptions,
  ): Promise<ImportArticleResult> {
    const { embed, embeddingProvider, embeddingModel, textField, ...articleData } =
      data;

    const options: ImportArticleOptions = {
      embed: embed !== undefined ? embed : true,
      embeddingProvider,
      embeddingModel,
      textField,
    };

    return this.importService.importArticle(articleData, options);
  }

  /**
   * Import multiple articles in batch
   * POST /api/articles/import/batch
   *
   * Example request body:
   * {
   *   "articles": [...],
   *   "embed": true
   * }
   */
  @Post('import/batch')
  @HttpCode(HttpStatus.OK)
  async importArticlesBatch(
    @Body()
    body: {
      articles: (ImportArticleDto & ImportArticleOptions)[];
      embed?: boolean;
      embeddingProvider?: string;
      embeddingModel?: string;
      textField?: 'title' | 'titleAndAbstract' | 'titleAndMesh';
    },
  ): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: ImportArticleResult[];
  }> {
    const { articles, embed, embeddingProvider, embeddingModel, textField } =
      body;

    const defaultOptions: ImportArticleOptions = {
      embed: embed !== undefined ? embed : true,
      embeddingProvider,
      embeddingModel,
      textField,
    };

    const results: ImportArticleResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const articleData of articles) {
      const { embed: articleEmbed, embeddingProvider: articleProvider, embeddingModel: articleModel, textField: articleTextField, ...data } =
        articleData;

      const options: ImportArticleOptions = {
        embed: articleEmbed !== undefined ? articleEmbed : defaultOptions.embed,
        embeddingProvider: articleProvider || defaultOptions.embeddingProvider,
        embeddingModel: articleModel || defaultOptions.embeddingModel,
        textField: articleTextField || defaultOptions.textField,
      };

      try {
        const result = await this.importService.importArticle(data, options);
        results.push(result);
        if (result.success) succeeded++;
        else failed++;
      } catch (error) {
        failed++;
        results.push({
          success: false,
          articleId: '',
          embedded: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      total: articles.length,
      succeeded,
      failed,
      results,
    };
  }
}
