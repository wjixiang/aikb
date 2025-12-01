# 事件驱动知识管理层实现计划

## 实现概述

基于架构设计，本文档详细描述了事件驱动知识管理层的具体实现计划，包括文件结构、接口定义和实现步骤。

## 文件结构

```
libs/knowledgeBase/knowledgeBase-lib/src/lib/
├── events/                          # 事件系统
│   ├── types.ts                     # 事件类型定义
│   ├── event-bus.interface.ts        # 事件总线接口
│   ├── event-bus.service.ts         # 事件总线实现
│   ├── event-store.interface.ts       # 事件存储接口
│   ├── event-store.service.ts        # 事件存储实现
│   └── decorators.ts                # 事件处理器装饰器
├── eventHandlers/                   # 事件处理器
│   ├── version-control.handler.ts     # 版本控制事件处理器
│   ├── data-storage.handler.ts       # 数据存储事件处理器
│   ├── audit.handler.ts             # 审计事件处理器
│   └── notification.handler.ts      # 通知事件处理器
├── transactions/                    # 事务管理
│   ├── transaction.interface.ts       # 事务接口
│   ├── transaction-manager.service.ts # 事务管理器
│   └── transaction.context.ts       # 事务上下文
├── knowledgeManagement/              # 知识管理层
│   ├── knowledge-management.interface.ts # 知识管理接口
│   ├── knowledge-management.service.ts  # 知识管理服务实现
│   ├── batch-operations.ts         # 批量操作定义
│   └── complex-operations.ts       # 复杂操作定义
└── modules/                        # 模块定义
    ├── events.module.ts             # 事件模块
    ├── event-handlers.module.ts      # 事件处理器模块
    ├── transactions.module.ts        # 事务模块
    └── knowledge-management.module.ts # 知识管理模块
```

## 实现步骤

### 阶段1：基础事件系统

#### 1.1 事件类型定义 (`events/types.ts`)

```typescript
import { EntityData, VertexData, PropertyData, EdgeData } from '../types';

// 基础事件接口
export interface KnowledgeEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  causationId?: string;
  metadata?: Record<string, any>;
}

// 实体事件
export interface EntityEvent extends KnowledgeEvent {
  entityType: 'entity';
  entityId: string;
}

export interface EntityCreatedEvent extends EntityEvent {
  eventType: 'entity.created';
  data: EntityData;
}

export interface EntityUpdatedEvent extends EntityEvent {
  eventType: 'entity.updated';
  oldData: EntityData;
  newData: EntityData;
  changes: Partial<EntityData>;
}

export interface EntityDeletedEvent extends EntityEvent {
  eventType: 'entity.deleted';
  data: EntityData;
}

// 类似地定义 Vertex, Property, Edge 事件...

// 批量操作事件
export interface BatchOperationEvent extends KnowledgeEvent {
  eventType: 'batch.operation';
  operations: KnowledgeEvent[];
  operationType: 'create' | 'update' | 'delete' | 'mixed';
}

// 版本控制事件
export interface VersionControlEvent extends KnowledgeEvent {
  entityType: 'version_control';
  repositoryId: string;
}

export interface CommitCreatedEvent extends VersionControlEvent {
  eventType: 'commit.created';
  commitId: string;
  branchName: string;
  message: string;
  changes: ChangeSet;
}

// 事件联合类型
export type AnyKnowledgeEvent = 
  | EntityCreatedEvent
  | EntityUpdatedEvent
  | EntityDeletedEvent
  | VertexCreatedEvent
  | VertexUpdatedEvent
  | VertexDeletedEvent
  | PropertyCreatedEvent
  | PropertyUpdatedEvent
  | PropertyDeletedEvent
  | EdgeCreatedEvent
  | EdgeUpdatedEvent
  | EdgeDeletedEvent
  | BatchOperationEvent
  | CommitCreatedEvent;
```

#### 1.2 事件总线接口 (`events/event-bus.interface.ts`)

```typescript
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
}

export interface EventHandler<T extends KnowledgeEvent> {
  (event: T): Promise<void>;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler<KnowledgeEvent>;
  createdAt: Date;
}
```

#### 1.3 事件总线实现 (`events/event-bus.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { IEventBus, EventHandler, EventSubscription, KnowledgeEvent } from './event-bus.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class EventBusService implements IEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private handlers = new Map<string, EventHandler<KnowledgeEvent>[]>();

  async publish<T extends KnowledgeEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    // 并行执行所有处理器
    await Promise.allSettled(
      handlers.map(handler => this.safeExecuteHandler(handler, event))
    );
  }

  async subscribe<T extends KnowledgeEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Promise<string> {
    const subscriptionId = uuidv4();
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler<KnowledgeEvent>,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);
    
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(subscription.handler);

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    this.subscriptions.delete(subscriptionId);
    
    const handlers = this.handlers.get(subscription.eventType) || [];
    const index = handlers.indexOf(subscription.handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  async publishBatch(events: KnowledgeEvent[]): Promise<void> {
    // 按事件类型分组，优化处理
    const eventsByType = new Map<string, KnowledgeEvent[]>();
    
    events.forEach(event => {
      if (!eventsByType.has(event.eventType)) {
        eventsByType.set(event.eventType, []);
      }
      eventsByType.get(event.eventType)!.push(event);
    });

    // 并行处理不同类型的事件
    await Promise.all(
      Array.from(eventsByType.entries()).map(([eventType, typeEvents]) =>
        this.processEventsByType(eventType, typeEvents)
      )
    );
  }

  getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.handlers.forEach((handlers, eventType) => {
      stats[eventType] = handlers.length;
    });
    return stats;
  }

  private async safeExecuteHandler(
    handler: EventHandler<KnowledgeEvent>,
    event: KnowledgeEvent
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Error in event handler for ${event.eventType}:`, error);
      // 可以添加错误报告和监控逻辑
    }
  }

  private async processEventsByType(
    eventType: string,
    events: KnowledgeEvent[]
  ): Promise<void> {
    const handlers = this.handlers.get(eventType) || [];
    
    await Promise.allSettled(
      events.map(event =>
        Promise.all(
          handlers.map(handler => this.safeExecuteHandler(handler, event))
        )
      )
    );
  }
}
```

#### 1.4 事件存储接口 (`events/event-store.interface.ts`)

```typescript
import { KnowledgeEvent } from './types';

export interface IEventStore {
  // 存储事件
  append(event: KnowledgeEvent): Promise<void>;
  
  // 批量存储事件
  appendBatch(events: KnowledgeEvent[]): Promise<void>;
  
  // 获取事件流
  getEvents(options?: EventQueryOptions): Promise<KnowledgeEvent[]>;
  
  // 获取特定事件
  getEvent(eventId: string): Promise<KnowledgeEvent | null>;
  
  // 事件重放
  replayEvents(
    handler: EventHandler<KnowledgeEvent>,
    fromEventId?: string,
    toEventId?: string
  ): Promise<void>;
  
  // 获取事件统计
  getEventStats(options?: EventStatsOptions): Promise<EventStats>;
}

export interface EventQueryOptions {
  entityType?: string;
  entityId?: string;
  eventTypes?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'eventType';
  orderDirection?: 'asc' | 'desc';
}

export interface EventStatsOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  groupBy?: 'eventType' | 'entityType' | 'userId';
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByEntityType: Record<string, number>;
  timeRange: {
    from: Date;
    to: Date;
  };
}

export interface EventHandler<T extends KnowledgeEvent> {
  (event: T): Promise<void>;
}
```

### 阶段2：事件处理器实现

#### 2.1 版本控制事件处理器 (`eventHandlers/version-control.handler.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { IGitVersionControl, ChangeSet } from '../versionControl/types';
import {
  EntityCreatedEvent,
  EntityUpdatedEvent,
  EntityDeletedEvent,
  VertexCreatedEvent,
  VertexUpdatedEvent,
  VertexDeletedEvent,
  PropertyCreatedEvent,
  PropertyUpdatedEvent,
  PropertyDeletedEvent,
  EdgeCreatedEvent,
  EdgeUpdatedEvent,
  EdgeDeletedEvent
} from '../events/types';

@Injectable()
export class VersionControlEventHandler {
  constructor(
    private versionControl: IGitVersionControl
  ) {}

  async handleEntityCreated(event: EntityCreatedEvent): Promise<void> {
    const changes = this.createChangesForAdded('entity', event.entityId, event.data);
    await this.createVersionCommit(event, `Create entity: ${event.entityId}`, changes);
  }

  async handleEntityUpdated(event: EntityUpdatedEvent): Promise<void> {
    const changes = this.createChangesForModified('entity', event.entityId, event.oldData, event.newData);
    await this.createVersionCommit(event, `Update entity: ${event.entityId}`, changes);
  }

  async handleEntityDeleted(event: EntityDeletedEvent): Promise<void> {
    const changes = this.createChangesForDeleted('entity', event.entityId, event.data);
    await this.createVersionCommit(event, `Delete entity: ${event.entityId}`, changes);
  }

  // 类似地处理 Vertex, Property, Edge 事件...

  private createChangesForAdded(
    type: 'entity' | 'vertex' | 'property' | 'edge',
    id: string,
    data: any
  ): ChangeSet {
    return {
      added: [{
        objectId: id,
        path: `${type}s/${id}`,
        type,
        oldContent: null,
        newContent: data
      }],
      modified: [],
      deleted: []
    };
  }

  private createChangesForModified(
    type: 'entity' | 'vertex' | 'property' | 'edge',
    id: string,
    oldData: any,
    newData: any
  ): ChangeSet {
    return {
      added: [],
      modified: [{
        objectId: id,
        path: `${type}s/${id}`,
        type,
        oldContent: oldData,
        newContent: newData
      }],
      deleted: []
    };
  }

  private createChangesForDeleted(
    type: 'entity' | 'vertex' | 'property' | 'edge',
    id: string,
    data: any
  ): ChangeSet {
    return {
      added: [],
      modified: [],
      deleted: [{
        objectId: id,
        path: `${type}s/${id}`,
        type,
        oldContent: data,
        newContent: null
      }]
    };
  }

  private async createVersionCommit(
    event: any,
    message: string,
    changes: ChangeSet
  ): Promise<void> {
    try {
      await this.versionControl.createCommit({
        repositoryId: 'knowledge-base',
        branchName: 'main',
        message,
        author: {
          name: event.userId || 'system',
          email: `${event.userId || 'system'}@example.com`
        },
        changes
      });
    } catch (error) {
      console.error('Failed to create version commit:', error);
      // 可以添加重试逻辑或错误处理
    }
  }
}
```

### 阶段3：事务管理

#### 3.1 事务接口 (`transactions/transaction.interface.ts`)

```typescript
export interface ITransactionManager {
  beginTransaction(transactionId?: string): Promise<string>;
  commitTransaction(transactionId: string): Promise<void>;
  rollbackTransaction(transactionId: string): Promise<void>;
  getTransactionStatus(transactionId: string): Promise<TransactionStatus>;
  executeInTransaction<T>(
    operations: () => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
}

export enum TransactionStatus {
  ACTIVE = 'active',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled_back',
  TIMEOUT = 'timeout'
}

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: IsolationLevel;
  retryPolicy?: RetryPolicy;
}

export enum IsolationLevel {
  READ_UNCOMMITTED = 'read_uncommitted',
  READ_COMMITTED = 'read_committed',
  REPEATABLE_READ = 'repeatable_read',
  SERIALIZABLE = 'serializable'
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
}

export interface TransactionContext {
  transactionId: string;
  status: TransactionStatus;
  startTime: Date;
  operations: TransactionOperation[];
  metadata?: Record<string, any>;
}

export interface TransactionOperation {
  operationId: string;
  type: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  data?: any;
  oldData?: any;
  timestamp: Date;
}
```

### 阶段4：统一知识管理服务

#### 4.1 知识管理接口 (`knowledgeManagement/knowledge-management.interface.ts`)

```typescript
import { EntityData, VertexData, PropertyData, EdgeData } from '../types';

export interface IKnowledgeManagementService {
  // 实体操作
  createEntity(data: Omit<EntityData, 'id'>, options?: OperationOptions): Promise<EntityData>;
  updateEntity(id: string, updates: Partial<EntityData>, options?: OperationOptions): Promise<EntityData>;
  deleteEntity(id: string, options?: OperationOptions): Promise<boolean>;
  
  // 顶点操作
  createVertex(data: Omit<VertexData, 'id'>, options?: OperationOptions): Promise<VertexData>;
  updateVertex(id: string, updates: Partial<VertexData>, options?: OperationOptions): Promise<VertexData>;
  deleteVertex(id: string, options?: OperationOptions): Promise<boolean>;
  
  // 属性操作
  createProperty(data: Omit<PropertyData, 'id'>, options?: OperationOptions): Promise<PropertyData>;
  updateProperty(id: string, updates: Partial<PropertyData>, options?: OperationOptions): Promise<PropertyData>;
  deleteProperty(id: string, options?: OperationOptions): Promise<boolean>;
  
  // 边操作
  createEdge(data: Omit<EdgeData, 'id'>, options?: OperationOptions): Promise<EdgeData>;
  updateEdge(id: string, updates: Partial<EdgeData>, options?: OperationOptions): Promise<EdgeData>;
  deleteEdge(id: string, options?: OperationOptions): Promise<boolean>;
  
  // 批量操作
  executeBatch(operations: BatchOperation[], options?: BatchOperationOptions): Promise<BatchResult>;
  
  // 复杂操作
  createEntityWithRelations(
    entityData: Omit<EntityData, 'id'>,
    vertices: Omit<VertexData, 'id'>[],
    properties: Omit<PropertyData, 'id'>[],
    edges: Omit<EdgeData, 'id'>[],
    options?: OperationOptions
  ): Promise<EntityWithRelations>;
}

export interface OperationOptions {
  userId?: string;
  sessionId?: string;
  skipVersionControl?: boolean;
  customMetadata?: Record<string, any>;
  transactionId?: string;
}

export interface BatchOperation {
  type: 'create' | 'update' | 'delete';
  entityType: 'entity' | 'vertex' | 'property' | 'edge';
  data?: any;
  id?: string;
  updates?: any;
}

export interface BatchOperationOptions extends OperationOptions {
  transactional?: boolean;
  stopOnError?: boolean;
}

export interface BatchResult {
  successful: Array<{ operation: BatchOperation; result: any }>;
  failed: Array<{ operation: BatchOperation; error: Error }>;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
}

export interface EntityWithRelations {
  entity: EntityData;
  vertices: VertexData[];
  properties: PropertyData[];
  edges: EdgeData[];
}
```

## 实现优先级

### 高优先级 (P0)
1. 基础事件类型定义
2. 事件总线实现
3. 基础事件处理器（数据存储）
4. 简单的知识管理服务

### 中优先级 (P1)
1. 版本控制事件处理器
2. 事件存储实现
3. 事务管理器
4. 批量操作支持

### 低优先级 (P2)
1. 复杂操作支持
2. 事件重放机制
3. 监控和统计
4. 性能优化

## 测试策略

### 单元测试
- 每个组件的独立测试
- 事件发布和订阅测试
- 事务管理测试
- 错误处理测试

### 集成测试
- 端到端工作流测试
- 复杂场景测试
- 性能测试
- 并发测试

### 测试覆盖率目标
- 代码覆盖率 > 90%
- 分支覆盖率 > 85%
- 关键路径 100% 覆盖

## 部署考虑

### 环境配置
- 开发环境：内存存储
- 测试环境：SQLite + 内存事件总线
- 生产环境：PostgreSQL + Redis + 消息队列

### 监控指标
- 事件处理延迟
- 事务成功率
- 版本控制操作性能
- 系统资源使用情况

### 扩展性考虑
- 水平扩展支持
- 事件分区策略
- 负载均衡
- 故障转移机制