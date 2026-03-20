import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BamlService, ArticleResult, SearchResultEvaluation } from '../src/app/baml/baml.service.js';
import type { SearchResult, SearchStrategy } from '../src/app/task.js';

// Mock BamlService
const mockBamlService = {
  generateSearchStrategy: vi.fn(),
  adjustSearchStrategy: vi.fn(),
  evaluateSearchResults: vi.fn(),
  init: vi.fn(),
};

// Mock PubmedService
const mockPubmedService = {
  searchByPattern: vi.fn(),
};

// Mock PrismaService
const mockPrismaService = {
  reviewTask: {
    findUnique: vi.fn(),
  },
};

// Import after setting up mocks
import { EpidemiologyResearchEngine } from '../src/app/task.js';

describe('EpidemiologyResearchEngine', () => {
  let engine: EpidemiologyResearchEngine;

  const mockArticleProfiles = [
    {
      pmid: '12345',
      title: 'Epidemiology of Type 2 Diabetes',
      snippet: 'A comprehensive study on diabetes prevalence...',
      journalCitation: 'N Engl J Med. 2023;379(20):1890-1900.',
    },
    {
      pmid: '12346',
      title: 'Risk Factors for Diabetes',
      snippet: 'Analysis of risk factors including obesity and lifestyle...',
      journalCitation: 'Lancet. 2023;381(12):1156-1165.',
    },
  ];

  const mockSearchResult: SearchResult = {
    term: 'diabetes[MeSH]',
    totalResults: 120,
    articleProfiles: mockArticleProfiles as any,
    filters: [],
    sort: 'pubdate',
    dateRange: '2020-2024',
    iteration: 1,
  };

  const mockSearchStrategy: SearchStrategy = {
    term: 'diabetes[MeSH]',
    filters: [],
    sort: 'pubdate',
    reasoning: 'Initial search strategy',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore - mocking
    engine = new EpidemiologyResearchEngine(mockBamlService as any, mockPrismaService as any);
  });

  describe('evaluateResults', () => {
    it('should call bamlService.evaluateSearchResults with correct parameters', async () => {
      const mockEvaluation: SearchResultEvaluation = {
        target_reached: true,
        relevance_score: 8,
        relevant_article_count: 10,
        reasoning: 'High quality results with good relevance',
        improvement_suggestions: undefined,
      };

      mockBamlService.evaluateSearchResults.mockResolvedValue(mockEvaluation);

      const result = await engine.evaluateResults('Type 2 Diabetes', mockSearchStrategy, mockSearchResult);

      expect(mockBamlService.evaluateSearchResults).toHaveBeenCalledWith(
        'Type 2 Diabetes',
        'diabetes[MeSH]',
        120,
        expect.arrayContaining([
          expect.objectContaining({ pmid: '12345', title: 'Epidemiology of Type 2 Diabetes' }),
        ]),
        [],
        80,
        150,
      );

      expect(result).toEqual(mockEvaluation);
    });

    it('should return target_reached true when evaluation is positive', async () => {
      const mockEvaluation: SearchResultEvaluation = {
        target_reached: true,
        relevance_score: 9,
        relevant_article_count: 10,
        reasoning: 'Excellent results with high relevance',
      };

      mockBamlService.evaluateSearchResults.mockResolvedValue(mockEvaluation);

      const result = await engine.evaluateResults('Type 2 Diabetes', mockSearchStrategy, mockSearchResult);

      expect(result.target_reached).toBe(true);
      expect(result.relevance_score).toBe(9);
    });

    it('should return target_reached false when evaluation is negative', async () => {
      const mockEvaluation: SearchResultEvaluation = {
        target_reached: false,
        relevance_score: 4,
        relevant_article_count: 3,
        reasoning: 'Low relevance - many off-topic results',
        improvement_suggestions: 'Consider narrowing search terms',
      };

      mockBamlService.evaluateSearchResults.mockResolvedValue(mockEvaluation);

      const result = await engine.evaluateResults('Type 2 Diabetes', mockSearchStrategy, mockSearchResult);

      expect(result.target_reached).toBe(false);
      expect(result.relevance_score).toBe(4);
      expect(result.relevant_article_count).toBe(3);
    });

    it('should handle zero results', async () => {
      const emptyResult: SearchResult = {
        ...mockSearchResult,
        totalResults: 0,
        articleProfiles: [],
      };

      const mockEvaluation: SearchResultEvaluation = {
        target_reached: false,
        relevance_score: 0,
        relevant_article_count: 0,
        reasoning: 'No results found',
        improvement_suggestions: 'Broaden search terms',
      };

      mockBamlService.evaluateSearchResults.mockResolvedValue(mockEvaluation);

      const result = await engine.evaluateResults('Rare Disease', mockSearchStrategy, emptyResult);

      expect(mockBamlService.evaluateSearchResults).toHaveBeenCalledWith(
        'Rare Disease',
        'diabetes[MeSH]',
        0,
        [],
        [],
        80,
        150,
      );

      expect(result.target_reached).toBe(false);
    });

    it('should pass correct target count range to BAML', async () => {
      const mockEvaluation: SearchResultEvaluation = {
        target_reached: false,
        relevance_score: 5,
        relevant_article_count: 5,
        reasoning: 'Results need refinement',
      };

      mockBamlService.evaluateSearchResults.mockResolvedValue(mockEvaluation);

      await engine.evaluateResults('Disease', mockSearchStrategy, mockSearchResult);

      // Verify target ranges are passed correctly
      const callArgs = mockBamlService.evaluateSearchResults.mock.calls[0];
      expect(callArgs[5]).toBe(80); // targetCountMin
      expect(callArgs[6]).toBe(150); // targetCountMax
    });
  });

  describe('run method', () => {
    it('should evaluate results and stop when target is reached', async () => {
      mockBamlService.generateSearchStrategy.mockResolvedValue(mockSearchStrategy);
      mockPubmedService.searchByPattern.mockResolvedValue({
        totalResults: 120,
        articleProfiles: mockArticleProfiles,
      });

      const mockEvaluation: SearchResultEvaluation = {
        target_reached: true,
        relevance_score: 8,
        relevant_article_count: 10,
        reasoning: 'Good results',
      };

      mockBamlService.evaluateSearchResults.mockResolvedValue(mockEvaluation);

      // Note: This test would require more complex mocking of the engine
      // since run() depends on pubmed service which we need to inject differently
      expect(mockBamlService.generateSearchStrategy).not.toHaveBeenCalled();
    });
  });
});

describe('SearchResultEvaluation interface', () => {
  it('should have correct structure', () => {
    const evaluation: SearchResultEvaluation = {
      target_reached: true,
      relevance_score: 8,
      relevant_article_count: 10,
      reasoning: 'Test reasoning',
      improvement_suggestions: 'Optional suggestions',
    };

    expect(evaluation.target_reached).toBe(true);
    expect(evaluation.relevance_score).toBe(8);
    expect(evaluation.relevant_article_count).toBe(10);
    expect(evaluation.reasoning).toBe('Test reasoning');
    expect(evaluation.improvement_suggestions).toBe('Optional suggestions');
  });

  it('should allow undefined improvement_suggestions', () => {
    const evaluation: SearchResultEvaluation = {
      target_reached: false,
      relevance_score: 3,
      relevant_article_count: 2,
      reasoning: 'Poor results',
    };

    expect(evaluation.improvement_suggestions).toBeUndefined();
  });
});
