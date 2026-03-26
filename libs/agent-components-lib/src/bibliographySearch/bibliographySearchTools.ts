import type { Tool } from 'agent-lib/components/ui/index';
import {
  searchPubmedParamsSchema,
  viewArticleParamsSchema,
  navigatePageParamsSchema,
  clearResultsParamsSchema,
  saveArticleParamsSchema,
  removeFromFavoritesParamsSchema,
  getFavoritesParamsSchema,
  updateArticleNoteParamsSchema,
} from './bibliographySearchSchemas.js';

/**
 * Tool for searching PubMed articles
 * Supports both complex retrieval strategies and simple term searches
 */
export const searchPubmedTool: Tool = {
  toolName: 'search_pubmed',
  desc: `Search PubMed articles using a search term. Returns article list with PMIDs, titles, and authors.

IMPORTANT: For date range filtering, use the "filter" parameter with "YYYY/YYYY" format (e.g., "2020/2025").
Do NOT use colon ":" between years.`,
  paramsSchema: searchPubmedParamsSchema,
  examples: [
    {
      description: 'Basic keyword search',
      params: { term: 'cancer treatment immunotherapy', page: 1 },
      expectedResult: 'Returns list of articles matching the search term',
    },
    {
      description: 'Search with date filter (2020-2025) - CORRECT FORMAT',
      params: {
        term: 'COVID-19 treatment',
        filter: ['2020/2025'],
        page: 1,
      },
      expectedResult: 'Returns articles from 2020-2025',
    },
    {
      description: 'Search for systematic reviews from recent years',
      params: {
        term: 'diabetes metformin',
        filter: ['Systematic Review', '2020/2025'],
        sort: 'date',
        sortOrder: 'dsc',
      },
      expectedResult:
        'Returns systematic reviews from 2020-2025, sorted by date (newest first)',
    },
    {
      description: 'Search with author and topic',
      params: { term: 'Smith J[Author] AND cancer[Title]' },
      expectedResult: 'Returns articles by Smith J with cancer in title',
    },
  ],
};

/**
 * Tool for viewing detailed information about a specific article
 */
export const viewArticleTool: Tool = {
  toolName: 'view_article',
  desc: 'View detailed information about a specific article by PMID including abstract, MeSH terms, and keywords.',
  paramsSchema: viewArticleParamsSchema,
  examples: [
    {
      description: 'View article by PMID',
      params: { pmid: '12345678' },
      expectedResult:
        'Returns full article details: title, authors, journal, abstract, MeSH terms, keywords, DOI',
    },
  ],
};

/**
 * Tool for navigating through paginated search results
 */
export const navigatePageTool: Tool = {
  toolName: 'navigate_page',
  desc: 'Navigate to next or previous page of search results. Use after search_pubmed.',
  paramsSchema: navigatePageParamsSchema,
  examples: [
    {
      description: 'Go to next page',
      params: { direction: 'next' },
      expectedResult: 'Returns next page of search results',
    },
    {
      description: 'Go to previous page',
      params: { direction: 'prev' },
      expectedResult: 'Returns previous page of search results',
    },
  ],
};

/**
 * Tool for clearing current search results and article details
 */
export const clearResultsTool: Tool = {
  toolName: 'clear_results',
  desc: 'Clear current search results and article details. Start a fresh search.',
  paramsSchema: clearResultsParamsSchema,
  examples: [
    {
      description: 'Clear all results',
      params: {},
      expectedResult: 'Search results and article details cleared',
    },
  ],
};

/**
 * Tool for saving an article to favorites/collection
 */
export const saveArticleTool: Tool = {
  toolName: 'save_article',
  desc: 'Save an article to favorites/collection by PMID. The article must be currently viewed or previously searched.',
  paramsSchema: saveArticleParamsSchema,
  examples: [
    {
      description: 'Save an article by PMID',
      params: { pmid: '12345678' },
      expectedResult: 'Article saved to favorites',
    },
  ],
};

/**
 * Tool for removing an article from favorites
 */
export const removeFromFavoritesTool: Tool = {
  toolName: 'remove_from_favorites',
  desc: 'Remove an article from favorites/collection by PMID.',
  paramsSchema: removeFromFavoritesParamsSchema,
  examples: [
    {
      description: 'Remove an article from favorites',
      params: { pmid: '12345678' },
      expectedResult: 'Article removed from favorites',
    },
  ],
};

/**
 * Tool for getting all saved/favorite articles
 */
export const getFavoritesTool: Tool = {
  toolName: 'get_favorites',
  desc: 'Get all saved/favorite articles. Returns list of saved articles with basic info.',
  paramsSchema: getFavoritesParamsSchema,
  examples: [
    {
      description: 'Get all favorites',
      params: {},
      expectedResult: 'Returns list of all saved articles',
    },
  ],
};

/**
 * Tool for updating notes on a saved article
 */
export const updateArticleNoteTool: Tool = {
  toolName: 'update_article_note',
  desc: 'Update or add a note to a saved article in favorites. The article must already be in favorites.',
  paramsSchema: updateArticleNoteParamsSchema,
  examples: [
    {
      description: 'Add a note to a saved article',
      params: { pmid: '12345678', note: 'Important for my literature review' },
      expectedResult: 'Note updated for the article',
    },
    {
      description: 'Remove a note from an article',
      params: { pmid: '12345678', note: '' },
      expectedResult: 'Note removed from the article',
    },
  ],
};

/**
 * Map of all bibliography search tools
 * Can be used to initialize the toolSet in BibliographySearchComponent
 */
export function createBibliographySearchToolSet(): Map<string, Tool> {
  const tools = new Map<string, Tool>();

  tools.set('search_pubmed', searchPubmedTool);
  tools.set('view_article', viewArticleTool);
  tools.set('navigate_page', navigatePageTool);
  tools.set('clear_results', clearResultsTool);
  tools.set('save_article', saveArticleTool);
  tools.set('remove_from_favorites', removeFromFavoritesTool);
  tools.set('get_favorites', getFavoritesTool);
  tools.set('update_article_note', updateArticleNoteTool);

  return tools;
}

/**
 * Export individual tools for direct import if needed
 */
export const bibliographySearchTools = {
  searchPubmed: searchPubmedTool,
  viewArticle: viewArticleTool,
  navigatePage: navigatePageTool,
  clearResults: clearResultsTool,
  saveArticle: saveArticleTool,
  removeFromFavorites: removeFromFavoritesTool,
  getFavorites: getFavoritesTool,
  updateArticleNote: updateArticleNoteTool,
};
