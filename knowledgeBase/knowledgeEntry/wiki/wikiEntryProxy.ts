import { KnowledgeEntryProxy } from '../knowledgeEntryProxy';
import axios from 'axios';
import WikiSearchApi, { WikiSearchApiConfig } from './WikiSearchApi';
import { b } from 'baml_client';
import createLoggerWithPrefix from '@aikb/log-management/logger';

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
  logger = createLoggerWithPrefix('WikiEntryProxy');
  constructor(private config: WikiEntryProxyConfig) {
    super();
    this.api = new WikiSearchApi(config.searchAPiConfig);
  }

  async search(search_str: string): Promise<string> {
    this.logger.debug(`Starting wiki search for query: "${search_str}"`);

    // Step 1: Analyze search_str and convert it into WikiSearchParams[] using b.GenerateWikiSearchPattern()
    this.logger.debug('Generating wiki search pattern using BAML');
    const searchParams = await b.GenerateWikiSearchPattern(search_str);
    this.logger.debug('Generated search parameters:', searchParams);

    // Convert BAML type to WikiSearchParams
    const wikiSearchParams: WikiSearchParams = {
      language_code: searchParams.language_code,
      search_query: searchParams.search_query,
      number_of_results: searchParams.number_of_results,
    };

    // Step 2: Use this.api to search wiki and parse the returned documents into markdown format context
    this.logger.debug('Searching wiki with parameters:', wikiSearchParams);
    const searchResults = await this.api.searchWiki(wikiSearchParams);
    this.logger.debug(`Found ${searchResults.length} search results`);

    // Get markdown content for each search result
    const markdownContents: string[] = [];
    for (const result of searchResults) {
      try {
        this.logger.debug(`Getting markdown for: ${result.title}`);
        const markdownResult = await this.api.getMarkdown(result);
        this.logger.debug(
          `Successfully retrieved markdown for: ${result.title}`,
        );
        markdownContents.push(
          `# ${markdownResult.title}\n\n${markdownResult.mdStr}\n\n来源: ${markdownResult.url}`,
        );
      } catch (error) {
        this.logger.error(`Error getting markdown for ${result.title}:`, error);
        console.error(`Error getting markdown for ${result.title}:`, error);
        // If we can't get markdown, at least include the basic info
        markdownContents.push(
          `# ${result.title}\n\n${result.description}\n\n来源: ${result.url}`,
        );
      }
    }

    // Combine all markdown contents
    const combinedMarkdown = markdownContents.join('\n\n---\n\n');
    this.logger.debug(
      `Combined markdown length: ${combinedMarkdown.length} characters`,
    );

    // Step 3: Use BAML to call LLM to summarize references and return the final result
    this.logger.debug('Summarizing wiki results using BAML');
    const summary = await b.SummarizeWikiResults(search_str, combinedMarkdown);
    this.logger.debug('Successfully generated summary');

    return summary;
  }
}
