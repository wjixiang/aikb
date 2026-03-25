/**
 * Health Routes
 *
 * Health check and server status endpoints.
 */

import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: { tags: ['health'] } as any,
    },
    async (request, reply) => {
      return {
        status: 'ok',
        service: 'swarm',
        serverId: fastify.serverId,
        timestamp: new Date().toISOString(),
      };
    },
  );

  fastify.get(
    '/ready',
    {
      schema: { tags: ['health'] } as any,
    },
    async (request, reply) => {
      const runtime = fastify.agentRuntime;
      if (!runtime) {
        return reply
          .code(503)
          .send({
            status: 'not_ready',
            message: 'AgentRuntime not initialized',
          });
      }
      try {
        await runtime.getStats();
        return { status: 'ready', serverId: fastify.serverId };
      } catch {
        return reply
          .code(503)
          .send({
            status: 'not_ready',
            message: 'AgentRuntime not functional',
          });
      }
    },
  );

  fastify.get(
    '/live',
    {
      schema: { tags: ['health'] } as any,
    },
    async (request, reply) => {
      return {
        status: 'alive',
        serverId: fastify.serverId,
        uptime: process.uptime(),
      };
    },
  );

  fastify.get('/metrics', async (request, reply) => {
    const runtime = fastify.agentRuntime;
    return {
      server: {
        id: fastify.serverId,
        port: fastify.serverPort,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      runtime: runtime
        ? {
            agents: await runtime.getStats(),
            topology: runtime.getTopologyStats(),
          }
        : null,
    };
  });
};
