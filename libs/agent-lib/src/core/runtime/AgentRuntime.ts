/**
 * AgentRuntime - Main class for managing multiple Agent instances
 *
 * Provides a unified interface for:
 * - Agent lifecycle management (create/start/stop/destroy)
 * - Central task queue for task distribution
 * - Event-driven monitoring
 */

import type { Agent } from '../agent/agent.js';
import type { AgentContainer, AgentCreationOptions } from '../di/container.js';
import { AgentFactory, type AgentFactoryOptions } from '../agent/AgentFactory.js';
import type {
  AgentMetadata,
  AgentRuntimeConfig,
  AgentStatus,
  RuntimeTask,
  TaskSubmission,
  RuntimeEvent,
  RuntimeEventType,
} from './types.js';
import type { IAgentRegistry } from './AgentRegistry.js';
import { AgentRegistry } from './AgentRegistry.js';
import type { IEventDispatcher } from './EventDispatcher.js';
import { EventDispatcher } from './EventDispatcher.js';
import type { ICentralTaskQueue } from './CentralTaskQueue.js';
import { CentralTaskQueue } from './CentralTaskQueue.js';

/**
 * Agent filter options
 */
export interface AgentFilter {
  status?: AgentStatus;
  agentType?: string;
  name?: string;
}

/**
 * Runtime statistics
 */
export interface RuntimeStats {
  totalAgents: number;
  agentsByStatus: Record<AgentStatus, number>;
  totalPendingTasks?: number;
  totalProcessingTasks?: number;
}

/**
 * IAgentRuntime - Interface for Agent Runtime
 */
export interface IAgentRuntime {
  // Agent lifecycle
  createAgent(options: AgentFactoryOptions): Promise<string>;
  startAgent(instanceId: string): Promise<void>;
  stopAgent(instanceId: string): Promise<void>;
  destroyAgent(instanceId: string): Promise<void>;

  // Agent queries
  getAgent(instanceId: string): Promise<Agent | undefined>;
  getAgentContainer(instanceId: string): AgentContainer | undefined;
  listAgents(filter?: AgentFilter): Promise<AgentMetadata[]>;

  // Task management
  submitTask(task: TaskSubmission): Promise<string>;
  getTaskStatus(taskId: string): Promise<RuntimeTask | undefined>;
  getPendingTasks(instanceId?: string): Promise<RuntimeTask[]>;

  // Events
  on(eventType: RuntimeEventType, handler: (event: RuntimeEvent) => void): () => void;

  // Runtime control
  start(): Promise<void>;
  stop(): Promise<void>;
  getStats(): Promise<RuntimeStats>;
}

/**
 * AgentRuntime - Implementation of IAgentRuntime
 */
export class AgentRuntime implements IAgentRuntime {
  private config: AgentRuntimeConfig;
  private containers: Map<string, AgentContainer> = new Map();
  private registry: IAgentRegistry;
  private eventDispatcher: IEventDispatcher;
  private taskQueue: ICentralTaskQueue | null = null;
  private running: boolean = false;
  private taskPollingInterval?: ReturnType<typeof setInterval>;

  constructor(config: AgentRuntimeConfig = {}) {
    this.config = {
      maxAgents: 10,
      ...config,
    };

    // Create components that don't need DI container
    this.registry = new AgentRegistry();
    this.eventDispatcher = new EventDispatcher();
  }

  async createAgent(options: AgentFactoryOptions): Promise<string> {
    if (this.containers.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Maximum agent limit reached: ${this.config.maxAgents}`);
    }

    // Create agent container using AgentFactory
    const container = AgentFactory.create(options);
    const instanceId = container.instanceId;

    // Initialize task queue with first agent's container
    if (!this.taskQueue) {
      this.taskQueue = new CentralTaskQueue(container.getContainer());
    }

    // Wait for agent initialization
    const agent = await container.getAgent();

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
    };
    this.registry.register(metadata);

    // Emit event
    this.eventDispatcher.emitEvent('agent:created', { instanceId, metadata });

    return instanceId;
  }

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

  async getAgent(instanceId: string): Promise<Agent | undefined> {
    const container = this.containers.get(instanceId);
    if (!container) {
      return undefined;
    }
    return container.getAgent();
  }

  getAgentContainer(instanceId: string): AgentContainer | undefined {
    return this.containers.get(instanceId);
  }

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

  async getTaskStatus(taskId: string): Promise<RuntimeTask | undefined> {
    if (!this.taskQueue) {
      return undefined;
    }
    return this.taskQueue.getById(taskId);
  }

  async getPendingTasks(instanceId?: string): Promise<RuntimeTask[]> {
    if (!this.taskQueue) {
      return [];
    }
    if (instanceId) {
      return this.taskQueue.getForAgent(instanceId);
    }
    return this.taskQueue.getPending();
  }

  on(eventType: RuntimeEventType, handler: (event: RuntimeEvent) => void): () => void {
    return this.eventDispatcher.subscribe(eventType, handler);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Start task polling for all idle agents
    this.startTaskPolling();

    // Emit start event
    this.eventDispatcher.emitEvent('agent:started', {
      runtimeStarted: true,
      agentCount: this.containers.size,
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop task polling
    if (this.taskPollingInterval) {
      clearInterval(this.taskPollingInterval);
      this.taskPollingInterval = undefined;
    }

    // Stop all agents
    for (const instanceId of this.containers.keys()) {
      await this.stopAgent(instanceId);
    }
  }

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

  /**
   * Start task polling interval
   * Agents will pull tasks when idle
   */
  private startTaskPolling(): void {
    this.taskPollingInterval = setInterval(async () => {
      if (!this.running) return;

      try {
        await this.processPendingTasks();
      } catch (error) {
        console.error('[AgentRuntime] Error processing pending tasks:', error);
      }
    }, 1000); // Poll every second
  }

  /**
   * Process pending tasks for idle agents
   */
  private async processPendingTasks(): Promise<void> {
    if (!this.taskQueue) return;

    const idleAgents = this.registry.findIdle();

    for (const agentMetadata of idleAgents) {
      const pendingTasks = await this.taskQueue.getForAgent(agentMetadata.instanceId);

      if (pendingTasks.length > 0) {
        const task = pendingTasks[0];
        await this.assignTaskToAgent(task.taskId, agentMetadata.instanceId);
      }
    }
  }

  /**
   * Assign a task to an agent
   */
  private async assignTaskToAgent(taskId: string, instanceId: string): Promise<void> {
    if (!this.taskQueue) return;

    const container = this.containers.get(instanceId);
    if (!container) return;

    // Mark task as processing
    await this.taskQueue.markProcessing(taskId, instanceId);

    // Update registry
    this.registry.update(instanceId, { status: 'running' });

    // Emit event
    this.eventDispatcher.emitEvent('task:assigned', {
      taskId,
      instanceId,
    });

    // The actual task execution will be handled by the agent's RuntimeTaskComponent
  }

  /**
   * Called when an agent completes a task
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
  }

  /**
   * Called when an agent fails a task
   */
  async onAgentTaskFailed(instanceId: string, taskId: string, error: string): Promise<void> {
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
  }
}

/**
 * Create an AgentRuntime instance
 */
export function createAgentRuntime(config?: AgentRuntimeConfig): IAgentRuntime {
  return new AgentRuntime(config);
}
