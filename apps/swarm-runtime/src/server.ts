/**
 * Swarm Application - Fastify + AgentRuntime
 */

import { config as envconfig } from 'dotenv';
import Fastify from 'fastify';
import { default as cors } from '@fastify/cors';
import { default as swagger } from '@fastify/swagger';
import { default as swaggerUi } from '@fastify/swagger-ui';
import type { AgentRuntimeConfig } from 'agent-lib/core';
import { createAgentRuntime } from 'agent-lib/core';
import { agentRuntimePlugin } from './plugins/agent-runtime.js';
import { prismaPlugin } from './plugins/prisma.js';
import { runtimeRoutes } from './routes/runtime.js';
import { agentRoutes } from './routes/agent.js';
import { a2aRoutes } from './routes/a2a.js';
import { taskRoutes } from './routes/tasks.js';
import { healthRoutes } from './routes/health.js';
import { loadConfig } from './config.js';
import { initLogger, closePgPool } from '@shared/logger';
envconfig();
const config = loadConfig();

await initLogger({ name: 'swarm-runtime', level: config.server.logLevel });

const runtimeConfig: AgentRuntimeConfig = {
  defaultApiConfig: config.api as any,
  messageBus: config.messageBus as any,
  ...(config.runtimeControl ? { runtimeControl: config.runtimeControl } : {}),
  ...(config.ackTimeout ? { ackTimeout: config.ackTimeout } : {}),
  ...(config.maxRetries ? { maxRetries: config.maxRetries } : {}),
};

const fastify = Fastify({
  logger: {
    level: config.server.logLevel,
  },
});

await fastify.register(cors as any);

await fastify.register(swagger as any, {
  openapi: {
    info: {
      title: 'Swarm Agent Runtime API',
      description:
        'HTTP API for managing AgentRuntime, agents, and Agent-to-Agent (A2A) communication. ' +
        'Provides endpoints for creating, starting, stopping, and destroying agents, ' +
        'as well as sending tasks, queries, and events between agents.',
      version: '1.0.0',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Local server',
      },
    ],
    tags: [
      {
        name: 'health',
        description: 'Health check endpoints - server status and readiness',
      },
      {
        name: 'runtime',
        description: 'Runtime management - agent lifecycle and topology',
      },
      {
        name: 'agents',
        description: 'Individual agent operations - per-agent actions',
      },
      {
        name: 'a2a',
        description: 'Agent-to-Agent communication - tasks, queries, events',
      },
      {
        name: 'tasks',
        description: 'Task management - create, list, query, and delete tasks',
      },
    ],
  },
});

await fastify.register(swaggerUi as any, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
  },
});

await fastify.register(agentRuntimePlugin, {
  runtimeConfig,
  serverId: config.server.id,
  port: config.server.port,
});

// Register Prisma plugin for task persistence
await fastify.register(prismaPlugin);

await fastify.register(healthRoutes, { prefix: '/health' });
await fastify.register(runtimeRoutes, { prefix: '/api/runtime' });
await fastify.register(agentRoutes, { prefix: '/api/agents' });
await fastify.register(a2aRoutes, { prefix: '/api/a2a' });
await fastify.register(taskRoutes, { prefix: '/api/tasks' });

const port = config.server.port;
const host = config.server.host;

try {
  await fastify.listen({ port, host });
  fastify.log.info(`🚀 Swarm Server started on http://${host}:${port}`);
  fastify.log.info(`   Server ID: ${config.server.id}`);
  fastify.log.info(`   MessageBus: ${config.messageBus?.mode || 'memory'}`);
  fastify.log.info(`   ACK Timeout: ${config.ackTimeout ?? 5000}ms`);
  fastify.log.info(
    `   Task Persistence: ${fastify.taskService ? 'enabled' : 'disabled (set AGENT_DATABASE_URL)'}`,
  );
  fastify.log.info(`   API Docs: http://${host}:${port}/docs`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  fastify.log.info(`⬇️  ${signal} received, shutting down...`);

  const runtime = fastify.agentRuntime;
  if (runtime) {
    await runtime.stop();
    fastify.log.info('   AgentRuntime stopped');
  }

  await fastify.close();
  fastify.log.info('   Fastify server closed');

  await closePgPool();
  fastify.log.info('   Logger PG pool closed');

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
