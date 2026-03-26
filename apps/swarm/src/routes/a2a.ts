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

// New schema: taskId required, returns 202 after ACK received
const executeTaskBodySchema = {
  type: 'object',
  properties: {
    taskId: {
      type: 'string',
      description:
        '[Required] ID of the task to execute (must exist in task database).',
    },
    taskInput: {
      type: 'object',
      description: '[Optional] Task input data object (overrides task input)',
    },
    priority: {
      type: 'string',
      enum: ['low', 'normal', 'high', 'urgent'],
      description: '[Optional] Task priority (default: from task)',
    },
    ackTimeout: {
      type: 'number',
      description: '[Optional] ACK timeout in ms (default: 60000)',
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
          'Execute a task. Returns 202 immediately after ACK is received. Poll GET /api/tasks/{taskId} for status.',
        body: executeTaskBodySchema,
        response: {
          200: a2aResponseSchema,
          202: a2aResponseSchema,
          400: a2aResponseSchema,
          404: a2aResponseSchema,
          408: a2aResponseSchema,
          503: a2aResponseSchema,
        },
      } as any,
    },
    async (request, reply) => {
      const { taskId, taskInput, priority, ackTimeout } = request.body as {
        taskId?: string;
        taskInput?: Record<string, unknown>;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        ackTimeout?: number;
      };

      if (!taskId) {
        return reply.code(400).send({
          success: false,
          error: 'taskId is required',
        });
      }

      if (!fastify.taskService) {
        return reply.code(503).send({
          success: false,
          error: 'Task persistence is disabled. Cannot use taskId.',
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

      const resolvedTargetId = fastify.agentRuntime.resolveAgentId(
        task.targetInstanceId,
      );
      const resolvedTaskId = task.taskId;
      const resolvedDescription = task.description;
      const resolvedInput =
        taskInput ?? (task.input as Record<string, unknown>) ?? {};
      const resolvedPriority =
        priority ??
        (task.priority as 'low' | 'normal' | 'high' | 'urgent') ??
        'normal';

      try {
        // Use A2AClient to send task and wait for ACK only
        const client =
          fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);

        console.log(
          `[A2A] Sending task ${resolvedTaskId} to ${resolvedTargetId}, waiting for ACK...`,
        );
        const conversationId = await client.sendA2ATaskAndWaitForAck(
          resolvedTargetId,
          resolvedTaskId,
          resolvedDescription,
          resolvedInput,
          { priority: resolvedPriority },
        );
        console.log(
          `[A2A] ACK received for task ${resolvedTaskId}, conversationId: ${conversationId}`,
        );

        // Register conversation-task mapping for event callbacks
        fastify.agentRuntime.registerConversationTask(
          conversationId,
          task.taskId, // user-facing taskId (task_xxx) - used by TaskService lookups
          task.taskId, // user-facing taskId
        );

        // ACK received - update task status to processing
        await fastify.taskService.markProcessing(taskId);

        // Return 202 Accepted - Agent will process asynchronously
        return reply.code(202).send({
          success: true,
          taskId,
          status: 'processing',
          message: 'Task acknowledged and processing',
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        console.error(`[A2A] Task ${resolvedTaskId} failed: ${errorMessage}`);

        if (fastify.taskService) {
          await fastify.taskService.markFailed(taskId, errorMessage);
        }

        // Return 408 Request Timeout for ACK failures
        return reply.code(408).send({
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
