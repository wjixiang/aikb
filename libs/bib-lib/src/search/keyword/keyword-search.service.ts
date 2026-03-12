import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  SearchQuery,
  SearchResponse,
  SearchResult,
  KeywordSearchOptions,
  SearchFilters,
} from './types.js';

@Injectable()
export class KeywordSearchService {
  private readonly logger = new Logger(KeywordSearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Perform keyword search on articles
   */
  async search(query: SearchQuery, options?: KeywordSearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();

    const limit = query.limit || 20;
    const offset = query.offset || 0;

    // Build where clause
    const where = this.buildWhereClause(query.query, query.filters);

    // Execute search
    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { pmid: 'desc' },
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
      }),
      this.prisma.article.count({ where }),
    ]);

    // Transform results with highlights
    const results = articles.map((article) => this.transformResult(article, query.query));

    const searchTime = Date.now() - startTime;

    return {
      results,
      total,
      limit,
      offset,
      hasMore: offset + results.length < total,
      nextCursor: offset + results.length < total ? String(offset + results.length) : undefined,
      query: query.query,
      searchTime,
    };
  }

  /**
   * Build Prisma where clause from search query
   */
  private buildWhereClause(query: string, filters?: SearchFilters): any {
    const where: any = {};

    // Text search on title
    if (query) {
      where.articleTitle = {
        contains: query,
        mode: 'insensitive',
      };
    }

    if (!filters) return where;

    // Author filter
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

    // Journal filter
    if (filters.journals && filters.journals.length > 0) {
      where.journal = {
        isoAbbreviation: {
          in: filters.journals,
        },
      };
    }

    // Year range
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

    // Date range
    if (filters.dateFrom || filters.dateTo) {
      where.dateCompleted = {};
      if (filters.dateFrom) {
        where.dateCompleted.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.dateCompleted.lte = filters.dateTo;
      }
    }

    // Language filter
    if (filters.languages && filters.languages.length > 0) {
      where.language = {
        in: filters.languages,
      };
    }

    // Publication type
    if (filters.publicationTypes && filters.publicationTypes.length > 0) {
      where.publicationType = {
        in: filters.publicationTypes,
      };
    }

    // MeSH terms
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
   * Transform Prisma result to search result with highlights
   */
  private transformResult(article: any, query?: string): SearchResult {
    const result: SearchResult = {
      id: article.id,
      pmid: article.pmid,
      articleTitle: article.articleTitle,
      language: article.language,
      publicationType: article.publicationType,
      dateCompleted: article.dateCompleted,
      dateRevised: article.dateRevised,
      publicationStatus: article.publicationStatus,
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

    // Add highlights if query is provided
    if (query) {
      result.highlights = this.generateHighlights(article.articleTitle, query);
    }

    return result;
  }

  /**
   * Generate highlighted snippets for search results
   */
  private generateHighlights(text: string, query: string): string[] {
    if (!text || !query) return [];

    const highlights: string[] = [];
    const normalizedText = text.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);

    // Create highlight markers
    const highlightStart = '<mark>';
    const highlightEnd = '</mark>';

    // Exact phrase match highlight
    const phraseIndex = normalizedText.indexOf(normalizedQuery);
    if (phraseIndex !== -1) {
      const start = Math.max(0, phraseIndex - 50);
      const end = Math.min(text.length, phraseIndex + query.length + 50);
      let snippet = text.slice(start, end);
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';

      // Wrap the matching phrase
      const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
      snippet = snippet.replace(regex, `${highlightStart}$1${highlightEnd}`);
      highlights.push(snippet);
    } else {
      // Match individual words
      for (const word of queryWords) {
        const wordIndex = normalizedText.indexOf(word);
        if (wordIndex !== -1) {
          const start = Math.max(0, wordIndex - 40);
          const end = Math.min(text.length, wordIndex + word.length + 40);
          let snippet = text.slice(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < text.length) snippet = snippet + '...';

          // Wrap the matching word
          const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
          snippet = snippet.replace(regex, `${highlightStart}$1${highlightEnd}`);

          // Avoid duplicates
          if (!highlights.some(h => h.includes(snippet))) {
            highlights.push(snippet);
          }
        }
      }
    }

    // Limit to 3 highlights
    return highlights.slice(0, 3);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(query: string, limit: number = 10): Promise<string[]> {
    const articles = await this.prisma.article.findMany({
      where: {
        articleTitle: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: limit,
      select: {
        articleTitle: true,
      },
      orderBy: {
        pmid: 'desc',
      },
    });

    return articles.map((a) => a.articleTitle);
  }
}
