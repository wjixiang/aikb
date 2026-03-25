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
    data: { type: 'object' },
    count: { type: 'number' },
    error: { type: 'string' },
  },
};

const taskBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'taskId', 'description'],
  properties: {
    targetAgentId: { type: 'string' },
    taskId: { type: 'string' },
    description: { type: 'string' },
    input: { type: 'object' },
    priority: { type: 'number' },
  },
};

const queryBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'query'],
  properties: {
    targetAgentId: { type: 'string' },
    query: { type: 'string' },
    expectedFormat: { type: 'string' },
  },
};

const eventBodySchema = {
  type: 'object',
  required: ['targetAgentId', 'eventType'],
  properties: {
    targetAgentId: { type: 'string' },
    eventType: { type: 'string' },
    data: { type: 'object' },
  },
};

export const a2aRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/task',
    {
      schema: {
        tags: ['a2a'],
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
        response: { 200: a2aResponseSchema },
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
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
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
