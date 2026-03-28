import type { Tool } from 'agent-lib/components/ui';
import {
  webSearchParamsSchema,
  clearSearchParamsSchema,
  getSearchParamsSchema,
  exportSearchParamsSchema,
} from './webSearchSchemas.js';

export const web_searchTool: Tool = {
  toolName: 'web_search',
  desc: 'Search the web for information. Returns page titles, URLs, summaries, and optionally detailed content. Supports domain filtering, time range filtering, and content size control.',
  paramsSchema: webSearchParamsSchema,
  examples: [
    {
      description: 'Basic web search',
      params: { query: 'latest advances in CRISPR gene therapy' },
      expectedResult:
        'Returns a list of web search results with titles, URLs, and summaries.',
    },
    {
      description: 'Search with result count limit',
      params: { query: 'machine learning in healthcare', count: 5 },
      expectedResult: 'Returns up to 5 search results.',
    },
    {
      description: 'Search with domain filter',
      params: {
        query: 'clinical trial results',
        domainFilter: 'clinicaltrials.gov',
      },
      expectedResult: 'Returns results only from clinicaltrials.gov.',
    },
    {
      description: 'Recent search with time filter',
      params: {
        query: 'AI drug discovery news',
        recencyFilter: 'oneWeek',
      },
      expectedResult: 'Returns results published within the last week.',
    },
    {
      description: 'Detailed content search',
      params: {
        query: 'mechanism of action of metformin',
        contentSize: 'high',
      },
      expectedResult:
        'Returns results with maximized content for detailed analysis.',
    },
    {
      description: 'Search with intent recognition',
      params: {
        query: 'how to treat diabetes',
        searchIntent: true,
      },
      expectedResult:
        'Performs intent recognition first, then executes search with optimized keywords.',
    },
  ],
};

export const clear_searchTool: Tool = {
  toolName: 'clear_search',
  desc: 'Clear all current search results and search history.',
  paramsSchema: clearSearchParamsSchema,
  examples: [
    {
      description: 'Clear all search results',
      params: { confirm: true },
      expectedResult: 'All search results and history are cleared.',
    },
  ],
};

export const get_searchTool: Tool = {
  toolName: 'get_search',
  desc: 'Get the current search results. Returns the most recent search response including results, intents, and metadata.',
  paramsSchema: getSearchParamsSchema,
  examples: [
    {
      description: 'Get current search results',
      params: {},
      expectedResult:
        'Returns the current search results with titles, URLs, and summaries.',
    },
  ],
};

export const export_searchTool: Tool = {
  toolName: 'export_search',
  desc: 'Export current search results in JSON or Markdown format.',
  paramsSchema: exportSearchParamsSchema,
  examples: [
    {
      description: 'Export as markdown',
      params: { format: 'markdown' },
      expectedResult: 'Returns search results formatted as Markdown.',
    },
    {
      description: 'Export as JSON',
      params: { format: 'json' },
      expectedResult: 'Returns search results as structured JSON data.',
    },
  ],
};

export function createWebSearchToolSet(): Map<string, Tool> {
  const map = new Map<string, Tool>();
  map.set('web_search', web_searchTool);
  map.set('clear_search', clear_searchTool);
  map.set('get_search', get_searchTool);
  map.set('export_search', export_searchTool);
  return map;
}

export const webSearchTools = {
  web_search: web_searchTool,
  clear_search: clear_searchTool,
  get_search: get_searchTool,
  export_search: export_searchTool,
} as const;
