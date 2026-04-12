import type { ApiClient } from '../types/api-client.js';
import type {
  ApiResponse,
  ApiTimeoutConfig,
  ChatCompletionTool,
} from '../types/api-client.js';
import type { Message } from '../types/message.js';
import type { ProviderSettings } from '../types/provider-settings.js';
import {
  QuotaExceededError,
  parseError,
} from '../errors/errors.js';
import { ApiClientFactory } from './factory.js';
import { createLogger } from './logger.js';
import { checkClientHealth } from './pool.health.js';
import type {
  FallbackOptions,
  PoolEntryConfig,
  PoolEntry,
  ClientPoolEntryStats,
  QuotaConfig,
  QuotaUsage,
  ClientPoolStats,
  HealthCheckResult,
} from './pool.types.js';

function createEmptyStats(): ClientPoolEntryStats {
  return {
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    lastUsedAt: null,
    lastError: null,
  };
}

function createEmptyQuotaUsage(): QuotaUsage {
  return {
    usedTokens: 0,
    usedRequests: 0,
    periodStart: new Date(),
    resetIntervalMs: 3600000,
  };
}

/**
 * Create a proxied ApiClient that automatically collects stats and enforces quota.
 */
function createProxiedClient(entry: PoolEntry): ApiClient {
  return new Proxy(entry.client, {
    get(target, prop) {
      if (prop === 'makeRequest') {
        return async (...args: Parameters<ApiClient['makeRequest']>) => {
          // Check and reset quota period
          checkQuotaPeriod(entry);

          // Enforce quota limits
          enforceQuota(entry);

          entry.stats.totalRequests++;
          entry.stats.lastUsedAt = new Date();

          // Track request quota before the call
          if (entry.quota) {
            entry.quotaUsage.usedRequests++;
          }

          try {
            const result = await target.makeRequest(...args);
            entry.stats.successRequests++;
            entry.stats.totalPromptTokens += result.tokenUsage.promptTokens;
            entry.stats.totalCompletionTokens +=
              result.tokenUsage.completionTokens;
            entry.stats.lastError = null;

            // Track token quota after the call
            if (entry.quota) {
              entry.quotaUsage.usedTokens +=
                result.tokenUsage.promptTokens +
                result.tokenUsage.completionTokens;
            }

            return result;
          } catch (error) {
            entry.stats.failedRequests++;
            entry.stats.lastError = parseError(error);
            throw error;
          }
        };
      }
      return Reflect.get(target, prop);
    },
  });
}

/**
 * Check if the quota period has elapsed and reset if needed.
 */
function checkQuotaPeriod(entry: PoolEntry): void {
  if (!entry.quota) return;

  const now = Date.now();
  const elapsed = now - entry.quotaUsage.periodStart.getTime();
  if (elapsed >= entry.quotaUsage.resetIntervalMs) {
    entry.quotaUsage = createEmptyQuotaUsage();
    entry.quotaUsage.resetIntervalMs =
      entry.quota.resetIntervalMs ?? 3600000;
  }
}

/**
 * Enforce quota limits, throwing if exceeded.
 */
function enforceQuota(entry: PoolEntry): void {
  if (!entry.quota) return;

  if (
    entry.quota.maxRequests !== undefined &&
    entry.quotaUsage.usedRequests >= entry.quota.maxRequests
  ) {
    throw new QuotaExceededError(
      `Client "${entry.name}" request quota exceeded (${entry.quotaUsage.usedRequests}/${entry.quota.maxRequests})`,
      'requests',
    );
  }

  if (
    entry.quota.maxTokens !== undefined &&
    entry.quotaUsage.usedTokens >= entry.quota.maxTokens
  ) {
    throw new QuotaExceededError(
      `Client "${entry.name}" token quota exceeded (${entry.quotaUsage.usedTokens}/${entry.quota.maxTokens})`,
      'tokens',
    );
  }
}

/**
 * ClientPool - Singleton pool for managing LLM API clients.
 *
 * Provides client registration, retrieval, health checking, statistics,
 * and quota management. Returns proxied clients that transparently
 * collect metrics without modifying the ApiClient interface.
 *
 * @example
 * ```ts
 * const pool = ClientPool.getInstance();
 *
 * // Register clients
 * pool.register({ name: 'claude', settings: { apiProvider: 'anthropic', apiKey: '...', apiModelId: '...' } });
 * pool.register({ name: 'gpt4', settings: { apiProvider: 'openai', apiKey: '...', apiModelId: '...' } });
 *
 * // Use clients
 * const claude = pool.get('claude');
 * const response = await claude.makeRequest(systemPrompt, context, memory);
 *
 * // Check stats
 * console.log(pool.getPoolStats());
 * ```
 */
export class ClientPool implements ApiClient {
  private static instance: ClientPool | null = null;
  private entries: Map<string, PoolEntry> = new Map();
  private logger: ReturnType<typeof createLogger>;
  private idCounter = 0;
  private roundRobinIndex = 0;
  private fallbackStats = {
    totalFallbackRequests: 0,
    successfulFallbackRequests: 0,
  };

  /**
   * Optional factory override for testing. When set, register() uses
   * this instead of ApiClientFactory.create().
   * @internal
   */
  _clientFactory: ((settings: ProviderSettings) => ApiClient) | null = null;

  private generateId(): string {
    this.idCounter++;
    return `client-${this.idCounter}`;
  }

  private constructor() {
    this.logger = createLogger({ component: 'ClientPool' });
  }

  // --- Singleton ---

  static getInstance(): ClientPool {
    if (!ClientPool.instance) {
      ClientPool.instance = new ClientPool();
    }
    return ClientPool.instance;
  }

  /**
   * Reset the singleton instance. Useful for testing.
   */
  static resetInstance(): void {
    ClientPool.instance = null;
  }

  // --- Registration ---

  /**
   * Register a new client in the pool.
   *
   * @returns The name of the registered client
   * @throws Error if a client with the same name already exists
   */
  register(config: PoolEntryConfig): string {
    const name = config.name ?? this.generateId();
    const settings = config.settings;
    const enabled = config.enabled ?? true;

    if (this.entries.has(name)) {
      throw new Error(
        `Client "${name}" is already registered. Use unregister() first or getOrCreate() to update.`,
      );
    }

    const client = this._clientFactory
      ? this._clientFactory(settings)
      : ApiClientFactory.create(settings);

    const entry: PoolEntry = {
      name,
      client,
      settings,
      createdAt: new Date(),
      enabled,
      stats: createEmptyStats(),
      quota: undefined,
      quotaUsage: createEmptyQuotaUsage(),
    };

    this.entries.set(name, entry);
    this.logger.info(
      { name, provider: settings.apiProvider, model: settings.apiModelId },
      'Registered client',
    );

    return name;
  }

  /**
   * Register multiple clients at once.
   *
   * @returns Array of registered names
   */
  registerMany(configs: PoolEntryConfig[]): string[] {
    return configs.map((config) => this.register(config));
  }

  /**
   * Remove a client from the pool.
   *
   * @returns true if the client was found and removed
   */
  unregister(name: string): boolean {
    const deleted = this.entries.delete(name);
    if (deleted) {
      this.logger.info({ name }, 'Unregistered client');
    }
    return deleted;
  }

  /**
   * Get a proxied client by name, or undefined if not found / disabled.
   */
  get(name: string): ApiClient | undefined {
    const entry = this.entries.get(name);
    if (!entry || !entry.enabled) return undefined;
    return createProxiedClient(entry);
  }

  /**
   * Get an existing client by name, or create and register a new one.
   *
   * If `name` is omitted and only `settings` is provided, an auto-generated
   * ID is assigned. If the named client already exists, the settings are
   * ignored.
   */
  getOrCreate(
    settings: ProviderSettings,
    name?: string,
  ): ApiClient {
    const resolvedName = name ?? this.generateId();
    if (this.entries.has(resolvedName)) {
      return this.get(resolvedName)!;
    }
    this.register({ name: resolvedName, settings });
    return this.get(resolvedName)!;
  }

  /**
   * Check if a client exists in the pool (regardless of enabled state).
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * List all registered client names.
   */
  list(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Remove all clients from the pool.
   */
  clear(): void {
    const count = this.entries.size;
    this.entries.clear();
    this.roundRobinIndex = 0;
    this.fallbackStats = {
      totalFallbackRequests: 0,
      successfulFallbackRequests: 0,
    };
    this.logger.info({ count }, 'Cleared all clients');
  }

  // --- Round Robin ---

  /**
   * Return names of all currently enabled clients.
   */
  private listEnabledNames(): string[] {
    return Array.from(this.entries.entries())
      .filter(([, entry]) => entry.enabled)
      .map(([name]) => name);
  }

  /**
   * Get the next enabled client in round-robin order.
   *
   * Cycles through all enabled clients sequentially. If no enabled
   * clients exist, returns undefined.
   */
  getNext(): ApiClient | undefined {
    const enabled = this.listEnabledNames();
    if (enabled.length === 0) return undefined;

    this.roundRobinIndex = this.roundRobinIndex % enabled.length;
    const name = enabled[this.roundRobinIndex]!;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % enabled.length;

    return this.get(name);
  }

  /**
   * Reset the round-robin index to the beginning.
   */
  resetRoundRobin(): void {
    this.roundRobinIndex = 0;
  }

  // --- Fallback ---

  /**
   * Execute an API request with automatic fallback to other enabled clients
   * on retryable failure.
   *
   * Tries each enabled client in order. If a client fails with a retryable
   * error (after its internal retries), the next enabled client is tried.
   * Non-retryable errors (ValidationError, ContentPolicyError, etc.) stop
   * fallback immediately since the same request would fail on any client.
   * QuotaExceededError is treated as fallback-eligible since quota is per-client.
   */
  async makeRequestWithFallback(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: Message[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: ChatCompletionTool[],
    options?: FallbackOptions,
  ): Promise<ApiResponse> {
    const enabled = this.listEnabledNames();
    const skipSet = new Set(options?.skipClients ?? []);
    const candidates = enabled.filter((n) => !skipSet.has(n));

    const maxAttempts = options?.maxAttempts ?? candidates.length;

    if (candidates.length === 0) {
      throw new Error('No enabled LLM clients available for fallback');
    }

    this.fallbackStats.totalFallbackRequests++;
    let lastError: unknown;

    const tryCount = Math.min(maxAttempts, candidates.length);

    for (let i = 0; i < tryCount; i++) {
      const name = candidates[i]!;
      const client = this.get(name);

      if (!client) continue; // client was disabled between iterations

      try {
        this.logger.info(
          { name, attempt: i + 1, total: tryCount },
          'Fallback attempt',
        );
        const result = await client.makeRequest(
          systemPrompt,
          workspaceContext,
          memoryContext,
          timeoutConfig,
          tools,
        );
        if (i > 0) {
          this.fallbackStats.successfulFallbackRequests++;
          this.logger.info(
            { name, attempts: i + 1 },
            'Fallback succeeded',
          );
        }
        return result;
      } catch (error) {
        lastError = error;
        const parsed = parseError(error);
        // QuotaExceededError is per-client, so fallback to another client
        const isQuotaError = error instanceof QuotaExceededError;
        if (!parsed.retryable && !isQuotaError) {
          this.logger.warn(
            { name, errorCode: parsed.code },
            'Fallback stopped: non-retryable error',
          );
          throw error;
        }
        this.logger.warn(
          {
            name,
            errorCode: parsed.code,
            nextClient: candidates[i + 1] ?? 'none',
          },
          'Fallback: retryable error, trying next client',
        );
      }
    }

    throw lastError ?? new Error('All fallback clients failed');
  }

  /**
   * Implements ApiClient interface.
   *
   * Delegates to makeRequestWithFallback, providing automatic round-robin
   * and cross-client failover. This allows ClientPool to be used as a
   * drop-in replacement for any ApiClient.
   */
  async makeRequest(
    systemPrompt: string,
    workspaceContext: string,
    memoryContext: Message[],
    timeoutConfig?: ApiTimeoutConfig,
    tools?: ChatCompletionTool[],
  ): Promise<ApiResponse> {
    return this.makeRequestWithFallback(
      systemPrompt,
      workspaceContext,
      memoryContext,
      timeoutConfig,
      tools,
    );
  }

  // --- Enable / Disable ---

  /**
   * Enable a client so it can be retrieved via get().
   */
  enable(name: string): void {
    const entry = this.entries.get(name);
    if (entry) {
      entry.enabled = true;
      this.logger.info({ name }, 'Enabled client');
    }
  }

  /**
   * Disable a client so it cannot be retrieved via get().
   */
  disable(name: string): void {
    const entry = this.entries.get(name);
    if (entry) {
      entry.enabled = false;
      this.logger.info({ name }, 'Disabled client');
    }
  }

  // --- Health Check ---

  /**
   * Check the health of a single client.
   */
  async checkHealth(
    name: string,
    timeout?: number,
  ): Promise<HealthCheckResult> {
    const client = this.get(name);
    if (!client) {
      return {
        healthy: false,
        latencyMs: 0,
        error: `Client "${name}" not found or disabled`,
      };
    }
    const result = await checkClientHealth(client, timeout);
    this.logger.info(
      { name, healthy: result.healthy, latencyMs: result.latencyMs },
      'Health check',
    );
    return result;
  }

  /**
   * Check health of all enabled clients.
   */
  async checkAllHealth(
    timeout?: number,
  ): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    for (const name of this.list()) {
      results[name] = await this.checkHealth(name, timeout);
    }
    return results;
  }

  // --- Stats ---

  /**
   * Get stats for a single client.
   */
  getStats(name: string): ClientPoolEntryStats | undefined {
    return this.entries.get(name)?.stats;
  }

  /**
   * Get aggregate stats for the entire pool.
   */
  getPoolStats(): ClientPoolStats {
    let totalRequests = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let enabledClients = 0;
    const entries: Record<string, ClientPoolEntryStats> = {};

    for (const [name, entry] of this.entries) {
      entries[name] = entry.stats;
      totalRequests += entry.stats.totalRequests;
      totalPromptTokens += entry.stats.totalPromptTokens;
      totalCompletionTokens += entry.stats.totalCompletionTokens;
      if (entry.enabled) enabledClients++;
    }

    return {
      totalClients: this.entries.size,
      enabledClients,
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalFallbackRequests: this.fallbackStats.totalFallbackRequests,
      successfulFallbackRequests: this.fallbackStats
        .successfulFallbackRequests,
      entries,
    };
  }

  // --- Quota ---

  /**
   * Set quota limits for a client.
   */
  setQuota(name: string, quota: QuotaConfig): void {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new Error(`Client "${name}" not found`);
    }
    entry.quota = quota;
    entry.quotaUsage.resetIntervalMs = quota.resetIntervalMs ?? 3600000;
    entry.quotaUsage.periodStart = new Date();
    entry.quotaUsage.usedTokens = 0;
    entry.quotaUsage.usedRequests = 0;
    this.logger.info(
      { name, maxTokens: quota.maxTokens, maxRequests: quota.maxRequests },
      'Set quota',
    );
  }

  /**
   * Get current quota usage for a client.
   */
  getQuotaUsage(name: string): QuotaUsage | undefined {
    const entry = this.entries.get(name);
    if (!entry) return undefined;

    // Refresh period check
    checkQuotaPeriod(entry);
    return { ...entry.quotaUsage };
  }
}
