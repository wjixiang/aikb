import 'reflect-metadata';
import { Agent, AgentConfig, AgentPrompt } from './agent.js';
import { ProviderSettings } from '../types/provider-settings.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import type { VirtualWorkspaceConfig } from '../../components/core/types.js';
import { ApiClient } from '../api-client/index.js';
import type { ObservableAgentCallbacks } from './ObservableAgent.js';
import { getGlobalContainer, AgentContainer } from '../di/index.js';
import { TestOverrides } from '../di/container.js';

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
  /** Optional workspace configuration (if not provided, default workspace will be created) */
  virtualWorkspaceConfig?: Partial<VirtualWorkspaceConfig>;
}

/**
 * Factory class for creating Agent instances
 *
 * This factory provides a convenient way to create Agent instances with
 * proper dependency injection. It delegates to the DI container for agent
 * creation, which handles all dependency resolution and optional observer
 * wrapping automatically.
 *
 * The factory pattern is now simplified - the DI container handles:
 * - Creating all dependencies (ApiClient, MemoryModule, VirtualWorkspace, etc.)
 * - Merging configurations with defaults
 * - Optionally wrapping agents in ObservableAgent when observers are provided
 *
 * @example
 * ```ts
 * // Create with default configuration (workspace created internally)
 * const agent = AgentFactory.create(agentPrompt);
 *
 * // Create with custom configuration
 * const agent = AgentFactory.create(agentPrompt, {
 *   config: { apiRequestTimeout: 60000 },
 *   apiConfiguration: { apiModelId: 'custom-model' }
 * });
 *
 * // Create with custom workspace configuration
 * const agent = AgentFactory.create(agentPrompt, {
 *   virtualWorkspaceConfig: { id: 'custom-workspace', name: 'Custom Workspace' }
 * });
 *
 * // Create with observers (automatic notification via DI container)
 * const agent = AgentFactory.create(agentPrompt, {
 *   observers: {
 *     onStatusChanged: (taskId, status) => console.log(`Status: ${status}`),
 *     onTaskCompleted: (taskId) => console.log('Task completed!')
 *   }
 * });
 *
 * // Create with custom API client (for testing)
 * const agent = AgentFactory.createWithCustomClient(apiClient, agentPrompt);
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
   * The DI container handles all dependency injection and optional observer wrapping.
   * This factory method provides a convenient facade over the container.
   *
   * @param workspace - The VirtualWorkspace instance
   * @param agentPrompt - The agent prompt configuration
   * @param options - Optional configuration for the agent
   * @returns A configured Agent instance (optionally wrapped with ObservableAgent)
   */
  static create(
    workspace: VirtualWorkspace,
    agentPrompt: AgentPrompt,
    options: AgentFactoryOptions = {},
    mocks?: TestOverrides,
  ): Agent {
    // Log options without serializing apiClient (contains circular references)
    const { apiClient, ...loggableOptions } = options;
    console.log(
      '[AgentFactory.create] Creating agent with options:',
      JSON.stringify(loggableOptions, null, 2),
    );

    const {
      config: configPartial = {},
      apiConfiguration: apiConfigPartial = {},
      taskId,
      observers,
    } = options;

    // Use the container to create the agent
    // The container now handles observer wrapping internally
    const container = this.getContainer();

    // Create agent with container, passing the workspace, observers, and mocks
    // Mocks are now applied to the child container inside createAgent()
    const agent = container.createAgent({
      config: configPartial,
      apiConfiguration: apiConfigPartial,
      agentPrompt,
      taskId,
      workspace, // Pass the workspace to container for backward compatibility
      observers, // Pass observers to container - it will handle wrapping
      mocks, // Pass mocks to be applied to child container
    });

    console.log(
      '[AgentFactory.create] Agent instance created via container, taskId:',
      agent.getTaskId,
    );

    // No need to wrap here - the container handles it now
    console.log(
      '[AgentFactory.create] Returning agent',
      observers ? '(with observers)' : '(without observers)',
    );
    return agent;
  }

  /**
   * Create an Agent using the DI container directly
   * This is the recommended way for new code
   *
   * The container handles all dependency injection and optional observer wrapping.
   *
   * @param agentPrompt - The agent prompt configuration
   * @param options - Optional configuration for the agent
   * @returns A configured Agent instance (optionally wrapped with ObservableAgent)
   */
  static createWithContainer(
    agentPrompt: AgentPrompt,
    options: Omit<AgentFactoryOptions, 'apiClient'> & {
      workspace?: VirtualWorkspace;
    } = {},
  ): Agent {
    const container = this.getContainer();

    // The container handles observer wrapping internally
    return container.createAgent({
      config: options.config,
      apiConfiguration: options.apiConfiguration,
      agentPrompt,
      taskId: options.taskId,
      workspace: options.workspace,
      virtualWorkspaceConfig: options.virtualWorkspaceConfig, // Pass workspace config to container
      observers: options.observers, // Pass observers to container
    });
  }

}
