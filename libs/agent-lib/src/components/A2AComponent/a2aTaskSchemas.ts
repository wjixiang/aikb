import { z } from 'zod';
import type { A2ATaskResult } from '../../core/a2a/types.js';

export const acknowledgeTaskParamsSchema = z.object({
  conversationId: z
    .string()
    .describe(
      'Conversation ID (e.g., "conv_1234567890_abc123") - MUST be obtained from getPendingTasks, NOT guessed',
    ),
});

export type AcknowledgeTaskParams = z.infer<typeof acknowledgeTaskParamsSchema>;

export const completeTaskParamsSchema = z.object({
  conversationId: z
    .string()
    .describe('Conversation ID of the task to complete'),
  output: z.unknown().describe('Task output/result data'),
  status: z
    .enum(['completed', 'failed', 'processing'])
    .optional()
    .default('completed')
    .describe('Task status'),
});

export type CompleteTaskParams = z.infer<typeof completeTaskParamsSchema>;

export const failTaskParamsSchema = z.object({
  conversationId: z.string().describe('Conversation ID of the task to fail'),
  error: z.string().describe('Error message describing why the task failed'),
});

export type FailTaskParams = z.infer<typeof failTaskParamsSchema>;

export const sendTaskResultParamsSchema = z.object({
  conversationId: z.string().describe('Conversation ID of the task'),
  output: z.unknown().describe('Task output/result data'),
  status: z
    .enum(['completed', 'failed', 'processing'])
    .optional()
    .default('completed')
    .describe('Task status'),
  error: z.string().optional().describe('Error message if status is failed'),
});

export type SendTaskResultParams = z.infer<typeof sendTaskResultParamsSchema>;

export const getPendingTasksParamsSchema = z
  .object({
    _placeholder: z
      .string()
      .optional()
      .describe('Internal parameter, always use empty object {}'),
  })
  .passthrough();

export type GetPendingTasksParams = z.infer<typeof getPendingTasksParamsSchema>;

export const sendTaskParamsSchema = z.object({
  targetAgentId: z
    .string()
    .describe('Agent ID of the target agent to send the task to'),
  taskId: z.string().describe('Unique task identifier'),
  description: z.string().describe('Description of the task'),
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

export const getSentTasksParamsSchema = z
  .object({
    _placeholder: z
      .string()
      .optional()
      .describe('Internal parameter, always use empty object {}'),
  })
  .passthrough();

export type GetSentTasksParams = z.infer<typeof getSentTasksParamsSchema>;

interface SentTaskInfo {
  taskId: string;
  conversationId: string;
  targetAgentId: string;
  description: string;
  status: 'in-flight' | 'completed' | 'failed' | 'timeout';
  result?: A2ATaskResult;
  error?: string;
  sentAt: number;
  completedAt?: number;
}

export type { SentTaskInfo };

export const a2aTaskToolSchemas = {
  acknowledgeTask: {
    toolName: 'acknowledgeTask',
    desc: 'Acknowledge receipt of an A2A task. Call this when you have received a task and are ready to process it.',
    paramsSchema: acknowledgeTaskParamsSchema,
  },
  completeTask: {
    toolName: 'completeTask',
    desc: 'Mark an A2A task as completed with output data.',
    paramsSchema: completeTaskParamsSchema,
  },
  failTask: {
    toolName: 'failTask',
    desc: 'Mark an A2A task as failed with an error message.',
    paramsSchema: failTaskParamsSchema,
  },
  sendTaskResult: {
    toolName: 'sendTaskResult',
    desc: 'Send the result of an A2A task with optional error.',
    paramsSchema: sendTaskResultParamsSchema,
  },
  getPendingTasks: {
    toolName: 'getPendingTasks',
    desc: 'Get all pending A2A tasks awaiting acknowledgment or response.',
    paramsSchema: getPendingTasksParamsSchema,
  },
  sendTask: {
    toolName: 'sendTask',
    desc: 'Send a task to another agent asynchronously. Returns immediately after ACK with conversationId. Task result is tracked in the background - use getSentTasks to check status.',
    paramsSchema: sendTaskParamsSchema,
  },
  getSentTasks: {
    toolName: 'getSentTasks',
    desc: 'Get the status of all sent tasks. Includes in-flight, completed, and failed tasks.',
    paramsSchema: getSentTasksParamsSchema,
  },
} as const;

export type A2ATaskToolName = keyof typeof a2aTaskToolSchemas;

export interface A2ATaskToolReturnTypes {
  acknowledgeTask: { success: boolean; conversationId: string };
  completeTask: { success: boolean; conversationId: string };
  failTask: { success: boolean; conversationId: string };
  sendTaskResult: { success: boolean; conversationId: string };
  getPendingTasks: {
    tasks: Array<{
      conversationId: string;
      messageId: string;
      messageType: string;
      from: string;
      payload: {
        taskId?: string;
        description?: string;
        input?: Record<string, unknown>;
      };
      receivedAt: number;
    }>;
  };
  sendTask: {
    success: boolean;
    conversationId: string;
    taskId: string;
    status: string;
    error?: string;
  };
  getSentTasks: {
    tasks: SentTaskInfo[];
  };
}

export type A2ATaskToolReturnType<T extends A2ATaskToolName> =
  A2ATaskToolReturnTypes[T];
