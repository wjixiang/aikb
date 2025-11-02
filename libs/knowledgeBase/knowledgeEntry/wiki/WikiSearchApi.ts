import axios from 'axios';
import { app_config } from 'libs/knowledgeBase/config';
import * as cheerio from 'cheerio';
import { WikipediaHtmlToMarkdownConverter } from './WikipediaHtmlToMarkdownConverter';
import createLoggerWithPrefix from '@aikb/log-management/logger';

/**
 * Parameters for searching Wikipedia
 */
interface WikiSearchParams {
  /** Language code for Wikipedia (e.g., 'en' for English, 'es' for Spanish) */
  language_code: string;
  /** Search query string to find Wikipedia articles */
  search_query: string;
  /** Maximum number of results to return */
  number_of_results: number;
}

/**
 * Result from a Wikipedia search containing basic article information
 */
export interface WikiSearchResult {
  /** Title of the Wikipedia article */
  title: string;
  /** Brief description or excerpt from the article */
  description: string;
  /** URL to the full Wikipedia article */
  url: string;
}

/**
 * Configuration for the WikiSearchApi, containing OAuth credentials
 */
export interface WikiSearchApiConfig {
  /** OAuth client ID for Wikimedia API authentication */
  client_id?: string;
  /** OAuth client secret for Wikimedia API authentication */
  client_secret?: string;
}

/**
 * Response from OAuth token endpoint
 */
interface AccessTokenResponse {
  /** The access token for API authentication */
  access_token: string;
  /** Type of token (typically "Bearer") */
  token_type: string;
  /** Number of seconds until the token expires */
  expires_in: number;
  /** OAuth scope permissions granted */
  scope?: string;
}

/**
 * Wikipedia search result extended with HTML content
 */
interface WikiHtml extends WikiSearchResult {
  /** Raw HTML content of the Wikipedia page */
  htmlStr: string;
}

/**
 * Wikipedia search result extended with Markdown content
 */
interface WikiMarkdown extends WikiSearchResult {
  /** Markdown formatted content of the Wikipedia page */
  mdStr: string;
}

/**
 * API client for searching and retrieving content from Wikipedia
 *
 * This class provides methods to search Wikipedia articles, fetch HTML content,
 * convert to Markdown, and authenticate with the Wikimedia REST API.
 */
export default class WikiSearchApi {
  private logger = createLoggerWithPrefix('WikiSearchApi');

  /**
   * Creates a new instance of WikiSearchApi
   * @param config - Configuration object containing OAuth credentials
   */
  constructor(private config: WikiSearchApiConfig) {}

  /**
   * Searches Wikipedia for articles matching the given query
   * @param params - Search parameters including language, query, and result count
   * @returns Promise resolving to an array of search results
   * @throws Error when the Wikipedia API request fails
   */
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

    this.logger.debug(`Searching Wikipedia with URL: ${baseUrl}`);
    this.logger.debug(`Search parameters:`, searchParams);

    try {
      this.logger.debug('Making request to Wikipedia API...');
      const response = await axios.get(baseUrl, {
        params: searchParams,
        timeout: 60000,
      });
      this.logger.debug(`Received response with status: ${response.status}`);
      this.logger.debug(
        `Response data length: ${JSON.stringify(response.data).length} characters`,
      );

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
        this.logger.error('Wikipedia API request failed:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
          isTimeout: error.code === 'ECONNABORTED',
          isNetworkError:
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ECONNRESET',
        });
        throw new Error(`Wikipedia API request failed: ${error.message}`);
      }
      this.logger.error('Unexpected error in searchWiki:', error);
      throw error;
    }
  }

  /**
   * Fetches the HTML content of a Wikipedia page
   * @param searchRes - Wikipedia search result containing the URL to fetch
   * @returns Promise resolving to the search result extended with HTML content
   * @throws Error when the HTML fetch request fails
   */
  async getHtml(searchRes: WikiSearchResult): Promise<WikiHtml> {
    this.logger.debug(`Fetching HTML from: ${searchRes.url}`);
    try {
      const data = await axios.get(searchRes.url, { timeout: 60000 });
      this.logger.debug(
        `Successfully fetched HTML, length: ${data.data.length} characters`,
      );
      return {
        ...searchRes,
        htmlStr: data.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Failed to fetch HTML from ${searchRes.url}:`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });
        throw new Error(`Failed to fetch HTML: ${error.message}`);
      }
      this.logger.error('Unexpected error in getHtml:', error);
      throw error;
    }
  }

  /**
   * Converts a Wikipedia page to Markdown format
   * @param searchRes - Wikipedia search result to convert
   * @returns Promise resolving to the search result extended with Markdown content
   * @throws Error when HTML fetching or conversion fails
   */
  async getMarkdown(searchRes: WikiSearchResult): Promise<WikiMarkdown> {
    this.logger.debug(`Converting to markdown: ${searchRes.title}`);
    // fetch HTML first
    const htmlData = await this.getHtml(searchRes);

    // 使用新的HTML到Markdown转换器
    this.logger.debug('Converting HTML to markdown...');
    const converter = new WikipediaHtmlToMarkdownConverter({
      includeImages: true,
      includeTables: true,
      includeReferences: true,
      includeInfoboxes: true,
      cleanUp: true,
    });

    const mdStr = converter.convert(htmlData.htmlStr);
    this.logger.debug(
      `Converted to markdown, length: ${mdStr.length} characters`,
    );

    return {
      ...searchRes,
      mdStr,
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
  /**
   * Returns the standard page object for a wiki page, including the API route to fetch the latest content in HTML, the license, and information about the latest revision.
   * @param project - Project name. For example: wikipedia (encyclopedia articles), commons (images, audio, and video), wiktionary (dictionary entries)
   * @param language - Language code. For example: ar (Arabic), en (English), es (Spanish).
   * @param title - Wiki page title
   * @param apiKey - API key for authentication
   * @param app_name - Application name for the User-Agent header
   * @returns Promise resolving to the page object with metadata and content URLs
   * @throws Error when the Wikimedia API request fails
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
  /**
   * Convenience method that automatically authenticates and fetches a wiki page
   * @param project - Project name. For example: wikipedia (encyclopedia articles), commons (images, audio, and video), wiktionary (dictionary entries)
   * @param language - Language code. For example: ar (Arabic), en (English), es (Spanish).
   * @param title - Wiki page title
   * @param app_name - Application name for the User-Agent header
   * @returns Promise resolving to the page object with metadata and content URLs
   * @throws Error when authentication or page fetching fails
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
