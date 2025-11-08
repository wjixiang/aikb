import winston from 'winston';

export const createLoggerWithPrefix = (prefix: string) => {
  const logger = winston.createLogger({
    level: 'debug', // Set a base level, transports can override
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message }) => {
        return `[${prefix}:${level}] ${message}`;
      }),
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
    ],
  });

  return logger;
};

class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.prefix}:debug] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.prefix}:info] ${message}`, ...args);
  }

  warning(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}:warn] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}:error] ${message}`, ...args);
  }
}

export default Logger;
