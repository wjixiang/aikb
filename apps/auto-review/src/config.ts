import { config as envConfig } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
envConfig()
// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
envConfig({ path: join(projectRoot, '.env') });

export interface AppConfig {
  port: number;
  databaseUrl: string;
  llmApiUrl: string;
  llmApiKey: string;
  mineruToken: string;
  mineruDownloadDir: string;
  fileRendererUrl: string;
  cors: {
    origin: boolean | string | string[];
    credentials: boolean;
  };
  swagger: {
    enabled: boolean;
    path: string;
  };
  uploads: {
    dir: string;
    maxFileSize: number;
  };
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  llmApiUrl: process.env.LLM_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages',
  llmApiKey: process.env.MINIMAX_API_KEY || '',
  mineruToken: process.env.MINERU_TOKEN || '',
  mineruDownloadDir: process.env.MINERU_DOWNLOAD_DIR || './mineru-downloads',
  fileRendererUrl: process.env.FILE_RENDERER_URL || 'http://localhost:8000',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
    path: '/docs',
  },
  uploads: {
    dir: process.env.UPLOADS_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB default
  },
};

// Validate required config
function validateConfig() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  if (!config.llmApiKey) {
    console.warn('MINIMAX_API_KEY environment variable is not set. Literature summary endpoints may not work.');
  }
}

validateConfig();

export default config;
