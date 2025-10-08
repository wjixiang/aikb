import { EntityData, EntityDataWithId } from '../knowledge.type';
import {
  AbstractEntityStorage,
  AbstractEntityContentStorage,
  AbstractEntityGraphStorage,
  AbstractEntityVectorStorage,
} from '../storage/abstract-storage';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService, EventHandler } from './kafka-consumer.service';
import {
  EntityCreatedEvent,
  EntityUpdatedEvent,
  EntityDeletedEvent,
  EntityRelationCreatedEvent,
  EntityVectorGeneratedEvent,
  KafkaEvent,
} from './kafka.types';
import createLoggerWithPrefix from '../lib/logger';

const logger = createLoggerWithPrefix('KafkaEntityStorage');

/**
 * Kafka-enabled Entity Storage implementation
 * This class acts as a proxy that publishes events to Kafka instead of directly
 * interacting with storage implementations. The actual storage operations are
 * handled by separate consumer services.
 */
export class KafkaEntityStorage extends AbstractEntityStorage {
  entityContentStorage: AbstractEntityContentStorage;
  entityGraphStorage: AbstractEntityGraphStorage;
  entityVectorStorage: AbstractEntityVectorStorage;

  constructor(
    private kafkaProducer: KafkaProducerService,
    entityContentStorage: AbstractEntityContentStorage,
    entityGraphStorage: AbstractEntityGraphStorage,
    entityVectorStorage: AbstractEntityVectorStorage,
  ) {
    super();
    this.entityContentStorage = entityContentStorage;
    this.entityGraphStorage = entityGraphStorage;
    this.entityVectorStorage = entityVectorStorage;
  }

  /**
   * Create a new entity by publishing an event to Kafka
   */
  async create_new_entity(entity: EntityData): Promise<EntityDataWithId> {
    const entityId = AbstractEntityStorage.generate_entity_id();

    try {
      // Send entity created event to Kafka
      await this.kafkaProducer.sendEntityCreatedEvent(entityId, entity);

      logger.info(`Entity creation event sent for ID: ${entityId}`);

      // Return the entity with ID immediately (async processing will handle storage)
      return {
        ...entity,
        id: entityId,
      };
    } catch (error) {
      logger.error('Failed to send entity creation event:', error);
      throw error;
    }
  }

  /**
   * Update an entity by publishing an event to Kafka
   */
  async update_entity(
    oldEntity: EntityDataWithId,
    newEntityData: EntityData,
  ): Promise<EntityDataWithId> {
    try {
      // Send entity updated event to Kafka
      await this.kafkaProducer.sendEntityUpdatedEvent(
        oldEntity.id,
        oldEntity,
        newEntityData,
      );

      logger.info(`Entity update event sent for ID: ${oldEntity.id}`);

      // Return the updated entity immediately (async processing will handle storage)
      return {
        ...newEntityData,
        id: oldEntity.id,
      };
    } catch (error) {
      logger.error('Failed to send entity update event:', error);
      throw error;
    }
  }

  /**
   * Delete an entity by publishing an event to Kafka
   */
  async delete_entity(entityId: string): Promise<boolean> {
    try {
      // First get the entity data to include in the event
      const entityData =
        await this.entityContentStorage.get_entity_by_id(entityId);

      if (!entityData) {
        logger.warn(`Entity not found for deletion: ${entityId}`);
        return false;
      }

      // Send entity deleted event to Kafka
      await this.kafkaProducer.sendEntityDeletedEvent(entityId, entityData);

      logger.info(`Entity deletion event sent for ID: ${entityId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send entity deletion event:', error);
      throw error;
    }
  }

  /**
   * Create a relation between entities by publishing an event to Kafka
   */
  async create_entity_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    try {
      // Send entity relation created event to Kafka
      await this.kafkaProducer.sendEntityRelationCreatedEvent(
        sourceId,
        targetId,
        relationType,
        properties,
      );

      logger.info(
        `Entity relation creation event sent: ${sourceId} -> ${targetId} (${relationType})`,
      );
    } catch (error) {
      logger.error('Failed to send entity relation creation event:', error);
      throw error;
    }
  }

  /**
   * Generate and store vector for an entity by publishing an event to Kafka
   */
  async generate_entity_vector(
    entityId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Send entity vector generated event to Kafka
      await this.kafkaProducer.sendEntityVectorGeneratedEvent(
        entityId,
        vector,
        metadata,
      );

      logger.info(`Entity vector generation event sent for ID: ${entityId}`);
    } catch (error) {
      logger.error('Failed to send entity vector generation event:', error);
      throw error;
    }
  }
}

/**
 * Entity Content Processor - handles entity content storage operations
 */
export class EntityContentProcessor {
  constructor(
    private consumer: KafkaConsumerService,
    private entityContentStorage: AbstractEntityContentStorage,
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle entity creation
    this.consumer.registerEventHandler<EntityCreatedEvent>(
      'ENTITY_CREATED',
      this.handleEntityCreated.bind(this),
    );

    // Handle entity updates
    this.consumer.registerEventHandler<EntityUpdatedEvent>(
      'ENTITY_UPDATED',
      this.handleEntityUpdated.bind(this),
    );

    // Handle entity deletion
    this.consumer.registerEventHandler<EntityDeletedEvent>(
      'ENTITY_DELETED',
      this.handleEntityDeleted.bind(this),
    );
  }

  private async handleEntityCreated(event: EntityCreatedEvent): Promise<void> {
    try {
      await this.entityContentStorage.create_new_entity_content(
        event.entityData,
        event.entityId,
      );
      logger.info(`Entity content stored for ID: ${event.entityId}`);
    } catch (error) {
      logger.error(
        `Failed to store entity content for ID: ${event.entityId}`,
        error,
      );
      throw error;
    }
  }

  private async handleEntityUpdated(event: EntityUpdatedEvent): Promise<void> {
    try {
      await this.entityContentStorage.update_entity(
        event.oldEntityData,
        event.newEntityData,
      );
      logger.info(`Entity content updated for ID: ${event.entityId}`);
    } catch (error) {
      logger.error(
        `Failed to update entity content for ID: ${event.entityId}`,
        error,
      );
      throw error;
    }
  }

  private async handleEntityDeleted(event: EntityDeletedEvent): Promise<void> {
    try {
      await this.entityContentStorage.delete_entity_by_id(event.entityId);
      logger.info(`Entity content deleted for ID: ${event.entityId}`);
    } catch (error) {
      logger.error(
        `Failed to delete entity content for ID: ${event.entityId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    await this.consumer.setupEntityContentProcessor();
    await this.consumer.startConsuming();
    logger.info('Entity content processor started');
  }

  /**
   * Stop the processor
   */
  async stop(): Promise<void> {
    await this.consumer.stopConsuming();
    await this.consumer.disconnect();
    logger.info('Entity content processor stopped');
  }
}

/**
 * Entity Graph Processor - handles entity relationship storage operations
 */
export class EntityGraphProcessor {
  constructor(
    private consumer: KafkaConsumerService,
    private entityGraphStorage: AbstractEntityGraphStorage,
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle entity relation creation
    this.consumer.registerEventHandler<EntityRelationCreatedEvent>(
      'ENTITY_RELATION_CREATED',
      this.handleRelationCreated.bind(this),
    );
  }

  private async handleRelationCreated(
    event: EntityRelationCreatedEvent,
  ): Promise<void> {
    try {
      await this.entityGraphStorage.create_relation(
        event.sourceId,
        event.targetId,
        event.relationType,
        event.properties,
      );
      logger.info(
        `Entity relation stored: ${event.sourceId} -> ${event.targetId} (${event.relationType})`,
      );
    } catch (error) {
      logger.error(
        `Failed to store entity relation: ${event.sourceId} -> ${event.targetId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    await this.consumer.setupEntityGraphProcessor();
    await this.consumer.startConsuming();
    logger.info('Entity graph processor started');
  }

  /**
   * Stop the processor
   */
  async stop(): Promise<void> {
    await this.consumer.stopConsuming();
    await this.consumer.disconnect();
    logger.info('Entity graph processor stopped');
  }
}

/**
 * Entity Vector Processor - handles entity vector storage operations
 */
export class EntityVectorProcessor {
  constructor(
    private consumer: KafkaConsumerService,
    private entityVectorStorage: AbstractEntityVectorStorage,
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle entity vector generation
    this.consumer.registerEventHandler<EntityVectorGeneratedEvent>(
      'ENTITY_VECTOR_GENERATED',
      this.handleVectorGenerated.bind(this),
    );
  }

  private async handleVectorGenerated(
    event: EntityVectorGeneratedEvent,
  ): Promise<void> {
    try {
      await this.entityVectorStorage.store_vector(
        event.entityId,
        event.vector,
        event.metadata,
      );
      logger.info(`Entity vector stored for ID: ${event.entityId}`);
    } catch (error) {
      logger.error(
        `Failed to store entity vector for ID: ${event.entityId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Start the processor
   */
  async start(): Promise<void> {
    await this.consumer.setupEntityVectorProcessor();
    await this.consumer.startConsuming();
    logger.info('Entity vector processor started');
  }

  /**
   * Stop the processor
   */
  async stop(): Promise<void> {
    await this.consumer.stopConsuming();
    await this.consumer.disconnect();
    logger.info('Entity vector processor stopped');
  }
}

/**
 * Factory class to create and configure all processors
 */
export class KafkaEntityProcessorFactory {
  /**
   * Create and start all entity processors
   */
  static async createAndStartProcessors(
    contentConsumer: KafkaConsumerService,
    graphConsumer: KafkaConsumerService,
    vectorConsumer: KafkaConsumerService,
    entityContentStorage: AbstractEntityContentStorage,
    entityGraphStorage: AbstractEntityGraphStorage,
    entityVectorStorage: AbstractEntityVectorStorage,
  ): Promise<{
    contentProcessor: EntityContentProcessor;
    graphProcessor: EntityGraphProcessor;
    vectorProcessor: EntityVectorProcessor;
  }> {
    const contentProcessor = new EntityContentProcessor(
      contentConsumer,
      entityContentStorage,
    );
    const graphProcessor = new EntityGraphProcessor(
      graphConsumer,
      entityGraphStorage,
    );
    const vectorProcessor = new EntityVectorProcessor(
      vectorConsumer,
      entityVectorStorage,
    );

    // Start all processors
    await Promise.all([
      contentProcessor.start(),
      graphProcessor.start(),
      vectorProcessor.start(),
    ]);

    logger.info('All entity processors started successfully');

    return {
      contentProcessor,
      graphProcessor,
      vectorProcessor,
    };
  }

  /**
   * Stop all processors
   */
  static async stopProcessors(
    contentProcessor: EntityContentProcessor,
    graphProcessor: EntityGraphProcessor,
    vectorProcessor: EntityVectorProcessor,
  ): Promise<void> {
    await Promise.all([
      contentProcessor.stop(),
      graphProcessor.stop(),
      vectorProcessor.stop(),
    ]);

    logger.info('All entity processors stopped successfully');
  }
}
