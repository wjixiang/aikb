import { z } from 'zod';
import type { RuntimeStats } from 'agent-lib/core';
import type {
  CheckInboxParams,
  AcknowledgeTaskParams,
  CompleteTaskParams,
  FailTaskParams,
  SendTaskParams,
  SendQueryParams,
  CheckSentParams,
  CancelTaskParams,
  SentTaskInfo,
  IncomingTaskInfo,
} from './a2a/a2aTaskSchemas.js';
import {
  checkInboxParamsSchema,
  acknowledgeTaskParamsSchema,
  completeTaskParamsSchema,
  failTaskParamsSchema,
  sendTaskParamsSchema,
  sendQueryParamsSchema,
  checkSentParamsSchema,
  cancelTaskParamsSchema,
  discoverAgentsParamsSchema,
} from './a2a/a2aTaskSchemas.js';

export {
  checkInboxParamsSchema,
  acknowledgeTaskParamsSchema,
  completeTaskParamsSchema,
  failTaskParamsSchema,
  sendTaskParamsSchema,
  sendQueryParamsSchema,
  checkSentParamsSchema,
  cancelTaskParamsSchema,
} from './a2a/a2aTaskSchemas.js';

// =============================================================================
// Lifecycle tools — createAgentByType, startAgent, stopAgent, destroyAgent
// =============================================================================

export const createAgentByTypeParamsSchema = z.object({
  soulToken: z
    .string()
    .describe(
      'Token of agent soul to create (e.g., "epidemiology", "diagnosis"). Only allowed tokens listed in your lineage.',
    ),
  name: z
    .string()
    .optional()
    .describe('Optional custom name for the new agent'),
});

export type CreateAgentByTypeParams = z.infer<
  typeof createAgentByTypeParamsSchema
>;

export const startAgentParamsSchema = z.object({
  agentId: z
    .string()
    .describe('Agent instance ID or alias of the child agent to start'),
});

export type StartAgentParams = z.infer<typeof startAgentParamsSchema>;

export const stopAgentParamsSchema = z.object({
  agentId: z
    .string()
    .describe('Agent instance ID or alias of the child agent to stop'),
});

export type StopAgentParams = z.infer<typeof stopAgentParamsSchema>;

export const destroyAgentParamsSchema = z.object({
  agentId: z
    .string()
    .describe('Agent instance ID or alias of the child agent to destroy'),
  cascade: z
    .boolean()
    .optional()
    .default(true)
    .describe('Also destroy all descendant agents'),
});

export type DestroyAgentParams = z.infer<typeof destroyAgentParamsSchema>;

// =============================================================================
// Discovery tools — listChildAgents, listAllowedSouls, getMyInfo, getStats
// =============================================================================

export const listChildAgentsParamsSchema = z.object({});

export type ListChildAgentsParams = z.infer<typeof listChildAgentsParamsSchema>;

export const listAllowedSoulsParamsSchema = z.object({});

export type ListAllowedSoulsParams = z.infer<
  typeof listAllowedSoulsParamsSchema
>;

export const getMyInfoParamsSchema = z.object({});

export type GetMyInfoParams = z.infer<typeof getMyInfoParamsSchema>;

export const getStatsParamsSchema = z.object({});

export type GetStatsParams = z.infer<typeof getStatsParamsSchema>;

// =============================================================================
// Tool registry
// =============================================================================

export const lineageControlToolSchemas = {
  // INBOX (all roles)
  checkInbox: {
    toolName: 'checkInbox',
    desc: 'Check incoming tasks. Call this at the start of each turn.',
    paramsSchema: checkInboxParamsSchema,
  },
  acknowledgeTask: {
    toolName: 'acknowledgeTask',
    desc: 'Accept an incoming task. Always call this before processing.',
    paramsSchema: acknowledgeTaskParamsSchema,
  },
  completeTask: {
    toolName: 'completeTask',
    desc: 'Complete an incoming task and return the result.',
    paramsSchema: completeTaskParamsSchema,
  },
  failTask: {
    toolName: 'failTask',
    desc: 'Report that an incoming task has failed.',
    paramsSchema: failTaskParamsSchema,
  },

  // SENT (router only)
  sendTask: {
    toolName: 'sendTask',
    desc: 'Delegate a task to a child agent asynchronously.',
    paramsSchema: sendTaskParamsSchema,
  },
  sendQuery: {
    toolName: 'sendQuery',
    desc: 'Send a synchronous query to a child agent.',
    paramsSchema: sendQueryParamsSchema,
  },
  checkSent: {
    toolName: 'checkSent',
    desc: 'View status of all delegated tasks.',
    paramsSchema: checkSentParamsSchema,
  },
  cancelTask: {
    toolName: 'cancelTask',
    desc: 'Cancel an in-flight delegated task.',
    paramsSchema: cancelTaskParamsSchema,
  },

  // LIFECYCLE (router only)
  listChildAgents: {
    toolName: 'listChildAgents',
    desc: 'List your direct child agents.',
    paramsSchema: listChildAgentsParamsSchema,
  },
  createAgentByType: {
    toolName: 'createAgentByType',
    desc: 'Create a new child agent from an allowed soul token.',
    paramsSchema: createAgentByTypeParamsSchema,
  },
  startAgent: {
    toolName: 'startAgent',
    desc: 'Start a child agent.',
    paramsSchema: startAgentParamsSchema,
  },
  stopAgent: {
    toolName: 'stopAgent',
    desc: 'Stop a running child agent.',
    paramsSchema: stopAgentParamsSchema,
  },
  destroyAgent: {
    toolName: 'destroyAgent',
    desc: 'Destroy a child agent and its descendants.',
    paramsSchema: destroyAgentParamsSchema,
  },

  // DISCOVERY (router only)
  listAllowedSouls: {
    toolName: 'listAllowedSouls',
    desc: 'List the soul tokens you are allowed to create as children.',
    paramsSchema: listAllowedSoulsParamsSchema,
  },
  getMyInfo: {
    toolName: 'getMyInfo',
    desc: 'Get your own instance ID, role, and lineage info.',
    paramsSchema: getMyInfoParamsSchema,
  },
  getStats: {
    toolName: 'getStats',
    desc: 'Get runtime statistics.',
    paramsSchema: getStatsParamsSchema,
  },
  // DISCOVERY (no-lineage / router only)
  discoverAgents: {
    toolName: 'discoverAgents',
    desc: 'Discover available agents and their capabilities.',
    paramsSchema: discoverAgentsParamsSchema,
  },
} as const;

export type LineageControlToolName = keyof typeof lineageControlToolSchemas;

// =============================================================================
// Return types
// =============================================================================

export interface LineageControlToolReturnTypes {
  checkInbox: {
    pending: IncomingTaskInfo[];
    acknowledged: IncomingTaskInfo[];
    completed: IncomingTaskInfo[];
    failed: IncomingTaskInfo[];
    total: number;
  };
  acknowledgeTask: { success: boolean; conversationId: string };
  completeTask: { success: boolean; conversationId: string };
  failTask: { success: boolean; conversationId: string };
  sendTask: {
    success: boolean;
    conversationId: string;
    taskId: string;
    status: string;
    error?: string;
  };
  sendQuery: {
    success: boolean;
    from: string;
    output?: unknown;
    error?: string;
  };
  checkSent: {
    tasks: SentTaskInfo[];
    inFlightCount: number;
    completedCount: number;
    failedCount: number;
  };
  cancelTask: { success: boolean; conversationId: string };
  listChildAgents: {
    agents: Array<{
      instanceId: string;
      alias?: string;
      name?: string;
      status: string;
      agentType?: string;
    }>;
  };
  createAgentByType: {
    success: boolean;
    instanceId: string;
    name: string;
    soulToken: string;
  };
  startAgent: { success: boolean };
  stopAgent: { success: boolean };
  destroyAgent: { success: boolean };
  listAllowedSouls: {
    souls: Array<{
      soulToken: string;
      name?: string;
      description?: string;
    }>;
  };
  getMyInfo: {
    instanceId: string;
    role?: string;
    schemaId?: string;
    soulToken?: string;
    allowedChildren: Array<{ soulToken: string }>;
    parentInstanceId?: string;
  };
  getStats: RuntimeStats;
  discoverAgents: {
    agents: Array<{
      instanceId: string;
      alias?: string;
      name: string;
      capabilities: string[];
      skills: string[];
    }>;
    total: number;
  };
}

// Re-export A2A types for consumers
export type {
  CheckInboxParams,
  AcknowledgeTaskParams,
  CompleteTaskParams,
  FailTaskParams,
  SendTaskParams,
  SendQueryParams,
  CheckSentParams,
  CancelTaskParams,
  DiscoverAgentsParams,
  SentTaskInfo,
  IncomingTaskInfo,
} from './a2a/a2aTaskSchemas.js';
