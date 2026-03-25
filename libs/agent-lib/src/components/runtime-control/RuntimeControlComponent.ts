/**
 * RuntimeControlComponent - ToolComponent for Agent creation and management
 *
 * This component provides tools that allow an Agent to create and manage
 * child Agents through the RuntimeControlClient.
 *
 * ## Usage
 *
 * The component is typically registered with the Agent and uses a callback
 * to access the RuntimeControlClient at runtime (since it's set after creation).
 *
 * @example
 * ```typescript
 * // In Agent initialization
 * this.runtimeControlComponent = new RuntimeControlComponent({
 *   instanceId: this.instanceId,
 *   getRuntimeClient: () => this._runtimeClient,
 * });
 *
 * // Agent can now create child agents via LLM tool calls
 * ```
 *
 * @module RuntimeControlComponent
 */

import {
  ToolComponent,
  ExportOptions,
  type ExportResult,
} from '../core/toolComponent.js';
import type { Tool, ToolCallResult } from '../core/types.js';
import type { TUIElement } from '../ui/TUIElement.js';
import { th, tdiv } from '../ui/index.js';
import type { RuntimeControlComponentConfig } from './types.js';
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
import type {
  IRuntimeControlClient,
  RuntimeStats,
  AgentMetadata,
  TopologyNode,
  TopologyEdge,
  RoutingStats,
} from '../../core/runtime/types.js';
import { agentSoulRegistry, createAgentSoulByType } from '../../core/index.js';

/**
 * RuntimeControlComponent - Provides tools for Agent lifecycle management
 *
 * This component wraps the RuntimeControlClient functionality into tools
 * that can be called by the LLM.
 */
export class RuntimeControlComponent extends ToolComponent {
  override componentId = 'runtime-control';
  override displayName = 'Runtime Control';
  override description = 'Create and manage child agents';
  override componentPrompt = `## Runtime Control

This component enables creation and management of child agents for distributed task processing.

**Workflow:**
1. Create child agents using createAgent when parallel processing is needed
2. Monitor agent status using listAgents and getAgent
3. Control agent lifecycle with stopAgent
4. Establish agent connections via registerInTopology and connectAgents

**Best Practices:**
- Use child agents for independent, parallel tasks
- Clean up agents when tasks complete via destroyAgent
- Register agents in topology for coordinated workflows`;

  private config: RuntimeControlComponentConfig;
  toolSet: Map<string, Tool>;

  constructor(config: RuntimeControlComponentConfig) {
    super();
    this.config = config;
    this.toolSet = this.initializeToolSet();
  }

  /**
   * Get the RuntimeControlClient via state or callback
   */
  private getRuntimeClient(): IRuntimeControlClient | undefined {
    if (this.config.state) {
      return this.config.state.getRuntimeClient();
    }
    return this.config.getRuntimeClient?.();
  }

  /**
   * Initialize the tool set
   */
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
      // Agent Soul tools
      ['listAgentSouls', runtimeControlToolSchemas.listAgentSouls],
      ['createAgentByType', runtimeControlToolSchemas.createAgentByType],
      // Topology tools
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

  /**
   * Handle tool calls from the LLM
   */
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
        // Agent Soul tools
        case 'listAgentSouls':
          return await this.handleListAgentSouls(
            params as ListAgentSoulsParams,
          );
        case 'createAgentByType':
          return await this.handleCreateAgentByType(
            params as CreateAgentByTypeParams,
          );
        // Topology tools
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

  /**
   * Render the tool section UI
   */
  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'Runtime Control - Agent Management',
        styles: { align: 'center' },
      }),
    );

    const client = this.getRuntimeClient();
    if (!client) {
      elements.push(new tdiv({ content: 'Runtime control not available' }));
      return elements;
    }

    const selfInstanceId = client.getSelfInstanceId();
    const allAgents = await client.listAgents();
    const selfAgent = allAgents.find((a) => a.instanceId === selfInstanceId);
    const selfDisplay = selfAgent?.alias || selfInstanceId.slice(0, 8);
    elements.push(new tdiv({ content: `Instance: ${selfDisplay}` }));

    // Render Topology Info
    try {
      const graph = client.getTopologyGraph();
      const stats = client.getTopologyStats();
      const nodes = graph.getAllNodes();
      const edges = graph.getAllEdges();

      // Get agent metadata to display aliases
      const agents = await client.listAgents();
      const instanceIdToAlias = new Map(
        agents.map((a) => [a.instanceId, a.alias]),
      );
      const instanceIdToName = new Map(
        agents.map((a) => [a.instanceId, a.name]),
      );

      const getDisplayId = (instanceId: string) => {
        const alias = instanceIdToAlias.get(instanceId);
        const name = instanceIdToName.get(instanceId);
        if (alias) {
          return name ? `${name} (${alias})` : alias;
        }
        return instanceId.slice(0, 8);
      };

      elements.push(
        new th({
          content: 'Topology Network',
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
          content: `Messages: ${stats.totalMessages} | Active: ${stats.activeConversations}`,
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
              content: `  • ${getDisplayId(node.instanceId)} (${node.nodeType})${capabilities}`,
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
              content: `  ${getDisplayId(edge.from)} ${arrow} ${getDisplayId(edge.to)} (${edge.edgeType})`,
            }),
          );
        }
      }
    } catch {
      elements.push(new tdiv({ content: 'Topology info not available' }));
    }

    return elements;
  };

  /**
   * Export component data
   */
  async exportData(_options?: ExportOptions): Promise<ExportResult> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        data: { error: 'Runtime control not available' },
        format: 'json',
      };
    }

    const agents = await client.listChildAgents();
    return {
      data: {
        myInstanceId: client.getSelfInstanceId(),
        childAgents: agents,
      },
      format: 'json',
    };
  }

  /**
   * Handle createAgent tool call
   */
  private async handleCreateAgent(
    params: CreateAgentParams,
  ): Promise<
    ToolCallResult<{ instanceId: string; name: string; createdAt: string }>
  > {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          instanceId: string;
          name: string;
          createdAt: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
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
      return {
        success: false,
        data: {
          instanceId: '',
          name: params.name,
          createdAt: '',
          error: (error as Error).message,
        } as unknown as { instanceId: string; name: string; createdAt: string },
        summary: `[RuntimeControl] Failed to create agent: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle destroyAgent tool call
   */
  private async handleDestroyAgent(
    params: DestroyAgentParams,
  ): Promise<ToolCallResult<{ success: boolean; destroyedCount: number }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          success: boolean;
          destroyedCount: number;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
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
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          destroyedCount: 0,
        } as unknown as { success: boolean; destroyedCount: number },
        summary: `[RuntimeControl] Failed to destroy agent: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle stopAgent tool call
   */
  private async handleStopAgent(
    params: StopAgentParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          success: boolean;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      await client.stopAgent(params.agentId!);
      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeControl] Stopped agent: ${params.agentId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
        } as unknown as { success: boolean },
        summary: `[RuntimeControl] Failed to stop agent: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle listAgents tool call
   */
  private async handleListAgents(
    params: ListAgentsParams,
  ): Promise<ToolCallResult<{ agents: AgentMetadata[] }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: {
          error: 'Runtime control not available',
          agents: [],
        } as unknown as { agents: AgentMetadata[] },
        summary: '[RuntimeControl] Runtime control not available',
      };
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
      return {
        success: false,
        data: { error: (error as Error).message, agents: [] } as unknown as {
          agents: AgentMetadata[];
        },
        summary: `[RuntimeControl] Failed to list agents: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle getAgent tool call
   */
  private async handleGetAgent(
    params: GetAgentParams,
  ): Promise<ToolCallResult<AgentMetadata | null>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: {
          error: 'Runtime control not available',
          agents: [],
        } as unknown as AgentMetadata | null,
        summary: '[RuntimeControl] Runtime control not available',
      };
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
      return {
        success: false,
        data: {
          error: (error as Error).message,
        } as unknown as AgentMetadata | null,
        summary: `[RuntimeControl] Failed to get agent: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle getStats tool call
   */
  private async handleGetStats(): Promise<ToolCallResult<RuntimeStats>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: {
          error: 'Runtime control not available',
        } as unknown as RuntimeStats,
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      const stats = await client.getStats();
      return {
        success: true,
        data: stats,
        summary: `[RuntimeControl] Got runtime stats`,
      };
    } catch (error) {
      return {
        success: false,
        data: { error: (error as Error).message } as unknown as RuntimeStats,
        summary: `[RuntimeControl] Failed to get stats: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle listChildAgents tool call
   */
  private async handleListChildAgents(): Promise<
    ToolCallResult<{ agents: AgentMetadata[] }>
  > {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: {
          error: 'Runtime control not available',
          agents: [],
        } as unknown as { agents: AgentMetadata[] },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      const agents = await client.listChildAgents();
      return {
        success: true,
        data: { agents },
        summary: `[RuntimeControl] Listed ${agents.length} child agent(s)`,
      };
    } catch (error) {
      return {
        success: false,
        data: { error: (error as Error).message, agents: [] } as unknown as {
          agents: AgentMetadata[];
        },
        summary: `[RuntimeControl] Failed to list child agents: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Handle getMyInfo tool call
   */
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
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          instanceId: string;
          parentInstanceId?: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
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
  // Agent Soul Tool Handlers
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
      return {
        success: false,
        data: {
          error: (error as Error).message,
          souls: [],
        } as unknown as {
          souls: Array<{
            type: string;
            name: string;
            description: string;
            capabilities: string[];
          }>;
        },
        summary: `[RuntimeControl] Failed to list agent souls: ${(error as Error).message}`,
      };
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
      return {
        success: false,
        data: {
          error: 'Runtime control not available',
          instanceId: '',
          alias: '',
          name: '',
          soulType: params.soulType,
          createdAt: '',
        } as unknown as {
          instanceId: string;
          alias: string;
          name: string;
          soulType: string;
          createdAt: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      const soulConfig = createAgentSoulByType(params.soulType as any);
      const agentConfig = soulConfig.agent;
      const name =
        params.name || agentConfig?.name || `${params.soulType} Agent`;

      const instanceId = await client.createAgent({
        agent: {
          name,
          type: params.soulType,
          description: agentConfig?.description,
          sop: agentConfig?.sop,
        },
      });

      const agents = await client.listAgents();
      const agent = agents.find((a) => a.instanceId === instanceId);

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
      return {
        success: false,
        data: {
          error: (error as Error).message,
          instanceId: '',
          alias: '',
          name: params.name || '',
          soulType: params.soulType,
          createdAt: '',
        } as unknown as {
          instanceId: string;
          alias: string;
          name: string;
          soulType: string;
          createdAt: string;
        },
        summary: `[RuntimeControl] Failed to create agent: ${(error as Error).message}`,
      };
    }
  }

  // ============================================
  // Topology Tool Handlers
  // ============================================

  private async handleRegisterInTopology(
    params: RegisterInTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          success: boolean;
          instanceId: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      client.registerInTopology(
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
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          instanceId: params.agentId,
        } as unknown as { success: boolean; instanceId: string },
        summary: `[RuntimeControl] Failed to register in topology: ${(error as Error).message}`,
      };
    }
  }

  private async handleUnregisterFromTopology(
    params: UnregisterFromTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          success: boolean;
          instanceId: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      client.unregisterFromTopology(params.agentId);
      return {
        success: true,
        data: { success: true, instanceId: params.agentId },
        summary: `[RuntimeControl] Unregistered ${params.agentId} from topology`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          instanceId: params.agentId,
        } as unknown as { success: boolean; instanceId: string },
        summary: `[RuntimeControl] Failed to unregister from topology: ${(error as Error).message}`,
      };
    }
  }

  private async handleConnectAgents(
    params: ConnectAgentsParams,
  ): Promise<ToolCallResult<{ success: boolean; from: string; to: string }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          success: boolean;
          from: string;
          to: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      client.connectAgents(params.from, params.to, params.edgeType);
      return {
        success: true,
        data: { success: true, from: params.from, to: params.to },
        summary: `[RuntimeControl] Connected ${params.from} -> ${params.to}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          from: params.from,
          to: params.to,
        } as unknown as { success: boolean; from: string; to: string },
        summary: `[RuntimeControl] Failed to connect agents: ${(error as Error).message}`,
      };
    }
  }

  private async handleDisconnectAgents(
    params: DisconnectAgentsParams,
  ): Promise<ToolCallResult<{ success: boolean; from: string; to: string }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          success: boolean;
          from: string;
          to: string;
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      client.disconnectAgents(params.from, params.to);
      return {
        success: true,
        data: { success: true, from: params.from, to: params.to },
        summary: `[RuntimeControl] Disconnected ${params.from} -> ${params.to}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          from: params.from,
          to: params.to,
        } as unknown as { success: boolean; from: string; to: string },
        summary: `[RuntimeControl] Failed to disconnect agents: ${(error as Error).message}`,
      };
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
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          nodes: TopologyNode[];
          edges: TopologyEdge[];
          stats: RoutingStats;
          size: { nodes: number; edges: number };
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      const graph = client.getTopologyGraph();
      const stats = client.getTopologyStats();
      const nodes = graph.getAllNodes();
      const edges = graph.getAllEdges();
      const size = graph.size;

      return {
        success: true,
        data: { nodes, edges, stats, size },
        summary: `[RuntimeControl] Topology: ${size.nodes} nodes, ${size.edges} edges`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
        } as unknown as {
          nodes: TopologyNode[];
          edges: TopologyEdge[];
          stats: RoutingStats;
          size: { nodes: number; edges: number };
        },
        summary: `[RuntimeControl] Failed to get topology info: ${(error as Error).message}`,
      };
    }
  }

  private async handleGetNeighbors(
    params: GetNeighborsParams,
  ): Promise<ToolCallResult<{ neighbors: TopologyNode[] }>> {
    const client = this.getRuntimeClient();
    if (!client) {
      return {
        success: false,
        data: { error: 'Runtime control not available' } as unknown as {
          neighbors: TopologyNode[];
        },
        summary: '[RuntimeControl] Runtime control not available',
      };
    }

    try {
      const graph = client.getTopologyGraph();
      const neighbors = graph.getNeighbors(params.agentId);

      return {
        success: true,
        data: { neighbors },
        summary: `[RuntimeControl] Found ${neighbors.length} neighbors for ${params.agentId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          neighbors: [],
        } as unknown as { neighbors: TopologyNode[] },
        summary: `[RuntimeControl] Failed to get neighbors: ${(error as Error).message}`,
      };
    }
  }
}
