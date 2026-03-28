import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSearchComponent } from '../webSearchComponent.js';
import type {
  WebSearchProvider,
  WebSearchResponse,
  WebSearchResult,
} from '../types.js';

function createMockProvider(
  results: WebSearchResult[] = [],
): WebSearchProvider {
  return {
    name: 'mock',
    search: vi.fn().mockResolvedValue({
      id: 'test-id',
      created: 1700000000,
      requestId: 'test-req',
      intents: [],
      results,
    } as WebSearchResponse),
  };
}

const mockResults: WebSearchResult[] = [
  {
    title: 'CRISPR Gene Therapy Advances',
    content:
      'Recent breakthroughs in CRISPR technology have enabled precise gene editing for therapeutic applications. Researchers have developed new delivery mechanisms that improve targeting accuracy.',
    link: 'https://nature.com/crispr-2024',
    source: 'Nature',
    icon: 'https://nature.com/favicon.ico',
    refer: '1',
    publishDate: '2024-03-15',
  },
  {
    title: 'Gene Therapy Clinical Trials Update',
    content:
      'A comprehensive review of ongoing clinical trials for gene therapy treatments across various diseases.',
    link: 'https://sciencedaily.com/gene-therapy',
    source: 'Science Daily',
    refer: '2',
    publishDate: '2024-02-20',
  },
];

describe('WebSearchComponent', () => {
  let component: WebSearchComponent;
  let mockProvider: WebSearchProvider;

  beforeEach(() => {
    mockProvider = createMockProvider(mockResults);
    component = new WebSearchComponent(mockProvider);
  });

  describe('initialization', () => {
    it('should have correct component metadata', () => {
      expect(component.componentId).toBe('web-search');
      expect(component.displayName).toBe('Web Search');
      expect(component.description).toContain('Web search');
    });

    it('should have component prompt', () => {
      expect(component.componentPrompt).toContain('web search');
      expect(component.componentPrompt).toContain('web_search');
    });

    it('should have initial state', () => {
      const state = (component as any).snapshot;
      expect(state.currentResults).toBeNull();
      expect(state.searchHistory).toEqual([]);
    });
  });

  describe('tool definitions', () => {
    it('should define 4 tools', () => {
      const tools = component.toolSet;
      expect(tools.size).toBe(4);
      expect(tools.has('web_search')).toBe(true);
      expect(tools.has('clear_search')).toBe(true);
      expect(tools.has('get_search')).toBe(true);
      expect(tools.has('export_search')).toBe(true);
    });
  });

  describe('web_search tool', () => {
    it('should perform search and update state', async () => {
      const result = await component.handleToolCall('web_search', {
        query: 'CRISPR gene therapy',
      });

      expect(result.success).toBe(true);
      expect(result.data.resultCount).toBe(2);
      expect(result.data.results).toHaveLength(2);
      expect(result.summary).toContain('CRISPR gene therapy');
      expect(result.summary).toContain('2 results');

      const state = (component as any).snapshot;
      expect(state.currentResults).not.toBeNull();
      expect(state.currentResults.results).toHaveLength(2);
      expect(state.searchHistory).toHaveLength(1);
      expect(state.searchHistory[0].query).toBe('CRISPR gene therapy');
    });

    it('should pass all search params to provider', async () => {
      await component.handleToolCall('web_search', {
        query: 'test query',
        count: 5,
        searchIntent: true,
        domainFilter: 'example.com',
        recencyFilter: 'oneWeek',
        contentSize: 'high',
      });

      expect(mockProvider.search).toHaveBeenCalledWith({
        query: 'test query',
        count: 5,
        searchIntent: true,
        domainFilter: 'example.com',
        recencyFilter: 'oneWeek',
        contentSize: 'high',
      });
    });

    it('should handle provider errors', async () => {
      const errorProvider: WebSearchProvider = {
        name: 'error',
        search: vi.fn().mockRejectedValue(new Error('API rate limited')),
      };
      const errorComponent = new WebSearchComponent(errorProvider);

      const result = await errorComponent.handleToolCall('web_search', {
        query: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toBe('API rate limited');
      expect(result.summary).toContain('Search failed');
    });

    it('should handle non-Error exceptions', async () => {
      const errorProvider: WebSearchProvider = {
        name: 'error',
        search: vi.fn().mockRejectedValue('string error'),
      };
      const errorComponent = new WebSearchComponent(errorProvider);

      const result = await errorComponent.handleToolCall('web_search', {
        query: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toBe('string error');
    });

    it('should accumulate search history', async () => {
      await component.handleToolCall('web_search', { query: 'first search' });
      await component.handleToolCall('web_search', { query: 'second search' });

      const state = (component as any).snapshot;
      expect(state.searchHistory).toHaveLength(2);
      expect(state.searchHistory[0].query).toBe('first search');
      expect(state.searchHistory[1].query).toBe('second search');
    });
  });

  describe('get_search tool', () => {
    it('should return no results message when empty', async () => {
      const result = await component.handleToolCall('get_search', {});

      expect(result.success).toBe(true);
      expect(result.data.results).toEqual([]);
      expect(result.data.message).toContain('No search results');
    });

    it('should return current results', async () => {
      await component.handleToolCall('web_search', { query: 'test query' });
      const result = await component.handleToolCall('get_search', {});

      expect(result.success).toBe(true);
      expect(result.data.resultCount).toBe(2);
      expect(result.data.query).toBe('test query');
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0].title).toBe('CRISPR Gene Therapy Advances');
      expect(result.data.results[0].content).toBeDefined();
      expect(result.data.results[0].link).toBe(
        'https://nature.com/crispr-2024',
      );
    });
  });

  describe('clear_search tool', () => {
    it('should clear results and history', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      expect((component as any).snapshot.currentResults).not.toBeNull();

      const result = await component.handleToolCall('clear_search', {
        confirm: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.cleared).toBe(true);
      expect((component as any).snapshot.currentResults).toBeNull();
      expect((component as any).snapshot.searchHistory).toEqual([]);
    });
  });

  describe('export_search tool', () => {
    it('should return error when no results', async () => {
      const result = await component.handleToolCall('export_search', {
        format: 'markdown',
      });

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('No search results');
    });

    it('should export as markdown', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const result = await component.handleToolCall('export_search', {
        format: 'markdown',
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('markdown');
      expect(result.data.content).toContain('# Web Search Results');
      expect(result.data.content).toContain('CRISPR Gene Therapy Advances');
      expect(result.data.content).toContain('https://nature.com/crispr-2024');
      expect(result.summary).toContain('markdown');
    });

    it('should export as JSON', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const result = await component.handleToolCall('export_search', {
        format: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('json');
      const parsed = JSON.parse(result.data.content);
      expect(parsed.results).toHaveLength(2);
      expect(parsed.metadata.id).toBe('test-id');
    });

    it('should default to markdown format', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const result = await component.handleToolCall('export_search', {});

      expect(result.data.format).toBe('markdown');
    });
  });

  describe('exportData', () => {
    it('should export empty state as JSON', async () => {
      const result = await component.exportData({ format: 'json' });

      expect(result.format).toBe('json');
      const data = result.data as any;
      expect(data.results).toEqual([]);
    });

    it('should export with results as JSON', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const result = await component.exportData({ format: 'json' });

      expect(result.format).toBe('json');
      const data = result.data as any;
      expect(data.results).toHaveLength(2);
      expect(data.searchHistory).toHaveLength(1);
      expect(data.metadata.id).toBe('test-id');
    });

    it('should export with results as markdown', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const result = await component.exportData({ format: 'markdown' });

      expect(result.format).toBe('markdown');
      expect(typeof result.data).toBe('string');
      expect(result.data as string).toContain('CRISPR Gene Therapy Advances');
    });

    it('should export with results as markdown', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const result = await component.exportData({ format: 'markdown' });

      expect(result.format).toBe('markdown');
      expect(result.data).toContain('CRISPR Gene Therapy Advances');
    });
  });

  describe('rendering', () => {
    it('should render empty state', async () => {
      const rendered = await component.renderImply();
      expect(rendered.length).toBeGreaterThan(0);
    });

    it('should render search results', async () => {
      await component.handleToolCall('web_search', { query: 'test' });
      const rendered = await component.renderImply();

      expect(rendered.length).toBeGreaterThan(1);
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await component.handleToolCall('unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('Unknown tool');
    });
  });
});
