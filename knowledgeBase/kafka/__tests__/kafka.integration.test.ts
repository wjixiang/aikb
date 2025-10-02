import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { KafkaService, initializeAndStartKafkaService, stopKafkaService } from '../kafka.service';
import { KafkaProducerService } from '../kafka-producer.service';
import { KafkaConsumerService, KafkaConsumerFactory } from '../kafka-consumer.service';
import { getValidatedKafkaConfig } from '../kafka.config';
import { KAFKA_TOPICS } from '../kafka.types';
import { MockEntityContentStorage, MockEntityGraphStorage, MockEntityVectorStorage } from '../mocks';
import { createKafkaTopics, deleteKafkaTopics } from '../kafka-topic-setup';
import { config } from 'dotenv';
config()

describe('Kafka Integration Tests', () => {
  let kafkaService: KafkaService;
  let mockContentStorage: MockEntityContentStorage;
  let mockGraphStorage: MockEntityGraphStorage;
  let mockVectorStorage: MockEntityVectorStorage;

  beforeAll(async () => {
    // Check if Kafka is available
    const config = getValidatedKafkaConfig();
    if (!config) {
      console.warn('Kafka not configured, skipping integration tests');
      return;
    }

    // Create required Kafka topics
    console.log('Creating Kafka topics...');
    const topicsCreated = await createKafkaTopics();
    if (!topicsCreated) {
      console.warn('Failed to create Kafka topics, tests may fail');
    } else {
      console.log('Kafka topics created successfully');
    }

    // Initialize mock storage
    mockContentStorage = new MockEntityContentStorage();
    mockGraphStorage = new MockEntityGraphStorage();
    mockVectorStorage = new MockEntityVectorStorage();

    // Initialize Kafka service
    kafkaService = await initializeAndStartKafkaService(
      mockContentStorage,
      mockGraphStorage,
      mockVectorStorage,
    );
  });

  afterAll(async () => {
    if (kafkaService) {
      await stopKafkaService();
    }

    // Optional: Clean up topics after tests
    // Comment this out if you want to keep the topics for debugging
    // const topicsDeleted = await deleteKafkaTopics();
    // if (topicsDeleted) {
    //   console.log('Kafka topics cleaned up successfully');
    // }
  });

  beforeEach(() => {
    // Reset mock storage
    if (mockContentStorage) {
      (mockContentStorage as any).entities.clear();
    }
    if (mockGraphStorage) {
      (mockGraphStorage as any).relations = [];
    }
    if (mockVectorStorage) {
      (mockVectorStorage as any).vectors.clear();
    }
  });

  it('should initialize Kafka service', async () => {
    expect(kafkaService).toBeDefined();
    expect(kafkaService?.isInitialized()).toBe(true);
    expect(kafkaService?.isRunning()).toBe(true);
  });

  it('should pass health check', async () => {
    if (!kafkaService) return;

    const health = await kafkaService.healthCheck();
    expect(health.status).toBe('healthy');
    expect(health.details.producer).toBe(true);
    expect(health.details.contentConsumer).toBe(true);
    expect(health.details.graphConsumer).toBe(true);
    expect(health.details.vectorConsumer).toBe(true);
  });

  it('should create entity through Kafka', async () => {
    if (!kafkaService) return;

    const entityStorage = kafkaService.getEntityStorage();
    if (!entityStorage) return;

    const entityData = {
      name: ['Test Entity'],
      tags: ['test'],
      definition: 'This is a test entity',
    };

    const result = await entityStorage.create_new_entity(entityData);
    
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toEqual(entityData.name);
    expect(result.tags).toEqual(entityData.tags);
    expect(result.definition).toEqual(entityData.definition);

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if entity was stored
    const storedEntity = await mockContentStorage.get_entity_by_id(result.id);
    expect(storedEntity).toBeDefined();
    if (storedEntity) {
      expect(storedEntity.name).toEqual(entityData.name);
    }
  });

  it('should create entity relation through Kafka', async () => {
    if (!kafkaService) return;

    const entityStorage = kafkaService.getEntityStorage();
    if (!entityStorage) return;

    // Create two entities first
    const entity1Data = {
      name: ['Entity 1'],
      tags: ['test'],
      definition: 'This is test entity 1',
    };

    const entity2Data = {
      name: ['Entity 2'],
      tags: ['test'],
      definition: 'This is test entity 2',
    };

    const entity1 = await entityStorage.create_new_entity(entity1Data);
    const entity2 = await entityStorage.create_new_entity(entity2Data);

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create relation
    await entityStorage.create_entity_relation(
      entity1.id,
      entity2.id,
      'related_to',
      { strength: 0.8 }
    );

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if relation was stored
    const relations = await mockGraphStorage.get_entity_relations(entity1.id);
    expect(relations).toHaveLength(1);
    expect(relations[0].sourceId).toBe(entity1.id);
    expect(relations[0].targetId).toBe(entity2.id);
    expect(relations[0].relationType).toBe('related_to');
    expect(relations[0].properties).toEqual({ strength: 0.8 });
  });

  it('should generate entity vector through Kafka', async () => {
    if (!kafkaService) return;

    const entityStorage = kafkaService.getEntityStorage();
    if (!entityStorage) return;

    // Create an entity first
    const entityData = {
      name: ['Vector Entity'],
      tags: ['test', 'vector'],
      definition: 'This is a test entity for vector generation',
    };

    const entity = await entityStorage.create_new_entity(entityData);

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate vector
    const testVector = [0.1, 0.2, 0.3, 0.4, 0.5];
    await entityStorage.generate_entity_vector(entity.id, testVector, { model: 'test-model' });

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if vector was stored
    const storedVector = await mockVectorStorage.get_vector(entity.id);
    expect(storedVector).toBeDefined();
    if (storedVector) {
      expect(storedVector.vector).toEqual(testVector);
      expect(storedVector.metadata).toEqual({ model: 'test-model' });
    }
  });
});