/**
 * RuntimeControlClient - Implementation of IRuntimeControlClient
 *
 * This module provides the concrete implementation of the Runtime control interface
 * that is passed to Agents, enabling them to manage agents and topology.
 *
 * All agents have equal capabilities - there is no permission system.
 *
 * @module RuntimeControlClient
 */

import type { Agent } from '../agent/agent.js';
import type {
  IRuntimeControlClient,
  AgentFilter,
  AgentMetadata,
  TaskSubmission,
  RuntimeTask,
  RuntimeStats,
  RuntimeControlAgentOptions,
  TopologyNodeType,
  EdgeType,
} from './types.js';
import type { AgentRuntime } from './AgentRuntime.js';
import type { ITopologyGraph } from './topology/graph/TopologyGraph.js';
import type { RoutingStats } from './topology/types.js';

export class RuntimeControlClientImpl implements IRuntimeControlClient {
  constructor(
    private runtime: AgentRuntime,
    private callerInstanceId: string,
  ) {}

  // ============================================
  // Agent Lifecycle
  // ============================================

  async createAgent(options: RuntimeControlAgentOptions): Promise<string> {
    return this.runtime._createChildAgent(this.callerInstanceId, options);
  }

  async startAgent(instanceId: string): Promise<void> {
    return this.runtime.startAgent(instanceId);
  }

  async stopAgent(instanceId: string): Promise<void> {
    return this.runtime.stopAgent(instanceId);
  }

  async destroyAgent(
    instanceId: string,
    options?: { cascade?: boolean },
  ): Promise<void> {
    return this.runtime._destroyAgentWithCascade(
      instanceId,
      options?.cascade ?? true,
    );
  }

  // ============================================
  // Agent Query
  // ============================================

  async getAgent(instanceId: string): Promise<Agent | undefined> {
    return this.runtime.getAgent(instanceId) as Promise<Agent | undefined>;
  }

  async listAgents(filter?: AgentFilter): Promise<AgentMetadata[]> {
    return this.runtime.listAgents(filter);
  }

  getSelfInstanceId(): string {
    return this.callerInstanceId;
  }

  getParentInstanceId(): string | undefined {
    const metadata = this.runtime.getAgentMetadata(this.callerInstanceId);
    return metadata?.parentInstanceId;
  }

  async listChildAgents(): Promise<AgentMetadata[]> {
    return this.runtime._getChildren(this.callerInstanceId);
  }

  // ============================================
  // Task Management
  // ============================================

  async submitTask(task: TaskSubmission): Promise<string> {
    return this.runtime.submitTask(task);
  }

  async getTaskStatus(taskId: string): Promise<RuntimeTask | undefined> {
    return this.runtime.getTaskStatus(taskId);
  }

  async getPendingTasks(instanceId?: string): Promise<RuntimeTask[]> {
    return this.runtime.getPendingTasks(instanceId);
  }

  // ============================================
  // Runtime Statistics
  // ============================================

  async getStats(): Promise<RuntimeStats> {
    return this.runtime.getStats();
  }

  // ============================================
  // Topology Management
  // ============================================

  registerInTopology(
    instanceId: string,
    nodeType: TopologyNodeType,
    capabilities?: string[],
  ): void {
    return this.runtime.registerInTopology(instanceId, nodeType, capabilities);
  }

  unregisterFromTopology(instanceId: string): void {
    return this.runtime.unregisterFromTopology(instanceId);
  }

  connectAgents(from: string, to: string, edgeType?: EdgeType): void {
    return this.runtime.connectAgents(from, to, edgeType);
  }

  disconnectAgents(from: string, to: string): void {
    return this.runtime.disconnectAgents(from, to);
  }

  getTopologyGraph(): ITopologyGraph {
    return this.runtime.getTopologyGraph();
  }

  getTopologyStats(): RoutingStats {
    return this.runtime.getTopologyStats();
  }
}
