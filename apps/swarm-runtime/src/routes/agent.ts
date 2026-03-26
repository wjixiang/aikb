/**
 * Agent Routes
 *
 * HTTP API for individual agent operations.
 */

import type { FastifyPluginAsync } from 'fastify';

const responseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
    count: { type: 'number' },
    error: { type: 'string' },
  },
};

const arrayResponseSchema = {
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

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/:instanceId',
    {
      schema: {
        tags: ['agents'],
        description: 'Get details of a specific agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 404: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const agent = await fastify.agentRuntime.getAgent(resolvedId);
        if (!agent)
          return reply
            .code(404)
            .send({ success: false, error: 'Agent not found' });
        const metadata = fastify.agentRuntime.getAgentMetadata(resolvedId);
        return {
          success: true,
          data: {
            instanceId: agent.instanceId,
            alias: metadata?.alias,
            status: agent.status,
            name: metadata?.name,
            type: metadata?.agentType,
          },
        };
      } catch {
        return reply
          .code(404)
          .send({ success: false, error: 'Agent not found' });
      }
    },
  );

  fastify.post(
    '/:instanceId/start',
    {
      schema: {
        tags: ['agents'],
        description: 'Start a stopped agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        await fastify.agentRuntime.startAgent(resolvedId);
        return {
          success: true,
          data: { instanceId: resolvedId, status: 'started' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.post(
    '/:instanceId/stop',
    {
      schema: {
        tags: ['agents'],
        description: 'Stop a running agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        await fastify.agentRuntime.stopAgent(resolvedId);
        return {
          success: true,
          data: { instanceId: resolvedId, status: 'stopped' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.delete(
    '/:instanceId',
    {
      schema: {
        tags: ['agents'],
        description: 'Destroy an agent completely',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        await fastify.agentRuntime.destroyAgent(resolvedId);
        return {
          success: true,
          data: { instanceId: resolvedId, status: 'destroyed' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/:instanceId/children',
    {
      schema: {
        tags: ['agents'],
        description: 'List all child agents spawned by this agent',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: arrayResponseSchema, 400: arrayResponseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      const { instanceId } = request.params;
      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const children = await fastify.agentRuntime.listChildAgents(resolvedId);
        return { success: true, data: children, count: children.length };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/:instanceId/logs',
    {
      schema: {
        tags: ['agents'],
        description: 'Retrieve agent execution logs',
        params: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Agent instance ID or alias',
            },
          },
        },
        response: { 200: responseSchema },
      } as any,
    },
    async (request: any, reply: any) => {
      return {
        success: true,
        data: { logs: [], message: 'Log retrieval not yet implemented' },
      };
    },
  );
};
