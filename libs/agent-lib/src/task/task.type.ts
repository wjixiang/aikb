import Anthropic from '@anthropic-ai/sdk';

export type TaskStatus = 'idle' | 'running' | 'completed' | 'aborted';

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
 * Callback type for task status changed events
 */
export type TaskStatusChangedCallback = (
  taskId: string,
  changedStatus: TaskStatus,
) => void;

/**
 * Callback type for task completed events
 */
export type TaskCompletedCallback = (taskId: string) => void;

/**
 * Callback type for task aborted events
 */
export type TaskAbortedCallback = (taskId: string, abortReason: string) => void;

/**
 * Simplified task metadata
 * Extracted from core/task-persistence/taskMetadata.ts
 */
export interface TaskMetadata {
  taskId: string;
  startTime?: number;
  endTime?: number;
  tokenCount?: number;
  cost?: number;
}
