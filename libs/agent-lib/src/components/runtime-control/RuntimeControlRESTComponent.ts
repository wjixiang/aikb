/**
 * RuntimeControlRESTClient - REST API client for swarm server
 *
 * Provides the same tool interface as RuntimeControlComponent but communicates
 * with the swarm server via REST API instead of direct DI injection.
 */

import 'reflect-metadata';
import {
  ToolComponent,
  ExportOptions,
  type ExportResult,
} from '../core/toolComponent.js';
import type { Tool, ToolCallResult } from '../core/types.js';
import type { TUIElement } from '../ui/TUIElement.js';
import { th, tdiv } from '../ui/index.js';
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

export interface RuntimeControlRESTConfig {
  instanceId: string;
  baseUrl: string;
  apiKey?: string;
}

class SwarmAPIClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data: any = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }
    return data.data;
  }

  getStats() {
    return this.request<any>('GET', '/api/runtime/stats');
  }
  listAgents(filter?: Record<string, string>) {
    const params = new URLSearchParams(filter).toString();
    return this.request<any>(
      'GET',
      `/api/runtime/agents${params ? `?${params}` : ''}`,
    );
  }
  getAgent(id: string) {
    return this.request<any>('GET', `/api/runtime/agents/${id}`);
  }
  createAgent(agent: Record<string, unknown>) {
    return this.request<any>('POST', '/api/runtime/agents', { agent });
  }
  destroyAgent(id: string, cascade?: boolean) {
    return this.request<any>(
      'DELETE',
      `/api/runtime/agents/${id}?cascade=${cascade ?? true}`,
    );
  }
  stopAgent(id: string) {
    return this.request<any>('POST', `/api/runtime/agents/${id}/stop`);
  }
  startAgent(id: string) {
    return this.request<any>('POST', `/api/runtime/agents/${id}/start`);
  }
  getTopology() {
    return this.request<any>('GET', '/api/runtime/topology');
  }
  getTopologyStats() {
    return this.request<any>('GET', '/api/runtime/topology/stats');
  }
  listAgentSouls() {
    return this.request<any>('GET', '/api/runtime/agent-souls');
  }
  createAgentBySoul(token: string, alias?: string, api?: unknown) {
    return this.request<any>('POST', '/api/runtime/agent-souls', {
      token,
      alias,
      api,
    });
  }
}

export class RuntimeControlRESTComponent extends ToolComponent {
  override componentId = 'runtime-control';
  override displayName = 'Runtime Control';
  override description = 'Create and manage child agents via REST API';
  override componentPrompt = `## Runtime Control

This component enables creation and management of child agents for distributed task processing via REST API.

**Workflow:**
 1. Create child agents using createAgent or createAgentByType when parallel processing is needed
 2. Monitor agent status using listAgents and getAgent
 3. Control agent lifecycle with stopAgent
 4. Use getTopologyInfo to view the agent network

**Best Practices:**
- Use child agents for independent, parallel tasks
- Clean up agents when tasks complete via destroyAgent`;

  private config: RuntimeControlRESTConfig;
  private api: SwarmAPIClient;
  toolSet: Map<string, Tool>;

  constructor(config: RuntimeControlRESTConfig) {
    super();
    this.config = config;
    this.api = new SwarmAPIClient(config.baseUrl, config.apiKey);
    this.toolSet = this.initializeToolSet();
  }

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();
    const entries: [
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
    entries.forEach(([name, toolDef]) => {
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

  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];
    elements.push(
      new th({
        content: 'Runtime Control (REST)',
        styles: { align: 'center' },
      }),
    );
    try {
      const stats = await this.api.getStats();
      elements.push(
        new tdiv({
          content: `Instance: ${this.config.instanceId.slice(0, 8)}`,
        }),
      );
      elements.push(new tdiv({ content: `Agents: ${stats.totalAgents || 0}` }));
    } catch {
      elements.push(new tdiv({ content: 'Runtime API not available' }));
    }
    return elements;
  };

  async exportData(_options?: ExportOptions): Promise<ExportResult> {
    return {
      data: {
        myInstanceId: this.config.instanceId,
        baseUrl: this.config.baseUrl,
      },
      format: 'json',
    };
  }

  private async handleCreateAgent(
    params: CreateAgentParams,
  ): Promise<
    ToolCallResult<{ instanceId: string; name: string; createdAt: string }>
  > {
    try {
      const result = await this.api.createAgent({
        name: params.name,
        type: params.agentType,
        description: params.description,
        sop: params.sop,
      });
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
      return this.errorResult<{
        instanceId: string;
        name: string;
        createdAt: string;
      }>(error, params.name);
    }
  }

  private async handleDestroyAgent(
    params: DestroyAgentParams,
  ): Promise<ToolCallResult<{ success: boolean; destroyedCount: number }>> {
    try {
      await this.api.destroyAgent(params.agentId, params.cascade);
      return {
        success: true,
        data: { success: true, destroyedCount: 1 },
        summary: `[RuntimeControl] Destroyed agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.errorResult<{ success: boolean; destroyedCount: number }>(
        error,
      );
    }
  }

  private async handleStopAgent(
    params: StopAgentParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    try {
      await this.api.stopAgent(params.agentId!);
      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeControl] Stopped agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.errorResult<{ success: boolean }>(error);
    }
  }

  private async handleListAgents(
    params: ListAgentsParams,
  ): Promise<ToolCallResult<{ agents: any[] }>> {
    try {
      const filter: Record<string, string> = {};
      if (params.status) filter['status'] = params.status;
      if (params.agentType) filter['type'] = params.agentType;
      if (params.name) filter['name'] = params.name;
      const agents = await this.api.listAgents(filter);
      const list = agents.data || agents;
      return {
        success: true,
        data: { agents: list },
        summary: `[RuntimeControl] Listed ${list.length} agent(s)`,
      };
    } catch (error) {
      return this.errorResult<{ agents: any[] }>(error);
    }
  }

  private async handleGetAgent(
    params: GetAgentParams,
  ): Promise<ToolCallResult<any>> {
    try {
      const agent = await this.api.getAgent(params.agentId);
      return {
        success: true,
        data: agent,
        summary: `[RuntimeControl] Got agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.errorResult<any>(error);
    }
  }

  private async handleGetStats(): Promise<ToolCallResult<any>> {
    try {
      const stats = await this.api.getStats();
      return {
        success: true,
        data: stats,
        summary: '[RuntimeControl] Got runtime stats',
      };
    } catch (error) {
      return this.errorResult<any>(error);
    }
  }

  private async handleListChildAgents(): Promise<
    ToolCallResult<{ agents: any[] }>
  > {
    try {
      const allAgents = await this.api.listAgents();
      const list = allAgents.data || allAgents;
      const myChildren = list.filter(
        (a: any) => a.parentInstanceId === this.config.instanceId,
      );
      return {
        success: true,
        data: { agents: myChildren },
        summary: `[RuntimeControl] Listed ${myChildren.length} child agent(s)`,
      };
    } catch (error) {
      return this.errorResult<{ agents: any[] }>(error);
    }
  }

  private async handleGetMyInfo(): Promise<
    ToolCallResult<{ instanceId: string }>
  > {
    return {
      success: true,
      data: { instanceId: this.config.instanceId },
      summary: `[RuntimeControl] Got agent info for: ${this.config.instanceId}`,
    };
  }

  private async handleListAgentSouls(
    params: ListAgentSoulsParams,
  ): Promise<ToolCallResult<{ souls: any[] }>> {
    try {
      const souls = await this.api.listAgentSouls();
      return {
        success: true,
        data: { souls: souls.data || souls },
        summary: `[RuntimeControl] Listed available agent soul(s)`,
      };
    } catch (error) {
      return this.errorResult<{ souls: any[] }>(error);
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
    try {
      const result = await this.api.createAgentBySoul(
        params.soulType,
        params.name,
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
      return this.errorResult<{
        instanceId: string;
        alias: string;
        name: string;
        soulType: string;
        createdAt: string;
      }>(error);
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
    try {
      const [topology, stats] = await Promise.all([
        this.api.getTopology(),
        this.api.getTopologyStats(),
      ]);
      return {
        success: true,
        data: {
          nodes: topology.nodes || [],
          edges: topology.edges || [],
          stats,
          size: {
            nodes: topology.size || 0,
            edges: topology.edges?.length || 0,
          },
        },
        summary: `[RuntimeControl] Topology: ${topology.nodes?.length || 0} nodes`,
      };
    } catch (error) {
      return this.errorResult<{
        nodes: any[];
        edges: any[];
        stats: any;
        size: { nodes: number; edges: number };
      }>(error);
    }
  }

  private async handleRegisterInTopology(
    params: RegisterInTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
    return {
      success: false,
      data: {
        error: 'Topology registration via API not yet implemented',
        success: false,
        instanceId: params.agentId,
      } as any,
      summary: '[RuntimeControl] Topology registration not implemented',
    };
  }

  private async handleUnregisterFromTopology(
    params: UnregisterFromTopologyParams,
  ): Promise<ToolCallResult<{ success: boolean; instanceId: string }>> {
    return {
      success: false,
      data: {
        error: 'Topology unregistration via API not yet implemented',
        success: false,
        instanceId: params.agentId,
      } as any,
      summary: '[RuntimeControl] Topology unregistration not implemented',
    };
  }

  private async handleConnectAgents(
    params: ConnectAgentsParams,
  ): Promise<ToolCallResult<{ success: boolean; from: string; to: string }>> {
    return {
      success: false,
      data: {
        error: 'Topology connection via API not yet implemented',
        success: false,
        from: params.from,
        to: params.to,
      } as any,
      summary: '[RuntimeControl] Topology connection not implemented',
    };
  }

  private async handleDisconnectAgents(
    params: DisconnectAgentsParams,
  ): Promise<ToolCallResult<{ success: boolean; from: string; to: string }>> {
    return {
      success: false,
      data: {
        error: 'Topology disconnection via API not yet implemented',
        success: false,
        from: params.from,
        to: params.to,
      } as any,
      summary: '[RuntimeControl] Topology disconnection not implemented',
    };
  }

  private async handleGetNeighbors(
    params: GetNeighborsParams,
  ): Promise<ToolCallResult<{ neighbors: any[] }>> {
    return {
      success: false,
      data: {
        error: 'Get neighbors via API not yet implemented',
        neighbors: [],
      } as any,
      summary: '[RuntimeControl] Get neighbors not implemented',
    };
  }

  private errorResult<T>(error: unknown, context?: string): ToolCallResult<T> {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: { error: msg, ...(context ? { context } : {}) } as unknown as T,
      summary: `[RuntimeControl] Failed: ${msg}`,
    };
  }
}
