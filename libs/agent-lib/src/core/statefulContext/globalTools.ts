import z from 'zod';
import { Tool } from './index.js';

export const attempt_completion: Tool = {
  toolName: 'attempt_completion',
  paramsSchema: z.object({
    result: z
      .string()
      .describe('The final result message to present to the user'),
  }),
  desc: 'Complete the task and return final result to the user. This MUST be called when the task is fully accomplished.',
  examples: [
    {
      description: 'Complete with simple result',
      params: {
        result:
          'Task completed successfully. Found 25 PubMed articles matching the query.',
      },
      expectedResult: 'Task ends, result presented to user',
    },
    {
      description: 'Complete with detailed summary',
      params: {
        result:
          'Search completed:\n- Query: cancer immunotherapy\n- Filters: Systematic Review, 2020-2025\n- Results: 15 articles found\n- Top match: PMID 12345678 "Title..."',
      },
      expectedResult: 'Task ends with detailed summary presented to user',
    },
  ],
};
