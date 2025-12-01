import { Injectable, Logger } from '@nestjs/common';
import type {
  IEventBus,
  EventHandler,
  EventSubscription,
  EventBusConfig,
  EventMetrics,
  EventMiddleware,
  EventFilter,
} from './event-bus.interface';
import { KnowledgeEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);

  private subscriptions = new Map<string, EventSubscription>();
  private handlers = new Map<string, EventHandler<KnowledgeEvent>[]>();
  private middleware: EventMiddleware[] = [];
  private config: EventBusConfig;
  private metrics: EventMetrics = {
    totalEventsPublished: 0,
    totalEventsProcessed: 0,
    totalErrors: 0,
    averageProcessingTime: 0,
    eventTypeStats: {},
  };

  constructor(config?: EventBusConfig) {
    this.config = {
      maxConcurrentHandlers: 10,
      enableMetrics: true,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };

    if (this.config.middleware) {
      this.middleware = this.config.middleware;
    }
  }

  async publish<T extends KnowledgeEvent>(event: T): Promise<void> {
    const startTime = Date.now();

    try {
      this.metrics.totalEventsPublished++;

      // 应用中间件
      await this.applyMiddleware(event, async () => {
        await this.processEvent(event);
      });

      // 更新指标
      if (this.config.enableMetrics) {
        this.updateMetrics(event.eventType, Date.now() - startTime, true);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        this.updateMetrics(event.eventType, Date.now() - startTime, false);
      }

      this.logger.error(`Error publishing event ${event.eventType}:`, error);
      throw error;
    }
  }

  async subscribe<T extends KnowledgeEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): Promise<string> {
    const subscriptionId = uuidv4();
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler<KnowledgeEvent>,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(subscription.handler);

    this.logger.debug(
      `Subscribed to event type: ${eventType}, subscription ID: ${subscriptionId}`,
    );
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logger.warn(`Subscription ${subscriptionId} not found`);
      return;
    }

    this.subscriptions.delete(subscriptionId);

    const handlers = this.handlers.get(subscription.eventType) || [];
    const index = handlers.indexOf(subscription.handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }

    this.logger.debug(
      `Unsubscribed from event type: ${subscription.eventType}, subscription ID: ${subscriptionId}`,
    );
  }

  async publishBatch(events: KnowledgeEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    this.logger.debug(`Publishing batch of ${events.length} events`);

    // 按事件类型分组，优化处理
    const eventsByType = new Map<string, KnowledgeEvent[]>();

    events.forEach((event) => {
      if (!eventsByType.has(event.eventType)) {
        eventsByType.set(event.eventType, []);
      }
      eventsByType.get(event.eventType)!.push(event);
    });

    // 并行处理不同类型的事件
    const promises = Array.from(eventsByType.entries()).map(
      ([eventType, typeEvents]) =>
        this.processEventsByType(eventType, typeEvents),
    );

    await Promise.allSettled(promises);
  }

  getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.handlers.forEach((handlers, eventType) => {
      stats[eventType] = handlers.length;
    });
    return stats;
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async clear(): Promise<void> {
    this.subscriptions.clear();
    this.handlers.clear();
    this.logger.debug('Cleared all subscriptions');
  }

  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  private async processEvent(event: KnowledgeEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];

    if (handlers.length === 0) {
      this.logger.debug(
        `No handlers registered for event type: ${event.eventType}`,
      );
      return;
    }

    // 限制并发处理器数量
    const semaphore = new Semaphore(this.config.maxConcurrentHandlers!);

    const promises = handlers.map((handler) =>
      semaphore.acquire().then(async (release) => {
        try {
          await this.executeHandler(handler, event);
        } finally {
          release();
        }
      }),
    );

    await Promise.allSettled(promises);
  }

  private async processEventsByType(
    eventType: string,
    events: KnowledgeEvent[],
  ): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];

    if (handlers.length === 0) {
      return;
    }

    const semaphore = new Semaphore(this.config.maxConcurrentHandlers!);

    const promises = events.map((event) =>
      semaphore.acquire().then(async (release) => {
        try {
          await this.executeHandler(handlers[0], event); // 简化：每个事件只由第一个处理器处理
        } finally {
          release();
        }
      }),
    );

    await Promise.allSettled(promises);
  }

  private async executeHandler(
    handler: EventHandler<KnowledgeEvent>,
    event: KnowledgeEvent,
  ): Promise<void> {
    if (this.config.enableRetry) {
      await this.executeWithRetry(handler, event);
    } else {
      await handler(event);
    }
  }

  private async executeWithRetry(
    handler: EventHandler<KnowledgeEvent>,
    event: KnowledgeEvent,
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        await handler(event);
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries!) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt - 1); // 指数退避
          this.logger.warn(
            `Handler execution failed for event ${event.eventType}, attempt ${attempt}/${this.config.maxRetries}, retrying in ${delay}ms:`,
            error,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Handler execution failed for event ${event.eventType} after ${this.config.maxRetries} attempts:`,
      lastError,
    );
    throw lastError;
  }

  private async applyMiddleware(
    event: KnowledgeEvent,
    next: () => Promise<void>,
  ): Promise<void> {
    if (this.middleware.length === 0) {
      return next();
    }

    let index = 0;

    const runNext = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        return next();
      }

      const middleware = this.middleware[index++];
      return middleware(event, runNext);
    };

    return runNext();
  }

  private updateMetrics(
    eventType: string,
    processingTime: number,
    success: boolean,
  ): void {
    this.metrics.totalEventsProcessed++;

    if (!success) {
      this.metrics.totalErrors++;
    }

    // 更新平均处理时间
    const totalTime =
      this.metrics.averageProcessingTime *
        (this.metrics.totalEventsProcessed - 1) +
      processingTime;
    this.metrics.averageProcessingTime =
      totalTime / this.metrics.totalEventsProcessed;

    // 更新事件类型统计
    if (!this.metrics.eventTypeStats[eventType]) {
      this.metrics.eventTypeStats[eventType] = {
        count: 0,
        averageTime: 0,
        errorCount: 0,
      };
    }

    const stats = this.metrics.eventTypeStats[eventType];
    stats.count++;
    if (!success) {
      stats.errorCount++;
    }

    const totalTypeTime =
      stats.averageTime * (stats.count - 1) + processingTime;
    stats.averageTime = totalTypeTime / stats.count;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 简单的信号量实现
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }
}
