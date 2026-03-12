import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { KeywordSearchService } from './keyword/keyword-search.service.js';
import { SemanticSearchService } from './semantic/semantic-search.service.js';
import { HybridSearchService } from './hybrid/hybrid-search.service.js';
import { Embedding, defaultEmbeddingConfig } from '@ai-embed/core';
import type {
  SearchQuery,
  SearchResponse,
  SearchOptions,
  EmbeddingTextOptions,
} from './types.js';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private embedding: Embedding;

  constructor(
    private prisma: PrismaService,
    private keywordSearch: KeywordSearchService,
    private semanticSearch: SemanticSearchService,
    private hybridSearch: HybridSearchService,
  ) {
    // Initialize embedding service
    this.embedding = new Embedding({
      provider: process.env.EMBEDDING_PROVIDER as any || 'alibaba',
      config: defaultEmbeddingConfig,
    });
  }

  /**
   * Unified search interface - automatically chooses search mode based on options
   */
  async search(query: SearchQuery, options?: SearchOptions): Promise<SearchResponse> {
    const mode = options?.mode || 'keyword';

    // Generate embedding for semantic/hybrid search
    let embedding: number[] | undefined;
    if (mode === 'semantic' || mode === 'hybrid') {
      const text = await this.buildEmbeddingText(query.query);
      const result = await this.embedding.embed(text, {
        provider: options?.embeddingProvider as any || 'alibaba',
        model: options?.embeddingModel || 'text-embedding-v4',
      });
      embedding = result.embedding;
    }

    switch (mode) {
      case 'keyword':
        return this.keywordSearch.search(query, options);

      case 'semantic':
        if (!embedding) {
          throw new Error('Embedding is required for semantic search');
        }
        return this.semanticSearch.search(query, embedding, {
          ...options,
          embeddingProvider: options?.embeddingProvider || 'alibaba',
          embeddingModel: options?.embeddingModel || 'text-embedding-v4',
        });

      case 'hybrid':
        if (!embedding) {
          throw new Error('Embedding is required for hybrid search');
        }
        return this.hybridSearch.search(query, embedding, {
          ...options,
          keywordWeight: options?.keywordWeight || 0.5,
          semanticWeight: options?.semanticWeight || 0.5,
        });

      default:
        throw new Error(`Unknown search mode: ${mode}`);
    }
  }

  /**
   * Keyword search only
   */
  async keywordSearchOnly(query: SearchQuery, options?: SearchOptions): Promise<SearchResponse> {
    return this.keywordSearch.search(query, options);
  }

  /**
   * Semantic search only
   */
  async semanticSearchOnly(
    query: SearchQuery,
    embedding: number[],
    options?: SearchOptions,
  ): Promise<SearchResponse> {
    return this.semanticSearch.search(query, embedding, {
      ...options,
      embeddingProvider: options?.embeddingProvider || 'alibaba',
      embeddingModel: options?.embeddingModel || 'text-embedding-v4',
    });
  }

  /**
   * Hybrid search
   */
  async hybridSearchOnly(
    query: SearchQuery,
    embedding: number[],
    options?: SearchOptions,
  ): Promise<SearchResponse> {
    return this.hybridSearch.search(query, embedding, {
      ...options,
      keywordWeight: options?.keywordWeight || 0.5,
      semanticWeight: options?.semanticWeight || 0.5,
    });
  }

  /**
   * Build text for embedding from article content
   */
  async buildEmbeddingText(query: string, options?: EmbeddingTextOptions): Promise<string> {
    const parts: string[] = [];

    if (options?.includeTitle !== false) {
      parts.push(query);
    }

    // Limit text length
    const maxLength = options?.maxLength || 4000;
    let text = parts.join('. ');

    if (text.length > maxLength) {
      text = text.substring(0, maxLength);
    }

    return text;
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(query: string, limit?: number): Promise<string[]> {
    return this.keywordSearch.getSuggestions(query, limit);
  }

  /**
   * Get search facets for aggregation
   */
  async getFacets(query: SearchQuery): Promise<{
    years: { value: string; count: number }[];
    journals: { value: string; count: number }[];
    authors: { value: string; count: number }[];
  }> {
    const where = this.buildSimpleWhereClause(query.query);

    const [years, journals, authors] = await Promise.all([
      this.prisma.article.groupBy({
        by: ['journalId'],
        where,
        _count: true,
      }),
      this.prisma.journal.findMany({
        where: {
          articles: {
            some: where,
          },
        },
        select: {
          id: true,
          isoAbbreviation: true,
          _count: {
            select: {
              articles: true,
            },
          },
        },
        take: 20,
      }),
      this.prisma.author.findMany({
        where: {
          articles: {
            some: {
              article: where,
            },
          },
        },
        select: {
          id: true,
          lastName: true,
          _count: {
            select: {
              articles: true,
            },
          },
        },
        take: 20,
      }),
    ]);

    return {
      years: [],
      journals: journals.map((j) => ({
        value: j.isoAbbreviation || j.id,
        count: j._count.articles,
      })),
      authors: authors.map((a) => ({
        value: a.lastName || a.id,
        count: a._count.articles,
      })),
    };
  }

  private buildSimpleWhereClause(query: string): any {
    if (!query) return {};
    return {
      articleTitle: {
        contains: query,
        mode: 'insensitive',
      },
    };
  }
}
