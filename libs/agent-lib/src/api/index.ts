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
} from '../types';

import { ApiStream } from './transform/stream';
import type { ApiHandlerOptions, ModelRecord, RouterName } from '../shared/api';

// Re-export constants and functions from their new locations to maintain backward compatibility
export {
  DEFAULT_HYBRID_REASONING_MODEL_MAX_TOKENS,
  DEFAULT_HYBRID_REASONING_MODEL_THINKING_TOKENS,
  GEMINI_25_PRO_MIN_THINKING_TOKENS,
  shouldUseReasoningBudget,
  shouldUseReasoningEffort,
} from './utils/reasoning-budget';

export { getModelMaxOutputTokens } from './utils/model-max-tokens';

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
  ApiStreamError,
} from './transform/stream';

// Import all handlers from providers index to avoid circular dependency
import {
  NativeOllamaHandler,
  AnthropicHandler,
  BasetenHandler,
  AwsBedrockHandler,
  CerebrasHandler,
  ChutesHandler,
  DeepInfraHandler,
  FakeAIHandler,
  FeatherlessHandler,
  FireworksHandler,
  GeminiHandler,
  GlamaHandler,
  GroqHandler,
  HuggingFaceHandler,
  HumanRelayHandler,
  IOIntelligenceHandler,
  LiteLLMHandler,
  LmStudioHandler,
  MiniMaxHandler,
  MistralHandler,
  OpenAiNativeHandler,
  OpenRouterHandler,
  QwenCodeHandler,
  RequestyHandler,
  SambaNovaHandler,
  UnboundHandler,
  VercelAiGatewayHandler,
  XAIHandler,
  ZAiHandler,
  OpenAiHandler,
} from './providers/index';

// MoonshotHandler is imported directly due to circular dependency issues
// export { MoonshotHandler } from './providers/moonshot';

export type {
  SingleCompletionHandler,
  ApiHandlerCreateMessageMetadata,
} from './types';

export type { ApiHandlerOptions, ModelRecord, RouterName } from '../shared/api';


export interface ApiHandler {
  createMessage(
    systemPrompt: string,
    messages: Anthropic.Messages.MessageParam[],
    // metadata?: ApiHandlerCreateMessageMetadata,
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
    // case 'deepseek':
    //   return new DeepSeekHandler(options);
    // case 'doubao':
    //   return new DoubaoHandler(options);
    case 'qwen-code':
      return new QwenCodeHandler(options);
    // case 'moonshot':
    //   return new MoonshotHandler(options);
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
