import type { FastifyPluginAsync } from 'fastify';
import type { AgentStatus } from 'agent-lib/core';
import {
  baseResponseSchema,
  baseArrayResponseSchema,
  agentFilterSchema,
  createAgentBodySchema,
  toFastifySchema,
} from './schemas.js';

export const runtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/stats',
    {
      schema: {
        tags: ['runtime'],
        description: 'Get runtime statistics including agent counts and status',
        response: {
          200: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const stats = await fastify.agentRuntime.getStats();
      return { success: true, data: stats, serverId: fastify.serverId };
    },
  );

  fastify.get(
    '/agents',
    {
      schema: {
        tags: ['runtime'],
        description: 'List all agents in the runtime with optional filtering',
        querystring: toFastifySchema(agentFilterSchema),
        response: {
          200: toFastifySchema(baseArrayResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { status, type, name } = request.query as {
        status?: string;
        type?: string;
        name?: string;
      };
      const filter: {
        status?: AgentStatus;
        agentType?: string;
        name?: string;
      } = {};
      if (status) filter.status = status as AgentStatus;
      if (type) filter.agentType = type;
      if (name) filter.name = name;
      const agents = await fastify.agentRuntime.listAgents(filter);
      return { success: true, data: agents, count: agents.length };
    },
  );

  fastify.post(
    '/agents',
    {
      schema: {
        tags: ['runtime'],
        description: 'Create a new agent in the runtime',
        body: toFastifySchema(createAgentBodySchema),
        response: {
          201: toFastifySchema(baseResponseSchema),
          400: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        agent?: {
          name?: string;
          type?: string;
          description?: string;
          sop?: string;
        };
        api?: {
          provider?: string;
          apiKey?: string;
          baseUrl?: string;
          modelId?: string;
        };
        components?: unknown[];
      };
      try {
        const agentSoul: {
          sop?: string;
          name?: string;
          type?: string;
          description?: string;
        } = {};
        if (body.agent?.sop) agentSoul.sop = body.agent.sop;
        if (body.agent?.name) agentSoul.name = body.agent.name;
        if (body.agent?.type) agentSoul.type = body.agent.type;
        if (body.agent?.description)
          agentSoul.description = body.agent.description;
        const instanceId = await fastify.agentRuntime.createAgent(
          { agent: agentSoul, components: body.components as any[] },
          body.api ? { api: body.api as any } : undefined,
        );
        return reply.code(201).send({
          success: true,
          data: { instanceId, serverId: fastify.serverId },
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/agents/:instanceId',
    {
      schema: {
        tags: ['runtime'],
        description: 'Get details of a specific agent',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Agent instance ID' },
          },
        },
        response: {
          200: toFastifySchema(baseResponseSchema),
          404: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        const agent = await fastify.agentRuntime.getAgent(instanceId);
        if (!agent)
          return reply
            .code(404)
            .send({ success: false, error: 'Agent not found' });
        const metadata = fastify.agentRuntime.getAgentMetadata(instanceId);
        return {
          success: true,
          data: {
            instanceId: agent.instanceId,
            alias: metadata?.alias,
            status: agent.status,
            metadata,
            serverId: fastify.serverId,
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
    '/agents/:instanceId/stop',
    {
      schema: {
        tags: ['runtime'],
        description: 'Stop a running agent',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Agent instance ID' },
          },
        },
        response: {
          200: toFastifySchema(baseResponseSchema),
          400: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await fastify.agentRuntime.stopAgent(instanceId);
        return { success: true, data: { instanceId, status: 'stopped' } };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.delete(
    '/agents/:instanceId',
    {
      schema: {
        tags: ['runtime'],
        description: 'Destroy an agent',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Agent instance ID' },
          },
        },
        response: {
          200: toFastifySchema(baseResponseSchema),
          400: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await fastify.agentRuntime.destroyAgent(instanceId);
        return { success: true, data: { instanceId, status: 'destroyed' } };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/topology',
    {
      schema: {
        tags: ['runtime'],
        description: 'Get the agent topology graph showing agent relationships',
        response: {
          200: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const topology = fastify.agentRuntime.getTopologyGraph();
      return {
        success: true,
        data: {
          nodes: topology.getAllNodes(),
          edges: topology.getAllEdges(),
          size: topology.size,
        },
      };
    },
  );

  fastify.get(
    '/topology/stats',
    {
      schema: {
        tags: ['runtime'],
        description: 'Get topology statistics',
        response: {
          200: toFastifySchema(baseResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const stats = fastify.agentRuntime.getTopologyStats();
      return { success: true, data: stats };
    },
  );
};
