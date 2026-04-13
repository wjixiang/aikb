/**
 * Type definitions for memory module
 *
 * All message types are now defined in llm-api-client and re-exported here
 * for backward compatibility.
 */

// Re-export unified types from llm-api-client
import type {
  Message,
  MessageRole,
  ContentBlock,
  TextContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  ImageContentBlock,
  ThinkingBlock,
  MessageAddedCallback,
} from 'llm-api-client';

export type {
  Message,
  MessageRole,
  ContentBlock,
  TextContentBlock,
  ToolUseBlock,
  ToolResultBlock,
  ImageContentBlock,
  ThinkingBlock,
  MessageAddedCallback,
};
export { MessageBuilder } from 'llm-api-client';

// Backward-compatible aliases (deprecated)
/** @deprecated Use Message from 'llm-api-client' instead */
export type ApiMessage = import('llm-api-client').Message;
/** @deprecated Use ContentBlock from 'llm-api-client' instead */
export type ExtendedContentBlock = import('llm-api-client').ContentBlock;

/**
 * Configuration for the memory module
 */
export interface MemoryModuleConfig {
  /** Maximum tokens in context before compression (default: 100000) */
  maxContextTokens: number;
  /** Compress when at this percentage of maxContextTokens (default: 0.8) */
  contextCompressionRatio: number;
  /** Target token count after compression (default: 60000) */
  compressionTargetTokens: number;
  /** Minimum number of recent messages to retain during compression (default: 20) */
  minRetainedMessages: number;
}

/**
 * Workspace context entry for memory storage
 */
export interface WorkspaceContextEntry {
  /** The rendered workspace context string */
  content: string;
  /** Timestamp when this context was captured */
  ts: number;
  /** Iteration number when this context was captured */
  iteration: number;
}

/**
 * Interface for MemoryModule
 * Defines the contract for simplified memory management
 */
export interface IMemoryModule {
  // ==================== Message Management ====================

  /**
   * Add message to storage (triggers compression if needed)
   */
  addMessage(message: Message): Promise<Message>;

  /**
   * Add message without triggering compression
   */
  addMessageSync(message: Message): Promise<Message>;

  /**
   * Get all historical messages
   */
  getAllMessages(): Message[];

  /**
   * Get total token count for all messages
   */
  getTotalTokens(): Promise<number>;

  /**
   * Get history for prompt injection
   */
  getHistoryForPrompt(): Message[];

  // ==================== Workspace Context Management ====================

  /**
   * Record a workspace context snapshot (only stores when context changes)
   */
  recordWorkspaceContext(context: string, iteration: number): Promise<void>;

  /**
   * Get all workspace context entries
   */
  getWorkspaceContexts(): WorkspaceContextEntry[];

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
   * Clear all errors
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
