/**
 * Configuration loader for agent-cli
 *
 * Supports:
 * - .agent-clirc (YAML/JSON)
 * - agent-cli.config.js
 * - Environment variables
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';

export interface AgentCliConfig {
  runtime?: {
    messageBus?: 'memory' | 'redis';
    redis?: {
      url?: string;
      host?: string;
      port?: number;
      password?: string;
      db?: number;
    };
  };
  api?: {
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  agent?: {
    defaultType?: string;
    autoStart?: boolean;
  };
  monitor?: {
    refreshInterval?: number;
    compact?: boolean;
  };
  log?: {
    level?: string;
    format?: 'pretty' | 'json';
  };
}

/**
 * Load configuration from file
 */
export function loadConfig(
  configPath: string = '.agent-clirc',
): AgentCliConfig {
  const paths = [
    resolve(process.cwd(), configPath),
    resolve(process.cwd(), 'agent-cli.config.js'),
    resolve(homedir(), '.agent-clirc'),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return loadConfigFile(path);
    }
  }

  return {};
}

/**
 * Load configuration from specific file
 */
function loadConfigFile(filePath: string): AgentCliConfig {
  try {
    const content = readFileSync(filePath, 'utf-8');

    if (filePath.endsWith('.js')) {
      // ESM import for .js config files
      // Note: This requires dynamic import which is async
      // For now, return empty config
      return {};
    }

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return parseYaml(content) as AgentCliConfig;
    }

    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }

    // Try to parse as YAML first, then JSON
    try {
      return parseYaml(content) as AgentCliConfig;
    } catch {
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`Warning: Failed to load config from ${filePath}:`, error);
    return {};
  }
}

/**
 * Get environment variable with optional fallback
 */
export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback;
}

/**
 * Get API key from environment or config
 */
export function getApiKey(config?: AgentCliConfig): string {
  return config?.api?.apiKey || process.env['OPENAI_API_KEY'] || '';
}
