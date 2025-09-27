import { KnowledgeEntryProxy } from '../knowledgeEntryProxy';
import axios from 'axios';

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

interface WikiEntryProxyConfig {}

export default class WikiEntryProxy extends KnowledgeEntryProxy {
  constructor(private config: WikiEntryProxyConfig) {
    super();
  }

  async search(search_str: string): Promise<string> {
    try {
      throw new Error(`Method hasn't implemented`);
      // const results = await this.searchWiki({});
      // return this.formatResults(results);
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
      throw new Error(
        `Failed to search Wikipedia: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async searchWiki(params: WikiSearchParams): Promise<WikiSearchResult[]> {
    const baseUrl = `https://${params.language_code}.wikipedia.org/w/api.php`;
    const searchParams = {
      action: 'opensearch',
      search: params.search_query,
      limit: params.number_of_results,
      namespace: 0,
      format: 'json',
      origin: '*',
    };

    try {
      const response = await axios.get(baseUrl, {
        params: searchParams,
        timeout: 10000, // 10 seconds timeout
      });

      // The response format is: [searchTerm, titles, descriptions, urls]
      const [, titles, descriptions, urls] = response.data;

      if (!titles || titles.length === 0) {
        return [];
      }

      return titles.map((title: string, index: number) => ({
        title,
        description: descriptions[index] || '',
        url: urls[index] || '',
      }));
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Wikipedia API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  private formatResults(results: WikiSearchResult[]): string {
    if (results.length === 0) {
      return 'No Wikipedia articles found for the search query.';
    }

    return results
      .map(
        (result) =>
          `Title: ${result.title}\nDescription: ${result.description}\nURL: ${result.url}\n`,
      )
      .join('\n');
  }
}
