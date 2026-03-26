/**
 * Logger for agent-cli
 *
 * Provides structured logging with different levels and formats.
 */

import * as pino from 'pino';

let logger: pino.Logger;

export function initLogger(level: string = 'info', verbose: boolean = false): void {
  logger = pino({
    level: verbose ? 'debug' : level,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  });
}

export function getLogger(): pino.Logger {
  if (!logger) {
    initLogger();
  }
  return logger;
}

/**
 * Log levels
 */
export const log = {
  debug: (msg: string, ...args: unknown[]) => getLogger().debug({ msg, args }),
  info: (msg: string, ...args: unknown[]) => getLogger().info({ msg, args }),
  warn: (msg: string, ...args: unknown[]) => getLogger().warn({ msg, args }),
  error: (msg: string, ...args: unknown[]) => getLogger().error({ msg, args }),
};
