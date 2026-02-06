// export * from './provider-settings';
// export * from './model';
// export * from './tool';
// export * from './message.type';
// export * from './mode';

// export * from './providers/index';
// export * from './provider-default-model-id';

export type { ToolUsage } from './tool.js'
export type { ToolName } from './tool.js'
export { TOOL_PROTOCOL } from './tool.js'
export type { ToolProtocol } from './tool.js'
export { getEffectiveProtocol } from './tool.js'
export { isNativeProtocol } from './tool.js'

/**
 * Default consecutive mistake limit for agent error handling
 * When the agent makes this many consecutive mistakes, it will abort
 */
export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 5;

/**
 * Token usage tracking interface
 * Tracks token consumption and costs for API requests
 */
export interface TokenUsage {
    /** Total input tokens consumed */
    totalTokensIn: number;
    /** Total output tokens consumed */
    totalTokensOut: number;
    /** Total cost in currency units */
    totalCost: number;
    /** Context tokens used */
    contextTokens: number;
    /** Total cache write tokens (optional) */
    totalCacheWrites?: number;
    /** Total cache read tokens (optional) */
    totalCacheReads?: number;
}