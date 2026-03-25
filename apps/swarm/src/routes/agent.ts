/**
 * Agent Routes
 *
 * HTTP API for individual agent operations.
 *
 * Endpoints:
 * - GET    /api/agents/:id             - Get agent info
 * - POST   /api/agents/:id/start       - Start agent
 * - POST   /api/agents/:id/stop        - Stop agent
 * - DELETE /api/agents/:id             - Destroy agent
 * - GET    /api/agents/:id/children    - List child agents
 * - GET    /api/agents/:id/logs        - Get agent logs
 */

import type { FastifyPluginAsync } from 'fastify';

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================
  // GET /api/agents/:instanceId - Get agent details
  // ============================================================
  fastify.get<{ Params: { instanceId: string } }>(
    '/:instanceId',
    async (request, reply) => {
      const { instanceId } = request.params;

      try {
        // Resolve ID
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const agent = await fastify.agentRuntime.getAgent(resolvedId);

        if (!agent) {
          return reply.code(404).send({
            success: false,
            error: 'Agent not found',
          });
        }

        const metadata = fastify.agentRuntime.getAgentMetadata(resolvedId);

        return {
          success: true,
          data: {
            instanceId: agent.instanceId,
            alias: metadata?.alias,
            status: agent.status,
            name: metadata?.name,
            type: metadata?.agentType,
            serverId: fastify.serverId,
          },
        };
      } catch (error) {
        return reply.code(404).send({
          success: false,
          error: 'Agent not found',
        });
      }
    },
  );

  // ============================================================
  // POST /api/agents/:instanceId/start - Start agent
  // ============================================================
  fastify.post<{ Params: { instanceId: string } }>(
    '/:instanceId/start',
    async (request, reply) => {
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

  // ============================================================
  // POST /api/agents/:instanceId/stop - Stop agent
  // ============================================================
  fastify.post<{ Params: { instanceId: string } }>(
    '/:instanceId/stop',
    async (request, reply) => {
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

  // ============================================================
  // DELETE /api/agents/:instanceId - Destroy agent
  // ============================================================
  fastify.delete<{ Params: { instanceId: string } }>(
    '/:instanceId',
    async (request, reply) => {
      const { instanceId } = request.params;
      const { cascade } = request.query as { cascade?: string };

      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);

        // TODO: Implement cascade destroy if needed
        if (cascade === 'true') {
          // For now, just destroy the agent without cascade
          // Cascade destroy should be implemented in AgentRuntime
        }

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

  // ============================================================
  // GET /api/agents/:instanceId/children - List child agents
  // ============================================================
  fastify.get<{ Params: { instanceId: string } }>(
    '/:instanceId/children',
    async (request, reply) => {
      const { instanceId } = request.params;

      try {
        const resolvedId = fastify.agentRuntime.resolveAgentId(instanceId);
        const children = await fastify.agentRuntime.listChildAgents(resolvedId);

        return {
          success: true,
          data: children,
          count: children.length,
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
  // GET /api/agents/:instanceId/logs - Get agent logs
  // ============================================================
  fastify.get<{ Params: { instanceId: string } }>(
    '/:instanceId/logs',
    async (request, reply) => {
      const { instanceId } = request.params;
      const { tail } = request.query as { tail?: string };

      // TODO: Implement agent log retrieval
      return {
        success: true,
        data: {
          logs: [],
          message: 'Log retrieval not yet implemented',
        },
      };
    },
  );
};
