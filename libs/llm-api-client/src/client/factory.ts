import { ApiClient } from '../types/api-client.js';
import { OpenaiCompatibleApiClient } from './openai.js';
import { AnthropicCompatibleApiClient } from './anthropic.js';
import { ProviderSettings } from '../types/provider-settings.js';
import { ConfigurationError } from '../errors/errors.js';
import { getLogger } from '@shared/logger';

const logger = getLogger('ApiClientFactory');

/**
 * Factory class for creating ApiClient instances
 *
 * Creates the appropriate API client based on provider configuration.
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
   * @returns An ApiClient instance
   * @throws Error if required configuration is missing
   */
  static create(config: ProviderSettings): ApiClient {
    logger.info({ provider: config.apiProvider }, 'Creating API client');

    const apiKey = config.apiKey;
    if (!apiKey) {
      throw new ConfigurationError('API key is required', 'apiKey');
    }

    const model = config.apiModelId;
    if (!model) {
      throw new ConfigurationError('Model ID is required', 'apiModelId');
    }

    const provider = config.apiProvider || 'openai';

    switch (provider) {
      case 'anthropic': {
        const baseURL =
          config.anthropicBaseUrl || 'https://api.anthropic.com/v1';
        logger.info({ provider, model, baseURL }, 'Creating AnthropicCompatibleApiClient');
        return new AnthropicCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'openai':
      case 'openai-native': {
        const baseURL =
          config.openAiBaseUrl ||
          config.openAiNativeBaseUrl ||
          ((config as Record<string, unknown>)['apiBaseUrl'] as
            | string
            | undefined) ||
          'https://api.openai.com/v1';
        logger.info({ provider, model, baseURL }, 'Creating OpenaiCompatibleApiClient');
        return new OpenaiCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'ollama': {
        const baseURL = config.ollamaBaseUrl || 'http://localhost:11434/v1';
        logger.info({ provider, model, baseURL }, 'Creating OpenaiCompatibleApiClient');
        return new OpenaiCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'lmstudio': {
        const baseURL = config.lmStudioBaseUrl || 'http://localhost:1234/v1';
        logger.info({ provider, model, baseURL }, 'Creating OpenaiCompatibleApiClient');
        return new OpenaiCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'zai': {
        const line = config.zaiApiLine || 'china_coding';
        const baseURL =
          line === 'international_coding'
            ? 'https://open.bigmodel.cn/api/paas/v4'
            : 'https://open.bigmodel.cn/api/coding/paas/v4';
        logger.info({ provider, model, baseURL, line }, 'Creating OpenaiCompatibleApiClient');
        return new OpenaiCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'moonshot': {
        const line = config.moonshotApiLine || 'standard';
        const baseURL =
          config.moonshotBaseUrl ||
          (line === 'coding'
            ? 'https://api.kimi.com/coding/'
            : 'https://api.moonshot.cn/v1');
        logger.info({ provider, model, baseURL, line }, 'Creating OpenaiCompatibleApiClient');
        return new OpenaiCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'minimax': {
        const baseURL = config.minimaxBaseUrl || 'https://api.minimaxi.com/anthropic';
        logger.info({ provider, model, baseURL }, 'Creating AnthropicCompatibleApiClient');
        return new AnthropicCompatibleApiClient({
          apiKey,
          model,
          baseURL,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
      case 'vscode-lm': {
        throw new ConfigurationError(
          'vscode-lm provider is not yet implemented. Use a different provider.',
          'apiProvider',
        );
      }
      default: {
        logger.info({ provider, model }, 'Creating OpenaiCompatibleApiClient with default baseURL');
        return new OpenaiCompatibleApiClient({
          apiKey,
          model,
          temperature: config.modelTemperature ?? undefined,
          maxTokens: config.modelMaxTokens,
        });
      }
    }
  }
}
