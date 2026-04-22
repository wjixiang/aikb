import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { AgentRuntime, type AgentRuntimeConfig } from 'agent-lib';
import { ApiClientFactory } from 'llm-api-client';
import { PostgresPersistenceService } from 'persistence-lib';
import { initLogger, getLogger } from '@shared/logger';
import type { AppConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyInstance {
    agentRuntime: AgentRuntime;
  }
}

interface RuntimePluginOptions {
  config: AppConfig;
}

export default fp(
  async function runtimePlugin(fastify: FastifyInstance, options: RuntimePluginOptions) {
    const appConfig = options.config;
    await initLogger({
      name: 'rest-agent-runtime',
      level: appConfig.logLevel,
    });
    const logger = getLogger('runtime-plugin');

    const apiClient = ApiClientFactory.create({
      apiProvider: appConfig.apiProvider as 'openai',
      apiKey: appConfig.apiKey,
      apiModelId: appConfig.apiModelId,
      ...(appConfig.apiBaseUrl ? { openAiBaseUrl: appConfig.apiBaseUrl } : {}),
      ...(appConfig.apiTimeout ? { timeout: appConfig.apiTimeout } : {}),
    });

    const persistenceConfig: Record<string, unknown> = { autoCommit: true };
    if (appConfig.databaseUrl) {
      persistenceConfig.databaseUrl = appConfig.databaseUrl;
    }
    const persistenceService = new PostgresPersistenceService(
      persistenceConfig as any,
    );

    const runtimeConfig: AgentRuntimeConfig = {
      apiClient,
      persistenceService,
    };

    const runtime = new AgentRuntime(runtimeConfig);
    await runtime.start();

    logger.info('AgentRuntime initialized');

    fastify.decorate('agentRuntime', runtime);

    fastify.addHook('onClose', async () => {
      logger.info('Shutting down AgentRuntime...');
      await runtime.stop();
      logger.info('AgentRuntime stopped');
    });
  },
  {
    name: 'runtime-plugin',
  },
);
