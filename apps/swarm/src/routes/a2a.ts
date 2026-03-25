import type { FastifyPluginAsync } from 'fastify';
import {
  baseResponseSchema,
  baseArrayResponseSchema,
  taskBodySchema,
  queryBodySchema,
  eventBodySchema,
  toFastifySchema,
} from './schemas.js';

const SERVER_INSTANCE_ID = 'swarm-server';

export const a2aRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/task',
    {
      schema: {
        tags: ['a2a'],
        description: 'Send an asynchronous task to another agent',
        body: toFastifySchema(taskBodySchema),
        response: {
          200: toFastifySchema(baseResponseSchema),
          400: toFastifySchema(baseResponseSchema),
        },
      },
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
        body: toFastifySchema(queryBodySchema),
        response: {
          200: toFastifySchema(baseResponseSchema),
          400: toFastifySchema(baseResponseSchema),
        },
      },
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
        body: toFastifySchema(eventBodySchema),
        response: {
          200: toFastifySchema(baseResponseSchema),
          400: toFastifySchema(baseResponseSchema),
        },
      },
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
        response: {
          200: toFastifySchema(baseArrayResponseSchema),
        },
      },
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
        response: {
          200: toFastifySchema(baseResponseSchema),
          404: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request: any, reply: any) => {
      return reply
        .code(404)
        .send({ success: false, error: 'Conversation not found' });
    },
  );
};
