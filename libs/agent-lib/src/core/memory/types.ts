/**
 * Type definitions for memory module
 */

import type Anthropic from '@anthropic-ai/sdk';
import { Turn, ThinkingRound, ToolCallResult } from './Turn.js';
import { ITurnMemoryStore } from './TurnMemoryStore.interface.js';

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
 * Note: Thinking-related configuration has been moved to ThinkingModuleConfig
 */
export interface MemoryModuleConfig {
  /** Enable context recall */
  enableRecall: boolean;
  /** Maximum contexts to recall per request */
  maxRecallContexts: number;
  /** Maximum recalled conversation messages to inject (default: 20) */
  maxRecalledMessages: number;
}

/**
 * Result from thinking phase
 * Re-exported from thinking module for convenience
 */
export type ThinkingPhaseResult = import('../thinking/types.js').ThinkingPhaseResult;

/**
 * Interface for MemoryModule
 * Defines the contract for turn-based memory management
 */
export interface IMemoryModule {
  /**
   * 
   * @param toolName 
   * @param success 
   * @param result 
   */
  recordToolCall(toolName: string, success: boolean, result: any): void;

  getHistoryForPrompt(): ApiMessage[];

  /**
   * Start a new turn
   */
  startTurn(workspaceContext: string, taskContext?: string): Turn;

  /**
   * Complete current turn
   */
  completeTurn(): void;

  /**
   * Perform thinking phase (updates current turn)
   */
  performThinkingPhase(workspaceContext: string, toolResults?: ToolCallResult[]): Promise<ThinkingPhaseResult>;

  /**
   * Add message to current turn
   */
  addMessage(message: ApiMessage): ApiMessage;

  /**
   * Get all historical messages (flattened from all turns)
   */
  getAllMessages(): ApiMessage[];

  /**
   * Get current turn
   */
  getCurrentTurn(): Turn | null;

  /**
   * Get the turn store
   */
  getTurnStore(): ITurnMemoryStore;

  /**
   * Get current configuration
   */
  getConfig(): MemoryModuleConfig;
}
