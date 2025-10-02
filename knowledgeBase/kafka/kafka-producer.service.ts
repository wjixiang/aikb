import { Kafka, Producer, ProducerRecord, Message } from 'kafkajs';
import createLoggerWithPrefix from '../lib/logger';
import { KafkaEvent, KafkaMessage, KafkaProducerConfig, KAFKA_TOPICS } from './kafka.types';

const logger = createLoggerWithPrefix('KafkaProducer');

/**
 * Kafka Producer service for publishing events
 */
export class KafkaProducerService {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor(private config: KafkaProducerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl ? {
        mechanism: config.sasl.mechanism as any,
        username: config.sasl.username,
        password: config.sasl.password,
      } : undefined,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      retry: config.retry,
    });

    this.producer = this.kafka.producer({
      transactionTimeout: config.transactionTimeout,
      maxInFlightRequests: config.maxInFlightRequests,
      idempotent: config.idempotent ?? true,
    });
  }

  /**
   * Connect to Kafka cluster
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka producer:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka cluster
   */
  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      this.isConnected = false;
      logger.info('Kafka producer disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect Kafka producer:', error);
      throw error;
    }
  }

  /**
   * Check if producer is connected
   */
  isProducerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Send a single event to Kafka
   */
  async sendEvent(topic: string, event: KafkaEvent): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer is not connected');
    }

    try {
      const message: Message = {
        key: event.eventId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          timestamp: event.timestamp.toString(),
        },
        timestamp: event.timestamp.toString(),
      };

      const record: ProducerRecord = {
        topic,
        messages: [message],
      };

      await this.producer.send(record);
      logger.debug(`Event sent to topic ${topic}:`, { eventId: event.eventId, eventType: event.eventType });
    } catch (error) {
      logger.error(`Failed to send event to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Send multiple events in a batch
   */
  async sendBatchEvents(topic: string, events: KafkaEvent[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer is not connected');
    }

    try {
      const messages: Message[] = events.map(event => ({
        key: event.eventId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          timestamp: event.timestamp.toString(),
        },
        timestamp: event.timestamp.toString(),
      }));

      const record: ProducerRecord = {
        topic,
        messages,
      };

      await this.producer.send(record);
      logger.debug(`Batch events sent to topic ${topic}:`, { count: events.length });
    } catch (error) {
      logger.error(`Failed to send batch events to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Send entity created event
   */
  async sendEntityCreatedEvent(entityId: string, entityData: any): Promise<void> {
    const event = {
      eventType: 'ENTITY_CREATED' as const,
      timestamp: Date.now(),
      eventId: `entity_created_${entityId}_${Date.now()}`,
      entityId,
      entityData,
    };

    await this.sendEvent(KAFKA_TOPICS.ENTITY_EVENTS, event);
  }

  /**
   * Send entity updated event
   */
  async sendEntityUpdatedEvent(entityId: string, oldEntityData: any, newEntityData: any): Promise<void> {
    const event = {
      eventType: 'ENTITY_UPDATED' as const,
      timestamp: Date.now(),
      eventId: `entity_updated_${entityId}_${Date.now()}`,
      entityId,
      oldEntityData,
      newEntityData,
    };

    await this.sendEvent(KAFKA_TOPICS.ENTITY_EVENTS, event);
  }

  /**
   * Send entity deleted event
   */
  async sendEntityDeletedEvent(entityId: string, entityData: any): Promise<void> {
    const event = {
      eventType: 'ENTITY_DELETED' as const,
      timestamp: Date.now(),
      eventId: `entity_deleted_${entityId}_${Date.now()}`,
      entityId,
      entityData,
    };

    await this.sendEvent(KAFKA_TOPICS.ENTITY_EVENTS, event);
  }

  /**
   * Send entity relation created event
   */
  async sendEntityRelationCreatedEvent(sourceId: string, targetId: string, relationType: string, properties?: Record<string, any>): Promise<void> {
    const event = {
      eventType: 'ENTITY_RELATION_CREATED' as const,
      timestamp: Date.now(),
      eventId: `relation_created_${sourceId}_${targetId}_${relationType}_${Date.now()}`,
      sourceId,
      targetId,
      relationType,
      properties,
    };

    await this.sendEvent(KAFKA_TOPICS.ENTITY_RELATION_PROCESSING, event);
  }

  /**
   * Send entity vector generated event
   */
  async sendEntityVectorGeneratedEvent(entityId: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    const event = {
      eventType: 'ENTITY_VECTOR_GENERATED' as const,
      timestamp: Date.now(),
      eventId: `vector_generated_${entityId}_${Date.now()}`,
      entityId,
      vector,
      metadata,
    };

    await this.sendEvent(KAFKA_TOPICS.ENTITY_VECTOR_PROCESSING, event);
  }

  /**
   * Send knowledge created event
   */
  async sendKnowledgeCreatedEvent(knowledgeId: string, knowledgeData: any, sourceId: string): Promise<void> {
    const event = {
      eventType: 'KNOWLEDGE_CREATED' as const,
      timestamp: Date.now(),
      eventId: `knowledge_created_${knowledgeId}_${Date.now()}`,
      knowledgeId,
      knowledgeData,
      sourceId,
    };

    await this.sendEvent(KAFKA_TOPICS.KNOWLEDGE_EVENTS, event);
  }

  /**
   * Send knowledge vector generated event
   */
  async sendKnowledgeVectorGeneratedEvent(knowledgeId: string, vector: number[], metadata?: Record<string, any>): Promise<void> {
    const event = {
      eventType: 'KNOWLEDGE_VECTOR_GENERATED' as const,
      timestamp: Date.now(),
      eventId: `knowledge_vector_generated_${knowledgeId}_${Date.now()}`,
      knowledgeId,
      vector,
      metadata,
    };

    await this.sendEvent(KAFKA_TOPICS.KNOWLEDGE_VECTOR_PROCESSING, event);
  }

  /**
   * Execute a transaction with multiple events
   */
  async sendTransaction(events: Array<{ topic: string; event: KafkaEvent }>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka producer is not connected');
    }

    try {
      const transaction = await this.producer.transaction();
      
      try {
        for (const { topic, event } of events) {
          const message: Message = {
            key: event.eventId,
            value: JSON.stringify(event),
            headers: {
              eventType: event.eventType,
              timestamp: event.timestamp.toString(),
            },
            timestamp: event.timestamp.toString(),
          };

          await transaction.send({
            topic,
            messages: [message],
          });
        }

        await transaction.commit();
        logger.debug('Transaction committed successfully:', { eventCount: events.length });
      } catch (error) {
        await transaction.abort();
        logger.error('Transaction aborted due to error:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Failed to execute transaction:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance for the Kafka producer service
 */
let kafkaProducerInstance: KafkaProducerService | null = null;

/**
 * Get or create the Kafka producer singleton instance
 */
export function getKafkaProducer(config?: KafkaProducerConfig): KafkaProducerService {
  if (!kafkaProducerInstance) {
    if (!config) {
      throw new Error('Kafka producer config is required for first initialization');
    }
    kafkaProducerInstance = new KafkaProducerService(config);
  }
  return kafkaProducerInstance;
}

/**
 * Initialize and connect the Kafka producer
 */
export async function initializeKafkaProducer(config: KafkaProducerConfig): Promise<KafkaProducerService> {
  const producer = getKafkaProducer(config);
  await producer.connect();
  return producer;
}