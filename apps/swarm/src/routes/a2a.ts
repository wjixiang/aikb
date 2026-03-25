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

const taskBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'taskId', 'description'],
  properties: {
    targetAgentId: {
      type: 'string',
      description: 'Target agent instance ID or alias',
    },
    taskId: { type: 'string', description: 'Unique task identifier' },
    description: { type: 'string', description: 'Task description' },
    input: { type: 'object', description: 'Task input data' },
    priority: {
      type: 'number',
      description: 'Task priority (higher = more urgent)',
    },
  },
};

const queryBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'query'],
  properties: {
    targetAgentId: {
      type: 'string',
      description: 'Target agent instance ID or alias',
    },
    query: { type: 'string', description: 'Query string to send to agent' },
    expectedFormat: {
      type: 'string',
      description: 'Expected response format (e.g., json, text)',
    },
  },
};

const eventBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'eventType'],
  properties: {
    targetAgentId: {
      type: 'string',
      description: 'Target agent instance ID or alias',
    },
    eventType: { type: 'string', description: 'Type of event to send' },
    data: { type: 'object', description: 'Event payload data' },
  },
};

export const a2aRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/task',
    {
      schema: {
        tags: ['a2a'],
        description: 'Send an asynchronous task to another agent',
        body: taskBodySchema,
        response: { 200: a2aResponseSchema, 400: a2aResponseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const {
        targetAgentId,
        taskId,
        description,
        input = {},
        priority,
      } = request.body;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(targetAgentId);
        const client =
          fastify.agentRuntime.getRuntimeClient(SERVER_INSTANCE_ID);
        const result = await client.sendA2ATask(
          resolvedId,
          taskId,
          description,
          input,
          priority ? { priority } : undefined,
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
    async (request: any, reply: any) => {
      const { targetAgentId, query, expectedFormat } = request.body;
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
    async (request: any, reply: any) => {
      const { targetAgentId, eventType, data } = request.body;
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
    async (request: any, reply: any) => {
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
    async (request: any, reply: any) => {
      return reply
        .code(404)
        .send({ success: false, error: 'Conversation not found' });
    },
  );
};
