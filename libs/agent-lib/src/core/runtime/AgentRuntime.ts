/**
 * AgentRuntime - Main class for managing multiple Agent instances
 *
 * This is the central orchestration layer for the agent system. It manages the complete
 * lifecycle of agents and provides agent communication via topology network.
 *
 * ## Architecture Overview
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      AgentRuntime                           │
 * ├─────────────────────────────────────────────────────────────┤
 * │  ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
 * │  │  Registry   │  │ EventDispatcher  │  │   Topology    │  │
 * │  │ (metadata)  │  │  (pub/sub)       │  │   Network     │  │
 * │  └─────────────┘  └──────────────────┘  └───────────────┘  │
 * ├─────────────────────────────────────────────────────────────┤
 * │  ┌─────────────────────────────────────────────────────┐   │
 * │  │              Agent Containers (DI)                   │   │
 * │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐         │   │
 * │  │  │ Agent #1  │ │ Agent #2  │ │ Agent #N  │         │   │
 * │  │  └───────────┘ └───────────┘ └───────────┘         │   │
 * │  └─────────────────────────────────────────────────────┘   │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Key Responsibilities
 *
 * 1. **Agent Lifecycle Management**
 *    - createAgent: Instantiate new agents with DI container
 *    - startAgent: Transition agent to running state
 *    - stopAgent: Gracefully stop agent execution
 *    - destroyAgent: Remove agent and cleanup resources
 *
 * 2. **Agent Communication** (via Topology Network)
 *    - A2A (Agent-to-Agent) messaging through topology network
 *    - Request/response patterns for agent coordination
 *
 * 3. **Event System**
 *    - agent:created, agent:started, agent:stopped, agent:destroyed
 *    - agent:idle - agent became idle and is ready for work
 *
 * @module AgentRuntime
 */

import type { Agent } from '../agent/agent.js';
import type { AgentContainer, AgentCreationOptions } from '../di/container.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import {
  AgentFactory,
  type AgentFactoryOptions,
  type AgentBlueprint,
} from '../agent/AgentFactory.js';
import type {
  AgentMetadata,
  AgentRuntimeConfig,
  RuntimeEvent,
  RuntimeEventType,
  AgentEventPayload,
  IRuntimeControlClient,
  RuntimeControlAgentOptions,
  RuntimeStats,
  RuntimeControlProviderSettings,
  ConversationTaskInfo,
  TaskCallbacks,
} from './types.js';
import { AgentStatus } from './types.js';
import type { IAgentRegistry } from './AgentRegistry.js';
import { AgentRegistry } from './AgentRegistry.js';
import type { IEventDispatcher } from './EventDispatcher.js';
import { EventDispatcher } from './EventDispatcher.js';
import { RuntimeControlClientImpl } from './RuntimeControlClient.js';

// Topology Network
import type { ITopologyGraph } from './topology/graph/TopologyGraph.js';
import type { TopologyMessage, RoutingStats } from './topology/types.js';
import { createTopologyGraph } from './topology/graph/TopologyGraph.js';
import {
  createMessageBusFromConfig,
  isRedisMessageBus,
  type MessageBusFactoryConfig,
} from './topology/messaging/index.js';
import { createMessageRouter } from './topology/routing/MessageRouter.js';
import type { IMessageBus } from './topology/messaging/MessageBus.js';
import type { IMessageRouter } from './topology/routing/MessageRouter.js';

// A2A Communication
import {
  A2AClient,
  createA2AClient,
  getGlobalAgentRegistry,
} from '../a2a/index.js';
import type { IAgentCardRegistry } from '../a2a/index.js';
import type { AgentCard } from '../a2a/types.js';
import { createUserContext, type IUserContext } from './UserContext.js';

function generateShortUuid(length = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateAgentAlias(name: string): string {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  return `${safeName}-${generateShortUuid(4)}`;
}

/**
 * AgentFilter - Options for filtering agents in listAgents()
 *
 * Used to query a subset of agents based on their properties.
 * All properties are optional - only provided filters are applied.
 *
 * @example
 * // Get all idle agents
 * runtime.listAgents({ status: 'idle' });
 *
 * // Get all agents of a specific type
 * runtime.listAgents({ agentType: 'worker' });
 *
 * // Get agents by name pattern
 * runtime.listAgents({ name: 'research' });
 */
export interface AgentFilter {
  /** Filter by agent's current status */
  status?: AgentStatus;
  /** Filter by agent type identifier */
  agentType?: string;
  /** Filter by partial name match (includes check) */
  name?: string;
}

/**
 * IAgentRuntime - Public interface for Agent Runtime
 *
 * Defines the contract for the agent runtime system. This interface
 * separates the public API from implementation details, allowing
 * consumers to depend on the interface rather than concrete implementation.
 *
 * ## Usage Example
 *
 * ```typescript
 * const runtime = createAgentRuntime({ maxAgents: 5 });
 *
 * // Start the runtime
 * await runtime.start();
 *
 * // Create and start an agent
 * const agentId = await runtime.createAgent({ ... });
 * await runtime.startAgent(agentId);
 *
 * // Monitor events
 * const unsubscribe = runtime.on('agent:created', (event) => {
 *   console.log('Agent created:', event.payload);
 * });
 *
 * // Cleanup
 * unsubscribe();
 * await runtime.stop();
 * ```
 */
export interface IAgentRuntime {
  // ============================================
  // Agent Lifecycle Methods
  // ============================================

  /**
   * Create a new agent instance with the specified configuration.
   * @param soul Agent soul configuration (agent config + components)
   * @param overrides Optional overrides for api, workspace, observers
   * @returns Promise resolving to the new agent's instance ID
   */
  createAgent(
    soul: AgentBlueprint,
    overrides?: Partial<AgentFactoryOptions>,
  ): Promise<string>;

  /**
   * Start an idle agent, transitioning it to running state.
   * @param instanceId The agent's unique instance identifier
   */
  startAgent(instanceId: string): Promise<void>;

  /**
   * Stop a running agent.
   * @param instanceId The agent's unique instance identifier
   */
  stopAgent(instanceId: string): Promise<void>;

  /**
   * Destroy an agent, removing it from the runtime completely.
   * Automatically stops the agent if running.
   * @param instanceId The agent's unique instance identifier
   */
  destroyAgent(instanceId: string): Promise<void>;

  // ============================================
  // Agent Query Methods
  // ============================================

  /**
   * Get an agent instance by its ID.
   * @param instanceId The agent's unique instance identifier
   * @returns Promise resolving to the Agent or undefined if not found
   */
  getAgent(instanceId: string): Promise<Agent | undefined>;

  /**
   * Get the DI container for an agent.
   * @param instanceId The agent's unique instance identifier
   * @returns The AgentContainer or undefined if not found
   */
  getAgentContainer(instanceId: string): AgentContainer | undefined;

  /**
   * List all agents matching the optional filter criteria.
   * @param filter Optional filter criteria
   * @returns Promise resolving to array of agent metadata
   */
  listAgents(filter?: AgentFilter): Promise<AgentMetadata[]>;

  /**
   * Get agent metadata by instance ID.
   * @param instanceId The agent's unique instance identifier
   * @returns Agent metadata or undefined if not found
   */
  getAgentMetadata(instanceId: string): AgentMetadata | undefined;

  /**
   * Resolve agent ID, alias, or name to instance ID.
   * @param idOrAliasOrName Instance ID, alias, or name to resolve
   * @returns Resolved instance ID
   * @throws Error if agent not found
   */
  resolveAgentId(idOrAliasOrName: string): string;

  /**
   * List child agents of a parent agent.
   * @param parentInstanceId Parent agent's instance ID
   * @returns Promise resolving to array of child agent metadata
   */
  listChildAgents(parentInstanceId: string): Promise<AgentMetadata[]>;

  /**
   * Get a RuntimeControlClient for a specific agent.
   * @param instanceId The agent's instance ID
   * @returns IRuntimeControlClient instance
   */
  getRuntimeClient(instanceId: string): IRuntimeControlClient;

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to runtime events.
   * @param eventType The type of event to subscribe to
   * @param handler Callback function for the event
   * @returns Unsubscribe function
   */
  on(
    eventType: RuntimeEventType,
    handler: (event: RuntimeEvent) => void,
  ): () => void;

  // ============================================
  // Runtime Control
  // ============================================

  /**
   * Start the runtime, enabling event processing.
   */
  start(): Promise<void>;

  /**
   * Stop the runtime, halting all event processing and stopping all agents.
   */
  stop(): Promise<void>;

  /**
   * Get current runtime statistics.
   */
  getStats(): Promise<RuntimeStats>;

  // ============================================
  // Topology Network (Agent Communication)
  // ============================================

  /**
   * Register an agent in the topology network.
   * @param instanceId The agent's unique instance identifier
   * @param nodeType Type of node (router, worker, hybrid)
   * @param capabilities Optional capabilities for routing decisions
   */
  registerInTopology(
    instanceId: string,
    nodeType: 'router' | 'worker' | 'hybrid',
    capabilities?: string[],
  ): void;

  /**
   * Unregister an agent from the topology network.
   * @param instanceId The agent's unique instance identifier
   */
  unregisterFromTopology(instanceId: string): void;

  /**
   * Connect two agents in the topology network.
   * @param from Source agent ID
   * @param to Target agent ID
   * @param edgeType Type of connection (parent-child, peer, route)
   */
  connectAgents(
    from: string,
    to: string,
    edgeType?: 'parent-child' | 'peer' | 'route',
  ): void;

  /**
   * Disconnect two agents in the topology network.
   * @param from Source agent ID
   * @param to Target agent ID
   */
  disconnectAgents(from: string, to: string): void;

  /**
   * Send a message to a specific agent via topology network.
   * @param to Target agent ID
   * @param content Message content
   * @param messageType Type of message (request, event, ack, result)
   */
  sendToAgent(
    to: string,
    content: unknown,
    messageType?: 'request' | 'event' | 'ack' | 'result' | 'error',
  ): Promise<import('./topology/types.js').TopologyMessage>;

  /**
   * Broadcast a message to all children of an agent.
   * @param from Source agent ID
   * @param content Message content
   */
  broadcastToChildren(
    from: string,
    content: unknown,
  ): Promise<import('./topology/types.js').TopologyMessage[]>;

  /**
   * Subscribe to messages for a specific agent.
   * @param instanceId Agent ID to subscribe
   * @param handler Message handler callback
   */
  subscribeToAgent(
    instanceId: string,
    handler: (message: import('./topology/types.js').TopologyMessage) => void,
  ): () => void;

  /**
   * Request a response from an agent (two-phase protocol).
   * @param to Target agent ID
   * @param content Request content
   * @param from Optional source ID (defaults to 'external')
   */
  requestFromAgent(
    to: string,
    content: unknown,
    from?: string,
  ): Promise<{
    ack: import('./topology/types.js').TopologyMessage;
    result: Promise<import('./topology/types.js').TopologyMessage>;
  }>;

  /**
   * Get the topology graph.
   */
  getTopologyGraph(): import('./topology/graph/TopologyGraph.js').ITopologyGraph;

  /**
   * Get topology network statistics.
   */
  getTopologyStats(): import('./topology/types.js').RoutingStats;

  // ============================================
  // User Context (User as Agent)
  // ============================================

  /**
   * Get the message bus for A2A communication.
   * Used by UserContext to send messages to agents.
   */
  getMessageBus(): IMessageBus;

  /**
   * Get the agent registry for service discovery.
   * Used by UserContext for A2A client.
   */
  getRegistry(): IAgentCardRegistry;

  /**
   * Create a user context - treats external user as an Agent.
   * The user can manage agents and send A2A tasks/queries/events.
   */
  createUserContext(options?: {
    userId?: string;
    defaultTimeout?: number;
  }): IUserContext;

  // ============================================
  // Task Integration
  // ============================================

  /**
   * Set task callbacks for tracking task state changes.
   * Called when conversation events (ACK, completed, failed) occur.
   */
  setTaskCallbacks(callbacks: TaskCallbacks): void;

  /**
   * Register a Runtime Task ID for a conversation.
   * This allows the runtime to notify task state changes via callbacks.
   */
  registerConversationTask(
    conversationId: string,
    runtimeTaskId: string,
    taskId: string,
  ): void;

  /**
   * Get conversation info by A2A task ID.
   */
  getConversationByTaskId(
    taskId: string,
  ): { conversationId: string; runtimeTaskId?: string } | undefined;
}

/**
 * AgentRuntime - Concrete implementation of IAgentRuntime
 *
 * This class is the main orchestrator for the agent system. It manages:
 *
 * 1. **Agent Containers** - Each agent runs in its own DI container for isolation
 * 2. **Agent Registry** - Tracks metadata and status of all agents
 * 3. **Event Dispatcher** - Pub/sub system for runtime events
 * 4. **Topology Network** - Agent-to-agent communication via A2A
 *
 * ## Thread Safety & Concurrency
 *
 * - Event handlers run asynchronously
 * - Agent state transitions are protected by status checks
 *
 * ## Memory Management
 *
 * - Maximum agent count is configurable via `maxAgents` in config
 * - Destroyed agents are fully removed from memory
 * - Event subscriptions are cleaned up on runtime stop
 *
 * ## Design Patterns Used
 *
 * - **Factory Pattern**: AgentFactory creates agent containers
 * - **Observer Pattern**: EventDispatcher for pub/sub
 * - **Registry Pattern**: AgentRegistry for metadata tracking
 * - **Dependency Injection**: Each agent has isolated container
 */
export class AgentRuntime implements IAgentRuntime {
  // ============================================
  // Private Properties
  // ============================================

  /** Runtime configuration options */
  private config: AgentRuntimeConfig;

  /** Default API configuration for all agents */
  private defaultApiConfig: Partial<RuntimeControlProviderSettings> | undefined;

  /**
   * Map of agent instance IDs to their DI containers.
   * Each container provides isolated dependency resolution for its agent.
   */
  private containers: Map<string, AgentContainer> = new Map();

  /**
   * Registry for tracking agent metadata and status.
   * Provides fast lookup and status management.
   */
  private registry: IAgentRegistry;

  /**
   * Event dispatcher for pub/sub messaging.
   * Used for both external monitoring and internal coordination.
   */
  private eventDispatcher: IEventDispatcher;

  /** Flag indicating if runtime is actively running */
  private running: boolean = false;

  // ============================================
  // Task Integration
  // ============================================

  /** Map of conversationId to Runtime Task info */
  private conversationTaskMap: Map<string, ConversationTaskInfo> = new Map();

  /** Callbacks for task state updates */
  private taskCallbacks: TaskCallbacks = {};

  // ============================================
  // Topology Network (Agent Communication)
  // ============================================

  /** Topology graph for agent connections */
  private topologyGraph: ITopologyGraph;

  /** Message bus for agent communication */
  private messageBus: IMessageBus;

  /** Message router for routing decisions */
  private messageRouter: IMessageRouter;

  // ============================================
  // Event Subscription Cleanup
  // ============================================

  /**
   * Array of unsubscribe functions for internal event listeners.
   * Used for cleanup during runtime.stop().
   */
  private eventUnsubscribers: (() => void)[] = [];

  // ============================================
  // Constructor
  // ============================================

  /**
   * Create a new AgentRuntime instance.
   *
   * @param config Runtime configuration options
   * @param config.maxAgents Maximum number of agents allowed (default: 10)
   *
   * @example
   * const runtime = new AgentRuntime({ maxAgents: 5 });
   *
   * @example
   * // Use Redis for distributed A2A communication
   * const runtime = new AgentRuntime({
   *   messageBus: {
   *     mode: 'redis',
   *     redis: { url: 'redis://localhost:6379' }
   *   }
   * });
   */
  constructor(config: AgentRuntimeConfig = {}) {
    this.config = {
      maxAgents: 10,
      ...config,
    };

    this.defaultApiConfig = config.defaultApiConfig;

    // Initialize core components that don't require DI container
    // These are shared across all agents managed by this runtime
    this.registry = new AgentRegistry();
    this.eventDispatcher = new EventDispatcher();

    // Initialize topology network for agent communication
    this.topologyGraph = createTopologyGraph();

    // Create MessageBus based on configuration
    const messageBusConfig: MessageBusFactoryConfig = {
      mode: config.messageBus?.mode ?? 'memory',
      redis: config.messageBus?.redis,
      topology: {
        defaultAckTimeout: config.ackTimeout,
        maxRetries: config.maxRetries,
      },
    };
    this.messageBus = createMessageBusFromConfig(messageBusConfig);

    // Connect to Redis if using RedisMessageBus
    if (
      messageBusConfig.mode === 'redis' &&
      isRedisMessageBus(this.messageBus)
    ) {
      // Connection happens lazily on first use, but we can connect eagerly here
      this.messageBus.connect().catch((err) => {
        console.error(
          '[AgentRuntime] Failed to connect to Redis:',
          err.message,
        );
      });
    }

    this.messageRouter = createMessageRouter(this.topologyGraph);
    this.messageRouter.setMessageBus(this.messageBus);

    // Route topology events through runtime event dispatcher
    // Also handle task callbacks for conversation events
    this.messageBus.onEvent((event) => {
      this.eventDispatcher.emitEvent(
        event.type as any,
        event.payload as AgentEventPayload,
      );

      // Handle task callbacks
      this.handleTaskCallback(event);
    });

    // Route topology messages through runtime message handler
    this.messageBus.onMessage((message) => {
      this.handleTopologyMessage(message);
    });

    // Setup internal event listeners
    this.setupEventListeners();
  }

  // ============================================
  // Private: Event Setup
  // ============================================

  /**
   * Setup internal event listeners.
   */
  private setupEventListeners(): void {
    // Agent events are routed through topology network
  }

  // ============================================
  // Public: Agent Lifecycle Methods
  // ============================================

  /**
   * Create a new agent instance.
   *
   * This method:
   * 1. Creates a new DI container for the agent via AgentFactory
   * 2. Registers the agent in the registry
   * 3. Emits agent:created event
   *
   * @param options Agent factory options including configuration
   * @returns Promise resolving to the new agent's instance ID
   * @throws Error if maximum agent limit is reached
   *
   * @example
   * const agentId = await runtime.createAgent({
   *   config: {
   *     agent: { name: 'worker-1', type: 'worker' },
   *     llm: { provider: 'openai', model: 'gpt-4' }
   *   }
   * });
   */
  async createAgent(
    soul: AgentBlueprint,
    overrides?: Partial<AgentFactoryOptions>,
  ): Promise<string> {
    if (this.containers.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Maximum agent limit reached: ${this.config.maxAgents}`);
    }

    // Merge API config: runtime default + overrides
    // overrides take precedence over runtime defaults
    const mergedApi = {
      ...this.defaultApiConfig,
      ...overrides?.api,
    } as Partial<ProviderSettings>;

    // Build final options: soul.agent + soul.components + merged config
    const options: AgentFactoryOptions = {
      agent: soul.agent,
      components: soul.components,
      api: mergedApi,
      workspace: overrides?.workspace,
      observers: overrides?.observers,
      ...(this.config.runtimeControl
        ? { runtimeControl: this.config.runtimeControl }
        : {}),
    };

    const parentInstanceId = (
      overrides as unknown as { parentInstanceId?: string }
    )?.parentInstanceId;

    // Create agent container using AgentFactory
    const container = AgentFactory.create(options, this.messageBus);
    const instanceId = container.instanceId;

    // Wait for agent initialization
    const agent = await container.getAgent();

    // Always inject RuntimeControlClient (no permission checks)
    const controlClient = this.createControlClient(instanceId);
    agent.setRuntimeClient(controlClient);

    // Create and inject A2A Client using global AgentCardRegistry
    const a2aClient = createA2AClient(
      this.messageBus,
      getGlobalAgentRegistry(),
      {
        instanceId,
        defaultTimeout: 60000,
      },
    );
    agent.setA2AClient(a2aClient);

    // A2A Handler is now initialized via DI in Agent constructor

    // Store container
    this.containers.set(instanceId, container);

    // Register in registry
    const unifiedConfig = container.getConfig();
    const agentName =
      unifiedConfig.agent.name || unifiedConfig.agent.type || 'agent';
    const alias = generateAgentAlias(agentName);
    const metadata: AgentMetadata = {
      instanceId,
      alias,
      status: AgentStatus.Idle,
      name: unifiedConfig.agent.name,
      agentType: unifiedConfig.agent.type,
      description: unifiedConfig.agent.description,
      config: unifiedConfig as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentInstanceId,
      version: unifiedConfig.agent.version,
      capabilities: unifiedConfig.agent.capabilities,
      skills: unifiedConfig.agent.skills,
      endpoint: unifiedConfig.agent.endpoint ?? instanceId,
      metadata: unifiedConfig.agent.metadata,
    };
    this.registry.register(metadata);

    // Register in AgentCardRegistry for A2A communication
    const agentCard: AgentCard = {
      instanceId,
      alias,
      name: unifiedConfig.agent.name || agentName,
      description: unifiedConfig.agent.description || '',
      version: unifiedConfig.agent.version || '1.0.0',
      capabilities: unifiedConfig.agent.capabilities || [],
      skills: unifiedConfig.agent.skills || [],
      endpoint: unifiedConfig.agent.endpoint || instanceId,
      metadata: unifiedConfig.agent.metadata,
    };
    getGlobalAgentRegistry().register(agentCard);

    // Update parent's child list if parent specified
    if (parentInstanceId) {
      this.registry.addChildRelation(parentInstanceId, instanceId);
      const parentMetadata = this.registry.get(parentInstanceId);
      if (parentMetadata) {
        const createdBy = {
          instanceId: parentInstanceId,
          name: parentMetadata.name,
          createdAt: new Date(),
        };
        this.registry.update(instanceId, { createdBy });
      }
    }

    // Emit event
    this.eventDispatcher.emitEvent('agent:created', {
      instanceId,
      metadata,
      parentInstanceId,
    });

    // Auto-register in topology network as 'worker' by default
    this.topologyGraph.addNode({
      instanceId,
      nodeType: 'worker',
      capabilities: unifiedConfig.agent.capabilities ?? [],
    });

    // Auto-create parent-child edge if this agent has a parent
    if (parentInstanceId) {
      this.connectAgents(parentInstanceId, instanceId, 'parent-child');
    }

    // Subscribe to Redis channel if using RedisMessageBus
    // This is required for the agent to receive messages from other processes
    if (isRedisMessageBus(this.messageBus)) {
      console.log(
        `[AgentRuntime.createAgent] Subscribing to Redis channel for agent: ${instanceId}`,
      );
      this.messageBus.subscribeAgent(instanceId);
    }

    return instanceId;
  }

  /**
   * Start an idle agent, transitioning it to running state.
   *
   * This method validates that the agent exists and is in 'idle' status
   * before transitioning it to 'running'.
   *
   * @param instanceId The agent's unique instance identifier
   * @throws Error if agent not found or not in idle state
   */
  async startAgent(instanceId: string): Promise<void> {
    const container = this.containers.get(instanceId);
    if (!container) {
      throw new Error(`Agent not found: ${instanceId}`);
    }

    const agent = await container.getAgent();
    const currentStatus = agent.status;

    if (currentStatus !== AgentStatus.Idle) {
      throw new Error(`Agent is not idle: ${currentStatus}`);
    }

    await agent.start();

    // Update registry
    this.registry.update(instanceId, { status: AgentStatus.Running });

    // Emit event
    this.eventDispatcher.emitEvent('agent:started', { instanceId });
  }

  /**
   * Stop a running agent.
   *
   * The agent transitions back to 'idle' state and can be restarted.
   *
   * @param instanceId The agent's unique instance identifier
   * @throws Error if agent not found
   */
  async stopAgent(instanceId: string): Promise<void> {
    const container = this.containers.get(instanceId);
    if (!container) {
      throw new Error(`Agent not found: ${instanceId}`);
    }

    const agent = await container.getAgent();

    // Abort running agent if any
    if (agent.status === AgentStatus.Running) {
      agent.abort('Runtime stop', 'manual');
    }

    // Update registry
    this.registry.update(instanceId, { status: AgentStatus.Idle });

    // Emit event
    this.eventDispatcher.emitEvent('agent:stopped', { instanceId });
  }

  /**
   * Destroy an agent, removing it from the runtime completely.
   *
   * This method:
   * 1. Stops the agent if running
   * 2. Removes the container from the pool
   * 3. Unregisters from the registry
   * 4. Emits agent:destroyed event
   *
   * After destruction, the instance ID is no longer valid.
   *
   * @param instanceId The agent's unique instance identifier
   * @throws Error if agent not found
   */
  async destroyAgent(instanceId: string): Promise<void> {
    const container = this.containers.get(instanceId);
    if (!container) {
      throw new Error(`Agent not found: ${instanceId}`);
    }

    // Stop agent first
    await this.stopAgent(instanceId);

    // Remove from container pool
    this.containers.delete(instanceId);

    // Unregister from registry
    this.registry.unregister(instanceId);

    // Unregister from AgentCardRegistry for A2A communication
    getGlobalAgentRegistry().unregister(instanceId);

    // Emit event
    this.eventDispatcher.emitEvent('agent:destroyed', { instanceId });
  }

  // ============================================
  // Public: Agent Query Methods
  // ============================================

  /**
   * Get an agent instance by its ID.
   *
   * @param instanceId The agent's unique instance identifier
   * @returns Promise resolving to the Agent or undefined if not found
   */
  async getAgent(instanceId: string): Promise<Agent | undefined> {
    const container = this.containers.get(instanceId);
    if (!container) {
      return undefined;
    }
    return container.getAgent();
  }

  /**
   * Get the DI container for an agent.
   *
   * This provides access to the agent's dependency injection container,
   * which can be used to resolve any registered services.
   *
   * @param instanceId The agent's unique instance identifier
   * @returns The AgentContainer or undefined if not found
   */
  getAgentContainer(instanceId: string): AgentContainer | undefined {
    return this.containers.get(instanceId);
  }

  /**
   * List all agents matching the optional filter criteria.
   *
   * Filters are combined with AND logic - only agents matching
   * all provided criteria are returned.
   *
   * @param filter Optional filter criteria (status, agentType, name)
   * @returns Promise resolving to array of agent metadata
   */
  async listAgents(filter?: AgentFilter): Promise<AgentMetadata[]> {
    let agents = this.registry.getAll();

    if (filter) {
      if (filter.status) {
        agents = agents.filter((a) => a.status === filter.status);
      }
      if (filter.agentType) {
        agents = agents.filter((a) => a.agentType === filter.agentType);
      }
      if (filter.name) {
        agents = agents.filter((a) => a.name?.includes(filter.name!));
      }
    }

    return agents;
  }

  /**
   * Synchronous version of listAgents for internal use.
   */
  listAgentsSync(filter?: AgentFilter): AgentMetadata[] {
    let agents = this.registry.getAll();

    if (filter) {
      if (filter.status) {
        agents = agents.filter(
          (a: AgentMetadata) => a.status === filter.status,
        );
      }
      if (filter.agentType) {
        agents = agents.filter(
          (a: AgentMetadata) => a.agentType === filter.agentType,
        );
      }
      if (filter.name) {
        agents = agents.filter((a: AgentMetadata) =>
          a.name?.includes(filter.name!),
        );
      }
    }

    return agents;
  }

  /**
   * Get agent metadata by instance ID.
   *
   * @param instanceId The agent's unique instance identifier
   * @returns Agent metadata or undefined if not found
   */
  getAgentMetadata(instanceId: string): AgentMetadata | undefined {
    return this.registry.get(instanceId);
  }

  /**
   * Resolve agent ID, alias, or name to instance ID.
   *
   * Tries to find agent by:
   * 1. Exact instanceId match
   * 2. Exact alias match
   * 3. Partial name match
   *
   * @param idOrAliasOrName Instance ID, alias, or name to resolve
   * @returns Resolved instance ID
   * @throws Error if agent not found
   */
  resolveAgentId(idOrAliasOrName: string): string {
    // 1. Try exact instanceId match
    if (this.registry.has(idOrAliasOrName)) {
      return idOrAliasOrName;
    }

    // 2. Try exact alias match
    const allAgents = this.registry.getAll();
    const byAlias = allAgents.find((a) => a.alias === idOrAliasOrName);
    if (byAlias) {
      return byAlias.instanceId;
    }

    // 3. Try partial name match
    const byName = allAgents.find(
      (a) => a.name && a.name.includes(idOrAliasOrName),
    );
    if (byName) {
      return byName.instanceId;
    }

    throw new Error(`Agent not found: ${idOrAliasOrName}`);
  }

  /**
   * List child agents of a parent agent.
   *
   * @param parentInstanceId Parent agent's instance ID
   * @returns Promise resolving to array of child agent metadata
   */
  async listChildAgents(parentInstanceId: string): Promise<AgentMetadata[]> {
    return this.registry.getChildren(parentInstanceId);
  }

  /**
   * Get a RuntimeControlClient for a specific agent.
   *
   * @param instanceId The agent's instance ID
   * @returns IRuntimeControlClient instance
   */
  getRuntimeClient(instanceId: string): IRuntimeControlClient {
    return this.createControlClient(instanceId);
  }

  // ============================================
  // Public: Event System
  // ============================================

  /**
   * Subscribe to runtime events.
   *
   * Available event types:
   * - `agent:created` - New agent created
   * - `agent:started` - Agent started
   * - `agent:stopped` - Agent stopped
   * - `agent:destroyed` - Agent destroyed
   * - `agent:idle` - Agent became idle
   *
   * @param eventType The type of event to subscribe to
   * @param handler Callback function for the event
   * @returns Unsubscribe function - call to remove the subscription
   *
   * @example
   * const unsub = runtime.on('agent:created', (event) => {
   *   console.log('Agent created:', event.payload.instanceId);
   *   unsub(); // Unsubscribe after first event
   * });
   */
  on(
    eventType: RuntimeEventType,
    handler: (event: RuntimeEvent) => void,
  ): () => void {
    return this.eventDispatcher.subscribe(eventType, handler);
  }

  // ============================================
  // Public: Runtime Control
  // ============================================

  /**
   * Start the runtime.
   *
   * Enables event processing. Must be called after creating agents.
   *
   * - Emits agent:started event with runtime info
   *
   * Idempotent - safe to call multiple times.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Emit start event
    this.eventDispatcher.emitEvent('agent:started', {
      instanceId: 'runtime',
      runtimeStarted: true,
      agentCount: this.containers.size,
    });
  }

  /**
   * Stop the runtime.
   *
   * Halts all event processing and stops all agents gracefully.
   * All internal event subscriptions are cleaned up.
   *
   * Idempotent - safe to call multiple times.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Unsubscribe all event listeners
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];

    // Stop all agents
    for (const instanceId of this.containers.keys()) {
      await this.stopAgent(instanceId);
    }
  }

  /**
   * Get current runtime statistics.
   *
   * Returns a snapshot of:
   * - Total agent count
   * - Agent counts by status (idle, running, completed, aborted)
   *
   * @returns Promise resolving to runtime statistics
   */
  async getStats(): Promise<RuntimeStats> {
    const allAgents = this.registry.getAll();
    const agentsByStatus: Record<AgentStatus, number> = {
      [AgentStatus.Idle]: 0,
      [AgentStatus.Running]: 0,
      [AgentStatus.Completed]: 0,
      [AgentStatus.Aborted]: 0,
    };

    for (const agent of allAgents) {
      agentsByStatus[agent.status]++;
    }

    return {
      totalAgents: allAgents.length,
      agentsByStatus,
    };
  }

  // ============================================
  // Task Integration Implementation
  // ============================================

  /**
   * Set task callbacks for tracking task state changes.
   */
  setTaskCallbacks(callbacks: TaskCallbacks): void {
    this.taskCallbacks = callbacks;
  }

  /**
   * Register a Runtime Task ID for a conversation.
   */
  registerConversationTask(
    conversationId: string,
    runtimeTaskId: string,
    taskId: string,
  ): void {
    this.conversationTaskMap.set(conversationId, {
      runtimeTaskId,
      taskId,
    });
    console.log(
      `[AgentRuntime] Registered task for conversation ${conversationId}: ${runtimeTaskId} (A2A taskId: ${taskId})`,
    );
  }

  /**
   * Get conversation info by A2A task ID.
   */
  getConversationByTaskId(
    taskId: string,
  ): { conversationId: string; runtimeTaskId?: string } | undefined {
    const conversation = this.messageBus.getConversationByTaskId(taskId);
    if (!conversation) return undefined;
    const taskInfo = this.conversationTaskMap.get(conversation.conversationId);
    return {
      conversationId: conversation.conversationId,
      runtimeTaskId: taskInfo?.runtimeTaskId,
    };
  }

  /**
   * Handle task callbacks for conversation events.
   */
  private handleTaskCallback(event: { type: string; payload: unknown }): void {
    const payload = event.payload as {
      conversationId?: string;
      result?: unknown;
      error?: string;
    };

    if (!payload.conversationId) return;

    const taskInfo = this.conversationTaskMap.get(payload.conversationId);
    if (!taskInfo) {
      return;
    }

    switch (event.type) {
      case 'conversation:ack':
        if (this.taskCallbacks.onTaskProcessing) {
          console.log(
            `[AgentRuntime] Task ${taskInfo.runtimeTaskId} processing (ACK received)`,
          );
          this.taskCallbacks.onTaskProcessing(taskInfo);
        }
        break;

      case 'conversation:completed':
        if (this.taskCallbacks.onTaskCompleted) {
          console.log(
            `[AgentRuntime] Task ${taskInfo.runtimeTaskId} completed`,
          );
          this.taskCallbacks.onTaskCompleted(taskInfo, payload.result);
        }
        break;

      case 'conversation:failed':
        if (this.taskCallbacks.onTaskFailed) {
          console.log(
            `[AgentRuntime] Task ${taskInfo.runtimeTaskId} failed: ${payload.error}`,
          );
          this.taskCallbacks.onTaskFailed(
            taskInfo,
            payload.error || 'Unknown error',
          );
        }
        break;
    }
  }

  // ============================================
  // Topology Network Implementation
  // ============================================

  registerInTopology(
    instanceId: string,
    nodeType: 'router' | 'worker' | 'hybrid',
    capabilities?: string[],
  ): void {
    const node = this.topologyGraph.getNode(instanceId);
    if (node) {
      this.topologyGraph.removeNode(instanceId);
    }
    this.topologyGraph.addNode({
      instanceId,
      nodeType,
      capabilities,
    });
  }

  unregisterFromTopology(instanceId: string): void {
    this.topologyGraph.removeNode(instanceId);
  }

  connectAgents(
    from: string,
    to: string,
    edgeType: 'parent-child' | 'peer' | 'route' = 'peer',
  ): void {
    this.topologyGraph.addEdge({
      from,
      to,
      edgeType,
      bidirectional: edgeType === 'peer',
    });
  }

  disconnectAgents(from: string, to: string): void {
    this.topologyGraph.removeEdge(from, to);
  }

  async sendToAgent(
    to: string,
    content: unknown,
    messageType: 'request' | 'event' | 'ack' | 'result' | 'error' = 'event',
  ): Promise<TopologyMessage> {
    const message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      conversationId: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      from: 'runtime',
      to,
      content,
      messageType,
      ttl: 10,
      timestamp: Date.now(),
    };
    this.messageBus.publish(message);
    return message;
  }

  async broadcastToChildren(
    from: string,
    content: unknown,
  ): Promise<TopologyMessage[]> {
    const children = this.topologyGraph.getChildren(from);
    const results: TopologyMessage[] = [];
    for (const child of children) {
      const msg = await this.sendToAgent(child.instanceId, content, 'event');
      results.push(msg);
    }
    return results;
  }

  subscribeToAgent(
    instanceId: string,
    handler: (message: TopologyMessage) => void,
  ): () => void {
    return this.messageBus.onMessage((message) => {
      if (message.to === instanceId) {
        handler(message);
      }
    });
  }

  async requestFromAgent(
    to: string,
    content: unknown,
    from: string = 'external',
  ): Promise<{
    ack: TopologyMessage;
    result: Promise<TopologyMessage>;
  }> {
    const message = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      conversationId: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      from,
      to,
      content,
      messageType: 'request' as const,
      ttl: 10,
      timestamp: Date.now(),
    };

    const ack = await this.messageBus.send(message);

    const resultPromise = new Promise<TopologyMessage>((resolve, reject) => {
      const checkResult = () => {
        const conversation = this.messageBus.getConversation(
          message.conversationId,
        );
        if (conversation?.status === 'completed' && conversation.result) {
          resolve(conversation.result);
        } else if (
          conversation?.status === 'failed' ||
          conversation?.status === 'timeout'
        ) {
          reject(
            new Error(
              `Conversation ${message.conversationId} ${conversation.status}`,
            ),
          );
        } else {
          setTimeout(checkResult, 100);
        }
      };
      setTimeout(checkResult, 100);
    });

    return { ack, result: resultPromise };
  }

  getTopologyGraph(): ITopologyGraph {
    return this.topologyGraph;
  }

  getTopologyStats(): RoutingStats {
    return {
      totalMessages: 0,
      totalConversations: 0,
      activeConversations: 0,
      completedConversations: 0,
      failedConversations: 0,
      timedOutConversations: 0,
    };
  }

  // ============================================
  // User Context (User as Agent)
  // ============================================

  getMessageBus(): IMessageBus {
    return this.messageBus;
  }

  getRegistry(): IAgentCardRegistry {
    // Return the global AgentCardRegistry for A2A service discovery
    // This is different from this.registry (AgentRegistry) which tracks metadata
    return getGlobalAgentRegistry();
  }

  createUserContext(options?: {
    userId?: string;
    defaultTimeout?: number;
  }): IUserContext {
    return createUserContext(this, options);
  }

  private handleTopologyMessage(message: TopologyMessage): void {
    // Handle topology messages routed through the system
    // This is called by the message bus when messages are delivered
  }

  // ============================================
  // RuntimeControlClient Factory (Internal)
  // ============================================

  /**
   * Create a RuntimeControlClient for a specific Agent
   *
   * @param callerInstanceId The Agent's instanceId that will receive the client
   * @returns IRuntimeControlClient instance
   */
  createControlClient(callerInstanceId: string): IRuntimeControlClient {
    return new RuntimeControlClientImpl(this, callerInstanceId);
  }

  // ============================================
  // Internal Methods (For RuntimeControlClient)
  // ============================================

  /**
   * Create a child Agent with parent tracking (internal API)
   *
   * Used by RuntimeControlClient to create child Agents.
   *
   * @param parentInstanceId The parent's instanceId
   * @param options Agent creation options
   * @param parentPermissions Parent's permissions (used to derive child permissions)
   * @returns New agent's instanceId
   */
  async _createChildAgent(
    parentInstanceId: string,
    options: RuntimeControlAgentOptions,
  ): Promise<string> {
    console.log(
      `[AgentRuntime._createChildAgent] Creating child agent for parent: ${parentInstanceId}`,
    );
    console.log(
      `[AgentRuntime._createChildAgent] Options: ${JSON.stringify(options.agent)}`,
    );

    if (this.containers.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Maximum agent limit reached: ${this.config.maxAgents}`);
    }

    // Merge API config: runtime default + options.api
    // This ensures child agents use the runtime's default API config if not specified
    const mergedApi = {
      ...this.defaultApiConfig,
      ...options?.api,
    };

    // Create the agent with parent info and merged API config
    const container = AgentFactory.create(
      {
        ...options,
        api: mergedApi,
        ...(this.config.runtimeControl
          ? { runtimeControl: this.config.runtimeControl }
          : {}),
      } as AgentFactoryOptions,
      this.messageBus,
    );

    const instanceId = container.instanceId;
    console.log(
      `[AgentRuntime._createChildAgent] Created container with instanceId: ${instanceId}`,
    );

    // Get agent and inject dependencies
    const agent = await container.getAgent();

    // Create and inject RuntimeControlClient for the child
    const controlClient = this.createControlClient(instanceId);
    agent.setRuntimeClient(controlClient);

    // Create and inject A2A Client using global AgentCardRegistry
    const a2aClient = createA2AClient(
      this.messageBus,
      getGlobalAgentRegistry(),
      {
        instanceId,
        defaultTimeout: 60000,
      },
    );
    agent.setA2AClient(a2aClient);

    // A2A Handler is now initialized via DI in Agent constructor

    // Store container
    this.containers.set(instanceId, container);

    // Get parent metadata for createdBy info
    const parentMetadata = this.registry.get(parentInstanceId);

    // Register metadata with hierarchy info
    const unifiedConfig = container.getConfig();
    const agentName =
      unifiedConfig.agent.name || unifiedConfig.agent.type || 'agent';
    const alias = generateAgentAlias(agentName);
    const metadata: AgentMetadata = {
      instanceId,
      alias,
      status: AgentStatus.Idle,
      name: unifiedConfig.agent.name,
      agentType: unifiedConfig.agent.type,
      description: unifiedConfig.agent.description,
      config: unifiedConfig as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentInstanceId,
      createdBy: {
        instanceId: parentInstanceId,
        name: parentMetadata?.name,
        createdAt: new Date(),
      },
      version: unifiedConfig.agent.version,
      capabilities: unifiedConfig.agent.capabilities,
      skills: unifiedConfig.agent.skills,
      endpoint: unifiedConfig.agent.endpoint ?? instanceId,
      metadata: unifiedConfig.agent.metadata,
    };
    this.registry.register(metadata);
    console.log(
      `[AgentRuntime._createChildAgent] Registered in AgentRegistry: ${instanceId}, alias: ${alias}`,
    );

    // Register in AgentCardRegistry for A2A communication
    // This is critical - without this, sendTask cannot find the agent
    const agentCard: AgentCard = {
      instanceId,
      name: unifiedConfig.agent.name || agentName,
      description: unifiedConfig.agent.description || '',
      version: unifiedConfig.agent.version || '1.0.0',
      capabilities: unifiedConfig.agent.capabilities || [],
      skills: unifiedConfig.agent.skills || [],
      endpoint: unifiedConfig.agent.endpoint || instanceId,
      metadata: unifiedConfig.agent.metadata,
      alias, // Include alias for resolution
    };
    getGlobalAgentRegistry().register(agentCard);
    console.log(
      `[AgentRuntime._createChildAgent] Registered in AgentCardRegistry: ${instanceId}, alias: ${alias}`,
    );
    console.log(
      `[AgentRuntime._createChildAgent] AgentCardRegistry size: ${getGlobalAgentRegistry().size}`,
    );

    // Update parent's child list
    this.registry.addChildRelation(parentInstanceId, instanceId);

    // Auto-register in topology
    this.topologyGraph.addNode({
      instanceId,
      nodeType: 'worker',
      capabilities: unifiedConfig.agent.capabilities ?? [],
    });

    // Auto-create parent-child edge
    this.connectAgents(parentInstanceId, instanceId, 'parent-child');

    // Subscribe to Redis channel if using RedisMessageBus
    // This is required for the agent to receive messages from other processes
    if (isRedisMessageBus(this.messageBus)) {
      console.log(
        `[AgentRuntime._createChildAgent] Subscribing to Redis channel for agent: ${instanceId}`,
      );
      this.messageBus.subscribeAgent(instanceId);
    }

    // Emit event
    this.eventDispatcher.emitEvent('agent:created', {
      instanceId,
      metadata,
      parentInstanceId,
    });

    console.log(
      `[AgentRuntime._createChildAgent] Child agent creation complete: ${instanceId}`,
    );
    return instanceId;
  }

  /**
   * Destroy an Agent with cascade option (internal API)
   *
   * @param instanceId Agent to destroy
   * @param cascade If true, also destroys all descendants
   */
  async _destroyAgentWithCascade(
    instanceId: string,
    cascade: boolean = true,
  ): Promise<void> {
    const container = this.containers.get(instanceId);
    if (!container) {
      throw new Error(`Agent not found: ${instanceId}`);
    }

    // If cascade, destroy all descendants first
    if (cascade) {
      const children = this.registry.getChildren(instanceId);
      for (const child of children) {
        await this._destroyAgentWithCascade(child.instanceId, true);
      }
    }

    // Stop the agent
    await this.stopAgent(instanceId);

    // Remove from parent's child list
    const metadata = this.registry.get(instanceId);
    if (metadata?.parentInstanceId) {
      this.registry.removeChildRelation(metadata.parentInstanceId, instanceId);
    }

    // Remove container
    this.containers.delete(instanceId);

    // Unregister from AgentRegistry
    this.registry.unregister(instanceId);

    // Unregister from AgentCardRegistry for A2A communication
    getGlobalAgentRegistry().unregister(instanceId);

    // Unsubscribe from Redis channel if using RedisMessageBus
    if (isRedisMessageBus(this.messageBus)) {
      console.log(
        `[AgentRuntime._destroyAgentWithCascade] Unsubscribing from Redis channel for agent: ${instanceId}`,
      );
      this.messageBus.unsubscribeAgent(instanceId);
    }

    // Emit event
    this.eventDispatcher.emitEvent('agent:destroyed', { instanceId });
  }

  /**
   * Check if one agent is a descendant of another (internal API)
   */
  _isDescendantOf(ancestorId: string, descendantId: string): boolean {
    return this.registry.isAncestorOf(ancestorId, descendantId);
  }

  /**
   * Get children of an agent (internal API)
   */
  _getChildren(parentInstanceId: string): AgentMetadata[] {
    return this.registry.getChildren(parentInstanceId);
  }
}

/**
 * Factory function to create an AgentRuntime instance.
 *
 * This is the recommended way to create a new runtime, as it returns
 * the IAgentRuntime interface type for better abstraction.
 *
 * @param config Optional runtime configuration
 * @param config.maxAgents Maximum number of agents allowed (default: 10)
 * @returns A new AgentRuntime instance typed as IAgentRuntime
 *
 * @example
 * const runtime = createAgentRuntime({ maxAgents: 5 });
 * await runtime.start();
 *
 * const agentId = await runtime.createAgent({
 *   config: { agent: { name: 'worker', type: 'worker' } }
 * });
 */
export function createAgentRuntime(config?: AgentRuntimeConfig): IAgentRuntime {
  return new AgentRuntime(config);
}
