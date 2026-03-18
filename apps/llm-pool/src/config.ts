/**
 * LLM Pool - Load Balancer Configuration
 *
 * Supports multiple backend providers with different strategies
 */

import { z } from 'zod';

// Backend provider configuration
export const BackendConfigSchema = z.object({
  /** Unique identifier for this backend */
  id: z.string(),
  /** Provider type: openai, anthropic, ollama, etc. */
  provider: z.enum(['openai', 'anthropic', 'ollama', 'lmstudio', 'moonshot', 'minimax', 'custom']),
  /** API base URL */
  baseUrl: z.string().optional(),
  /** API key for authentication */
  apiKey: z.string(),
  /** Model ID to use */
  model: z.string(),
  /** Weight for weighted load balancing (higher = more requests) */
  weight: z.number().int().positive().default(1),
  /** Maximum concurrent requests to this backend */
  maxConcurrent: z.number().int().positive().default(10),
  /** Request timeout in milliseconds */
  timeout: z.number().int().positive().default(60000),
  /** Whether this backend is enabled */
  enabled: z.boolean().default(true),
  /** Custom headers to include in requests */
  headers: z.record(z.string()).optional(),
  /** Temperature setting for this backend */
  temperature: z.number().min(0).max(2).optional(),
  /** Max tokens setting for this backend */
  maxTokens: z.number().int().positive().optional(),
});

export type BackendConfig = z.infer<typeof BackendConfigSchema>;

// Load balancing strategy
export const LoadBalancingStrategySchema = z.enum(['round-robin', 'weighted', 'least-loaded', 'random', 'failover']);
export type LoadBalancingStrategy = z.infer<typeof LoadBalancingStrategySchema>;

// Virtual model configuration (the model exposed to clients)
export const VirtualModelConfigSchema = z.object({
  /** Virtual model name that clients will use */
  name: z.string(),
  /** Strategy for load balancing across backends */
  strategy: LoadBalancingStrategySchema.default('weighted'),
  /** List of backend configurations to use */
  backends: z.array(z.string()), // References backend IDs
  /** Fallback behavior: 'retry' | 'error' | 'next-backend' */
  fallback: z.enum(['retry', 'error', 'next-backend']).default('next-backend'),
  /** Whether to enable streaming for this model */
  streamingEnabled: z.boolean().default(true),
  /** Default temperature for this model */
  temperature: z.number().min(0).max(2).optional(),
  /** Default max tokens for this model */
  maxTokens: z.number().int().positive().optional(),
});

export type VirtualModelConfig = z.infer<typeof VirtualModelConfigSchema>;

// Server configuration
export const ServerConfigSchema = z.object({
  /** Server host */
  host: z.string().default('0.0.0.0'),
  /** Server port */
  port: z.number().int().min(1).max(65535).default(3000),
  /** CORS settings */
  cors: z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string()).default(['*']),
  }).default({}),
  /** Logging level */
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** API authentication */
  auth: z.object({
    enabled: z.boolean().default(false),
    apiKeys: z.array(z.string()).default([]),
  }).default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// Complete configuration
export const ConfigSchema = z.object({
  server: ServerConfigSchema.default({}),
  backends: z.array(BackendConfigSchema),
  virtualModels: z.array(VirtualModelConfigSchema),
});

export type Config = z.infer<typeof ConfigSchema>;

// Default configuration example
export const defaultConfig: Config = {
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: {
      enabled: true,
      origins: ['*'],
    },
    logLevel: 'info',
    auth: {
      enabled: false,
      apiKeys: [],
    },
  },
  backends: [
    {
      id: 'openai-gpt4',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      weight: 1,
      maxConcurrent: 10,
      timeout: 60000,
      enabled: true,
    },
    {
      id: 'anthropic-claude',
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-sonnet-20241022',
      weight: 1,
      maxConcurrent: 10,
      timeout: 60000,
      enabled: true,
    },
  ],
  virtualModels: [
    {
      name: 'gpt-4',
      strategy: 'weighted',
      backends: ['openai-gpt4'],
      fallback: 'next-backend',
      streamingEnabled: true,
    },
    {
      name: 'claude-sonnet',
      strategy: 'weighted',
      backends: ['anthropic-claude'],
      fallback: 'next-backend',
      streamingEnabled: true,
    },
  ],
};
