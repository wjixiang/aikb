import type { ApiClient } from '../types/api-client.js';
import type { ApiClientError } from '../errors/errors.js';
import type { ProviderSettings } from '../types/provider-settings.js';

/**
 * Configuration for registering a client in the pool.
 *
 * If `name` is omitted, an auto-generated ID is assigned.
 */
export interface PoolEntryConfig {
  /** Unique name to identify this client in the pool. Auto-generated if omitted. */
  name?: string;
  /** Provider settings used to create the client */
  settings: ProviderSettings;
  /** Whether this client is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Runtime entry in the pool
 */
export interface PoolEntry {
  name: string;
  client: ApiClient;
  settings: ProviderSettings;
  createdAt: Date;
  enabled: boolean;
  stats: ClientPoolEntryStats;
  quota?: QuotaConfig;
  quotaUsage: QuotaUsage;
}

/**
 * Per-client request statistics
 */
export interface ClientPoolEntryStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  lastUsedAt: Date | null;
  lastError: ApiClientError | null;
}

/**
 * Quota limits for a client
 */
export interface QuotaConfig {
  /** Maximum total tokens allowed per period */
  maxTokens?: number;
  /** Maximum number of requests allowed per period */
  maxRequests?: number;
  /** Reset interval in milliseconds (default: 3600000 = 1 hour) */
  resetIntervalMs?: number;
}

/**
 * Current quota usage for a client
 */
export interface QuotaUsage {
  usedTokens: number;
  usedRequests: number;
  periodStart: Date;
  resetIntervalMs: number;
}

/**
 * Aggregate pool statistics
 */
export interface ClientPoolStats {
  totalClients: number;
  enabledClients: number;
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  /** Total number of requests handled via fallback */
  totalFallbackRequests: number;
  /** Successful fallback requests (first client failed, subsequent succeeded) */
  successfulFallbackRequests: number;
  entries: Record<string, ClientPoolEntryStats>;
}

/**
 * Health check result for a single client
 */
export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Options for makeRequestWithFallback.
 */
export interface FallbackOptions {
  /**
   * Maximum number of clients to try before giving up.
   * Defaults to all enabled clients.
   */
  maxAttempts?: number;

  /**
   * Names of clients to skip (e.g., the one that was already tried
   * by the caller before deciding to use fallback).
   */
  skipClients?: string[];
}
