import { describe, it, expect, vi, beforeEach } from 'vitest';
import WikiEntryProxy from './wikiEntryProxy';
import axios from 'axios';
import { b } from 'baml_client';

// Mock axios and baml
vi.mock('axios');
vi.mock('baml_client');

describe(WikiEntryProxy, () => {
  let wikiProxy: WikiEntryProxy;
  const mockConfig = {
    searchAPiConfig: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    wikiProxy = new WikiEntryProxy(mockConfig);
  });

  it('should search wikipedia and return summarized text', async () => {
    // Mock BAML GenerateWikiSearchPattern response
    const mockSearchParams = {
      language_code: 'en',
      search_query: 'Artificial Intelligence',
      number_of_results: 3,
    };
    vi.mocked(b.GenerateWikiSearchPattern).mockResolvedValue(mockSearchParams);

    // Mock WikiSearchApi.searchWiki response
    const mockSearchResults = [
      {
        title: 'Artificial intelligence',
        description:
          'Artificial intelligence is intelligence demonstrated by machines',
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      },
      {
        title: 'Machine learning',
        description: 'Machine learning is a method of data analysis',
        url: 'https://en.wikipedia.org/wiki/Machine_learning',
      },
    ];

    // Mock WikiSearchApi.getMarkdown response
    const mockMarkdownResult1 = {
      title: 'Artificial intelligence',
      mdStr:
        '# Artificial Intelligence\nArtificial intelligence is intelligence demonstrated by machines...',
      url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    };

    const mockMarkdownResult2 = {
      title: 'Machine learning',
      mdStr:
        '# Machine Learning\nMachine learning is a method of data analysis...',
      url: 'https://en.wikipedia.org/wiki/Machine_learning',
    };

    // Mock the API methods
    wikiProxy.api.searchWiki = vi.fn().mockResolvedValue(mockSearchResults);
    wikiProxy.api.getMarkdown = vi
      .fn()
      .mockResolvedValueOnce(mockMarkdownResult1)
      .mockResolvedValueOnce(mockMarkdownResult2);

    // Mock BAML SummarizeWikiResults response
    const mockSummary =
      'Artificial intelligence and machine learning are related fields...';
    vi.mocked(b.SummarizeWikiResults).mockResolvedValue(mockSummary);

    // Call the search method
    const result = await wikiProxy.search('What is AI?');

    // Verify the result
    expect(result).toBe(mockSummary);

    // Verify BAML functions were called
    expect(b.GenerateWikiSearchPattern).toHaveBeenCalledWith('What is AI?');
    expect(b.SummarizeWikiResults).toHaveBeenCalledWith(
      'What is AI?',
      expect.stringContaining('Artificial Intelligence'),
    );

    // Verify API methods were called
    expect(wikiProxy.api.searchWiki).toHaveBeenCalledWith(mockSearchParams);
    expect(wikiProxy.api.getMarkdown).toHaveBeenCalledTimes(2);
  });

  it('should handle errors when getting markdown content', async () => {
    // Mock BAML GenerateWikiSearchPattern response
    const mockSearchParams = {
      language_code: 'en',
      search_query: 'Artificial Intelligence',
      number_of_results: 1,
    };
    vi.mocked(b.GenerateWikiSearchPattern).mockResolvedValue(mockSearchParams);

    // Mock WikiSearchApi.searchWiki response
    const mockSearchResults = [
      {
        title: 'Artificial intelligence',
        description:
          'Artificial intelligence is intelligence demonstrated by machines',
        url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      },
    ];

    // Mock WikiSearchApi.getMarkdown to throw an error
    wikiProxy.api.searchWiki = vi.fn().mockResolvedValue(mockSearchResults);
    wikiProxy.api.getMarkdown = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    // Mock BAML SummarizeWikiResults response
    const mockSummary =
      'Artificial intelligence is intelligence demonstrated by machines...';
    vi.mocked(b.SummarizeWikiResults).mockResolvedValue(mockSummary);

    // Call the search method
    const result = await wikiProxy.search('What is AI?');

    // Verify the result
    expect(result).toBe(mockSummary);

    // Verify the error was handled gracefully
    expect(wikiProxy.api.getMarkdown).toHaveBeenCalled();
  });

  it('should handle empty search results', async () => {
    // Mock BAML GenerateWikiSearchPattern response
    const mockSearchParams = {
      language_code: 'en',
      search_query: 'Nonexistent Term',
      number_of_results: 3,
    };
    vi.mocked(b.GenerateWikiSearchPattern).mockResolvedValue(mockSearchParams);

    // Mock WikiSearchApi.searchWiki to return empty results
    wikiProxy.api.searchWiki = vi.fn().mockResolvedValue([]);
    wikiProxy.api.getMarkdown = vi.fn();

    // Mock BAML SummarizeWikiResults response
    const mockSummary = 'No information found for Nonexistent Term.';
    vi.mocked(b.SummarizeWikiResults).mockResolvedValue(mockSummary);

    // Call the search method
    const result = await wikiProxy.search('Nonexistent Term');

    // Verify the result
    expect(result).toBe(mockSummary);

    // Verify API methods were called
    expect(wikiProxy.api.searchWiki).toHaveBeenCalledWith(mockSearchParams);
    expect(wikiProxy.api.getMarkdown).not.toHaveBeenCalled();
  });
});
