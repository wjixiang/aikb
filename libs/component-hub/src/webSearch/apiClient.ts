import type {
  WebSearchProvider,
  WebSearchProviderConfig,
  WebSearchParams,
  WebSearchResponse,
  WebSearchResult,
  SearchIntent,
} from './types.js';

export type ZhipuSearchEngine =
  | 'search_std'
  | 'search_pro'
  | 'search_pro_sogou'
  | 'search_pro_quark';

export interface ZhipuWebSearchConfig extends WebSearchProviderConfig {
  searchEngine?: ZhipuSearchEngine;
}

interface ZhipuSearchRequestBody {
  search_query: string;
  search_engine: ZhipuSearchEngine;
  search_intent: boolean;
  count?: number;
  search_domain_filter?: string;
  search_recency_filter?: string;
  content_size?: string;
  request_id?: string;
}

interface ZhipuSearchResultItem {
  title: string;
  content: string;
  link: string;
  media?: string;
  icon?: string;
  refer?: string;
  publish_date?: string;
}

interface ZhipuSearchIntentItem {
  query: string;
  intent: string;
  keywords?: string;
}

interface ZhipuSearchResponseBody {
  id?: string;
  created?: number;
  request_id?: string;
  search_intent?: ZhipuSearchIntentItem[];
  search_result?: ZhipuSearchResultItem[];
  error?: {
    code: string;
    message: string;
  };
}

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api';
const DEFAULT_ENGINE: ZhipuSearchEngine = 'search_std';
const ZHIPU_ERROR_MESSAGES: Record<string, string> = {
  '1701': 'Concurrent search limit reached, please retry later',
  '1702': 'No search engine service available, check configuration',
  '1703': 'Search engine returned no valid data, adjust query',
};

export class ZhipuWebSearchProvider implements WebSearchProvider {
  readonly name = 'zhipu';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly searchEngine: ZhipuSearchEngine;

  constructor(config: ZhipuWebSearchConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.searchEngine = config.searchEngine ?? DEFAULT_ENGINE;
  }

  async search(params: WebSearchParams): Promise<WebSearchResponse> {
    const body: ZhipuSearchRequestBody = this.buildRequestBody(params);
    const raw = await this.request<ZhipuSearchResponseBody>(body);
    return this.normalizeResponse(raw);
  }

  private buildRequestBody(params: WebSearchParams): ZhipuSearchRequestBody {
    const body: ZhipuSearchRequestBody = {
      search_query: params.query.slice(0, 70),
      search_engine:
        (params.extra?.searchEngine as ZhipuSearchEngine) ?? this.searchEngine,
      search_intent: params.searchIntent ?? false,
    };

    if (params.count !== undefined) {
      body.count = Math.min(Math.max(1, params.count), 50);
    }
    if (params.domainFilter) {
      body.search_domain_filter = params.domainFilter;
    }
    if (params.recencyFilter) {
      body.search_recency_filter = params.recencyFilter;
    }
    if (params.contentSize) {
      body.content_size = params.contentSize;
    }
    if (params.extra?.requestId) {
      body.request_id = params.extra.requestId as string;
    }

    return body;
  }

  private async request<T>(body: ZhipuSearchRequestBody): Promise<T> {
    const url = `${this.baseUrl}/paas/v4/web_search`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as ZhipuSearchResponseBody;

    if (data.error) {
      const fallback =
        ZHIPU_ERROR_MESSAGES[data.error.code] ?? data.error.message;
      throw new Error(`ZHIPU error [${data.error.code}]: ${fallback}`);
    }

    return data as unknown as T;
  }

  private normalizeResponse(raw: ZhipuSearchResponseBody): WebSearchResponse {
    return {
      id: raw.id ?? '',
      created: raw.created ?? Math.floor(Date.now() / 1000),
      requestId: raw.request_id ?? '',
      intents: (raw.search_intent ?? []).map(
        (item: ZhipuSearchIntentItem): SearchIntent => ({
          query: item.query,
          intent: item.intent as SearchIntent['intent'],
          keywords: item.keywords,
        }),
      ),
      results: (raw.search_result ?? []).map(
        (item: ZhipuSearchResultItem): WebSearchResult => ({
          title: item.title,
          content: item.content,
          link: item.link,
          source: item.media,
          icon: item.icon,
          refer: item.refer,
          publishDate: item.publish_date,
        }),
      ),
    };
  }
}
