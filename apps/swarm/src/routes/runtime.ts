/**
 * Runtime Routes
 *
 * HTTP API for AgentRuntime management.
 * Maps HTTP endpoints to RuntimeControlClient methods.
 *
 * Endpoints:
 * - GET    /api/runtime/stats       - Get runtime statistics
 * - GET    /api/runtime/agents      - List all agents
 * - GET    /api/runtime/topology    - Get topology graph
 * - GET    /api/runtime/topology/stats - Get topology stats
 * - POST   /api/runtime/agents      - Create agent
 * - GET    /api/runtime/agents/:id  - Get agent details
 * - DELETE /api/runtime/agents/:id  - Destroy agent
 * - POST   /api/runtime/agents/:id/stop - Stop agent
 */

import type { FastifyPluginAsync } from 'fastify';
import type { AgentStatus } from 'agent-lib/core';

export const runtimeRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================
  // GET /api/runtime/stats - Get runtime statistics
  // ============================================================
  fastify.get('/stats', async (request, reply) => {
    const stats = await fastify.agentRuntime.getStats();
    return {
      success: true,
      data: stats,
      serverId: fastify.serverId,
    };
  });

  // ============================================================
  // GET /api/runtime/agents - List all agents
  // ============================================================
  fastify.get('/agents', async (request, reply) => {
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

    return {
      success: true,
      data: agents,
      count: agents.length,
    };
  });

  // ============================================================
  // POST /api/runtime/agents - Create agent
  // ============================================================
  fastify.post('/agents', async (request, reply) => {
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
        data: {
          instanceId,
          serverId: fastify.serverId,
        },
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================
  // GET /api/runtime/agents/:instanceId - Get agent details
  // ============================================================
  fastify.get<{ Params: { instanceId: string } }>(
    '/agents/:instanceId',
    async (request, reply) => {
      const { instanceId } = request.params;

      try {
        const agent = await fastify.agentRuntime.getAgent(instanceId);

        if (!agent) {
          return reply.code(404).send({
            success: false,
            error: 'Agent not found',
          });
        }

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
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
        });
      }
    },
  );

  // ============================================================
  // POST /api/runtime/agents/:instanceId/stop - Stop agent
  // ============================================================
  fastify.post<{ Params: { instanceId: string } }>(
    '/agents/:instanceId/stop',
    async (request, reply) => {
      const { instanceId } = request.params;

      try {
        await fastify.agentRuntime.stopAgent(instanceId);

        return {
          success: true,
          data: { instanceId, status: 'stopped' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // ============================================================
  // DELETE /api/runtime/agents/:instanceId - Destroy agent
  // ============================================================
  fastify.delete<{ Params: { instanceId: string } }>(
    '/agents/:instanceId',
    async (request, reply) => {
      const { instanceId } = request.params;
      const { cascade } = request.query as { cascade?: string };

      try {
        // TODO: Implement cascade destroy if needed
        if (cascade === 'true') {
          // Cascade destroy should be implemented in AgentRuntime
        }

        await fastify.agentRuntime.destroyAgent(instanceId);

        return {
          success: true,
          data: { instanceId, status: 'destroyed' },
        };
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // ============================================================
  // GET /api/runtime/topology - Get topology graph
  // ============================================================
  fastify.get('/topology', async (request, reply) => {
    const topology = fastify.agentRuntime.getTopologyGraph();

    return {
      success: true,
      data: {
        nodes: topology.getAllNodes(),
        edges: topology.getAllEdges(),
        size: topology.size,
      },
    };
  });

  // ============================================================
  // GET /api/runtime/topology/stats - Get topology stats
  // ============================================================
  fastify.get('/topology/stats', async (request, reply) => {
    const stats = fastify.agentRuntime.getTopologyStats();

    return {
      success: true,
      data: stats,
    };
  });
};
