import { z } from 'zod';

/**
 * ToolGroup
 */

export const toolGroups = ['search'] as const;

export const toolGroupsSchema = z.enum(toolGroups);

export type ToolGroup = z.infer<typeof toolGroupsSchema>;

/**
 * ToolName
 */

export const toolNames = ['attempt_completion', 'semantic_search', 'update_workspace'] as const;

export const toolNamesSchema = z.enum(toolNames);

export type ToolName = z.infer<typeof toolNamesSchema>;

/**
 * ToolUsage
 */

export const toolUsageSchema = z.record(
  toolNamesSchema,
  z.object({
    attempts: z.number(),
    failures: z.number(),
  }),
);

/**
 * Tool usage tracking interface
 * Records usage statistics for each tool by name
 */
export type ToolUsage = Record<string, {
  /** Number of times the tool was attempted */
  attempts: number;
  /** Number of times the tool execution failed */
  failures: number;
}>;

/**
 * Tool protocol constants
 */
export const TOOL_PROTOCOL = {
  XML: 'xml',
  NATIVE: 'native',
} as const;

/**
 * Tool protocol type for system prompt generation
 * Derived from TOOL_PROTOCOL constants to ensure type safety
 */
export type ToolProtocol = (typeof TOOL_PROTOCOL)[keyof typeof TOOL_PROTOCOL];

/**
 * Checks if the protocol is native (non-XML).
 *
 * @param protocol - The tool protocol to check
 * @returns True if protocol is native
 */
export function isNativeProtocol(protocol: ToolProtocol): boolean {
  return protocol === TOOL_PROTOCOL.NATIVE;
}

/**
 * Gets the effective protocol from settings or falls back to the default XML.
 * This function is safe to use in webview-accessible code as it doesn't depend on vscode module.
 *
 * @param toolProtocol - Optional tool protocol from settings
 * @returns The effective tool protocol (defaults to "xml")
 */
export function getEffectiveProtocol(
  toolProtocol?: ToolProtocol,
): ToolProtocol {
  return toolProtocol || TOOL_PROTOCOL.XML;
}
