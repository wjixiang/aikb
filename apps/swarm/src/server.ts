/**
 * Swarm Application - Fastify + AgentRuntime
 *
 * 一个 Fastify 服务器 = 一个 AgentRuntime
 *
 * Architecture:
 * - Fastify 服务器包装 AgentRuntime
 * - HTTP API 映射到 RuntimeControlClient 方法
 * - 支持 Redis 分布式部署
 * - 健康检查和监控
 */

import 'dotenv/config';
import Fastify from 'fastify';
import { createAgentRuntime } from 'agent-lib/core';
import { agentRuntimePlugin } from './plugins/agent-runtime.js';
import { runtimeRoutes } from './routes/runtime.js';
import { agentRoutes } from './routes/agent.js';
import { a2aRoutes } from './routes/a2a.js';
import { healthRoutes } from './routes/health.js';
import type { AgentRuntimeConfig } from 'agent-lib/core';
import { loadConfig } from './config.js';

// ============================================================
// Configuration
// ============================================================

const config = loadConfig();

// Build AgentRuntime config
const runtimeConfig: AgentRuntimeConfig = {
  maxAgents: config.server.maxAgents,
  defaultApiConfig: config.api as any,
  messageBus: config.messageBus as any,
};

// ============================================================
// Fastify Server
// ============================================================

const fastify = Fastify({
  logger: {
    level: config.server.logLevel,
  },
});

// ============================================================
// Register Plugin & Routes
// ============================================================

// Register AgentRuntime plugin
await fastify.register(agentRuntimePlugin, {
  runtimeConfig,
  serverId: config.server.id,
  port: config.server.port,
});

// Register routes
await fastify.register(healthRoutes, { prefix: '/health' });
await fastify.register(runtimeRoutes, { prefix: '/api/runtime' });
await fastify.register(agentRoutes, { prefix: '/api/agents' });
await fastify.register(a2aRoutes, { prefix: '/api/a2a' });

// ============================================================
// Start Server
// ============================================================

const port = config.server.port;
const host = config.server.host;

try {
  await fastify.listen({ port, host });
  fastify.log.info(`🚀 Swarm Server started on http://${host}:${port}`);
  fastify.log.info(`   Server ID: ${config.server.id}`);
  fastify.log.info(`   MessageBus: ${config.messageBus?.mode || 'memory'}`);
  fastify.log.info(`   Max Agents: ${config.server.maxAgents}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

// ============================================================
// Graceful Shutdown
// ============================================================

const shutdown = async (signal: string) => {
  fastify.log.info(`⬇️  ${signal} received, shutting down...`);

  // Stop AgentRuntime
  const runtime = fastify.agentRuntime;
  if (runtime) {
    await runtime.stop();
    fastify.log.info('   AgentRuntime stopped');
  }

  // Close Fastify
  await fastify.close();
  fastify.log.info('   Fastify server closed');

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
