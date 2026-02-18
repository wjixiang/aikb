import { Agent, AgentConfig, AgentPrompt, defaultAgentConfig } from './agent.js';
import { ProviderSettings } from '../types/provider-settings.js';
import { VirtualWorkspace } from '../statefulContext/index.js';
import { ApiClient, ApiClientFactory } from '../api-client/index.js';
import { createObservableAgent, ObservableAgentCallbacks } from './ObservableAgent.js';

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
    /** Optional observer callbacks for automatic observation */
    observers?: ObservableAgentCallbacks;
}

/**
 * Factory class for creating Agent instances
 *
 * This factory provides a convenient way to create Agent instances with
 * proper dependency injection. It handles the creation of the ApiClient,
 * merges default configurations with provided options, and optionally
 * wraps the agent in an ObservableAgent proxy for automatic observation.
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
 * // Create with observers (automatic notification)
 * const agent = AgentFactory.create(workspace, {
 *   observers: {
 *     onStatusChanged: (taskId, status) => console.log(`Status: ${status}`),
 *     onTaskCompleted: (taskId) => console.log('Task completed!')
 *   }
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
        agentPrompt: AgentPrompt,
        options: AgentFactoryOptions = {}
    ): Agent {
        // Log options without serializing apiClient (contains circular references)
        const { apiClient, ...loggableOptions } = options;
        console.log('[AgentFactory.create] Creating agent with options:', JSON.stringify(loggableOptions, null, 2));

        const {
            config: configPartial = {},
            apiConfiguration: apiConfigPartial = {},
            taskId,
            observers,
        } = options;

        // Merge default config with provided config
        const config: AgentConfig = {
            ...defaultAgentConfig,
            ...configPartial,
        };
        console.log('[AgentFactory.create] Merged config:', JSON.stringify(config, null, 2));

        // Merge default API config with provided config
        const apiConfiguration: ProviderSettings = {
            apiProvider: 'zai',
            apiKey: process.env['GLM_API_KEY'],
            apiModelId: 'glm-4.7',
            toolProtocol: 'xml',
            zaiApiLine: 'china_coding',
            ...apiConfigPartial,
        };
        console.log('[AgentFactory.create] API configuration, provider:', apiConfiguration.apiProvider, 'model:', apiConfiguration.apiModelId, 'hasApiKey:', !!apiConfiguration.apiKey);

        // Create API client if not provided
        console.log('[AgentFactory.create] Creating API client...');
        const client = apiClient || ApiClientFactory.create(apiConfiguration);
        console.log('[AgentFactory.create] API client created');

        // Create the Agent
        console.log('[AgentFactory.create] Creating Agent instance...');
        const agent = new Agent(
            config,
            workspace,
            agentPrompt,
            client,
            taskId,
        );
        console.log('[AgentFactory.create] Agent instance created, taskId:', agent.getTaskId);

        // Wrap in ObservableAgent if observers are provided
        if (observers && Object.keys(observers).length > 0) {
            console.log('[AgentFactory.create] Wrapping agent with observers');
            return createObservableAgent(agent, observers);
        }

        console.log('[AgentFactory.create] Returning agent');
        return agent;
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
        agentPrompt: AgentPrompt,
        options: Omit<AgentFactoryOptions, 'apiClient'> = {}
    ): Agent {
        return AgentFactory.create(workspace, agentPrompt, {
            ...options,
            apiClient,
        });
    }
}
