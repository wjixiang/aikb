/**
 * Application Configuration
 *
 * Loads configuration from environment variables and config files.
 */

export interface ServerConfig {
  id: string;
  host: string;
  port: number;
  logLevel: string;
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
}

/**
 * Provider → env var mapping for API keys.
 * Falls back to OPENAI_API_KEY / GLM_API_KEY for backward compatibility.
 */
const PROVIDER_KEY_ENV: Record<string, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY', 'GLM_API_KEY'],
  'openai-native': ['OPENAI_API_KEY'],
  minimax: ['MINIMAX_API_KEY'],
  moonshot: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
  ollama: [],
  lmstudio: [],
  zai: ['ZAI_API_KEY', 'GLM_API_KEY'],
};

function resolveApiKey(provider: string): string {
  const candidates = PROVIDER_KEY_ENV[provider];
  if (candidates) {
    for (const envVar of candidates) {
      const val = process.env[envVar];
      if (val) return val;
    }
  }
  // Backward compatibility fallback
  return process.env['OPENAI_API_KEY'] || process.env['GLM_API_KEY'] || '';
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const serverId = process.env['SERVER_ID'] || `swarm-${Date.now()}`;

  const serverHost = process.env['SERVER_HOST'] || '0.0.0.0';
  const serverPort = parseInt(process.env['PORT'] || '9400');
  const restBaseUrl =
    process.env['SWARM_REST_BASE_URL'] ||
    (serverHost === '0.0.0.0'
      ? `http://localhost:${serverPort}`
      : `http://${serverHost}:${serverPort}`);

  return {
    server: {
      id: serverId,
      host: serverHost,
      port: serverPort,
      logLevel: process.env['LOG_LEVEL'] || 'info',
    },
    api: {
      apiProvider: process.env['API_PROVIDER'] || 'openai',
      apiKey: resolveApiKey(process.env['API_PROVIDER'] || 'openai'),
      openAiBaseUrl: process.env['API_BASE_URL'] || '',
      apiModelId: process.env['API_MODEL_ID'] || '',
      timeout: parseInt(process.env['API_TIMEOUT'] || '120000'),
    },
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
}
