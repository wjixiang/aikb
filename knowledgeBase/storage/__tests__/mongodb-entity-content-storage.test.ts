import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MongodbEntityContentStorage } from '../mongodb-entity-content-storage';
import { connectToDatabase } from '../../../lib/utils/mongodb';
import { ObjectId } from 'mongodb';
import { EntityData } from '../../knowledge.type';
import Entity from 'knowledgeBase/Entity';
import { AbstractEntityStorage } from '../storage';

// Mock the database connection
vi.mock('../../../lib/mongodb');
const mockConnectToDatabase = vi.mocked(connectToDatabase);

// Mock the logger
vi.mock('../../../lib/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('MongodbEntityContentStorage', () => {
  let mongodbStorage: MongodbEntityContentStorage;
  let mockCollection: any;
  let mockDb: any;

  const mockEntity: EntityData = {
    name: ['test', 'entity'],
    tags: ['test', 'mock'],
    definition: 'A test entity for mocking',
  };

  const mockEntity2: EntityData = {
    name: ['another', 'entity'],
    tags: ['another', 'mock'],
    definition: 'Another test entity for mocking',
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock collection
    mockCollection = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
      replaceOne: vi.fn(),
      deleteOne: vi.fn(),
      find: vi.fn(),
    };

    // Create mock db
    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection),
    };

    // Setup mock database connection
    mockConnectToDatabase.mockResolvedValue({
      client: {} as any,
      db: mockDb,
    });

    // Create storage instance
    mongodbStorage = new MongodbEntityContentStorage();
  });

  describe('create_new_entity', () => {
    it('should create a new entity successfully', async () => {
      // Arrange
      const mockId = AbstractEntityStorage.generate_entity_id();
      mockCollection.insertOne.mockResolvedValue({
        id: mockId,
      });

      // Act
      const result = await mongodbStorage.create_new_entity_content(
        mockEntity,
        mockId,
      );

      // Assert
      expect(result).toEqual({ ...mockEntity, id: result.id });
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        ...mockEntity,
        id: mockId,
        entityName: 'test.entity',
      });
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.insertOne.mockRejectedValue(error);
      const mockId = AbstractEntityStorage.generate_entity_id();
      // Act & Assert
      await expect(
        mongodbStorage.create_new_entity_content(mockEntity, mockId),
      ).rejects.toThrow(error);
    });
  });

  describe('get_entity_by_name', () => {
    it('should get an entity by name successfully', async () => {
      // Arrange
      const entityWithId = {
        ...mockEntity,
        entityName: 'test.entity',
      };
      mockCollection.findOne.mockResolvedValue(entityWithId);

      // Act
      const result = await mongodbStorage.get_entity_by_name([
        'test',
        'entity',
      ]);

      // Assert
      expect(result).toEqual(mockEntity);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        entityName: 'test.entity',
      });
    });

    it('should return null if entity is not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValue(null);

      // Act
      const result = await mongodbStorage.get_entity_by_name([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.findOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.get_entity_by_name(['test', 'entity']),
      ).rejects.toThrow(error);
    });
  });

  describe('update_entity', () => {
    it('should update an entity successfully', async () => {
      // Arrange
      const mockEntityWithId = {
        ...mockEntity,
        id: 'test.entity',
      };
      mockCollection.replaceOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const result = await mongodbStorage.update_entity(
        mockEntityWithId,
        mockEntity,
      );

      // Assert
      expect(result).toEqual(mockEntityWithId);
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { entityName: 'test.entity' },
        { ...mockEntity, id: 'test.entity', entityName: 'test.entity' },
      );
    });

    it('should throw an error if entity is not found', async () => {
      // Arrange
      const mockEntityWithId = {
        ...mockEntity,
        id: 'test.entity',
      };
      mockCollection.replaceOne.mockResolvedValue({
        modifiedCount: 0,
      });

      // Act & Assert
      await expect(
        mongodbStorage.update_entity(mockEntityWithId, mockEntity),
      ).rejects.toThrow('EntityData with name test.entity not found');
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const mockEntityWithId = {
        ...mockEntity,
        id: 'test.entity',
      };
      const error = new Error('Database error');
      mockCollection.replaceOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.update_entity(mockEntityWithId, mockEntity),
      ).rejects.toThrow(error);
    });
  });

  describe('delete_entity', () => {
    it('should delete an entity successfully', async () => {
      // Arrange
      mockCollection.deleteOne.mockResolvedValue({
        deletedCount: 1,
      });

      // Act
      const result = await mongodbStorage.delete_entity(['test', 'entity']);

      // Assert
      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        entityName: 'test.entity',
      });
    });

    it('should return false if entity is not found', async () => {
      // Arrange
      mockCollection.deleteOne.mockResolvedValue({
        deletedCount: 0,
      });

      // Act
      const result = await mongodbStorage.delete_entity(['non', 'existent']);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.deleteOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.delete_entity(['test', 'entity']),
      ).rejects.toThrow(error);
    });
  });

  describe('search_entities', () => {
    it('should search entities successfully', async () => {
      // Arrange
      const entitiesWithId = [
        {
          ...mockEntity,
          entityName: 'test.entity',
        },
        {
          ...mockEntity2,
          entityName: 'another.entity',
        },
      ];

      const mockFind = {
        toArray: vi.fn().mockResolvedValue(entitiesWithId),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.search_entities('test');

      // Assert
      // The result should not include the entityName field as it's removed before returning
      expect(result).toEqual([mockEntity, mockEntity2]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $or: [
          { entityName: { $regex: /test/i } },
          { tags: { $regex: /test/i } },
          { definition: { $regex: /test/i } },
        ],
      });
    });

    it('should return empty array if no entities match', async () => {
      // Arrange
      const mockFind = {
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.search_entities('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      const mockFind = {
        toArray: vi.fn().mockRejectedValue(error),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act & Assert
      await expect(mongodbStorage.search_entities('test')).rejects.toThrow(
        error,
      );
    });
  });

  describe('list_all_entities', () => {
    it('should list all entities successfully', async () => {
      // Arrange
      const entitiesWithId = [
        {
          ...mockEntity,
          entityName: 'test.entity',
        },
        {
          ...mockEntity2,
          entityName: 'another.entity',
        },
      ];

      const mockFind = {
        toArray: vi.fn().mockResolvedValue(entitiesWithId),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.list_all_entities();

      // Assert
      expect(result).toEqual([mockEntity, mockEntity2]);
      expect(mockCollection.find).toHaveBeenCalledWith({});
    });

    it('should return empty array if no entities exist', async () => {
      // Arrange
      const mockFind = {
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.list_all_entities();

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      const mockFind = {
        toArray: vi.fn().mockRejectedValue(error),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act & Assert
      await expect(mongodbStorage.list_all_entities()).rejects.toThrow(error);
    });
  });
});
