import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZhipuWebSearchProvider } from '../apiClient.js';
import type { ZhipuWebSearchConfig } from '../apiClient.js';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

function createProvider(
  overrides?: Partial<ZhipuWebSearchConfig>,
): ZhipuWebSearchProvider {
  return new ZhipuWebSearchProvider({
    apiKey: 'test-api-key',
    ...overrides,
  });
}

const successResponse = {
  id: 'task-123',
  created: 1700000000,
  request_id: 'req-456',
  search_intent: [
    {
      query: 'test query',
      intent: 'SEARCH_ALL',
      keywords: 'test keywords',
    },
  ],
  search_result: [
    {
      title: 'Test Page',
      content: 'Test content summary',
      link: 'https://example.com',
      media: 'Example',
      icon: 'https://example.com/icon.png',
      refer: '1',
      publish_date: '2024-01-01',
    },
    {
      title: 'Another Page',
      content: 'More content',
      link: 'https://other.com',
    },
  ],
};

describe('ZhipuWebSearchProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should set provider name', () => {
      const provider = createProvider();
      expect(provider.name).toBe('zhipu');
    });

    it('should use default base URL', () => {
      const provider = createProvider();
      expect(provider.name).toBe('zhipu');
    });

    it('should use custom base URL', () => {
      const provider = createProvider({ baseUrl: 'https://custom.api.com' });
      expect(provider.name).toBe('zhipu');
    });
  });

  describe('search', () => {
    it('should make correct API request with basic params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      const result = await provider.search({ query: 'test query' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/web_search');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');

      const body = JSON.parse(options.body);
      expect(body.search_query).toBe('test query');
      expect(body.search_engine).toBe('search_std');
      expect(body.search_intent).toBe(false);
    });

    it('should use custom search engine from extra', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider({ searchEngine: 'search_pro' });
      await provider.search({
        query: 'test',
        extra: { searchEngine: 'search_pro_quark' },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.search_engine).toBe('search_pro_quark');
    });

    it('should fall back to provider default engine when extra not set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider({ searchEngine: 'search_pro' });
      await provider.search({ query: 'test' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.search_engine).toBe('search_pro');
    });

    it('should clamp count to valid range', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      await provider.search({ query: 'test', count: 100 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.count).toBe(50);
    });

    it('should pass domain filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      await provider.search({ query: 'test', domainFilter: 'example.com' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.search_domain_filter).toBe('example.com');
    });

    it('should pass recency filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      await provider.search({ query: 'test', recencyFilter: 'oneWeek' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.search_recency_filter).toBe('oneWeek');
    });

    it('should pass content size', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      await provider.search({ query: 'test', contentSize: 'high' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.content_size).toBe('high');
    });

    it('should pass request_id from extra', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      await provider.search({
        query: 'test',
        extra: { requestId: 'my-req-123' },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.request_id).toBe('my-req-123');
    });

    it('should truncate query to 70 characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      const longQuery = 'a'.repeat(100);
      await provider.search({ query: longQuery });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.search_query.length).toBe(70);
    });

    it('should normalize response correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider();
      const result = await provider.search({ query: 'test' });

      expect(result.id).toBe('task-123');
      expect(result.created).toBe(1700000000);
      expect(result.requestId).toBe('req-456');
      expect(result.intents).toHaveLength(1);
      expect(result.intents[0].query).toBe('test query');
      expect(result.intents[0].intent).toBe('SEARCH_ALL');
      expect(result.intents[0].keywords).toBe('test keywords');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Test Page');
      expect(result.results[0].content).toBe('Test content summary');
      expect(result.results[0].link).toBe('https://example.com');
      expect(result.results[0].source).toBe('Example');
      expect(result.results[0].icon).toBe('https://example.com/icon.png');
      expect(result.results[0].refer).toBe('1');
      expect(result.results[0].publishDate).toBe('2024-01-01');
      expect(result.results[1].source).toBeUndefined();
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'empty', created: 1700000000 }),
      });

      const provider = createProvider();
      const result = await provider.search({ query: 'test' });

      expect(result.id).toBe('empty');
      expect(result.intents).toEqual([]);
      expect(result.results).toEqual([]);
    });

    it('should throw on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const provider = createProvider();
      await expect(provider.search({ query: 'test' })).rejects.toThrow(
        'HTTP 500: Internal Server Error',
      );
    });

    it('should throw on ZHIPU API error with known code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { code: '1701', message: 'Rate limit exceeded' },
        }),
      });

      const provider = createProvider();
      await expect(provider.search({ query: 'test' })).rejects.toThrow(
        'ZHIPU error [1701]: Concurrent search limit reached',
      );
    });

    it('should throw on ZHIPU API error with unknown code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: { code: '9999', message: 'Custom error message' },
        }),
      });

      const provider = createProvider();
      await expect(provider.search({ query: 'test' })).rejects.toThrow(
        'ZHIPU error [9999]: Custom error message',
      );
    });

    it('should handle network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = createProvider();
      await expect(provider.search({ query: 'test' })).rejects.toThrow(
        'Network error',
      );
    });

    it('should use custom base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      const provider = createProvider({
        baseUrl: 'https://custom.api.com/v2/',
      });
      await provider.search({ query: 'test' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://custom.api.com/v2/paas/v4/web_search');
    });
  });
});
