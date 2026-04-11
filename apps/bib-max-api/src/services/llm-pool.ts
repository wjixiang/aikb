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
 * Get the global LLM pool as an ApiClient.
 *
 * The pool implements round-robin selection and cross-client fallback,
 * so callers automatically benefit from load balancing and failover.
 *
 * @returns The ClientPool instance (which implements ApiClient)
 */
export function getLlmClient(): ApiClient {
  const pool = ClientPool.getInstance();
  if (pool.list().length === 0) {
    throw new Error(
      'No LLM client available. Configure LLM_CLIENTS or LLM_API_KEY.',
    );
  }
  return pool;
}
