/**
 * Agent Arena Configuration Singleton
 *
 * Centralized configuration management for agent-arena.
 * Loads from .env file and provides typed access to all config values.
 */

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { providerNames } from 'llm-api-client';
import { isProviderName, type ProviderName } from 'llm-api-client';

// --- Schema ---

const arenaConfigSchema = z.object({
  // Database
  databaseUrl: z.string().default('postgresql://admin:fl5ox03@localhost:5432/agent_arena_test'),

  // LLM API
  apiProvider: z.string().default('openai'),
  apiKey: z.string().default(''),
  apiModel: z.string().default('gpt-4'),

  // Optional per-provider base URLs
  openAiBaseUrl: z.string().optional(),
  anthropicBaseUrl: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
  lmStudioBaseUrl: z.string().optional(),
  minimaxBaseUrl: z.string().optional(),
  moonshotBaseUrl: z.string().optional(),

  // Execution
  defaultTimeout: z.number().default(0),
});

export type ArenaConfig = z.infer<typeof arenaConfigSchema>;

// --- Singleton ---

let _config: ArenaConfig | null = null;

function parseConfig(): ArenaConfig {
  const result = arenaConfigSchema.safeParse({
    databaseUrl: process.env['AGENT_DATABASE_URL'] ?? process.env['DATABASE_URL'],
    apiProvider: process.env['API_PROVIDER'],
    apiKey: process.env['API_KEY'],
    apiModel: process.env['API_MODEL'],
    openAiBaseUrl: process.env['OPENAI_BASE_URL'],
    anthropicBaseUrl: process.env['ANTHROPIC_BASE_URL'],
    ollamaBaseUrl: process.env['OLLAMA_BASE_URL'],
    lmStudioBaseUrl: process.env['LMSTUDIO_BASE_URL'],
    minimaxBaseUrl: process.env['MINIMAX_BASE_URL'],
    moonshotBaseUrl: process.env['MOONSHOT_BASE_URL'],
    defaultTimeout: process.env['DEFAULT_TIMEOUT']
      ? parseInt(process.env['DEFAULT_TIMEOUT'], 10)
      : undefined,
  });

  if (!result.success) {
    throw new Error(
      `Invalid arena config: ${result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
    );
  }

  return result.data;
}

export function getConfig(): ArenaConfig {
  if (!_config) {
    // Load .env file if not already loaded
    loadDotenv();
    _config = parseConfig();
  }
  return _config;
}

/**
 * Get validated provider name with fallback
 */
export function getProvider(): ProviderName {
  const cfg = getConfig();
  if (isProviderName(cfg.apiProvider)) {
    return cfg.apiProvider;
  }
  return 'openai';
}

/**
 * Build ProviderSettings from config for live mode
 */
export function getLiveProviderSettings(overrides?: {
  provider?: string;
  model?: string;
  apiKey?: string;
}): {
  apiProvider: ProviderName;
  apiKey: string;
  apiModelId: string;
  openAiBaseUrl?: string;
  anthropicBaseUrl?: string;
  ollamaBaseUrl?: string;
  lmStudioBaseUrl?: string;
  minimaxBaseUrl?: string;
  moonshotBaseUrl?: string;
} {
  const cfg = getConfig();
  const provider = (overrides?.provider ?? cfg.apiProvider) as ProviderName;
  const result: {
    apiProvider: ProviderName;
    apiKey: string;
    apiModelId: string;
    openAiBaseUrl?: string;
    anthropicBaseUrl?: string;
    ollamaBaseUrl?: string;
    lmStudioBaseUrl?: string;
    minimaxBaseUrl?: string;
    moonshotBaseUrl?: string;
  } = {
    apiProvider: isProviderName(provider) ? provider : 'openai',
    apiKey: overrides?.apiKey ?? cfg.apiKey,
    apiModelId: overrides?.model ?? cfg.apiModel,
  };
  if (cfg.openAiBaseUrl) result.openAiBaseUrl = cfg.openAiBaseUrl;
  if (cfg.anthropicBaseUrl) result.anthropicBaseUrl = cfg.anthropicBaseUrl;
  if (cfg.ollamaBaseUrl) result.ollamaBaseUrl = cfg.ollamaBaseUrl;
  if (cfg.lmStudioBaseUrl) result.lmStudioBaseUrl = cfg.lmStudioBaseUrl;
  if (cfg.minimaxBaseUrl) result.minimaxBaseUrl = cfg.minimaxBaseUrl;
  if (cfg.moonshotBaseUrl) result.moonshotBaseUrl = cfg.moonshotBaseUrl;
  return result;
}

/**
 * Reload config (useful for testing or runtime config changes)
 */
export function reloadConfig(): ArenaConfig {
  _config = null;
  return getConfig();
}
