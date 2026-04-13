export { BaseApiClient } from './base.js';
export type { BaseClientConfig } from './base.js';
export type { Logger } from '@shared/logger';

export { OpenaiCompatibleApiClient } from './openai.js';
export type { OpenAICompatibleConfig } from './openai.js';

export { AnthropicCompatibleApiClient } from './anthropic.js';
export type { AnthropicCompatibleConfig } from './anthropic.js';

export { ApiClientFactory } from './factory.js';

export { ClientPool } from './pool.js';
export { checkClientHealth } from './pool.health.js';
export type {
  PoolEntryConfig,
  PoolEntry,
  ClientPoolEntryStats,
  QuotaConfig,
  QuotaUsage,
  ClientPoolStats,
  HealthCheckResult,
  FallbackOptions,
} from './pool.types.js';
