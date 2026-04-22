import Fastify from 'fastify';
import { loadConfig } from './config.js';
import runtimePlugin from './plugins/runtime.js';
import { agentRoutes } from './routes/agents.js';
import { eventRoutes } from './routes/events.js';
import { healthRoutes } from './routes/health.js';

const appConfig = loadConfig();

const fastify = Fastify({
  logger: {
    level: appConfig.logLevel,
  },
});

async function start() {
  try {
    await fastify.register(runtimePlugin, { config: appConfig });

    await fastify.register(agentRoutes);
    await fastify.register(eventRoutes);
    await fastify.register(healthRoutes);

    await fastify.listen({ port: appConfig.port, host: appConfig.host });
    fastify.log.info(`Server listening on ${appConfig.host}:${appConfig.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
