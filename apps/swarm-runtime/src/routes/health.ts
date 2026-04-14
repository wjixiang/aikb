/**
 * Health Routes
 *
 * Health check and server status endpoints.
 */

import os from 'node:os';
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
        memory: {
          type: 'object',
          properties: {
            rss: { type: 'number' },
            heapTotal: { type: 'number' },
            heapUsed: { type: 'number' },
            external: { type: 'number' },
            arrayBuffers: { type: 'number' },
          },
        },
        cpu: {
          type: 'object',
          properties: {
            usagePercent: { type: 'number' },
            cores: { type: 'number' },
            model: { type: 'string' },
            loadAvg: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
        system: {
          type: 'object',
          properties: {
            hostname: { type: 'string' },
            platform: { type: 'string' },
            arch: { type: 'string' },
            totalMemory: { type: 'number' },
            freeMemory: { type: 'number' },
            usedMemory: { type: 'number' },
          },
        },
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

function getCpuUsagePercent(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }
  return Math.round(((totalTick - totalIdle) / totalTick) * 1000) / 10;
}

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
      const mem = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      return {
        server: {
          id: fastify.serverId,
          port: fastify.serverPort,
          uptime: process.uptime(),
          memory: {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
            arrayBuffers: mem.arrayBuffers,
          },
          cpu: {
            usagePercent: getCpuUsagePercent(),
            cores: os.cpus().length,
            model: os.cpus()[0]?.model ?? 'unknown',
            loadAvg: os.loadavg(),
          },
          system: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            totalMemory: totalMem,
            freeMemory: freeMem,
            usedMemory: totalMem - freeMem,
          },
          timestamp: new Date().toISOString(),
        },
        runtime: runtime ? { agents: await runtime.getStats() } : null,
      };
    },
  );
};
