/**
 * Task Routes - Task management API
 *
 * CRUD endpoints for managing runtime tasks
 */

import type { FastifyPluginAsync } from 'fastify';
import type {
  TaskFilter,
  CreateTaskInput,
  TaskStatus,
} from '../services/TaskService.js';
import {
  baseResponseSchema,
  taskFilterSchema,
  taskIdParamsSchema,
  createTaskBodySchema,
  deleteTasksBodySchema,
  taskListResponseSchema,
  taskStatsResponseSchema,
} from './schemas.js';

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Check if task service is available
  fastify.addHook('onRequest', async (request, reply) => {
    if (!fastify.taskService) {
      return reply.code(503).send({
        success: false,
        error:
          'Task persistence is disabled. Set AGENT_DATABASE_URL to enable.',
      });
    }
  });

  /**
   * GET /tasks - List all tasks with optional filtering
   */
  fastify.get(
    '/',
    {
      schema: {
        tags: ['tasks'],
        description: 'List all tasks with optional filtering',
        querystring: taskFilterSchema,
        response: {
          200: taskListResponseSchema,
          400: baseResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        status?: string;
        targetInstanceId?: string;
        priority?: string;
        limit?: number;
        offset?: number;
      };

      const filter: TaskFilter = {};
      if (query.status) filter.status = query.status as TaskStatus;
      if (query.targetInstanceId)
        filter.targetInstanceId = query.targetInstanceId;
      if (query.priority)
        filter.priority = query.priority as
          | 'low'
          | 'normal'
          | 'high'
          | 'urgent';
      if (query.limit !== undefined) filter.limit = query.limit;
      if (query.offset !== undefined) filter.offset = query.offset;

      const { tasks, total } = await fastify.taskService!.list(filter);
      return { success: true, data: tasks, total };
    },
  );

  /**
   * POST /tasks - Create a new task
   */
  fastify.post(
    '/',
    {
      schema: {
        tags: ['tasks'],
        description:
          'Create a new task (does not execute it, use /a2a/task for execution)',
        body: createTaskBodySchema,
        response: {
          201: baseResponseSchema,
          400: baseResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        description: string;
        targetInstanceId: string;
        input?: unknown;
        priority?: string;
      };

      const input: CreateTaskInput = {
        description: body.description,
        targetInstanceId: body.targetInstanceId,
      };
      if (body.input !== undefined) input.input = body.input;
      if (body.priority !== undefined) input.priority = body.priority as any;

      const task = await fastify.taskService!.create(input);
      return reply.code(201).send({ success: true, data: task });
    },
  );

  /**
   * GET /tasks/stats - Get task statistics
   */
  fastify.get(
    '/stats',
    {
      schema: {
        tags: ['tasks'],
        description: 'Get task statistics by status and priority',
        response: {
          200: taskStatsResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const stats = await fastify.taskService!.getStats();
      return { success: true, data: stats };
    },
  );

  /**
   * GET /tasks/:taskId - Get a specific task
   */
  fastify.get(
    '/:taskId',
    {
      schema: {
        tags: ['tasks'],
        description: 'Get details of a specific task',
        params: taskIdParamsSchema,
        response: {
          200: baseResponseSchema,
          400: baseResponseSchema,
          404: baseResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const task = await fastify.taskService!.getByTaskId(taskId);

      if (!task) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      return { success: true, data: task };
    },
  );

  /**
   * GET /tasks/:taskId/result - Get task result
   */
  fastify.get(
    '/:taskId/result',
    {
      schema: {
        tags: ['tasks'],
        description: 'Get the result of a completed task',
        params: taskIdParamsSchema,
        response: {
          200: baseResponseSchema,
          400: baseResponseSchema,
          404: baseResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const task = await fastify.taskService!.getByTaskId(taskId);

      if (!task) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      if (task.status === 'pending' || task.status === 'processing') {
        return reply.code(400).send({
          success: false,
          error: `Task is still ${task.status}`,
        });
      }

      if (task.status === 'failed') {
        return {
          success: false,
          data: {
            taskId: task.taskId,
            status: task.status,
            error: task.error,
          },
        };
      }

      return {
        success: true,
        data: {
          taskId: task.taskId,
          status: task.status,
          output: task.output,
        },
      };
    },
  );

  /**
   * DELETE /tasks/:taskId - Delete a task
   */
  fastify.delete(
    '/:taskId',
    {
      schema: {
        tags: ['tasks'],
        description: 'Delete a task',
        params: taskIdParamsSchema,
        response: {
          200: baseResponseSchema,
          400: baseResponseSchema,
          404: baseResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const deleted = await fastify.taskService!.delete(taskId);

      if (!deleted) {
        return reply.code(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      return { success: true, data: { taskId, deleted: true } };
    },
  );

  /**
   * DELETE /tasks - Delete multiple tasks
   */
  fastify.delete(
    '/',
    {
      schema: {
        tags: ['tasks'],
        description:
          'Delete multiple tasks by filter (e.g., all completed tasks)',
        body: deleteTasksBodySchema,
        response: {
          200: baseResponseSchema,
          400: baseResponseSchema,
          503: baseResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        status?: string;
        before?: string;
      };

      const filter: { status?: TaskStatus; before?: Date } = {};
      if (body.status !== undefined) filter.status = body.status as TaskStatus;
      if (body.before !== undefined) filter.before = new Date(body.before);

      const count = await fastify.taskService!.deleteMany(filter);
      return { success: true, data: { deleted: count } };
    },
  );
};
