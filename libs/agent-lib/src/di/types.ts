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
     * Container - The InversifyJS container instance
     * @scope Singleton - Shared across all agents
     */
    Container: Symbol('Container'),

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
     * ITurnMemoryStore interface
     * Use this for dependency injection to enable loose coupling
     * @scope Request - Shared within an agent creation request
     */
    ITurnMemoryStore: Symbol('ITurnMemoryStore'),

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

    // ==================== Task Module ====================

    /**
     * TaskModule - Container for managing Tasks with dedicated collectors/validators
     * @scope Request - Shared within an agent creation request
     */
    TaskModule: Symbol('TaskModule'),

    /**
     * ITaskModule interface
     * Use this for dependency injection to enable loose coupling
     * @scope Request - Shared within an agent creation request
     */
    ITaskModule: Symbol('ITaskModule'),

    // ==================== Tool Management ====================

    /**
     * IToolManager - Central tool management
     * @scope Singleton - Shared across all agents
     */
    IToolManager: Symbol('IToolManager'),

    /**
     * IToolProvider interface
     * @scope Transient - New instance per registration
     */
    IToolProvider: Symbol('IToolProvider'),

    /**
     * IGlobalToolProvider concrete
     * @scope Singleton - Shared across all agents
     */
    IGlobalToolProvider: Symbol('IGlobalToolProvider'),

    /**
     * IComponentToolProvider concrete
     * @scope Transient - New instance per component
     */
    IComponentToolProvider: Symbol('IComponentToolProvider'),

    /**
     * IToolStateStrategy interface
     * @scope Transient - New instance per strategy
     */
    IToolStateStrategy: Symbol('IToolStateStrategy'),

    // ==================== Tool Components ====================

    /**
     * PicosComponent - PICO extraction component for evidence-based medicine
     * @scope Request - New instance per skill activation
     */
    PicosComponent: Symbol('PicosComponent'),

    /**
     * BibliographySearchComponent - PubMed search and article retrieval
     * @scope Request - New instance per skill activation
     */
    BibliographySearchComponent: Symbol('BibliographySearchComponent'),

    /**
     * PrismaCheckListComponent - PRISMA checklist management
     * @scope Request - New instance per skill activation
     */
    PrismaCheckListComponent: Symbol('PrismaCheckListComponent'),

    /**
     * PrismaFlowComponent - PRISMA flow diagram tracking
     * @scope Request - New instance per skill activation
     */
    PrismaFlowComponent: Symbol('PrismaFlowComponent'),

    // ==================== Action Module ====================

    /**
     * ActionModule for action phase management
     * @scope Request - Shared within an agent creation request
     */
    ActionModule: Symbol('ActionModule'),

    /**
     * IActionModule interface
     * @scope Request - Shared within an agent creation request
     */
    IActionModule: Symbol('IActionModule'),

    /**
     * ActionModuleConfig - Configuration for ActionModule
     */
    ActionModuleConfig: Symbol('ActionModuleConfig'),
} as const;
