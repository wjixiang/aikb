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
 * Extended tool result block with toolName
 * Extends Anthropic's tool_result with additional metadata
 */
export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  /** Name of the tool that was executed */
  toolName?: string;
  content: string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;
  is_error?: boolean;
}

/**
 * Extended content block type for conversation messages.
 * Includes Anthropic.ContentBlockParam and custom block types like ThinkingBlock and ToolResultBlock.
 */
export type ExtendedContentBlock =
  | Anthropic.ContentBlockParam
  | ThinkingBlock
  | ToolResultBlock;

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
  static custom(
    role: 'user' | 'assistant' | 'system',
    content: ExtendedContentBlock[],
  ): ApiMessage {
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
  addMessage(message: ApiMessage): Promise<ApiMessage>;

  /**
   * Add message without triggering compression
   */
  addMessageSync(message: ApiMessage): Promise<ApiMessage>;

  /**
   * Get all historical messages
   */
  getAllMessages(): ApiMessage[];

  /**
   * Get total token count for all messages
   */
  getTotalTokens(): Promise<number>;

  /**
   * Get history for prompt injection
   */
  getHistoryForPrompt(): ApiMessage[];

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
