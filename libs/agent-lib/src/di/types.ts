/**
 * Service identifiers for InversifyJS dependency injection
 *
 * These symbols are used to identify services in the IoC container.
 * Each service should be bound to its corresponding TYPE when configuring the container.
 *
 * @example
 * ```typescript
 * import { TYPES } from './di/types.js';
 * import { Container } from 'inversify';
 *
 * const container = new Container();
 * container.bind<Agent>(TYPES.Agent).to(Agent);
 * ```
 */
export const TYPES = {
    Logger: Symbol('Logger'),

    /**
     * ObservableAgentCallbacks - Observer callbacks for agent monitoring
     * When provided, the container will automatically wrap agents in an ObservableAgent proxy
     * @scope Request - Shared within an agent creation request
     */
    ObservableAgentCallbacks: Symbol('ObservableAgentCallbacks'),

    // ==================== Core Services ====================

    /**
     * The main Agent class
     * @scope Transient - New instance per request
     */
    Agent: Symbol('Agent'),

    /**
     * VirtualWorkspace concrete class
     * @scope Request - Shared within an agent creation request
     */
    VirtualWorkspace: Symbol('VirtualWorkspace'),

    /**
     * IVirtualWorkspace interface
     * Use this for dependency injection to enable loose coupling
     * @scope Request - Shared within an agent creation request
     */
    IVirtualWorkspace: Symbol('IVirtualWorkspace'),

    /**
     * ApiClient interface
     * @scope Transient - New instance per request
     */
    ApiClient: Symbol('ApiClient'),

    /**
     * MemoryModule concrete class
     * @scope Request - Shared within an agent creation request
     */
    MemoryModule: Symbol('MemoryModule'),

    /**
     * IMemoryModule interface
     * Use this for dependency injection to enable loose coupling
     * @scope Request - Shared within an agent creation request
     */
    IMemoryModule: Symbol('IMemoryModule'),

    // ==================== Supporting Services ====================

    /**
     * SkillManager for managing agent skills
     * @scope Singleton - Shared across all agents
     */
    SkillManager: Symbol('SkillManager'),

    /**
     * SkillRegistry for skill registration
     * @scope Singleton - Shared across all agents
     */
    SkillRegistry: Symbol('SkillRegistry'),

    /**
     * TurnMemoryStore for turn-based memory storage
     * @scope Request - Shared within an agent creation request
     */
    TurnMemoryStore: Symbol('TurnMemoryStore'),

    /**
     * ReflectiveThinkingProcessor for reflective thinking
     * @scope Request - Shared within an agent creation request
     * @deprecated Use ThinkingModule instead
     */
    ReflectiveThinkingProcessor: Symbol('ReflectiveThinkingProcessor'),

    /**
     * ContextMemoryStore for context memory
     * @scope Request - Shared within an agent creation request
     */
    ContextMemoryStore: Symbol('ContextMemoryStore'),

    /**
     * ThinkingModule for thinking phase management
     * @scope Request - Shared within an agent creation request
     */
    ThinkingModule: Symbol('ThinkingModule'),

    /**
     * IThinkingModule interface
     * @scope Request - Shared within an agent creation request
     */
    IThinkingModule: Symbol('IThinkingModule'),

    // ==================== Configuration ====================

    /**
     * AgentConfig - Configuration object for Agent
     * Contains apiRequestTimeout, maxRetryAttempts, etc.
     */
    AgentConfig: Symbol('AgentConfig'),

    /**
     * AgentPrompt - Prompt configuration with capability and direction
     */
    AgentPrompt: Symbol('AgentPrompt'),

    /**
     * VirtualWorkspaceConfig - Configuration for VirtualWorkspace
     * Contains id, name, and other workspace settings
     */
    VirtualWorkspaceConfig: Symbol('VirtualWorkspaceConfig'),

    /**
     * MemoryModuleConfig - Configuration for MemoryModule
     * Contains enableRecall, maxRecallContexts, etc.
     */
    MemoryModuleConfig: Symbol('MemoryModuleConfig'),

    /**
     * ThinkingModuleConfig - Configuration for ThinkingModule
     * Contains maxThinkingRounds, thinkingTokenBudget, etc.
     */
    ThinkingModuleConfig: Symbol('ThinkingModuleConfig'),

    /**
     * ProviderSettings - API provider configuration
     * Contains apiProvider, apiKey, apiModelId
     */
    ProviderSettings: Symbol('ProviderSettings'),

    /**
     * TaskId - Optional task identifier for tracking
     */
    TaskId: Symbol('TaskId'),
} as const;
