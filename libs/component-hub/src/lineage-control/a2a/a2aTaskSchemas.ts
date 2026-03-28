import { z } from 'zod';

export const checkInboxParamsSchema = z.object({}).passthrough();

export type CheckInboxParams = z.infer<typeof checkInboxParamsSchema>;

export const acknowledgeTaskParamsSchema = z.object({
  conversationId: z
    .string()
    .describe(
      'Conversation ID (e.g., "conv_1234567890_abc123") — obtained from checkInbox',
    ),
});

export type AcknowledgeTaskParams = z.infer<typeof acknowledgeTaskParamsSchema>;

export const completeTaskParamsSchema = z.object({
  conversationId: z
    .string()
    .describe('Conversation ID of the task to complete'),
  output: z.unknown().describe('Task output/result data'),
});

export type CompleteTaskParams = z.infer<typeof completeTaskParamsSchema>;

export const failTaskParamsSchema = z.object({
  conversationId: z.string().describe('Conversation ID of the task to fail'),
  error: z.string().describe('Error message describing why the task failed'),
});

export type FailTaskParams = z.infer<typeof failTaskParamsSchema>;

export const sendTaskParamsSchema = z.object({
  targetAgentId: z
    .string()
    .describe(
      'Agent ID or alias of the target agent (use discoverAgents to find)',
    ),
  taskId: z.string().describe('Unique task identifier for this delegation'),
  description: z
    .string()
    .describe('Clear description of the task to be performed'),
  input: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe('Input data for the task'),
  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .optional()
    .default('normal')
    .describe('Task priority'),
});

export type SendTaskParams = z.infer<typeof sendTaskParamsSchema>;

export const sendQueryParamsSchema = z.object({
  targetAgentId: z
    .string()
    .describe('Agent ID or alias to query (use discoverAgents to find)'),
  query: z
    .string()
    .describe('The question or query to send to the target agent'),
});

export type SendQueryParams = z.infer<typeof sendQueryParamsSchema>;

export const checkSentParamsSchema = z.object({}).passthrough();

export type CheckSentParams = z.infer<typeof checkSentParamsSchema>;

export const waitForResultParamsSchema = z.object({
  conversationId: z
    .string()
    .describe(
      'Conversation ID of the sent task to wait for. Obtained from sendTask or checkSent result.',
    ),
});

export type WaitForResultParams = z.infer<typeof waitForResultParamsSchema>;

export const cancelTaskParamsSchema = z.object({
  conversationId: z
    .string()
    .describe('Conversation ID of the in-flight task to cancel'),
});

export type CancelTaskParams = z.infer<typeof cancelTaskParamsSchema>;

export const discoverAgentsParamsSchema = z.object({
  capability: z
    .string()
    .optional()
    .describe(
      'Filter by capability (e.g., "search", "analysis", "mail"). Returns all agents if not specified.',
    ),
  skill: z
    .string()
    .optional()
    .describe('Filter by specific skill. Returns all agents if not specified.'),
});

export type DiscoverAgentsParams = z.infer<typeof discoverAgentsParamsSchema>;

export interface SentTaskInfo {
  taskId: string;
  conversationId: string;
  targetAgentId: string;
  targetAgentName?: string;
  description: string;
  status: 'in-flight' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  resultSummary?: string;
  error?: string;
  sentAt: number;
  acknowledgedAt?: number;
  completedAt?: number;
  cancelledAt?: number;
}

export interface IncomingTaskInfo {
  conversationId: string;
  from: string;
  fromAgentName?: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'acknowledged' | 'completed' | 'failed';
  receivedAt: number;
  acknowledgedAt?: number;
  completedAt?: number;
  resultSummary?: string;
  error?: string;
}

export const a2aTaskToolSchemas = {
  checkInbox: {
    toolName: 'checkInbox',
    desc: 'Check incoming tasks (inbox). Call this at the start of each turn to see new tasks, acknowledged tasks, and completed tasks from other agents.',
    paramsSchema: checkInboxParamsSchema,
  },
  acknowledgeTask: {
    toolName: 'acknowledgeTask',
    desc: 'Accept an incoming task from another agent. This tells the sender you have received the task and are processing it. Always call this before starting work on a task.',
    paramsSchema: acknowledgeTaskParamsSchema,
  },
  completeTask: {
    toolName: 'completeTask',
    desc: 'Complete an incoming task and send the result back to the requesting agent.',
    paramsSchema: completeTaskParamsSchema,
  },
  failTask: {
    toolName: 'failTask',
    desc: 'Report that an incoming task has failed, with an error message explaining why.',
    paramsSchema: failTaskParamsSchema,
  },
  sendTask: {
    toolName: 'sendTask',
    desc: 'Delegate a task to another agent asynchronously. The agent ACKs immediately and processes in the background. Use checkSent or waitForResult to track progress.',
    paramsSchema: sendTaskParamsSchema,
  },
  sendQuery: {
    toolName: 'sendQuery',
    desc: 'Send a lightweight synchronous query to another agent and wait for the response. Use this for simple questions that expect a quick answer, as opposed to sendTask which is for longer-running work.',
    paramsSchema: sendQueryParamsSchema,
  },
  checkSent: {
    toolName: 'checkSent',
    desc: 'View the status of all tasks you have delegated to other agents. Shows in-flight, completed, failed, and cancelled tasks.',
    paramsSchema: checkSentParamsSchema,
  },
  waitForResult: {
    toolName: 'waitForResult',
    desc: 'Sleep and wait for the result of a previously sent task. The agent will automatically wake up when the result arrives. Use this when you need the result before proceeding.',
    paramsSchema: waitForResultParamsSchema,
  },
  cancelTask: {
    toolName: 'cancelTask',
    desc: 'Cancel an in-flight task that you previously sent to another agent.',
    paramsSchema: cancelTaskParamsSchema,
  },
  discoverAgents: {
    toolName: 'discoverAgents',
    desc: 'Discover available agents and their capabilities. Use this to find which agents can handle specific tasks before sending.',
    paramsSchema: discoverAgentsParamsSchema,
  },
} as const;

export type A2ATaskToolName = keyof typeof a2aTaskToolSchemas;

export interface A2ATaskToolReturnTypes {
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
  waitForResult: {
    success: boolean;
    conversationId: string;
    resultSummary?: string;
    error?: string;
  };
  cancelTask: { success: boolean; conversationId: string };
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

export type A2ATaskToolReturnType<T extends A2ATaskToolName> =
  A2ATaskToolReturnTypes[T];
