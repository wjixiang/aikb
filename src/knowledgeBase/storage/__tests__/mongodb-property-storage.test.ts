import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MongodbPropertyStorage } from '../mongodb-property-storage';
import { connectToDatabase } from '../../database/mongodb';
import { ObjectId } from 'mongodb';
import { PropertyData } from '../../knowledge.type';

// Mock the database connection
vi.mock('../../database/mongodb');
const mockConnectToDatabase = vi.mocked(connectToDatabase);

// Mock the logger
vi.mock('../../logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('MongodbPropertyStorage', () => {
  let mongodbStorage: MongodbPropertyStorage;
  let mockCollection: any;
  let mockDb: any;

  const mockProperty: PropertyData = {
    name: ['test', 'property'],
    content: 'A test property for mocking',
  };

  const mockProperty2: PropertyData = {
    name: ['another', 'property'],
    content: 'Another test property for mocking',
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
    mongodbStorage = new MongodbPropertyStorage();
  });

  describe('create_property', () => {
    it('should create a new property successfully', async () => {
      // Arrange
      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({
        insertedId: mockInsertedId,
      });

      // Act
      const result = await mongodbStorage.create_property(mockProperty);

      // Assert
      expect(result).toEqual(mockProperty);
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        ...mockProperty,
        propertyName: 'test.property',
      });
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.insertOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.create_property(mockProperty),
      ).rejects.toThrow(error);
    });
  });

  describe('get_property_by_ids', () => {
    it('should get a property by id list successfully', async () => {
      // Arrange
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      
      const propertiesWithId = [
        {
          ...mockProperty,
          _id: id1,
          propertyName: 'test.property',
        },
        {
          ...mockProperty2,
          _id: id2,
          propertyName: 'another.property',
        },
      ];

      const mockFind = {
        toArray: vi.fn().mockResolvedValue(propertiesWithId),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.get_property_by_ids([
        id1.toString(),
        id2.toString(),
      ]);

      // Assert
      // The result should not include the _id and propertyName fields as they are removed before returning
      expect(result).toEqual([mockProperty, mockProperty2]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: {
          $in: [id1, id2],
        },
      });
    });

    it('should return empty array if no properties match the ids', async () => {
      // Arrange
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      
      const mockFind = {
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.get_property_by_ids([
        id1.toString(),
        id2.toString(),
      ]);

      // Assert
      expect(result).toEqual([]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: {
          $in: [id1, id2],
        },
      });
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const id1 = new ObjectId();
      const id2 = new ObjectId();
      const error = new Error('Database error');
      
      const mockFind = {
        toArray: vi.fn().mockRejectedValue(error),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act & Assert
      await expect(
        mongodbStorage.get_property_by_ids([id1.toString(), id2.toString()]),
      ).rejects.toThrow(error);
    });
  })

  describe('get_property_by_name', () => {
    it('should get a property by name successfully', async () => {
      // Arrange
      const propertyWithId = {
        ...mockProperty,
        propertyName: 'test.property',
      };
      mockCollection.findOne.mockResolvedValue(propertyWithId);

      // Act
      const result = await mongodbStorage.get_property_by_name([
        'test',
        'property',
      ]);

      // Assert
      expect(result).toEqual(mockProperty);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        propertyName: 'test.property',
      });
    });

    it('should return null if property is not found', async () => {
      // Arrange
      mockCollection.findOne.mockResolvedValue(null);

      // Act
      const result = await mongodbStorage.get_property_by_name([
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
        mongodbStorage.get_property_by_name(['test', 'property']),
      ).rejects.toThrow(error);
    });
  });

  describe('update_property', () => {
    it('should update a property successfully', async () => {
      // Arrange
      mockCollection.replaceOne.mockResolvedValue({
        modifiedCount: 1,
      });

      // Act
      const result = await mongodbStorage.update_property(mockProperty);

      // Assert
      expect(result).toEqual(mockProperty);
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { propertyName: 'test.property' },
        { ...mockProperty, propertyName: 'test.property' },
      );
    });

    it('should throw an error if property is not found', async () => {
      // Arrange
      mockCollection.replaceOne.mockResolvedValue({
        modifiedCount: 0,
      });

      // Act & Assert
      await expect(
        mongodbStorage.update_property(mockProperty),
      ).rejects.toThrow('PropertyData with name test.property not found');
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.replaceOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.update_property(mockProperty),
      ).rejects.toThrow(error);
    });
  });

  describe('delete_property', () => {
    it('should delete a property successfully', async () => {
      // Arrange
      mockCollection.deleteOne.mockResolvedValue({
        deletedCount: 1,
      });

      // Act
      const result = await mongodbStorage.delete_property(['test', 'property']);

      // Assert
      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        propertyName: 'test.property',
      });
    });

    it('should return false if property is not found', async () => {
      // Arrange
      mockCollection.deleteOne.mockResolvedValue({
        deletedCount: 0,
      });

      // Act
      const result = await mongodbStorage.delete_property(['non', 'existent']);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.deleteOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.delete_property(['test', 'property']),
      ).rejects.toThrow(error);
    });
  });

  describe('search_properties', () => {
    it('should search properties successfully', async () => {
      // Arrange
      const propertiesWithId = [
        {
          ...mockProperty,
          propertyName: 'test.property',
        },
        {
          ...mockProperty2,
          propertyName: 'another.property',
        },
      ];

      const mockFind = {
        toArray: vi.fn().mockResolvedValue(propertiesWithId),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.search_properties('test');

      // Assert
      // The result should not include the propertyName field as it's removed before returning
      expect(result).toEqual([mockProperty, mockProperty2]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $or: [
          { propertyName: { $regex: /test/i } },
          { content: { $regex: /test/i } },
        ],
      });
    });

    it('should return empty array if no properties match', async () => {
      // Arrange
      const mockFind = {
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.search_properties('nonexistent');

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
      await expect(mongodbStorage.search_properties('test')).rejects.toThrow(
        error,
      );
    });
  });

  describe('list_all_properties', () => {
    it('should list all properties successfully', async () => {
      // Arrange
      const propertiesWithId = [
        {
          ...mockProperty,
          propertyName: 'test.property',
        },
        {
          ...mockProperty2,
          propertyName: 'another.property',
        },
      ];

      const mockFind = {
        toArray: vi.fn().mockResolvedValue(propertiesWithId),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.list_all_properties();

      // Assert
      expect(result).toEqual([mockProperty, mockProperty2]);
      expect(mockCollection.find).toHaveBeenCalledWith({});
    });

    it('should return empty array if no properties exist', async () => {
      // Arrange
      const mockFind = {
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockCollection.find.mockReturnValue(mockFind);

      // Act
      const result = await mongodbStorage.list_all_properties();

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
      await expect(mongodbStorage.list_all_properties()).rejects.toThrow(error);
    });
  });
});
