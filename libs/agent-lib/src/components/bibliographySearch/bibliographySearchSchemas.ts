import * as z from 'zod'
import {
    FieldConstraint,
    RetrivalStrategy
} from 'med_database_portal'

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
    term: z.string().optional().describe('- Simple search term (alternative to strategy)\n- Retrieval with term, field constraints, and logical operators (AND/OR/NOT)'),
    sort: z.enum(['match', 'date', 'pubdate', 'fauth', 'jour']).optional().describe('Sort order: match (relevance), date, pubdate, fauth (first author), jour (journal)'),
    sortOrder: z.enum(['asc', 'dsc']).optional().describe('Sort direction: asc (ascending), dsc (descending)'),
    filter: z.array(z.string()).optional().describe('Filters to apply (e.g., publication dates, article types)\nSupported Filter types:\n1. Books and Documents\n2. Clinical Trial\n3. Meta-Analysis\n4. Randomized Controlled Trial\n5. Review\n 6. Systematic Review'),
    page: z.number().optional().describe('Page number to retrieve')
}).refine(data => data.term, {
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
