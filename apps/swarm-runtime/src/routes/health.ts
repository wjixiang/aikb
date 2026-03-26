/**
 * Health Routes
 *
 * Health check and server status endpoints.
 */

import type { FastifyPluginAsync } from 'fastify';

const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string' },
    service: { type: 'string' },
    serverId: { type: 'string' },
    timestamp: { type: 'string' },
    uptime: { type: 'number' },
    message: { type: 'string' },
  },
};

const metricsResponseSchema = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        port: { type: 'number' },
        uptime: { type: 'number' },
        memory: { type: 'object' },
        timestamp: { type: 'string' },
      },
    },
    runtime: {
      type: 'object',
      nullable: true,
      properties: {
        agents: { type: 'object' },
        topology: { type: 'object' },
      },
    },
  },
};

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      schema: {
        tags: ['health'],
        description: 'Basic health check - returns OK if server is running',
        response: { 200: healthResponseSchema },
      } as any,
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
      schema: {
        tags: ['health'],
        description:
          'Readiness check - returns OK if server and runtime are ready to accept requests',
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      } as any,
    },
    async (request, reply) => {
      const runtime = fastify.agentRuntime;
      if (!runtime) {
        return reply.code(503).send({
          status: 'not_ready',
          message: 'AgentRuntime not initialized',
        });
      }
      try {
        await runtime.getStats();
        return { status: 'ready', serverId: fastify.serverId };
      } catch {
        return reply.code(503).send({
          status: 'not_ready',
          message: 'AgentRuntime not functional',
        });
      }
    },
  );

  fastify.get(
    '/live',
    {
      schema: {
        tags: ['health'],
        description: 'Liveness check - returns OK if server process is alive',
        response: { 200: healthResponseSchema },
      } as any,
    },
    async (request, reply) => {
      return {
        status: 'alive',
        serverId: fastify.serverId,
        uptime: process.uptime(),
      };
    },
  );

  fastify.get(
    '/metrics',
    {
      schema: {
        tags: ['health'],
        description: 'Get detailed server and runtime metrics',
        response: { 200: metricsResponseSchema },
      } as any,
    },
    async (request, reply) => {
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
    },
  );
};
