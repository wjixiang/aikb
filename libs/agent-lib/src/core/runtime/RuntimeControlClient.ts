/**
 * RuntimeControlClient - Implementation of IRuntimeControlClient
 *
 * This module provides the concrete implementation of the Runtime control interface
 * that is passed to Agents, enabling them to manage agents and topology.
 *
 * Agents without lineage info have unrestricted access (backward compatible).
 * Agents with lineage info are constrained by their role:
 * - worker: cannot create/manage/send to other agents
 * - router/root: can only create allowed children and interact with direct children
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
  AgentLineageInfo,
} from './types.js';
import type { AgentRuntime } from './AgentRuntime.js';
import type { ITopologyGraph } from './topology/graph/TopologyGraph.js';
import type { RoutingStats } from './topology/types.js';
import { createA2AClient } from '../a2a/index.js';
import type { IA2AClient, A2ATaskResult } from '../a2a/index.js';
import { lineageSchemaRegistry } from './LineageSchemaRegistry.js';
import { createAgentSoulByType } from '../AgentSoulRegistry.js';

export class RuntimeControlClientImpl implements IRuntimeControlClient {
  constructor(
    private runtime: AgentRuntime,
    private callerInstanceId: string,
  ) {}

  // ============================================
  // Lineage Helpers
  // ============================================

  private getLineageInfo(): AgentLineageInfo | undefined {
    const metadata = this.runtime.getAgentMetadata(this.callerInstanceId);
    return metadata?.metadata?.['lineage'] as AgentLineageInfo | undefined;
  }

  private assertCanCreateAgent(requestedSoulToken?: string): void {
    const lineage = this.getLineageInfo();
    if (!lineage) return;
    if (lineage.role === 'worker') {
      throw new Error("Agent role 'worker' cannot create child agents");
    }
    if (requestedSoulToken) {
      const allowed = lineage.allowedChildren.find(
        (c) => c.soulToken === requestedSoulToken,
      );
      if (!allowed) {
        throw new Error(
          `Cannot create agent of soulToken '${requestedSoulToken}'. ` +
            `Allowed: [${lineage.allowedChildren.map((c) => c.soulToken).join(', ')}]`,
        );
      }
    }
  }

  private assertCanManageAgents(): void {
    const lineage = this.getLineageInfo();
    if (!lineage) return;
    if (lineage.role === 'worker') {
      throw new Error("Agent role 'worker' cannot manage other agents");
    }
  }

  private async assertCanAccessTarget(targetIdOrAlias: string): Promise<void> {
    const lineage = this.getLineageInfo();
    if (!lineage) return;
    const targetId = this.resolveAgentId(targetIdOrAlias);
    const children = this.runtime._getChildren(this.callerInstanceId);
    const isChild = children.some((c) => c.instanceId === targetId);
    if (!isChild) {
      throw new Error(
        `Cannot access agent '${targetIdOrAlias}': not a direct child`,
      );
    }
  }

  private injectChildLineage(
    options: RuntimeControlAgentOptions,
    requestedSoulToken?: string,
  ): void {
    const lineage = this.getLineageInfo();
    if (!lineage) return;

    const allowedChild = lineage.allowedChildren.find(
      (c) => c.soulToken === requestedSoulToken,
    );
    if (!allowedChild) return;

    const found = lineageSchemaRegistry.findBySoulToken(allowedChild.soulToken);
    if (!found) return;
    const childNode = found.node;

    const childLineage: AgentLineageInfo = {
      schemaId: lineage.schemaId,
      soulToken: childNode.soulToken,
      role: childNode.role,
      allowedChildren: (childNode.children ?? []).map((c) => ({
        soulToken: c.soulToken,
      })),
    };

    options.agent = {
      ...options.agent,
      metadata: {
        ...((options.agent?.metadata as Record<string, unknown>) ?? {}),
        lineage: childLineage,
      },
    };
  }

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
    this.assertCanCreateAgent(soulToken);

    if (soulToken && !options.agent?.sop) {
      try {
        const soulBlueprint = createAgentSoulByType(soulToken as any);
        const soulAgent = soulBlueprint.agent as
          | Record<string, unknown>
          | undefined;
        options.agent = {
          ...soulAgent,
          ...options.agent,
        } as RuntimeControlAgentOptions['agent'];
        if (!options.components && soulBlueprint.components) {
          options.components = soulBlueprint.components;
        }
      } catch {
        // Soul factory not registered (e.g., in tests or when agent-soul-hub not imported)
        // Fall through to create with whatever options were provided
      }
    }

    this.injectChildLineage(options, options.agent?.type);
    return this.runtime._createChildAgent(this.callerInstanceId, options);
  }

  async startAgent(instanceIdOrAlias: string): Promise<void> {
    await this.assertCanAccessTarget(instanceIdOrAlias);
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.startAgent(instanceId);
  }

  async stopAgent(instanceIdOrAlias: string): Promise<void> {
    await this.assertCanAccessTarget(instanceIdOrAlias);
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.stopAgent(instanceId);
  }

  async destroyAgent(
    instanceIdOrAlias: string,
    options?: { cascade?: boolean },
  ): Promise<void> {
    await this.assertCanAccessTarget(instanceIdOrAlias);
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
    await this.assertCanAccessTarget(instanceIdOrAlias);
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.getAgent(instanceId) as Promise<Agent | undefined>;
  }

  async listAgents(filter?: AgentFilter): Promise<AgentMetadata[]> {
    const lineage = this.getLineageInfo();
    if (!lineage) return this.runtime.listAgents(filter);
    return this.runtime._getChildren(this.callerInstanceId);
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
    this.assertCanManageAgents();
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.registerInTopology(instanceId, nodeType, capabilities);
  }

  unregisterFromTopology(instanceIdOrAlias: string): void {
    this.assertCanManageAgents();
    const instanceId = this.resolveAgentId(instanceIdOrAlias);
    return this.runtime.unregisterFromTopology(instanceId);
  }

  connectAgents(
    fromOrAlias: string,
    toOrAlias: string,
    edgeType?: EdgeType,
  ): void {
    this.assertCanManageAgents();
    const from = this.resolveAgentId(fromOrAlias);
    const to = this.resolveAgentId(toOrAlias);
    return this.runtime.connectAgents(from, to, edgeType);
  }

  disconnectAgents(fromOrAlias: string, toOrAlias: string): void {
    this.assertCanManageAgents();
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

  async sendA2ATask(
    targetAgentIdOrAlias: string,
    taskId: string,
    description: string,
    input: Record<string, unknown>,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    },
  ): Promise<A2ATaskResult> {
    await this.assertCanAccessTarget(targetAgentIdOrAlias);
    const targetAgentId = this.resolveAgentId(targetAgentIdOrAlias);
    const a2aClient = this.createDirectA2AClient();
    return a2aClient.sendTask(
      targetAgentId,
      taskId,
      description,
      input,
      options,
    );
  }

  async sendA2ATaskAndWaitForAck(
    targetAgentIdOrAlias: string,
    taskId: string,
    description: string,
    input: Record<string, unknown>,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    },
  ): Promise<string> {
    await this.assertCanAccessTarget(targetAgentIdOrAlias);
    const targetAgentId = this.resolveAgentId(targetAgentIdOrAlias);
    const a2aClient = this.createDirectA2AClient();
    return a2aClient.sendTaskAndWaitForAck(
      targetAgentId,
      taskId,
      description,
      input,
      options,
    );
  }

  async sendA2AQuery(
    targetAgentIdOrAlias: string,
    query: string,
    options?: {
      expectedFormat?: string;
      timeout?: number;
    },
  ): Promise<unknown> {
    await this.assertCanAccessTarget(targetAgentIdOrAlias);
    const targetAgentId = this.resolveAgentId(targetAgentIdOrAlias);
    const a2aClient = this.createDirectA2AClient();
    return a2aClient.sendQuery(targetAgentId, query, options);
  }

  async sendA2AEvent(
    targetAgentIdOrAlias: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    await this.assertCanAccessTarget(targetAgentIdOrAlias);
    const targetAgentId = this.resolveAgentId(targetAgentIdOrAlias);
    const a2aClient = this.createDirectA2AClient();
    return a2aClient.sendEvent(targetAgentId, eventType, data);
  }
}
