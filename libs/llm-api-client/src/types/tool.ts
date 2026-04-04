/**
 * Core type definitions for LLM API Client
 *
 * Provides foundational types for tool definitions and examples.
 */

import type * as z from 'zod';

/**
 * Tool example for demonstrating proper usage
 */
export interface ToolExample {
  /** Brief description of what this example demonstrates */
  description: string;
  /** Example parameters to use */
  params: Record<string, unknown>;
  /** Expected result or behavior */
  expectedResult?: string;
}

/**
 * Tool definition for API clients
 */
export interface Tool {
  toolName: string;
  paramsSchema: z.ZodTypeAny;
  desc: string;
  /** Optional examples to help LLM understand how to use this tool */
  examples?: ToolExample[];
}
