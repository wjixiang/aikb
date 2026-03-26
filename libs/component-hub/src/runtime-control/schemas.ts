import { z } from 'zod';
import type {
  AgentMetadata,
  RuntimeStats,
  TopologyNode,
  TopologyEdge,
  RoutingStats,
} from 'agent-lib/core';

/**
 * Schema for creating an agent via tool call
 */
export const createAgentParamsSchema = z.object({
  name: z.string().min(1).describe('Name for the new agent'),
  agentType: z.string().min(1).describe('Type/category of the agent'),
  description: z.string().optional().describe('Description of the agent role'),
  sop: z
    .string()
    .optional()
    .describe('Standard operating procedure/prompt for the agent'),
  maxChildAgents: z
    .number()
    .int()
    .min(-1)
    .optional()
    .describe('Maximum child agents this agent can create (-1 for unlimited)'),
});

export type CreateAgentParams = z.infer<typeof createAgentParamsSchema>;

/**
 * Schema for listing available agent souls
 */
export const listAgentSoulsParamsSchema = z.object({
  capability: z
    .string()
    .optional()
    .describe(
      'Filter by capability (e.g., "literature-search", "paper-analysis")',
    ),
});

export type ListAgentSoulsParams = z.infer<typeof listAgentSoulsParamsSchema>;

/**
 * Schema for creating an agent by soul type
 */
export const createAgentByTypeParamsSchema = z.object({
  soulType: z
    .string()
    .describe(
      'Type of agent soul to create (e.g., "epidemiology", "pathophysiology", "diagnosis", etc.)',
    ),
  name: z.string().optional().describe('Optional custom name for the agent'),
});

export type CreateAgentByTypeParams = z.infer<
  typeof createAgentByTypeParamsSchema
>;

/**
 * Schema for destroying an agent via tool call
 */
export const destroyAgentParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
    cascade: z
      .boolean()
      .optional()
      .default(true)
      .describe('Also destroy child agents'),
  })
  .transform((data) => ({
    agentId: (data.agentId || data.instanceId) as string,
    cascade: data.cascade,
  }));

export type DestroyAgentParams = z.infer<typeof destroyAgentParamsSchema>;

/**
 * Schema for starting an agent via tool call
 */
export const startAgentParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
  })
  .transform((data) => ({
    agentId: (data.agentId || data.instanceId) as string,
  }));

export type StartAgentParams = z.infer<typeof startAgentParamsSchema>;

/**
 * Schema for stopping an agent via tool call
 */
export const stopAgentParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
  })
  .transform((data) => ({
    agentId: data.agentId || data.instanceId,
  }));

export type StopAgentParams = z.infer<typeof stopAgentParamsSchema>;

/**
 * Schema for listing agents via tool call
 */
export const listAgentsParamsSchema = z.object({
  status: z
    .enum(['idle', 'running', 'completed', 'aborted'])
    .optional()
    .describe('Filter by status'),
  agentType: z.string().optional().describe('Filter by agent type'),
  name: z.string().optional().describe('Filter by name (partial match)'),
});

export type ListAgentsParams = z.infer<typeof listAgentsParamsSchema>;

/**
 * Schema for getting agent info via tool call
 */
export const getAgentParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
  })
  .transform((data) => ({
    agentId: (data.agentId || data.instanceId) as string,
  }));

export type GetAgentParams = z.infer<typeof getAgentParamsSchema>;

/**
 * Schema for registering agent in topology
 */
export const registerInTopologyParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
    nodeType: z
      .enum(['router', 'worker', 'hybrid'])
      .describe('Type of node in topology'),
    capabilities: z
      .array(z.string())
      .optional()
      .describe('List of capabilities this agent has'),
  })
  .transform((data) => ({
    agentId: (data.agentId || data.instanceId) as string,
    nodeType: data.nodeType,
    capabilities: data.capabilities,
  }));

export type RegisterInTopologyParams = z.infer<
  typeof registerInTopologyParamsSchema
>;

/**
 * Schema for unregistering agent from topology
 */
export const unregisterFromTopologyParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
  })
  .transform((data) => ({
    agentId: (data.agentId || data.instanceId) as string,
  }));

export type UnregisterFromTopologyParams = z.infer<
  typeof unregisterFromTopologyParamsSchema
>;

/**
 * Schema for connecting agents in topology
 */
export const connectAgentsParamsSchema = z.object({
  from: z.string().describe('Source agent ID, alias, or name'),
  to: z.string().describe('Target agent ID, alias, or name'),
  edgeType: z
    .enum(['parent-child', 'peer', 'route'])
    .optional()
    .describe('Type of connection'),
});

export type ConnectAgentsParams = z.infer<typeof connectAgentsParamsSchema>;

/**
 * Schema for disconnecting agents in topology
 */
export const disconnectAgentsParamsSchema = z.object({
  from: z.string().describe('Source agent ID, alias, or name'),
  to: z.string().describe('Target agent ID, alias, or name'),
});

export type DisconnectAgentsParams = z.infer<
  typeof disconnectAgentsParamsSchema
>;

/**
 * Schema for getting topology info
 */
export const getTopologyInfoParamsSchema = z.object({});

export type GetTopologyInfoParams = z.infer<typeof getTopologyInfoParamsSchema>;

/**
 * Schema for getting neighbors in topology
 */
export const getNeighborsParamsSchema = z
  .object({
    agentId: z
      .string()
      .optional()
      .describe('Agent ID, alias, or name (e.g., "epidemiology-a1b2")'),
    instanceId: z
      .string()
      .optional()
      .describe('Deprecated: use agentId instead'),
  })
  .transform((data) => ({
    agentId: (data.agentId || data.instanceId) as string,
  }));

export type GetNeighborsParams = z.infer<typeof getNeighborsParamsSchema>;

/**
 * Tool schema definitions
 */
export const runtimeControlToolSchemas = {
  createAgent: {
    toolName: 'createAgent',
    desc: 'Create a new child agent. Use this when you need to delegate tasks to specialized agents.',
    paramsSchema: createAgentParamsSchema,
  },
  destroyAgent: {
    toolName: 'destroyAgent',
    desc: 'Destroy a child agent and optionally its descendants. Use with caution.',
    paramsSchema: destroyAgentParamsSchema,
  },
  startAgent: {
    toolName: 'startAgent',
    desc: 'Start an idle child agent',
    paramsSchema: startAgentParamsSchema,
  },
  stopAgent: {
    toolName: 'stopAgent',
    desc: 'Stop a running child agent',
    paramsSchema: stopAgentParamsSchema,
  },
  listAgents: {
    toolName: 'listAgents',
    desc: 'List all child agents you have created',
    paramsSchema: listAgentsParamsSchema,
  },
  getAgent: {
    toolName: 'getAgent',
    desc: 'Get details about a specific child agent',
    paramsSchema: getAgentParamsSchema,
  },
  getStats: {
    toolName: 'getStats',
    desc: 'Get runtime statistics',
    paramsSchema: z.object({}),
  },
  listChildAgents: {
    toolName: 'listChildAgents',
    desc: 'List all direct child agents',
    paramsSchema: z.object({}),
  },
  getMyInfo: {
    toolName: 'getMyInfo',
    desc: 'Get information about this agent (its own instanceId, permissions, etc.)',
    paramsSchema: z.object({}),
  },
  // Agent Soul tools
  listAgentSouls: {
    toolName: 'listAgentSouls',
    desc: 'List all available agent soul types that can be created. Use this to discover what specialized agents are available.',
    paramsSchema: listAgentSoulsParamsSchema,
  },
  createAgentByType: {
    toolName: 'createAgentByType',
    desc: 'Create a new child agent using a predefined soul type (e.g., "epidemiology", "pathophysiology"). Use this for specialized literature search tasks.',
    paramsSchema: createAgentByTypeParamsSchema,
  },
  // Topology tools
  registerInTopology: {
    toolName: 'registerInTopology',
    desc: 'Register an agent in the topology network with a specific role',
    paramsSchema: registerInTopologyParamsSchema,
  },
  unregisterFromTopology: {
    toolName: 'unregisterFromTopology',
    desc: 'Remove an agent from the topology network',
    paramsSchema: unregisterFromTopologyParamsSchema,
  },
  connectAgents: {
    toolName: 'connectAgents',
    desc: 'Create a connection between two agents in the topology',
    paramsSchema: connectAgentsParamsSchema,
  },
  disconnectAgents: {
    toolName: 'disconnectAgents',
    desc: 'Remove a connection between two agents in the topology',
    paramsSchema: disconnectAgentsParamsSchema,
  },
  getTopologyInfo: {
    toolName: 'getTopologyInfo',
    desc: 'Get information about the current topology network',
    paramsSchema: getTopologyInfoParamsSchema,
  },
  getNeighbors: {
    toolName: 'getNeighbors',
    desc: 'Get all neighbors of an agent in the topology',
    paramsSchema: getNeighborsParamsSchema,
  },
} as const;

export type RuntimeControlToolName = keyof typeof runtimeControlToolSchemas;

/**
 * Return types for each tool
 */
export interface RuntimeControlToolReturnTypes {
  createAgent: { instanceId: string; name: string; createdAt: string };
  destroyAgent: { success: boolean; destroyedCount: number };
  startAgent: { success: boolean; alias?: string };
  stopAgent: { success: boolean };
  listAgents: { agents: AgentMetadata[] };
  getAgent: AgentMetadata | null;
  getStats: RuntimeStats;
  listChildAgents: { agents: AgentMetadata[] };
  getMyInfo: {
    instanceId: string;
    name?: string;
    agentType?: string;
    parentInstanceId?: string;
  };
  // Agent Soul tools
  listAgentSouls: {
    souls: Array<{
      type: string;
      name: string;
      description: string;
      capabilities: string[];
    }>;
  };
  createAgentByType: {
    instanceId: string;
    alias: string;
    name: string;
    soulType: string;
    createdAt: string;
  };
  // Topology tools
  registerInTopology: { success: boolean; instanceId: string };
  unregisterFromTopology: { success: boolean; instanceId: string };
  connectAgents: { success: boolean; from: string; to: string };
  disconnectAgents: { success: boolean; from: string; to: string };
  getTopologyInfo: {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    stats: RoutingStats;
    size: { nodes: number; edges: number };
  };
  getNeighbors: { neighbors: TopologyNode[] };
}

export type RuntimeControlToolReturnType<T extends RuntimeControlToolName> =
  RuntimeControlToolReturnTypes[T];
