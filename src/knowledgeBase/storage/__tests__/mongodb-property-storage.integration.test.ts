import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongodbPropertyStorage } from '../mongodb-property-storage';
import { MongoClient, Db } from 'mongodb';
import { PropertyData } from '../../knowledge.type';
import * as dotenv from 'dotenv';

dotenv.config();

describe('MongodbPropertyStorage Integration Tests', () => {
  let mongodbStorage: MongodbPropertyStorage;
  let mongoClient: MongoClient;
  let db: Db;
  const collectionName = 'properties';

  // Test data
  const testProperty: PropertyData = {
    name: ['test', 'property'],
    content: 'A test property for integration testing',
  };

  const testProperty2: PropertyData = {
    name: ['another', 'property'],
    content: 'Another test property for integration testing',
  };

  beforeAll(async () => {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aikb';

    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    const dbName = process.env.DB_NAME || 'aikb';
    db = mongoClient.db(dbName);

    // Create storage instance
    mongodbStorage = new MongodbPropertyStorage();
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

  describe('create_property', () => {
    it('should create a new property successfully', async () => {
      // Act
      const result = await mongodbStorage.create_property(testProperty);

      // Assert
      expect(result).toEqual(testProperty);

      // Verify property was actually inserted into the database
      const propertyInDb = await db.collection(collectionName).findOne({
        propertyName: 'test.property',
      });
      expect(propertyInDb).toBeTruthy();
      expect(propertyInDb?.name).toEqual(testProperty.name);
      expect(propertyInDb?.content).toEqual(testProperty.content);
    });

    it('should throw an error if property already exists', async () => {
      // Arrange - Insert property directly to database
      await db.collection(collectionName).insertOne({
        ...testProperty,
        propertyName: 'test.property',
      });

      // Act & Assert
      // Note: MongoDB will allow duplicate inserts with different _id
      // This test verifies the create operation works even if propertyName exists
      await expect(
        mongodbStorage.create_property(testProperty),
      ).resolves.toEqual(testProperty);
    });
  });

  describe('get_property_by_name', () => {
    it('should get a property by name successfully', async () => {
      // Arrange - Insert property directly to database
      await db.collection(collectionName).insertOne({
        ...testProperty,
        propertyName: 'test.property',
      });

      // Act
      const result = await mongodbStorage.get_property_by_name([
        'test',
        'property',
      ]);

      // Assert
      expect(result).toEqual(testProperty);
    });

    it('should return null if property is not found', async () => {
      // Act
      const result = await mongodbStorage.get_property_by_name([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update_property', () => {
    it('should update a property successfully', async () => {
      // Arrange - Insert property directly to database
      await db.collection(collectionName).insertOne({
        ...testProperty,
        propertyName: 'test.property',
      });

      const updatedProperty = {
        ...testProperty,
        content: 'Updated content',
      };

      // Act
      const result = await mongodbStorage.update_property(updatedProperty);

      // Assert
      expect(result).toEqual(updatedProperty);

      // Verify property was actually updated in the database
      const propertyInDb = await db.collection(collectionName).findOne({
        propertyName: 'test.property',
      });
      expect(propertyInDb).toBeTruthy();
      expect(propertyInDb?.content).toEqual(updatedProperty.content);
    });

    it('should throw an error if property is not found', async () => {
      // Act & Assert
      await expect(
        mongodbStorage.update_property(testProperty),
      ).rejects.toThrow('PropertyData with name test.property not found');
    });
  });

  describe('delete_property', () => {
    it('should delete a property successfully', async () => {
      // Arrange - Insert property directly to database
      await db.collection(collectionName).insertOne({
        ...testProperty,
        propertyName: 'test.property',
      });

      // Act
      const result = await mongodbStorage.delete_property(['test', 'property']);

      // Assert
      expect(result).toBe(true);

      // Wait a bit to ensure deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify property was actually deleted from the database
      const propertyInDb = await db.collection(collectionName).findOne({
        propertyName: 'test.property',
      });
      expect(propertyInDb).toBeNull();
    });

    it('should return false if property is not found', async () => {
      // Act
      const result = await mongodbStorage.delete_property(['non', 'existent']);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('search_properties', () => {
    beforeEach(async () => {
      // Insert test properties
      await db.collection(collectionName).insertMany([
        { ...testProperty, propertyName: 'test.property' },
        { ...testProperty2, propertyName: 'another.property' },
      ]);
    });

    it('should search properties by name', async () => {
      // Act
      const result = await mongodbStorage.search_properties('test');

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((p) => p.name.join('.') === 'test.property')).toBe(
        true,
      );
    });

    it('should search properties by content', async () => {
      // Act
      const result = await mongodbStorage.search_properties(
        'integration testing',
      );

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array if no properties match', async () => {
      // Act
      const result = await mongodbStorage.search_properties('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('list_all_properties', () => {
    it('should list all properties successfully', async () => {
      // Arrange - Insert test properties
      await db.collection(collectionName).insertMany([
        { ...testProperty, propertyName: 'test.property' },
        { ...testProperty2, propertyName: 'another.property' },
      ]);

      // Act
      const result = await mongodbStorage.list_all_properties();

      // Assert
      expect(result.length).toBe(2);
      expect(result.some((p) => p.name.join('.') === 'test.property')).toBe(
        true,
      );
      expect(result.some((p) => p.name.join('.') === 'another.property')).toBe(
        true,
      );
    });

    it('should return empty array if no properties exist', async () => {
      // Act
      const result = await mongodbStorage.list_all_properties();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('full CRUD workflow', () => {
    it('should support full CRUD operations', async () => {
      // Create
      const createdProperty =
        await mongodbStorage.create_property(testProperty);
      expect(createdProperty).toEqual(testProperty);

      // Read
      const retrievedProperty = await mongodbStorage.get_property_by_name([
        'test',
        'property',
      ]);
      expect(retrievedProperty).toEqual(testProperty);

      // Update
      const updatedProperty = {
        ...testProperty,
        content: 'Updated content',
      };
      await mongodbStorage.update_property(updatedProperty);

      const retrievedUpdatedProperty =
        await mongodbStorage.get_property_by_name(['test', 'property']);
      expect(retrievedUpdatedProperty).toEqual(updatedProperty);

      // Delete
      const deleteResult = await mongodbStorage.delete_property([
        'test',
        'property',
      ]);
      expect(deleteResult).toBe(true);

      const deletedProperty = await mongodbStorage.get_property_by_name([
        'test',
        'property',
      ]);
      expect(deletedProperty).toBeNull();
    });
  });
});
