import * as z from 'zod';
import { FieldConstraint, RetrivalStrategy } from 'bibliography-search';

/**
 * Recursive schema for retrieval strategy
 * This schema defines the structure for complex PubMed search queries
 * with logical operators (AND/OR/NOT) and field constraints
 */
export const retrievalStrategySchema: z.ZodType<RetrivalStrategy> = z.lazy(() =>
  z.object({
    term: z.string(),
    field: z.array(z.custom<FieldConstraint>()) as z.ZodType<FieldConstraint[]>,
    AND: z.array(z.lazy(() => retrievalStrategySchema)).nullable(),
    OR: z.array(z.lazy(() => retrievalStrategySchema)).nullable(),
    NOT: z.array(z.lazy(() => retrievalStrategySchema)).nullable(),
  }),
);

/**
 * Schema for search_pubmed tool parameters
 */
export const searchPubmedParamsSchema = z
  .object({
    term: z
      .string()
      .optional()
      .describe(
        '- Simple search term (alternative to strategy)\n- Retrieval with term, field constraints, and logical operators (AND/OR/NOT)',
      ),
    sort: z
      .enum(['match', 'date', 'pubdate', 'fauth', 'jour'])
      .optional()
      .describe(
        'Sort order: match (relevance), date, pubdate, fauth (first author), jour (journal)',
      ),
    sortOrder: z
      .enum(['asc', 'dsc'])
      .optional()
      .describe('Sort direction: asc (ascending), dsc (descending)'),
    filter: z
      .array(z.string())
      .optional()
      .describe(
        'Filters to apply. Two types:\n1. Date Range: format "YYYY:YYYY" (e.g., "2020:2025" for 2020 to 2025 inclusive)\n2. Article Type (exact match, case-insensitive):\n   - "Books and Documents"\n   - "Clinical Trial"\n   - "Meta-Analysis"\n   - "Randomized Controlled Trial"\n   - "Review"\n   - "Systematic Review"\n\nExamples: filter=["2020:2025"], filter=["Systematic Review"], filter=["2020:2025", "Systematic Review"]',
      ),
    page: z.number().optional().describe('Page number to retrieve'),
  })
  .refine((data) => data.term, {
    message: 'Either strategy or simpleTerm must be provided',
  });

export type searchPubmedParamsType = z.infer<typeof searchPubmedParamsSchema>;

/**
 * Schema for view_article tool parameters
 */
export const viewArticleParamsSchema = z.object({
  pmid: z.string().describe('PubMed ID (PMID) of article'),
});

/**
 * Schema for navigate_page tool parameters
 */
export const navigatePageParamsSchema = z.object({
  direction: z
    .enum(['next', 'prev'])
    .describe('Direction: next for next page, prev for previous page'),
});

/**
 * Schema for clear_results tool parameters
 */
export const clearResultsParamsSchema = z.object({});

/**
 * Schema for save_article tool parameters
 */
export const saveArticleParamsSchema = z.object({
  pmid: z.string().describe('PubMed ID (PMID) of article to save to favorites'),
});

/**
 * Schema for remove_from_favorites tool parameters
 */
export const removeFromFavoritesParamsSchema = z.object({
  pmid: z
    .string()
    .describe('PubMed ID (PMID) of article to remove from favorites'),
});

/**
 * Schema for get_favorites tool parameters
 */
export const getFavoritesParamsSchema = z.object({});
