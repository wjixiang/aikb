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
  type StartAgentParams,
  type StopAgentParams,
  type ListAgentsParams,
  type GetAgentParams,
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

  private config: RuntimeControlComponentConfig;
  toolSet: Map<string, Tool>;

  constructor(config: RuntimeControlComponentConfig) {
    super();
    this.config = config;
    this.toolSet = this.initializeToolSet();
  }

  /**
   * Get the RuntimeControlClient via callback
   */
  private getRuntimeClient(): IRuntimeControlClient | undefined {
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
      ['startAgent', runtimeControlToolSchemas.startAgent],
      ['stopAgent', runtimeControlToolSchemas.stopAgent],
      ['listAgents', runtimeControlToolSchemas.listAgents],
      ['getAgent', runtimeControlToolSchemas.getAgent],
      ['getStats', runtimeControlToolSchemas.getStats],
      ['listChildAgents', runtimeControlToolSchemas.listChildAgents],
      ['getMyInfo', runtimeControlToolSchemas.getMyInfo],
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
        case 'startAgent':
          return await this.handleStartAgent(params as StartAgentParams);
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

    elements.push(
      new tdiv({ content: `Instance: ${client.getSelfInstanceId()}` }),
    );

    // Render Topology Info
    try {
      const graph = client.getTopologyGraph();
      const stats = client.getTopologyStats();
      const nodes = graph.getAllNodes();
      const edges = graph.getAllEdges();

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
              content: `  • ${node.instanceId} (${node.nodeType})${capabilities}`,
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
              content: `  ${edge.from} ${arrow} ${edge.to} (${edge.edgeType})`,
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
      await client.destroyAgent(params.instanceId, {
        cascade: params.cascade,
      });

      return {
        success: true,
        data: { success: true, destroyedCount: 1 },
        summary: `[RuntimeControl] Destroyed agent: ${params.instanceId}`,
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
   * Handle startAgent tool call
   */
  private async handleStartAgent(
    params: StartAgentParams,
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
      await client.startAgent(params.instanceId);
      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeControl] Started agent: ${params.instanceId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
        } as unknown as { success: boolean },
        summary: `[RuntimeControl] Failed to start agent: ${(error as Error).message}`,
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
      await client.stopAgent(params.instanceId);
      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeControl] Stopped agent: ${params.instanceId}`,
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
      const agent = await client.getAgent(params.instanceId);
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
        agents.find((a) => a.instanceId === params.instanceId) ?? null;

      return {
        success: true,
        data: metadata,
        summary: `[RuntimeControl] Got agent: ${params.instanceId}`,
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
        params.instanceId,
        params.nodeType,
        params.capabilities,
      );
      return {
        success: true,
        data: { success: true, instanceId: params.instanceId },
        summary: `[RuntimeControl] Registered ${params.instanceId} as ${params.nodeType}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          instanceId: params.instanceId,
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
      client.unregisterFromTopology(params.instanceId);
      return {
        success: true,
        data: { success: true, instanceId: params.instanceId },
        summary: `[RuntimeControl] Unregistered ${params.instanceId} from topology`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          error: (error as Error).message,
          success: false,
          instanceId: params.instanceId,
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
      const neighbors = graph.getNeighbors(params.instanceId);

      return {
        success: true,
        data: { neighbors },
        summary: `[RuntimeControl] Found ${neighbors.length} neighbors for ${params.instanceId}`,
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
