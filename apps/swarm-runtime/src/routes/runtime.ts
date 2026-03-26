/**
 * Runtime Routes
 *
 * HTTP API for AgentRuntime management.
 */

import type { FastifyPluginAsync } from 'fastify';
import type { AgentStatus } from 'agent-lib/core';
import {
  getAllAgentSouls,
  createAgentSoulByToken,
  type AgentSoulMetadata,
} from 'agent-soul-hub';

const responseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', additionalProperties: true },
    count: { type: 'number' },
    serverId: { type: 'string' },
    error: { type: 'string' },
  },
};

const arrayResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'array',
      items: {
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
      },
    },
    count: { type: 'number' },
    serverId: { type: 'string' },
    error: { type: 'string' },
  },
};

export const runtimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/stats',
    {
      schema: {
        tags: ['runtime'],
        description: 'Get runtime statistics including agent counts and status',
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
        description: 'List all agents in the runtime with optional filtering',
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by agent status (running, stopped, idle)',
            },
            type: { type: 'string', description: 'Filter by agent type' },
            name: { type: 'string', description: 'Filter by agent name' },
          },
        },
        response: { 200: arrayResponseSchema },
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
        description: 'Create a new agent in the runtime',
        body: {
          type: 'object',
          properties: {
            agent: {
              type: 'object',
              description: 'Agent configuration',
              properties: {
                name: { type: 'string', description: 'Agent name' },
                type: { type: 'string', description: 'Agent type/class' },
                description: {
                  type: 'string',
                  description: 'Agent description',
                },
                sop: {
                  type: 'string',
                  description: 'Standard Operating Procedure JSON',
                },
              },
            },
            api: {
              type: 'object',
              description: 'API configuration for the agent',
              properties: {
                provider: {
                  type: 'string',
                  description: 'API provider (openai, azure, etc.)',
                },
                apiKey: { type: 'string', description: 'API key' },
                baseUrl: { type: 'string', description: 'Base URL for API' },
                modelId: { type: 'string', description: 'Model identifier' },
              },
            },
            components: {
              type: 'array',
              description: 'Runtime components to attach',
            },
            parentInstanceId: {
              type: 'string',
              description:
                '[Optional] Creator agent instance ID - automatically establishes parent-child topology edge',
            },
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
        parentInstanceId?: string;
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
          {
            ...(body.api ? { api: body.api as any } : {}),
            ...(body.parentInstanceId
              ? { parentInstanceId: body.parentInstanceId }
              : {}),
          },
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
        description: 'Stop a running agent',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Agent instance ID' },
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
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.post(
    '/agents/:instanceId/start',
    {
      schema: {
        tags: ['runtime'],
        description: 'Start an idle agent',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Agent instance ID' },
          },
        },
        response: {
          200: responseSchema,
          400: responseSchema,
          404: responseSchema,
        },
      } as any,
    },
    async (request, reply) => {
      const { instanceId } = request.params as { instanceId: string };
      try {
        await fastify.agentRuntime.startAgent(instanceId);
        return { success: true, data: { instanceId, status: 'running' } };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
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
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
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
        description: 'Get topology statistics',
        response: { 200: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const stats = fastify.agentRuntime.getTopologyStats();
      return { success: true, data: stats };
    },
  );

  fastify.post(
    '/topology/nodes',
    {
      schema: {
        tags: ['runtime'],
        description: 'Register an agent as a node in the topology graph',
        body: {
          type: 'object',
          required: ['agentId'],
          properties: {
            agentId: { type: 'string', description: 'Agent instance ID' },
            nodeType: {
              type: 'string',
              description: 'Node type (e.g., router, worker, coordinator)',
            },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent capabilities',
            },
          },
        },
        response: { 201: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { agentId, nodeType, capabilities } = request.body as {
        agentId: string;
        nodeType?: string;
        capabilities?: string[];
      };
      try {
        fastify.agentRuntime.registerInTopology(
          agentId,
          (nodeType as any) || 'worker',
          capabilities,
        );
        return reply.code(201).send({
          success: true,
          data: { agentId, nodeType, capabilities },
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.delete(
    '/topology/nodes/:agentId',
    {
      schema: {
        tags: ['runtime'],
        description: 'Unregister an agent from the topology graph',
        params: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent instance ID' },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { agentId } = request.params as { agentId: string };
      try {
        fastify.agentRuntime.unregisterFromTopology(agentId);
        return { success: true, data: { agentId } };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/topology/nodes/:agentId/neighbors',
    {
      schema: {
        tags: ['runtime'],
        description: 'Get the neighbors of a specific agent in the topology',
        params: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent instance ID' },
          },
        },
        response: { 200: responseSchema, 404: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { agentId } = request.params as { agentId: string };
      const graph = fastify.agentRuntime.getTopologyGraph();
      const neighbors = graph.getNeighbors(agentId);
      return { success: true, data: neighbors };
    },
  );

  fastify.post(
    '/topology/edges',
    {
      schema: {
        tags: ['runtime'],
        description: 'Connect two agents in the topology graph',
        body: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', description: 'Source agent ID' },
            to: { type: 'string', description: 'Target agent ID' },
            edgeType: {
              type: 'string',
              description: 'Edge type (e.g., peer, parent-child)',
            },
          },
        },
        response: { 201: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { from, to, edgeType } = request.body as {
        from: string;
        to: string;
        edgeType?: string;
      };
      try {
        fastify.agentRuntime.connectAgents(from, to, edgeType as any);
        return reply.code(201).send({
          success: true,
          data: { from, to, edgeType },
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.delete(
    '/topology/edges',
    {
      schema: {
        tags: ['runtime'],
        description: 'Disconnect two agents in the topology graph',
        querystring: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', description: 'Source agent ID' },
            to: { type: 'string', description: 'Target agent ID' },
          },
        },
        response: { 200: responseSchema, 400: responseSchema },
      } as any,
    },
    async (request, reply) => {
      const { from, to } = request.query as { from: string; to: string };
      try {
        fastify.agentRuntime.disconnectAgents(from, to);
        return { success: true, data: { from, to } };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  fastify.get(
    '/agent-souls',
    {
      schema: {
        tags: ['runtime'],
        description: 'List all registered agent souls',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                    description: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      } as any,
    },
    async (request, reply) => {
      const souls = getAllAgentSouls();
      return {
        success: true,
        data: souls.map((s: AgentSoulMetadata) => ({
          token: s.token,
          name: s.name,
          type: s.type,
          description: s.description,
        })),
      };
    },
  );

  fastify.post(
    '/agent-souls',
    {
      schema: {
        tags: ['runtime'],
        description: 'Create an agent from a registered agent soul by token',
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: {
              type: 'string',
              description:
                '[Required] Agent soul token (e.g., epidemiology, diagnosis)',
            },
            alias: {
              type: 'string',
              description: '[Optional] Custom alias for the agent instance',
            },
            api: {
              type: 'object',
              description: '[Optional] API configuration overrides',
              properties: {
                provider: {
                  type: 'string',
                  description: 'LLM provider (e.g., openai, zai)',
                },
                apiKey: {
                  type: 'string',
                  description: 'API key for the provider',
                },
                baseUrl: {
                  type: 'string',
                  description: 'Base URL for API requests',
                },
                modelId: { type: 'string', description: 'Model ID to use' },
              },
            },
            parentInstanceId: {
              type: 'string',
              description:
                '[Optional] Creator agent instance ID - automatically establishes parent-child topology edge',
            },
          },
        },
        response: {
          201: responseSchema,
          400: responseSchema,
          404: responseSchema,
        },
      } as any,
    },
    async (request, reply) => {
      const body = request.body as {
        token: string;
        alias?: string;
        api?: {
          provider?: string;
          apiKey?: string;
          baseUrl?: string;
          modelId?: string;
        };
        parentInstanceId?: string;
      };

      try {
        const soulConfig = createAgentSoulByToken(body.token);
        const instanceId = await fastify.agentRuntime.createAgent(
          soulConfig,
          {
            ...(body.api ? { api: body.api as any } : {}),
            ...(body.parentInstanceId
              ? { parentInstanceId: body.parentInstanceId }
              : {}),
          },
        );
        return reply.code(201).send({
          success: true,
          data: {
            instanceId,
            token: body.token,
            alias: body.alias,
            serverId: fastify.serverId,
          },
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('Unknown agent soul token')
        ) {
          return reply.code(404).send({
            success: false,
            error: error.message,
          });
        }
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );
};
