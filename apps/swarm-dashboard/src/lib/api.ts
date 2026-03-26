/**
 * API Configuration for Swarm Agent Runtime
 * @see http://192.168.123.98:9400/docs
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://192.168.123.98:9400'

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
    // Tasks
    tasks: `${BASE_URL}/api/tasks/`,
    taskStats: `${BASE_URL}/api/tasks/stats`,
  },
} as const

// ========== Types ==========

export interface HealthResponse {
  status: string
  service: string
  serverId: string
  timestamp: string
  uptime?: number
  message?: string
}

export interface MetricsResponse {
  server: {
    id: string
    port: number
    uptime: number
    memory: {
      rss: number
      heapTotal: number
      heapUsed: number
      external: number
      arrayBuffers: number
    }
    cpu: {
      usagePercent: number
      cores: number
      model: string
      loadAvg: number[]
    }
    system: {
      hostname: string
      platform: string
      arch: string
      totalMemory: number
      freeMemory: number
      usedMemory: number
    }
    timestamp: string
  }
  runtime: {
    agents: Record<string, { status: string; tasks: number }>
    topology: { nodes: number; edges: number }
  } | null
}

export interface RuntimeStatsResponse {
  success: boolean
  data: {
    totalAgents: number
    runningAgents: number
    stoppedAgents: number
    idleAgents: number
  }
  count: number
  serverId: string
  error?: string
}

export interface AgentInfo {
  instanceId: string
  alias: string
  status: 'running' | 'stopped' | 'idle'
  name: string
  agentType: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface AgentSoulInfo {
  token: string
  name: string
  type: string
  description: string
}

export interface TopologyNode {
  instanceId: string
  nodeType?: string
  capabilities?: string[]
}

export interface TopologyEdge {
  from: string
  to: string
  edgeType?: string
}

export interface TopologyData {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  size: { nodes: number; edges: number }
}

export interface TaskStatsResponse {
  success: boolean
  data: {
    total: number
    byStatus: {
      pending: number
      processing: number
      completed: number
      failed: number
    }
    byPriority: {
      low: number
      normal: number
      high: number
      urgent: number
    }
  }
  error?: string
}

// ========== API Client ==========

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new Error(error.message || `API Error: ${response.status}`)
  }

  return response.json()
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
      const query = new URLSearchParams(params as Record<string, string>).toString()
      return apiFetch<{ success: boolean; data: AgentInfo[]; count: number }>(
        `/api/runtime/agents${query ? `?${query}` : ''}`
      )
    },
    topology: () => apiFetch<{ success: boolean; data: TopologyData }>('/api/runtime/topology'),
    agentSouls: () => apiFetch<{ success: boolean; data: AgentSoulInfo[] }>('/api/runtime/agent-souls'),
  },
  tasks: {
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString()
      return apiFetch(`/api/tasks/${query ? `?${query}` : ''}`)
    },
    stats: () => apiFetch<TaskStatsResponse>('/api/tasks/stats'),
  },
}
