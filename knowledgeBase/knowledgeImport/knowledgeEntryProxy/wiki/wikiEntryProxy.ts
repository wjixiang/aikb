import { KnowledgeEntryProxy } from '../knowledgeEntryProxy';
import axios from 'axios';
import WikiSearchApi, { WikiSearchApiConfig } from './WikiSearchApi';
import { b } from 'baml_client';

interface WikiSearchParams {
  language_code: string;
  search_query: string;
  number_of_results: number;
}

interface WikiSearchResult {
  title: string;
  description: string;
  url: string;
}

interface WikiEntryProxyConfig {
  searchAPiConfig: WikiSearchApiConfig;
}

export default class WikiEntryProxy extends KnowledgeEntryProxy {
  api: WikiSearchApi;
  constructor(private config: WikiEntryProxyConfig) {
    super();
    this.api = new WikiSearchApi(config.searchAPiConfig);
  }

  async search(search_str: string): Promise<string> {
    // Step 1: Analyze search_str and convert it into WikiSearchParams[] using b.GenerateWikiSearchPattern()
    const searchParams = await b.GenerateWikiSearchPattern(search_str);

    // Convert BAML type to WikiSearchParams
    const wikiSearchParams: WikiSearchParams = {
      language_code: searchParams.language_code,
      search_query: searchParams.search_query,
      number_of_results: searchParams.number_of_results,
    };

    // Step 2: Use this.api to search wiki and parse the returned documents into markdown format context
    const searchResults = await this.api.searchWiki(wikiSearchParams);

    // Get markdown content for each search result
    const markdownContents: string[] = [];
    for (const result of searchResults) {
      try {
        const markdownResult = await this.api.getMarkdown(result);
        markdownContents.push(
          `# ${markdownResult.title}\n\n${markdownResult.mdStr}\n\n来源: ${markdownResult.url}`,
        );
      } catch (error) {
        console.error(`Error getting markdown for ${result.title}:`, error);
        // If we can't get markdown, at least include the basic info
        markdownContents.push(
          `# ${result.title}\n\n${result.description}\n\n来源: ${result.url}`,
        );
      }
    }

    // Combine all markdown contents
    const combinedMarkdown = markdownContents.join('\n\n---\n\n');

    // Step 3: Use BAML to call LLM to summarize references and return the final result
    const summary = await b.SummarizeWikiResults(search_str, combinedMarkdown);

    return summary;
  }
}
