/**
 * MessageBus Factory - Creates MessageBus instances based on configuration
 *
 * Provides a unified interface for creating either in-memory or Redis-based
 * message bus implementations.
 */

import type { TopologyConfig } from '../types.js';
import { MessageBus, type IMessageBus } from './MessageBus.js';
import { RedisMessageBus, createRedisMessageBus } from './RedisMessageBus.js';
import type { RedisMessageBusConfig } from './RedisConfig.js';

/**
 * MessageBus operating mode
 */
export type MessageBusMode = 'memory' | 'redis';

/**
 * Factory configuration for creating MessageBus
 */
export interface MessageBusFactoryConfig {
  /** Operating mode: 'memory' for local, 'redis' for distributed */
  mode: MessageBusMode;

  /** Redis configuration (required when mode is 'redis') */
  redis?: RedisMessageBusConfig;

  /** Topology configuration */
  topology?: TopologyConfig;
}

/**
 * Create a MessageBus instance based on configuration
 *
 * @param config Factory configuration
 * @returns IMessageBus instance
 *
 * @example
 * ```typescript
 * // In-memory (default)
 * const memoryBus = createMessageBus({ mode: 'memory' });
 *
 * // Redis for distributed communication
 * const redisBus = createMessageBus({
 *   mode: 'redis',
 *   redis: {
 *     url: 'redis://localhost:6379',
 *     keyPrefix: 'aikb:a2a:',
 *   }
 * });
 * ```
 */
export function createMessageBus(config: MessageBusFactoryConfig): IMessageBus {
  if (config.mode === 'redis') {
    if (!config.redis) {
      console.warn(
        '[MessageBusFactory] Redis mode requested but no config provided, using defaults',
      );
    }
    return createRedisMessageBus(config.redis ?? {}, config.topology);
  }

  // Default to in-memory
  return new MessageBus(config.topology);
}

/**
 * Create a MessageBus from environment configuration
 *
 * Reads from environment variables:
 * - A2A_MESSAGE_BUS_MODE: 'memory' | 'redis' (default: 'memory')
 * - A2A_REDIS_URL: Redis connection URL
 * - A2A_REDIS_KEY_PREFIX: Key prefix for channels
 *
 * @param topologyConfig Optional topology configuration
 * @returns IMessageBus instance
 */
export function createMessageBusFromEnv(
  topologyConfig?: TopologyConfig,
): IMessageBus {
  const mode = (process.env['A2A_MESSAGE_BUS_MODE'] as MessageBusMode) || 'memory';

  if (mode === 'redis') {
    const redisConfig: RedisMessageBusConfig = {
      url: process.env['A2A_REDIS_URL'],
      keyPrefix: process.env['A2A_REDIS_KEY_PREFIX'],
      password: process.env['A2A_REDIS_PASSWORD'],
      host: process.env['A2A_REDIS_HOST'],
      port: process.env['A2A_REDIS_PORT']
        ? parseInt(process.env['A2A_REDIS_PORT'], 10)
        : undefined,
      db: process.env['A2A_REDIS_DB']
        ? parseInt(process.env['A2A_REDIS_DB'], 10)
        : undefined,
    };

    return createMessageBus({
      mode: 'redis',
      redis: redisConfig,
      topology: topologyConfig,
    });
  }

  return createMessageBus({
    mode: 'memory',
    topology: topologyConfig,
  });
}

/**
 * Check if a MessageBus is Redis-based
 */
export function isRedisMessageBus(bus: IMessageBus): bus is RedisMessageBus {
  return bus instanceof RedisMessageBus;
}

// Re-export types and implementations
export type { IMessageBus } from './MessageBus.js';
export { MessageBus } from './MessageBus.js';
export { RedisMessageBus, createRedisMessageBus } from './RedisMessageBus.js';
export type {
  RedisMessageBusConfig,
  DEFAULT_REDIS_CONFIG,
} from './RedisConfig.js';
export {
  buildRedisOptions,
  createDefaultRetryStrategy,
  parseRedisUrl,
} from './RedisConfig.js';
