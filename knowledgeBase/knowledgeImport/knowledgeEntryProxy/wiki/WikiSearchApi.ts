import axios from 'axios';
import { app_config } from 'knowledgeBase/config';

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

export interface WikiSearchApiConfig {
  client_id?: string;
  client_secret?: string;
}

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface WikiHtml extends WikiSearchResult {
  htmlStr: string;
}

interface WikiMarkdown extends WikiSearchResult {
  mdStr: string;
}

export default class WikiSearchApi {
  constructor(private config: WikiSearchApiConfig) {}

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
        timeout: 60000, // 10 seconds timeout
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

  async getHtml(searchRes: WikiSearchResult): Promise<WikiHtml> {
    const data = await axios.get(searchRes.url);
    return {
      ...searchRes,
      htmlStr: data.data,
    };
  }

  async getMarkdown(searchRes: WikiSearchResult): Promise<WikiMarkdown> {
    const md = await axios.post(`${app_config.fastapiEndPoint}/tomd/url`, {
      url: searchRes.url,
    });

    return {
      ...searchRes,
      mdStr: md.data.markdown,
    };
  }

  /**
   * Gets an access token using OAuth 2.0 client credentials flow
   * @returns Promise that resolves to an access token
   */
  async getAccessToken(): Promise<string> {
    const { client_id, client_secret } = this.config;

    if (!client_id || !client_secret) {
      throw new Error(
        'Client ID and client secret are required to get an access token',
      );
    }

    const url = 'https://meta.wikimedia.org/w/rest.php/oauth2/access_token';

    try {
      const response = await axios.post<AccessTokenResponse>(
        url,
        {
          grant_type: 'client_credentials',
          client_id,
          client_secret,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 'unknown';
        const statusText = error.response?.statusText || 'unknown';
        const data = error.response?.data || {};

        throw new Error(
          `Failed to get access token with status ${status} ${statusText}: ${JSON.stringify(data)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Returns the standard page object for a wiki page, including the API route to fetch the latest content in HTML, the license, and information about the latest revision. https://api.wikimedia.org/wiki/Core_REST_API/Reference/Pages/Get_page#JavaScript
   * @param project Project name. For example: wikipedia (encyclopedia articles), commons (images, audio, and video), wiktionary (dictionary entries)
   * @param language Language code. For example: ar (Arabic), en (English), es (Spanish).
   * @param title Wiki page title
   */
  async getPage(
    project: string,
    language: string,
    title: string,
    apiKey: string,
    app_name: string,
  ) {
    const url = `https://api.wikimedia.org/core/v1/${project}/${language}/page/${title}/bare`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Provide more detailed error information
        const status = error.response?.status || 'unknown';
        const statusText = error.response?.statusText || 'unknown';
        const data = error.response?.data || {};

        // Handle specific error cases
        if (status === 403) {
          console.error('Authentication error with Wikimedia API:');
          console.error(
            '- Check if the API key is valid and has the required permissions',
          );
          console.error('- Verify the API key has not expired');
          console.error(
            '- Ensure the API key is properly formatted in the Authorization header',
          );
        }

        throw new Error(
          `Wikimedia API request failed with status ${status} ${statusText}: ${JSON.stringify(data)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Convenience method that automatically authenticates and fetches a wiki page
   * @param project Project name. For example: wikipedia (encyclopedia articles), commons (images, audio, and video), wiktionary (dictionary entries)
   * @param language Language code. For example: ar (Arabic), en (English), es (Spanish).
   * @param title Wiki page title
   * @param app_name Application name for the User-Agent header
   */
  async getPageWithAuth(
    project: string,
    language: string,
    title: string,
    app_name: string,
  ) {
    try {
      // Get an access token using client credentials
      const accessToken = await this.getAccessToken();

      // Use the access token to fetch the page
      return await this.getPage(
        project,
        language,
        title,
        accessToken,
        app_name,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to get page with authentication: ${error.message}`,
        );
      }
      throw error;
    }
  }
}
