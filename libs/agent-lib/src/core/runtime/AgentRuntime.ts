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
 *    - agent:sleeping - agent became sleeping and is ready for work
 *
 * @module AgentRuntime
 */

import type { Agent } from '../agent/agent.js';
import { AgentContainer } from '../di/container.js';
import type { AgentCreationOptions, UnifiedAgentConfig } from '../di/container.js';
import { TYPES } from '../di/types.js';
import type { HookModule } from '../hooks/HookModule.js';
import type { ApiClient } from 'llm-api-client';
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

// Event Stream
import {
  AgentEventStream,
  type IAgentEventStream,
} from '../events/AgentEventStream.js';
import type { AgentEvent } from '../events/types.js';

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
 * const runtime = createAgentRuntime({}); * // Start the runtime
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

  /**
   * Inject a message into an agent's conversation memory.
   * If the agent is sleeping, it will be woken up.
   * @param instanceId The agent's instance ID
   * @param message The message text to inject
   */
  injectMessage(instanceId: string, message: string): Promise<void>;

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

  /**
   * Get the event stream for real-time agent event push.
   * Subscribe to granular events like messages, tool calls, and status changes.
   */
  getEventStream(): IAgentEventStream;

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

  /** ApiClient for LLM API calls (passed to agents via DI) */
  private apiClient: ApiClient | undefined;

  /** Persistence service for agent state persistence */
  private persistenceService: import('../persistence/types.js').IPersistenceService;

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
  // Event Subscription Cleanup
  // ============================================

  /**
   * Array of unsubscribe functions for internal event listeners.
   * Used for cleanup during runtime.stop().
   */
  private eventUnsubscribers: (() => void)[] = [];

  // ============================================
  // Event Stream
  // ============================================

  /** Unified event stream for real-time agent event push */
  private eventStream: AgentEventStream;

  // ============================================
  // Constructor
  // ============================================

  /**
   * Create a new AgentRuntime instance.
   *
   * @param config Runtime configuration options
   *
   * @example
   * const runtime = new AgentRuntime({ apiClient, persistenceService });
   */
  constructor(config: AgentRuntimeConfig) {
    this.config = {
      ...config,
    };

    this.apiClient = config.apiClient;
    this.persistenceService = config.persistenceService!;

    // Initialize core components that don't require DI container
    // These are shared across all agents managed by this runtime
    this.registry = new AgentRegistry();
    this.eventDispatcher = new EventDispatcher();
    this.eventStream = new AgentEventStream();
  }

  // ============================================
  // Private: Event Setup
  // ============================================

  /**
   * Setup internal event listeners.
   */
  private setupEventListeners(): void {
    // Agent events are routed through runtime event dispatcher
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
    if (!this.persistenceService) {
      throw new Error('AgentRuntime.persistenceService is required to create agents');
    }
    if (!this.apiClient) {
      throw new Error('AgentRuntime.apiClient is required to create agents');
    }

    const options: AgentFactoryOptions = {
      agent: soul.agent,
      components: soul.components,
      workspace: overrides?.workspace,
      observers: overrides?.observers,
      apiClient: this.apiClient,
      persistenceService: this.persistenceService,
    };

    const parentInstanceId = (
      overrides as unknown as { parentInstanceId?: string }
    )?.parentInstanceId;

    // Create agent container using AgentFactory
    const container = AgentFactory.create(options);
    const instanceId = container.instanceId;

    // Wait for agent initialization
    const agent = await container.getAgent();

    // Store container
    this.containers.set(instanceId, container);

    // Wire event stream into agent's HookModule
    const hookModule = container.getContainer().get<HookModule>(TYPES.HookModule);
    if (hookModule) {
      this.eventStream.wireAgent(hookModule, instanceId);
    }

    // Register in registry
    const unifiedConfig = container.getConfig();
    const agentName =
      unifiedConfig.agent.name || unifiedConfig.agent.type || 'agent';
    const alias = generateAgentAlias(agentName);
    const metadata: AgentMetadata = {
      instanceId,
      alias,
      status: AgentStatus.Sleeping,
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

    if (currentStatus !== AgentStatus.Sleeping) {
      throw new Error(`Agent is not sleeping: ${currentStatus}`);
    }

    // Update registry BEFORE starting - this ensures correct status during agent execution
    this.registry.update(instanceId, { status: AgentStatus.Running });

    // Emit event
    this.eventDispatcher.emitEvent('agent:started', { instanceId });

    // Start agent - this blocks until agent completes
    // Registry status will be updated to actual final status by complete()/abort()
    await agent.start();
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

    // Abort running agent
    if (agent.status === AgentStatus.Running) {
      agent.abort('Runtime stop', 'manual');
    }

    // Reset agent internal status to Sleeping so it can be restarted
    // Note: abort() sets _status to Aborted, but stop should allow restart
    agent.resetToSleeping();

    // Update registry
    this.registry.update(instanceId, { status: AgentStatus.Sleeping });

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

    // Emit event
    this.eventDispatcher.emitEvent('agent:destroyed', { instanceId });
  }

  /**
   * Put an agent to sleep — saves state and unloads the container.
   * The agent remains registered in the registry and can be restored later.
   *
   * @param instanceId The agent's unique instance identifier
   * @param reason Optional reason for sleeping
   */
  async sleepAgent(
    instanceId: string,
    reason: string = 'Manual sleep',
  ): Promise<void> {
    const container = this.containers.get(instanceId);
    if (!container) {
      throw new Error(`Agent not found: ${instanceId}`);
    }

    const agent = await container.getAgent();

    // Save state and transition to Sleeping
    await agent.sleep(reason);

    // Unwire event stream
    const hookModule = container
      .getContainer()
      .get<HookModule>(TYPES.HookModule);
    if (hookModule) {
      this.eventStream.unwireAgent(hookModule, instanceId);
    }

    // Unload the container (releases all DI resources)
    container.unload();

    // Update registry status
    this.registry.update(instanceId, { status: AgentStatus.Sleeping });

    // Emit event
    this.eventDispatcher.emitEvent('agent:sleeping', { instanceId, reason });
  }

  /**
   * Restore a sleeping agent — rebuilds the container from DB state.
   *
   * @param instanceId The agent's unique instance identifier
   * @returns The restored Agent instance
   */
  async restoreAgent(instanceId: string): Promise<Agent> {
    const existingContainer = this.containers.get(instanceId);

    // If container exists and has an agent, it's already running
    if (existingContainer?.agent) {
      const agent = await existingContainer.getAgent();
      if (agent.status === AgentStatus.Running) {
        return agent;
      }
    }

    // Get stored config for the agent
    const metadata = this.registry.get(instanceId);
    if (!metadata) {
      throw new Error(`Agent not found in registry: ${instanceId}`);
    }

    // Build options from stored config
    const storedConfig = metadata.config as Partial<UnifiedAgentConfig> | undefined;
    const options: AgentCreationOptions = {
      agent: {
        ...(storedConfig?.agent || {}),
        name: metadata.name,
        type: metadata.agentType,
      },
      workspace: storedConfig?.workspace,
      memory: storedConfig?.memory,
      persistence: storedConfig?.persistence,
      components: storedConfig?.components,
      hooks: storedConfig?.hooks,
      apiClient: this.apiClient,
      persistenceService: this.persistenceService,
    };

    // Create new container via restore (loads config from DB)
    const container = await AgentContainer.restore(
      instanceId,
      options,
    );

    // Store the new container
    this.containers.set(instanceId, container);

    // Get the restored agent
    const agent = await container.getAgent();

    // Re-wire event stream
    const hookModule = container
      .getContainer()
      .get<HookModule>(TYPES.HookModule);
    if (hookModule) {
      this.eventStream.wireAgent(hookModule, instanceId);
    }

    // Update registry status
    this.registry.update(instanceId, { status: AgentStatus.Running });

    console.log(`[AgentRuntime] Agent restored: ${instanceId}`);

    return agent;
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
    let agents = this.registry.getAll().map((meta) => {
      const container = this.containers.get(meta.instanceId);
      if (container?.agent) {
        return { ...meta, status: container.agent.status };
      }
      return meta;
    });

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

  /**
   * Inject a message into an agent's conversation memory.
   * If the agent is sleeping, it will be woken up.
   *
   * @param instanceId The agent's instance ID
   * @param message The message text to inject
   */
  async injectMessage(instanceId: string, message: string): Promise<void> {
    const agent = await this.getAgent(instanceId);
    if (!agent) {
      throw new Error(`Agent not found: ${instanceId}`);
    }
    await agent.injectMessage(message);
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
   * - `agent:sleeping` - Agent became sleeping
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

  /**
   * Get the event stream for real-time agent event push.
   * Use this to subscribe to granular events (messages, tool calls, status changes).
   */
  getEventStream(): IAgentEventStream {
    return this.eventStream;
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
      [AgentStatus.Sleeping]: 0,
      [AgentStatus.Running]: 0,
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

    // Abort the agent if running
    const agent = container.agent;
    if (agent && (agent.status === AgentStatus.Running)) {
      agent.abort('Cascade destroy', 'manual');
    }

    // Unwire event stream from agent's HookModule
    try {
      const hookModule = container.getContainer().get<HookModule>(TYPES.HookModule);
      if (hookModule) {
        this.eventStream.unwireAgent(hookModule, instanceId);
      }
    } catch {
      // Container may already be partially disposed
    }

    // Unload the container (releases all DI resources)
    container.unload();

    // Remove from parent's child list
    const metadata = this.registry.get(instanceId);
    if (metadata?.parentInstanceId) {
      this.registry.removeChildRelation(metadata.parentInstanceId, instanceId);
    }

    // Remove container
    this.containers.delete(instanceId);

    // Unregister from AgentRegistry
    this.registry.unregister(instanceId);

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
 * @returns A new AgentRuntime instance typed as IAgentRuntime
 *
 * @example
 * const runtime = createAgentRuntime({});
 * await runtime.start();
 *
 * const agentId = await runtime.createAgent({
 *   config: { agent: { name: 'worker', type: 'worker' } }
 * });
 */
export function createAgentRuntime(
  config: AgentRuntimeConfig,
): IAgentRuntime {
  return new AgentRuntime(config);
}
