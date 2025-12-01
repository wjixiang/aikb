# 事件驱动知识管理 - 代码示例

## 1. 事件驱动的实体操作示例

### 1.1 创建实体的事件流程

```typescript
// 用户调用知识管理服务
const knowledgeService = container.get(IKnowledgeManagementService);

const newEntity = await knowledgeService.createEntity({
  nomanclature: [{
    name: 'Artificial Intelligence',
    acronym: 'AI',
    language: 'en'
  }],
  abstract: {
    description: 'The simulation of human intelligence in machines',
    embedding: {
      config: { model: 'text-embedding-ada-002', dimensions: 1536 },
      vector: new Array(1536).fill(0.1)
    }
  }
}, {
  userId: 'user123',
  sessionId: 'session456'
});

// 内部事件流程：
// 1. 发布 EntityCreatedEvent
// 2. 数据存储处理器接收事件并存储实体
// 3. 版本控制处理器接收事件并创建版本提交
// 4. 事件存储器持久化事件
```

### 1.2 事件发布和处理

```typescript
// 知识管理服务内部实现
@Injectable()
export class KnowledgeManagementService implements IKnowledgeManagementService {
  constructor(
    private eventBus: IEventBus,
    private transactionManager: ITransactionManager
  ) {}

  async createEntity(
    data: Omit<EntityData, 'id'>,
    options?: OperationOptions
  ): Promise<EntityData> {
    return await this.transactionManager.executeInTransaction(async () => {
      // 生成ID
      const entityId = this.generateId();
      const entity: EntityData = { id: entityId, ...data };

      // 发布事件
      const event: EntityCreatedEvent = {
        eventId: this.generateEventId(),
        eventType: 'entity.created',
        timestamp: new Date(),
        userId: options?.userId,
        sessionId: options?.sessionId,
        entityType: 'entity',
        entityId,
        data: entity,
        metadata: options?.customMetadata
      };

      await this.eventBus.publish(event);

      return entity;
    }, {
      timeout: 30000,
      isolationLevel: IsolationLevel.READ_COMMITTED
    });
  }
}
```

## 2. 批量操作示例

### 2.1 批量创建相关数据

```typescript
const batchResult = await knowledgeService.executeBatch([
  {
    type: 'create',
    entityType: 'entity',
    data: {
      nomanclature: [{ name: 'Machine Learning', acronym: 'ML', language: 'en' }],
      abstract: {
        description: 'Subset of AI that enables systems to learn',
        embedding: { config: { model: 'text-embedding-ada-002', dimensions: 1536 }, vector: [] }
      }
    }
  },
  {
    type: 'create',
    entityType: 'vertex',
    data: {
      content: 'ML Algorithm',
      type: 'concept',
      metadata: { category: 'algorithm' }
    }
  },
  {
    type: 'create',
    entityType: 'edge',
    data: {
      type: 'start',
      in: 'entity-ml-id',
      out: 'vertex-ml-algorithm-id'
    }
  }
], {
  transactional: true,
  stopOnError: true,
  userId: 'user123'
});

// 内部流程：
// 1. 开始事务
// 2. 发布 BatchOperationEvent
// 3. 按顺序执行每个操作
// 4. 如果全部成功，提交事务
// 5. 如果失败，回滚事务
```

### 2.2 批量操作的事件处理

```typescript
@Injectable()
export class BatchOperationEventHandler {
  constructor(
    private eventBus: IEventBus,
    private transactionManager: ITransactionManager
  ) {}

  @EventHandler('batch.operation')
  async handleBatchOperation(event: BatchOperationEvent): Promise<void> {
    const transactionId = await this.transactionManager.beginTransaction();
    
    try {
      for (const operation of event.operations) {
        await this.eventBus.publish(operation);
      }
      
      await this.transactionManager.commitTransaction(transactionId);
    } catch (error) {
      await this.transactionManager.rollbackTransaction(transactionId);
      throw error;
    }
  }
}
```

## 3. 复杂关系操作示例

### 3.1 创建实体及其关系

```typescript
const entityWithRelations = await knowledgeService.createEntityWithRelations(
  // 实体数据
  {
    nomanclature: [{ name: 'Neural Network', acronym: 'NN', language: 'en' }],
    abstract: {
      description: 'Computing systems inspired by biological neural networks',
      embedding: { config: { model: 'text-embedding-ada-002', dimensions: 1536 }, vector: [] }
    }
  },
  // 顶点数据
  [
    { content: 'Deep Learning', type: 'concept' },
    { content: 'Backpropagation', type: 'concept' },
    { content: 'Activation Function', type: 'attribute' }
  ],
  // 属性数据
  [
    { content: 'Multi-layer perceptron architecture' },
    { content: 'Gradient-based optimization' }
  ],
  // 边数据
  [
    { type: 'start', in: 'entity-nn-id', out: 'vertex-dl-id' },
    { type: 'middle', in: 'vertex-dl-id', out: 'vertex-bp-id' },
    { type: 'end', in: 'vertex-bp-id', out: 'property-mlp-id' }
  ],
  {
    userId: 'user123',
    sessionId: 'session456'
  }
);

// 内部流程：
// 1. 分析依赖关系
// 2. 按依赖顺序排序操作
// 3. 在事务中执行所有操作
// 4. 创建包含所有变更的版本提交
```

### 3.2 依赖关系分析

```typescript
@Injectable()
export class DependencyAnalyzer {
  analyzeDependencies(operations: BatchOperation[]): DependencyGraph {
    const graph = new DependencyGraph();
    
    operations.forEach(op => {
      graph.addNode(op);
      
      // 分析操作间的依赖关系
      if (op.type === 'create' && op.entityType === 'edge') {
        // 边操作依赖于相关的实体和顶点
        const dependentOps = operations.filter(otherOp =>
          (otherOp.type === 'create' && otherOp.entityType === 'entity' && otherOp.data?.id === op.data?.in) ||
          (otherOp.type === 'create' && otherOp.entityType === 'vertex' && otherOp.data?.id === op.data?.out)
        );
        
        dependentOps.forEach(depOp => {
          graph.addDependency(depOp, op);
        });
      }
    });
    
    return graph;
  }

  getExecutionOrder(graph: DependencyGraph): BatchOperation[] {
    // 拓扑排序获取执行顺序
    return graph.topologicalSort();
  }
}
```

## 4. 版本控制集成示例

### 4.1 自动版本提交

```typescript
@Injectable()
export class VersionControlEventHandler {
  constructor(
    private versionControl: IGitVersionControl,
    private eventStore: IEventStore
  ) {}

  @EventHandler('entity.created')
  async handleEntityCreated(event: EntityCreatedEvent): Promise<void> {
    const changes: ChangeSet = {
      added: [{
        objectId: event.entityId,
        path: `entities/${event.entityId}`,
        type: 'entity',
        oldContent: null,
        newContent: event.data
      }],
      modified: [],
      deleted: []
    };

    await this.versionControl.createCommit({
      repositoryId: 'knowledge-base',
      branchName: 'main',
      message: `Create entity: ${event.entityId}`,
      author: {
        name: event.userId || 'system',
        email: `${event.userId || 'system'}@example.com`
      },
      changes
    });
  }

  @EventHandler('batch.operation')
  async handleBatchOperation(event: BatchOperationEvent): Promise<void> {
    // 收集所有变更
    const allChanges: ChangeSet = {
      added: [],
      modified: [],
      deleted: []
    };

    event.operations.forEach(op => {
      if (op.eventType === 'entity.created') {
        const entityEvent = op as EntityCreatedEvent;
        allChanges.added.push({
          objectId: entityEvent.entityId,
          path: `entities/${entityEvent.entityId}`,
          type: 'entity',
          oldContent: null,
          newContent: entityEvent.data
        });
      }
      // 处理其他类型的事件...
    });

    // 创建包含所有变更的版本提交
    await this.versionControl.createCommit({
      repositoryId: 'knowledge-base',
      branchName: 'main',
      message: `Batch operation: ${event.operations.length} changes`,
      author: {
        name: event.userId || 'system',
        email: `${event.userId || 'system'}@example.com`
      },
      changes: allChanges
    });
  }
}
```

## 5. 事务管理示例

### 5.1 事务上下文管理

```typescript
@Injectable()
export class TransactionManager implements ITransactionManager {
  private activeTransactions = new Map<string, TransactionContext>();

  async beginTransaction(transactionId?: string): Promise<string> {
    const id = transactionId || this.generateTransactionId();
    const context: TransactionContext = {
      transactionId: id,
      status: TransactionStatus.ACTIVE,
      startTime: new Date(),
      operations: [],
      metadata: {}
    };

    this.activeTransactions.set(id, context);
    return id;
  }

  async executeInTransaction<T>(
    operations: () => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const transactionId = await this.beginTransaction();
    
    try {
      // 设置事务超时
      const timeout = options?.timeout || 30000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transaction timeout')), timeout);
      });

      // 执行操作
      const result = await Promise.race([
        operations(),
        timeoutPromise
      ]);

      await this.commitTransaction(transactionId);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transactionId);
      throw error;
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // 验证事务状态
    if (context.status !== TransactionStatus.ACTIVE) {
      throw new Error(`Transaction ${transactionId} is not active`);
    }

    // 执行提交逻辑
    await this.performCommit(context);
    
    context.status = TransactionStatus.COMMITTED;
    this.activeTransactions.delete(transactionId);
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const context = this.activeTransactions.get(transactionId);
    if (!context) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // 执行回滚逻辑
    await this.performRollback(context);
    
    context.status = TransactionStatus.ROLLED_BACK;
    this.activeTransactions.delete(transactionId);
  }

  private async performCommit(context: TransactionContext): Promise<void> {
    // 按顺序提交所有操作
    for (const operation of context.operations) {
      await this.commitOperation(operation);
    }
  }

  private async performRollback(context: TransactionContext): Promise<void> {
    // 逆序回滚所有操作
    for (const operation of context.operations.reverse()) {
      await this.rollbackOperation(operation);
    }
  }
}
```

## 6. 事件存储和重放示例

### 6.1 事件存储实现

```typescript
@Injectable()
export class EventStoreService implements IEventStore {
  constructor(
    @Inject('EVENT_STORE_CONNECTION') private connection: any
  ) {}

  async append(event: KnowledgeEvent): Promise<void> {
    const query = `
      INSERT INTO events (event_id, event_type, timestamp, user_id, session_id, 
                        correlation_id, causation_id, metadata, event_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await this.connection.query(query, [
      event.eventId,
      event.eventType,
      event.timestamp,
      event.userId,
      event.sessionId,
      event.correlationId,
      event.causationId,
      JSON.stringify(event.metadata),
      JSON.stringify(event)
    ]);
  }

  async getEvents(options?: EventQueryOptions): Promise<KnowledgeEvent[]> {
    let query = 'SELECT event_data FROM events WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options?.entityType) {
      query += ` AND event_data->>'entityType' = $${paramIndex++}`;
      params.push(options.entityType);
    }

    if (options?.entityId) {
      query += ` AND event_data->>'entityId' = $${paramIndex++}`;
      params.push(options.entityId);
    }

    if (options?.fromTimestamp) {
      query += ` AND timestamp >= $${paramIndex++}`;
      params.push(options.fromTimestamp);
    }

    if (options?.toTimestamp) {
      query += ` AND timestamp <= $${paramIndex++}`;
      params.push(options.toTimestamp);
    }

    query += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    const result = await this.connection.query(query, params);
    return result.rows.map(row => JSON.parse(row.event_data));
  }

  async replayEvents(
    handler: EventHandler<KnowledgeEvent>,
    fromEventId?: string,
    toEventId?: string
  ): Promise<void> {
    const events = await this.getEvents({
      fromTimestamp: fromEventId ? new Date(fromEventId) : undefined,
      toTimestamp: toEventId ? new Date(toEventId) : undefined
    });

    for (const event of events) {
      await handler(event);
    }
  }
}
```

### 6.2 事件重放用于恢复

```typescript
@Injectable()
export class EventRecoveryService {
  constructor(
    private eventStore: IEventStore,
    private eventBus: IEventBus
  ) {}

  async recoverToTimestamp(targetTimestamp: Date): Promise<void> {
    console.log(`Recovering system state to ${targetTimestamp.toISOString()}`);

    // 获取目标时间戳之前的所有事件
    const events = await this.eventStore.getEvents({
      toTimestamp: targetTimestamp
    });

    // 按时间顺序重放事件
    for (const event of events) {
      await this.eventBus.publish(event);
    }

    console.log(`Recovery completed. Replayed ${events.length} events.`);
  }

  async recoverFromSnapshot(snapshotId: string): Promise<void> {
    // 1. 加载快照状态
    const snapshot = await this.loadSnapshot(snapshotId);
    
    // 2. 恢复数据存储状态
    await this.restoreDataStores(snapshot);
    
    // 3. 重放快照之后的事件
    await this.eventStore.replayEvents(
      async (event) => {
        // Handle event
      },
      snapshot.lastEventId,
      undefined,
      async (event) => {
        await this.eventBus.publish(event);
      }
    );
  }
}
```

## 7. 实际使用场景

### 7.1 知识图谱构建工作流

```typescript
async function buildKnowledgeGraph() {
  const knowledgeService = container.get(IKnowledgeManagementService);

  // 1. 创建核心实体
  const aiEntity = await knowledgeService.createEntity({
    nomanclature: [{ name: 'Artificial Intelligence', acronym: 'AI', language: 'en' }],
    abstract: {
      description: 'The field of computer science dedicated to creating intelligent machines',
      embedding: { config: { model: 'text-embedding-ada-002', dimensions: 1536 }, vector: [] }
    }
  }, { userId: 'researcher1' });

  // 2. 批量创建相关概念和关系
  const batchResult = await knowledgeService.executeBatch([
    { type: 'create', entityType: 'vertex', data: { content: 'Machine Learning', type: 'concept' } },
    { type: 'create', entityType: 'vertex', data: { content: 'Deep Learning', type: 'concept' } },
    { type: 'create', entityType: 'vertex', data: { content: 'Neural Networks', type: 'concept' } },
    { type: 'create', entityType: 'edge', data: { type: 'start', in: aiEntity.id, out: 'vertex-ml-id' } },
    { type: 'create', entityType: 'edge', data: { type: 'middle', in: 'vertex-ml-id', out: 'vertex-dl-id' } },
    { type: 'create', entityType: 'edge', data: { type: 'middle', in: 'vertex-dl-id', out: 'vertex-nn-id' } }
  ], { transactional: true, userId: 'researcher1' });

  // 3. 查看版本历史
  const history = await versionControl.getCommitHistory({
    repositoryId: 'knowledge-base',
    branchName: 'main',
    limit: 10
  });

  console.log('Knowledge graph built successfully!');
  console.log(`Created ${batchResult.totalSuccessful} operations`);
  console.log(`Version history: ${history.length} commits`);
}
```

### 7.2 协作编辑场景

```typescript
async function collaborativeEditing() {
  // 用户A创建功能分支
  await versionControl.createBranch({
    repositoryId: 'knowledge-base',
    branchName: 'feature/add-ml-concepts',
    author: { name: 'UserA', email: 'usera@example.com' }
  });

  // 用户A在功能分支上工作
  await knowledgeService.createEntity({
    nomanclature: [{ name: 'Supervised Learning', acronym: 'SL', language: 'en' }],
    abstract: {
      description: 'Machine learning paradigm where algorithms learn from labeled data',
      embedding: { config: { model: 'text-embedding-ada-002', dimensions: 1536 }, vector: [] }
    }
  }, { userId: 'UserA' });

  // 用户B同时在主分支工作
  await knowledgeService.createEntity({
    nomanclature: [{ name: 'Unsupervised Learning', acronym: 'UL', language: 'en' }],
    abstract: {
      description: 'Machine learning paradigm where algorithms find patterns in unlabeled data',
      embedding: { config: { model: 'text-embedding-ada-002', dimensions: 1536 }, vector: [] }
    }
  }, { userId: 'UserB' });

  // 合并功能分支
  const mergeResult = await versionControl.mergeBranch({
    repositoryId: 'knowledge-base',
    sourceBranch: 'feature/add-ml-concepts',
    targetBranch: 'main',
    author: { name: 'System', email: 'system@example.com' },
    message: 'Merge ML concepts feature'
  });

  if (mergeResult.success) {
    console.log('Merge successful!');
  } else {
    console.log('Merge conflicts detected:', mergeResult.conflicts);
  }
}
```

这些代码示例展示了事件驱动知识管理系统的核心功能和实际使用场景，包括：

1. **事件驱动的数据操作**
2. **批量操作和事务管理**
3. **版本控制自动集成**
4. **复杂关系处理**
5. **协作工作流支持**
6. **事件存储和恢复机制**

通过这种架构，所有的知识操作都通过事件进行统一管理，确保了数据一致性、可追溯性和版本控制的自动化。