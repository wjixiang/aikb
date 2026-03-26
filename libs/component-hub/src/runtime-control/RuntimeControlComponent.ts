import 'reflect-metadata';
import { injectable, inject, optional } from 'inversify';
import {
  ToolComponent,
  ExportOptions,
  type ExportResult,
} from 'agent-lib/components';
import type { Tool, ToolCallResult } from 'agent-lib/components';
import type { TUIElement } from 'agent-lib/components/ui';
import { th, tdiv } from 'agent-lib/components/ui';
import { TYPES } from 'agent-lib/core';
import {
  runtimeControlToolSchemas,
  type RuntimeControlToolName,
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
  type GetTopologyInfoParams,
  type GetNeighborsParams,
} from './schemas.js';
import { SwarmAPIClient, type RuntimeControlRESTConfig } from './restClient.js';

type RuntimeControlToolReturnType<T extends RuntimeControlToolName> =
  RuntimeControlToolReturnTypes[T];

@injectable()
export class RuntimeControlComponent extends ToolComponent {
  override componentId = 'runtime-control';
  override displayName = 'Runtime Control';
  override description = 'Create and manage child agents';
  override componentPrompt = `## Runtime Control

This component enables creation and management of child agents via REST API.

**Workflow:**
1. Create child agents using createAgent or createAgentByType
2. Monitor agent status using listAgents and getAgent
3. Control agent lifecycle with stopAgent
4. Register agents in topology via registerInTopology
5. Connect agents via connectAgents
6. View topology via getTopologyInfo and getNeighbors

**Best Practices:**
- Use child agents for independent, parallel tasks
- Clean up agents when tasks complete via destroyAgent
- Register agents in topology for coordinated workflows`;

  protected instanceId: string;
  protected restClient?: SwarmAPIClient;
  toolSet: Map<string, Tool>;

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
    this.toolSet = this.initializeToolSet();
  }

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    const toolEntries: [
      string,
      (typeof runtimeControlToolSchemas)[keyof typeof runtimeControlToolSchemas],
    ][] = [
      ['createAgent', runtimeControlToolSchemas.createAgent],
      ['destroyAgent', runtimeControlToolSchemas.destroyAgent],
      ['stopAgent', runtimeControlToolSchemas.stopAgent],
      ['listAgents', runtimeControlToolSchemas.listAgents],
      ['getAgent', runtimeControlToolSchemas.getAgent],
      ['getStats', runtimeControlToolSchemas.getStats],
      ['listChildAgents', runtimeControlToolSchemas.listChildAgents],
      ['getMyInfo', runtimeControlToolSchemas.getMyInfo],
      ['listAgentSouls', runtimeControlToolSchemas.listAgentSouls],
      ['createAgentByType', runtimeControlToolSchemas.createAgentByType],
      ['registerInTopology', runtimeControlToolSchemas.registerInTopology],
      [
        'unregisterFromTopology',
        runtimeControlToolSchemas.unregisterFromTopology,
      ],
      ['connectAgents', runtimeControlToolSchemas.connectAgents],
      ['disconnectAgents', runtimeControlToolSchemas.disconnectAgents],
      ['getTopologyInfo', runtimeControlToolSchemas.getTopologyInfo],
      ['getNeighbors', runtimeControlToolSchemas.getNeighbors],
    ];

    toolEntries.forEach(([name, toolDef]) => {
      tools.set(name, {
        toolName: toolDef.toolName,
        desc: toolDef.desc,
        paramsSchema: toolDef.paramsSchema,
      });
    });

    return tools;
  }

  handleToolCall: {
    <T extends RuntimeControlToolName>(
      toolName: T,
      params: unknown,
    ): Promise<ToolCallResult<RuntimeControlToolReturnType<T>>>;
    (toolName: string, params: unknown): Promise<ToolCallResult<unknown>>;
  } = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult<unknown>> => {
    try {
      switch (toolName) {
        case 'createAgent':
          return await this.handleCreateAgent(params as CreateAgentParams);
        case 'destroyAgent':
          return await this.handleDestroyAgent(params as DestroyAgentParams);
        case 'stopAgent':
          return await this.handleStopAgent(params as StopAgentParams);
        case 'listAgents':
          return await this.handleListAgents(params as ListAgentsParams);
        case 'getAgent':
          return await this.handleGetAgent(params as GetAgentParams);
        case 'getStats':
          return await this.handleGetStats();
        case 'listChildAgents':
          return await this.handleListChildAgents();
        case 'getMyInfo':
          return await this.handleGetMyInfo();
        case 'listAgentSouls':
          return await this.handleListAgentSouls(
            params as ListAgentSoulsParams,
          );
        case 'createAgentByType':
          return await this.handleCreateAgentByType(
            params as CreateAgentByTypeParams,
          );
        case 'registerInTopology':
          return await this.handleRegisterInTopology(
            params as RegisterInTopologyParams,
          );
        case 'unregisterFromTopology':
          return await this.handleUnregisterFromTopology(
            params as UnregisterFromTopologyParams,
          );
        case 'connectAgents':
          return await this.handleConnectAgents(params as ConnectAgentsParams);
        case 'disconnectAgents':
          return await this.handleDisconnectAgents(
            params as DisconnectAgentsParams,
          );
        case 'getTopologyInfo':
          return await this.handleGetTopologyInfo();
        case 'getNeighbors':
          return await this.handleGetNeighbors(params as GetNeighborsParams);
        default:
          return {
            success: false,
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[RuntimeControl] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage },
        summary: `[RuntimeControl] Error: ${errorMessage}`,
      };
    }
  };

  // ============================================
  // Render
  // ============================================

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

      const totalAgents = stats.totalAgents || 0;
      const runningAgents = stats.runningAgents || 0;
      elements.push(
        new tdiv({
          content: `Agents: ${totalAgents} total, ${runningAgents} running`,
        }),
      );

      const nodes: any[] = topology.nodes || [];
      const edges: any[] = topology.edges || [];

      if (nodes.length > 0) {
        elements.push(
          new th({
            content: `Topology (${nodes.length} nodes, ${edges.length} edges)`,
            styles: { align: 'left' },
          }),
        );
        for (const node of nodes) {
          elements.push(
            new tdiv({
              content: `  • ${node.instanceId || node.id} (${node.nodeType || '?'})`,
            }),
          );
        }
      }
    } catch {
      elements.push(new tdiv({ content: 'Runtime API unreachable' }));
    }

    return elements;
  };

  // ============================================
  // Export
  // ============================================

  async exportData(_options?: ExportOptions): Promise<ExportResult> {
    return {
      data: {
        instanceId: this.instanceId,
        restBaseUrl: this.restClient ? 'configured' : 'not configured',
      },
      format: 'json',
    };
  }

  // ============================================
  // Agent Lifecycle (REST)
  // ============================================

  private async handleCreateAgent(
    params: CreateAgentParams,
  ): Promise<
    ToolCallResult<{ instanceId: string; name: string; createdAt: string }>
  > {
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
      return {
        success: true,
        data: {
          instanceId: result.instanceId,
          name: params.name,
          createdAt: new Date().toISOString(),
        },
        summary: `[RuntimeControl] Created agent: ${params.name} (${result.instanceId})`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleDestroyAgent(
    params: DestroyAgentParams,
  ): Promise<ToolCallResult<{ success: boolean; destroyedCount: number }>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.destroyAgent(params.agentId, params.cascade);
      return {
        success: true,
        data: { success: true, destroyedCount: 1 },
        summary: `[RuntimeControl] Destroyed agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleStopAgent(
    params: StopAgentParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.stopAgent(params.agentId!);
      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeControl] Stopped agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleListAgents(
    params: ListAgentsParams,
  ): Promise<ToolCallResult<{ agents: any[] }>> {
    if (!this.restClient) return this.noClient<{ agents: any[] }>();

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
        summary: `[RuntimeControl] Listed ${list.length} agent(s)`,
      };
    } catch (error) {
      return this.restError<{ agents: any[] }>(error);
    }
  }

  private async handleGetAgent(
    params: GetAgentParams,
  ): Promise<ToolCallResult<any>> {
    if (!this.restClient) return this.noClient();

    try {
      const agent = await this.restClient.getAgent(params.agentId);
      return {
        success: true,
        data: agent,
        summary: `[RuntimeControl] Got agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleGetStats(): Promise<ToolCallResult<any>> {
    if (!this.restClient) return this.noClient();

    try {
      const stats = await this.restClient.getStats();
      return {
        success: true,
        data: stats,
        summary: '[RuntimeControl] Got runtime stats',
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleListChildAgents(): Promise<
    ToolCallResult<{ agents: any[] }>
  > {
    if (!this.restClient) return this.noClient<{ agents: any[] }>();

    try {
      const allAgents = await this.restClient.listAgents();
      const list = allAgents.data || allAgents;
      const myChildren = list.filter(
        (a: any) => a.parentInstanceId === this.instanceId,
      );
      return {
        success: true,
        data: { agents: myChildren },
        summary: `[RuntimeControl] Listed ${myChildren.length} child agent(s)`,
      };
    } catch (error) {
      return this.restError<{ agents: any[] }>(error);
    }
  }

  private async handleGetMyInfo(): Promise<
    ToolCallResult<{ instanceId: string }>
  > {
    return {
      success: true,
      data: { instanceId: this.instanceId },
      summary: `[RuntimeControl] Got agent info for: ${this.instanceId}`,
    };
  }

  // ============================================
  // Agent Souls (REST)
  // ============================================

  private async handleListAgentSouls(
    params: ListAgentSoulsParams,
  ): Promise<ToolCallResult<{ souls: any[] }>> {
    if (!this.restClient) return this.noClient<{ souls: any[] }>();

    try {
      const souls = await this.restClient.listAgentSouls();
      return {
        success: true,
        data: { souls: souls.data || souls },
        summary: `[RuntimeControl] Listed available agent soul(s)`,
      };
    } catch (error) {
      return this.restError<{ souls: any[] }>(error);
    }
  }

  private async handleCreateAgentByType(
    params: CreateAgentByTypeParams,
  ): Promise<
    ToolCallResult<{
      instanceId: string;
      alias: string;
      name: string;
      soulType: string;
      createdAt: string;
    }>
  > {
    if (!this.restClient) return this.noClient();

    try {
      const result = await this.restClient.createAgentBySoul(
        params.soulType,
        params.name,
        undefined,
        this.instanceId,
      );
      return {
        success: true,
        data: {
          instanceId: result.instanceId,
          alias: result.alias || result.instanceId,
          name: params.name || params.soulType,
          soulType: params.soulType,
          createdAt: new Date().toISOString(),
        },
        summary: `[RuntimeControl] Created ${params.name || params.soulType} (${result.instanceId})`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  // ============================================
  // Topology (REST)
  // ============================================

  private async handleRegisterInTopology(
    params: RegisterInTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
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
        summary: `[RuntimeControl] Registered ${params.agentId} as ${params.nodeType}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleUnregisterFromTopology(
    params: UnregisterFromTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.unregisterFromTopology(params.agentId);
      return {
        success: true,
        data: { success: true, instanceId: params.agentId },
        summary: `[RuntimeControl] Unregistered ${params.agentId} from topology`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleConnectAgents(
    params: ConnectAgentsParams,
  ): Promise<ToolCallResult<{ success: boolean; from: string; to: string }>> {
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
        summary: `[RuntimeControl] Connected ${params.from} -> ${params.to}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleDisconnectAgents(
    params: DisconnectAgentsParams,
  ): Promise<ToolCallResult<{ success: boolean; from: string; to: string }>> {
    if (!this.restClient) return this.noClient();

    try {
      await this.restClient.disconnectAgents(params.from, params.to);
      return {
        success: true,
        data: { success: true, from: params.from, to: params.to },
        summary: `[RuntimeControl] Disconnected ${params.from} -> ${params.to}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleGetTopologyInfo(): Promise<
    ToolCallResult<{
      nodes: any[];
      edges: any[];
      stats: any;
      size: { nodes: number; edges: number };
    }>
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
        summary: `[RuntimeControl] Topology: ${topology.nodes?.length || 0} nodes, ${topology.edges?.length || 0} edges`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  private async handleGetNeighbors(
    params: GetNeighborsParams,
  ): Promise<ToolCallResult<{ neighbors: any[] }>> {
    if (!this.restClient) return this.noClient<{ neighbors: any[] }>();

    try {
      const result = await this.restClient.getNeighbors(params.agentId);
      return {
        success: true,
        data: { neighbors: result.data || result },
        summary: `[RuntimeControl] Found neighbors for ${params.agentId}`,
      };
    } catch (error) {
      return this.restError<{ neighbors: any[] }>(error);
    }
  }

  // ============================================
  // Error Helpers
  // ============================================

  private noClient<T>(): ToolCallResult<T> {
    return {
      success: false,
      data: {
        error:
          'Runtime REST API not configured. Set runtimeControl.restBaseUrl in agent config.',
      } as unknown as T,
      summary: '[RuntimeControl] REST API not configured',
    };
  }

  private restError<T>(error: unknown): ToolCallResult<T> {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: { error: msg } as unknown as T,
      summary: `[RuntimeControl] Failed: ${msg}`,
    };
  }
}
