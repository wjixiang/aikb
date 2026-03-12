import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KeywordSearchService } from '../keyword/keyword-search.service.js';
import { SemanticSearchService } from '../semantic/semantic-search.service.js';
import { HybridSearchService } from '../hybrid/hybrid-search.service.js';
import type { SearchQuery, SearchResult } from '../types.js';

// Mock dependencies
const mockKeywordSearch = {
  search: vi.fn(),
  getSuggestions: vi.fn(),
};

const mockSemanticSearch = {
  search: vi.fn(),
};

const mockHybridSearch = {
  search: vi.fn(),
};

const mockPrismaService = {};

describe('SearchService', () => {
  let searchService: SearchService;

  const mockSearchResult: SearchResult = {
    id: 'article-1',
    pmid: BigInt(12345678),
    articleTitle: 'Test Article',
    score: 0.95,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamically import SearchService to avoid vi.mock issues
    const { SearchService } = await import('../search.service.js');

    const keywordSearch = mockKeywordSearch as unknown as KeywordSearchService;
    const semanticSearch = mockSemanticSearch as unknown as SemanticSearchService;
    const hybridSearch = mockHybridSearch as unknown as HybridSearchService;

    searchService = new SearchService(
      mockPrismaService as any,
      keywordSearch,
      semanticSearch,
      hybridSearch,
    );
  });

  // USS-01: Keyword mode
  describe('search - keyword mode', () => {
    it('should route to keyword search', async () => {
      const mockQuery: SearchQuery = { query: 'cancer', limit: 20 };

      mockKeywordSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer',
        searchTime: 100,
      });

      const result = await searchService.search(mockQuery, { mode: 'keyword' });

      expect(mockKeywordSearch.search).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });
  });

  // USS-02: Semantic mode
  describe('search - semantic mode', () => {
    it('should route to semantic search', async () => {
      const mockQuery: SearchQuery = { query: 'cancer', limit: 20 };
      const embedding = new Array(1024).fill(0.1);

      mockSemanticSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer',
        searchTime: 150,
      });

      // Use semanticSearchOnly which takes embedding directly
      const result = await searchService.semanticSearchOnly(mockQuery, embedding, {
        embeddingProvider: 'alibaba',
        embeddingModel: 'text-embedding-v4',
      });

      expect(mockSemanticSearch.search).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });
  });

  // USS-03: Hybrid mode
  describe('search - hybrid mode', () => {
    it('should route to hybrid search', async () => {
      const mockQuery: SearchQuery = { query: 'cancer', limit: 20 };
      const embedding = new Array(1024).fill(0.1);

      mockHybridSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'cancer',
        searchTime: 200,
      });

      // Use hybridSearchOnly which takes embedding directly
      const result = await searchService.hybridSearchOnly(mockQuery, embedding);

      expect(mockHybridSearch.search).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });
  });

  // USS-04: Default mode
  describe('search - default mode', () => {
    it('should use keyword mode by default', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 20 };

      mockKeywordSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      const result = await searchService.search(mockQuery);

      expect(mockKeywordSearch.search).toHaveBeenCalled();
    });
  });

  // USS-07: keywordSearchOnly
  describe('keywordSearchOnly - basic', () => {
    it('should call keyword search directly', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 20 };

      mockKeywordSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 100,
      });

      const result = await searchService.keywordSearchOnly(mockQuery);

      expect(mockKeywordSearch.search).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });
  });

  // USS-08: semanticSearchOnly
  describe('semanticSearchOnly - with embedding', () => {
    it('should call semantic search with embedding', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 20 };
      const embedding = new Array(1024).fill(0.1);

      mockSemanticSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 150,
      });

      const result = await searchService.semanticSearchOnly(mockQuery, embedding);

      expect(mockSemanticSearch.search).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });
  });

  // USS-09: hybridSearchOnly
  describe('hybridSearchOnly - with embedding', () => {
    it('should call hybrid search with embedding', async () => {
      const mockQuery: SearchQuery = { query: 'test', limit: 20 };
      const embedding = new Array(1024).fill(0.1);

      mockHybridSearch.search.mockResolvedValue({
        results: [mockSearchResult],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
        query: 'test',
        searchTime: 200,
      });

      const result = await searchService.hybridSearchOnly(mockQuery, embedding);

      expect(mockHybridSearch.search).toHaveBeenCalled();
      expect(result.results.length).toBe(1);
    });
  });

  // USS-10: buildEmbeddingText
  describe('buildEmbeddingText - basic', () => {
    it('should build text for embedding', async () => {
      const text = await searchService.buildEmbeddingText('cancer treatment');

      expect(text).toContain('cancer treatment');
    });
  });

  // USS-11: buildEmbeddingText with max length
  describe('buildEmbeddingText - max length', () => {
    it('should truncate to max length', async () => {
      const longText = 'cancer '.repeat(1000);
      const text = await searchService.buildEmbeddingText(longText, { maxLength: 100 });

      expect(text.length).toBeLessThanOrEqual(100);
    });
  });

  // USS-12: getSuggestions
  describe('getSuggestions - basic', () => {
    it('should return suggestions from keyword service', async () => {
      mockKeywordSearch.getSuggestions.mockResolvedValue([
        'Cancer Treatment',
        'Cancer Research',
      ]);

      const suggestions = await searchService.getSuggestions('Cancer');

      expect(mockKeywordSearch.getSuggestions).toHaveBeenCalledWith('Cancer', undefined);
      expect(suggestions).toHaveLength(2);
    });
  });
});
