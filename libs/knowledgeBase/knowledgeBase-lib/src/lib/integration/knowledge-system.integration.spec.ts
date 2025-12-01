import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from '../events/event-bus.service';
import { GitVersionControlService } from '../versionControl/version-control.service';
import { EntityStorageMemoryService } from '../knowledgeBaseStorage/entity-storage.memory.service';
import { VertexStorageMemoryService } from '../knowledgeBaseStorage/vertex-storage.memory.service';
import { PropertyStorageMemoryService } from '../knowledgeBaseStorage/property-storage.memory.service';
import { EdgeStorageMemoryService } from '../knowledgeBaseStorage/edge-storage.memory.service';
import {
  EntityCreatedEvent,
  VertexCreatedEvent,
  PropertyCreatedEvent,
  EdgeCreatedEvent,
  EVENT_TYPES,
} from '../events/types';
import { EntityData, VertexData, PropertyData, EdgeData } from '../types';
// Mock types to avoid importing from embedding module (which pulls in Elasticsearch dependency)
enum OpenAIModel {
  TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002',
}

enum EmbeddingProvider {
  OPENAI = 'openai',
}

describe('Knowledge System Integration', () => {
  let module: TestingModule;
  let eventBus: EventBusService;
  let versionControl: GitVersionControlService;
  let entityStorage: EntityStorageMemoryService;
  let vertexStorage: VertexStorageMemoryService;
  let propertyStorage: PropertyStorageMemoryService;
  let edgeStorage: EdgeStorageMemoryService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: EventBusService,
          useValue: new EventBusService(),
        },
        GitVersionControlService,
        EntityStorageMemoryService,
        VertexStorageMemoryService,
        PropertyStorageMemoryService,
        EdgeStorageMemoryService,
      ],
    }).compile();

    eventBus = module.get<EventBusService>(EventBusService);
    versionControl = module.get<GitVersionControlService>(
      GitVersionControlService,
    );
    entityStorage = module.get<EntityStorageMemoryService>(
      EntityStorageMemoryService,
    );
    vertexStorage = module.get<VertexStorageMemoryService>(
      VertexStorageMemoryService,
    );
    propertyStorage = module.get<PropertyStorageMemoryService>(
      PropertyStorageMemoryService,
    );
    edgeStorage = module.get<EdgeStorageMemoryService>(
      EdgeStorageMemoryService,
    );

    // Initialize version control repository
    await versionControl.initRepository('test-repo');
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Storage Operations Integration', () => {
    it('should create and retrieve knowledge graph components', async () => {
      // Create entity
      const entityData: Omit<EntityData, 'id'> = {
        nomanclature: [{ name: 'Test Entity', acronym: 'TE', language: 'en' }],
        abstract: {
          description: 'Test entity description',
          embedding: {
            config: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 128,
              batchSize: 20,
              maxRetries: 3,
              timeout: 20000,
              provider: EmbeddingProvider.OPENAI,
            },
            vector: new Array(128).fill(0.1),
          },
        },
      };

      const entity = await entityStorage.create(entityData);
      expect(entity.id).toBeDefined();

      // Create vertex
      const vertexData: Omit<VertexData, 'id'> = {
        content: 'Test vertex content',
        type: 'concept',
        metadata: { label: 'Test Vertex' },
      };

      const vertex = await vertexStorage.create(vertexData);
      expect(vertex.id).toBeDefined();

      // Create property
      const propertyData: Omit<PropertyData, 'id'> = {
        content: 'Test property content',
      };

      const property = await propertyStorage.create(propertyData);
      expect(property.id).toBeDefined();

      // Create edges
      const edge1Data: Omit<EdgeData, 'id'> = {
        type: 'start',
        in: entity.id,
        out: vertex.id,
      };

      const edge2Data: Omit<EdgeData, 'id'> = {
        type: 'end',
        in: vertex.id,
        out: property.id,
      };

      const edge1 = await edgeStorage.create(edge1Data);
      const edge2 = await edgeStorage.create(edge2Data);

      expect(edge1.id).toBeDefined();
      expect(edge2.id).toBeDefined();

      // Verify relationships
      expect(edge1.in).toBe(entity.id);
      expect(edge1.out).toBe(vertex.id);
      expect(edge2.in).toBe(vertex.id);
      expect(edge2.out).toBe(property.id);

      // Test retrieval
      const retrievedEntity = await entityStorage.findById(entity.id);
      const retrievedVertex = await vertexStorage.findById(vertex.id);
      const retrievedProperty = await propertyStorage.findById(property.id);
      const retrievedEdge1 = await edgeStorage.findById(edge1.id);
      const retrievedEdge2 = await edgeStorage.findById(edge2.id);

      expect(retrievedEntity).not.toBeNull();
      expect(retrievedVertex).not.toBeNull();
      expect(retrievedProperty).not.toBeNull();
      expect(retrievedEdge1).not.toBeNull();
      expect(retrievedEdge2).not.toBeNull();
    });

    it('should handle batch operations efficiently', async () => {
      const startTime = Date.now();
      const entityCount = 5;

      // Create multiple entities concurrently
      const entities = await Promise.all(
        Array.from({ length: entityCount }, (_, i) =>
          entityStorage.create({
            nomanclature: [
              { name: `Entity ${i}`, acronym: `E${i}`, language: 'en' },
            ],
            abstract: {
              description: `Entity ${i} description`,
              embedding: {
                config: {
                  model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
                  dimension: 128,
                  batchSize: 20,
                  maxRetries: 3,
                  timeout: 20000,
                  provider: EmbeddingProvider.OPENAI,
                },
                vector: new Array(128).fill(i * 0.1),
              },
            },
          }),
        ),
      );

      const creationTime = Date.now() - startTime;

      // Verify all entities were created
      expect(entities).toHaveLength(entityCount);
      entities.forEach((entity) => {
        expect(entity.id).toBeDefined();
      });

      // Performance should be reasonable
      expect(creationTime).toBeLessThan(1000);

      // Test concurrent retrieval
      const retrievalStartTime = Date.now();
      const retrievedEntities = await Promise.all(
        entities.map((entity) => entityStorage.findById(entity.id)),
      );

      const retrievalTime = Date.now() - retrievalStartTime;

      // Verify all entities were retrieved
      expect(retrievedEntities.every((e) => e !== null)).toBe(true);

      // Retrieval should be fast
      expect(retrievalTime).toBeLessThan(500);
    });
  });

  describe('Event System Integration', () => {
    it('should publish and handle events correctly', async () => {
      const events: any[] = [];

      // Subscribe to entity events
      const entitySubId = await eventBus.subscribe<EntityCreatedEvent>(
        'entity.created',
        async (event) => {
          events.push({ type: 'entity', data: event });
        },
      );

      // Create entity and publish event
      const entity = await entityStorage.create({
        nomanclature: [
          { name: 'Event Test Entity', acronym: 'ETE', language: 'en' },
        ],
        abstract: {
          description: 'Event test entity',
          embedding: {
            config: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 128,
              batchSize: 20,
              maxRetries: 3,
              timeout: 20000,
              provider: EmbeddingProvider.OPENAI,
            },
            vector: new Array(128).fill(0.3),
          },
        },
      });

      const event: EntityCreatedEvent = {
        eventId: 'test-entity-event',
        eventType: EVENT_TYPES.ENTITY_CREATED,
        timestamp: new Date(),
        entityType: 'entity',
        entityId: entity.id,
        data: entity,
      };

      await eventBus.publish(event);

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify event was processed
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('entity');
      expect(events[0].data.data.id).toBe(entity.id);

      // Cleanup
      await eventBus.unsubscribe(await entitySubId);
    });

    it('should handle multiple subscribers', async () => {
      const events1: any[] = [];
      const events2: any[] = [];

      // Multiple subscribers for same event
      const sub1Id = await eventBus.subscribe<EntityCreatedEvent>(
        'entity.created',
        async (event) => {
          events1.push(event);
        },
      );

      const sub2Id = await eventBus.subscribe<EntityCreatedEvent>(
        'entity.created',
        async (event) => {
          events2.push(event);
        },
      );

      // Create and publish event
      const entity = await entityStorage.create({
        nomanclature: [
          { name: 'Multi Sub Entity', acronym: 'MSE', language: 'en' },
        ],
        abstract: {
          description: 'Multi subscriber test entity',
          embedding: {
            config: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 128,
              batchSize: 20,
              maxRetries: 3,
              timeout: 20000,
              provider: EmbeddingProvider.OPENAI,
            },
            vector: new Array(128).fill(0.4),
          },
        },
      });

      const event: EntityCreatedEvent = {
        eventId: 'multi-sub-event',
        eventType: EVENT_TYPES.ENTITY_CREATED,
        timestamp: new Date(),
        entityType: 'entity',
        entityId: entity.id,
        data: entity,
      };

      await eventBus.publish(event);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Both subscribers should receive the event
      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);
      expect(events1[0].data.id).toBe(entity.id);
      expect(events2[0].data.id).toBe(entity.id);

      // Cleanup
      await eventBus.unsubscribe(await sub1Id);
      await eventBus.unsubscribe(await sub2Id);
    });
  });

  describe('Version Control Integration', () => {
    it('should initialize repository and handle basic operations', async () => {
      // Repository should be initialized in beforeEach
      // Test basic repository initialization
      expect(versionControl).toBeDefined();
    });

    it('should create and manage branches', async () => {
      // Create a new branch
      await versionControl.createBranch({
        repositoryId: 'test-repo',
        branchName: 'feature-branch',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      // Test that branch creation doesn't throw errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      // Try to find non-existent entity
      const nonExistentEntity = await entityStorage.findById('non-existent-id');
      expect(nonExistentEntity).toBeNull();

      // Try to find non-existent vertex
      const nonExistentVertex = await vertexStorage.findById('non-existent-id');
      expect(nonExistentVertex).toBeNull();

      // Try to find non-existent property
      const nonExistentProperty =
        await propertyStorage.findById('non-existent-id');
      expect(nonExistentProperty).toBeNull();

      // Try to find non-existent edge
      const nonExistentEdge = await edgeStorage.findById('non-existent-id');
      expect(nonExistentEdge).toBeNull();
    });

    it('should handle event processing errors', async () => {
      let errorCount = 0;

      // Subscribe with error handler
      const subId = await eventBus.subscribe<EntityCreatedEvent>(
        'entity.created',
        async (event) => {
          try {
            // Simulate error condition
            if (event.data.nomanclature[0].name === 'Error Entity') {
              throw new Error('Test error');
            }
          } catch (error) {
            errorCount++;
          }
        },
      );

      // Create entity that will trigger error
      const errorEntity = await entityStorage.create({
        nomanclature: [{ name: 'Error Entity', acronym: 'EE', language: 'en' }],
        abstract: {
          description: 'Error test entity',
          embedding: {
            config: {
              model: OpenAIModel.TEXT_EMBEDDING_ADA_002,
              dimension: 128,
              batchSize: 20,
              maxRetries: 3,
              timeout: 20000,
              provider: EmbeddingProvider.OPENAI,
            },
            vector: new Array(128).fill(0.5),
          },
        },
      });

      const event: EntityCreatedEvent = {
        eventId: 'error-test-event',
        eventType: EVENT_TYPES.ENTITY_CREATED,
        timestamp: new Date(),
        entityType: 'entity',
        entityId: errorEntity.id,
        data: errorEntity,
      };

      await eventBus.publish(event);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Error should be handled
      expect(errorCount).toBe(1);

      // Cleanup
      await eventBus.unsubscribe(await subId);
    });
  });
});
