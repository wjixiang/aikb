/**
 * A2A Routes
 *
 * HTTP API for Agent-to-Agent communication.
 */

import type { FastifyPluginAsync } from 'fastify';

const SERVER_INSTANCE_ID = 'swarm-server';

const a2aResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
    count: { type: 'number' },
    error: { type: 'string' },
  },
};

const a2aArrayResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    count: { type: 'number' },
    error: { type: 'string' },
  },
};

// New schema: taskId OR targetInstanceId is required
const executeTaskBodySchema = {
  type: 'object',
  properties: {
    taskId: {
      type: 'string',
      description:
        '[Conditional] ID of the task to execute (must exist in task database). Required if targetInstanceId not provided.',
    },
    targetInstanceId: {
      type: 'string',
      description:
        '[Conditional] Target agent instance ID to send task directly. Required if taskId not provided.',
    },
    taskDescription: {
      type: 'string',
      description:
        '[Required*] Task description. Required when using targetInstanceId.',
    },
    taskInput: {
      type: 'object',
      description: '[Optional] Task input data object',
    },
    priority: {
      type: 'string',
      enum: ['low', 'normal', 'high', 'urgent'],
      description: '[Optional] Task priority (default: normal)',
    },
    ackTimeout: {
      type: 'number',
      description: '[Optional] ACK timeout in ms (overrides server default)',
    },
    resultTimeout: {
      type: 'number',
      description: '[Optional] Result timeout in ms (overrides server default)',
    },
  },
};

const queryBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'query'],
  properties: {
    targetAgentId: {
      type: 'string',
      description: '[Required] Target agent instance ID or alias',
    },
    query: {
      type: 'string',
      description: '[Required] Query string to send to agent',
    },
    expectedFormat: {
      type: 'string',
      description: '[Optional] Expected response format (e.g., json, text)',
    },
  },
};

const eventBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'eventType'],
  properties: {
    targetAgentId: {
      type: 'string',
      description: '[Required] Target agent instance ID or alias',
    },
    eventType: {
      type: 'string',
      description: '[Required] Type of event to send',
    },
    data: {
      type: 'object',
      description: '[Optional] Event payload data',
    },
  },
};

export const a2aRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/task',
    {
      schema: {
        tags: ['a2a'],
        description:
          'Execute a task. Either provide taskId (task must exist in database) ' +
          'or provide targetInstanceId with taskDescription to send directly.',
        body: executeTaskBodySchema,
        response: {
          200: a2aResponseSchema,
          400: a2aResponseSchema,
          404: a2aResponseSchema,
          503: a2aResponseSchema,
        },
      } as any,
    },
    async (request, reply) => {
      const {
        taskId,
        targetInstanceId,
        taskDescription,
        taskInput,
        priority,
        ackTimeout,
        resultTimeout,
      } = request.body as {
        taskId?: string;
        targetInstanceId?: string;
        taskDescription?: string;
        taskInput?: Record<string, unknown>;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        ackTimeout?: number;
        resultTimeout?: number;
      };

      let resolvedTargetId: string;
      let resolvedTaskId: string;
      let resolvedDescription: string;
      let resolvedInput: Record<string, unknown>;
      let resolvedPriority: 'low' | 'normal' | 'high' | 'urgent' =
        priority ?? 'normal';

      // Mode 1: Use taskId - fetch from database
      if (taskId) {
        if (!fastify.taskService) {
          return reply.code(503).send({
            success: false,
            error:
              'Task persistence is disabled. Cannot use taskId. Use targetInstanceId instead.',
          });
        }

        const task = await fastify.taskService.getByTaskId(taskId);

        if (!task) {
          return reply.code(404).send({
            success: false,
            error: `Task not found: ${taskId}. Create it first via POST /api/tasks`,
          });
        }

        if (task.status === 'processing') {
          return reply.code(400).send({
            success: false,
            error: `Task ${taskId} is already being processed`,
          });
        }

        if (task.status === 'completed') {
          return reply.code(400).send({
            success: false,
            error: `Task ${taskId} has already been completed. Use GET /api/tasks/${taskId}/result to get the result.`,
          });
        }

        await fastify.taskService.markProcessing(taskId);
        resolvedTargetId = fastify.agentRuntime.resolveAgentId(
          task.targetInstanceId,
        );
        resolvedTaskId = task.taskId;
        resolvedDescription = task.description;
        resolvedInput = (task.input as Record<string, unknown>) ?? {};
        resolvedPriority =
          (task.priority as 'low' | 'normal' | 'high' | 'urgent') ?? 'normal';

        // Mode 2: Use targetInstanceId directly
      } else if (targetInstanceId) {
        if (!taskDescription) {
          return reply.code(400).send({
            success: false,
            error: 'taskDescription is required when using targetInstanceId',
          });
        }
        resolvedTargetId =
          fastify.agentRuntime.resolveAgentId(targetInstanceId);
        resolvedTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        resolvedDescription = taskDescription;
        resolvedInput = taskInput ?? {};
      } else {
        return reply.code(400).send({
          success: false,
          error: 'Either taskId or targetInstanceId is required',
        });
      }

      const client = fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);

      const options: {
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        ackTimeout?: number;
        resultTimeout?: number;
      } = {
        priority: resolvedPriority,
      };
      if (ackTimeout !== undefined) options.ackTimeout = ackTimeout;
      if (resultTimeout !== undefined) options.resultTimeout = resultTimeout;

      try {
        const result = await client.sendA2ATask(
          resolvedTargetId,
          resolvedTaskId,
          resolvedDescription,
          resolvedInput,
          options,
        );

        if (taskId && fastify.taskService) {
          await fastify.taskService.markCompleted(taskId, result);
        }

        return { success: true, data: result };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (taskId && fastify.taskService) {
          await fastify.taskService.markFailed(taskId, errorMessage);
        }

        return reply.code(400).send({
          success: false,
          error: errorMessage,
        });
      }
    },
  );

  fastify.post(
    '/query',
    {
      schema: {
        tags: ['a2a'],
        description:
          'Send a synchronous query to another agent and wait for response',
        body: queryBodySchema,
        response: { 200: a2aResponseSchema, 400: a2aResponseSchema },
      } as any,
    },
    async (request, reply) => {
      const { targetAgentId, query, expectedFormat } = request.body as {
        targetAgentId: string;
        query: string;
        expectedFormat?: string;
      };
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(targetAgentId);
        const client =
          fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);
        const result = await client.sendA2AQuery(
          resolvedId,
          query,
          expectedFormat ? { expectedFormat } : undefined,
        );
        return { success: true, data: result };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.post(
    '/event',
    {
      schema: {
        tags: ['a2a'],
        description: 'Send an event notification to another agent',
        body: eventBodySchema,
        response: { 200: a2aResponseSchema, 400: a2aResponseSchema },
      } as any,
    },
    async (request, reply) => {
      const { targetAgentId, eventType, data } = request.body as {
        targetAgentId: string;
        eventType: string;
        data?: unknown;
      };
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(targetAgentId);
        const client =
          fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);
        await client.sendA2AEvent(resolvedId, eventType, data);
        return { success: true, data: { message: 'Event sent successfully' } };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/conversations',
    {
      schema: {
        tags: ['a2a'],
        description: 'List all agent-to-agent conversations',
        response: { 200: a2aArrayResponseSchema },
      } as any,
    },
    async (request, reply) => {
      return { success: true, data: [], count: 0 };
    },
  );

  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['a2a'],
        description: 'Get details of a specific conversation',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Conversation ID' },
          },
        },
        response: { 200: a2aResponseSchema, 404: a2aResponseSchema },
      } as any,
    },
    async (request, reply) => {
      return reply
        .code(404)
        .send({ success: false, error: 'Conversation not found' });
    },
  );
};
