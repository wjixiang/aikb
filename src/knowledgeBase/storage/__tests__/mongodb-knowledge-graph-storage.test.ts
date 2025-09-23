import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MongoKnowledgeGraphStorage } from '../mongodb-knowledge-graph-storage';
import { connectToDatabase } from '../../database/mongodb';
import { ObjectId } from 'mongodb';

// Mock the database connection
vi.mock('../../database/mongodb');
const mockConnectToDatabase = vi.mocked(connectToDatabase);

// Mock the logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../../lib/logger', () => ({
  default: vi.fn(() => mockLogger),
}));

describe('MongoKnowledgeGraphStorage', () => {
  let mongodbStorage: MongoKnowledgeGraphStorage;
  let mockCollection: any;
  let mockDb: any;

  const testLink = {
    sourceId: 'knowledge1',
    targetId: 'knowledge2',
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock collection
    mockCollection = {
      insertOne: vi.fn(),
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
    mongodbStorage = new MongoKnowledgeGraphStorage();
  });

  describe('create_new_link', () => {
    it('should create a knowledge link successfully', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      // Act
      await mongodbStorage.create_new_link(testLink.sourceId, testLink.targetId);

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        sourceId: testLink.sourceId,
        targetId: testLink.targetId,
        linkType: 'knowledge',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.insertOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.create_new_link(testLink.sourceId, testLink.targetId)
      ).rejects.toThrow(error);
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockConnectToDatabase.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.create_new_link(testLink.sourceId, testLink.targetId)
      ).rejects.toThrow(error);
    });

    it('should handle collection operation errors', async () => {
      // Arrange
      const error = new Error('Collection operation failed');
      mockCollection.insertOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.create_new_link(testLink.sourceId, testLink.targetId)
      ).rejects.toThrow(error);
    });
  });

  describe('logging', () => {
    it('should log successful link creation', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      // Act
      await mongodbStorage.create_new_link(testLink.sourceId, testLink.targetId);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Created knowledge link with _id: ${JSON.stringify(mockInsertResult.insertedId)} from ${testLink.sourceId} to ${testLink.targetId}`
      );
    });

    it('should log link creation errors', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.insertOne.mockRejectedValue(error);

      // Act
      await expect(
        mongodbStorage.create_new_link(testLink.sourceId, testLink.targetId)
      ).rejects.toThrow();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create knowledge link:', error);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string IDs', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      // Act
      await mongodbStorage.create_new_link('', '');

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        sourceId: '',
        targetId: '',
        linkType: 'knowledge',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should handle special characters in IDs', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      const specialId = 'knowledge-1@#$%^&*()_+{}|:"<>?[]\\;\',./';

      // Act
      await mongodbStorage.create_new_link(specialId, specialId);

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        sourceId: specialId,
        targetId: specialId,
        linkType: 'knowledge',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should handle very long IDs', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      const longId = 'a'.repeat(1000);

      // Act
      await mongodbStorage.create_new_link(longId, longId);

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        sourceId: longId,
        targetId: longId,
        linkType: 'knowledge',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('performance', () => {
    it('should handle multiple concurrent link creations', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      const linkPromises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        linkPromises.push(
          mongodbStorage.create_new_link(`source${i}`, `target${i}`)
        );
      }

      // Act
      await Promise.all(linkPromises);

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledTimes(10);
    });
  });
});