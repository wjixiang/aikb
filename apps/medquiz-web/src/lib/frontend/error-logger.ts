import { createEnhancedLogger } from '@/lib/console/enhanced-logger';

// 前端错误日志记录器
const frontendLogger = createEnhancedLogger('FRONTEND', {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  enableConsole: true,
  enableFile: false, // 前端不写文件
  enableRemote: process.env.NODE_ENV === 'production',
});

// 错误类型枚举
export enum ErrorType {
  JAVASCRIPT = 'javascript',
  NETWORK = 'network',
  PROMISE = 'promise',
  RESOURCE = 'resource',
  CUSTOM = 'custom',
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// 错误上下文接口
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  page?: string;
  component?: string;
  action?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
  [key: string]: any;
}

// 前端错误接口
export interface FrontendError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  timestamp: number;
}

// 错误收集器类
export class ErrorCollector {
  private static instance: ErrorCollector;
  private errors: FrontendError[] = [];
  private maxErrors = 100; // 内存中最多保存的错误数量
  private isOnline = navigator.onLine;

  private constructor() {
    this.setupEventListeners();
  }

  public static getInstance(): ErrorCollector {
    if (!ErrorCollector.instance) {
      ErrorCollector.instance = new ErrorCollector();
    }
    return ErrorCollector.instance;
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    // JavaScript错误
    window.addEventListener('error', (event) => {
      this.handleError({
        type: ErrorType.JAVASCRIPT,
        severity: ErrorSeverity.HIGH,
        message: event.message,
        stack: event.error?.stack,
        context: this.getBaseContext(),
        timestamp: Date.now(),
      });
    });

    // Promise拒绝错误
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: ErrorType.PROMISE,
        severity: ErrorSeverity.MEDIUM,
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        context: this.getBaseContext(),
        timestamp: Date.now(),
      });
    });

    // 网络状态变化
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushPendingErrors();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // 页面卸载前发送错误
    window.addEventListener('beforeunload', () => {
      this.flushPendingErrors();
    });
  }

  // 获取基础上下文信息
  private getBaseContext(): ErrorContext {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      page: this.getCurrentPage(),
      sessionId: this.getSessionId(),
    };
  }

  // 获取当前页面名称
  private getCurrentPage(): string {
    const path = window.location.pathname;
    return path.split('/').pop() || 'index';
  }

  // 获取会话ID
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('errorSessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('errorSessionId', sessionId);
    }
    return sessionId;
  }

  // 处理错误
  public handleError(error: FrontendError): void {
    // 添加到内存队列
    this.errors.push(error);

    // 限制内存中的错误数量
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // 记录到控制台（开发环境）
    if (process.env.NODE_ENV !== 'production') {
      console.error('Frontend Error:', error);
    }

    // 记录到日志系统
    frontendLogger.error(
      error.message,
      error.context,
      new Error(error.message),
    );

    // 如果在线，立即发送；否则等待网络恢复
    if (this.isOnline) {
      this.sendError(error);
    }
  }

  // 发送错误到服务器
  private async sendError(error: FrontendError): Promise<void> {
    try {
      await fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error),
      });
    } catch (err) {
      console.error('Failed to send error to server:', err);
    }
  }

  // 刷新待发送的错误
  private async flushPendingErrors(): Promise<void> {
    if (this.errors.length === 0) return;

    const errorsToSend = [...this.errors];
    this.errors = [];

    for (const error of errorsToSend) {
      await this.sendError(error);
    }
  }

  // 手动记录自定义错误
  public logCustomError(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
  ): void {
    this.handleError({
      type: ErrorType.CUSTOM,
      severity,
      message,
      context: { ...this.getBaseContext(), ...context },
      timestamp: Date.now(),
    });
  }

  // 记录网络错误
  public logNetworkError(
    url: string,
    method: string,
    status: number,
    message: string,
    context: Partial<ErrorContext> = {},
  ): void {
    this.handleError({
      type: ErrorType.NETWORK,
      severity: status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      message: `Network error: ${method} ${url} - ${status} - ${message}`,
      context: {
        ...this.getBaseContext(),
        url,
        method,
        status,
        ...context,
      },
      timestamp: Date.now(),
    });
  }

  // 记录资源加载错误
  public logResourceError(
    resourceUrl: string,
    resourceType: string,
    message: string,
    context: Partial<ErrorContext> = {},
  ): void {
    this.handleError({
      type: ErrorType.RESOURCE,
      severity: ErrorSeverity.LOW,
      message: `Resource error: ${resourceType} ${resourceUrl} - ${message}`,
      context: {
        ...this.getBaseContext(),
        resourceUrl,
        resourceType,
        ...context,
      },
      timestamp: Date.now(),
    });
  }

  // 获取所有错误（用于调试）
  public getErrors(): FrontendError[] {
    return [...this.errors];
  }

  // 清除所有错误
  public clearErrors(): void {
    this.errors = [];
  }
}

// 导出单例实例
export const errorCollector = ErrorCollector.getInstance();

// 便捷函数
export const logError = (
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context: Partial<ErrorContext> = {},
): void => {
  errorCollector.logCustomError(message, severity, context);
};

export const logNetworkError = (
  url: string,
  method: string,
  status: number,
  message: string,
  context: Partial<ErrorContext> = {},
): void => {
  errorCollector.logNetworkError(url, method, status, message, context);
};

export const logResourceError = (
  resourceUrl: string,
  resourceType: string,
  message: string,
  context: Partial<ErrorContext> = {},
): void => {
  errorCollector.logResourceError(resourceUrl, resourceType, message, context);
};

// React错误边界增强
export const logReactError = (
  error: Error,
  errorInfo: React.ErrorInfo,
  context: Partial<ErrorContext> = {},
): void => {
  errorCollector.logCustomError(
    `React Error: ${error.message}`,
    ErrorSeverity.HIGH,
    {
      componentStack: errorInfo.componentStack,
      ...context,
    },
  );
};
