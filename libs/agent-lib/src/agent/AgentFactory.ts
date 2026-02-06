import { Agent, AgentConfig, defaultAgentConfig, defaultApiConfig } from './agent';
import { ProviderSettings } from '../types/provider-settings';
import { VirtualWorkspace } from 'statefulContext';
import type { ApiClient } from '../api-client';
import { ApiClientFactory } from '../api-client';

/**
 * Configuration options for creating an Agent
 */
export interface AgentFactoryOptions {
    /** Agent configuration */
    config?: Partial<AgentConfig>;
    /** API provider configuration */
    apiConfiguration?: Partial<ProviderSettings>;
    /** Optional custom API client (for testing or custom implementations) */
    apiClient?: ApiClient;
    /** Optional task ID */
    taskId?: string;
}

/**
 * Factory class for creating Agent instances
 * 
 * This factory provides a convenient way to create Agent instances with
 * proper dependency injection. It handles the creation of the ApiClient
 * and merges default configurations with provided options.
 * 
 * @example
 * ```ts
 * // Create with default configuration
 * const agent = AgentFactory.create(workspace);
 * 
 * // Create with custom configuration
 * const agent = AgentFactory.create(workspace, {
 *   config: { apiRequestTimeout: 60000 },
 *   apiConfiguration: { apiModelId: 'custom-model' }
 * });
 * 
 * // Create with custom API client
 * const agent = AgentFactory.create(workspace, {
 *   apiClient: new MockApiClient()
 * });
 * ```
 */
export class AgentFactory {
    /**
     * Create an Agent instance with the provided options
     * 
     * @param workspace - The VirtualWorkspace instance
     * @param options - Optional configuration for the agent
     * @returns A configured Agent instance
     */
    static create(
        workspace: VirtualWorkspace,
        options: AgentFactoryOptions = {}
    ): Agent {
        const {
            config: configPartial = {},
            apiConfiguration: apiConfigPartial = {},
            apiClient,
            taskId,
        } = options;

        // Merge default config with provided config
        const config: AgentConfig = {
            ...defaultAgentConfig,
            ...configPartial,
        };

        // Merge default API config with provided config
        const apiConfiguration: ProviderSettings = {
            ...defaultApiConfig,
            ...apiConfigPartial,
        };

        // Create API client if not provided
        const client = apiClient || ApiClientFactory.create(apiConfiguration);

        // Create and return the Agent
        return new Agent(
            config,
            apiConfiguration,
            workspace,
            taskId,
            client,
        );
    }

    /**
     * Create an Agent with a custom ApiClient
     * 
     * This is useful for testing or when you need to use a custom
     * API client implementation.
     * 
     * @param workspace - The VirtualWorkspace instance
     * @param apiClient - The custom ApiClient to use
     * @param options - Optional configuration for the agent
     * @returns A configured Agent instance
     */
    static createWithCustomClient(
        workspace: VirtualWorkspace,
        apiClient: ApiClient,
        options: Omit<AgentFactoryOptions, 'apiClient'> = {}
    ): Agent {
        return AgentFactory.create(workspace, {
            ...options,
            apiClient,
        });
    }
}
