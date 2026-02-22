import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import { Agent } from '../agent/agent.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { MemoryModule, defaultMemoryConfig } from '../memory/MemoryModule.js';
import { TurnMemoryStore } from '../memory/TurnMemoryStore.js';
import { createObservableTurnMemoryStore, TurnStoreObserverCallbacks } from '../memory/ObservableTurnMemoryStore.js';
import { ReflectiveThinkingProcessor } from '../memory/ReflectiveThinkingProcessor.js';
import { SkillManager } from '../skills/SkillManager.js';
import { ApiClientFactory } from '../api-client/ApiClientFactory.js';
import type { AgentConfig, AgentPrompt } from '../agent/agent.js';
import type { VirtualWorkspaceConfig } from '../statefulContext/types.js';
import type { MemoryModuleConfig } from '../memory/MemoryModule.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import { defaultAgentConfig } from '../agent/agent.js';
import type { ApiClient } from '../api-client/index.js';
import type { IVirtualWorkspace } from '../statefulContext/types.js';
import type { IMemoryModule } from '../memory/types.js';
import { createObservableAgent } from '../agent/ObservableAgent.js';
import type { ObservableAgentCallbacks } from '../agent/ObservableAgent.js';
import pino from 'pino';
import type { Logger, Level } from 'pino'

/**
 * Options for creating an Agent instance through the DI container
 *
 * @example
 * ```typescript
 * const agent = container.createAgent({
 *     agentPrompt: {
 *         capability: 'You are a helpful assistant',
 *         direction: 'Follow user instructions carefully'
 *     },
 *     config: { apiRequestTimeout: 60000 },
 *     apiConfiguration: { apiModelId: 'gpt-4' },
 *     taskId: 'task-123'
 * });
 * ```
 */
export interface AgentCreationOptions {
    /**
     * Agent configuration overrides
     * Merged with defaultAgentConfig from agent/agent.ts
     */
    config?: Partial<AgentConfig>;

    /**
     * API configuration overrides
     * Merged with default ProviderSettings (zai, GLM_API_KEY, glm-4.5)
     */
    apiConfiguration?: Partial<ProviderSettings>;

    /**
     * Agent prompt configuration
     * Defines the agent's capability and direction
     */
    agentPrompt?: AgentPrompt;

    /**
     * Optional task ID for tracking
     * Useful for debugging and monitoring specific agent instances
     */
    taskId?: string;

    /**
     * Virtual workspace configuration overrides
     * Merged with default VirtualWorkspaceConfig
     */
    virtualWorkspaceConfig?: Partial<VirtualWorkspaceConfig>;

    /**
     * Optional observer callbacks for monitoring
     * When provided, the agent will be automatically wrapped in an ObservableAgent proxy
     */
    observers?: ObservableAgentCallbacks;

    /**
     * Optional existing workspace instance
     * For backward compatibility with existing code that creates
     * VirtualWorkspace instances manually
     */
    workspace?: IVirtualWorkspace;
}

/**
 * AgentContainer - InversifyJS IoC Container for agent-lib
 *
 * This container manages all service dependencies for the Agent system.
 * It provides:
 * - Service bindings with appropriate scopes (Transient, Request, Singleton)
 * - Default configuration values for all services
 * - Dynamic value creation for ApiClient based on ProviderSettings
 * - Agent creation with custom options
 * - Support for mocking dependencies in tests
 *
 * @example
 * ```typescript
 * import 'reflect-metadata';
 * import { AgentContainer } from './di/container.js';
 *
 * const container = new AgentContainer();
 * const agent = container.createAgent({
 *     agentPrompt: { capability: 'Test', direction: 'Test' }
 * });
 * ```
 *
 * @example With mocking in tests
 * ```typescript
 * import { AgentContainer } from './di/container.js';
 * import { TYPES } from './di/types.js';
 *
 * const container = new AgentContainer();
 * const internalContainer = container.getContainer();
 *
 * // Mock ApiClient
 * const mockApiClient = { makeRequest: vi.fn() };
 * internalContainer.rebind(TYPES.ApiClient).toConstantValue(mockApiClient);
 *
 * const agent = container.createAgent({ ... });
 * ```
 */
export class AgentContainer {
    private container: Container;

    constructor() {
        this.container = new Container({
            defaultScope: 'Transient',
        });
        this.setupBindings();
    }

    private setupBindings(): void {
        // Core services - bind to interfaces where appropriate
        this.container
            .bind<Logger>(TYPES.Logger)
            .toDynamicValue(() => pino({
                level: 'info',
                formatters: {
                    level: (label) => {
                        return { level: label };
                    },
                },
                timestamp: pino.stdTimeFunctions.isoTime,
            }));
        this.container.bind(TYPES.Agent).to(Agent).inTransientScope();
        this.container.bind<IVirtualWorkspace>(TYPES.IVirtualWorkspace).to(VirtualWorkspace).inRequestScope();
        this.container.bind<IMemoryModule>(TYPES.IMemoryModule).to(MemoryModule).inRequestScope();

        // API Client - dynamic creation based on ProviderSettings
        this.container
            .bind<ProviderSettings>(TYPES.ProviderSettings)
            .toConstantValue({
                apiProvider: 'zai',
                apiKey: process.env['GLM_API_KEY'] || '',
                apiModelId: 'glm-4.5',
            });

        this.container.bind<ApiClient>(TYPES.ApiClient).toDynamicValue(() => {
            const config = this.container.get<ProviderSettings>(TYPES.ProviderSettings);
            return ApiClientFactory.create(config);
        });

        // Memory module and its dependencies
        this.container.bind(TYPES.MemoryModule).to(MemoryModule).inRequestScope();
        this.container.bind(TYPES.TurnMemoryStore).to(TurnMemoryStore).inRequestScope();
        this.container
            .bind(TYPES.ReflectiveThinkingProcessor)
            .to(ReflectiveThinkingProcessor)
            .inRequestScope();

        // ContextMemoryStore for ReflectiveThinkingProcessor
        // Note: This is created internally by ReflectiveThinkingProcessor if not injected

        // Skills - use factory to handle circular dependency with VirtualWorkspace
        this.container.bind<SkillManager>(TYPES.SkillManager).toDynamicValue(() => {
            // SkillManager will be initialized with a callback for skill changes
            // The actual VirtualWorkspace reference will be set when needed
            return new SkillManager({
                onSkillChange: () => {
                    // Placeholder - will be overridden when VirtualWorkspace is created
                },
            });
        });

        // Configuration defaults
        this.container.bind<AgentConfig>(TYPES.AgentConfig).toConstantValue(defaultAgentConfig);
        this.container
            .bind<MemoryModuleConfig>(TYPES.MemoryModuleConfig)
            .toConstantValue(defaultMemoryConfig);

        // Default VirtualWorkspaceConfig
        this.container
            .bind<VirtualWorkspaceConfig>(TYPES.VirtualWorkspaceConfig)
            .toConstantValue({
                id: 'default-workspace',
                name: 'Default Workspace',
            });
    }

    /**
     * Create an Agent with the provided options
     *
     * Creates a new container for each agent to ensure isolated scope.
     * This means each agent gets its own instances of Request-scoped services.
     *
     * If observer callbacks are provided via options.observers, the agent
     * will be automatically wrapped in an ObservableAgent proxy for monitoring.
     *
     * @param options - Configuration options for the agent
     * @returns A new Agent instance (optionally wrapped with ObservableAgent)
     *
     * @example
     * ```typescript
     * const agent = container.createAgent({
     *     agentPrompt: {
     *         capability: 'You are a coding assistant',
     *         direction: 'Help users write clean code'
     *     },
     *     config: {
     *         apiRequestTimeout: 60000,
     *         maxRetryAttempts: 5
     *     },
     *     apiConfiguration: {
     *         apiProvider: 'openai',
     *         apiModelId: 'gpt-4'
     *     }
     * });
     * ```
     *
     * @example With observers
     * ```typescript
     * const agent = container.createAgent({
     *     agentPrompt: { capability: 'Test', direction: 'Test' },
     *     observers: {
     *         onStatusChanged: (taskId, status) => console.log(`Status: ${status}`),
     *         onMessageAdded: (taskId, message) => console.log('New message:', message)
     *     }
     * });
     * ```
     */
    public createAgent(options: AgentCreationOptions = {}): Agent {
        const agentContainer = new Container({
            defaultScope: 'Transient',
        });

        // Setup all bindings for the agent container
        this.setupAgentBindings(agentContainer, options);

        // Get the base agent instance
        const agent = agentContainer.get<Agent>(TYPES.Agent);

        // If observers are provided, wrap the agent in an ObservableAgent proxy
        // This is now handled by the DI container instead of post-wrapping
        if (options.observers && Object.keys(options.observers).length > 0) {
            return createObservableAgent(agent, options.observers);
        }

        return agent;
    }

    /**
     * Setup bindings for an agent container with custom options
     *
     * This method configures all service bindings for a specific agent instance.
     * It merges user-provided options with defaults and binds all necessary
     * services to the container.
     *
     * @param agentContainer - The container to configure
     * @param options - User-provided configuration options
     */
    private setupAgentBindings(
        agentContainer: Container,
        options: AgentCreationOptions,
    ): void {
        // Determine configuration values
        const agentConfig: AgentConfig = options.config
            ? { ...defaultAgentConfig, ...options.config }
            : defaultAgentConfig;

        const providerSettings: ProviderSettings = options.apiConfiguration
            ? {
                apiProvider: 'zai',
                apiKey: process.env['GLM_API_KEY'] || '',
                apiModelId: 'glm-4.5',
                ...options.apiConfiguration,
            }
            : {
                apiProvider: 'zai',
                apiKey: process.env['GLM_API_KEY'] || '',
                apiModelId: 'glm-4.5',
            };

        const agentPrompt: AgentPrompt = options.agentPrompt || {
            capability: 'Default agent capability',
            direction: 'Default agent direction',
        };

        const workspaceConfig: VirtualWorkspaceConfig = options.virtualWorkspaceConfig
            ? {
                id: 'default-workspace',
                name: 'Default Workspace',
                ...options.virtualWorkspaceConfig,
            }
            : {
                id: 'default-workspace',
                name: 'Default Workspace',
            };

        // Bind configuration values
        agentContainer.bind<Logger>(TYPES.Logger).toDynamicValue(() =>
            pino({
                level: 'debug',
                formatters: {
                    level: (label) => ({ level: label }),
                },
                timestamp: pino.stdTimeFunctions.isoTime,
            })
        )
        agentContainer.bind<AgentConfig>(TYPES.AgentConfig).toConstantValue(agentConfig);
        agentContainer
            .bind<ProviderSettings>(TYPES.ProviderSettings)
            .toConstantValue(providerSettings);
        agentContainer.bind<AgentPrompt>(TYPES.AgentPrompt).toConstantValue(agentPrompt);
        agentContainer
            .bind<VirtualWorkspaceConfig>(TYPES.VirtualWorkspaceConfig)
            .toConstantValue(workspaceConfig);

        // MemoryModuleConfig - merge with apiRequestTimeout from AgentConfig
        agentContainer
            .bind<MemoryModuleConfig>(TYPES.MemoryModuleConfig)
            .toDynamicValue(() => {
                const config = agentContainer.get<AgentConfig>(TYPES.AgentConfig);
                return {
                    ...defaultMemoryConfig,
                    apiRequestTimeout: config.apiRequestTimeout,
                };
            });

        if (options.taskId) {
            agentContainer.bind<string>(TYPES.TaskId).toConstantValue(options.taskId);
        }

        // Bind observer callbacks if provided
        if (options.observers) {
            agentContainer.bind<ObservableAgentCallbacks>(TYPES.ObservableAgentCallbacks)
                .toConstantValue(options.observers);
        }

        // Bind services
        agentContainer.bind(TYPES.Agent).to(Agent).inTransientScope();

        // Handle workspace - if provided, bind it as constant; otherwise create new one
        if (options.workspace) {
            // Bind the provided workspace instance
            agentContainer
                .bind<IVirtualWorkspace>(TYPES.IVirtualWorkspace)
                .toConstantValue(options.workspace);
        } else {
            // Create a new VirtualWorkspace instance
            agentContainer
                .bind<IVirtualWorkspace>(TYPES.IVirtualWorkspace)
                .to(VirtualWorkspace)
                .inRequestScope();
        }
        agentContainer
            .bind<IMemoryModule>(TYPES.IMemoryModule)
            .to(MemoryModule)
            .inRequestScope();

        // API Client - dynamic creation based on ProviderSettings
        agentContainer.bind<ApiClient>(TYPES.ApiClient).toDynamicValue(() => {
            const config = agentContainer.get<ProviderSettings>(TYPES.ProviderSettings);
            return ApiClientFactory.create(config);
        });

        // Memory module and its dependencies
        agentContainer.bind(TYPES.MemoryModule).to(MemoryModule).inRequestScope();

        // TurnMemoryStore - wrap with observer if turn-level callbacks are provided
        if (options.observers && hasTurnLevelCallbacks(options.observers)) {
            agentContainer.bind(TYPES.TurnMemoryStore).toDynamicValue(() => {
                const baseStore = new TurnMemoryStore();
                return createObservableTurnMemoryStore(baseStore, extractTurnCallbacks(options.observers!));
            }).inRequestScope();
        } else {
            agentContainer.bind(TYPES.TurnMemoryStore).to(TurnMemoryStore).inRequestScope();
        }

        agentContainer
            .bind(TYPES.ReflectiveThinkingProcessor)
            .to(ReflectiveThinkingProcessor)
            .inRequestScope();

        // Skills - use factory to handle circular dependency with VirtualWorkspace
        agentContainer.bind<SkillManager>(TYPES.SkillManager).toDynamicValue(() => {
            return new SkillManager({
                onSkillChange: () => {
                    // Placeholder - will be overridden when VirtualWorkspace is created
                },
            });
        });
    }

    /**
     * Get the root container for advanced usage
     *
     * Use this method when you need to:
     * - Rebind services for testing
     * - Access container internals
     * - Create child containers with custom bindings
     *
     * @returns The underlying InversifyJS Container instance
     *
     * @example
     * ```typescript
     * const container = new AgentContainer();
     * const internalContainer = container.getContainer();
     *
     * // Rebind a service for testing
     * internalContainer.rebind<ApiClient>(TYPES.ApiClient)
     *     .toConstantValue(mockApiClient);
     * ```
     */
    public getContainer(): Container {
        return this.container;
    }

    /**
     * Create a child container with custom bindings
     *
     * Child containers inherit bindings from their parent but can
     * override specific bindings. This is useful for creating
     * isolated test environments or custom agent configurations.
     *
     * @returns A new child Container instance
     *
     * @example
     * ```typescript
     * const parentContainer = new AgentContainer();
     * const childContainer = parentContainer.createChildContainer();
     *
     * // Override a binding in the child
     * childContainer.bind<ApiClient>(TYPES.ApiClient)
     *     .toConstantValue(customApiClient);
     * ```
     */
    public createChildContainer(): Container {
        const childContainer = new Container({
            defaultScope: 'Transient',
        });
        return childContainer;
    }
}

// Singleton instance
let globalContainer: AgentContainer | null = null;

/**
 * Get the global container instance
 *
 * Returns a singleton AgentContainer instance. Creates a new instance
 * on first call and reuses it for subsequent calls.
 *
 * @returns The global AgentContainer instance
 *
 * @example
 * ```typescript
 * import { getGlobalContainer } from './di/container.js';
 *
 * const container = getGlobalContainer();
 * const agent = container.createAgent({ ... });
 * ```
 *
 * @note Remember to call `resetGlobalContainer()` between tests
 * to ensure test isolation.
 */
export function getGlobalContainer(): AgentContainer {
    if (!globalContainer) {
        globalContainer = new AgentContainer();
    }
    return globalContainer;
}

/**
 * Reset the global container instance
 *
 * Clears the global container instance, causing the next call to
 * `getGlobalContainer()` to create a fresh instance.
 *
 * This is particularly useful in testing scenarios to ensure
 * test isolation and prevent state leakage between tests.
 *
 * @example
 * ```typescript
 * import { describe, beforeEach } from 'vitest';
 * import { resetGlobalContainer } from './di/container.js';
 *
 * describe('Agent Tests', () => {
 *     beforeEach(() => {
 *         resetGlobalContainer();
 *     });
 *
 *     it('should create isolated agent', () => {
 *         // Each test gets a fresh container
 *     });
 * });
 * ```
 */
export function resetGlobalContainer(): void {
    globalContainer = null;
}

/**
 * Check if the observer callbacks include any turn-level callbacks
 */
function hasTurnLevelCallbacks(observers: ObservableAgentCallbacks): boolean {
    return !!(
        observers.onTurnCreated ||
        observers.onTurnStatusChanged ||
        observers.onTurnMessageAdded ||
        observers.onThinkingPhaseCompleted ||
        observers.onToolCallRecorded ||
        observers.onTurnSummaryStored ||
        observers.onTurnActionTokensUpdated
    );
}

/**
 * Extract turn-level callbacks from ObservableAgentCallbacks
 */
function extractTurnCallbacks(observers: ObservableAgentCallbacks): TurnStoreObserverCallbacks {
    return {
        onTurnCreated: observers.onTurnCreated,
        onTurnStatusChanged: observers.onTurnStatusChanged,
        onTurnMessageAdded: observers.onTurnMessageAdded,
        onThinkingPhaseCompleted: observers.onThinkingPhaseCompleted,
        onToolCallRecorded: observers.onToolCallRecorded,
        onTurnSummaryStored: observers.onTurnSummaryStored,
        onTurnActionTokensUpdated: observers.onTurnActionTokensUpdated,
    };
}
