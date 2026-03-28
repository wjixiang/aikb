export interface WebSearchResult {
  title: string;
  content: string;
  link: string;
  source?: string;
  icon?: string;
  publishDate?: string;
  refer?: string;
}

export interface SearchIntent {
  query: string;
  intent: 'SEARCH_ALL' | 'SEARCH_NONE' | 'SEARCH_ALWAYS';
  keywords?: string;
}

export interface WebSearchResponse {
  id: string;
  created: number;
  requestId: string;
  intents: SearchIntent[];
  results: WebSearchResult[];
}

export type RecencyFilter =
  | 'oneDay'
  | 'oneWeek'
  | 'oneMonth'
  | 'oneYear'
  | 'noLimit';

export type ContentSize = 'medium' | 'high';

export interface WebSearchParams {
  query: string;
  count?: number;
  searchIntent?: boolean;
  domainFilter?: string;
  recencyFilter?: RecencyFilter;
  contentSize?: ContentSize;
  extra?: Record<string, unknown>;
}

export interface WebSearchProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface WebSearchProvider {
  readonly name: string;
  search(params: WebSearchParams): Promise<WebSearchResponse>;
}
