/**
 * Type definitions for memory module
 */

import type Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Message Types (migrated from task/task.type.ts)
// =============================================================================

/**
 * Thinking block for assistant messages
 */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

/**
 * Extended content block type that includes custom thinking blocks
 */
export type ExtendedContentBlock = Anthropic.ContentBlockParam | ThinkingBlock;

/**
 * Unified message type for conversation history
 * Content is always an array of content blocks for consistency
 */
export interface ApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: ExtendedContentBlock[];
  ts?: number;
}

/**
 * Helper class for building ApiMessage objects
 * Provides convenient factory methods for common message types
 */
export class MessageBuilder {
  /**
   * Create a text message
   */
  static text(role: 'user' | 'assistant' | 'system', text: string): ApiMessage {
    return {
      role,
      content: [{ type: 'text', text }],
      ts: Date.now(),
    };
  }

  /**
   * Create a system message
   */
  static system(context: string): ApiMessage {
    return this.text('system', context);
  }

  /**
   * Create a user message
   */
  static user(text: string): ApiMessage {
    return this.text('user', text);
  }

  /**
   * Create an assistant message
   */
  static assistant(text: string): ApiMessage {
    return this.text('assistant', text);
  }

  /**
   * Create a message with custom content blocks
   */
  static custom(role: 'user' | 'assistant' | 'system', content: ExtendedContentBlock[]): ApiMessage {
    return {
      role,
      content,
      ts: Date.now(),
    };
  }
}

/**
 * Callback type for message added events
 */
export type MessageAddedCallback = (
  taskId: string,
  message: ApiMessage,
) => void;

/**
 * Configuration for the memory module
 */
export interface MemoryModuleConfig {
  /** Enable context recall */
  enableRecall: boolean;
  /** Maximum contexts to recall per request */
  maxRecallContexts: number;
  /** Maximum recalled conversation messages to inject (default: 20) */
  maxRecalledMessages: number;
  /** Maximum tokens in context before compression (default: 100000) */
  maxContextTokens?: number;
  /** Compress when at this percentage of maxContextTokens (default: 0.8) */
  contextCompressionRatio?: number;
  /** Target token count after compression (default: 60% of maxContextTokens) */
  compressionTargetTokens?: number;
  /** Use LLM for summarization (default: true) */
  enableLLMSummarization?: boolean;
  /** Max tokens to send for LLM summarization (default: 15000) */
  maxTokensForSummary?: number;
  /** Model to use for summarization */
  summaryModel?: string;
}

/**
 * Result from thinking phase
 * Re-exported from thinking module for convenience
 */
export type ThinkingPhaseResult = import('../thinking/types.js').ThinkingPhaseResult;

/**
 * Represents a changed section in workspace context diff
 */
export interface WorkspaceContextDiff {
  /** Component name (e.g., 'mail', 'bibliographySearch') or 'header' for workspace header */
  section: string;
  /** Whether this section changed since last iteration */
  changed: boolean;
  /** The content if changed, null if unchanged */
  content: string | null;
}

/**
 * Workspace context entry for memory storage
 */
export interface WorkspaceContextEntry {
  /** The rendered workspace context string (full or diff) */
  content: string;
  /** Timestamp when this context was captured */
  ts: number;
  /** Iteration number when this context was captured */
  iteration: number;
  /** Whether this is a diff storage (vs full context) */
  isDiff?: boolean;
  /** Changed sections if isDiff is true */
  diff?: WorkspaceContextDiff[];
}

/**
 * Interface for MemoryModule
 * Defines the contract for simplified memory management
 */
export interface IMemoryModule {
  // ==================== Message Management ====================

  /**
   * Add message to storage
   */
  addMessage(message: ApiMessage): Promise<ApiMessage>;

  /**
   * Record tool call result (no-op in simplified mode)
   */
  recordToolCall(toolName: string, success: boolean, result: any): void;

  /**
   * Get all historical messages
   */
  getAllMessages(): ApiMessage[];

  /**
   * Get history for prompt injection
   * @param interleaveWorkspaces - If true, interleaves workspace contexts with messages
   */
  getHistoryForPrompt(interleaveWorkspaces?: boolean): ApiMessage[];

  // ==================== Workspace Context Management ====================

  /**
   * Record a workspace context snapshot (async for LLM diff/summarization)
   */
  recordWorkspaceContext(context: string, iteration: number): Promise<void>;

  /**
   * Get all workspace context entries
   */
  getWorkspaceContexts(): WorkspaceContextEntry[];

  /**
   * Get workspace contexts formatted for prompt injection
   */
  getWorkspaceContextsForPrompt(): ApiMessage[];

  /**
   * Clear workspace contexts
   */
  clearWorkspaceContexts(): void;

  // ==================== Error Management ====================

  /**
   * Push errors to be saved for later retrieval
   */
  pushErrors(errors: Error[]): void;

  /**
   * Pop and return all saved errors
   */
  popErrors(): Error[];

  /**
   * Get saved errors without clearing them
   */
  getErrors(): Error[];

  /**
   * Clear all saved errors
   */
  clearErrors(): void;

  // ==================== Configuration ====================

  /**
   * Get current configuration
   */
  getConfig(): MemoryModuleConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryModuleConfig>): void;

  // ==================== Import/Export ====================

  /**
   * Export memory state
   */
  export(): any;

  /**
   * Import memory state
   */
  import(data: any): void;

  /**
   * Clear all memory
   */
  clear(): void;

}
