/**
 * AgentRuntime - Main class for managing multiple Agent instances
 *
 * Provides a unified interface for:
 * - Agent lifecycle management (create/start/stop/destroy)
 * - Central task queue for task distribution
 * - Event-driven monitoring
 */

import { Container } from 'inversify';
import type { Agent } from '../agent/agent.js';
import type { AgentContainer, AgentCreationOptions } from '../di/container.js';
import { AgentFactory, type AgentFactoryOptions } from '../agent/AgentFactory.js';
import type { IPersistenceService } from '../persistence/types.js';
import { TYPES } from '../di/types.js';
import type {
  AgentMetadata,
  AgentRuntimeConfig,
  AgentStatus,
  RuntimeTask,
  RuntimeTaskResult,
  TaskSubmission,
  RuntimeEvent,
  RuntimeEventType,
  ExportResult,
} from './types.js';
import type { IAgentRegistry } from './AgentRegistry.js';
import { AgentRegistry, createAgentRegistry } from './AgentRegistry.js';
import type { IEventDispatcher } from './EventDispatcher.js';
import { EventDispatcher, createEventDispatcher } from './EventDispatcher.js';
import type { ICentralTaskQueue } from './CentralTaskQueue.js';
import { CentralTaskQueue, createCentralTaskQueue } from './CentralTaskQueue.js';

/**
 * Agent filter options
 */
export interface AgentFilter {
  status?: AgentStatus;
  agentType?: string;
  name?: string;
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
  getStats(): RuntimeStats;
}

/**
 * Runtime statistics
 */
export interface RuntimeStats {
  totalAgents: number;
  agentsByStatus: Record<AgentStatus, number>;
  totalPendingTasks: number;
  totalProcessingTasks: number;
}

/**
 * AgentRuntime - Implementation of IAgentRuntime
 */
export class AgentRuntime implements IAgentRuntime {
  private config: AgentRuntimeConfig;
  private containers: Map<string, AgentContainer> = new Map();
  private registry: IAgentRegistry;
  private eventDispatcher: IEventDispatcher;
  private taskQueue: ICentralTaskQueue;
  private running: boolean = false;
  private taskPollingInterval?: ReturnType<typeof setInterval>;

  constructor(config: AgentRuntimeConfig = {}) {
    this.config = {
      maxAgents: 10,
      ...config,
    };

    // Create a minimal container for shared services
    // Note: In production, this should integrate with the main DI container
    this.registry = new AgentRegistry({} as Container);
    this.eventDispatcher = new EventDispatcher();
    this.taskQueue = {} as ICentralTaskQueue; // Will be initialized in start()
  }

  async createAgent(options: AgentFactoryOptions): Promise<string> {
    if (this.containers.size >= (this.config.maxAgents ?? 10)) {
      throw new Error(`Maximum agent limit reached: ${this.config.maxAgents}`);
    }

    // Create agent container using AgentFactory
    const container = AgentFactory.create(options);
    const instanceId = container.instanceId;

    // Wait for agent initialization
    const agent = await container.getAgent();

    // Store container
    this.containers.set(instanceId, container);

    // Register in registry
    const metadata: AgentMetadata = {
      instanceId,
      status: 'idle',
      name: options.agent?.name,
      agentType: options.agent?.type,
      description: options.agent?.description,
      config: container.getConfig(),
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

    // Start task-driven mode if configured
    // The agent will automatically pull tasks from the queue

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
    return this.taskQueue.getById(taskId);
  }

  async getPendingTasks(instanceId?: string): Promise<RuntimeTask[]> {
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

  getStats(): RuntimeStats {
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

    return {
      totalAgents: allAgents.length,
      agentsByStatus,
      totalPendingTasks: 0, // Will be updated from task queue
      totalProcessingTasks: 0,
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

    // The actual task execution will be handled by the agent's
    // RuntimeTaskComponent, which will call completeTask when done
  }

  /**
   * Called when an agent completes a task
   */
  async onAgentTaskComplete(instanceId: string, taskId: string): Promise<void> {
    const container = this.containers.get(instanceId);
    if (!container) return;

    const agent = await container.getAgent();
    const exportResults = await agent.workspace.exportResult();

    const result: RuntimeTaskResult = {
      taskId,
      success: true,
      output: exportResults,
      completedAt: new Date(),
    };

    await this.taskQueue.complete(taskId, result);

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
