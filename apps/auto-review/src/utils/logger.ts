/**
 * Simple logger utility to replace NestJS Logger
 */

type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  error(message: string, error?: any): void {
    if (error) {
      console.error(this.format('error', message), error);
    } else {
      console.error(this.format('error', message));
    }
  }

  warn(message: string): void {
    console.warn(this.format('warn', message));
  }

  log(message: string): void {
    console.log(this.format('log', message));
  }

  debug(message: string): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'verbose') {
      console.log(this.format('debug', message));
    }
  }

  verbose(message: string): void {
    if (process.env.LOG_LEVEL === 'verbose') {
      console.log(this.format('verbose', message));
    }
  }
}
