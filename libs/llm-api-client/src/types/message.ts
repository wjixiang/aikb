/**
 * Unified message types for conversation history.
 *
 * This module defines the canonical Message type used for storing conversation
 * history and passing it to LLM providers. Each provider implementation converts
 * from this format to its native wire format.
 */

// =============================================================================
// Content Block Types (discriminated union on `type`)
// =============================================================================

/** Plain text content */
export interface TextContentBlock {
  type: 'text';
  text: string;
}

/** Tool call initiated by the assistant */
export interface ToolUseBlock {
  type: 'tool_use';
  /** Unique ID for this tool call (maps to Anthropic `id`, OpenAI `tool_calls[].id`) */
  id: string;
  /** Name of the tool/function to call */
  name: string;
  /** Arguments as a parsed object (not a JSON string) */
  input: Record<string, unknown>;
}

/** Result of a tool execution */
export interface ToolResultBlock {
  type: 'tool_result';
  /** ID of the tool_use block this result corresponds to */
  tool_use_id: string;
  /** Name of the tool that was executed (metadata, not sent to all providers) */
  toolName?: string;
  /** The result content */
  content: string;
  /** Whether the tool execution resulted in an error */
  is_error?: boolean;
}

/** Image content block (for multimodal) */
export interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    data: string;
  };
}

/** Thinking/reasoning block (Anthropic-specific, skipped by other providers) */
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}

/** Union of all content block types */
export type ContentBlock =
  | TextContentBlock
  | ToolUseBlock
  | ToolResultBlock
  | ImageContentBlock
  | ThinkingBlock;

// =============================================================================
// Message Type
// =============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Unified message type for conversation history.
 *
 * This is the canonical format stored in MemoryModule and passed to ApiClient.
 * Each provider implementation converts from this format to its native wire format.
 */
export interface Message {
  role: MessageRole;
  content: ContentBlock[];
  /** Timestamp for ordering and debugging */
  ts?: number;
}

// =============================================================================
// MessageBuilder
// =============================================================================

export class MessageBuilder {
  static text(role: MessageRole, text: string): Message {
    return { role, content: [{ type: 'text', text }], ts: Date.now() };
  }

  static system(context: string): Message {
    return this.text('system', context);
  }

  static user(text: string): Message {
    return this.text('user', text);
  }

  static assistant(text: string): Message {
    return this.text('assistant', text);
  }

  static toolUse(
    id: string,
    name: string,
    input: Record<string, unknown>,
  ): Message {
    return {
      role: 'assistant',
      content: [{ type: 'tool_use', id, name, input }],
      ts: Date.now(),
    };
  }

  static toolResult(
    tool_use_id: string,
    content: string,
    options?: { toolName?: string; is_error?: boolean },
  ): Message {
    return {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id,
          content,
          ...(options?.toolName ? { toolName: options.toolName } : {}),
          ...(options?.is_error ? { is_error: options.is_error } : {}),
        },
      ],
      ts: Date.now(),
    };
  }

  static custom(role: MessageRole, content: ContentBlock[]): Message {
    return { role, content, ts: Date.now() };
  }
}

// =============================================================================
// Callback type
// =============================================================================

export type MessageAddedCallback = (
  taskId: string,
  message: Message,
) => void;
