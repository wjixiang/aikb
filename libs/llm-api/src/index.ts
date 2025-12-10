import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import {
  type ProviderSettings,
  type ModelInfo,
  type ToolProtocol,
  type VerbosityLevel,
  type ReasoningEffortExtended,
  ANTHROPIC_DEFAULT_MAX_TOKENS,
  CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS,
  isDynamicProvider,
  isLocalProvider,
} from 'agent-lib/types';

import { ApiStream } from './transform/stream';

// Constants and functions moved from agent-lib/shared/api
export const DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS = 16_384;
export const DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS = 8_192;
export const GEMINI_25_PRO_MIN_THINKING_TOKENS = 128;

export const shouldUseReasoningBudget = ({
  model,
  settings,
}: {
  model: ModelInfo;
  settings?: ProviderSettings;
}): boolean =>
  !!model.requiredReasoningBudget ||
  (!!model.supportsReasoningBudget && !!settings?.enableReasoningEffort);

export const shouldUseReasoningEffort = ({
  model,
  settings,
}: {
  model: ModelInfo;
  settings?: ProviderSettings;
}): boolean => {
  // Explicit off switch
  if (settings?.enableReasoningEffort === false) return false;

  // Selected effort from settings or model default
  const selectedEffort = (settings?.reasoningEffort ??
    (model as any).reasoningEffort) as
    | 'disable'
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | undefined;

  // "disable" explicitly omits reasoning
  if (selectedEffort === 'disable') return false;

  const cap = model.supportsReasoningEffort as unknown;

  // Capability array: use only if selected is included (treat "none"/"minimal" as valid)
  if (Array.isArray(cap)) {
    return (
      !!selectedEffort &&
      (cap as ReadonlyArray<string>).includes(selectedEffort as string)
    );
  }

  // Boolean capability: true → require a selected effort
  if (model.supportsReasoningEffort === true) {
    return !!selectedEffort;
  }

  // Not explicitly supported: only allow when the model itself defines a default effort
  // Ignore settings-only selections when capability is absent/false
  const modelDefaultEffort = (model as any).reasoningEffort as
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | undefined;
  return !!modelDefaultEffort;
};

export const getModelMaxOutputTokens = ({
  modelId,
  model,
  settings,
  format,
}: {
  modelId: string;
  model: ModelInfo;
  settings?: ProviderSettings;
  format?: 'anthropic' | 'openai' | 'gemini' | 'openrouter';
}): number | undefined => {
  // Check for Claude Code specific max output tokens setting
  if (settings?.apiProvider === 'claude-code') {
    return (
      settings.claudeCodeMaxOutputTokens ||
      CLAUDE_CODE_DEFAULT_MAX_OUTPUT_TOKENS
    );
  }

  if (shouldUseReasoningBudget({ model, settings })) {
    return (
      settings?.modelMaxTokens || DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS
    );
  }

  const isAnthropicContext =
    modelId.includes('claude') ||
    format === 'anthropic' ||
    (format === 'openrouter' && modelId.startsWith('anthropic/'));

  // For "Hybrid" reasoning models, discard the model's actual maxTokens for Anthropic contexts
  if (model.supportsReasoningBudget && isAnthropicContext) {
    return ANTHROPIC_DEFAULT_MAX_TOKENS;
  }

  // For Anthropic contexts, always ensure a maxTokens value is set
  if (isAnthropicContext && (!model.maxTokens || model.maxTokens === 0)) {
    return ANTHROPIC_DEFAULT_MAX_TOKENS;
  }

  // If model has explicit maxTokens, clamp it to 20% of context window
  // Exception: GPT-5 models should use their exact configured max output tokens
  if (model.maxTokens) {
    // Check if this is a GPT-5 model (case-insensitive)
    const isGpt5Model = modelId.toLowerCase().includes('gpt-5');

    // GPT-5 models bypass the 20% cap and use their full configured max tokens
    if (isGpt5Model) {
      return model.maxTokens;
    }

    // All other models are clamped to 20% of context window
    return Math.min(model.maxTokens, Math.ceil(model.contextWindow * 0.2));
  }

  // For non-Anthropic formats without explicit maxTokens, return undefined
  if (format) {
    return undefined;
  }

  // Default fallback
  return ANTHROPIC_DEFAULT_MAX_TOKENS;
};

export type {
  ApiStream,
  ApiStreamChunk,
  ApiStreamTextChunk,
  ApiStreamUsageChunk,
  ApiStreamReasoningChunk,
  ApiStreamGroundingChunk,
  ApiStreamToolCallChunk,
  ApiStreamToolCallStartChunk,
  ApiStreamToolCallDeltaChunk,
  ApiStreamToolCallEndChunk,
  ApiStreamToolCallPartialChunk,
  ApiStreamError
} from './transform/stream';

import {
  GlamaHandler,
  AnthropicHandler,
  AwsBedrockHandler,
  CerebrasHandler,
  OpenRouterHandler,
  VertexHandler,
  OpenAiHandler,
  LmStudioHandler,
  GeminiHandler,
  OpenAiNativeHandler,
  DeepSeekHandler,
  MoonshotHandler,
  MistralHandler,
  VsCodeLmHandler,
  UnboundHandler,
  RequestyHandler,
  HumanRelayHandler,
  FakeAIHandler,
  XAIHandler,
  GroqHandler,
  HuggingFaceHandler,
  ChutesHandler,
  LiteLLMHandler,
  ClaudeCodeHandler,
  QwenCodeHandler,
  SambaNovaHandler,
  IOIntelligenceHandler,
  DoubaoHandler,
  ZAiHandler,
  FireworksHandler,
  RooHandler,
  FeatherlessHandler,
  VercelAiGatewayHandler,
  DeepInfraHandler,
  MiniMaxHandler,
  BasetenHandler,
} from './providers';
import { NativeOllamaHandler } from './providers/native-ollama';

export interface SingleCompletionHandler {
  completePrompt(prompt: string): Promise<string>;
}

export interface ApiHandlerCreateMessageMetadata {
  /**
   * Task ID used for tracking and provider-specific features:
   * - DeepInfra: Used as prompt_cache_key for caching
   * - Roo: Sent as X-Roo-Task-ID header
   * - Requesty: Sent as trace_id
   * - Unbound: Sent in unbound_metadata
   */
  taskId: string;
  /**
   * Current mode slug for provider-specific tracking:
   * - Requesty: Sent in extra metadata
   * - Unbound: Sent in unbound_metadata
   */
  mode?: string;
  suppressPreviousResponseId?: boolean;
  /**
   * Controls whether the response should be stored for 30 days in OpenAI's Responses API.
   * When true (default), responses are stored and can be referenced in future requests
   * using the previous_response_id for efficient conversation continuity.
   * Set to false to opt out of response storage for privacy or compliance reasons.
   * @default true
   */
  store?: boolean;
  /**
   * Optional array of tool definitions to pass to the model.
   * For OpenAI-compatible providers, these are ChatCompletionTool definitions.
   */
  tools?: OpenAI.Chat.ChatCompletionTool[];
  /**
   * Controls which (if any) tool is called by the model.
   * Can be "none", "auto", "required", or a specific tool choice.
   */
  tool_choice?: OpenAI.Chat.ChatCompletionCreateParams['tool_choice'];
  /**
   * The tool protocol being used (XML or Native).
   * Used by providers to determine whether to include native tool definitions.
   */
  toolProtocol?: ToolProtocol;
  /**
   * Controls whether the model can return multiple tool calls in a single response.
   * When true, parallel tool calls are enabled (OpenAI's parallel_tool_calls=true).
   * When false (default), only one tool call is returned per response.
   * Only applies when toolProtocol is "native".
   */
  parallelToolCalls?: boolean;
}

export interface ApiHandler {
  createMessage(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    metadata?: ApiHandlerCreateMessageMetadata,
  ): ApiStream;

  getModel(): { id: string; info: ModelInfo };

  /**
   * Counts tokens for content blocks
   * All providers extend BaseProvider which provides a default tiktoken implementation,
   * but they can override this to use their native token counting endpoints
   *
   * @param content The content to count tokens for
   * @returns A promise resolving to the token count
   */
  countTokens(
    content: Array<Anthropic.Messages.ContentBlockParam>,
  ): Promise<number>;
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
  const { apiProvider, ...options } = configuration;

  switch (apiProvider) {
    case 'anthropic':
      return new AnthropicHandler(options);
    case 'claude-code':
      return new ClaudeCodeHandler(options);
    case 'glama':
      return new GlamaHandler(options);
    case 'openrouter':
      return new OpenRouterHandler(options);
    case 'bedrock':
      return new AwsBedrockHandler(options);
    case 'openai':
      return new OpenAiHandler(options);
    case 'ollama':
      return new NativeOllamaHandler(options);
    case 'lmstudio':
      return new LmStudioHandler(options);
    case 'gemini':
      return new GeminiHandler(options);
    case 'openai-native':
      return new OpenAiNativeHandler(options);
    case 'deepseek':
      return new DeepSeekHandler(options);
    case 'doubao':
      return new DoubaoHandler(options);
    case 'qwen-code':
      return new QwenCodeHandler(options);
    case 'moonshot':
      return new MoonshotHandler(options);
    case 'vscode-lm':
      return new VsCodeLmHandler(options);
    case 'mistral':
      return new MistralHandler(options);
    case 'unbound':
      return new UnboundHandler(options);
    case 'requesty':
      return new RequestyHandler(options);
    case 'human-relay':
      return new HumanRelayHandler();
    case 'fake-ai':
      return new FakeAIHandler(options);
    case 'xai':
      return new XAIHandler(options);
    case 'groq':
      return new GroqHandler(options);
    case 'deepinfra':
      return new DeepInfraHandler(options);
    case 'huggingface':
      return new HuggingFaceHandler(options);
    case 'chutes':
      return new ChutesHandler(options);
    case 'litellm':
      return new LiteLLMHandler(options);
    case 'cerebras':
      return new CerebrasHandler(options);
    case 'sambanova':
      return new SambaNovaHandler(options);
    case 'zai':
      return new ZAiHandler(options);
    case 'fireworks':
      return new FireworksHandler(options);
    case 'io-intelligence':
      return new IOIntelligenceHandler(options);
    case 'roo':
      // Never throw exceptions from provider constructors
      // The provider-proxy server will handle authentication and return appropriate error codes
      return new RooHandler(options);
    case 'featherless':
      return new FeatherlessHandler(options);
    case 'vercel-ai-gateway':
      return new VercelAiGatewayHandler(options);
    case 'minimax':
      return new MiniMaxHandler(options);
    case 'baseten':
      return new BasetenHandler(options);
    default:
      return new OpenAiNativeHandler(options);
  }
}
