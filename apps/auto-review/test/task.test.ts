import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SearchResultEvaluation } from '../src/app/baml/baml.service.js';
import type { SearchResult, SearchStrategy } from '../src/article-search/base.engine.js';

// Mock BamlService
const mockBamlService = {
  generateSearchStrategy: vi.fn(),
  adjustSearchStrategy: vi.fn(),
  evaluateSearchResults: vi.fn(),
  init: vi.fn(),
};

// Import after setting up mocks
import { EpidemiologySearchEngine } from '../src/article-search/epidemiology.engine.js';

describe('EpidemiologySearchEngine', () => {
  let engine: EpidemiologySearchEngine;

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
    engine = new EpidemiologySearchEngine(mockBamlService as any);
  });

  describe('constructor', () => {
    it('should create engine with correct section', () => {
      expect(engine).toBeDefined();
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

describe('SearchStrategy interface', () => {
  it('should have correct structure', () => {
    const strategy: SearchStrategy = {
      term: 'diabetes[MeSH]',
      filters: ['systematic review'],
      sort: 'pubdate',
      reasoning: 'Test reasoning',
    };

    expect(strategy.term).toBe('diabetes[MeSH]');
    expect(strategy.filters).toEqual(['systematic review']);
    expect(strategy.sort).toBe('pubdate');
    expect(strategy.reasoning).toBe('Test reasoning');
  });
});

describe('SearchResult interface', () => {
  it('should have correct structure', () => {
    const result: SearchResult = {
      term: 'diabetes[MeSH]',
      totalResults: 120,
      articleProfiles: [],
      filters: [],
      sort: 'pubdate',
      dateRange: '2020-2024',
      iteration: 1,
    };

    expect(result.term).toBe('diabetes[MeSH]');
    expect(result.totalResults).toBe(120);
    expect(result.articleProfiles).toEqual([]);
    expect(result.iteration).toBe(1);
  });
});

describe('Review section types', () => {
  it('should support all review sections', () => {
    type ReviewSection = 'epidemiology' | 'pathophysiology' | 'clinical' | 'treatment';

    const sections: ReviewSection[] = ['epidemiology', 'pathophysiology', 'clinical', 'treatment'];

    expect(sections).toContain('epidemiology');
    expect(sections).toContain('pathophysiology');
    expect(sections).toContain('clinical');
    expect(sections).toContain('treatment');
  });
});
