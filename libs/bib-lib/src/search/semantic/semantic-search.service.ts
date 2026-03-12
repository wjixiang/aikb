import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  SearchQuery,
  SearchResponse,
  SearchResult,
  SemanticSearchOptions,
  SearchFilters,
} from './types.js';

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Perform semantic (vector) search on articles
   */
  async search(
    query: SearchQuery,
    embedding: number[],
    options?: SemanticSearchOptions,
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    const limit = query.limit || 20;
    const offset = query.offset || 0;

    const similarityType = options?.similarityType || 'cosine';
    const topN = options?.topN || limit + offset;

    // Build where clause for filters
    const where = this.buildWhereClause(query.filters);

    // Get article IDs that match filters first
    const filteredArticleIds = await this.prisma.article.findMany({
      where,
      select: { id: true },
    });

    if (filteredArticleIds.length === 0) {
      return {
        results: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
        query: query.query,
        searchTime: Date.now() - startTime,
      };
    }

    const articleIdSet = new Set(filteredArticleIds.map((a) => a.id));

    // Use raw SQL for vector similarity search
    const articleIdArray = Array.from(articleIdSet);
    const vectorStr = this.arrayToVector(embedding);

    let similarityExpr: string;
    switch (similarityType) {
      case 'cosine':
        similarityExpr = '1 - (ae.vector <=> $1::vector)';
        break;
      case 'euclidean':
        similarityExpr = 'ae.vector <#> $1::vector';
        break;
      case 'dot':
        similarityExpr = 'ae.vector <#> $1::vector';
        break;
      default:
        similarityExpr = '1 - (ae.vector <=> $1::vector)';
    }

    // Build the IN clause safely
    const inClause = articleIdArray.map((id) => `'${id}'`).join(', ');
    const sql = `
      SELECT
        ae."articleId" as id,
        ${similarityExpr} as similarity
      FROM "ArticleEmbedding" ae
      WHERE ae."articleId" IN (${inClause})
        AND ae."isActive" = true
        AND ae.provider = $2
        AND ae.model = $3
      ORDER BY ae.vector <=> $1::vector
      LIMIT ${topN}
    `;

    const similarArticles = await this.prisma.$queryRawUnsafe<{ id: string; similarity: number }[]>(
      sql,
      vectorStr,
      options?.embeddingProvider || 'alibaba',
      options?.embeddingModel || 'text-embedding-v4',
    );

    if (similarArticles.length === 0) {
      return {
        results: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
        query: query.query,
        searchTime: Date.now() - startTime,
      };
    }

    // Get paginated results
    const paginatedResults = similarArticles.slice(offset, offset + limit);
    const articleIds = paginatedResults.map((r) => r.id);

    // Get full article data
    const articles = await this.prisma.article.findMany({
      where: { id: { in: articleIds } },
      include: {
        journal: true,
        authors: {
          include: {
            author: true,
          },
        },
        meshHeadings: {
          take: 10,
        },
        chemicals: {
          take: 10,
        },
        grants: {
          take: 5,
        },
        articleIds: true,
      },
    });

    // Map similarity scores
    const similarityMap = new Map(paginatedResults.map((r) => [r.id, r.similarity]));

    // Transform results
    const results = articles
      .map((article) => this.transformResult(article, similarityMap.get(article.id)))
      .filter(Boolean) as SearchResult[];

    const searchTime = Date.now() - startTime;

    return {
      results,
      total: similarArticles.length,
      limit,
      offset,
      hasMore: offset + results.length < similarArticles.length,
      nextCursor:
        offset + results.length < similarArticles.length
          ? String(offset + results.length)
          : undefined,
      query: query.query,
      searchTime,
    };
  }

  /**
   * Build where clause from filters
   */
  private buildWhereClause(filters?: SearchFilters): any {
    const where: any = {};

    if (!filters) return where;

    if (filters.authors && filters.authors.length > 0) {
      where.authors = {
        some: {
          author: {
            lastName: {
              in: filters.authors,
            },
          },
        },
      };
    }

    if (filters.journals && filters.journals.length > 0) {
      where.journal = {
        isoAbbreviation: {
          in: filters.journals,
        },
      };
    }

    if (filters.yearFrom || filters.yearTo) {
      where.journal = where.journal || {};
      where.journal.pubYear = {};
      if (filters.yearFrom) {
        where.journal.pubYear.gte = filters.yearFrom;
      }
      if (filters.yearTo) {
        where.journal.pubYear.lte = filters.yearTo;
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      where.dateCompleted = {};
      if (filters.dateFrom) {
        where.dateCompleted.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.dateCompleted.lte = filters.dateTo;
      }
    }

    if (filters.languages && filters.languages.length > 0) {
      where.language = {
        in: filters.languages,
      };
    }

    if (filters.publicationTypes && filters.publicationTypes.length > 0) {
      where.publicationType = {
        in: filters.publicationTypes,
      };
    }

    if (filters.meshTerms && filters.meshTerms.length > 0) {
      where.meshHeadings = {
        some: {
          descriptorName: {
            in: filters.meshTerms,
          },
        },
      };
    }

    return where;
  }

  /**
   * Transform Prisma result to search result
   */
  private transformResult(article: any, score?: number): SearchResult {
    return {
      id: article.id,
      pmid: article.pmid,
      articleTitle: article.articleTitle,
      language: article.language,
      publicationType: article.publicationType,
      dateCompleted: article.dateCompleted,
      dateRevised: article.dateRevised,
      publicationStatus: article.publicationStatus,
      score: score,
      journal: article.journal
        ? {
            id: article.journal.id,
            issn: article.journal.issn,
            title: article.journal.title,
            isoAbbreviation: article.journal.isoAbbreviation,
            volume: article.journal.volume,
            issue: article.journal.issue,
            pubYear: article.journal.pubYear,
          }
        : undefined,
      authors: article.authors?.map((aa: any) => ({
        id: aa.author.id,
        lastName: aa.author.lastName,
        foreName: aa.author.foreName,
        initials: aa.author.initials,
      })),
      meshHeadings: article.meshHeadings?.map((m: any) => m.descriptorName),
      chemicals: article.chemicals?.map((c: any) => c.nameOfSubstance),
      grants: article.grants?.map((g: any) => ({
        id: g.id,
        grantId: g.grantId,
        agency: g.agency,
        country: g.country,
      })),
      articleIds: article.articleIds?.map((ai: any) => ({
        id: ai.id,
        doi: ai.doi,
        pii: ai.pii,
        pmc: ai.pmc,
      })),
    };
  }

  /**
   * Convert array to PostgreSQL vector string
   */
  private arrayToVector(arr: number[]): string {
    return `[${arr.join(',')}]`;
  }
}
