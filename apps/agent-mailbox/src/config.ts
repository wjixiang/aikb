/**
 * Application configuration
 * Loads and validates environment variables
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

/**
 * Configuration validation error
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validate that a required environment variable exists
 * @param name - Environment variable name
 * @returns The value
 * @throws ConfigValidationError if not set
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new ConfigValidationError(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get environment variable with default value
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The value or default
 */
function getEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

/**
 * Parse integer from environment variable
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Parsed integer
 */
function getEnvInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigValidationError(`Environment variable ${name} must be a valid integer`);
  }
  return parsed;
}

/**
 * Parse boolean from environment variable
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Parsed boolean
 */
function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Validate port number
 * @param port - Port number to validate
 * @returns Validated port number
 * @throws ConfigValidationError if invalid
 */
function validatePort(port: number): number {
  if (port < 1 || port > 65535) {
    throw new ConfigValidationError(`Port must be between 1 and 65535, got ${port}`);
  }
  return port;
}

/**
 * Validate database URL format
 * @param url - Database URL to validate
 * @returns Validated URL
 * @throws ConfigValidationError if invalid
 */
function validateDatabaseUrl(url: string): string {
  const postgresPattern = /^postgresql:\/\//;
  if (!postgresPattern.test(url)) {
    throw new ConfigValidationError(
      'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://'
    );
  }
  return url;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Log level */
  logLevel: string;
  /** Enable request logging */
  requestLogging: boolean;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** PostgreSQL connection URL */
  url: string;
  /** Enable query logging */
  logQueries: boolean;
  /** Connection pool size */
  poolSize: number;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  /** Allowed origins */
  origin: string | string[];
  /** Allowed methods */
  methods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Allow credentials */
  credentials: boolean;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
  /** Enable WebSocket */
  enabled: boolean;
  /** Ping interval in milliseconds */
  pingInterval: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;
  /** Max requests per window for general endpoints */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per minute for send endpoint */
  sendMaxRequests: number;
  /** Max requests per minute for inbox endpoint */
  inboxMaxRequests: number;
  /** Max requests per minute for search endpoint */
  searchMaxRequests: number;
  /** Max requests per minute for register endpoint */
  registerMaxRequests: number;
  /** Max WebSocket connections per IP */
  maxWsConnectionsPerIp: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** Enable Helmet security headers */
  enableHelmet: boolean;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** JWT secret for token verification (optional) */
  jwtSecret?: string;
  /** Enable CORS */
  enableCors: boolean;
  /** Enable input sanitization */
  enableSanitization: boolean;
  /** Enable input validation */
  enableValidation: boolean;
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Environment name */
  env: string;
  /** Server configuration */
  server: ServerConfig;
  /** Database configuration */
  database: DatabaseConfig;
  /** CORS configuration */
  cors: CorsConfig;
  /** WebSocket configuration */
  websocket: WebSocketConfig;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** Security configuration */
  security: SecurityConfig;
}

/**
 * Load and validate configuration
 * @returns Validated application configuration
 * @throws ConfigValidationError if configuration is invalid
 */
function loadConfig(): AppConfig {
  const env = getEnv('NODE_ENV', 'development');
  const isDevelopment = env === 'development';
  const isProduction = env === 'production';

  // Server configuration
  const server: ServerConfig = {
    port: validatePort(getEnvInt('PORT', 3000)),
    host: getEnv('HOST', '0.0.0.0'),
    logLevel: getEnv('LOG_LEVEL', isDevelopment ? 'debug' : 'info'),
    requestLogging: getEnvBool('REQUEST_LOGGING', !isProduction),
  };

  // Database configuration
  const database: DatabaseConfig = {
    url: validateDatabaseUrl(requireEnv('DATABASE_URL')),
    logQueries: getEnvBool('DB_LOG_QUERIES', isDevelopment),
    poolSize: getEnvInt('DB_POOL_SIZE', 10),
  };

  // CORS configuration
  const corsOrigin = getEnv('CORS_ORIGIN', '*');
  const cors: CorsConfig = {
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
    methods: getEnv('CORS_METHODS', 'GET,POST,PUT,DELETE,PATCH,OPTIONS').split(',').map(m => m.trim()),
    allowedHeaders: getEnv('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization').split(',').map(h => h.trim()),
    credentials: getEnvBool('CORS_CREDENTIALS', false),
  };

  // WebSocket configuration
  const websocket: WebSocketConfig = {
    enabled: getEnvBool('WS_ENABLED', true),
    pingInterval: getEnvInt('WS_PING_INTERVAL', 30000),
    connectionTimeout: getEnvInt('WS_CONNECTION_TIMEOUT', 5000),
  };

  // Rate limiting configuration
  const rateLimit: RateLimitConfig = {
    enabled: getEnvBool('RATE_LIMIT_ENABLED', isProduction),
    maxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100),
    windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
    sendMaxRequests: getEnvInt('RATE_LIMIT_SEND_MAX', 100),
    inboxMaxRequests: getEnvInt('RATE_LIMIT_INBOX_MAX', 300),
    searchMaxRequests: getEnvInt('RATE_LIMIT_SEARCH_MAX', 50),
    registerMaxRequests: getEnvInt('RATE_LIMIT_REGISTER_MAX', 10),
    maxWsConnectionsPerIp: getEnvInt('RATE_LIMIT_WS_CONNECTIONS_PER_IP', 10),
  };

  // Security configuration
  const security: SecurityConfig = {
    enableHelmet: getEnvBool('SECURITY_ENABLE_HELMET', true),
    apiKey: process.env['API_KEY'],
    jwtSecret: process.env['JWT_SECRET'],
    enableCors: getEnvBool('SECURITY_ENABLE_CORS', true),
    enableSanitization: getEnvBool('SECURITY_ENABLE_SANITIZATION', true),
    enableValidation: getEnvBool('SECURITY_ENABLE_VALIDATION', true),
  };

  return {
    env,
    server,
    database,
    cors,
    websocket,
    rateLimit,
    security,
  };
}

/**
 * Application configuration (singleton)
 */
export const config: AppConfig = loadConfig();

/**
 * Check if running in development mode
 * @returns True if development environment
 */
export function isDevelopment(): boolean {
  return config.env === 'development';
}

/**
 * Check if running in production mode
 * @returns True if production environment
 */
export function isProduction(): boolean {
  return config.env === 'production';
}

/**
 * Check if running in test mode
 * @returns True if test environment
 */
export function isTest(): boolean {
  return config.env === 'test';
}

export default config;
