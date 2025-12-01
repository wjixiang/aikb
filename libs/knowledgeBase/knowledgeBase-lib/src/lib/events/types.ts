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
  eventType: EVENT_TYPES.ENTITY_CREATED;
  data: EntityData;
}

export interface EntityUpdatedEvent extends EntityEvent {
  eventType: EVENT_TYPES.ENTITY_UPDATED;
  oldData: EntityData;
  newData: EntityData;
  changes: Partial<EntityData>;
}

export interface EntityDeletedEvent extends EntityEvent {
  eventType: EVENT_TYPES.ENTITY_DELETED;
  data: EntityData;
}

// 顶点事件
export interface VertexEvent extends KnowledgeEvent {
  entityType: 'vertex';
  vertexId: string;
}

export interface VertexCreatedEvent extends VertexEvent {
  eventType: EVENT_TYPES.VERTEX_CREATED;
  data: VertexData;
}

export interface VertexUpdatedEvent extends VertexEvent {
  eventType: EVENT_TYPES.VERTEX_UPDATED;
  oldData: VertexData;
  newData: VertexData;
  changes: Partial<VertexData>;
}

export interface VertexDeletedEvent extends VertexEvent {
  eventType: EVENT_TYPES.VERTEX_DELETED;
  data: VertexData;
}

// 属性事件
export interface PropertyEvent extends KnowledgeEvent {
  entityType: 'property';
  propertyId: string;
}

export interface PropertyCreatedEvent extends PropertyEvent {
  eventType: EVENT_TYPES.PROPERTY_CREATED;
  data: PropertyData;
}

export interface PropertyUpdatedEvent extends PropertyEvent {
  eventType: EVENT_TYPES.PROPERTY_UPDATED;
  oldData: PropertyData;
  newData: PropertyData;
  changes: Partial<PropertyData>;
}

export interface PropertyDeletedEvent extends PropertyEvent {
  eventType: EVENT_TYPES.PROPERTY_DELETED;
  data: PropertyData;
}

// 边事件
export interface EdgeEvent extends KnowledgeEvent {
  entityType: 'edge';
  edgeId: string;
}

export interface EdgeCreatedEvent extends EdgeEvent {
  eventType: EVENT_TYPES.EDGE_CREATED;
  data: EdgeData;
}

export interface EdgeUpdatedEvent extends EdgeEvent {
  eventType: EVENT_TYPES.EDGE_UPDATED;
  oldData: EdgeData;
  newData: EdgeData;
  changes: Partial<EdgeData>;
}

export interface EdgeDeletedEvent extends EdgeEvent {
  eventType: EVENT_TYPES.EDGE_DELETED;
  data: EdgeData;
}

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

export interface BranchCreatedEvent extends VersionControlEvent {
  eventType: 'branch.created';
  branchName: string;
  baseCommitId?: string;
}

export interface BranchMergedEvent extends VersionControlEvent {
  eventType: 'branch.merged';
  sourceBranch: string;
  targetBranch: string;
  mergeCommitId: string;
}

// 事务事件
export interface TransactionEvent extends KnowledgeEvent {
  entityType: 'transaction';
  transactionId: string;
}

export interface TransactionStartedEvent extends TransactionEvent {
  eventType: 'transaction.started';
}

export interface TransactionCommittedEvent extends TransactionEvent {
  eventType: 'transaction.committed';
  operationCount: number;
}

export interface TransactionRolledBackEvent extends TransactionEvent {
  eventType: 'transaction.rolled_back';
  reason: string;
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
  | CommitCreatedEvent
  | BranchCreatedEvent
  | BranchMergedEvent
  | TransactionStartedEvent
  | TransactionCommittedEvent
  | TransactionRolledBackEvent;

// 事件类型枚举 - 统一管理所有事件类型
export enum EVENT_TYPES {
  // 实体事件
  ENTITY_CREATED = 'entity.created',
  ENTITY_UPDATED = 'entity.updated',
  ENTITY_DELETED = 'entity.deleted',
  
  // 顶点事件
  VERTEX_CREATED = 'vertex.created',
  VERTEX_UPDATED = 'vertex.updated',
  VERTEX_DELETED = 'vertex.deleted',
  
  // 属性事件
  PROPERTY_CREATED = 'property.created',
  PROPERTY_UPDATED = 'property.updated',
  PROPERTY_DELETED = 'property.deleted',
  
  // 边事件
  EDGE_CREATED = 'edge.created',
  EDGE_UPDATED = 'edge.updated',
  EDGE_DELETED = 'edge.deleted',
  
  // 批量操作事件
  BATCH_OPERATION = 'batch.operation',
  
  // 版本控制事件
  COMMIT_CREATED = 'commit.created',
  BRANCH_CREATED = 'branch.created',
  BRANCH_MERGED = 'branch.merged',
  
  // 事务事件
  TRANSACTION_STARTED = 'transaction.started',
  TRANSACTION_COMMITTED = 'transaction.committed',
  TRANSACTION_ROLLED_BACK = 'transaction.rolled_back'
}

// 事件类型常量对象 - 保持向后兼容性
export const EVENT_TYPES_CONSTANTS = {
  // 实体事件
  ENTITY_CREATED: EVENT_TYPES.ENTITY_CREATED,
  ENTITY_UPDATED: EVENT_TYPES.ENTITY_UPDATED,
  ENTITY_DELETED: EVENT_TYPES.ENTITY_DELETED,
  
  // 顶点事件
  VERTEX_CREATED: EVENT_TYPES.VERTEX_CREATED,
  VERTEX_UPDATED: EVENT_TYPES.VERTEX_UPDATED,
  VERTEX_DELETED: EVENT_TYPES.VERTEX_DELETED,
  
  // 属性事件
  PROPERTY_CREATED: EVENT_TYPES.PROPERTY_CREATED,
  PROPERTY_UPDATED: EVENT_TYPES.PROPERTY_UPDATED,
  PROPERTY_DELETED: EVENT_TYPES.PROPERTY_DELETED,
  
  // 边事件
  EDGE_CREATED: EVENT_TYPES.EDGE_CREATED,
  EDGE_UPDATED: EVENT_TYPES.EDGE_UPDATED,
  EDGE_DELETED: EVENT_TYPES.EDGE_DELETED,
  
  // 批量操作事件
  BATCH_OPERATION: EVENT_TYPES.BATCH_OPERATION,
  
  // 版本控制事件
  COMMIT_CREATED: EVENT_TYPES.COMMIT_CREATED,
  BRANCH_CREATED: EVENT_TYPES.BRANCH_CREATED,
  BRANCH_MERGED: EVENT_TYPES.BRANCH_MERGED,
  
  // 事务事件
  TRANSACTION_STARTED: EVENT_TYPES.TRANSACTION_STARTED,
  TRANSACTION_COMMITTED: EVENT_TYPES.TRANSACTION_COMMITTED,
  TRANSACTION_ROLLED_BACK: EVENT_TYPES.TRANSACTION_ROLLED_BACK
} as const;

// 导入版本控制相关类型
import { ChangeSet } from '../versionControl/types';