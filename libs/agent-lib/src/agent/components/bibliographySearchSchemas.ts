import * as z from 'zod'
import {
    FieldConstraint,
    RetrivalStrategy
} from 'nih-client'

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
        NOT: z.array(z.lazy(() => retrievalStrategySchema)).nullable()
    })
);

/**
 * Schema for search_pubmed tool parameters
 */
export const searchPubmedParamsSchema = z.object({
    strategy: retrievalStrategySchema.optional().describe('Retrieval strategy with term, field constraints, and logical operators (AND/OR/NOT)'),
    simpleTerm: z.string().optional().describe('Simple search term (alternative to strategy)'),
    sort: z.enum(['match', 'date', 'pubdate', 'fauth', 'jour']).optional().describe('Sort order: match (relevance), date, pubdate, fauth (first author), jour (journal)'),
    sortOrder: z.enum(['asc', 'dsc']).optional().describe('Sort direction: asc (ascending), dsc (descending)'),
    filter: z.array(z.string()).optional().describe('Filters to apply (e.g., publication dates, article types)'),
    page: z.number().optional().describe('Page number to retrieve')
}).refine(data => data.strategy || data.simpleTerm, {
    message: 'Either strategy or simpleTerm must be provided'
});

export type searchPubmedParamsType = z.infer<typeof searchPubmedParamsSchema>

/**
 * Schema for view_article tool parameters
 */
export const viewArticleParamsSchema = z.object({
    pmid: z.string().describe('PubMed ID (PMID) of article')
});

/**
 * Schema for navigate_page tool parameters
 */
export const navigatePageParamsSchema = z.object({
    direction: z.enum(['next', 'prev']).describe('Direction: next for next page, prev for previous page')
});

/**
 * Schema for clear_results tool parameters
 */
export const clearResultsParamsSchema = z.object({});
