import 'reflect-metadata';
import { injectable, inject, optional } from 'inversify';
import { ToolComponent, type ExportResult } from 'agent-lib/components';
import type { ToolCallResult } from 'agent-lib/components';
import type { TUIElement } from 'agent-lib/components/ui';
import { th, tdiv } from 'agent-lib/components/ui';
import { TYPES } from 'agent-lib/core';
import {
  runtimeControlToolSchemas,
  type RuntimeControlToolReturnTypes,
  type CreateAgentParams,
  type DestroyAgentParams,
  type StopAgentParams,
  type ListAgentsParams,
  type GetAgentParams,
  type ListAgentSoulsParams,
  type CreateAgentByTypeParams,
  type RegisterInTopologyParams,
  type UnregisterFromTopologyParams,
  type ConnectAgentsParams,
  type DisconnectAgentsParams,
  type GetNeighborsParams,
} from './schemas.js';
import { SwarmAPIClient, type RuntimeControlRESTConfig } from './restClient.js';

interface ChildAgentRecord {
  instanceId: string;
  name: string;
  soulType?: string;
  createdAt: number;
}

interface RuntimeControlState {
  childAgents: Record<string, ChildAgentRecord>;
}

@injectable()
export class RuntimeControlComponent extends ToolComponent<RuntimeControlState> {
  componentId = 'runtime-control';
  displayName = 'Runtime Control';
  description = 'Create and manage child agents, topology, and agent souls';
  componentPrompt = `## Runtime Control

You can create and manage child agents, control the topology network, and discover available agent souls.

**Agent Lifecycle:**
1. listAgentSouls — discover what specialized agents are available
2. createAgentByType — create a child agent from a soul template
3. createAgent — create a fully custom child agent
4. stopAgent — stop a running agent
6. destroyAgent — destroy an agent and optionally its children

**Monitoring:**
- listAgents — list all agents (with optional filters)
- listChildAgents — list only your direct children
- getAgent — get details about a specific agent
- getStats — runtime statistics
- getMyInfo — your own instance ID and metadata

**Topology Network:**
- registerInTopology — register an agent as a node (router/worker/hybrid)
- connectAgents / disconnectAgents — manage edges between agents
- getTopologyInfo — full topology snapshot
- getNeighbors — neighbors of a specific agent

**Best Practices:**
- Always use listAgentSouls first to discover available soul types
- Use createAgentByType over createAgent when a suitable soul exists
- Clean up agents with destroyAgent when their task is done
- Register agents in topology for A2A communication`;

  protected instanceId: string;
  protected restClient?: SwarmAPIClient;

  constructor(
    @inject(TYPES.AgentInstanceId) instanceId: string,
    @inject(TYPES.RuntimeControlRESTConfig)
    @optional()
    restConfig?: RuntimeControlRESTConfig,
  ) {
    super();
    this.instanceId = instanceId;
    if (restConfig?.restBaseUrl) {
      this.restClient = new SwarmAPIClient(
        restConfig.restBaseUrl,
        restConfig.apiKey,
      );
    }
  }

  protected override initialState(): RuntimeControlState {
    return { childAgents: {} };
  }

  protected override toolDefs() {
    return {
      createAgent: {
        desc: runtimeControlToolSchemas.createAgent.desc,
        paramsSchema: runtimeControlToolSchemas.createAgent.paramsSchema,
      },
      createAgentByType: {
        desc: runtimeControlToolSchemas.createAgentByType.desc,
        paramsSchema: runtimeControlToolSchemas.createAgentByType.paramsSchema,
      },
      stopAgent: {
        desc: runtimeControlToolSchemas.stopAgent.desc,
        paramsSchema: runtimeControlToolSchemas.stopAgent.paramsSchema,
      },
      destroyAgent: {
        desc: runtimeControlToolSchemas.destroyAgent.desc,
        paramsSchema: runtimeControlToolSchemas.destroyAgent.paramsSchema,
      },
      listAgents: {
        desc: runtimeControlToolSchemas.listAgents.desc,
        paramsSchema: runtimeControlToolSchemas.listAgents.paramsSchema,
      },
      listChildAgents: {
        desc: runtimeControlToolSchemas.listChildAgents.desc,
        paramsSchema: runtimeControlToolSchemas.listChildAgents.paramsSchema,
      },
      getAgent: {
        desc: runtimeControlToolSchemas.getAgent.desc,
        paramsSchema: runtimeControlToolSchemas.getAgent.paramsSchema,
      },
      getStats: {
        desc: runtimeControlToolSchemas.getStats.desc,
        paramsSchema: runtimeControlToolSchemas.getStats.paramsSchema,
      },
      getMyInfo: {
        desc: runtimeControlToolSchemas.getMyInfo.desc,
        paramsSchema: runtimeControlToolSchemas.getMyInfo.paramsSchema,
      },
      listAgentSouls: {
        desc: runtimeControlToolSchemas.listAgentSouls.desc,
        paramsSchema: runtimeControlToolSchemas.listAgentSouls.paramsSchema,
      },
      registerInTopology: {
        desc: runtimeControlToolSchemas.registerInTopology.desc,
        paramsSchema: runtimeControlToolSchemas.registerInTopology.paramsSchema,
      },
      unregisterFromTopology: {
        desc: runtimeControlToolSchemas.unregisterFromTopology.desc,
        paramsSchema:
          runtimeControlToolSchemas.unregisterFromTopology.paramsSchema,
      },
      connectAgents: {
        desc: runtimeControlToolSchemas.connectAgents.desc,
        paramsSchema: runtimeControlToolSchemas.connectAgents.paramsSchema,
      },
      disconnectAgents: {
        desc: runtimeControlToolSchemas.disconnectAgents.desc,
        paramsSchema: runtimeControlToolSchemas.disconnectAgents.paramsSchema,
      },
      getTopologyInfo: {
        desc: runtimeControlToolSchemas.getTopologyInfo.desc,
        paramsSchema: runtimeControlToolSchemas.getTopologyInfo.paramsSchema,
      },
      getNeighbors: {
        desc: runtimeControlToolSchemas.getNeighbors.desc,
        paramsSchema: runtimeControlToolSchemas.getNeighbors.paramsSchema,
      },
    };
  }

  // ===========================================================================
  // Agent Lifecycle
  // ===========================================================================

  async onCreateAgent(
    params: CreateAgentParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['createAgent']>> {
    if (!this.restClient) return this.noClient();

    try {
      const result = await this.restClient.createAgent(
        {
          name: params.name,
          type: params.agentType,
          description: params.description,
          sop: params.sop,
        },
        this.instanceId,
      );

      this.reactive.childAgents[result.instanceId] = {
        instanceId: result.instanceId,
        name: params.name,
        createdAt: Date.now(),
      };

      return {
        success: true,
        data: {
          instanceId: result.instanceId,
          name: params.name,
          createdAt: new Date().toISOString(),
        },
        summary: `[Runtime] Created agent: ${params.name} (${result.instanceId})`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onCreateAgentByType(
    params: CreateAgentByTypeParams,
  ): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['createAgentByType']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      const result = await this.restClient.createAgentBySoul(
        params.soulType,
        params.name,
        undefined,
        this.instanceId,
      );

      this.reactive.childAgents[result.instanceId] = {
        instanceId: result.instanceId,
        name: params.name || params.soulType,
        soulType: params.soulType,
        createdAt: Date.now(),
      };

      return {
        success: true,
        data: {
          instanceId: result.instanceId,
          alias: result.alias || result.instanceId,
          name: params.name || params.soulType,
          soulType: params.soulType,
          createdAt: new Date().toISOString(),
        },
        summary: `[Runtime] Created ${params.name || params.soulType} (${result.instanceId})`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onStopAgent(
    params: StopAgentParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['stopAgent']>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.stopAgent(params.agentId!);
      return {
        success: true,
        data: { success: true },
        summary: `[Runtime] Stopped agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onDestroyAgent(
    params: DestroyAgentParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['destroyAgent']>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.destroyAgent(params.agentId, params.cascade);
      delete this.reactive.childAgents[params.agentId];
      return {
        success: true,
        data: { success: true, destroyedCount: 1 },
        summary: `[Runtime] Destroyed agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  // ===========================================================================
  // Monitoring
  // ===========================================================================

  async onListAgents(
    params: ListAgentsParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['listAgents']>> {
    if (!this.restClient) return this.noClient();

    try {
      const filter: Record<string, string> = {};
      if (params.status) filter['status'] = params.status;
      if (params.agentType) filter['type'] = params.agentType;
      if (params.name) filter['name'] = params.name;
      const agents = await this.restClient.listAgents(filter);
      const list = agents.data || agents;
      return {
        success: true,
        data: { agents: list },
        summary: `[Runtime] Listed ${list.length} agent(s)`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onListChildAgents(): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['listChildAgents']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      const allAgents = await this.restClient.listAgents();
      const list = allAgents.data || allAgents;
      const myChildren = list.filter(
        (a: any) => a.parentInstanceId === this.instanceId,
      );
      return {
        success: true,
        data: { agents: myChildren },
        summary: `[Runtime] Listed ${myChildren.length} child agent(s)`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onGetAgent(
    params: GetAgentParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['getAgent']>> {
    if (!this.restClient) return this.noClient();

    try {
      const agent = await this.restClient.getAgent(params.agentId);
      return {
        success: true,
        data: agent,
        summary: `[Runtime] Got agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onGetStats(): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['getStats']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      const stats = await this.restClient.getStats();
      return {
        success: true,
        data: stats,
        summary: '[Runtime] Got runtime stats',
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onGetMyInfo(): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['getMyInfo']>
  > {
    return {
      success: true,
      data: { instanceId: this.instanceId },
      summary: `[Runtime] My instance ID: ${this.instanceId}`,
    };
  }

  // ===========================================================================
  // Agent Souls
  // ===========================================================================

  async onListAgentSouls(
    params: ListAgentSoulsParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['listAgentSouls']>> {
    if (!this.restClient) return this.noClient();

    try {
      const souls = await this.restClient.listAgentSouls();
      return {
        success: true,
        data: { souls: souls.data || souls },
        summary: `[Runtime] Listed available agent soul(s)`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  // ===========================================================================
  // Topology
  // ===========================================================================

  async onRegisterInTopology(
    params: RegisterInTopologyParams,
  ): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['registerInTopology']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.registerInTopology(
        params.agentId,
        params.nodeType,
        params.capabilities,
      );
      return {
        success: true,
        data: { success: true, instanceId: params.agentId },
        summary: `[Runtime] Registered ${params.agentId} as ${params.nodeType}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onUnregisterFromTopology(
    params: UnregisterFromTopologyParams,
  ): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['unregisterFromTopology']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.unregisterFromTopology(params.agentId);
      return {
        success: true,
        data: { success: true, instanceId: params.agentId },
        summary: `[Runtime] Unregistered ${params.agentId} from topology`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onConnectAgents(
    params: ConnectAgentsParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['connectAgents']>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.connectAgents(
        params.from,
        params.to,
        params.edgeType,
      );
      return {
        success: true,
        data: { success: true, from: params.from, to: params.to },
        summary: `[Runtime] Connected ${params.from} -> ${params.to}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onDisconnectAgents(
    params: DisconnectAgentsParams,
  ): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['disconnectAgents']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.disconnectAgents(params.from, params.to);
      return {
        success: true,
        data: { success: true, from: params.from, to: params.to },
        summary: `[Runtime] Disconnected ${params.from} -> ${params.to}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onGetTopologyInfo(): Promise<
    ToolCallResult<RuntimeControlToolReturnTypes['getTopologyInfo']>
  > {
    if (!this.restClient) return this.noClient();

    try {
      const [topology, stats] = await Promise.all([
        this.restClient.getTopology(),
        this.restClient.getTopologyStats(),
      ]);
      return {
        success: true,
        data: {
          nodes: topology.nodes || [],
          edges: topology.edges || [],
          stats,
          size: {
            nodes: topology.size || topology.nodes?.length || 0,
            edges: topology.edges?.length || 0,
          },
        },
        summary: `[Runtime] Topology: ${topology.nodes?.length || 0} nodes, ${topology.edges?.length || 0} edges`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  async onGetNeighbors(
    params: GetNeighborsParams,
  ): Promise<ToolCallResult<RuntimeControlToolReturnTypes['getNeighbors']>> {
    if (!this.restClient) return this.noClient();

    try {
      const result = await this.restClient.getNeighbors(params.agentId);
      return {
        success: true,
        data: { neighbors: result.data || result },
        summary: `[Runtime] Found neighbors for ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  // ===========================================================================
  // Rendering
  // ===========================================================================

  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'Runtime Control',
        styles: { align: 'center' },
      }),
    );
    elements.push(
      new tdiv({
        content: `Instance: ${this.instanceId.slice(0, 8)}`,
      }),
    );

    if (!this.restClient) {
      elements.push(new tdiv({ content: 'REST API not configured' }));
      return elements;
    }

    try {
      const [stats, topology] = await Promise.all([
        this.restClient.getStats(),
        this.restClient.getTopology(),
      ]);

      const total = stats.totalAgents || 0;
      const running = stats.runningAgents || 0;
      const idle = stats.idleAgents || 0;
      const sleeping = (stats as any).sleepAgents || 0;

      elements.push(
        new tdiv({
          content: `Agents: ${total} total, ${running} running, ${idle} idle${sleeping > 0 ? `, ${sleeping} sleeping` : ''}`,
        }),
      );

      const localChildren = Object.values(this.snapshot.childAgents);
      if (localChildren.length > 0) {
        elements.push(
          new th({
            content: `My Children (${localChildren.length})`,
            styles: { align: 'left' },
          }),
        );
        for (const child of localChildren) {
          const age = Math.round((Date.now() - child.createdAt) / 1000);
          const suffix = child.soulType ? ` [${child.soulType}]` : '';
          elements.push(
            new tdiv({
              content: `  + ${child.name}${suffix} (${child.instanceId.slice(0, 8)}) ${age}s ago`,
            }),
          );
        }
      }

      const nodes: any[] = topology.nodes || [];
      const edges: any[] = topology.edges || [];

      if (nodes.length > 0) {
        elements.push(
          new th({
            content: `Topology (${nodes.length} nodes, ${edges.length} edges)`,
            styles: { align: 'left' },
          }),
        );
        for (const node of nodes.slice(0, 10)) {
          const status = node.status ? ` [${node.status}]` : '';
          const nodeType = node.nodeType ? ` (${node.nodeType})` : '';
          elements.push(
            new tdiv({
              content: `  ${node.instanceId || node.id}${nodeType}${status}`,
            }),
          );
        }
        if (nodes.length > 10) {
          elements.push(
            new tdiv({
              content: `  ... and ${nodes.length - 10} more nodes`,
            }),
          );
        }
      }
    } catch {
      elements.push(new tdiv({ content: 'Runtime API unreachable' }));
    }

    return elements;
  };

  // ===========================================================================
  // Export
  // ===========================================================================

  override async exportData(_options?: any): Promise<ExportResult> {
    return {
      data: {
        instanceId: this.instanceId,
        restBaseUrl: this.restClient ? 'configured' : 'not configured',
        childAgents: Object.values(this.snapshot.childAgents),
      },
      format: 'json',
    };
  }

  // ===========================================================================
  // Error Helpers
  // ===========================================================================

  private noClient<T = unknown>(): ToolCallResult<T> {
    return {
      success: false,
      data: {
        error:
          'Runtime REST API not configured. Set runtimeControl.restBaseUrl in agent config.',
      } as T,
      summary: '[Runtime] REST API not configured',
    };
  }

  private restError<T = unknown>(error: unknown): ToolCallResult<T> {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: { error: msg } as T,
      summary: `[Runtime] Failed: ${msg}`,
    };
  }
}
