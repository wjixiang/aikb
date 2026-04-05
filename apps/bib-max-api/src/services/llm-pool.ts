import { ClientPool } from 'llm-api-client';
import type {
  ApiClient,
  PoolEntryConfig,
  ProviderSettings,
  ProviderName,
} from 'llm-api-client';
import { config, type LlmClientConfig } from '../config.js';

/**
 * Map a generic `baseUrl` from LlmClientConfig to the correct
 * provider-specific field in ProviderSettings.
 */
function applyBaseUrl(
  settings: ProviderSettings,
  provider: string,
  baseUrl: string,
): ProviderSettings {
  const urlKey = (
    {
      openai: 'openAiBaseUrl',
      'openai-native': 'openAiNativeBaseUrl',
      anthropic: 'anthropicBaseUrl',
      moonshot: 'moonshotBaseUrl',
      ollama: 'ollamaBaseUrl',
      lmstudio: 'lmStudioBaseUrl',
      minimax: 'minimaxBaseUrl',
    } as Record<string, keyof ProviderSettings>
  )[provider];

  if (urlKey) {
    return { ...settings, [urlKey]: baseUrl };
  }

  // Unknown provider — ignore baseUrl
  return settings;
}

function clientConfigToEntry(client: LlmClientConfig): PoolEntryConfig {
  const settings: ProviderSettings = {
    apiProvider: client.provider as ProviderName,
    apiKey: client.apiKey,
    apiModelId: client.modelId,
    modelMaxTokens: client.maxTokens ?? 4096,
    modelTemperature: client.temperature ?? 0.1,
  };

  if (client.baseUrl) {
    Object.assign(settings, applyBaseUrl(settings, client.provider, client.baseUrl));
  }

  return { name: client.name, settings };
}

/**
 * Initialize the LLM client pool singleton.
 *
 * Should be called once during server startup (in createApp).
 * After initialization, all LLM calls should obtain clients
 * via `getLlmClient()`.
 */
export function initLlmPool(): ClientPool {
  const pool = ClientPool.getInstance();

  // Skip registration if already initialized (e.g., hot reload)
  if (pool.list().length > 0) {
    return pool;
  }

  for (const client of config.llm.clients) {
    pool.register(clientConfigToEntry(client));
  }

  return pool;
}

/**
 * Get a client from the global LLM pool by name.
 *
 * If `name` is omitted, returns the first available client.
 *
 * @returns The ApiClient instance
 * @throws Error if no client is found
 */
export function getLlmClient(name?: string): ApiClient {
  const pool = ClientPool.getInstance();
  let client: ApiClient | undefined;

  if (name) {
    client = pool.get(name);
  } else {
    const names = pool.list();
    if (names.length > 0) {
      client = pool.get(names[0]!);
    }
  }

  if (!client) {
    throw new Error(
      name
        ? `LLM client "${name}" not found in pool`
        : 'No LLM client available. Configure LLM_CLIENTS or LLM_API_KEY.',
    );
  }

  return client;
}
