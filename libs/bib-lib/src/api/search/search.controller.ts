import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe, BadRequestException } from '@nestjs/common';
import { SearchService } from '../../search/search.service.js';
import { ExportService } from '../../export/export.service.js';
import { SearchQueryParams, SearchMode, ExportFormat, ExportQueryParams } from '../dto/index.js';

@Controller('api')
export class ApiController {
  constructor(
    private readonly searchService: SearchService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Search articles
   * GET /api/search?query=cancer&mode=keyword&limit=20
   */
  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('mode') mode: SearchMode = SearchMode.KEYWORD,
    @Query('authors') authors?: string,
    @Query('journals') journals?: string,
    @Query('yearFrom') yearFrom?: string,
    @Query('yearTo') yearTo?: string,
    @Query('languages') languages?: string,
    @Query('publicationTypes') publicationTypes?: string,
    @Query('meshTerms') meshTerms?: string,
    @Query('similarityType') similarityType?: string,
    @Query('embeddingProvider') embeddingProvider?: string,
    @Query('embeddingModel') embeddingModel?: string,
    @Query('keywordWeight') keywordWeight?: string,
    @Query('semanticWeight') semanticWeight?: string,
    @Query('rerank') rerank?: string,
  ) {
    const params: SearchQueryParams = {
      query: query || '',
      limit: Math.min(Math.max(1, limit), 100),
      offset: Math.max(0, offset),
      mode: mode as SearchMode,
    };

    // Parse arrays
    if (authors) params.authors = authors.split(',');
    if (journals) params.journals = journals.split(',');
    if (languages) params.languages = languages.split(',');
    if (publicationTypes) params.publicationTypes = publicationTypes.split(',');
    if (meshTerms) params.meshTerms = meshTerms.split(',');

    // Parse numbers
    if (yearFrom) params.yearFrom = parseInt(yearFrom, 10);
    if (yearTo) params.yearTo = parseInt(yearTo, 10);
    if (keywordWeight) params.keywordWeight = parseFloat(keywordWeight);
    if (semanticWeight) params.semanticWeight = parseFloat(semanticWeight);
    if (rerank) params.rerank = rerank === 'true';

    // Other options
    if (similarityType) params.similarityType = similarityType as any;
    if (embeddingProvider) params.embeddingProvider = embeddingProvider;
    if (embeddingModel) params.embeddingModel = embeddingModel;

    const result = await this.searchService.search(
      {
        query: params.query,
        limit: params.limit,
        offset: params.offset,
        filters: {
          authors: params.authors,
          journals: params.journals,
          yearFrom: params.yearFrom,
          yearTo: params.yearTo,
          dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
          dateTo: params.dateTo ? new Date(params.dateTo) : undefined,
          languages: params.languages,
          publicationTypes: params.publicationTypes,
          meshTerms: params.meshTerms,
        },
      },
      {
        mode: params.mode,
        embeddingProvider: params.embeddingProvider,
        embeddingModel: params.embeddingModel,
        keywordWeight: params.keywordWeight,
        semanticWeight: params.semanticWeight,
        rerank: params.rerank,
      },
    );

    return result;
  }

  /**
   * Get search suggestions (autocomplete)
   * GET /api/suggestions?query=cancer
   */
  @Get('suggestions')
  async suggestions(
    @Query('query') query: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    if (!query) {
      throw new BadRequestException('Query parameter is required');
    }
    return this.searchService.getSuggestions(query, limit);
  }

  /**
   * Get search facets
   * GET /api/facets?query=cancer
   */
  @Get('facets')
  async facets(@Query('query') query: string) {
    return this.searchService.getFacets({ query: query || '' });
  }

  /**
   * Export search results
   * GET /api/export?query=cancer&format=bibtex
   */
  @Get('export')
  async export(
    @Query('query') query: string,
    @Query('format') format: ExportFormat = ExportFormat.JSON,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('includeAbstract') includeAbstract?: string,
    @Query('includeMesh') includeMesh?: string,
    @Query('includeAuthors') includeAuthors?: string,
    @Query('includeJournal') includeJournal?: string,
  ) {
    // First search to get results
    const searchResult = await this.searchService.search(
      {
        query: query || '',
        limit: Math.min(Math.max(1, limit), 100),
      },
      { mode: SearchMode.KEYWORD },
    );

    // Then export
    const result = this.exportService.export(searchResult.results, {
      format: format as any,
      includeAbstract: includeAbstract === 'true',
      includeMesh: includeMesh === 'true',
      includeAuthors: includeAuthors !== 'false',
      includeJournal: includeJournal !== 'false',
    });

    return {
      ...result,
      total: searchResult.total,
    };
  }

  /**
   * Health check
   * GET /api/health
   */
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
