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
     * @deprecated This symbol is deprecated and may be removed in a future version
     */
    ReflectiveThinkingProcessor: Symbol('ReflectiveThinkingProcessor'),

    /**
     * ContextMemoryStore for context memory
     * @scope Request - Shared within an agent creation request
     */
    ContextMemoryStore: Symbol('ContextMemoryStore'),

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
     * ProviderSettings - API provider configuration
     * Contains apiProvider, apiKey, apiModelId
     */
    ProviderSettings: Symbol('ProviderSettings'),

    /**
     * TaskId - Optional task identifier for tracking
     */
    TaskId: Symbol('TaskId'),

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
     * @scope Transient - New instance per strategy
     */

    // ==================== Tool Components ====================

    /**
     * PicosComponent - PICO extraction component for evidence-based medicine
     * @scope Singleton - Shared across all skill activations
     */
    PicosComponent: Symbol('PicosComponent'),

    /**
     * BibliographySearchComponent - PubMed search and article retrieval
     * @scope Singleton - Shared across all skill activations
     */
    BibliographySearchComponent: Symbol('BibliographySearchComponent'),

    /**
     * PrismaCheckListComponent - PRISMA checklist management
     * @scope Singleton - Shared across all skill activations
     */
    PrismaCheckListComponent: Symbol('PrismaCheckListComponent'),

    /**
     * PrismaFlowComponent - PRISMA flow diagram tracking
     * @scope Singleton - Shared across all skill activations
     */
    PrismaFlowComponent: Symbol('PrismaFlowComponent'),

    /**
     * PaperAnalysisComponent - Paper analysis for complexity, citations, and comparisons
     * @scope Singleton - Shared across all skill activations
     */
    PaperAnalysisComponent: Symbol('PaperAnalysisComponent'),

    /**
     * VirtualFileSystemComponent - Virtual file system via S3 (rustfs)
     * @scope Singleton - Shared across all skill activations
     */
    VirtualFileSystemComponent: Symbol('VirtualFileSystemComponent'),

    /**
     * TestToolComponentA - Test component for search functionality
     * @scope Singleton - Shared across all skill activations
     */
    TestToolComponentA: Symbol('TestToolComponentA'),

    /**
     * TestToolComponentB - Test component for counter functionality
     * @scope Singleton - Shared across all skill activations
     */
    TestToolComponentB: Symbol('TestToolComponentB'),

    /**
     * TestToolComponentC - Test component for toggle functionality
     * @scope Singleton - Shared across all skill activations
     */
    TestToolComponentC: Symbol('TestToolComponentC'),

    /**
     * IExpertExecutor - Expert creation and execution
     * @scope Singleton - Shared across all agents
     */
    IExpertExecutor: Symbol('IExpertExecutor'),

    /**
     * IExpertAdapter - Bridge between MessageBus and Expert system
     * @scope Transient - New instance per expert
     */
    IExpertAdapter: Symbol('IExpertAdapter'),

    /**
     * IMCAdapter - Bridge between MessageBus and Main Controller
     * @scope Singleton - Shared across all MCs
     */
    IMCAdapter: Symbol('IMCAdapter'),

    // ==================== Message Bus ====================

    /**
     * IMessageBus - Message routing for multi-agent communication
     * @scope Singleton - Shared across all agents
     */
    IMessageBus: Symbol('IMessageBus'),

    /**
     * MessageBusConfig - Configuration for MessageBus
     * @scope Singleton - Shared configuration
     */
    MessageBusConfig: Symbol('MessageBusConfig'),
} as const;
