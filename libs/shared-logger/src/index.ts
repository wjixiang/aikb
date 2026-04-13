import pino from 'pino';

export type Logger = pino.Logger;

export interface SharedLoggerOptions {
  name: string;
  level?: string;
  enablePretty?: boolean;
}

let rootLogger: pino.Logger | undefined;

export function initLogger(options?: SharedLoggerOptions | string, verbose?: boolean): pino.Logger {
  let level: string | undefined;
  let name = 'app';
  let enablePretty = true;

  if (typeof options === 'string') {
    level = verbose ? 'debug' : options;
  } else if (options) {
    level = options.level;
    name = options.name || 'app';
    enablePretty = options.enablePretty !== false;
  }

  rootLogger = pino({
    name,
    level: level || process.env['LOG_LEVEL'] || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    ...(enablePretty && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    }),
  });
  return rootLogger;
}

export function getLogger(name?: string): pino.Logger {
  if (!rootLogger) {
    initLogger();
  }
  if (name) {
    return rootLogger!.child({ module: name });
  }
  return rootLogger!;
}

export function createChildLogger(parent: pino.Logger, bindings: Record<string, unknown>): pino.Logger {
  return parent.child(bindings);
}

export { pino };
