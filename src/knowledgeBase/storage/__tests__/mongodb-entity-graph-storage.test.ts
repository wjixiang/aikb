import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MongoEntityGraphStorage } from '../mongodb-entity-graph-storage';
import { connectToDatabase } from '../../database/mongodb';
import { ObjectId } from 'mongodb';

// Mock the database connection
vi.mock('../../database/mongodb');
const mockConnectToDatabase = vi.mocked(connectToDatabase);

// Mock the logger
vi.mock('../../lib/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('MongoEntityGraphStorage', () => {
  let mongodbStorage: MongoEntityGraphStorage;
  let mockCollection: any;
  let mockDb: any;

  const testRelation = {
    sourceId: 'entity1',
    targetId: 'entity2',
    relationType: 'related_to',
    properties: { strength: 0.8 },
  };

  const testRelation2 = {
    sourceId: 'entity2',
    targetId: 'entity3',
    relationType: 'contains',
    properties: { count: 5 },
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock collection
    mockCollection = {
      insertOne: vi.fn(),
      find: vi.fn(),
      updateOne: vi.fn(),
      deleteOne: vi.fn(),
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
    mongodbStorage = new MongoEntityGraphStorage();
  });

  describe('create_relation', () => {
    it('should create a relation successfully', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      // Act
      await mongodbStorage.create_relation(
        testRelation.sourceId,
        testRelation.targetId,
        testRelation.relationType,
        testRelation.properties
      );

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        sourceId: testRelation.sourceId,
        targetId: testRelation.targetId,
        relationType: testRelation.relationType,
        properties: testRelation.properties,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should create a relation without properties', async () => {
      // Arrange
      const mockInsertResult = {
        insertedId: new ObjectId(),
      };
      mockCollection.insertOne.mockResolvedValue(mockInsertResult);

      // Act
      await mongodbStorage.create_relation(
        testRelation.sourceId,
        testRelation.targetId,
        testRelation.relationType
      );

      // Assert
      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        sourceId: testRelation.sourceId,
        targetId: testRelation.targetId,
        relationType: testRelation.relationType,
        properties: {},
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
        mongodbStorage.create_relation(
          testRelation.sourceId,
          testRelation.targetId,
          testRelation.relationType
        )
      ).rejects.toThrow(error);
    });
  });

  describe('get_entity_relations', () => {
    it('should get all relations for an entity', async () => {
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
          properties: { strength: 0.8 },
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity2',
          targetId: 'entity1',
          relationType: 'related_to',
          properties: { strength: 0.6 },
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

      // Act
      const result = await mongodbStorage.get_entity_relations('entity1');

      // Assert
      expect(result).toEqual([
        {
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
          properties: { strength: 0.8 },
        },
        {
          sourceId: 'entity2',
          targetId: 'entity1',
          relationType: 'related_to',
          properties: { strength: 0.6 },
        },
      ]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $or: [
          { sourceId: 'entity1' },
          { targetId: 'entity1' }
        ]
      });
    });

    it('should get relations filtered by type', async () => {
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
          properties: { strength: 0.8 },
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

      // Act
      const result = await mongodbStorage.get_entity_relations('entity1', 'related_to');

      // Assert
      expect(result).toEqual([
        {
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
          properties: { strength: 0.8 },
        },
      ]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $or: [
          { sourceId: 'entity1' },
          { targetId: 'entity1' }
        ],
        relationType: 'related_to'
      });
    });

    it('should return empty array when no relations found', async () => {
      // Arrange
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });

      // Act
      const result = await mongodbStorage.get_entity_relations('entity1');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(error),
      });

      // Act & Assert
      await expect(mongodbStorage.get_entity_relations('entity1')).rejects.toThrow(error);
    });
  });

  describe('update_relation', () => {
    it('should update a relation successfully', async () => {
      // Arrange
      const mockUpdateResult = {
        modifiedCount: 1,
      };
      mockCollection.updateOne.mockResolvedValue(mockUpdateResult);

      // Act
      await mongodbStorage.update_relation(
        testRelation.sourceId,
        testRelation.targetId,
        testRelation.relationType,
        { strength: 0.9 }
      );

      // Assert
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        {
          sourceId: testRelation.sourceId,
          targetId: testRelation.targetId,
          relationType: testRelation.relationType,
        },
        {
          $set: {
            properties: { strength: 0.9 },
            updatedAt: expect.any(Date),
          },
        }
      );
    });

    it('should throw an error if relation is not found', async () => {
      // Arrange
      const mockUpdateResult = {
        modifiedCount: 0,
      };
      mockCollection.updateOne.mockResolvedValue(mockUpdateResult);

      // Act & Assert
      await expect(
        mongodbStorage.update_relation(
          testRelation.sourceId,
          testRelation.targetId,
          testRelation.relationType,
          { strength: 0.9 }
        )
      ).rejects.toThrow(`Relation from ${testRelation.sourceId} to ${testRelation.targetId} with type ${testRelation.relationType} not found`);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.updateOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.update_relation(
          testRelation.sourceId,
          testRelation.targetId,
          testRelation.relationType,
          { strength: 0.9 }
        )
      ).rejects.toThrow(error);
    });
  });

  describe('delete_relation', () => {
    it('should delete a relation successfully', async () => {
      // Arrange
      const mockDeleteResult = {
        deletedCount: 1,
      };
      mockCollection.deleteOne.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await mongodbStorage.delete_relation(
        testRelation.sourceId,
        testRelation.targetId,
        testRelation.relationType
      );

      // Assert
      expect(result).toBe(true);
      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        sourceId: testRelation.sourceId,
        targetId: testRelation.targetId,
        relationType: testRelation.relationType,
      });
    });

    it('should return false if relation is not found', async () => {
      // Arrange
      const mockDeleteResult = {
        deletedCount: 0,
      };
      mockCollection.deleteOne.mockResolvedValue(mockDeleteResult);

      // Act
      const result = await mongodbStorage.delete_relation(
        testRelation.sourceId,
        testRelation.targetId,
        testRelation.relationType
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.deleteOne.mockRejectedValue(error);

      // Act & Assert
      await expect(
        mongodbStorage.delete_relation(
          testRelation.sourceId,
          testRelation.targetId,
          testRelation.relationType
        )
      ).rejects.toThrow(error);
    });
  });

  describe('find_paths', () => {
    it('should find direct path between entities', async () => {
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

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
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity2',
          targetId: 'entity3',
          relationType: 'contains',
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

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
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity3',
          relationType: 'related_to',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity2',
          targetId: 'entity4',
          relationType: 'contains',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity3',
          targetId: 'entity4',
          relationType: 'contains',
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

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
              entityId: 'entity4',
              relationType: 'contains',
            }
          ]),
          expect.arrayContaining([
            {
              entityId: 'entity3',
              relationType: 'related_to',
            },
            {
              entityId: 'entity4',
              relationType: 'contains',
            }
          ])
        ])
      );
    });

    it('should respect maxDepth parameter', async () => {
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity2',
          targetId: 'entity3',
          relationType: 'contains',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity3',
          targetId: 'entity4',
          relationType: 'contains',
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity4', 2);

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

    it('should return empty array when no path exists', async () => {
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

      // Act
      const result = await mongodbStorage.find_paths('entity1', 'entity3', 3);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle bidirectional relations', async () => {
      // Arrange
      const mockRelations = [
        {
          _id: new ObjectId(),
          sourceId: 'entity1',
          targetId: 'entity2',
          relationType: 'related_to',
        },
        {
          _id: new ObjectId(),
          sourceId: 'entity2',
          targetId: 'entity1',
          relationType: 'related_to',
        },
      ];
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRelations),
      });

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

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockCollection.find.mockReturnValue({
        toArray: vi.fn().mockRejectedValue(error),
      });

      // Act & Assert
      await expect(mongodbStorage.find_paths('entity1', 'entity2', 3)).rejects.toThrow(error);
    });
  });
});