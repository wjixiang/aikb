import { anthropicDefaultModelId } from './providers/anthropic';
import { basetenDefaultModelId } from './providers/baseten';
import { bedrockDefaultModelId } from './providers/bedrock';
import { cerebrasDefaultModelId } from './providers/cerebras';
import { chutesDefaultModelId } from './providers/chutes';
import { claudeCodeDefaultModelId } from './providers/claude-code';
import { deepSeekDefaultModelId } from './providers/deepseek';
import { doubaoDefaultModelId } from './providers/doubao';
import { featherlessDefaultModelId } from './providers/featherless';
import { fireworksDefaultModelId } from './providers/fireworks';
import { geminiDefaultModelId } from './providers/gemini';
import { glamaDefaultModelId } from './providers/glama';
import { groqDefaultModelId } from './providers/groq';
import { ioIntelligenceDefaultModelId } from './providers/io-intelligence';
import { litellmDefaultModelId } from './providers/lite-llm';
import { mistralDefaultModelId } from './providers/mistral';
import { moonshotDefaultModelId } from './providers/moonshot';
import { openRouterDefaultModelId } from './providers/openrouter';
import { qwenCodeDefaultModelId } from './providers/qwen-code';
import { requestyDefaultModelId } from './providers/requesty';
import { rooDefaultModelId } from './providers/roo';
import { sambaNovaDefaultModelId } from './providers/sambanova';
import { unboundDefaultModelId } from './providers/unbound';
import { vertexDefaultModelId } from './providers/vertex';
import { vscodeLlmDefaultModelId } from './providers/vscode-llm';
import { xaiDefaultModelId } from './providers/xai';
import { vercelAiGatewayDefaultModelId } from './providers/vercel-ai-gateway';
import {
    internationalZAiDefaultModelId,
    mainlandZAiDefaultModelId,
} from './providers/zai';
import { deepInfraDefaultModelId } from './providers/deepinfra';
import { minimaxDefaultModelId } from './providers/minimax';

// Import ProviderName type from provider-settings to avoid duplication
import type { ProviderName } from './provider-settings';

/**
 * Get default model ID for a given provider.
 * This function returns only the provider's default model ID, without considering user configuration.
 * Used as a fallback when provider models are still loading.
 */
export function getProviderDefaultModelId(
    provider: ProviderName,
    options: { isChina?: boolean } = { isChina: false },
): string {
    switch (provider) {
        case 'openrouter':
            return openRouterDefaultModelId;
        case 'requesty':
            return requestyDefaultModelId;
        case 'glama':
            return glamaDefaultModelId;
        case 'unbound':
            return unboundDefaultModelId;
        case 'litellm':
            return litellmDefaultModelId;
        case 'xai':
            return xaiDefaultModelId;
        case 'groq':
            return groqDefaultModelId;
        case 'huggingface':
            return 'meta-llama/Llama-3.3-70B-Instruct';
        case 'chutes':
            return chutesDefaultModelId;
        case 'baseten':
            return basetenDefaultModelId;
        case 'bedrock':
            return bedrockDefaultModelId;
        case 'vertex':
            return vertexDefaultModelId;
        case 'gemini':
            return geminiDefaultModelId;
        case 'deepseek':
            return deepSeekDefaultModelId;
        case 'doubao':
            return doubaoDefaultModelId;
        case 'moonshot':
            return moonshotDefaultModelId;
        case 'minimax':
            return minimaxDefaultModelId;
        case 'zai':
            return options?.isChina
                ? mainlandZAiDefaultModelId
                : internationalZAiDefaultModelId;
        case 'openai-native':
            return 'gpt-4o'; // Based on openai-native patterns
        case 'mistral':
            return mistralDefaultModelId;
        case 'openai':
            return ''; // OpenAI provider uses custom model configuration
        case 'ollama':
            return ''; // Ollama uses dynamic model selection
        case 'lmstudio':
            return ''; // LMStudio uses dynamic model selection
        case 'deepinfra':
            return deepInfraDefaultModelId;
        case 'vscode-lm':
            return vscodeLlmDefaultModelId;
        case 'claude-code':
            return claudeCodeDefaultModelId;
        case 'cerebras':
            return cerebrasDefaultModelId;
        case 'sambanova':
            return sambaNovaDefaultModelId;
        case 'fireworks':
            return fireworksDefaultModelId;
        case 'featherless':
            return featherlessDefaultModelId;
        case 'io-intelligence':
            return ioIntelligenceDefaultModelId;
        case 'roo':
            return rooDefaultModelId;
        case 'qwen-code':
            return qwenCodeDefaultModelId;
        case 'vercel-ai-gateway':
            return vercelAiGatewayDefaultModelId;
        case 'anthropic':
        case 'gemini-cli':
        case 'human-relay':
        case 'fake-ai':
        default:
            return anthropicDefaultModelId;
    }
}
