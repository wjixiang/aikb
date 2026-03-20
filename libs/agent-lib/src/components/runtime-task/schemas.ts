import { z } from 'zod';
import type { RuntimeTask } from './types.js';

export const getPendingTasksParamsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum number of tasks to return'),
});

export type GetPendingTasksParams = z.infer<typeof getPendingTasksParamsSchema>;

export const getTaskByIdParamsSchema = z.object({
  taskId: z.string().describe('Task ID to retrieve'),
});

export type GetTaskByIdParams = z.infer<typeof getTaskByIdParamsSchema>;

export const reportTaskResultParamsSchema = z.object({
  taskId: z.string().describe('Task ID to report result for'),
  success: z.boolean().describe('Whether the task succeeded'),
  output: z.any().optional().describe('Task output data'),
  error: z.string().optional().describe('Error message if task failed'),
});

export type ReportTaskResultParams = z.infer<
  typeof reportTaskResultParamsSchema
>;

export const sendTaskToExpertParamsSchema = z.object({
  receiverExpertId: z.string().describe('Expert ID to send the task to'),
  description: z.string().describe('Task description'),
  input: z.any().optional().describe('Task input data'),
  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .optional()
    .describe('Task priority'),
});

export type SendTaskToExpertParams = z.infer<
  typeof sendTaskToExpertParamsSchema
>;

export const markTaskProcessingParamsSchema = z.object({
  taskId: z.string().describe('Task ID to mark as processing'),
});

export type MarkTaskProcessingParams = z.infer<
  typeof markTaskProcessingParamsSchema
>;

export const runtimeTaskToolSchemas = {
  getPendingTasks: {
    toolName: 'getPendingTasks',
    desc: 'Get pending tasks for this Expert',
    paramsSchema: getPendingTasksParamsSchema,
  },
  getTaskById: {
    toolName: 'getTaskById',
    desc: 'Get task details by ID',
    paramsSchema: getTaskByIdParamsSchema,
  },
  reportTaskResult: {
    toolName: 'reportTaskResult',
    desc: 'Report task completion result',
    paramsSchema: reportTaskResultParamsSchema,
  },
  sendTaskToExpert: {
    toolName: 'sendTaskToExpert',
    desc: 'Send a task to another Expert',
    paramsSchema: sendTaskToExpertParamsSchema,
  },
  markTaskProcessing: {
    toolName: 'markTaskProcessing',
    desc: 'Mark a task as processing',
    paramsSchema: markTaskProcessingParamsSchema,
  },
};

export type RuntimeTaskToolName = keyof typeof runtimeTaskToolSchemas;

export interface RuntimeTaskToolReturnTypes {
  getPendingTasks: { tasks: RuntimeTask[] };
  getTaskById: RuntimeTask;
  reportTaskResult: { success: boolean };
  sendTaskToExpert: { taskId: string };
  markTaskProcessing: { success: boolean };
}

export type ToolReturnType<T extends RuntimeTaskToolName> =
  RuntimeTaskToolReturnTypes[T];
