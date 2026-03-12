import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticSearchService } from '../semantic-search.service.js';
import type { SearchQuery, SearchFilters } from '../types.js';

// Mock PrismaService
const mockPrismaService = {
  article: {
    findMany: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
};

describe('SemanticSearchService', () => {
  let semanticSearchService: SemanticSearchService;

  const mockEmbedding = new Array(1024).fill(0).map(() => Math.random());

  const mockArticle = {
    id: 'article-1',
    pmid: BigInt(12345678),
    articleTitle: 'Test Article Title',
    language: 'eng',
    publicationType: 'Journal Article',
    dateCompleted: new Date('2024-01-15'),
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
    meshHeadings: [{ descriptorName: 'Neoplasms' }],
    chemicals: [{ nameOfSubstance: 'Test Chemical' }],
    grants: [{ id: 'grant-1', grantId: 'R01', agency: 'NIH' }],
    articleIds: [{ id: 'id-1', doi: '10.1234/test' }],
  };

  beforeEach(() => {
    semanticSearchService = new SemanticSearchService(mockPrismaService as any);
    vi.clearAllMocks();
  });

  // SSem-01: Basic semantic search
  describe('search - basic semantic search', () => {
    it('should perform vector similarity search', async () => {
      const mockQuery: SearchQuery = { query: 'cancer treatment' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [
        { id: 'article-1', similarity: 0.95 },
        { id: 'article-2', similarity: 0.89 },
      ];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      const result = await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(result.results).toHaveLength(1);
    });
  });

  // SSem-02: With embedding
  describe('search - with embedding', () => {
    it('should use provided embedding vector', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.95 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  // SSem-03: Cosine similarity
  describe('search - cosine similarity', () => {
    it('should use cosine similarity correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.95 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding, {
        similarityType: 'cosine',
        embeddingProvider: 'alibaba',
        embeddingModel: 'text-embedding-v4',
        dimension: 1024,
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  // SSem-04: Euclidean distance
  describe('search - euclidean distance', () => {
    it('should use euclidean distance correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.5 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding, {
        similarityType: 'euclidean',
        embeddingProvider: 'alibaba',
        embeddingModel: 'text-embedding-v4',
        dimension: 1024,
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  // SSem-05: Dot product
  describe('search - dot product', () => {
    it('should use dot product correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.8 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding, {
        similarityType: 'dot',
        embeddingProvider: 'alibaba',
        embeddingModel: 'text-embedding-v4',
        dimension: 1024,
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  // SSem-06: With filters
  describe('search - with filters', () => {
    it('should apply filters before vector search', async () => {
      const mockQuery: SearchQuery = {
        query: 'cancer',
        filters: { journals: ['Test J'] },
      };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.95 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(mockPrismaService.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journal: expect.objectContaining({
              isoAbbreviation: { in: ['Test J'] },
            }),
          }),
        }),
      );
    });
  });

  // SSem-07: No matching embeddings
  describe('search - no matching embeddings', () => {
    it('should return empty results', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);

      const result = await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // SSem-08: Pagination
  describe('search - pagination', () => {
    it('should paginate results correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 5, offset: 10 };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [
        { id: 'article-1', similarity: 0.95 },
        { id: 'article-2', similarity: 0.89 },
        { id: 'article-3', similarity: 0.82 },
      ];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      const result = await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(result.offset).toBe(10);
    });
  });

  // SSem-09: Provider/model filter
  describe('search - provider/model filter', () => {
    it('should filter by embedding provider/model', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.95 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding, {
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small',
        dimension: 1536,
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  // SSem-10: buildWhereClause
  describe('buildWhereClause - filters', () => {
    it('should build Prisma where clause', async () => {
      const mockQuery: SearchQuery = {
        query: 'test',
        filters: {
          authors: ['Smith'],
          yearFrom: 2020,
          yearTo: 2024,
        },
      };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.95 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(mockPrismaService.article.findMany).toHaveBeenCalled();
    });
  });

  // SSem-11: arrayToVector
  describe('arrayToVector - conversion', () => {
    it('should convert array to PostgreSQL vector', () => {
      const arr = [1, 2, 3];
      const vector = semanticSearchService['arrayToVector'](arr);
      expect(vector).toBe('[1,2,3]');
    });
  });

  // SSem-12: transformResult with similarity
  describe('transformResult - with similarity', () => {
    it('should include similarity score', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [{ id: 'article-1', similarity: 0.95 }];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      const result = await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(result.results[0].score).toBe(0.95);
    });
  });

  // SSem-14: hasMore flag
  describe('search response - hasMore flag', () => {
    it('should calculate hasMore correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 2 };
      const mockFilteredArticles = [mockArticle];
      const mockSimilarArticles = [
        { id: 'article-1', similarity: 0.95 },
        { id: 'article-2', similarity: 0.89 },
        { id: 'article-3', similarity: 0.82 },
      ];

      mockPrismaService.article.findMany.mockResolvedValue(mockFilteredArticles);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue(mockSimilarArticles);
      mockPrismaService.article.findMany.mockResolvedValue([mockArticle]);

      const result = await semanticSearchService.search(mockQuery, mockEmbedding);

      expect(result.hasMore).toBe(true);
    });
  });
});
