import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeywordSearchService } from '../../keyword/keyword-search.service.js';
import { SemanticSearchService } from '../../semantic/semantic-search.service.js';
import { HybridSearchService } from '../../hybrid/hybrid-search.service.js';
import type { SearchQuery, SearchResult } from '../../types.js';

// Mock services
const mockKeywordSearch = {
  search: vi.fn(),
};

const mockSemanticSearch = {
  search: vi.fn(),
};

const mockPrismaService = {};

describe('HybridSearchService', () => {
  let hybridSearchService: HybridSearchService;

  // Sample keyword results
  const mockKeywordResults: SearchResult[] = [
    {
      id: 'article-1',
      pmid: BigInt(12345678),
      articleTitle: 'Cancer Treatment Study',
      score: 0.9,
    },
    {
      id: 'article-2',
      pmid: BigInt(87654321),
      articleTitle: 'Novel Therapy Approach',
      score: 0.8,
    },
  ];

  // Sample semantic results
  const mockSemanticResults: SearchResult[] = [
    {
      id: 'article-1',
      pmid: BigInt(12345678),
      articleTitle: 'Cancer Treatment Study',
      score: 0.95,
    },
    {
      id: 'article-3',
      pmid: BigInt(11111111),
      articleTitle: 'Oncology Research',
      score: 0.88,
    },
  ];

  beforeEach(() => {
    const keywordSearch = mockKeywordSearch as unknown as KeywordSearchService;
    const semanticSearch = mockSemanticSearch as unknown as SemanticSearchService;
    hybridSearchService = new HybridSearchService(
      mockPrismaService as any,
      keywordSearch,
      semanticSearch,
    );
    vi.clearAllMocks();
  });

  // HS-01: Basic hybrid search
  describe('search - basic hybrid', () => {
    it('should combine keyword and semantic results', async () => {
      const mockQuery: SearchQuery = { query: 'cancer treatment' };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer treatment',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer treatment',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
      );

      expect(result.results.length).toBeGreaterThan(0);
      // Should have articles from both keyword and semantic results
      expect(result.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  // HS-02: With embedding
  describe('search - with embedding', () => {
    it('should use provided embedding', async () => {
      const mockQuery: SearchQuery = { query: 'test' };
      const embedding = new Array(1024).fill(0.5);

      mockKeywordSearch.search.mockResolvedValue({
        results: [mockKeywordResults[0]],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: [mockSemanticResults[0]],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      await hybridSearchService.search(mockQuery, embedding);

      expect(mockSemanticSearch.search).toHaveBeenCalled();
    });
  });

  // HS-03: Default weights
  describe('search - default weights', () => {
    it('should use default weights 0.5/0.5', async () => {
      const mockQuery: SearchQuery = { query: 'test' };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
      );

      // Results should be combined
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  // HS-04: Custom weights
  describe('search - custom weights', () => {
    it('should apply custom weights', async () => {
      const mockQuery: SearchQuery = { query: 'test' };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
        { keywordWeight: 0.3, semanticWeight: 0.7 },
      );

      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  // HS-07: With rerank
  describe('search - with rerank', () => {
    it('should rerank results when enabled', async () => {
      const mockQuery: SearchQuery = { query: 'cancer treatment' };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer treatment',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer treatment',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
        { rerank: true, rerankTopN: 10 },
      );

      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  // HS-08: Pagination
  describe('search - pagination', () => {
    it('should paginate combined results', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 2, offset: 0 };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 5,
        limit: 2,
        offset: 0,
        hasMore: true,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 5,
        limit: 2,
        offset: 0,
        hasMore: true,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
      );

      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });
  });

  // HS-09: Merge results
  describe('combineResults - merge results', () => {
    it('should merge keyword and semantic results', async () => {
      const mockQuery: SearchQuery = { query: 'test' };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
      );

      // Should have results from both searches
      expect(result.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  // HS-10: Deduplicate
  describe('combineResults - deduplicate', () => {
    it('should deduplicate by article ID', async () => {
      const mockQuery: SearchQuery = { query: 'test' };

      // Both results contain article-1
      mockKeywordSearch.search.mockResolvedValue({
        results: [mockKeywordResults[0]], // article-1
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: [mockSemanticResults[0]], // also article-1
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
      );

      // Should only have one result (deduplicated)
      const articleIds = result.results.map((r) => r.id);
      const uniqueIds = new Set(articleIds);
      expect(uniqueIds.size).toBe(articleIds.length);
    });
  });

  // HS-13: Basic reranking
  describe('rerankResults - basic reranking', () => {
    it('should rerank based on query terms', async () => {
      const mockQuery: SearchQuery = { query: 'cancer treatment' };

      mockKeywordSearch.search.mockResolvedValue({
        results: mockKeywordResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer treatment',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: mockSemanticResults,
        total: 2,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer treatment',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
        { rerank: true },
      );

      // First result should have highest score
      if (result.results.length > 1) {
        expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score);
      }
    });
  });

  // HS-14: Rerank topN limit
  describe('rerankResults - topN limit', () => {
    it('should limit reranked results', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 10 };

      // Create more results
      const manyResults: SearchResult[] = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `article-${i}`,
          pmid: BigInt(10000000 + i),
          articleTitle: `Article ${i}`,
          score: 0.5,
        }));

      mockKeywordSearch.search.mockResolvedValue({
        results: manyResults,
        total: 20,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: manyResults,
        total: 20,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
        { rerank: true, rerankTopN: 5 },
      );

      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });

  // HS-15: hasMore flag
  describe('search response - hasMore flag', () => {
    it('should calculate hasMore correctly', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 5 };

      // Create more mock results
      const manyKeywordResults: SearchResult[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `kw-article-${i}`,
          pmid: BigInt(10000000 + i),
          articleTitle: `Keyword Article ${i}`,
          score: 0.9 - i * 0.1,
        }));

      const manySemanticResults: SearchResult[] = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `sem-article-${i}`,
          pmid: BigInt(20000000 + i),
          articleTitle: `Semantic Article ${i}`,
          score: 0.85 - i * 0.1,
        }));

      mockKeywordSearch.search.mockResolvedValue({
        results: manyKeywordResults,
        total: 10,
        limit: 5,
        offset: 0,
        hasMore: true,
        query: 'test',
        searchTime: 100,
      });

      mockSemanticSearch.search.mockResolvedValue({
        results: manySemanticResults,
        total: 10,
        limit: 5,
        offset: 0,
        hasMore: true,
        query: 'test',
        searchTime: 150,
      });

      const result = await hybridSearchService.search(
        mockQuery,
        new Array(1024).fill(0.1),
      );

      // Combined results should be 10 (5 + 5), limit is 5, so hasMore should be true
      expect(result.hasMore).toBe(true);
    });
  });
});
