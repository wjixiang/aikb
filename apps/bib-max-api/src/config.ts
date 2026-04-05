import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * LLM client configuration.
 *
 * Supports multiple clients via LLM_CLIENTS JSON array env var, or a
 * single client via the legacy LLM_PROVIDER / LLM_API_KEY / LLM_MODEL_ID
 * env vars (mapped to a client named "default").
 *
 * Each entry:
 * - name:        unique identifier in the pool (auto-generated if omitted)
 * - provider:    one of anthropic, openai, openai-native, zai, moonshot,
 *                ollama, lmstudio, minimax
 * - apiKey:      API key
 * - modelId:     model identifier
 * - baseUrl:     optional custom base URL (overriding the provider default)
 * - maxTokens:   optional max output tokens (default: 4096)
 * - temperature: optional sampling temperature (default: 0.1)
 */
export interface LlmClientConfig {
  name?: string;
  provider: string;
  apiKey: string;
  modelId: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

function parseLlmClients(): LlmClientConfig[] {
  // Try JSON array first: LLM_CLIENTS='[{"provider":"zai",...},...]'
  const raw = process.env['LLM_CLIENTS'];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      throw new Error('LLM_CLIENTS must be a valid JSON array');
    }
  }

  // Fallback: legacy single-client env vars
  const provider = process.env['LLM_PROVIDER'] || 'zai';
  const apiKey = process.env['LLM_API_KEY'] || '';
  const modelId = process.env['LLM_MODEL_ID'] || 'glm-4-flash';
  const baseUrl = process.env['LLM_BASE_URL'] || undefined;

  if (!apiKey) {
    return [];
  }

  return [{ name: 'default', provider, apiKey, modelId, baseUrl }];
}

export const config = {
  port: Number(process.env['PORT']) || 4000,
  host: process.env['APP_HOST'] || '0.0.0.0',
  databaseUrl: process.env['DATABASE_URL'],
  corsOrigin: process.env['CORS_ORIGIN'] || 'http://localhost:5173',
  s3: {
    endpoint: process.env['S3_ENDPOINT'],
    region: process.env['S3_REGION'] || 'us-east-1',
    bucket: process.env['S3_BUCKET'],
    accessKeyId: process.env['S3_ACCESS_KEY_ID'],
    secretAccessKey: process.env['S3_SECRET_ACCESS_KEY'],
    forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true',
    publicUrl: process.env['S3_PUBLIC_URL'],
  },
  llm: {
    clients: parseLlmClients(),
  },
  agent: {
    databaseUrl: process.env['AGENT_DATABASE_URL'] || undefined,
  },
} as const;

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}
