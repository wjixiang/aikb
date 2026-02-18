import { ApiClient } from './ApiClient.interface.js';
import { OpenaiCompatibleApiClient } from './OpenaiCompatibleApiClient.js';
import { ProviderSettings } from '../types/provider-settings.js';

/**
 * Factory class for creating ApiClient instances
 *
 * Simplified factory that creates OpenAI-compatible API clients based on provider configuration.
 *
 * @example
 * ```ts
 * const config: ProviderSettings = {
 *   apiProvider: 'openai',
 *   apiKey: 'your-key',
 *   apiModelId: 'gpt-4',
 * };
 * const client = ApiClientFactory.create(config);
 * ```
 */
export class ApiClientFactory {
    /**
     * Create an ApiClient instance based on provider configuration
     *
     * @param config - The provider settings
     * @returns An OpenaiCompatibleApiClient instance
     * @throws Error if required configuration is missing
     */
    static create(config: ProviderSettings): ApiClient {
        console.log('[ApiClientFactory.create] Creating API client for provider:', config.apiProvider);

        const apiKey = config.apiKey;
        if (!apiKey) {
            throw new Error('API key is required');
        }

        const model = config.apiModelId;
        if (!model) {
            throw new Error('Model ID is required');
        }

        // Determine base URL based on provider
        let baseURL: string | undefined;
        const provider = config.apiProvider || 'openai';

        switch (provider) {
            case 'openai':
            case 'openai-native':
                baseURL = config.openAiBaseUrl || config.openAiNativeBaseUrl || 'https://api.openai.com/v1';
                break;
            case 'anthropic':
                baseURL = config.anthropicBaseUrl || 'https://api.anthropic.com/v1';
                break;
            case 'ollama':
                baseURL = config.ollamaBaseUrl || 'http://localhost:11434/v1';
                break;
            case 'lmstudio':
                baseURL = config.lmStudioBaseUrl || 'http://localhost:1234/v1';
                break;
            case 'zai':
                // ZAI uses different endpoints based on line
                const line = config.zaiApiLine || 'china_coding';
                baseURL = line === 'international_coding'
                    ? 'https://open.bigmodel.cn/api/paas/v4'
                    : 'https://open.bigmodel.cn/api/paas/v4';
                break;
            default:
                baseURL = undefined;
        }

        console.log('[ApiClientFactory.create] Creating OpenaiCompatibleApiClient with model:', model, 'baseURL:', baseURL);

        return new OpenaiCompatibleApiClient({
            apiKey,
            model,
            baseURL,
            temperature: config.modelTemperature ?? undefined,
            maxTokens: config.modelMaxTokens,
        });
    }
}
