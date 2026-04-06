import z from 'zod';
import { Tool } from './index.js';

export const attempt_completion: Tool = {
  toolName: 'attempt_completion',
  paramsSchema: z.object({}).describe('No parameters needed'),
  desc: 'Signal that the task is complete. Before calling this tool, you MUST output your task summary as a plain text message (not inside a tool call). This tool only signals completion — do not put any summary text here.',
  examples: [
    {
      description: 'Complete after outputting summary as text',
      params: {},
      expectedResult: 'Task ends after LLM has already output the summary as plain text',
    },
  ],
};
