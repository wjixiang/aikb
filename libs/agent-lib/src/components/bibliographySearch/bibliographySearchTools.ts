import type { Tool } from 'stateful-context';
import {
    searchPubmedParamsSchema,
    viewArticleParamsSchema,
    navigatePageParamsSchema,
    clearResultsParamsSchema
} from './bibliographySearchSchemas.js'

/**
 * Tool for searching PubMed articles
 * Supports both complex retrieval strategies and simple term searches
 */
export const searchPubmedTool: Tool = {
    toolName: 'search_pubmed',
    desc: 'Search PubMed articles using retrieval  term',
    paramsSchema: searchPubmedParamsSchema
};

/**
 * Tool for viewing detailed information about a specific article
 */
export const viewArticleTool: Tool = {
    toolName: 'view_article',
    desc: 'View detailed information about a specific article by PMID',
    paramsSchema: viewArticleParamsSchema
};

/**
 * Tool for navigating through paginated search results
 */
export const navigatePageTool: Tool = {
    toolName: 'navigate_page',
    desc: 'Navigate to next or previous page of search results',
    paramsSchema: navigatePageParamsSchema
};

/**
 * Tool for clearing current search results and article details
 */
export const clearResultsTool: Tool = {
    toolName: 'clear_results',
    desc: 'Clear current search results and article details',
    paramsSchema: clearResultsParamsSchema
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

    return tools;
}

/**
 * Export individual tools for direct import if needed
 */
export const bibliographySearchTools = {
    searchPubmed: searchPubmedTool,
    viewArticle: viewArticleTool,
    navigatePage: navigatePageTool,
    clearResults: clearResultsTool
};
