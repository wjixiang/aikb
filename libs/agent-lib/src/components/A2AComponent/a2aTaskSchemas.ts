import { z } from 'zod';

/**
 * Schema for acknowledging a task
 */
export const acknowledgeTaskParamsSchema = z.object({
  conversationId: z
    .string()
    .describe('Conversation ID of the task to acknowledge'),
});

export type AcknowledgeTaskParams = z.infer<typeof acknowledgeTaskParamsSchema>;

/**
 * Schema for completing a task with result
 */
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

/**
 * Schema for failing a task
 */
export const failTaskParamsSchema = z.object({
  conversationId: z.string().describe('Conversation ID of the task to fail'),
  error: z.string().describe('Error message describing why the task failed'),
});

export type FailTaskParams = z.infer<typeof failTaskParamsSchema>;

/**
 * Schema for sending task result
 */
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

/**
 * Schema for getting pending tasks
 */
export const getPendingTasksParamsSchema = z.object({});

export type GetPendingTasksParams = z.infer<typeof getPendingTasksParamsSchema>;

/**
 * Tool schema definitions
 */
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
} as const;

export type A2ATaskToolName = keyof typeof a2aTaskToolSchemas;

/**
 * Return types for each tool
 */
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
}

export type A2ATaskToolReturnType<T extends A2ATaskToolName> =
  A2ATaskToolReturnTypes[T];
