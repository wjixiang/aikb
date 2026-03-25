/**
 * Runtime Routes
 *
 * HTTP API for AgentRuntime management.
 */

import type { FastifyPluginAsync } from 'fastify';
import type { AgentStatus } from 'agent-lib/core';

const responseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object' },
    count: { type: 'number' },
    serverId: { type: 'string' },
    error: { type: 'string' },
  },
};

const agentSchema = {
  type: 'object',
  properties: {
    instanceId: { type: 'string' },
    alias: { type: 'string' },
    status: { type: 'string' },
    name: { type: 'string' },
    agentType: { type: 'string' },
    description: { type: 'string' },
    metadata: { type: 'object' },
  },
};

export const runtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/stats',
    {
      schema: {
        tags: ['runtime'],
        response: { 200: responseSchema },
      } as any,
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
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            type: { type: 'string' },
            name: { type: 'string' },
          },
        },
        response: { 200: responseSchema },
      } as any,
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
        body: {
          type: 'object',
          properties: {
            agent: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                sop: { type: 'string' },
              },
            },
            api: {
              type: 'object',
              properties: {
                provider: { type: 'string' },
                apiKey: { type: 'string' },
                baseUrl: { type: 'string' },
                modelId: { type: 'string' },
              },
            },
            components: { type: 'array' },
          },
        },
        response: { 201: responseSchema, 400: responseSchema },
      } as any,
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
        return reply
          .code(201)
          .send({
            success: true,
            data: { instanceId, serverId: fastify.serverId },
          });
      } catch (error) {
        return reply
          .code(400)
          .send({
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
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
        },
        response: { 200: responseSchema, 404: responseSchema },
      } as any,
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
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await fastify.agentRuntime.stopAgent(instanceId);
        return { success: true, data: { instanceId, status: 'stopped' } };
      } catch (error) {
        return reply
          .code(400)
          .send({
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
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await fastify.agentRuntime.destroyAgent(instanceId);
        return { success: true, data: { instanceId, status: 'destroyed' } };
      } catch (error) {
        return reply
          .code(400)
          .send({
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
        response: { 200: responseSchema },
      } as any,
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
        response: { 200: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const stats = fastify.agentRuntime.getTopologyStats();
      return { success: true, data: stats };
    },
  );
};
