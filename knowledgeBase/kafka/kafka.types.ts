import { EntityData, EntityDataWithId, KnowledgeData, KnowledgeDataWithId } from '../knowledge.type';

/**
 * Base interface for all Kafka events
 */
export interface BaseKafkaEvent {
  eventType: string;
  timestamp: number;
  eventId: string;
}

/**
 * Entity-related events
 */
export interface EntityCreatedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_CREATED';
  entityId: string;
  entityData: EntityData;
}

export interface EntityUpdatedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_UPDATED';
  entityId: string;
  oldEntityData: EntityDataWithId;
  newEntityData: EntityData;
}

export interface EntityDeletedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_DELETED';
  entityId: string;
  entityData: EntityDataWithId;
}

/**
 * Entity relation events
 */
export interface EntityRelationCreatedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_RELATION_CREATED';
  sourceId: string;
  targetId: string;
  relationType: string;
  properties?: Record<string, any>;
}

export interface EntityRelationUpdatedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_RELATION_UPDATED';
  sourceId: string;
  targetId: string;
  relationType: string;
  properties: Record<string, any>;
}

export interface EntityRelationDeletedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_RELATION_DELETED';
  sourceId: string;
  targetId: string;
  relationType: string;
}

/**
 * Entity vector events
 */
export interface EntityVectorGeneratedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_VECTOR_GENERATED';
  entityId: string;
  vector: number[];
  metadata?: Record<string, any>;
}

export interface EntityVectorUpdatedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_VECTOR_UPDATED';
  entityId: string;
  vector: number[];
  metadata?: Record<string, any>;
}

export interface EntityVectorDeletedEvent extends BaseKafkaEvent {
  eventType: 'ENTITY_VECTOR_DELETED';
  entityId: string;
}

/**
 * Knowledge-related events
 */
export interface KnowledgeCreatedEvent extends BaseKafkaEvent {
  eventType: 'KNOWLEDGE_CREATED';
  knowledgeId: string;
  knowledgeData: KnowledgeData;
  sourceId: string;
}

export interface KnowledgeUpdatedEvent extends BaseKafkaEvent {
  eventType: 'KNOWLEDGE_UPDATED';
  knowledgeId: string;
  oldKnowledgeData: KnowledgeDataWithId;
  newKnowledgeData: KnowledgeData;
}

export interface KnowledgeDeletedEvent extends BaseKafkaEvent {
  eventType: 'KNOWLEDGE_DELETED';
  knowledgeId: string;
  knowledgeData: KnowledgeDataWithId;
}

/**
 * Knowledge vector events
 */
export interface KnowledgeVectorGeneratedEvent extends BaseKafkaEvent {
  eventType: 'KNOWLEDGE_VECTOR_GENERATED';
  knowledgeId: string;
  vector: number[];
  metadata?: Record<string, any>;
}

/**
 * Union type for all entity events
 */
export type EntityEvent = 
  | EntityCreatedEvent
  | EntityUpdatedEvent
  | EntityDeletedEvent
  | EntityRelationCreatedEvent
  | EntityRelationUpdatedEvent
  | EntityRelationDeletedEvent
  | EntityVectorGeneratedEvent
  | EntityVectorUpdatedEvent
  | EntityVectorDeletedEvent;

/**
 * Union type for all knowledge events
 */
export type KnowledgeEvent = 
  | KnowledgeCreatedEvent
  | KnowledgeUpdatedEvent
  | KnowledgeDeletedEvent
  | KnowledgeVectorGeneratedEvent;

/**
 * Union type for all Kafka events
 */
export type KafkaEvent = EntityEvent | KnowledgeEvent;

/**
 * Kafka configuration
 */
export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    initialRetryTime: number;
    retries: number;
  };
}

/**
 * Kafka producer configuration
 */
export interface KafkaProducerConfig extends KafkaConfig {
  transactionTimeout?: number;
  maxInFlightRequests?: number;
  idempotent?: boolean;
}

/**
 * Kafka consumer configuration
 */
export interface KafkaConsumerConfig extends KafkaConfig {
  groupId: string;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxWaitTimeInMs?: number;
  allowAutoTopicCreation?: boolean;
  autoOffsetReset?: 'earliest' | 'latest' | 'none';
}

/**
 * Kafka message structure
 */
export interface KafkaMessage<T = any> {
  key?: string;
  value: T;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: number;
}

/**
 * Kafka topic names
 */
export const KAFKA_TOPICS = {
  ENTITY_EVENTS: 'entity-events',
  KNOWLEDGE_EVENTS: 'knowledge-events',
  ENTITY_VECTOR_PROCESSING: 'entity-vector-processing',
  KNOWLEDGE_VECTOR_PROCESSING: 'knowledge-vector-processing',
  ENTITY_RELATION_PROCESSING: 'entity-relation-processing',
  DEAD_LETTER_QUEUE: 'dead-letter-queue'
} as const;

/**
 * Kafka consumer group names
 */
export const KAFKA_CONSUMER_GROUPS = {
  ENTITY_CONTENT_PROCESSOR: 'entity-content-processor',
  ENTITY_GRAPH_PROCESSOR: 'entity-graph-processor',
  ENTITY_VECTOR_PROCESSOR: 'entity-vector-processor',
  KNOWLEDGE_CONTENT_PROCESSOR: 'knowledge-content-processor',
  KNOWLEDGE_VECTOR_PROCESSOR: 'knowledge-vector-processor'
} as const;