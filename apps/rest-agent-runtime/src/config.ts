export interface AppConfig {
  port: number;
  host: string;
  apiProvider: string;
  apiKey: string;
  apiModelId: string;
  apiBaseUrl: string | undefined;
  apiTimeout: number | undefined;
  databaseUrl: string | undefined;
  logLevel: string;
}

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(envOrDefault('PORT', '3000'), 10),
    host: envOrDefault('HOST', '0.0.0.0'),
    apiProvider: envOrThrow('API_PROVIDER'),
    apiKey: envOrThrow('API_KEY'),
    apiModelId: envOrThrow('API_MODEL_ID'),
    apiBaseUrl: process.env['API_BASE_URL'],
    apiTimeout: process.env['API_TIMEOUT']
      ? parseInt(process.env['API_TIMEOUT'], 10)
      : undefined,
    databaseUrl: process.env['DATABASE_URL'],
    logLevel: envOrDefault('LOG_LEVEL', 'info'),
  };
}
