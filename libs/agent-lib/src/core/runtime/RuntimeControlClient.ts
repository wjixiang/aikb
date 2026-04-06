/**
 * RuntimeControlClient - Implementation of IRuntimeControlClient
 *
 * This module provides the concrete implementation of the Runtime control interface
 * that is passed to Agents, enabling them to manage agents and topology.
 *
 * @module RuntimeControlClient
 */

import type { Agent } from '../agent/agent.js';
import type {
  IRuntimeControlClient,
  AgentFilter,
  AgentMetadata,
  RuntimeStats,
  RuntimeControlAgentOptions,
  TopologyNodeType,
  EdgeType,
} from './types.js';
import type { AgentRuntime } from './AgentRuntime.js';
import type { ITopologyGraph } from './topology/graph/TopologyGraph.js';
import type { RoutingStats } from './topology/types.js';
import { createA2AClient } from '../a2a/index.js';
import type { IA2AClient } from '../a2a/index.js';
import { createAgentSoulByType } from '../AgentSoulRegistry.js';
import type { AgentBlueprint } from '../agent/AgentFactory.js';
import type { AgentFactoryOptions } from '../agent/AgentFactory.js';

export class RuntimeControlClientImpl implements IRuntimeControlClient {
  constructor(
    private runtime: AgentRuntime,
    private callerInstanceId: string,
  ) {}

  // ============================================
  // Agent ID Resolution
  // ============================================

  resolveAgentId(idOrAlias: string): string {
    const agents = this.runtime.listAgentsSync();
    const byInstanceId = agents.find(
      (a: AgentMetadata) => a.instanceId === idOrAlias,
    );
    if (byInstanceId) {
      return idOrAlias;
    }
    const byAlias = agents.find((a: AgentMetadata) => a.alias === idOrAlias);
    if (byAlias) {
      return byAlias.instanceId;
    }
    const byName = agents.find((a: AgentMetadata) => a.name === idOrAlias);
    if (byName) {
      return byName.instanceId;
    }
    return idOrAlias;
  }

  // ============================================
  // Agent Lifecycle
  // ============================================

  async createAgent(options: RuntimeControlAgentOptions): Promise<string> {
    const soulToken = options.agent?.type;

    let soulBlueprint: AgentBlueprint;

    if (soulToken && !options.agent?.sop) {
      try {
        soulBlueprint = createAgentSoulByType(soulToken);
      } catch {
        soulBlueprint = {
          agent: options.agent as AgentBlueprint['agent'],
          components: options.components ?? [],
        };
      }
    } else {
      soulBlueprint = {
        agent: options.agent as AgentBlueprint['agent'],
        components: options.components ?? [],
      };
    }

    const mergedAgent: AgentBlueprint['agent'] = {
      ...soulBlueprint.agent,
      ...options.agent,
    } as AgentBlueprint['agent'];

    const soulWithOverrides: AgentBlueprint = {
      agent: mergedAgent,
      components: soulBlueprint.components,
    };

    return this.runtime.createAgent(soulWithOverrides, {
      ...(options.api ? { api: options.api } : {}),
      ...(options.observers ? { observers: options.observers } : {}),
      parentInstanceId: this.callerInstanceId,
    } as Partial<AgentFactoryOptions>);
  }

  async startAgent(instanceIdOrAlias: string): Promise<void> {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.startAgent(instanceId);
  }

  async stopAgent(instanceIdOrAlias: string): Promise<void> {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.stopAgent(instanceId);
  }

  async sleepAgent(
    instanceIdOrAlias: string,
    reason?: string,
  ): Promise<void> {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.sleepAgent(instanceId, reason);
  }

  async restoreAgent(instanceIdOrAlias: string): Promise<unknown> {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.restoreAgent(instanceId);
  }

  async destroyAgent(
    instanceIdOrAlias: string,
    options?: { cascade?: boolean },
  ): Promise<void> {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime._destroyAgentWithCascade(
      instanceId,
      options?.cascade ?? true,
    );
  }

  // ============================================
  // Agent Query
  // ============================================

  async getAgent(instanceIdOrAlias: string): Promise<Agent | undefined> {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
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
  // Runtime Statistics
  // ============================================

  async getStats(): Promise<RuntimeStats> {
    return this.runtime.getStats();
  }

  // ============================================
  // Topology Management
  // ============================================

  registerInTopology(
    instanceIdOrAlias: string,
    nodeType: TopologyNodeType,
    capabilities?: string[],
  ): void {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.registerInTopology(instanceId, nodeType, capabilities);
  }

  unregisterFromTopology(instanceIdOrAlias: string): void {
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.unregisterFromTopology(instanceId);
  }

  connectAgents(
    fromOrAlias: string,
    toOrAlias: string,
    edgeType?: EdgeType,
  ): void {
    const from = this.resolveAgentId(fromOrAlias);
    const to = this.resolveAgentId(toOrAlias);
    return this.runtime.connectAgents(from, to, edgeType);
  }

  disconnectAgents(fromOrAlias: string, toOrAlias: string): void {
    const from = this.resolveAgentId(fromOrAlias);
    const to = this.resolveAgentId(toOrAlias);
    return this.runtime.disconnectAgents(from, to);
  }

  getTopologyGraph(): ITopologyGraph {
    return this.runtime.getTopologyGraph();
  }

  getTopologyStats(): RoutingStats {
    return this.runtime.getTopologyStats();
  }

  // ============================================
  // A2A Communication
  // ============================================

  private createDirectA2AClient(): IA2AClient {
    return createA2AClient(
      this.runtime.getMessageBus(),
      this.runtime.getRegistry() as any,
      {
        instanceId: this.callerInstanceId,
      },
    );
  }

  async sendA2AQuery(
    targetAgentIdOrAlias: string,
    query: string,
    options?: {
      expectedFormat?: string;
      input?: Record<string, unknown>;
      description?: string;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      ackOnly?: boolean;
      timeout?: number;
    },
  ): Promise<unknown> {
    const targetAgentId = this.resolveAgentId(targetAgentIdOrAlias);
    const a2aClient = this.createDirectA2AClient();
    return a2aClient.sendQuery(targetAgentId, query, options);
  }

  async sendA2AEvent(
    targetAgentIdOrAlias: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    const targetAgentId = this.resolveAgentId(targetAgentIdOrAlias);
    const a2aClient = this.createDirectA2AClient();
    return a2aClient.sendEvent(targetAgentId, eventType, data);
  }
}
