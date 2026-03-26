/**
 * Application Configuration
 *
 * Loads configuration from environment variables and config files.
 */

import type { AgentRuntimeConfig } from 'agent-lib/core';

export interface ServerConfig {
  id: string;
  host: string;
  port: number;
  logLevel: string;
  maxAgents: number;
}

export interface ApiConfig {
  apiProvider?: string;
  apiKey?: string;
  openAiBaseUrl?: string;
  apiModelId?: string;
  timeout?: number;
  zaiApiLine?: string;
}

export interface AppConfig {
  server: ServerConfig;
  api: ApiConfig;
  messageBus?: AgentRuntimeConfig['messageBus'];
  /** ACK timeout in ms for message confirmation (default: 5000) */
  ackTimeout?: number;
  /** Result timeout in ms for async task completion (default: 60000) */
  resultTimeout?: number;
  /** Max retries for failed message delivery (default: 3) */
  maxRetries?: number;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const serverId = process.env['SERVER_ID'] || `swarm-${Date.now()}`;

  // Parse Redis URL for MessageBus
  const messageBusMode = process.env['A2A_MESSAGE_BUS_MODE'] as
    | 'memory'
    | 'redis'
    | undefined;
  let messageBus: AgentRuntimeConfig['messageBus'] | undefined;

  if (messageBusMode === 'redis') {
    const redisUrl = process.env['A2A_REDIS_URL'] || process.env['REDIS_URL'];
    const password = process.env['A2A_REDIS_PASSWORD'];
    messageBus = {
      mode: 'redis',
      redis: redisUrl
        ? { url: redisUrl }
        : {
            host: process.env['A2A_REDIS_HOST'] || 'localhost',
            port: parseInt(process.env['A2A_REDIS_PORT'] || '6379'),
            password: password || '',
            db: parseInt(process.env['A2A_REDIS_DB'] || '0'),
          },
    };
  }

  return {
    server: {
      id: serverId,
      host: process.env['SERVER_HOST'] || '0.0.0.0',
      port: parseInt(process.env['PORT'] || '9400'),
      logLevel: process.env['LOG_LEVEL'] || 'info',
      maxAgents: parseInt(process.env['MAX_AGENTS'] || '50'),
    },
    api: {
      apiProvider: process.env['API_PROVIDER'] || 'openai',
      apiKey: process.env['OPENAI_API_KEY'] || process.env['GLM_API_KEY'] || '',
      openAiBaseUrl: process.env['API_BASE_URL'] || '',
      apiModelId: process.env['API_MODEL_ID'] || '',
      timeout: parseInt(process.env['API_TIMEOUT'] || '120000'),
    },
    messageBus,
    // Topology timeout configuration
    ...(process.env['A2A_ACK_TIMEOUT']
      ? { ackTimeout: parseInt(process.env['A2A_ACK_TIMEOUT']) }
      : {}),
    ...(process.env['A2A_RESULT_TIMEOUT']
      ? { resultTimeout: parseInt(process.env['A2A_RESULT_TIMEOUT']) }
      : {}),
    ...(process.env['A2A_MAX_RETRIES']
      ? { maxRetries: parseInt(process.env['A2A_MAX_RETRIES']) }
      : {}),
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: AppConfig): void {
  if (!config.api.apiKey) {
    throw new Error(
      'API key is required. Set OPENAI_API_KEY or GLM_API_KEY environment variable.',
    );
  }

  console.log('[Config] API Provider:', config.api.apiProvider);
  console.log('[Config] API Model:', config.api.apiModelId);
  console.log(
    '[Config] API Base URL:',
    config.api.openAiBaseUrl || '(default)',
  );

  if (config.messageBus?.mode === 'redis' && !config.messageBus.redis) {
    throw new Error(
      'Redis configuration is required when A2A_MESSAGE_BUS_MODE=redis',
    );
  }
}
