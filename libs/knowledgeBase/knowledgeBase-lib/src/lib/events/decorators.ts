import 'reflect-metadata';

// 事件处理器装饰器元数据键
export const EVENT_HANDLER_METADATA_KEY = Symbol('event_handler');
export const EVENT_TYPE_METADATA_KEY = Symbol('event_type');

// 事件处理器装饰器
export function EventHandler(eventType: string) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    // 获取现有的处理器列表
    const existingHandlers =
      Reflect.getMetadata(EVENT_HANDLER_METADATA_KEY, target.constructor) || [];

    // 添加新的处理器
    existingHandlers.push({
      eventType,
      handler: originalMethod,
      methodName: propertyKey.toString(),
    });

    // 设置元数据
    Reflect.defineMetadata(
      EVENT_HANDLER_METADATA_KEY,
      existingHandlers,
      target.constructor,
    );
    Reflect.defineMetadata(EVENT_TYPE_METADATA_KEY, eventType, originalMethod);

    // 保持原始方法的引用
    descriptor.value = originalMethod;
  };
}

// 批量事件处理器装饰器
export function BatchEventHandler(eventTypes: string[]) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    const existingHandlers =
      Reflect.getMetadata(EVENT_HANDLER_METADATA_KEY, target.constructor) || [];

    eventTypes.forEach((eventType) => {
      existingHandlers.push({
        eventType,
        handler: originalMethod,
        methodName: propertyKey.toString(),
      });
    });

    Reflect.defineMetadata(
      EVENT_HANDLER_METADATA_KEY,
      existingHandlers,
      target.constructor,
    );
    descriptor.value = originalMethod;
  };
}

// 事件过滤器装饰器
export function EventFilter(filter: (event: any) => boolean) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (event: any) {
      if (filter(event)) {
        return originalMethod.call(this, event);
      }
      // 如果过滤器返回false，则不处理事件
    };
  };
}

// 事务装饰器
export function Transactional(options?: {
  timeout?: number;
  isolationLevel?: string;
}) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      // 这里需要注入TransactionManager
      const transactionManager = (this as any).transactionManager;
      if (!transactionManager) {
        throw new Error('TransactionManager not found in context');
      }

      return await transactionManager.executeInTransaction(
        () => originalMethod.apply(this, args),
        {
          timeout: options?.timeout,
          isolationLevel: options?.isolationLevel as any,
        },
      );
    };
  };
}

// 重试装饰器
export function Retry(options: {
  maxRetries?: number;
  delay?: number;
  backoff?: number;
}) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const maxRetries = options?.maxRetries || 3;
      const delay = options?.delay || 1000;
      const backoff = options?.backoff || 2;

      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          if (attempt < maxRetries) {
            const waitTime = delay * Math.pow(backoff, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }

      throw lastError;
    };
  };
}

// 性能监控装饰器
export function PerformanceMonitor(options?: {
  logSlowQueries?: boolean;
  threshold?: number;
}) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const startTime = Date.now();
      const methodName = propertyKey.toString();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // 记录性能指标
        if ((this as any).logger) {
          (this as any).logger.debug(
            `Method ${methodName} executed in ${duration}ms`,
          );
        }

        if (
          options?.logSlowQueries &&
          duration > (options?.threshold || 1000)
        ) {
          if ((this as any).logger) {
            (this as any).logger.warn(
              `Slow method detected: ${methodName} took ${duration}ms`,
            );
          }
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        if ((this as any).logger) {
          (this as any).logger.error(
            `Method ${methodName} failed after ${duration}ms:`,
            error,
          );
        }

        throw error;
      }
    };
  };
}

// 缓存装饰器
export function Cache(options: { ttl?: number; key?: string }) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map();

    descriptor.value = async function (...args: any[]) {
      const cacheKey =
        options?.key || `${propertyKey.toString()}_${JSON.stringify(args)}`;

      // 检查缓存
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < (options?.ttl || 300000)) {
        return cached.value;
      }

      // 执行原方法
      const result = await originalMethod.apply(this, args);

      // 缓存结果
      cache.set(cacheKey, {
        value: result,
        timestamp: Date.now(),
      });

      return result;
    };
  };
}

// 验证装饰器
export function Validate(
  validator: (data: any) => { isValid: boolean; errors: string[] },
) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (this: any, ...args: any[]) {
      const data = args[0]; // 假设第一个参数是需要验证的数据

      const validation = validator(data);
      if (!validation.isValid) {
        const error = new Error(
          `Validation failed: ${validation.errors.join(', ')}`,
        );
        (error as any).name = 'ValidationError';
        (error as any).errors = validation.errors;
        throw error;
      }

      return originalMethod.apply(this, args);
    };
  };
}

// 事件处理器元数据接口
export interface EventHandlerMetadata {
  eventType: string;
  handler: Function;
  methodName: string;
}

// 获取类的事件处理器元数据
export function getEventHandlerMetadata(target: any): EventHandlerMetadata[] {
  return Reflect.getMetadata(EVENT_HANDLER_METADATA_KEY, target) || [];
}

// 获取方法的事件类型元数据
export function getEventTypeMetadata(target: any): string | undefined {
  return Reflect.getMetadata(EVENT_TYPE_METADATA_KEY, target);
}
