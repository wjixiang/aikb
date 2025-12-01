import { EntityData, VertexData, PropertyData, EdgeData } from '../types';

export interface IKnowledgeManagementService {
  // 实体操作
  createEntity(
    data: Omit<EntityData, 'id'>,
    options?: OperationOptions,
  ): Promise<EntityData>;
  updateEntity(
    id: string,
    updates: Partial<EntityData>,
    options?: OperationOptions,
  ): Promise<EntityData>;
  deleteEntity(id: string, options?: OperationOptions): Promise<boolean>;
  getEntity(id: string): Promise<EntityData | null>;
  findEntities(
    query: EntityQuery,
    options?: QueryOptions,
  ): Promise<EntityData[]>;

  // 顶点操作
  createVertex(
    data: Omit<VertexData, 'id'>,
    options?: OperationOptions,
  ): Promise<VertexData>;
  updateVertex(
    id: string,
    updates: Partial<VertexData>,
    options?: OperationOptions,
  ): Promise<VertexData>;
  deleteVertex(id: string, options?: OperationOptions): Promise<boolean>;
  getVertex(id: string): Promise<VertexData | null>;
  findVertices(
    query: VertexQuery,
    options?: QueryOptions,
  ): Promise<VertexData[]>;

  // 属性操作
  createProperty(
    data: Omit<PropertyData, 'id'>,
    options?: OperationOptions,
  ): Promise<PropertyData>;
  updateProperty(
    id: string,
    updates: Partial<PropertyData>,
    options?: OperationOptions,
  ): Promise<PropertyData>;
  deleteProperty(id: string, options?: OperationOptions): Promise<boolean>;
  getProperty(id: string): Promise<PropertyData | null>;
  findProperties(
    query: PropertyQuery,
    options?: QueryOptions,
  ): Promise<PropertyData[]>;

  // 边操作
  createEdge(
    data: Omit<EdgeData, 'id'>,
    options?: OperationOptions,
  ): Promise<EdgeData>;
  updateEdge(
    id: string,
    updates: Partial<EdgeData>,
    options?: OperationOptions,
  ): Promise<EdgeData>;
  deleteEdge(id: string, options?: OperationOptions): Promise<boolean>;
  getEdge(id: string): Promise<EdgeData | null>;
  findEdges(query: EdgeQuery, options?: QueryOptions): Promise<EdgeData[]>;

  // 批量操作
  executeBatch(
    operations: BatchOperation[],
    options?: BatchOperationOptions,
  ): Promise<BatchResult>;

  // 复杂操作
  createEntityWithRelations(
    entityData: Omit<EntityData, 'id'>,
    vertices: Omit<VertexData, 'id'>[],
    properties: Omit<PropertyData, 'id'>[],
    edges: Omit<EdgeData, 'id'>[],
    options?: OperationOptions,
  ): Promise<EntityWithRelations>;

  // 关系查询
  getEntityRelations(
    entityId: string,
    options?: RelationQueryOptions,
  ): Promise<EntityRelations>;
  getVertexConnections(
    vertexId: string,
    options?: RelationQueryOptions,
  ): Promise<VertexConnections>;

  // 验证操作
  validateEntity(data: EntityData): Promise<ValidationResult>;
  validateVertex(data: VertexData): Promise<ValidationResult>;
  validateProperty(data: PropertyData): Promise<ValidationResult>;
  validateEdge(data: EdgeData): Promise<ValidationResult>;
}

export interface OperationOptions {
  userId?: string;
  sessionId?: string;
  skipVersionControl?: boolean;
  skipValidation?: boolean;
  customMetadata?: Record<string, any>;
  transactionId?: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  includeDeleted?: boolean;
  includeMetadata?: boolean;
}

export interface EntityQuery {
  ids?: string[];
  nomenclature?: string[];
  languages?: ('en' | 'zh')[];
  textSearch?: string;
  vectorSearch?: {
    vector: number[];
    threshold?: number;
    limit?: number;
  };
  tags?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface VertexQuery {
  ids?: string[];
  types?: ('concept' | 'attribute' | 'relationship')[];
  contentSearch?: string;
  entityIds?: string[];
  metadata?: Record<string, any>;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface PropertyQuery {
  ids?: string[];
  contentSearch?: string;
  vertexIds?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface EdgeQuery {
  ids?: string[];
  types?: ('start' | 'middle' | 'end')[];
  inIds?: string[];
  outIds?: string[];
  entityIds?: string[];
  vertexIds?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

export interface BatchOperation {
  operationId: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'entity' | 'vertex' | 'property' | 'edge';
  data?: any;
  id?: string;
  updates?: any;
  dependencies?: string[]; // 依赖的其他操作ID
}

export interface BatchOperationOptions extends OperationOptions {
  transactional?: boolean;
  stopOnError?: boolean;
  parallel?: boolean;
  maxConcurrency?: number;
  dependencyOrder?: boolean; // 是否按依赖顺序执行
}

export interface BatchResult {
  batchId: string;
  successful: Array<{ operation: BatchOperation; result: any }>;
  failed: Array<{ operation: BatchOperation; error: Error }>;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  duration: number;
  transactionId?: string;
}

export interface EntityWithRelations {
  entity: EntityData;
  vertices: VertexData[];
  properties: PropertyData[];
  edges: EdgeData[];
  relations: {
    entityToVertices: EdgeData[];
    vertexToVertices: EdgeData[];
    vertexToProperties: EdgeData[];
  };
}

export interface RelationQueryOptions {
  includeVertices?: boolean;
  includeProperties?: boolean;
  includeEdges?: boolean;
  maxDepth?: number;
  edgeTypes?: ('start' | 'middle' | 'end')[];
  direction?: 'incoming' | 'outgoing' | 'both';
}

export interface EntityRelations {
  entityId: string;
  vertices: Array<{
    vertex: VertexData;
    edge: EdgeData;
    distance: number; // 关系距离
  }>;
  properties: Array<{
    property: PropertyData;
    edge: EdgeData;
    distance: number;
  }>;
  connectedEntities: Array<{
    entity: EntityData;
    path: EdgeData[];
    distance: number;
  }>;
}

export interface VertexConnections {
  vertexId: string;
  incomingEdges: EdgeData[];
  outgoingEdges: EdgeData[];
  connectedVertices: Array<{
    vertex: VertexData;
    edge: EdgeData;
    direction: 'incoming' | 'outgoing';
  }>;
  relatedEntities: Array<{
    entity: EntityData;
    path: Array<VertexData | EdgeData>;
    distance: number;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  value?: any;
}

// 知识管理服务配置
export interface KnowledgeManagementConfig {
  enableValidation?: boolean;
  enableCaching?: boolean;
  cacheTimeout?: number;
  maxBatchSize?: number;
  defaultTimeout?: number;
  enableMetrics?: boolean;
  enableAudit?: boolean;
}

// 知识管理指标
export interface KnowledgeManagementMetrics {
  totalOperations: number;
  operationsByType: Record<string, number>;
  averageOperationTime: number;
  cacheHitRate: number;
  validationErrorRate: number;
  batchOperationStats: {
    totalBatches: number;
    averageBatchSize: number;
    successRate: number;
  };
  relationQueryStats: {
    totalQueries: number;
    averageQueryTime: number;
    averageResultSize: number;
  };
}
