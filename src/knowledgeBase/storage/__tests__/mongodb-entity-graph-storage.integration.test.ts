import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoEntityGraphStorage } from '../mongodb-entity-graph-storage';
import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

describe('MongoEntityGraphStorage Integration Tests', () => {
  let mongodbStorage: MongoEntityGraphStorage;
  let mongoClient: MongoClient;
  let db: Db;
  const collectionName = 'relationships';

  // Test data
  const testRelations = [
    {
      sourceId: 'entity1',
      targetId: 'entity2',
      relationType: 'related_to',
      properties: { strength: 0.8 },
    },
    {
      sourceId: 'entity2',
      targetId: 'entity3',
      relationType: 'contains',
      properties: { count: 5 },
    },
    {
      sourceId: 'entity3',
      targetId: 'entity4',
      relationType: 'related_to',
      properties: { strength: 0.6 },
    },
    {
      sourceId: 'entity1',
      targetId: 'entity4',
      relationType: 'references',
      properties: { weight: 0.5 },
    },
    {
      sourceId: 'entity4',
      targetId: 'entity5',
      relationType: 'contains',
      properties: { count: 3 },
    },
  ];

  beforeAll(async () => {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aikb';

    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    const dbName = process.env.DB_NAME || 'aikb';
    db = mongoClient.db(dbName);

    // Create storage instance
    mongodbStorage = new MongoEntityGraphStorage();
  });

  afterAll(async () => {
    // Clean up and close connection
    if (db) {
      try {
        await db.collection(collectionName).deleteMany({});
      } catch (error) {
        console.error('Error cleaning up database:', error);
      }
    }
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(async () => {
    // Clean up collection before each test
    try {
      await db.collection(collectionName).deleteMany({});
      // Wait a bit to ensure the deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    } catch (error) {
      console.error('Error cleaning up collection before test:', error);
    }
  });

  describe('create_relation', () => {
    it('should create a relation successfully', async () => {
      // Arrange
      const relation = testRelations[0];

      // Act
      await mongodbStorage.create_relation(
        relation.sourceId,
        relation.targetId,
        relation.relationType,
        relation.properties
      );

      // Assert
      const relationInDb = await db.collection(collectionName).findOne({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.relationType,
      });
      expect(relationInDb).toBeTruthy();
      expect(relationInDb?.sourceId).toEqual(relation.sourceId);
      expect(relationInDb?.targetId).toEqual(relation.targetId);
      expect(relationInDb?.relationType).toEqual(relation.relationType);
      expect(relationInDb?.properties).toEqual(relation.properties);
      expect(relationInDb?.createdAt).toBeInstanceOf(Date);
      expect(relationInDb?.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a relation without properties', async () => {
      // Arrange
      const relation = {
        sourceId: 'entity1',
        targetId: 'entity2',
        relationType: 'related_to',
      };

      // Act
      await mongodbStorage.create_relation(
        relation.sourceId,
        relation.targetId,
        relation.relationType
      );

      // Assert
      const relationInDb = await db.collection(collectionName).findOne({
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.relationType,
      });
      expect(relationInDb).toBeTruthy();
      expect(relationInDb?.properties).toEqual({});
    });
  });

  describe('get_entity_relations', () => {
    beforeEach(async () => {
      // Insert test relations
      await db.collection(collectionName).insertMany(testRelations);
    });

    it('should get all relations for an entity', async () => {
      // Act
      const result = await mongodbStorage.get_entity_relations('entity2');

      // Assert
      expect(result.length).toBe(2);
      expect(result.some((r) => r.sourceId === 'entity1' && r.targetId === 'entity2')).toBe(true);
      expect(result.some((r) => r.sourceId === 'entity2' && r.targetId === 'entity3')).toBe(true);
    });

    it('should get relations filtered by type', async () => {
      // Act
      const result = await mongodbStorage.get_entity_relations('entity2', 'contains');

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].sourceId).toBe('entity2');
      expect(result[0].targetId).toBe('entity3');
      expect(result[0].relationType).toBe('contains');
    });

    it('should return empty array when no relations found', async () => {
      // Act
      const result = await mongodbStorage.get_entity_relations('entity99');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('update_relation', () => {
    it('should update a relation successfully', async () => {
      // Arrange - Insert relation directly to database
      await db.collection(collectionName).insertOne(testRelations[0]);

      // Act
      await mongodbStorage.update_relation(
        testRelations[0].sourceId,
        testRelations[0].targetId,
        testRelations[0].relationType,
        { strength: 0.9 }
      );

      // Assert
      const relationInDb = await db.collection(collectionName).findOne({
        sourceId: testRelations[0].sourceId,
        targetId: testRelations[0].targetId,
        relationType: testRelations[0].relationType,
      });
      expect(relationInDb).toBeTruthy();
      expect(relationInDb?.properties).toEqual({ strength: 0.9 });
      expect(relationInDb?.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw an error if relation is not found', async () => {
      // Act & Assert
      await expect(
        mongodbStorage.update_relation(
          'nonexistent',
          'entity2',
          'related_to',
          { strength: 0.9 }
        )
      ).rejects.toThrow('Relation from nonexistent to entity2 with type related_to not found');
    });
  });

  describe('delete_relation', () => {
    it('should delete a relation successfully', async () => {
      // Arrange - Insert relation directly to database
      await db.collection(collectionName).insertOne(testRelations[0]);

      // Act
      const result = await mongodbStorage.delete_relation(
        testRelations[0].sourceId,
        testRelations[0].targetId,
        testRelations[0].relationType
      );

      // Assert
      expect(result).toBe(true);

      // Wait a bit to ensure deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify relation was actually deleted from the database
      const relationInDb = await db.collection(collectionName).findOne({
        sourceId: testRelations[0].sourceId,
        targetId: testRelations[0].targetId,
        relationType: testRelations[0].relationType,
      });
      expect(relationInDb).toBeNull();
    });

    it('should return false if relation is not found', async () => {
      // Act
      const result = await mongodbStorage.delete_relation(
        'nonexistent',
        'entity2',
        'related_to'
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('find_paths', () => {
    beforeEach(async () => {
      // Insert test relations
      await db.collection(collectionName).insertMany(testRelations);
    });

    it('should find direct path between entities', async () => {
      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity2', 3);

      // Assert
      expect(result).toEqual([
        [
          {
            entityId: 'entity2',
            relationType: 'related_to',
          }
        ]
      ]);
    });

    it('should find indirect path between entities', async () => {
      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity3', 3);

      // Assert
      expect(result).toEqual([
        [
          {
            entityId: 'entity2',
            relationType: 'related_to',
          },
          {
            entityId: 'entity3',
            relationType: 'contains',
          }
        ]
      ]);
    });

    it('should find multiple paths between entities', async () => {
      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity4', 3);

      // Assert
      expect(result.length).toBe(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            {
              entityId: 'entity2',
              relationType: 'related_to',
            },
            {
              entityId: 'entity3',
              relationType: 'contains',
            },
            {
              entityId: 'entity4',
              relationType: 'related_to',
            }
          ]),
          expect.arrayContaining([
            {
              entityId: 'entity4',
              relationType: 'references',
            }
          ])
        ])
      );
    });

    it('should respect maxDepth parameter', async () => {
      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity5', 2);

      // Assert
      expect(result).toEqual([
        [
          {
            entityId: 'entity4',
            relationType: 'references',
          }
        ]
      ]);
    });

    it('should return empty array when no path exists', async () => {
      // Act
      const result = await mongodbStorage.find_paths('entity5', 'entity1', 3);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle complex graph structures', async () => {
      // Arrange - Create a more complex graph structure
      const complexRelations = [
        ...testRelations,
        {
          sourceId: 'entity5',
          targetId: 'entity6',
          relationType: 'related_to',
          properties: { strength: 0.7 },
        },
        {
          sourceId: 'entity6',
          targetId: 'entity7',
          relationType: 'contains',
          properties: { count: 2 },
        },
        {
          sourceId: 'entity7',
          targetId: 'entity8',
          relationType: 'references',
          properties: { weight: 0.4 },
        },
        {
          sourceId: 'entity1',
          targetId: 'entity6',
          relationType: 'references',
          properties: { weight: 0.3 },
        },
      ];
      await db.collection(collectionName).insertMany(complexRelations);

      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity8', 5);

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            {
              entityId: 'entity6',
              relationType: 'references',
            },
            {
              entityId: 'entity7',
              relationType: 'contains',
            },
            {
              entityId: 'entity8',
              relationType: 'references',
            }
          ])
        ])
      );
    });

    it('should handle cycles in the graph', async () => {
      // Arrange - Create a graph with cycles
      const cyclicRelations = [
        ...testRelations,
        {
          sourceId: 'entity5',
          targetId: 'entity1',
          relationType: 'related_to',
          properties: { strength: 0.5 },
        },
      ];
      await db.collection(collectionName).insertMany(cyclicRelations);

      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity5', 10);

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([
            {
              entityId: 'entity2',
              relationType: 'related_to',
            },
            {
              entityId: 'entity3',
              relationType: 'contains',
            },
            {
              entityId: 'entity4',
              relationType: 'related_to',
            },
            {
              entityId: 'entity5',
              relationType: 'contains',
            }
          ])
        ])
      );
    });
  });

  describe('full CRUD workflow', () => {
    it('should support full CRUD operations for relations', async () => {
      // Create
      await mongodbStorage.create_relation(
        'entityA',
        'entityB',
        'related_to',
        { strength: 0.8 }
      );

      // Read
      const relations = await mongodbStorage.get_entity_relations('entityA');
      expect(relations.length).toBe(1);
      expect(relations[0].sourceId).toBe('entityA');
      expect(relations[0].targetId).toBe('entityB');
      expect(relations[0].relationType).toBe('related_to');
      expect(relations[0].properties).toEqual({ strength: 0.8 });

      // Update
      await mongodbStorage.update_relation(
        'entityA',
        'entityB',
        'related_to',
        { strength: 0.9 }
      );

      const updatedRelations = await mongodbStorage.get_entity_relations('entityA');
      expect(updatedRelations[0].properties).toEqual({ strength: 0.9 });

      // Delete
      const deleteResult = await mongodbStorage.delete_relation(
        'entityA',
        'entityB',
        'related_to'
      );
      expect(deleteResult).toBe(true);

      const deletedRelations = await mongodbStorage.get_entity_relations('entityA');
      expect(deletedRelations).toEqual([]);
    });
  });
});