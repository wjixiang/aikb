import { ApiClient } from './ApiClient.interface';
import { BamlApiClient } from './BamlApiClient';
import { ProviderSettings } from '../types/provider-settings';

/**
 * Factory type for creating ApiClient instances
 * 
 * This function type defines the contract for factory functions that create
 * ApiClient instances based on provider configuration.
 */
export type ApiClientFactoryFunction = (config: ProviderSettings) => ApiClient;

/**
 * Factory class for creating ApiClient instances
 * 
 * This factory provides a centralized way to create ApiClient instances
 * based on the provider configuration. It supports different API providers
 * and protocols through a registry of factory functions.
 * 
 * @example
 * ```ts
 * const config: ProviderSettings = {
 *   apiProvider: 'zai',
 *   apiKey: 'your-key',
 *   apiModelId: 'glm-4.7',
 *   toolProtocol: 'xml',
 *   zaiApiLine: 'china_coding',
 * };
 * const client = ApiClientFactory.create(config);
 * ```
 */
export class ApiClientFactory {
    /**
     * Registry of factory functions by provider name
     */
    private static factoryRegistry: Map<string, ApiClientFactoryFunction> = new Map([
        ['zai', () => new BamlApiClient()],
        ['anthropic', () => new BamlApiClient()],
        ['openai', () => new BamlApiClient()],
        // Add more providers as needed
    ]);

    /**
     * Register a custom factory function for a provider
     * 
     * @param provider - The provider name
     * @param factory - The factory function
     */
    static registerFactory(provider: string, factory: ApiClientFactoryFunction): void {
        ApiClientFactory.factoryRegistry.set(provider, factory);
    }

    /**
     * Create an ApiClient instance based on provider configuration
     * 
     * @param config - The provider settings
     * @returns An ApiClient instance
     * @throws Error if no factory is registered for the provider
     */
    static create(config: ProviderSettings): ApiClient {
        const provider = config.apiProvider || 'zai';
        const factory = ApiClientFactory.factoryRegistry.get(provider);

        if (!factory) {
            throw new Error(`No ApiClient factory registered for provider: ${provider}`);
        }

        return factory(config);
    }

    /**
     * Create a BAML API client (default implementation)
     * 
     * @returns A BamlApiClient instance
     */
    static createBamlClient(): ApiClient {
        return new BamlApiClient();
    }
}
