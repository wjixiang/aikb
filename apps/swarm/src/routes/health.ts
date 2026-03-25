/**
 * Health Routes
 *
 * Health check and server status endpoints.
 *
 * Endpoints:
 * - GET /health         - Basic health check
 * - GET /health/ready   - Readiness probe
 * - GET /health/live    - Liveness probe
 * - GET /health/metrics - Server metrics
 */

import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {

  // ============================================================
  // GET /health - Basic health check
  // ============================================================
  fastify.get('/', async (request, reply) => {
    return {
      status: 'ok',
      service: 'swarm',
      serverId: fastify.serverId,
      timestamp: new Date().toISOString(),
    };
  });

  // ============================================================
  // GET /health/ready - Readiness probe
  // ============================================================
  fastify.get('/ready', async (request, reply) => {
    // Check if AgentRuntime is ready
    const runtime = fastify.agentRuntime;

    if (!runtime) {
      return reply.code(503).send({
        status: 'not_ready',
        message: 'AgentRuntime not initialized',
      });
    }

    try {
      // Try to get stats to verify runtime is functional
      await runtime.getStats();

      return {
        status: 'ready',
        serverId: fastify.serverId,
      };
    } catch {
      return reply.code(503).send({
        status: 'not_ready',
        message: 'AgentRuntime not functional',
      });
    }
  });

  // ============================================================
  // GET /health/live - Liveness probe
  // ============================================================
  fastify.get('/live', async (request, reply) => {
    return {
      status: 'alive',
      serverId: fastify.serverId,
      uptime: process.uptime(),
    };
  });

  // ============================================================
  // GET /health/metrics - Server metrics
  // ============================================================
  fastify.get('/metrics', async (request, reply) => {
    const runtime = fastify.agentRuntime;

    const metrics = {
      server: {
        id: fastify.serverId,
        port: fastify.serverPort,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
      runtime: runtime ? {
        maxAgents: (runtime as any).maxAgents,
        agents: await runtime.getStats(),
        topology: runtime.getTopologyStats(),
      } : null,
    };

    return metrics;
  });
};
