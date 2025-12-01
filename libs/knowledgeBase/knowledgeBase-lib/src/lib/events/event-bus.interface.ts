import { KnowledgeEvent, AnyKnowledgeEvent } from './types';

export interface IEventBus {
  // 发布事件
  publish<T extends KnowledgeEvent>(event: T): Promise<void>;
  
  // 订阅事件
  subscribe<T extends KnowledgeEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<string>;
  
  // 取消订阅
  unsubscribe(subscriptionId: string): Promise<void>;
  
  // 批量发布事件
  publishBatch(events: KnowledgeEvent[]): Promise<void>;
  
  // 获取订阅统计
  getSubscriptionStats(): Record<string, number>;
  
  // 获取所有订阅
  getSubscriptions(): EventSubscription[];
  
  // 清理所有订阅
  clear(): Promise<void>;
}

export interface EventHandler<T extends KnowledgeEvent> {
  (event: T): Promise<void>;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler<KnowledgeEvent>;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// 事件中间件接口
export interface EventMiddleware {
  (event: KnowledgeEvent, next: () => Promise<void>): Promise<void>;
}

// 事件过滤器接口
export interface EventFilter {
  (event: KnowledgeEvent): boolean;
}

// 事件总线配置
export interface EventBusConfig {
  maxConcurrentHandlers?: number;
  enableMetrics?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  middleware?: EventMiddleware[];
}

// 事件指标
export interface EventMetrics {
  totalEventsPublished: number;
  totalEventsProcessed: number;
  totalErrors: number;
  averageProcessingTime: number;
  eventTypeStats: Record<string, {
    count: number;
    averageTime: number;
    errorCount: number;
  }>;
}