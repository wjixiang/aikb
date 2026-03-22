/**
 * AgentRuntime - Main class for managing multiple Agent instances
 *
 * This is the central orchestration layer for the agent system. It manages the complete
 * lifecycle of agents and provides a unified interface for task distribution.
 *
 * ## Architecture Overview
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      AgentRuntime                           │
 * ├─────────────────────────────────────────────────────────────┤
 * │  ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
 * │  │  Registry   │  │ EventDispatcher  │  │ TaskQueue     │  │
 * │  │ (metadata)  │  │  (pub/sub)       │  │ (distribution)│  │
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
 * 2. **Task Distribution** (Event-Driven)
 *    - submitTask: Queue tasks for specific agents
 *    - Automatic task assignment when agents become idle
 *    - No polling - pure event-driven architecture
 *
 * 3. **Event System**
 *    - agent:created, agent:started, agent:stopped, agent:destroyed
 *    - task:submitted, task:assigned, task:completed, task:failed
 *    - agent:idle - triggers next task assignment
 *
 * ## Event-Driven Task Assignment Flow
 *
 * ```
 * submitTask() ──► task:submitted ──► tryAssignTaskToAgent()
 *                                            │
 *                         ┌──────────────────┴──────────────────┐
 *                         ▼                                     ▼
 *                    Agent idle?                           Queue task
 *                         │                                     │
 *                         ▼                                     │
 *                  assignTaskToAgent()                         │
 *                         │                                     │
 *                         ▼                                     │
 *                  agent:wakeUpForTask()                       │
 *                         │                                     │
 *                         ▼                                     │
 *                  task:completed/failed                       │
 *                         │                                     │
 *                         ▼                                     │
 *                  agent:idle ◄─────────────────────────────────┘
 *                         │
 *                         ▼
 *                  handleAgentIdle() ──► get next pending task
 * ```
 *
 * @module AgentRuntime
 */

import type { Agent } from '../agent/agent.js';
import type { AgentContainer, AgentCreationOptions } from '../di/container.js';
import {
  AgentFactory,
  type AgentFactoryOptions,
} from '../agent/AgentFactory.js';
import type {
  AgentMetadata,
  AgentRuntimeConfig,
  AgentStatus,
  RuntimeTask,
  TaskSubmission,
  RuntimeEvent,
  RuntimeEventType,
  RuntimeControlPermissions,
  DEFAULT_RUNTIME_PERMISSIONS,
  IRuntimeControlClient,
  RuntimeControlAgentOptions,
  RuntimeStats,
} from './types.js';
import type { IAgentRegistry } from './AgentRegistry.js';
import { AgentRegistry } from './AgentRegistry.js';
import type { IEventDispatcher } from './EventDispatcher.js';
import { EventDispatcher } from './EventDispatcher.js';
import type { ICentralTaskQueue } from './CentralTaskQueue.js';
import { CentralTaskQueue } from './CentralTaskQueue.js';
import { RuntimeControlClientImpl } from './RuntimeControlClient.js';

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
 * // Submit tasks
 * const taskId = await runtime.submitTask({
 *   targetInstanceId: agentId,
 *   description: 'Process document',
 *   input: { documentId: '123' }
 * });
 *
 * // Monitor events
 * const unsubscribe = runtime.on('task:completed', (event) => {
 *   console.log('Task completed:', event.payload);
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
   * @param options Agent factory options including config and container settings
   * @returns Promise resolving to the new agent's instance ID
   */
  createAgent(options: AgentFactoryOptions): Promise<string>;

  /**
   * Start an idle agent, transitioning it to running state.
   * @param instanceId The agent's unique instance identifier
   */
  startAgent(instanceId: string): Promise<void>;

  /**
   * Stop a running agent, aborting any current task.
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

  // ============================================
  // Task Management Methods
  // ============================================

  /**
   * Submit a new task to be processed by a specific agent.
   * @param task Task submission details including target agent and input
   * @returns Promise resolving to the new task's ID
   */
  submitTask(task: TaskSubmission): Promise<string>;

  /**
   * Get the current status of a task.
   * @param taskId The task's unique identifier
   * @returns Promise resolving to the task or undefined if not found
   */
  getTaskStatus(taskId: string): Promise<RuntimeTask | undefined>;

  /**
   * Get all pending tasks, optionally filtered by target agent.
   * @param instanceId Optional agent ID to filter by
   * @returns Promise resolving to array of pending tasks
   */
  getPendingTasks(instanceId?: string): Promise<RuntimeTask[]>;

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
   * Start the runtime, enabling event processing and task assignment.
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
}

/**
 * AgentRuntime - Concrete implementation of IAgentRuntime
 *
 * This class is the main orchestrator for the agent system. It manages:
 *
 * 1. **Agent Containers** - Each agent runs in its own DI container for isolation
 * 2. **Agent Registry** - Tracks metadata and status of all agents
 * 3. **Event Dispatcher** - Pub/sub system for runtime events
 * 4. **Central Task Queue** - Distributes tasks to appropriate agents
 *
 * ## Thread Safety & Concurrency
 *
 * - Task assignment is serialized via `isProcessingAssignments` flag
 * - Event handlers run asynchronously but assignments are queued
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

  /**
   * Central task queue for task distribution.
   * Lazily initialized when first agent is created.
   * Shared across all agents for coordinated task management.
   */
  private taskQueue: ICentralTaskQueue | null = null;

  /** Flag indicating if runtime is actively running */
  private running: boolean = false;

  // ============================================
  // Event-Driven Task Assignment State
  // ============================================

  /**
   * Array of unsubscribe functions for internal event listeners.
   * Used for cleanup during runtime.stop().
   */
  private eventUnsubscribers: (() => void)[] = [];

  /**
   * Queue of pending task assignments waiting to be processed.
   * Tasks are added on 'task:submitted' and processed sequentially.
   */
  private pendingAssignments: Array<{
    taskId: string;
    targetInstanceId: string;
  }> = [];

  /**
   * Flag to prevent concurrent processing of assignment queue.
   * Ensures task assignments are processed sequentially.
   */
  private isProcessingAssignments: boolean = false;

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
   */
  constructor(config: AgentRuntimeConfig = {}) {
    this.config = {
      maxAgents: 10,
      ...config,
    };

    // Initialize core components that don't require DI container
    // These are shared across all agents managed by this runtime
    this.registry = new AgentRegistry();
    this.eventDispatcher = new EventDispatcher();

    // Setup internal event listeners for event-driven task assignment
    // This creates the reactive pipeline for automatic task distribution
    this.setupEventListeners();
  }

  // ============================================
  // Private: Event-Driven Task Assignment
  // ============================================

  /**
   * Setup internal event listeners for event-driven task assignment.
   *
   * This method establishes the reactive pipeline that automatically
   * assigns tasks to agents without polling:
   *
   * 1. `task:submitted` → Queue assignment for processing
   * 2. `agent:idle` → Check for pending tasks and assign
   *
   * The event-driven approach ensures:
   * - Immediate task assignment when possible
   * - No wasted CPU cycles on polling
   * - Responsive to agent state changes
   */
  private setupEventListeners(): void {
    // Listen for task:submitted -> try immediate assignment
    // When a task is submitted, we queue it for assignment processing
    const unsub1 = this.eventDispatcher.subscribe('task:submitted', (event) => {
      const payload = event.payload as {
        taskId: string;
        targetInstanceId: string;
      };
      this.pendingAssignments.push(payload);
      void this.processAssignmentQueue();
    });
    this.eventUnsubscribers.push(unsub1);

    // Listen for agent:idle -> check for pending tasks
    // When an agent becomes idle, check if there are tasks waiting for it
    const unsub2 = this.eventDispatcher.subscribe('agent:idle', (event) => {
      const payload = event.payload as { instanceId: string };
      void this.handleAgentIdle(payload.instanceId);
    });
    this.eventUnsubscribers.push(unsub2);
  }

  /**
   * Process queued task assignments sequentially.
   *
   * This method ensures that task assignments are processed one at a time
   * to prevent race conditions. Uses a simple mutex pattern with the
   * `isProcessingAssignments` flag.
   *
   * The loop continues until all pending assignments are processed
   * or the runtime is stopped.
   */
  private async processAssignmentQueue(): Promise<void> {
    // Mutex check - prevent concurrent processing
    if (this.isProcessingAssignments) return;
    this.isProcessingAssignments = true;

    try {
      // Process all queued assignments
      while (this.pendingAssignments.length > 0 && this.running) {
        const assignment = this.pendingAssignments.shift()!;
        await this.tryAssignTaskToAgent(
          assignment.taskId,
          assignment.targetInstanceId,
        );
      }
    } finally {
      // Always release the mutex
      this.isProcessingAssignments = false;
    }
  }

  /**
   * Handle agent:idle event - check for pending tasks for this agent.
   *
   * When an agent completes a task and becomes idle, this handler
   * checks if there are more tasks waiting for that specific agent
   * and assigns the next one if available.
   *
   * @param instanceId The agent that just became idle
   */
  private async handleAgentIdle(instanceId: string): Promise<void> {
    if (!this.taskQueue || !this.running) return;

    // Get tasks specifically queued for this agent
    const pendingTasks = await this.taskQueue.getForAgent(instanceId);
    if (pendingTasks.length > 0) {
      const task = pendingTasks[0];
      await this.assignTaskToAgent(task.taskId, instanceId);
    }
  }

  /**
   * Try to assign a task to its target agent if the agent is idle.
   *
   * This method performs a conditional assignment - it only proceeds
   * if the target agent exists and is currently idle. If the agent
   * is busy, the task remains in the queue for later processing.
   *
   * @param taskId The task to assign
   * @param targetInstanceId The target agent's instance ID
   */
  private async tryAssignTaskToAgent(
    taskId: string,
    targetInstanceId: string,
  ): Promise<void> {
    if (!this.running) return;

    // Only assign if agent exists and is idle
    const metadata = this.registry.get(targetInstanceId);
    if (!metadata || metadata.status !== 'idle') return;

    await this.assignTaskToAgent(taskId, targetInstanceId);
  }

  // ============================================
  // Public: Agent Lifecycle Methods
  // ============================================

  /**
   * Create a new agent instance.
   *
   * This method:
   * 1. Creates a new DI container for the agent via AgentFactory
   * 2. Initializes the central task queue (if first agent)
   * 3. Connects the agent to the task queue
   * 4. Registers the agent in the registry
   * 5. Emits agent:created event
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
  async createAgent(options: AgentFactoryOptions): Promise<string> {
    if (this.containers.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Maximum agent limit reached: ${this.config.maxAgents}`);
    }

    // Extract runtimePermissions if provided (for backward compatibility)
    const runtimePermissions = (
      options as unknown as { runtimePermissions?: RuntimeControlPermissions }
    ).runtimePermissions;
    const parentInstanceId = (
      options as unknown as { parentInstanceId?: string }
    ).parentInstanceId;

    // Create agent container using AgentFactory
    const container = AgentFactory.create(options);
    const instanceId = container.instanceId;

    // Initialize task queue with first agent's container
    if (!this.taskQueue) {
      this.taskQueue = new CentralTaskQueue(container.getContainer());
    }

    // Wait for agent initialization
    const agent = await container.getAgent();

    // Pass central task queue to agent's task module
    agent.setCentralTaskQueue(this.taskQueue);

    // If runtimePermissions provided, inject RuntimeControlClient
    if (runtimePermissions) {
      const controlClient = this.createControlClient(
        instanceId,
        runtimePermissions,
      );
      agent.setRuntimeClient(controlClient);
      agent.setRuntimePermissions(runtimePermissions);
    }

    // Store container
    this.containers.set(instanceId, container);

    // Register in registry
    const unifiedConfig = container.getConfig();
    const metadata: AgentMetadata = {
      instanceId,
      status: 'idle',
      name: unifiedConfig.agent.name,
      agentType: unifiedConfig.agent.type,
      description: unifiedConfig.agent.description,
      config: unifiedConfig as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      runtimePermissions,
      parentInstanceId,
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
   * before transitioning it to 'running'. The agent can then accept tasks.
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

    if (currentStatus !== 'idle') {
      throw new Error(`Agent is not idle: ${currentStatus}`);
    }

    // Update registry
    this.registry.update(instanceId, { status: 'running' });

    // Emit event
    this.eventDispatcher.emitEvent('agent:started', { instanceId });
  }

  /**
   * Stop a running agent.
   *
   * If the agent is currently running a task, it will be aborted.
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

    // Abort current task if any
    if (agent.status === 'running') {
      agent.abort('Runtime stop', 'manual');
    }

    // Update registry
    this.registry.update(instanceId, { status: 'idle' });

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

  // ============================================
  // Public: Task Management Methods
  // ============================================

  /**
   * Submit a new task to be processed by a specific agent.
   *
   * The task is queued in the central task queue and will be
   * assigned to the target agent when it becomes idle.
   *
   * @param task Task submission details
   * @param task.targetInstanceId ID of the agent to process this task
   * @param task.description Human-readable task description
   * @param task.input Task input data (any JSON-serializable object)
   * @returns Promise resolving to the new task's ID
   * @throws Error if runtime not initialized or target agent not found
   */
  async submitTask(task: TaskSubmission): Promise<string> {
    if (!this.taskQueue) {
      throw new Error('Runtime not initialized. Create an agent first.');
    }

    // Validate target agent exists
    if (!this.registry.has(task.targetInstanceId)) {
      throw new Error(`Target agent not found: ${task.targetInstanceId}`);
    }

    // Submit to task queue
    const taskId = await this.taskQueue.submit(task);

    // Emit event
    this.eventDispatcher.emitEvent('task:submitted', {
      taskId,
      targetInstanceId: task.targetInstanceId,
      description: task.description,
    });

    return taskId;
  }

  /**
   * Get the current status of a task.
   *
   * @param taskId The task's unique identifier
   * @returns Promise resolving to the task or undefined if not found
   */
  async getTaskStatus(taskId: string): Promise<RuntimeTask | undefined> {
    if (!this.taskQueue) {
      return undefined;
    }
    return this.taskQueue.getById(taskId);
  }

  /**
   * Get all pending tasks, optionally filtered by target agent.
   *
   * @param instanceId Optional agent ID to filter by
   * @returns Promise resolving to array of pending tasks
   */
  async getPendingTasks(instanceId?: string): Promise<RuntimeTask[]> {
    if (!this.taskQueue) {
      return [];
    }
    if (instanceId) {
      return this.taskQueue.getForAgent(instanceId);
    }
    return this.taskQueue.getPending();
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
   * - `task:submitted` - Task submitted to queue
   * - `task:assigned` - Task assigned to agent
   * - `task:completed` - Task completed successfully
   * - `task:failed` - Task failed with error
   *
   * @param eventType The type of event to subscribe to
   * @param handler Callback function for the event
   * @returns Unsubscribe function - call to remove the subscription
   *
   * @example
   * const unsub = runtime.on('task:completed', (event) => {
   *   console.log('Task done:', event.payload.taskId);
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
   * Enables event processing and task assignment. Must be called
   * after creating agents and before submitting tasks for the
   * event-driven task assignment to work.
   *
   * - Wires the event dispatcher to the task queue
   * - Emits agent:started event with runtime info
   *
   * Idempotent - safe to call multiple times.
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Wire up event dispatcher to task queue for event-driven task assignment
    if (this.taskQueue) {
      this.taskQueue.setEventDispatcher(this.eventDispatcher);
    }

    // NO MORE POLLING - event-driven only

    // Emit start event
    this.eventDispatcher.emitEvent('agent:started', {
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
   * - Task queue metrics (pending and processing counts)
   *
   * @returns Promise resolving to runtime statistics
   */
  async getStats(): Promise<RuntimeStats> {
    const allAgents = this.registry.getAll();
    const agentsByStatus: Record<AgentStatus, number> = {
      idle: 0,
      running: 0,
      completed: 0,
      aborted: 0,
    };

    for (const agent of allAgents) {
      agentsByStatus[agent.status]++;
    }

    let totalPendingTasks = 0;
    let totalProcessingTasks = 0;

    if (this.taskQueue) {
      const pendingCount = await this.taskQueue.getTaskCount('pending');
      const processingCount = await this.taskQueue.getTaskCount('processing');
      totalPendingTasks = pendingCount;
      totalProcessingTasks = processingCount;
    }

    return {
      totalAgents: allAgents.length,
      agentsByStatus,
      totalPendingTasks,
      totalProcessingTasks,
    };
  }

  // ============================================
  // RuntimeControlClient Factory (Internal)
  // ============================================

  /**
   * Create a RuntimeControlClient for a specific Agent
   *
   * @param callerInstanceId The Agent's instanceId that will receive the client
   * @param permissions The permissions to grant
   * @returns IRuntimeControlClient instance
   */
  createControlClient(
    callerInstanceId: string,
    permissions: RuntimeControlPermissions,
  ): IRuntimeControlClient {
    return new RuntimeControlClientImpl(this, callerInstanceId, permissions);
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
    parentPermissions: RuntimeControlPermissions,
  ): Promise<string> {
    const currentChildren = this.registry.getChildren(parentInstanceId);
    if (
      parentPermissions.maxChildAgents > 0 &&
      currentChildren.length >= parentPermissions.maxChildAgents
    ) {
      throw new Error(
        `Maximum child agents limit reached: ${parentPermissions.maxChildAgents}`,
      );
    }

    if (this.containers.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Maximum agent limit reached: ${this.config.maxAgents}`);
    }

    // Compute child permissions (inherit with restrictions)
    const childPermissions = this.computeChildPermissions(parentPermissions);

    // Merge provided permissions with computed defaults
    const runtimePermissions: RuntimeControlPermissions = {
      ...childPermissions,
      ...options.runtimePermissions,
    };

    // Create the agent with parent info
    const container = AgentFactory.create({
      ...options,
      runtimePermissions,
    } as AgentFactoryOptions);

    const instanceId = container.instanceId;

    // Initialize task queue with first agent's container
    if (!this.taskQueue) {
      this.taskQueue = new CentralTaskQueue(container.getContainer());
    }

    // Get agent and inject dependencies
    const agent = await container.getAgent();
    agent.setCentralTaskQueue(this.taskQueue);

    // Create and inject RuntimeControlClient for the child
    const controlClient = this.createControlClient(
      instanceId,
      runtimePermissions,
    );
    agent.setRuntimeClient(controlClient);
    agent.setRuntimePermissions(runtimePermissions);

    // Store container
    this.containers.set(instanceId, container);

    // Get parent metadata for createdBy info
    const parentMetadata = this.registry.get(parentInstanceId);

    // Register metadata with hierarchy info
    const unifiedConfig = container.getConfig();
    const metadata: AgentMetadata = {
      instanceId,
      status: 'idle',
      name: unifiedConfig.agent.name,
      agentType: unifiedConfig.agent.type,
      description: unifiedConfig.agent.description,
      config: unifiedConfig as unknown as Record<string, unknown>,
      createdAt: new Date(),
      updatedAt: new Date(),
      runtimePermissions,
      parentInstanceId,
      createdBy: {
        instanceId: parentInstanceId,
        name: parentMetadata?.name,
        createdAt: new Date(),
      },
    };
    this.registry.register(metadata);

    // Update parent's child list
    this.registry.addChildRelation(parentInstanceId, instanceId);

    // Emit event
    this.eventDispatcher.emitEvent('agent:created', {
      instanceId,
      metadata,
      parentInstanceId,
    });

    return instanceId;
  }

  /**
   * Compute child permissions based on parent permissions
   *
   * Child permissions inherit from parent but with restrictions to prevent
   * unlimited nesting and ensure proper hierarchy.
   */
  private computeChildPermissions(
    parentPermissions: RuntimeControlPermissions,
  ): RuntimeControlPermissions {
    return {
      canCreateAgent: parentPermissions.canCreateAgent,
      canDestroyAgent: false, // Children cannot destroy agents
      canManageAgentLifecycle: parentPermissions.canManageAgentLifecycle,
      canSubmitTask: parentPermissions.canSubmitTask,
      canListAllAgents: false, // Children can only see their own children
      canGetStats: parentPermissions.canGetStats,
      maxChildAgents: Math.max(0, parentPermissions.maxChildAgents - 1),
    };
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

    // Unregister
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
   * Get agent metadata by instanceId (internal API)
   */
  getAgentMetadata(instanceId: string): AgentMetadata | undefined {
    return this.registry.get(instanceId);
  }

  /**
   * Get children of an agent (internal API)
   */
  _getChildren(parentInstanceId: string): AgentMetadata[] {
    return this.registry.getChildren(parentInstanceId);
  }

  // ============================================
  // Private: Task Assignment
  // ============================================

  /**
   * Assign a task to an agent and wake it up.
   *
   * This method:
   * 1. Marks the task as 'processing' in the queue
   * 2. Updates the agent's status to 'running'
   * 3. Emits task:assigned event
   * 4. Calls agent.wakeUpForTask() to begin processing
   *
   * @param taskId The task to assign
   * @param instanceId The agent to assign the task to
   */
  private async assignTaskToAgent(
    taskId: string,
    instanceId: string,
  ): Promise<void> {
    if (!this.taskQueue) return;

    const container = this.containers.get(instanceId);
    if (!container) return;

    const task = await this.taskQueue.getById(taskId);
    if (!task) return;

    // Mark task as processing
    await this.taskQueue.markProcessing(taskId, instanceId);

    // Update registry
    this.registry.update(instanceId, { status: 'running' });

    // Emit event
    this.eventDispatcher.emitEvent('task:assigned', {
      taskId,
      instanceId,
    });

    // Wake up the agent to process the task
    const agent = await container.getAgent();
    await agent.wakeUpForTask(task);
  }

  // ============================================
  // Public: Task Completion Callbacks
  // ============================================

  /**
   * Called when an agent completes a task successfully.
   *
   * This method handles the post-task completion workflow:
   * 1. Exports results from the agent's workspace
   * 2. Marks the task as completed in the queue
   * 3. Updates agent status to 'idle'
   * 4. Emits task:completed event with results
   * 5. Emits agent:idle to trigger next task assignment
   *
   * This method is typically called by the agent itself after
   * successfully processing a task.
   *
   * @param instanceId The agent that completed the task
   * @param taskId The completed task's ID
   */
  async onAgentTaskComplete(instanceId: string, taskId: string): Promise<void> {
    if (!this.taskQueue) return;

    const container = this.containers.get(instanceId);
    if (!container) return;

    const agent = await container.getAgent();
    const exportResults = await agent.workspace.exportResult();

    await this.taskQueue.complete(taskId, {
      taskId,
      success: true,
      output: exportResults,
      completedAt: new Date(),
    });

    // Update registry
    this.registry.update(instanceId, { status: 'idle' });

    // Emit event
    this.eventDispatcher.emitEvent('task:completed', {
      taskId,
      instanceId,
      results: exportResults,
    });

    // Emit agent:idle to trigger next task assignment (event-driven)
    this.eventDispatcher.emitEvent('agent:idle', { instanceId });
  }

  /**
   * Called when an agent fails to complete a task.
   *
   * This method handles the task failure workflow:
   * 1. Marks the task as failed in the queue with error details
   * 2. Updates agent status to 'idle'
   * 3. Emits task:failed event with error
   * 4. Emits agent:idle to trigger next task assignment
   *
   * After failure, the agent is ready to accept new tasks.
   *
   * @param instanceId The agent that failed the task
   * @param taskId The failed task's ID
   * @param error Error message describing the failure
   */
  async onAgentTaskFailed(
    instanceId: string,
    taskId: string,
    error: string,
  ): Promise<void> {
    if (!this.taskQueue) return;

    await this.taskQueue.fail(taskId, error);

    // Update registry
    this.registry.update(instanceId, { status: 'idle' });

    // Emit event
    this.eventDispatcher.emitEvent('task:failed', {
      taskId,
      instanceId,
      error,
    });

    // Emit agent:idle to trigger next task assignment (event-driven)
    this.eventDispatcher.emitEvent('agent:idle', { instanceId });
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
