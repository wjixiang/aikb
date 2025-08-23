# 知识管理系统数据存储方案设计

## 1. 现有架构分析

### 1.1 当前实现
- **存储抽象层**: 已有 `AbstractEntityStorage` 和 `AbstractPropertyStorage` 抽象类
- **存储实现**: 已实现 `MongodbEntityStorage` 和 `LocalEntityStorage`
- **数据模型**: 
  - `entity`: 包含 name、tags、definition 字段
  - `property`: 包含 name、content 字段
- **数据库连接**: 使用 MongoDB 作为主要数据库

### 1.2 现有限制
- 数据模型过于简单，缺乏层次结构和关系表示
- 缺乏知识图谱的概念，无法表示实体间的复杂关系
- 没有版本控制和历史记录功能
- 缺乏多租户支持
- 没有缓存机制
- 缺乏数据备份和恢复策略

## 2. 增强的数据模型设计

### 2.1 核心实体模型

```typescript
interface KnowledgeEntity {
  id: string;                    // 唯一标识符
  name: string[];               // 分层名称，如 ["领域", "子领域", "概念"]
  displayName: string;          // 显示名称
  description: string;          // 详细描述
  definition: string;           // 精确定义
  type: EntityType;            // 实体类型
  tags: string[];              // 标签
  metadata: Record<string, any>; // 元数据
  createdAt: Date;             // 创建时间
  updatedAt: Date;             // 更新时间
  createdBy: string;           // 创建者
  version: number;             // 版本号
  status: EntityStatus;        // 状态
  tenantId?: string;          // 租户ID（多租户支持）
}

enum EntityType {
  CONCEPT = 'concept',         // 概念
  PROCESS = 'process',        // 过程
  PRINCIPLE = 'principle',    // 原则
  FACT = 'fact',             // 事实
  RULE = 'rule',             // 规则
  EXAMPLE = 'example'        // 示例
}

enum EntityStatus {
  DRAFT = 'draft',           // 草稿
  ACTIVE = 'active',         // 活跃
  ARCHIVED = 'archived',     // 已归档
  DEPRECATED = 'deprecated'  // 已弃用
}
```

### 2.2 关系模型

```typescript
interface EntityRelation {
  id: string;                 // 唯一标识符
  sourceId: string;          // 源实体ID
  targetId: string;          // 目标实体ID
  type: RelationType;        // 关系类型
  weight: number;            // 关系权重（0-1）
  metadata: Record<string, any>; // 关系元数据
  createdAt: Date;           // 创建时间
  updatedAt: Date;           // 更新时间
  createdBy: string;         // 创建者
  tenantId?: string;         // 租户ID
}

enum RelationType {
  IS_A = 'is_a',             // 是一种（继承）
  PART_OF = 'part_of',       // 是一部分
  DEPENDS_ON = 'depends_on', // 依赖于
  RELATED_TO = 'related_to', // 相关
  PRECEDES = 'precedes',     // 先于
  CAUSES = 'causes',         // 导致
  EXAMPLE_OF = 'example_of'  // 是示例
}
```

### 2.3 属性模型

```typescript
interface EntityProperty {
  id: string;                 // 唯一标识符
  entityId: string;          // 所属实体ID
  name: string[];            // 属性名称
  value: any;                // 属性值
  type: PropertyType;        // 属性类型
  isRequired: boolean;       // 是否必需
  isUnique: boolean;         // 是否唯一
  validation?: ValidationRule; // 验证规则
  createdAt: Date;           // 创建时间
  updatedAt: Date;           // 更新时间
  createdBy: string;         // 创建者
  tenantId?: string;         // 租户ID
}

enum PropertyType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object',
  REFERENCE = 'reference'    // 引用其他实体
}

interface ValidationRule {
  type: 'regex' | 'range' | 'enum' | 'custom';
  value: any;
  message: string;
}
```

### 2.4 历史记录模型

```typescript
interface EntityHistory {
  id: string;                 // 唯一标识符
  entityId: string;          // 实体ID
  version: number;           // 版本号
  data: KnowledgeEntity;     // 版本数据
  changeType: ChangeType;    // 变更类型
  changeSummary: string;     // 变更摘要
  changedBy: string;         // 变更者
  changedAt: Date;           // 变更时间
  tenantId?: string;         // 租户ID
}

enum ChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  RESTORE = 'restore'
}
```

### 2.5 知识图谱模型

```typescript
interface KnowledgeGraph {
  id: string;                 // 图谱ID
  name: string;              // 图谱名称
  description: string;        // 图谱描述
  entities: string[];        // 包含的实体ID列表
  relations: string[];       // 包含的关系ID列表
  metadata: Record<string, any>; // 元数据
  createdAt: Date;           // 创建时间
  updatedAt: Date;           // 更新时间
  createdBy: string;         // 创建者
  tenantId?: string;         // 租户ID
}
```

## 3. 混合存储策略设计

### 3.1 存储层次架构

```
应用层
  ↓
缓存层 (Redis)
  ↓
主存储 (MongoDB)
  ↓
归档存储 (对象存储/S3)
  ↓
备份存储 (冷存储)
```

### 3.2 存储策略

1. **热数据存储** (MongoDB)
   - 频繁访问的知识实体和关系
   - 当前活跃的知识图谱
   - 最近的历史记录

2. **缓存存储** (Redis)
   - 热点实体和关系
   - 查询结果缓存
   - 会话状态

3. **本地存储** (文件系统)
   - 配置文件
   - 本地缓存
   - 日志文件

4. **归档存储** (对象存储/S3)
   - 不常访问的历史数据
   - 大型附件和媒体文件
   - 定期备份

5. **备份存储** (冷存储)
   - 长期备份
   - 灾难恢复

## 4. 缓存和索引优化方案

### 4.1 缓存策略

```typescript
interface CacheStrategy {
  entityCache: {
    ttl: number;              // 实体缓存TTL（秒）
    maxSize: number;          // 最大缓存数量
    strategy: 'lru' | 'lfu' | 'fifo'; // 缓存策略
  };
  queryCache: {
    ttl: number;              // 查询缓存TTL（秒）
    maxSize: number;          // 最大缓存数量
  };
  relationCache: {
    ttl: number;              // 关系缓存TTL（秒）
    maxSize: number;          // 最大缓存数量
  };
}
```

### 4.2 索引策略

```typescript
interface IndexStrategy {
  entities: {
    name: 'text';             // 名称全文索引
    tags: 'multikey';         // 标签多键索引
    type: 'hashed';           // 类型哈希索引
    createdAt: 'ascending';   // 创建时间升序索引
    tenantId: 'hashed';       // 租户ID哈希索引
    compound: [               // 复合索引
      { fields: ['tenantId', 'type', 'status'] },
      { fields: ['tenantId', 'createdAt'] }
    ];
  };
  relations: {
    sourceId: 'hashed';       // 源实体ID哈希索引
    targetId: 'hashed';       // 目标实体ID哈希索引
    type: 'hashed';           // 关系类型哈希索引
    compound: [               // 复合索引
      { fields: ['sourceId', 'type'] },
      { fields: ['targetId', 'type'] },
      { fields: ['tenantId', 'sourceId'] }
    ];
  };
}
```

## 5. 数据备份和恢复策略

### 5.1 备份策略

1. **实时备份**
   - MongoDB 复制集
   - Redis 主从复制

2. **定期备份**
   - 每日增量备份
   - 每周完整备份
   - 每月归档备份

3. **备份存储位置**
   - 本地存储（最近7天）
   - 异地存储（最近30天）
   - 云存储（长期归档）

### 5.2 恢复策略

1. **灾难恢复**
   - RTO (恢复时间目标): < 1小时
   - RPO (恢复点目标): < 5分钟

2. **数据恢复流程**
   - 评估数据损坏程度
   - 选择合适的备份版本
   - 执行恢复操作
   - 验证数据完整性

## 6. 实现计划

### 6.1 核心组件

1. **存储抽象层增强**
   - 扩展现有的 `AbstractEntityStorage` 和 `AbstractPropertyStorage`
   - 添加关系存储抽象类 `AbstractRelationStorage`
   - 添加历史记录存储抽象类 `AbstractHistoryStorage`

2. **存储实现**
   - 增强现有的 MongoDB 存储
   - 添加 Redis 缓存存储
   - 添加对象存储接口

3. **存储管理器**
   - 统一的存储管理接口
   - 自动存储路由
   - 缓存管理
   - 索引管理

### 6.2 实施顺序

1. 第一阶段：数据模型增强
   - 更新现有数据模型
   - 实现关系存储
   - 实现历史记录存储

2. 第二阶段：缓存和索引
   - 实现 Redis 缓存层
   - 优化数据库索引
   - 实现查询优化

3. 第三阶段：备份和恢复
   - 实现备份策略
   - 实现恢复机制
   - 添加监控和告警

## 7. 配置示例

```typescript
interface StorageConfig {
  primary: {
    type: 'mongodb';
    config: {
      uri: string;
      dbName: string;
      options: MongoClientOptions;
    };
  };
  cache: {
    type: 'redis';
    config: {
      host: string;
      port: number;
      password?: string;
      db: number;
    };
  };
  archive: {
    type: 's3' | 'minio' | 'filesystem';
    config: {
      endpoint?: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      region?: string;
    };
  };
  backup: {
    schedule: {
      incremental: string;    // cron expression
      full: string;          // cron expression
      archive: string;       // cron expression
    };
    retention: {
      daily: number;         // days
      weekly: number;        // weeks
      monthly: number;       // months
    };
  };
  cacheStrategy: CacheStrategy;
  indexStrategy: IndexStrategy;
}
```

## 8. 总结

这个存储方案设计提供了：

1. **丰富的数据模型**：支持复杂的知识表示和关系
2. **灵活的存储策略**：根据数据访问模式选择最佳存储
3. **高性能缓存**：通过多级缓存提升查询性能
4. **可靠的数据保护**：全面的备份和恢复策略
5. **可扩展的架构**：支持系统规模增长

该设计既保留了现有系统的优点，又解决了其局限性，为知识管理系统提供了一个强大而灵活的数据存储基础。