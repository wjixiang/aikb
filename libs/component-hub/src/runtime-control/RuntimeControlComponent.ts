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
import { TYPES, RuntimeControlState } from 'agent-lib/core';
import type {
  IRuntimeControlClient,
  RuntimeStats,
  AgentMetadata,
  TopologyNode,
  TopologyEdge,
  RoutingStats,
} from 'agent-lib/core';
import { agentSoulRegistry, createAgentSoulByType } from 'agent-lib/core';
import {
  runtimeControlToolSchemas,
  type RuntimeControlToolName,
  type RuntimeControlToolReturnType,
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

@injectable()
export class RuntimeControlComponent extends ToolComponent {
  override componentId = 'runtime-control';
  override displayName = 'Runtime Control';
  override description = 'Create and manage child agents';
  override componentPrompt = `## Runtime Control

This component enables creation and management of child agents for distributed task processing.

**Agent Lifecycle (in-process via DI):**
1. Create child agents using createAgent or createAgentByType
2. Monitor agent status using listAgents and getAgent
3. Control agent lifecycle with stopAgent

**Topology Management (via REST API):**
4. Register agents in topology via registerInTopology
5. Connect agents via connectAgents
6. View topology via getTopologyInfo and getNeighbors

**Best Practices:**
- Use child agents for independent, parallel tasks
- Clean up agents when tasks complete via destroyAgent
- Register agents in topology for coordinated workflows`;

  protected instanceId: string;
  protected controlState: RuntimeControlState;
  protected restConfig?: RuntimeControlRESTConfig;
  protected restClient?: SwarmAPIClient;
  toolSet: Map<string, Tool>;

  constructor(
    @inject(TYPES.AgentInstanceId) instanceId: string,
    @inject(TYPES.RuntimeControlState) controlState: RuntimeControlState,
    @inject(TYPES.RuntimeControlRESTConfig)
    @optional()
    restConfig?: RuntimeControlRESTConfig,
  ) {
    super();
    this.instanceId = instanceId;
    this.controlState = controlState;
    this.restConfig = restConfig;
    if (restConfig?.restBaseUrl) {
      this.restClient = new SwarmAPIClient(
        restConfig.restBaseUrl,
        restConfig.apiKey,
      );
    }
    this.toolSet = this.initializeToolSet();
  }

  private getRuntimeClient(): IRuntimeControlClient | undefined {
    return this.controlState.getRuntimeClient();
  }

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    const toolEntries: [
      string,
      (typeof runtimeControlToolSchemas)[keyof typeof runtimeControlToolSchemas],
    ][] = [
      // Agent lifecycle tools (DI-based, in-process)
      ['createAgent', runtimeControlToolSchemas.createAgent],
      ['destroyAgent', runtimeControlToolSchemas.destroyAgent],
      ['stopAgent', runtimeControlToolSchemas.stopAgent],
      ['listAgents', runtimeControlToolSchemas.listAgents],
      ['getAgent', runtimeControlToolSchemas.getAgent],
      ['getStats', runtimeControlToolSchemas.getStats],
      ['listChildAgents', runtimeControlToolSchemas.listChildAgents],
      ['getMyInfo', runtimeControlToolSchemas.getMyInfo],
      // Agent Soul tools (DI-based, in-process)
      ['listAgentSouls', runtimeControlToolSchemas.listAgentSouls],
      ['createAgentByType', runtimeControlToolSchemas.createAgentByType],
      // Topology tools (REST-based, cross-container)
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
        // Agent lifecycle (DI)
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
        // Agent Soul (DI)
        case 'listAgentSouls':
          return await this.handleListAgentSouls(
            params as ListAgentSoulsParams,
          );
        case 'createAgentByType':
          return await this.handleCreateAgentByType(
            params as CreateAgentByTypeParams,
          );
        // Topology (REST)
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
        content: 'Runtime Control - Agent Management',
        styles: { align: 'center' },
      }),
    );

    // Agent info section (DI)
    const client = this.getRuntimeClient();
    if (client) {
      const selfInstanceId = client.getSelfInstanceId();
      const allAgents = await client.listAgents();
      const selfAgent = allAgents.find((a) => a.instanceId === selfInstanceId);
      const selfDisplay = selfAgent?.alias || selfInstanceId.slice(0, 8);
      elements.push(new tdiv({ content: `Instance: ${selfDisplay}` }));
    } else {
      elements.push(
        new tdiv({ content: `Instance: ${this.instanceId.slice(0, 8)}` }),
      );
    }

    // Topology section (REST)
    if (this.restClient) {
      try {
        const [topology, stats] = await Promise.all([
          this.restClient.getTopology(),
          this.restClient.getTopologyStats(),
        ]);

        const nodes: any[] = topology.nodes || [];
        const edges: any[] = topology.edges || [];

        elements.push(
          new th({
            content: 'Topology Network (via REST)',
            styles: { align: 'left' },
          }),
        );
        elements.push(
          new tdiv({
            content: `Nodes: ${nodes.length} | Edges: ${edges.length}`,
          }),
        );
        elements.push(
          new tdiv({
            content: `Messages: ${stats.totalMessages || 0} | Active: ${stats.activeConversations || 0}`,
          }),
        );

        if (nodes.length > 0) {
          elements.push(
            new th({
              content: 'Agents in Topology',
              styles: { align: 'left' },
            }),
          );
          for (const node of nodes) {
            const capabilities = node.capabilities?.length
              ? ` [${node.capabilities.join(', ')}]`
              : '';
            elements.push(
              new tdiv({
                content: `  • ${node.instanceId || node.id} (${node.nodeType || '?'})${capabilities}`,
              }),
            );
          }
        }

        if (edges.length > 0) {
          elements.push(
            new th({
              content: 'Connections',
              styles: { align: 'left' },
            }),
          );
          for (const edge of edges) {
            const arrow = edge.bidirectional ? '<->' : '->';
            elements.push(
              new tdiv({
                content: `  ${edge.from} ${arrow} ${edge.to} (${edge.edgeType || '?'})`,
              }),
            );
          }
        }
      } catch {
        elements.push(new tdiv({ content: 'Topology REST API not available' }));
      }
    } else {
      elements.push(
        new tdiv({
          content:
            'Topology: REST not configured (set runtimeControl.restBaseUrl)',
        }),
      );
    }

    return elements;
  };

  // ============================================
  // Export
  // ============================================

  async exportData(_options?: ExportOptions): Promise<ExportResult> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        data: {
          error: 'Runtime control not available',
          instanceId: this.instanceId,
          restBaseUrl: this.restConfig?.restBaseUrl,
        },
        format: 'json',
      };
    }

    const agents = await client.listChildAgents();
    return {
      data: {
        myInstanceId: client.getSelfInstanceId(),
        childAgents: agents,
        restBaseUrl: this.restConfig?.restBaseUrl,
      },
      format: 'json',
    };
  }

  // ============================================
  // Agent Lifecycle Tool Handlers (DI-based, in-process)
  // ============================================

  private async handleCreateAgent(
    params: CreateAgentParams,
  ): Promise<
    ToolCallResult<{ instanceId: string; name: string; createdAt: string }>
  > {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<{
        instanceId: string;
        name: string;
        createdAt: string;
      }>();
    }

    try {
      const instanceId = await client.createAgent({
        agent: {
          name: params.name,
          type: params.agentType,
          description: params.description,
          sop: params.sop,
        },
      });

      return {
        success: true,
        data: {
          instanceId,
          name: params.name,
          createdAt: new Date().toISOString(),
        },
        summary: `[RuntimeControl] Created agent: ${params.name} (${instanceId})`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleDestroyAgent(
    params: DestroyAgentParams,
  ): Promise<ToolCallResult<{ success: boolean; destroyedCount: number }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<{
        success: boolean;
        destroyedCount: number;
      }>();
    }

    try {
      await client.destroyAgent(params.agentId, {
        cascade: params.cascade,
      });
      return {
        success: true,
        data: { success: true, destroyedCount: 1 },
        summary: `[RuntimeControl] Destroyed agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleStopAgent(
    params: StopAgentParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<{ success: boolean }>();
    }

    try {
      await client.stopAgent(params.agentId!);
      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeControl] Stopped agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleListAgents(
    params: ListAgentsParams,
  ): Promise<ToolCallResult<{ agents: AgentMetadata[] }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<{ agents: AgentMetadata[] }>();
    }

    try {
      const agents = await client.listAgents({
        status: params.status as any,
        agentType: params.agentType,
        name: params.name,
      });
      return {
        success: true,
        data: { agents },
        summary: `[RuntimeControl] Listed ${agents.length} agent(s)`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleGetAgent(
    params: GetAgentParams,
  ): Promise<ToolCallResult<AgentMetadata | null>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<AgentMetadata | null>();
    }

    try {
      const agent = await client.getAgent(params.agentId);
      if (!agent) {
        return {
          success: false,
          data: {
            error: 'Agent not found or not accessible',
          } as unknown as AgentMetadata | null,
          summary: '[RuntimeControl] Agent not found or not accessible',
        };
      }

      const agents = await client.listAgents();
      const metadata =
        agents.find(
          (a) => a.instanceId === params.agentId || a.alias === params.agentId,
        ) ?? null;

      return {
        success: true,
        data: metadata,
        summary: `[RuntimeControl] Got agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleGetStats(): Promise<ToolCallResult<RuntimeStats>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<RuntimeStats>();
    }

    try {
      const stats = await client.getStats();
      return {
        success: true,
        data: stats,
        summary: `[RuntimeControl] Got runtime stats`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleListChildAgents(): Promise<
    ToolCallResult<{ agents: AgentMetadata[] }>
  > {
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<{ agents: AgentMetadata[] }>();
    }

    try {
      const agents = await client.listChildAgents();
      return {
        success: true,
        data: { agents },
        summary: `[RuntimeControl] Listed ${agents.length} child agent(s)`,
      };
    } catch (error) {
      return this.diError(error);
    }
  }

  private async handleGetMyInfo(): Promise<
    ToolCallResult<{
      instanceId: string;
      name?: string;
      agentType?: string;
      parentInstanceId?: string;
    }>
  > {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: true,
        data: { instanceId: this.instanceId },
        summary: `[RuntimeControl] Got agent info for: ${this.instanceId}`,
      };
    }

    const parentInstanceId = client.getParentInstanceId();

    return {
      success: true,
      data: {
        instanceId: client.getSelfInstanceId(),
        parentInstanceId,
      },
      summary: `[RuntimeControl] Got agent info for: ${client.getSelfInstanceId()}`,
    };
  }

  // ============================================
  // Agent Soul Tool Handlers (DI-based, in-process)
  // ============================================

  private async handleListAgentSouls(params: ListAgentSoulsParams): Promise<
    ToolCallResult<{
      souls: Array<{
        type: string;
        name: string;
        description: string;
        capabilities: string[];
      }>;
    }>
  > {
    try {
      let souls = agentSoulRegistry.getAll();

      if (params.capability) {
        souls = agentSoulRegistry.getByCapability(params.capability);
      }

      return {
        success: true,
        data: {
          souls: souls.map((s) => ({
            type: s.type,
            name: s.name,
            description: s.description,
            capabilities: s.capabilities,
          })),
        },
        summary: `[RuntimeControl] Listed ${souls.length} available agent soul(s)`,
      };
    } catch (error) {
      return this.diError(error);
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
    const client = this.getRuntimeClient();
    if (!client) {
      return this.noClientError<{
        instanceId: string;
        alias: string;
        name: string;
        soulType: string;
        createdAt: string;
      }>();
    }

    try {
      const soulConfig = createAgentSoulByType(params.soulType as any);
      const agentConfig = soulConfig.agent;
      const name =
        params.name || agentConfig?.name || `${params.soulType} Agent`;

      console.log(
        `[RuntimeControl] Creating agent by type: ${params.soulType}, name: ${name}, components: ${soulConfig.components?.length || 0}`,
      );

      const instanceId = await client.createAgent({
        agent: {
          name,
          type: params.soulType,
          description: agentConfig?.description,
          sop: agentConfig?.sop,
        },
        components: soulConfig.components,
      });

      console.log(
        `[RuntimeControl] Agent created with instanceId: ${instanceId}`,
      );

      const agents = await client.listAgents();
      const agent = agents.find((a) => a.instanceId === instanceId);

      console.log(
        `[RuntimeControl] Agent metadata found: ${agent ? `alias=${agent.alias}, name=${agent.name}` : 'NOT FOUND'}`,
      );
      console.log(
        `[RuntimeControl] Total agents in registry: ${agents.length}`,
      );

      return {
        success: true,
        data: {
          instanceId,
          alias: agent?.alias || instanceId,
          name,
          soulType: params.soulType,
          createdAt: new Date().toISOString(),
        },
        summary: `[RuntimeControl] Created ${name} (${agent?.alias || instanceId})`,
      };
    } catch (error) {
      console.error(
        `[RuntimeControl] Failed to create agent: ${(error as Error).message}`,
      );
      return this.diError(error);
    }
  }

  // ============================================
  // Topology Tool Handlers (REST-based, cross-container)
  // ============================================

  private async handleRegisterInTopology(
    params: RegisterInTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
    if (!this.restClient) {
      return this.noRestError<{
        success: boolean;
        instanceId: string;
      }>(params.agentId);
    }

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
    if (!this.restClient) {
      return this.noRestError<{
        success: boolean;
        instanceId: string;
      }>(params.agentId);
    }

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
    if (!this.restClient) {
      return this.noRestError<{
        success: boolean;
        from: string;
        to: string;
      }>(`${params.from} -> ${params.to}`);
    }

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
    if (!this.restClient) {
      return this.noRestError<{
        success: boolean;
        from: string;
        to: string;
      }>(`${params.from} -> ${params.to}`);
    }

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
      nodes: TopologyNode[];
      edges: TopologyEdge[];
      stats: RoutingStats;
      size: { nodes: number; edges: number };
    }>
  > {
    if (!this.restClient) {
      return this.noRestError<{
        nodes: TopologyNode[];
        edges: TopologyEdge[];
        stats: RoutingStats;
        size: { nodes: number; edges: number };
      }>();
    }

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
  ): Promise<ToolCallResult<{ neighbors: TopologyNode[] }>> {
    if (!this.restClient) {
      return this.noRestError<{ neighbors: TopologyNode[] }>(params.agentId);
    }

    try {
      const result = await this.restClient.getNeighbors(params.agentId);
      return {
        success: true,
        data: { neighbors: result.data || result },
        summary: `[RuntimeControl] Found neighbors for ${params.agentId}`,
      };
    } catch (error) {
      return this.restError(error);
    }
  }

  // ============================================
  // Error Helpers
  // ============================================

  private noClientError<T>(context?: string): ToolCallResult<T> {
    return {
      success: false,
      data: {
        error: 'Runtime control client not available',
        ...(context ? { context } : {}),
      } as unknown as T,
      summary: '[RuntimeControl] Runtime control client not available',
    };
  }

  private noRestError<T>(context?: string): ToolCallResult<T> {
    return {
      success: false,
      data: {
        error:
          'Topology REST API not configured. Set runtimeControl.restBaseUrl in agent config.',
        ...(context ? { context } : {}),
      } as unknown as T,
      summary: '[RuntimeControl] Topology REST API not configured',
    };
  }

  private diError<T>(error: unknown, context?: string): ToolCallResult<T> {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: {
        error: msg,
        ...(context ? { context } : {}),
      } as unknown as T,
      summary: `[RuntimeControl] Failed: ${msg}`,
    };
  }

  private restError<T>(error: unknown, context?: string): ToolCallResult<T> {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: {
        error: msg,
        ...(context ? { context } : {}),
      } as unknown as T,
      summary: `[RuntimeControl] REST API error: ${msg}`,
    };
  }
}
