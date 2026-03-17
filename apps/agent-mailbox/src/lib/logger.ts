import { FastifyRequest } from 'fastify';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get request ID from Fastify request or generate new one
 */
export function getRequestId(req?: FastifyRequest): string {
  if (req?.id) {
    return String(req.id);
  }
  return generateRequestId();
}

/**
 * Format log entry as JSON string
 */
function formatLogEntry(entry: LogEntry): string {
  const logData: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level.toUpperCase(),
    message: entry.message,
  };

  if (entry.requestId) {
    logData.requestId = entry.requestId;
  }

  if (entry.context && Object.keys(entry.context).length > 0) {
    logData.context = entry.context;
  }

  if (entry.error) {
    logData.error = {
      name: entry.error.name,
      message: entry.error.message,
      stack: entry.error.stack,
    };
  }

  return JSON.stringify(logData);
}

/**
 * Write log to stdout/stderr
 */
function writeLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  if (entry.level === 'error') {
    console.error(formatted);
  } else if (entry.level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private requestId?: string;
  private defaultContext: Record<string, unknown>;

  constructor(requestId?: string, defaultContext: Record<string, unknown> = {}) {
    this.requestId = requestId;
    this.defaultContext = defaultContext;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger(this.requestId, { ...this.defaultContext, ...context });
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.requestId,
      context: { ...this.defaultContext, ...context },
      error,
    };

    writeLog(entry);
  }
}

/**
 * Create a logger from a Fastify request
 */
export function createLogger(req?: FastifyRequest, context?: Record<string, unknown>): Logger {
  const requestId = getRequestId(req);
  return new Logger(requestId, context);
}

/**
 * Global logger instance (for use outside of request context)
 */
export const globalLogger = new Logger();

/**
 * Log HTTP request start
 */
export function logRequestStart(
  req: FastifyRequest,
  context?: Record<string, unknown>,
): Logger {
  const logger = createLogger(req, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    ...context,
  });

  logger.info('Request started', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return logger;
}

/**
 * Log HTTP request completion
 */
export function logRequestComplete(
  logger: Logger,
  statusCode: number,
  durationMs: number,
  context?: Record<string, unknown>,
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  const logData = {
    statusCode,
    durationMs,
    ...context,
  };

  if (level === 'error') {
    logger.error('Request completed with error', undefined, logData);
  } else if (level === 'warn') {
    logger.warn('Request completed with warning', logData);
  } else {
    logger.info('Request completed', logData);
  }
}
