import 'reflect-metadata';
import { Agent, AgentConfig, AgentPrompt, defaultAgentConfig } from './agent.js';
import { ProviderSettings } from '../types/provider-settings.js';
import { VirtualWorkspace } from '../statefulContext/index.js';
import { ApiClient } from '../api-client/index.js';
import { createObservableAgent, ObservableAgentCallbacks } from './ObservableAgent.js';
import { ApiClientFactory } from '../api-client/ApiClientFactory.js';
import { getGlobalContainer, AgentContainer } from '../di/index.js';
import { IVirtualWorkspace } from '../statefulContext/types.js';
import { TYPES } from '../di/types.js';

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
    private static container: AgentContainer | null = null;

    /**
     * Get or create the singleton container instance
     */
    private static getContainer(): AgentContainer {
        if (!this.container) {
            this.container = getGlobalContainer();
        }
        return this.container;
    }

    /**
     * Set a custom container (useful for testing)
     */
    static setContainer(container: AgentContainer): void {
        this.container = container;
    }

    /**
     * Reset the container (useful for testing)
     */
    static resetContainer(): void {
        this.container = null;
    }

    /**
     * Create an Agent instance with the provided options
     *
     * @param workspace - The VirtualWorkspace instance
     * @param agentPrompt - The agent prompt configuration
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

        // Use the container to create the agent
        const container = this.getContainer();

        // Create agent with container, passing the workspace
        const agent = container.createAgent({
            config: configPartial,
            apiConfiguration: apiConfigPartial,
            agentPrompt,
            taskId,
            workspace, // Pass the workspace to container for backward compatibility
        });

        console.log('[AgentFactory.create] Agent instance created via container, taskId:', agent.getTaskId);

        // Wrap in ObservableAgent if observers are provided
        if (observers && Object.keys(observers).length > 0) {
            console.log('[AgentFactory.create] Wrapping agent with observers');
            return createObservableAgent(agent, observers);
        }

        console.log('[AgentFactory.create] Returning agent');
        return agent;
    }

    /**
     * Create an Agent using the DI container directly
     * This is the recommended way for new code
     *
     * @param agentPrompt - The agent prompt configuration
     * @param options - Optional configuration for the agent
     * @returns A configured Agent instance
     */
    static createWithContainer(
        agentPrompt: AgentPrompt,
        options: Omit<AgentFactoryOptions, 'apiClient'> & { workspace?: VirtualWorkspace } = {}
    ): Agent {
        const container = this.getContainer();

        const agent = container.createAgent({
            config: options.config,
            apiConfiguration: options.apiConfiguration,
            agentPrompt,
            taskId: options.taskId,
            workspace: options.workspace,
        });

        if (options.observers) {
            return createObservableAgent(agent, options.observers);
        }

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
        // For custom API client, we need to use the standard create method
        // The container doesn't directly support overriding ApiClient after creation
        // For now, delegate to the standard create method which will use the container
        // Note: The custom apiClient parameter is currently ignored in the container-based approach
        // If you need to use a custom ApiClient, consider using the container directly

        // Log a warning that custom apiClient is not supported in container mode
        console.warn('[AgentFactory.createWithCustomClient] Custom ApiClient is not directly supported in container-based mode. Using container-created ApiClient instead.');

        return this.create(workspace, agentPrompt, options);
    }
}
