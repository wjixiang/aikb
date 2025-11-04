import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { NextRequest } from 'next/server';

// 日志级别定义
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

// 日志上下文接口
export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

// 增强的日志记录器类
export class EnhancedLogger {
  private logger: winston.Logger;
  private prefix: string;

  constructor(
    prefix: string,
    options?: {
      level?: string;
      enableConsole?: boolean;
      enableFile?: boolean;
      enableRemote?: boolean;
      logDir?: string;
    },
  ) {
    this.prefix = prefix;
    const {
      level = process.env.LOG_LEVEL || 'info',
      enableConsole = process.env.NODE_ENV !== 'production',
      enableFile = true,
      enableRemote = process.env.NODE_ENV === 'production',
      logDir = process.env.LOG_DIR || './logs',
    } = options || {};

    // 创建传输器数组
    const transports: winston.transport[] = [];

    // 控制台传输器（开发环境）
    if (enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta, null, 2)
                : '';
              return `[${timestamp}] [${prefix}:${level}] ${message} ${metaStr}`;
            }),
          ),
        }),
      );
    }

    // 文件传输器
    if (enableFile) {
      // 错误日志文件
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/error-${prefix}-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
      );

      // 组合日志文件
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/combined-${prefix}-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
      );

      // 访问日志文件（HTTP请求）
      transports.push(
        new DailyRotateFile({
          filename: `${logDir}/access-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          level: 'http',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
          maxSize: '20m',
          maxFiles: '7d',
          zippedArchive: true,
        }),
      );
    }

    // 远程日志传输器（生产环境）
    if (enableRemote && process.env.LOG_REMOTE_URL) {
      // 这里可以添加远程日志服务，如 ELK Stack, Loggly, Papertrail 等
      // 示例：使用 HTTP 传输器发送到远程日志服务
      transports.push(
        new winston.transports.Http({
          host: process.env.LOG_REMOTE_HOST,
          port: parseInt(process.env.LOG_REMOTE_PORT || '80'),
          path: process.env.LOG_REMOTE_PATH || '/logs',
          level: 'warn',
          format: winston.format.json(),
        }),
      );
    }

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: prefix },
      transports,
    });
  }

  // 基础日志方法
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    const logData: any = {
      message,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.logger.log(level, message, logData);
  }

  // 各种级别的日志方法
  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  http(message: string, context?: LogContext): void {
    this.log(LogLevel.HTTP, message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // 记录HTTP请求
  logRequest(request: NextRequest, responseTime?: number): void {
    const context: LogContext = {
      method: request.method,
      url: request.url,
      ip:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      responseTime,
    };

    this.http(`${request.method} ${request.url}`, context);
  }

  // 记录API响应
  logResponse(
    request: NextRequest,
    statusCode: number,
    responseTime: number,
    context?: LogContext,
  ): void {
    const logContext: LogContext = {
      method: request.method,
      url: request.url,
      statusCode,
      responseTime,
      ...context,
    };

    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.HTTP;
    this.log(
      level,
      `${request.method} ${request.url} - ${statusCode}`,
      logContext,
    );
  }

  // 记录用户操作
  logUserAction(action: string, userId: string, context?: LogContext): void {
    this.info(`User action: ${action}`, { userId, action, ...context });
  }

  // 记录性能指标
  logPerformance(
    operation: string,
    duration: number,
    context?: LogContext,
  ): void {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...context,
    });
  }

  // 记录安全事件
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogContext,
  ): void {
    const level =
      severity === 'critical' || severity === 'high'
        ? LogLevel.ERROR
        : LogLevel.WARN;
    this.log(level, `Security event: ${event}`, {
      event,
      severity,
      ...context,
    });
  }

  // 记录数据库操作
  logDatabase(
    operation: string,
    collection: string,
    duration?: number,
    context?: LogContext,
  ): void {
    this.debug(`DB operation: ${operation} on ${collection}`, {
      operation,
      collection,
      duration,
      ...context,
    });
  }

  // 记录外部API调用
  logExternalApi(
    api: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    this.log(level, `External API: ${method} ${api} - ${statusCode}`, {
      api,
      method,
      statusCode,
      duration,
      ...context,
    });
  }
}

// 创建带有前缀的日志记录器工厂函数
export const createEnhancedLogger = (
  prefix: string,
  options?: {
    level?: string;
    enableConsole?: boolean;
    enableFile?: boolean;
    enableRemote?: boolean;
    logDir?: string;
  },
): EnhancedLogger => {
  return new EnhancedLogger(prefix, options);
};

// 默认导出增强的日志记录器类
export default EnhancedLogger;
