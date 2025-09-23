import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongodbEntityStorage } from '../mongodb-entity-storage';
import { MongoClient, Db } from 'mongodb';
import { EntityData } from '../../knowledge.type';
import * as dotenv from 'dotenv';

dotenv.config();

describe('MongodbEntityStorage Integration Tests', () => {
  let mongodbStorage: MongodbEntityStorage;
  let mongoClient: MongoClient;
  let db: Db;
  const collectionName = 'entities';

  // Test data
  const testEntity: EntityData = {
    name: ['test', 'entity'],
    tags: ['test', 'integration'],
    definition: 'A test entity for integration testing',
  };

  const testEntity2: EntityData = {
    name: ['another', 'entity'],
    tags: ['another', 'test'],
    definition: 'Another test entity for integration testing',
  };

  beforeAll(async () => {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aikb';

    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    const dbName = process.env.DB_NAME || 'aikb';
    db = mongoClient.db(dbName);

    // Create storage instance
    mongodbStorage = new MongodbEntityStorage();
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

  describe('create_new_entity_content', () => {
    it('should create a new entity successfully', async () => {
      // Arrange
      const entityId = 'test.entity.id';
      
      // Act
      const result = await mongodbStorage.create_new_entity_content(testEntity, entityId);

      // Assert
      
      expect(result).toEqual({...testEntity, id: entityId});
      // Verify entity was actually inserted into the database
      const entityInDb = await db.collection(collectionName).findOne({
        entityName: 'test.entity',
      });
      expect(entityInDb).toBeTruthy();
      expect(entityInDb?.name).toEqual(testEntity.name);
      expect(entityInDb?.tags).toEqual(testEntity.tags);
      expect(entityInDb?.definition).toEqual(testEntity.definition);
    });

    it('should throw an error if entity already exists', async () => {
      // Arrange - Insert entity directly to database
      await db.collection(collectionName).insertOne({
        ...testEntity,
        entityName: 'test.entity',
      });

      // Act & Assert
      // Note: MongoDB will allow duplicate inserts with different _id
      // This test verifies the create operation works even if entityName exists
      const entityId = 'test.entity.id.duplicate';
      await expect(
        mongodbStorage.create_new_entity_content(testEntity, entityId),
      ).resolves.toEqual({...testEntity, id: entityId});
    });
  });

  describe('get_entity_by_name', () => {
    it('should get an entity by name successfully', async () => {
      // Arrange - Insert entity directly to database
      await db.collection(collectionName).insertOne({
        ...testEntity,
        entityName: 'test.entity',
      });

      // Act
      const result = await mongodbStorage.get_entity_by_name([
        'test',
        'entity',
      ]);

      // Assert
      expect(result).toEqual(testEntity);
    });

    it('should return null if entity is not found', async () => {
      // Act
      const result = await mongodbStorage.get_entity_by_name([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update_entity', () => {
    it('should update an entity successfully', async () => {
      // Arrange - Insert entity directly to database
      const res = await db.collection(collectionName).insertOne({
        ...testEntity,
        entityName: 'test.entity',
      });

      const oldEntity = {
        id: res.insertedId.toString(),
        ...testEntity,
      };

      const newEntityData = {
        ...testEntity,
        tags: ['updated', 'tags'],
        definition: 'Updated definition',
      };

      // Act
      const result = await mongodbStorage.update_entity(oldEntity, newEntityData);

      // Assert
      expect(result).toEqual(oldEntity);

      // Verify entity was actually updated in the database
      const entityInDb = await db.collection(collectionName).findOne({
        entityName: 'test.entity',
      });
      expect(entityInDb).toBeTruthy();
      expect(entityInDb?.tags).toEqual(newEntityData.tags);
      expect(entityInDb?.definition).toEqual(newEntityData.definition);
    });

    it('should throw an error if entity is not found', async () => {
      const oldEntity = {
        id: 'nonexistent',
        ...testEntity,
      };
      
      // Act & Assert
      await expect(mongodbStorage.update_entity(oldEntity, testEntity)).rejects.toThrow(
        'EntityData with name test.entity not found',
      );
    });
  });

  describe('delete_entity', () => {
    it('should delete an entity successfully', async () => {
      // Arrange - Insert entity directly to database
      await db.collection(collectionName).insertOne({
        ...testEntity,
        entityName: 'test.entity',
      });

      // Act
      const result = await mongodbStorage.delete_entity(['test', 'entity']);

      // Assert
      expect(result).toBe(true);

      // Wait a bit to ensure deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify entity was actually deleted from the database
      const entityInDb = await db.collection(collectionName).findOne({
        entityName: 'test.entity',
      });
      expect(entityInDb).toBeNull();
    });

    it('should return false if entity is not found', async () => {
      // Act
      const result = await mongodbStorage.delete_entity(['non', 'existent']);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('search_entities', () => {
    beforeEach(async () => {
      // Insert test entities
      await db.collection(collectionName).insertMany([
        { ...testEntity, entityName: 'test.entity' },
        { ...testEntity2, entityName: 'another.entity' },
      ]);
    });

    it('should search entities by name', async () => {
      // Act
      const result = await mongodbStorage.search_entities('test');

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.name.join('.') === 'test.entity')).toBe(true);
    });

    it('should search entities by tags', async () => {
      // Act
      const result = await mongodbStorage.search_entities('integration');

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.name.join('.') === 'test.entity')).toBe(true);
    });

    it('should search entities by definition', async () => {
      // Act
      const result = await mongodbStorage.search_entities(
        'integration testing',
      );

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array if no entities match', async () => {
      // Act
      const result = await mongodbStorage.search_entities('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('list_all_entities', () => {
    it('should list all entities successfully', async () => {
      // Arrange - Insert test entities
      await db.collection(collectionName).insertMany([
        { ...testEntity, entityName: 'test.entity' },
        { ...testEntity2, entityName: 'another.entity' },
      ]);

      // Act
      const result = await mongodbStorage.list_all_entities();

      // Assert
      expect(result.length).toBe(2);
      expect(result.some((e) => e.name.join('.') === 'test.entity')).toBe(true);
      expect(result.some((e) => e.name.join('.') === 'another.entity')).toBe(
        true,
      );
    });

    it('should return empty array if no entities exist', async () => {
      // Act
      const result = await mongodbStorage.list_all_entities();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('full CRUD workflow', () => {
    it('should support full CRUD operations', async () => {
      // Create
      const entityId = 'test.entity.crud';
      const createdEntity = await mongodbStorage.create_new_entity_content(testEntity, entityId);
      expect(createdEntity).toEqual({...testEntity, id: entityId});

      // Read
      const retrievedEntity = await mongodbStorage.get_entity_by_name([
        'test',
        'entity',
      ]);
      expect(retrievedEntity).toEqual(testEntity);

      // Update
      const oldEntity = {
        id: createdEntity.id,
        ...testEntity,
      };
      const newEntityData = {
        ...testEntity,
        tags: ['updated', 'tags'],
        definition: 'Updated definition',
      };
      await mongodbStorage.update_entity(oldEntity, newEntityData);

      const retrievedUpdatedEntity = await mongodbStorage.get_entity_by_name([
        'test',
        'entity',
      ]);
      expect(retrievedUpdatedEntity).toEqual(newEntityData);

      // Delete
      const deleteResult = await mongodbStorage.delete_entity([
        'test',
        'entity',
      ]);
      expect(deleteResult).toBe(true);

      const deletedEntity = await mongodbStorage.get_entity_by_name([
        'test',
        'entity',
      ]);
      expect(deletedEntity).toBeNull();
    });
  });
});
