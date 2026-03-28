import {
  ToolComponent,
  type ExportOptions,
  type ToolCallResult,
} from 'agent-lib/components';
import { TUIElement, tdiv, th, tp } from 'agent-lib/components/ui';
import type {
  WebSearchProvider,
  WebSearchResponse,
  WebSearchParams,
} from './types.js';
import { createWebSearchToolSet } from './webSearchTools.js';
import type {
  WebSearchParamsType,
  ExportSearchParamsType,
} from './webSearchSchemas.js';

interface WebSearchState {
  currentResults: WebSearchResponse | null;
  searchHistory: Array<{
    query: string;
    timestamp: number;
    resultCount: number;
  }>;
}

export class WebSearchComponent extends ToolComponent<WebSearchState> {
  readonly componentId = 'web-search';
  readonly displayName = 'Web Search';
  readonly description =
    'Web search component for retrieving information from the internet';

  componentPrompt = `# Web Search Component

You have access to a web search tool that can retrieve information from the internet. Use it to find up-to-date information, facts, and resources.

## Available Tools

- **web_search**: Search the web with support for domain filtering, time range, and content size control
- **get_search**: Retrieve current search results
- **export_search**: Export results in JSON or Markdown format
- **clear_search**: Clear all search results and history

## Best Practices

- Keep search queries concise and specific (within 70 characters)
- Use \`domainFilter\` to restrict results to trusted sources (e.g., "who.int", "pubmed.ncbi.nlm.nih.gov")
- Use \`recencyFilter\` for time-sensitive queries (e.g., "oneWeek" for recent news)
- Use \`contentSize: "high"\` when you need detailed content for in-depth analysis
- Use \`searchIntent: true\` when the query may be ambiguous
- Export results when you need to preserve or share the search findings`;

  private readonly provider: WebSearchProvider;

  constructor(provider: WebSearchProvider) {
    super();
    this.provider = provider;
  }

  protected initialState(): WebSearchState {
    return {
      currentResults: null,
      searchHistory: [],
    };
  }

  protected override toolDefs() {
    const toolSet = createWebSearchToolSet();
    const defs: Record<
      string,
      { desc: string; paramsSchema: any; examples?: any[] }
    > = {};
    toolSet.forEach((tool, name) => {
      defs[name] = {
        desc: tool.desc,
        paramsSchema: tool.paramsSchema,
        examples: tool.examples,
      };
    });
    return defs;
  }

  async onWeb_search(
    params: WebSearchParamsType,
  ): Promise<ToolCallResult<any>> {
    try {
      const searchParams: WebSearchParams = {
        query: params.query,
        count: params.count,
        searchIntent: params.searchIntent,
        domainFilter: params.domainFilter,
        recencyFilter: params.recencyFilter,
        contentSize: params.contentSize,
      };

      const response = await this.provider.search(searchParams);

      this.reactive.currentResults = response;
      this.reactive.searchHistory.push({
        query: params.query,
        timestamp: Date.now(),
        resultCount: response.results.length,
      });

      return {
        success: true,
        data: {
          resultCount: response.results.length,
          intents: response.intents,
          results: response.results.map((r) => ({
            title: r.title,
            link: r.link,
            source: r.source,
          })),
        },
        summary: `[WebSearch] Found ${response.results.length} results for "${params.query}"`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: msg },
        summary: `[WebSearch] Search failed: ${msg}`,
      };
    }
  }

  async onClear_search(_params: {
    confirm: boolean;
  }): Promise<ToolCallResult<any>> {
    this.reactive.currentResults = null;
    this.reactive.searchHistory = [];
    return {
      success: true,
      data: { cleared: true },
      summary: '[WebSearch] Search results cleared',
    };
  }

  async onGet_search(): Promise<ToolCallResult<any>> {
    const s = this.snapshot;
    if (!s.currentResults) {
      return {
        success: true,
        data: {
          results: [],
          message:
            'No search results available. Use web_search to search first.',
        },
        summary: '[WebSearch] No results available',
      };
    }

    return {
      success: true,
      data: {
        query:
          s.searchHistory.length > 0
            ? s.searchHistory[s.searchHistory.length - 1].query
            : undefined,
        resultCount: s.currentResults.results.length,
        results: s.currentResults.results.map((r) => ({
          title: r.title,
          content: r.content,
          link: r.link,
          source: r.source,
          publishDate: r.publishDate,
        })),
      },
      summary: `[WebSearch] Returned ${s.currentResults.results.length} results`,
    };
  }

  async onExport_search(
    params: ExportSearchParamsType,
  ): Promise<ToolCallResult<any>> {
    const s = this.snapshot;
    if (!s.currentResults || s.currentResults.results.length === 0) {
      return {
        success: false,
        data: { error: 'No search results to export' },
        summary: '[WebSearch] No results to export',
      };
    }

    const format = params.format ?? 'markdown';
    const exported = this.formatExport(s.currentResults, format);

    return {
      success: true,
      data: { format, content: exported },
      summary: `[WebSearch] Exported ${s.currentResults.results.length} results as ${format}`,
    };
  }

  override async exportData(options?: ExportOptions) {
    const s = this.snapshot;
    const format = options?.format ?? 'json';

    if (!s.currentResults) {
      return {
        data: { results: [], searchHistory: s.searchHistory },
        format,
        metadata: {
          componentId: this.componentId,
          exportedAt: new Date().toISOString(),
        },
      };
    }

    if (format === 'markdown') {
      return {
        data: this.formatExport(s.currentResults, 'markdown'),
        format: 'markdown',
        metadata: {
          componentId: this.componentId,
          exportedAt: new Date().toISOString(),
          searchHistory: s.searchHistory,
        },
      };
    }

    return {
      data: {
        results: s.currentResults.results,
        intents: s.currentResults.intents,
        searchHistory: s.searchHistory,
        metadata: {
          id: s.currentResults.id,
          requestId: s.currentResults.requestId,
          created: s.currentResults.created,
        },
      },
      format: 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  renderImply = async (): Promise<TUIElement[]> => {
    const s = this.snapshot;
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'Web Search',
        level: 3,
        underline: true,
      }),
    );

    if (!s.currentResults || s.currentResults.results.length === 0) {
      elements.push(
        new tp({
          content: 'No search results. Use web_search to search the web.',
          indent: 2,
        }),
      );
      return elements;
    }

    const lastSearch = s.searchHistory[s.searchHistory.length - 1];
    if (lastSearch) {
      elements.push(
        new tp({
          content: `Query: "${lastSearch.query}" | Results: ${lastSearch.resultCount} | Provider: ${this.provider.name}`,
          indent: 2,
        }),
      );
    }

    if (s.currentResults.intents.length > 0) {
      for (const intent of s.currentResults.intents) {
        const parts = [`Intent: ${intent.intent}`];
        if (intent.keywords) parts.push(`Keywords: "${intent.keywords}"`);
        elements.push(new tp({ content: parts.join(' | '), indent: 4 }));
      }
    }

    elements.push(new tp({ content: '' }));

    for (let i = 0; i < s.currentResults.results.length; i++) {
      const result = s.currentResults.results[i];
      const refer = result.refer ? `[${result.refer}] ` : '';
      const source = result.source ? ` - ${result.source}` : '';
      const date = result.publishDate ? ` (${result.publishDate})` : '';

      elements.push(
        new tp({
          content: `${refer}${result.title}${source}${date}`,
          indent: 2,
        }),
      );
      elements.push(
        new tp({
          content: result.link,
          indent: 4,
        }),
      );

      const preview =
        result.content.length > 200
          ? result.content.slice(0, 200) + '...'
          : result.content;
      elements.push(
        new tp({
          content: preview,
          indent: 4,
        }),
      );
    }

    return elements;
  };

  private formatExport(response: WebSearchResponse, format: string): string {
    if (format === 'markdown') {
      const lines: string[] = ['# Web Search Results', ''];
      if (response.intents.length > 0) {
        lines.push('## Search Intents');
        for (const intent of response.intents) {
          const keywords = intent.keywords ? ` (${intent.keywords})` : '';
          lines.push(`- **${intent.intent}**${keywords}: ${intent.query}`);
        }
        lines.push('');
      }
      lines.push('## Results', '');
      for (const result of response.results) {
        const date = result.publishDate ? ` (${result.publishDate})` : '';
        const source = result.source ? ` - *${result.source}*` : '';
        lines.push(`### ${result.title}${source}${date}`);
        lines.push('');
        lines.push(`${result.content}`);
        lines.push('');
        lines.push(`[Link](${result.link})`);
        lines.push('');
      }
      return lines.join('\n');
    }

    return JSON.stringify(
      {
        results: response.results,
        intents: response.intents,
        metadata: {
          id: response.id,
          requestId: response.requestId,
          created: response.created,
        },
      },
      null,
      2,
    );
  }
}
