// Import handlers first to ensure they are evaluated before re-exporting
import { OpenAiHandler } from './openai';
import { AnthropicHandler } from './anthropic';
import { AwsBedrockHandler } from './bedrock';
import { BasetenHandler } from './baseten';
import { CerebrasHandler } from './cerebras';
import { ChutesHandler } from './chutes';
import { DeepInfraHandler } from './deepinfra';
import { FakeAIHandler } from './fake-ai';
import { FeatherlessHandler } from './featherless';
import { FireworksHandler } from './fireworks';
import { GlamaHandler } from './glama';
import { GroqHandler } from './groq';
import { HuggingFaceHandler } from './huggingface';
import { HumanRelayHandler } from './human-relay';
import { IOIntelligenceHandler } from './io-intelligence';
import { LiteLLMHandler } from './lite-llm';
import { LmStudioHandler } from './lm-studio';
import { MiniMaxHandler } from './minimax';
import { NativeOllamaHandler } from './native-ollama';
import { MistralHandler } from './mistral';
import { OpenAiNativeHandler } from './openai-native';
import { OpenRouterHandler } from './openrouter';
import { QwenCodeHandler } from './qwen-code';
import { RequestyHandler } from './requesty';
import { SambaNovaHandler } from './sambanova';
import { UnboundHandler } from './unbound';
import { VercelAiGatewayHandler } from './vercel-ai-gateway';
import { XAIHandler } from './xai';
import { ZAiHandler } from './zai';

// Import these last to ensure their dependencies are loaded first
import { GeminiHandler } from './gemini';

// Re-export all handlers
export { OpenAiHandler };
export { AnthropicHandler };
export { AwsBedrockHandler };
export { BasetenHandler };
export { CerebrasHandler };
export { ChutesHandler };
export { DeepInfraHandler };
export { FakeAIHandler };
export { FeatherlessHandler };
export { FireworksHandler };
export { GlamaHandler };
export { GroqHandler };
export { HuggingFaceHandler };
export { HumanRelayHandler };
export { IOIntelligenceHandler };
export { LiteLLMHandler };
export { LmStudioHandler };
export { MiniMaxHandler };
export { NativeOllamaHandler };
export { MistralHandler };
export { OpenAiNativeHandler };
export { OpenRouterHandler };
export { QwenCodeHandler };
export { RequestyHandler };
export { SambaNovaHandler };
export { UnboundHandler };
export { VercelAiGatewayHandler };
export { XAIHandler };
export { ZAiHandler };
export { GeminiHandler };

// NOTE: VertexHandler, DeepSeekHandler, DoubaoHandler and MoonshotHandler are not
// exported here to avoid circular dependency issues. They can be imported directly
// from their respective files when needed.
