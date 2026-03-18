/**
 * LLM Pool - Type Definitions
 *
 * Type definitions for API requests and responses
 * Supporting both OpenAI and Anthropic compatible formats
 */

// ============================================================================
// OpenAI Compatible Types
// ============================================================================

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
}

export interface OpenAIChatCompletionChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface OpenAIChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage: OpenAIChatCompletionUsage;
}

// ============================================================================
// Anthropic Compatible Types
// ============================================================================

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }>;
}

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicMessageCreateRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  tools?: AnthropicTool[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Unified Types for Load Balancer
// ============================================================================

export interface ChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    name?: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
    tool_call_id?: string;
  }>;
  system?: string;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created: number;
}

// ============================================================================
// Backend Status and Metrics
// ============================================================================

export interface BackendStatus {
  id: string;
  healthy: boolean;
  currentRequests: number;
  totalRequests: number;
  failedRequests: number;
  avgLatency: number;
  lastRequestTime: number | null;
  lastError: string | null;
}

// ============================================================================
// API Mode
// ============================================================================

export type ApiMode = 'openai' | 'anthropic';
