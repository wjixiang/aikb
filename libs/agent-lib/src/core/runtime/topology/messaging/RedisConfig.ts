/**
 * Redis Configuration for MessageBus
 *
 * Configuration types for Redis-based message bus implementation.
 */

/**
 * Redis MessageBus Configuration
 */
export interface RedisMessageBusConfig {
  /** Redis connection URL (e.g., redis://localhost:6379) */
  url?: string;

  /** Redis host (alternative to url) */
  host?: string;

  /** Redis port (alternative to url) */
  port?: number;

  /** Redis password */
  password?: string;

  /** Redis database number */
  db?: number;

  /** Key prefix for all channels (default: 'aikb:a2a:') */
  keyPrefix?: string;

  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;

  /** Enable lazy connect - connect on first use (default: true) */
  lazyConnect?: boolean;

  /** Reconnection retry strategy - return null to stop retrying */
  retryStrategy?: (times: number) => number | null;

  /** Max retries for reconnection (default: 10) */
  maxRetries?: number;

  /** Keepalive interval in ms (default: 30000) */
  keepalive?: number;
}

/**
 * Default Redis configuration values
 */
export const DEFAULT_REDIS_CONFIG: Required<
  Pick<
    RedisMessageBusConfig,
    | 'keyPrefix'
    | 'connectionTimeout'
    | 'lazyConnect'
    | 'maxRetries'
    | 'keepalive'
  >
> = {
  keyPrefix: 'aikb:a2a:',
  connectionTimeout: 10000,
  lazyConnect: true,
  maxRetries: 10,
  keepalive: 30000,
};

/**
 * Create a default retry strategy
 */
export function createDefaultRetryStrategy(
  maxRetries: number = 10,
): (times: number) => number | null {
  return (times: number): number | null => {
    if (times > maxRetries) {
      console.error(
        `[RedisMessageBus] Max retries (${maxRetries}) exceeded, stopping reconnection`,
      );
      return null;
    }
    // Exponential backoff: 100ms, 200ms, 400ms, ... max 3000ms
    const delay = Math.min(times * 100, 3000);
    console.warn(
      `[RedisMessageBus] Reconnection attempt ${times}/${maxRetries}, waiting ${delay}ms`,
    );
    return delay;
  };
}

/**
 * Parse Redis URL into components
 */
export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  db?: number;
} {
  const parsed = new URL(url);

  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : undefined,
  };
}

/**
 * Build Redis connection options from config
 */
export function buildRedisOptions(config: RedisMessageBusConfig): {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix: string;
  lazyConnect: boolean;
  retryStrategy: (times: number) => number | null;
  connectTimeout: number;
  keepAlive: number;
} {
  const defaults = DEFAULT_REDIS_CONFIG;

  // If URL provided, parse it
  let host = config.host || 'localhost';
  let port = config.port || 6379;
  let password = config.password;
  let db = config.db;

  if (config.url) {
    const parsed = parseRedisUrl(config.url);
    host = parsed.host;
    port = parsed.port;
    password = password ?? parsed.password;
    db = db ?? parsed.db;
  }

  return {
    host,
    port,
    password,
    db,
    keyPrefix: config.keyPrefix ?? defaults.keyPrefix,
    lazyConnect: config.lazyConnect ?? defaults.lazyConnect,
    retryStrategy:
      config.retryStrategy ??
      createDefaultRetryStrategy(config.maxRetries ?? defaults.maxRetries),
    connectTimeout: config.connectionTimeout ?? defaults.connectionTimeout,
    keepAlive: config.keepalive ?? defaults.keepalive,
  };
}
