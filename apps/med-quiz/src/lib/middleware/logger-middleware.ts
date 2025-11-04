import { NextRequest, NextResponse } from 'next/server';
import { createEnhancedLogger } from '@/lib/console/enhanced-logger';

// 创建API日志记录器
const apiLogger = createEnhancedLogger('API', {
  level: process.env.LOG_LEVEL || 'info',
  enableConsole: process.env.NODE_ENV !== 'production',
  enableFile: true,
  enableRemote: process.env.NODE_ENV === 'production',
});

// 生成唯一请求ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 提取用户信息
async function extractUserInfo(request: NextRequest): Promise<{
  userId?: string;
  sessionId?: string;
}> {
  try {
    // 这里可以从session、token或其他地方提取用户信息
    // 暂时返回空对象，后续可以根据实际认证系统实现
    return {};
  } catch (error) {
    return {};
  }
}

// 计算响应时间
function measureResponseTime(startTime: number): number {
  return Date.now() - startTime;
}

// 日志中间件
export async function logRequest(request: NextRequest): Promise<{
  requestId: string;
  startTime: number;
  userInfo: { userId?: string; sessionId?: string };
}> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const userInfo = await extractUserInfo(request);

  // 记录请求开始
  apiLogger.logRequest(request, undefined);

  return { requestId, startTime, userInfo };
}

export function logResponse(
  request: NextRequest,
  response: NextResponse,
  requestId: string,
  startTime: number,
  userInfo: { userId?: string; sessionId?: string },
): void {
  const responseTime = measureResponseTime(startTime);
  const statusCode = response.status;

  // 记录响应
  apiLogger.logResponse(request, statusCode, responseTime, {
    requestId,
    userId: userInfo.userId,
    sessionId: userInfo.sessionId,
  });

  // 如果是错误响应，记录更多详细信息
  if (statusCode >= 400) {
    apiLogger.warn(
      `API Error: ${request.method} ${request.url} returned ${statusCode}`,
      {
        requestId,
        userId: userInfo.userId,
        sessionId: userInfo.sessionId,
        statusCode,
        responseTime,
        method: request.method,
        url: request.url,
      },
    );
  }
}

export function logError(
  request: NextRequest,
  error: Error,
  requestId: string,
  userInfo: { userId?: string; sessionId?: string },
): void {
  apiLogger.error(
    `API Error: ${error.message}`,
    {
      requestId,
      userId: userInfo.userId,
      sessionId: userInfo.sessionId,
      method: request.method,
      url: request.url,
      stack: error.stack,
    },
    error,
  );
}

// 高阶函数：包装API处理器以自动记录日志
export function withLogging<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const { requestId, startTime, userInfo } = await logRequest(request);

    try {
      const response = await handler(request, ...args);
      logResponse(request, response, requestId, startTime, userInfo);
      return response;
    } catch (error) {
      logError(request, error as Error, requestId, userInfo);
      throw error;
    }
  };
}

// 性能监控装饰器
export function withPerformanceLogging<T extends any[]>(
  operationName: string,
  handler: (...args: T) => Promise<any>,
) {
  return async (...args: T): Promise<any> => {
    const startTime = Date.now();
    const logger = createEnhancedLogger('PERFORMANCE');

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      logger.logPerformance(operationName, duration, {
        success: true,
        args: args.length,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.logPerformance(operationName, duration, {
        success: false,
        error: (error as Error).message,
        args: args.length,
      });

      throw error;
    }
  };
}
