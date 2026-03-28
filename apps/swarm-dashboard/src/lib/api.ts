/**
 * API Configuration for Swarm Agent Runtime
 * @see http://192.168.123.98:9400/docs
 */

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://192.168.123.98:9400';

export const apiConfig = {
  baseUrl: BASE_URL,
  endpoints: {
    // Health
    health: `${BASE_URL}/health/`,
    healthReady: `${BASE_URL}/health/ready`,
    healthLive: `${BASE_URL}/health/live`,
    healthMetrics: `${BASE_URL}/health/metrics`,
    // Runtime
    runtimeStats: `${BASE_URL}/api/runtime/stats`,
    runtimeAgents: `${BASE_URL}/api/runtime/agents`,
    runtimeTopology: `${BASE_URL}/api/runtime/topology`,
    runtimeEdgeActivity: `${BASE_URL}/api/runtime/topology/edge-activity`,
    // Tasks
    tasks: `${BASE_URL}/api/tasks/`,
    taskStats: `${BASE_URL}/api/tasks/stats`,
  },
} as const;

// ========== Types ==========

export interface HealthResponse {
  status: string;
  service: string;
  serverId: string;
  timestamp: string;
  uptime?: number;
  message?: string;
}

export interface MetricsResponse {
  server: {
    id: string;
    port: number;
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    cpu: {
      usagePercent: number;
      cores: number;
      model: string;
      loadAvg: number[];
    };
    system: {
      hostname: string;
      platform: string;
      arch: string;
      totalMemory: number;
      freeMemory: number;
      usedMemory: number;
    };
    timestamp: string;
  };
  runtime: {
    agents: Record<string, { status: string; tasks: number }>;
    topology: { nodes: number; edges: number };
  } | null;
}

export interface RuntimeStatsResponse {
  success: boolean;
  data: {
    totalAgents: number;
    runningAgents: number;
    stoppedAgents: number;
    idleAgents: number;
  };
  count: number;
  serverId: string;
  error?: string;
}

export interface AgentInfo {
  instanceId: string;
  alias: string;
  status: 'running' | 'idle' | 'sleep' | 'completed' | 'aborted';
  name: string;
  agentType: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSoulInfo {
  token: string;
  name: string;
  type: string;
  description: string;
}

export interface TopologyNode {
  instanceId: string;
  nodeType?: string;
  capabilities?: string[];
}

export interface TopologyEdge {
  from: string;
  to: string;
  edgeType?: string;
}

export interface EdgeActivity {
  from: string;
  to: string;
  status: 'pending' | 'acknowledged' | 'completed' | 'failed';
  conversationCount: number;
  lastActivityAt: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  size: { nodes: number; edges: number };
}

export interface TaskStatsResponse {
  success: boolean;
  data: {
    total: number;
    byStatus: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    byPriority: {
      low: number;
      normal: number;
      high: number;
      urgent: number;
    };
  };
  error?: string;
}

export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type: string;
    text?: string;
    name?: string;
    id?: string;
    tool_use_id?: string;
    toolName?: string;
    is_error?: boolean;
    content?: string | unknown;
    thinking?: string;
  }>;
  ts?: number;
}

// ========== Lineage Types ==========

export interface LineageNodeDef {
  role: 'root' | 'router' | 'worker';
  soulToken: string;
  name?: string;
  description?: string;
  children?: LineageNodeDef[];
}

export interface LineageSchema {
  id: string;
  name: string;
  description?: string;
  root: LineageNodeDef;
}

export interface LineageSchemaSummary {
  id: string;
  name: string;
  description?: string;
  rootSoulToken: string;
  rootNodeRole: string;
  childCount: number;
}

export interface WorkspaceContextEntry {
  content: string;
  ts: number;
  iteration: number;
}

export interface AgentMemoryData {
  messages: MemoryMessage[];
  totalMessages: number;
  workspaceContextCount: number;
  config: {
    maxContextMessages?: number;
    maxWorkspaceContexts?: number;
    enableWorkspaceContext?: boolean;
  };
}

// ========== API Client ==========

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// ========== Convenience Methods ==========

export const api = {
  health: {
    get: () => apiFetch<HealthResponse>('/health/'),
    ready: () => apiFetch<HealthResponse>('/health/ready'),
    metrics: () => apiFetch<MetricsResponse>('/health/metrics'),
  },
  runtime: {
    stats: () => apiFetch<RuntimeStatsResponse>('/api/runtime/stats'),
    agents: (params?: { status?: string; type?: string; name?: string }) => {
      const query = new URLSearchParams(
        params as Record<string, string>,
      ).toString();
      return apiFetch<{ success: boolean; data: AgentInfo[]; count: number }>(
        `/api/runtime/agents${query ? `?${query}` : ''}`,
      );
    },
    topology: () =>
      apiFetch<{ success: boolean; data: TopologyData }>(
        '/api/runtime/topology',
      ),
    edgeActivity: () =>
      apiFetch<{ success: boolean; data: EdgeActivity[] }>(
        '/api/runtime/topology/edge-activity',
      ),
    agentSouls: () =>
      apiFetch<{ success: boolean; data: AgentSoulInfo[] }>(
        '/api/runtime/agent-souls',
      ),
    agent: (instanceId: string) =>
      apiFetch<{
        success: boolean;
        data: {
          instanceId: string;
          alias: string;
          status: string;
          name: string;
          type: string;
        };
      }>(`/api/agents/${instanceId}`),
    agentChildren: (instanceId: string) =>
      apiFetch<{
        success: boolean;
        data: AgentInfo[];
        count: number;
      }>(`/api/agents/${instanceId}/children`),
    startAgent: (instanceId: string) =>
      apiFetch<{
        success: boolean;
        data: { instanceId: string; status: string };
      }>(`/api/agents/${instanceId}/start`, { method: 'POST' }),
    stopAgent: (instanceId: string) =>
      apiFetch<{
        success: boolean;
        data: { instanceId: string; status: string };
      }>(`/api/agents/${instanceId}/stop`, { method: 'POST' }),
    destroyAgent: (instanceId: string) =>
      apiFetch<{
        success: boolean;
        data: { instanceId: string; status: string };
      }>(`/api/agents/${instanceId}`, { method: 'DELETE' }),
    agentMemory: (instanceId: string, limit = 50) =>
      apiFetch<{
        success: boolean;
        data: AgentMemoryData;
      }>(`/api/agents/${instanceId}/memory?limit=${limit}`),
    agentPrompt: (instanceId: string) =>
      apiFetch<{
        success: boolean;
        data: { instanceId: string; sop: string };
      }>(`/api/runtime/agents/${instanceId}/prompt`),
    agentWorkspaceContexts: (instanceId: string, limit = 50) =>
      apiFetch<{
        success: boolean;
        data: {
          contexts: WorkspaceContextEntry[];
          totalEntries: number;
        };
      }>(`/api/agents/${instanceId}/workspace-contexts?limit=${limit}`),
    lineages: () =>
      apiFetch<{
        success: boolean;
        data: LineageSchemaSummary[];
        count: number;
      }>('/api/runtime/lineages'),
    lineage: (id: string) =>
      apiFetch<{
        success: boolean;
        data: LineageSchema;
      }>(`/api/runtime/lineages/${id}`),
    instantiateLineage: (id: string, body?: { name?: string; sop?: string }) =>
      apiFetch<{
        success: boolean;
        data: { instanceId: string; status: string };
      }>(`/api/runtime/lineages/${id}/instantiate`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
  },
  tasks: {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams(
        params as Record<string, string>,
      ).toString();
      return apiFetch(`/api/tasks/${query ? `?${query}` : ''}`);
    },
    stats: () => apiFetch<TaskStatsResponse>('/api/tasks/stats'),
  },
};
