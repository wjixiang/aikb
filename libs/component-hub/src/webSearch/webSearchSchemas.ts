import { z } from 'zod';

export const recencyFilterSchema = z.enum([
  'oneDay',
  'oneWeek',
  'oneMonth',
  'oneYear',
  'noLimit',
]);

export const contentSizeSchema = z.enum(['medium', 'high']);

export const webSearchParamsSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(70)
    .describe(
      'Search query content. Recommend keeping query within 70 characters for best results.',
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Number of results to return (1-50, default 10).'),
  searchIntent: z
    .boolean()
    .optional()
    .describe(
      'Whether to perform search intent recognition. When true, the system identifies search intent before executing the search.',
    ),
  domainFilter: z
    .string()
    .optional()
    .describe(
      'Whitelist of domains to restrict results to (e.g. "www.example.com"). Only results from these domains will be returned.',
    ),
  recencyFilter: recencyFilterSchema
    .optional()
    .describe(
      'Time range filter for results: oneDay, oneWeek, oneMonth, oneYear, noLimit.',
    ),
  contentSize: contentSizeSchema
    .optional()
    .describe(
      'Controls the amount of content returned. "medium" returns summaries for basic reasoning. "high" maximizes context with detailed content.',
    ),
});

export type WebSearchParamsType = z.infer<typeof webSearchParamsSchema>;

export const clearSearchParamsSchema = z.object({
  confirm: z
    .boolean()
    .describe('Must be true to confirm clearing all search results.'),
});

export type ClearSearchParamsType = z.infer<typeof clearSearchParamsSchema>;

export const getSearchParamsSchema = z.object({});

export type GetSearchParamsType = z.infer<typeof getSearchParamsSchema>;

export const exportSearchParamsSchema = z.object({
  format: z
    .enum(['json', 'markdown'])
    .optional()
    .default('markdown')
    .describe('Export format: "json" or "markdown" (default: markdown).'),
});

export type ExportSearchParamsType = z.infer<typeof exportSearchParamsSchema>;
