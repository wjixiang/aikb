import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeywordSearchService } from '../keyword-search.service.js';
import type { SearchQuery, SearchFilters } from '../types.js';

// Mock PrismaService
const mockPrismaService = {
  article: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

describe('KeywordSearchService', () => {
  let keywordSearchService: KeywordSearchService;

  // Sample article data
  const mockArticle = {
    id: 'article-1',
    pmid: BigInt(12345678),
    articleTitle: 'Test Article Title',
    language: 'eng',
    publicationType: 'Journal Article',
    dateCompleted: new Date('2024-01-15'),
    dateRevised: new Date('2024-02-20'),
    publicationStatus: 'completed',
    journal: {
      id: 'journal-1',
      issn: '1234-5678',
      title: 'Test Journal',
      isoAbbreviation: 'Test J',
      volume: '10',
      issue: '2',
      pubYear: 2024,
    },
    authors: [
      {
        author: {
          id: 'author-1',
          lastName: 'Smith',
          foreName: 'John',
          initials: 'JM',
        },
      },
    ],
    meshHeadings: [{ descriptorName: 'Neoplasms', qualifierName: 'drug therapy' }],
    chemicals: [{ registryNumber: '0', nameOfSubstance: 'Test Chemical' }],
    grants: [{ id: 'grant-1', grantId: 'R01', agency: 'NIH', country: 'USA' }],
    articleIds: [{ id: 'id-1', doi: '10.1234/test' }],
  };

  beforeEach(() => {
    keywordSearchService = new KeywordSearchService(mockPrismaService as any);
    vi.clearAllMocks();
  });

  // KS-01: Basic query search
  describe('search - basic query', () => {
    it('should search with basic text query', async () => {
      const mockQuery: SearchQuery = { query: 'cancer' };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      const result = await keywordSearchService.search(mockQuery);

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.query).toBe('cancer');
    });
  });

  // KS-02: Pagination limit
  describe('search - pagination limit', () => {
    it('should respect limit parameter', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 5 };
      const mockResults = Array(5).fill(mockArticle);
      const mockTotal = 100;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      const result = await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // KS-03: Pagination offset
  describe('search - pagination offset', () => {
    it('should respect offset parameter', async () => {
      const mockQuery: SearchQuery = { query: 'test', offset: 10 };
      const mockResults = [mockArticle];
      const mockTotal = 100;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10 }),
      );
    });
  });

  // KS-04: Empty query
  describe('search - empty query', () => {
    it('should return all results for empty query', async () => {
      const mockQuery: SearchQuery = { query: '' };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      const result = await keywordSearchService.search(mockQuery);

      expect(result.total).toBe(1);
    });
  });

  // KS-05: No results
  describe('search - no results', () => {
    it('should return empty results', async () => {
      const mockQuery: SearchQuery = { query: 'nonexistent' };

      mockPrismaService.article.findMany.mockResolvedValue([]);
      mockPrismaService.article.count.mockResolvedValue(0);

      const result = await keywordSearchService.search(mockQuery);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // KS-06: Author filter
  describe('buildWhereClause - author filter', () => {
    it('should build author filter correctly', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { authors: ['Smith', 'Doe'] },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            authors: expect.objectContaining({
              some: expect.objectContaining({
                author: expect.objectContaining({
                  lastName: { in: ['Smith', 'Doe'] },
                }),
              }),
            }),
          }),
        }),
      );
    });
  });

  // KS-07: Journal filter
  describe('buildWhereClause - journal filter', () => {
    it('should build journal filter correctly', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { journals: ['Test J', 'Cancer Res'] },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journal: expect.objectContaining({
              isoAbbreviation: { in: ['Test J', 'Cancer Res'] },
            }),
          }),
        }),
      );
    });
  });

  // KS-08: Year range filter
  describe('buildWhereClause - year range', () => {
    it('should build year range filter', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { yearFrom: 2020, yearTo: 2024 },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journal: expect.objectContaining({
              pubYear: { gte: 2020, lte: 2024 },
            }),
          }),
        }),
      );
    });
  });

  // KS-09: Date range filter
  describe('buildWhereClause - date range', () => {
    it('should build date range filter', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { dateFrom: new Date('2023-01-01'), dateTo: new Date('2024-12-31') },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dateCompleted: { gte: new Date('2023-01-01'), lte: new Date('2024-12-31') },
          }),
        }),
      );
    });
  });

  // KS-10: Language filter
  describe('buildWhereClause - language filter', () => {
    it('should build language filter', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { languages: ['eng', 'chi'] },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            language: { in: ['eng', 'chi'] },
          }),
        }),
      );
    });
  });

  // KS-11: Publication type filter
  describe('buildWhereClause - publication type', () => {
    it('should build publication type filter', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { publicationTypes: ['Journal Article', 'Review'] },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publicationType: { in: ['Journal Article', 'Review'] },
          }),
        }),
      );
    });
  });

  // KS-12: MeSH terms filter
  describe('buildWhereClause - MeSH terms', () => {
    it('should build MeSH terms filter', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: { meshTerms: ['Neoplasms', 'Drug Therapy'] },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            meshHeadings: expect.objectContaining({
              some: expect.objectContaining({
                descriptorName: { in: ['Neoplasms', 'Drug Therapy'] },
              }),
            }),
          }),
        }),
      );
    });
  });

  // KS-14: Combined filters
  describe('buildWhereClause - combined filters', () => {
    it('should combine multiple filters', async () => {
      const mockQuery: SearchQuery = {
        query: 'cancer',
        filters: {
          authors: ['Smith'],
          journals: ['Test J'],
          yearFrom: 2020,
          yearTo: 2024,
        },
      };
      const mockResults = [mockArticle];
      const mockTotal = 1;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      await keywordSearchService.search(mockQuery);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            articleTitle: expect.objectContaining({ contains: 'cancer' }),
            authors: expect.any(Object),
            journal: expect.any(Object),
          }),
        }),
      );
    });
  });

  // KS-17: Search suggestions
  describe('getSuggestions - basic', () => {
    it('should return search suggestions', async () => {
      mockPrismaService.article.findMany.mockResolvedValue([
        { articleTitle: 'Cancer Treatment Study' },
        { articleTitle: 'Cancer Prevention' },
      ]);

      const suggestions = await keywordSearchService.getSuggestions('Cancer');

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toBe('Cancer Treatment Study');
    });
  });

  // KS-18: Search suggestions with limit
  describe('getSuggestions - with limit', () => {
    it('should limit suggestions count', async () => {
      mockPrismaService.article.findMany.mockResolvedValue([
        { articleTitle: 'Cancer Treatment Study' },
        { articleTitle: 'Cancer Prevention' },
      ]);

      const suggestions = await keywordSearchService.getSuggestions('Cancer', 2);

      // Verify that take is passed correctly
      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 2 }),
      );
      expect(suggestions).toHaveLength(2);
    });
  });

  // KS-19: hasMore flag
  describe('search response - hasMore flag', () => {
    it('should calculate hasMore correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 5 };
      const mockResults = Array(5).fill(mockArticle);
      const mockTotal = 20;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      const result = await keywordSearchService.search(mockQuery);

      expect(result.hasMore).toBe(true);
    });
  });

  // KS-20: nextCursor
  describe('search response - nextCursor', () => {
    it('should return nextCursor when applicable', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 5 };
      const mockResults = Array(5).fill(mockArticle);
      const mockTotal = 20;

      mockPrismaService.article.findMany.mockResolvedValue(mockResults);
      mockPrismaService.article.count.mockResolvedValue(mockTotal);

      const result = await keywordSearchService.search(mockQuery);

      // nextCursor = offset + results.length = 0 + 5 = 5
      expect(result.nextCursor).toBe('5');
    });
  });
});
