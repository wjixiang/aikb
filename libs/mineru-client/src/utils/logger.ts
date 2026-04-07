import pino from 'pino';

export interface LoggerOptions {
  enableLogging?: boolean;
  logger?: pino.Logger;
  component: string;
}

export function createLogger(options: LoggerOptions): pino.Logger {
  if (options.logger) {
    return options.logger.child({ component: options.component });
  }
  return pino({
    level: options.enableLogging !== false ? 'info' : 'silent',
    formatters: {
      level: (label) => {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }).child({ component: options.component });
}
