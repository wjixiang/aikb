import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { KeywordSearchService } from '../keyword/keyword-search.service.js';
import { SemanticSearchService } from '../semantic/semantic-search.service.js';
import type {
  SearchQuery,
  SearchResponse,
  SearchResult,
  HybridSearchOptions,
} from './types.js';

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    private prisma: PrismaService,
    private keywordSearch: KeywordSearchService,
    private semanticSearch: SemanticSearchService,
  ) {}

  /**
   * Perform hybrid search combining keyword and semantic search
   */
  async search(
    query: SearchQuery,
    embedding: number[],
    options?: HybridSearchOptions,
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    const limit = query.limit || 20;
    const offset = query.offset || 0;

    // Get keyword and semantic results
    const [keywordResults, semanticResults] = await Promise.all([
      this.keywordSearch.search(query, {
        ...options,
        mode: 'keyword',
      }),
      this.semanticSearch.search(query, embedding, {
        ...options,
        mode: 'semantic',
        embeddingProvider: options?.embeddingProvider || 'alibaba',
        embeddingModel: options?.embeddingModel || 'text-embedding-v4',
      }),
    ]);

    // Combine results with weights
    const combined = this.combineResults(
      keywordResults.results,
      semanticResults.results,
      options?.keywordWeight || 0.5,
      options?.semanticWeight || 0.5,
    );

    // Apply reranking if enabled
    let finalResults = combined;
    if (options?.rerank) {
      finalResults = this.rerankResults(
        finalResults,
        query.query,
        options.rerankTopN || limit,
      );
    }

    // Apply pagination
    const paginatedResults = finalResults.slice(offset, offset + limit);

    const searchTime = Date.now() - startTime;

    return {
      results: paginatedResults,
      total: combined.length,
      limit,
      offset,
      hasMore: offset + paginatedResults.length < combined.length,
      nextCursor:
        offset + paginatedResults.length < combined.length
          ? String(offset + paginatedResults.length)
          : undefined,
      query: query.query,
      searchTime,
    };
  }

  /**
   * Combine keyword and semantic results with weights
   */
  private combineResults(
    keywordResults: SearchResult[],
    semanticResults: SearchResult[],
    keywordWeight: number,
    semanticWeight: number,
  ): SearchResult[] {
    // Normalize weights
    const totalWeight = keywordWeight + semanticWeight;
    const normalizedKeywordWeight = keywordWeight / totalWeight;
    const normalizedSemanticWeight = semanticWeight / totalWeight;

    // Create score map
    const scoreMap = new Map<string, { result: SearchResult; score: number }>();

    // Add keyword scores
    for (const result of keywordResults) {
      const keywordScore = (keywordResults.indexOf(result) + 1) / keywordResults.length;
      const normalizedScore = (keywordResults.length - keywordResults.indexOf(result)) / keywordResults.length;
      scoreMap.set(result.id, {
        result,
        score: normalizedScore * normalizedKeywordWeight,
      });
    }

    // Add semantic scores
    for (const result of semanticResults) {
      const existing = scoreMap.get(result.id);
      if (existing) {
        const semanticScore = 1 - (semanticResults.indexOf(result) / semanticResults.length);
        existing.score += semanticScore * normalizedSemanticWeight;
      } else {
        const semanticScore = (semanticResults.length - semanticResults.indexOf(result)) / semanticResults.length;
        scoreMap.set(result.id, {
          result,
          score: semanticScore * normalizedSemanticWeight,
        });
      }
    }

    // Sort by combined score
    const combined = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => ({
        ...item.result,
        score: item.score,
      }));

    return combined;
  }

  /**
   * Rerank results based on query relevance
   */
  private rerankResults(
    results: SearchResult[],
    query: string,
    topN: number,
  ): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);

    // Score each result based on query term matches
    const scored = results.map((result) => {
      let score = result.score || 0;
      const title = result.articleTitle.toLowerCase();

      // Boost for title matches
      for (const term of queryTerms) {
        if (title.includes(term)) {
          score += 0.1;
        }
      }

      return { result, score };
    });

    // Sort by reranked score
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((item) => item.result);
  }
}
