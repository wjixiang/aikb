import type { KnowledgeEvent } from './types';

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
    toEventId?: string,
  ): Promise<void>;

  // 获取事件统计
  getEventStats(options?: EventStatsOptions): Promise<EventStats>;

  // 创建快照
  createSnapshot(
    snapshotId: string,
    metadata?: SnapshotMetadata,
  ): Promise<void>;

  // 获取快照
  getSnapshot(snapshotId: string): Promise<Snapshot | null>;

  // 删除旧事件
  cleanupEvents(olderThan: Date): Promise<number>;
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
  correlationId?: string;
  userId?: string;
}

export interface EventStatsOptions {
  fromTimestamp?: Date;
  toTimestamp?: Date;
  groupBy?: 'eventType' | 'entityType' | 'userId';
  includeDetails?: boolean;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByEntityType: Record<string, number>;
  eventsByUser: Record<string, number>;
  timeRange: {
    from: Date;
    to: Date;
  };
  averageEventsPerDay: number;
  peakHour: {
    hour: number;
    count: number;
  };
}

export interface EventHandler<T extends KnowledgeEvent> {
  (event: T): Promise<void>;
}

export interface SnapshotMetadata {
  createdAt: Date;
  lastEventId?: string;
  eventCount: number;
  description?: string;
  tags?: string[];
  version?: string;
}

export interface Snapshot {
  id: string;
  metadata: SnapshotMetadata;
  data: any; // 序列化的系统状态
}

// 事件存储配置
export interface EventStoreConfig {
  batchSize?: number;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  retentionPeriod?: number; // 天数
  snapshotInterval?: number; // 事件数量
  enableMetrics?: boolean;
}

// 事件存储指标
export interface EventStoreMetrics {
  totalEventsStored: number;
  totalSnapshots: number;
  storageSize: number;
  averageWriteTime: number;
  averageReadTime: number;
  compressionRatio?: number;
  errorRate: number;
}
