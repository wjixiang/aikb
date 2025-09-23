import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client } from '@elastic/elasticsearch';

// Mock the ElasticSearch client
vi.mock('@elastic/elasticsearch');
const MockClient = vi.mocked(Client);

// Mock the logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// Mock createLoggerWithPrefix function
vi.mock('../../lib/logger', () => ({
  createLoggerWithPrefix: vi.fn().mockReturnValue(mockLogger),
}));

// Import after mocking
import { ElasticsearchVectorStorage } from '../elasticsearch-entity-vector-storage';

describe('ElasticsearchEntityVectorStorage', () => {
  let elasticsearchStorage: ElasticsearchVectorStorage;
  let mockClient: any;
  let mockIndex: any;

  const mockVector = [0.1, 0.2, 0.3, 0.4, 0.5];
  const mockMetadata = { source: 'test', category: 'unit_test' };
  const entityId = 'test.entity.id';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      indices: {
        exists: vi.fn(),
        create: vi.fn(),
      },
      index: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      bulk: vi.fn(),
    };

    // Create mock index methods
    mockIndex = {
      exists: vi.fn().mockResolvedValue(false),
      create: vi.fn(),
    };

    mockClient.indices.exists.mockResolvedValue(false);
    mockClient.indices.create.mockResolvedValue({});
    mockClient.index.mockResolvedValue({});
    mockClient.get.mockResolvedValue({ found: true });
    mockClient.update.mockResolvedValue({ result: 'updated' });
    mockClient.delete.mockResolvedValue({ result: 'deleted' });
    mockClient.search.mockResolvedValue({
      hits: {
        hits: [],
      },
    });
    mockClient.bulk.mockResolvedValue({});

    // Mock the Client constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    MockClient.mockImplementation(() => mockClient);

    // Create storage instance
    elasticsearchStorage = new ElasticsearchVectorStorage('http://localhost:9200', 5);
    
    // Mock the logger after instance creation
    (elasticsearchStorage as any).logger = mockLogger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default URL and dimensions', () => {
      // Act
      const storage = new ElasticsearchVectorStorage();

      // Assert
      expect(storage).toBeInstanceOf(ElasticsearchVectorStorage);
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://localhost:9200',
        auth: {
          apiKey: '',
        },
      });
    });

    it('should create instance with custom URL and dimensions', () => {
      // Act
      const storage = new ElasticsearchVectorStorage('http://custom:9200', 768);

      // Assert
      expect(storage).toBeInstanceOf(ElasticsearchVectorStorage);
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://custom:9200',
        auth: {
          apiKey: '',
        },
      });
    });

    it('should use API key from environment variable', () => {
      // Arrange
      process.env.ELASTICSEARCH_URL_API_KEY = 'test-api-key';

      // Act
      const storage = new ElasticsearchVectorStorage('http://custom:9200', 1536);

      // Assert
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://custom:9200',
        auth: {
          apiKey: 'test-api-key',
        },
      });

      // Cleanup
      delete process.env.ELASTICSEARCH_URL_API_KEY;
    });
  });

  describe('initializeIndex', () => {
    it('should create index if it does not exist', async () => {
      // Arrange
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});

      // Access private method for testing
      const initializeIndex = (elasticsearchStorage as any).initializeIndex.bind(elasticsearchStorage);

      // Act
      await initializeIndex();

      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'entity_vectors',
      });
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: 'entity_vectors',
        body: {
          mappings: {
            properties: {
              entityId: {
                type: 'keyword',
              },
              vector: {
                type: 'dense_vector',
                dims: 5,
              },
              metadata: {
                type: 'object',
                dynamic: true,
              },
              createdAt: {
                type: 'date',
              },
              updatedAt: {
                type: 'date',
              },
            },
          },
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Created index: entity_vectors with vector dimensions: 5');
    });

    it('should not create index if it already exists', async () => {
      // Arrange
      mockClient.indices.exists.mockResolvedValue(true);

      // Access private method for testing
      const initializeIndex = (elasticsearchStorage as any).initializeIndex.bind(elasticsearchStorage);

      // Act
      await initializeIndex();

      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'entity_vectors',
      });
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });

    it('should handle resource_already_exists_exception gracefully', async () => {
      // Arrange
      const error = {
        meta: {
          body: {
            error: {
              type: 'resource_already_exists_exception',
            },
          },
        },
      };
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockRejectedValue(error);

      // Access private method for testing
      const initializeIndex = (elasticsearchStorage as any).initializeIndex.bind(elasticsearchStorage);

      // Act
      await initializeIndex();

      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'entity_vectors',
      });
      expect(mockClient.indices.create).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Index entity_vectors already exists, continuing');
    });

    it('should throw error if index creation fails with other error', async () => {
      // Arrange
      const error = new Error('Index creation failed');
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockRejectedValue(error);

      // Access private method for testing
      const initializeIndex = (elasticsearchStorage as any).initializeIndex.bind(elasticsearchStorage);

      // Act & Assert
      await expect(initializeIndex()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize index:', error);
    });
  });

  describe('store_vector', () => {
    it('should store a vector successfully', async () => {
      // Arrange
      mockClient.index.mockResolvedValue({});

      // Act
      await elasticsearchStorage.store_vector(entityId, mockVector, mockMetadata);

      // Assert
      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'entity_vectors',
        id: entityId,
        body: {
          entityId,
          vector: mockVector,
          metadata: mockMetadata,
          createdAt: expect.any(String),
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Stored vector for entity ID: ${entityId}`);
    });

    it('should throw error if vector dimensions mismatch', async () => {
      // Arrange
      const wrongVector = [0.1, 0.2, 0.3]; // Wrong dimensions (3 instead of 5)

      // Act & Assert
      await expect(
        elasticsearchStorage.store_vector(entityId, wrongVector, mockMetadata)
      ).rejects.toThrow('Vector dimensions mismatch. Expected: 5, Got: 3');
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.index.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.store_vector(entityId, mockVector, mockMetadata)
      ).rejects.toThrow(error);
    });
  });

  describe('get_vector', () => {
    it('should get a vector successfully', async () => {
      // Arrange
      mockClient.get.mockResolvedValue({
        found: true,
        _source: {
          entityId,
          vector: mockVector,
          metadata: mockMetadata,
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      });

      // Act
      const result = await elasticsearchStorage.get_vector(entityId);

      // Assert
      expect(result).toEqual({
        vector: mockVector,
        metadata: mockMetadata,
      });
      expect(mockClient.get).toHaveBeenCalledWith({
        index: 'entity_vectors',
        id: entityId,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Retrieved vector for entity ID: ${entityId}`);
    });

    it('should return null if vector is not found', async () => {
      // Arrange
      mockClient.get.mockResolvedValue({ found: false });

      // Act
      const result = await elasticsearchStorage.get_vector('nonexistent.id');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Vector for entity ID nonexistent.id not found');
    });

    it('should return null if 404 error is thrown', async () => {
      // Arrange
      const error = { meta: { statusCode: 404 } };
      mockClient.get.mockRejectedValue(error);

      // Act
      const result = await elasticsearchStorage.get_vector('nonexistent.id');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Vector for entity ID nonexistent.id not found');
    });

    it('should throw an error if database operation fails with non-404 error', async () => {
      // Arrange
      const error = new Error('Database error');
      mockClient.get.mockRejectedValue(error);

      // Act & Assert
      await expect(elasticsearchStorage.get_vector(entityId)).rejects.toThrow(error);
    });
  });

  describe('update_vector', () => {
    it('should update an existing vector successfully', async () => {
      // Arrange
      const updatedVector = [0.6, 0.7, 0.8, 0.9, 1.0];
      const updatedMetadata = { ...mockMetadata, updated: true };
      
      mockClient.get.mockResolvedValue({
        found: true,
        _source: {
          entityId,
          vector: mockVector,
          metadata: mockMetadata,
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      });
      mockClient.update.mockResolvedValue({ result: 'updated' });

      // Act
      await elasticsearchStorage.update_vector(entityId, updatedVector, updatedMetadata);

      // Assert
      expect(mockClient.update).toHaveBeenCalledWith({
        index: 'entity_vectors',
        id: entityId,
        body: {
          doc: {
            entityId,
            vector: updatedVector,
            metadata: updatedMetadata,
            updatedAt: expect.any(String),
          },
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Updated vector for entity ID: ${entityId}`);
    });

    it('should store a new vector if it does not exist', async () => {
      // Arrange
      mockClient.get.mockResolvedValue({ found: false });
      mockClient.index.mockResolvedValue({});

      // Act
      await elasticsearchStorage.update_vector(entityId, mockVector, mockMetadata);

      // Assert
      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'entity_vectors',
        id: entityId,
        body: {
          entityId,
          vector: mockVector,
          metadata: mockMetadata,
          createdAt: expect.any(String),
        },
      });
    });

    it('should throw error if vector dimensions mismatch', async () => {
      // Arrange
      const wrongVector = [0.1, 0.2, 0.3]; // Wrong dimensions (3 instead of 5)

      // Act & Assert
      await expect(
        elasticsearchStorage.update_vector(entityId, wrongVector, mockMetadata)
      ).rejects.toThrow('Vector dimensions mismatch. Expected: 5, Got: 3');
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.get.mockResolvedValue({
        found: true,
        _source: {
          entityId,
          vector: mockVector,
          metadata: mockMetadata,
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      });
      mockClient.update.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.update_vector(entityId, mockVector, mockMetadata)
      ).rejects.toThrow(error);
    });
  });

  describe('delete_vector', () => {
    it('should delete a vector successfully', async () => {
      // Arrange
      mockClient.delete.mockResolvedValue({ result: 'deleted' });

      // Act
      const result = await elasticsearchStorage.delete_vector(entityId);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.delete).toHaveBeenCalledWith({
        index: 'entity_vectors',
        id: entityId,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Deleted vector for entity ID: ${entityId}`);
    });

    it('should return false if vector is not found', async () => {
      // Arrange
      mockClient.delete.mockResolvedValue({ result: 'not_found' });

      // Act
      const result = await elasticsearchStorage.delete_vector('nonexistent.id');

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Vector for entity ID nonexistent.id not found for deletion');
    });

    it('should return false if 404 error is thrown', async () => {
      // Arrange
      const error = { meta: { statusCode: 404 } };
      mockClient.delete.mockRejectedValue(error);

      // Act
      const result = await elasticsearchStorage.delete_vector('nonexistent.id');

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Vector for entity ID nonexistent.id not found for deletion');
    });

    it('should throw an error if database operation fails with non-404 error', async () => {
      // Arrange
      const error = new Error('Database error');
      mockClient.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(elasticsearchStorage.delete_vector(entityId)).rejects.toThrow(error);
    });
  });

  describe('find_similar_vectors', () => {
    it('should find similar vectors successfully', async () => {
      // Arrange
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockHits = [
        {
          _id: 'entity1',
          _source: {
            entityId: 'entity1',
            vector: [0.1, 0.2, 0.3, 0.4, 0.5],
            metadata: { category: 'test' },
          },
          _score: 0.9,
        },
        {
          _id: 'entity2',
          _source: {
            entityId: 'entity2',
            vector: [0.2, 0.3, 0.4, 0.5, 0.6],
            metadata: { category: 'test' },
          },
          _score: 0.8,
        },
      ];

      mockClient.search.mockResolvedValue({
        hits: {
          hits: mockHits,
        },
      });

      // Act
      const result = await elasticsearchStorage.find_similar_vectors(queryVector, 10, 0.5);

      // Assert
      expect(result).toEqual([
        {
          entityId: 'entity1',
          similarity: 0.9,
          metadata: { category: 'test' },
        },
        {
          entityId: 'entity2',
          similarity: 0.8,
          metadata: { category: 'test' },
        },
      ]);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'entity_vectors',
        body: {
          query: {
            script_score: {
              query: {
                exists: {
                  field: 'vector',
                },
              },
              script: {
                source: "cosineSimilarity(params.query_vector, 'vector') + 1.0",
                params: {
                  query_vector: queryVector,
                },
              },
            },
          },
          size: 10,
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 similar vectors');
    });

    it('should filter results by threshold', async () => {
      // Arrange
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockHits = [
        {
          _id: 'entity1',
          _source: {
            entityId: 'entity1',
            vector: [0.1, 0.2, 0.3, 0.4, 0.5],
            metadata: { category: 'test' },
          },
          _score: 0.9, // Above threshold
        },
        {
          _id: 'entity2',
          _source: {
            entityId: 'entity2',
            vector: [0.2, 0.3, 0.4, 0.5, 0.6],
            metadata: { category: 'test' },
          },
          _score: 0.3, // Below threshold
        },
      ];

      mockClient.search.mockResolvedValue({
        hits: {
          hits: mockHits,
        },
      });

      // Act
      const result = await elasticsearchStorage.find_similar_vectors(queryVector, 10, 0.5);

      // Assert
      expect(result).toEqual([
        {
          entityId: 'entity1',
          similarity: 0.9,
          metadata: { category: 'test' },
        },
      ]);
    });

    it('should return empty array if no vectors match threshold', async () => {
      // Arrange
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockHits = [
        {
          _id: 'entity1',
          _source: {
            entityId: 'entity1',
            vector: [0.1, 0.2, 0.3, 0.4, 0.5],
            metadata: { category: 'test' },
          },
          _score: 0.3, // Below threshold
        },
      ];

      mockClient.search.mockResolvedValue({
        hits: {
          hits: mockHits,
        },
      });

      // Act
      const result = await elasticsearchStorage.find_similar_vectors(queryVector, 10, 0.5);

      // Assert
      expect(result).toEqual([]);
    });

    it('should return empty array if index does not exist', async () => {
      // Arrange
      const error = {
        meta: {
          body: {
            error: {
              type: 'index_not_found_exception',
            },
          },
        },
      };
      mockClient.search.mockRejectedValue(error);

      // Act
      const result = await elasticsearchStorage.find_similar_vectors(mockVector);

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith('Vector index does not exist, returning empty array');
    });

    it('should throw error if vector dimensions mismatch', async () => {
      // Arrange
      const wrongVector = [0.1, 0.2, 0.3]; // Wrong dimensions (3 instead of 5)

      // Act & Assert
      await expect(
        elasticsearchStorage.find_similar_vectors(wrongVector)
      ).rejects.toThrow('Vector dimensions mismatch. Expected: 5, Got: 3');
    });

    it('should throw an error if database operation fails with other error', async () => {
      // Arrange
      const error = new Error('Search error');
      mockClient.search.mockRejectedValue(error);

      // Act & Assert
      await expect(elasticsearchStorage.find_similar_vectors(mockVector)).rejects.toThrow(error);
    });
  });

  describe('batch_store_vectors', () => {
    it('should batch store vectors successfully', async () => {
      // Arrange
      const vectors = [
        {
          entityId: 'entity1',
          vector: [0.1, 0.2, 0.3, 0.4, 0.5],
          metadata: { category: 'test1' },
        },
        {
          entityId: 'entity2',
          vector: [0.6, 0.7, 0.8, 0.9, 1.0],
          metadata: { category: 'test2' },
        },
      ];

      mockClient.bulk.mockResolvedValue({});

      // Act
      await elasticsearchStorage.batch_store_vectors(vectors);

      // Assert
      expect(mockClient.bulk).toHaveBeenCalledWith({
        body: [
          { index: { _index: 'entity_vectors', _id: 'entity1' } },
          {
            entityId: 'entity1',
            vector: [0.1, 0.2, 0.3, 0.4, 0.5],
            metadata: { category: 'test1' },
            createdAt: expect.any(String),
          },
          { index: { _index: 'entity_vectors', _id: 'entity2' } },
          {
            entityId: 'entity2',
            vector: [0.6, 0.7, 0.8, 0.9, 1.0],
            metadata: { category: 'test2' },
            createdAt: expect.any(String),
          },
        ],
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Batch stored 2 vectors');
    });

    it('should throw error if any vector has wrong dimensions', async () => {
      // Arrange
      const vectors = [
        {
          entityId: 'entity1',
          vector: [0.1, 0.2, 0.3, 0.4, 0.5], // Correct dimensions
          metadata: { category: 'test1' },
        },
        {
          entityId: 'entity2',
          vector: [0.6, 0.7, 0.8], // Wrong dimensions (3 instead of 5)
          metadata: { category: 'test2' },
        },
      ];

      // Act & Assert
      await expect(
        elasticsearchStorage.batch_store_vectors(vectors)
      ).rejects.toThrow('Vector dimensions mismatch for entity ID entity2. Expected: 5, Got: 3');
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const vectors = [
        {
          entityId: 'entity1',
          vector: [0.1, 0.2, 0.3, 0.4, 0.5],
          metadata: { category: 'test1' },
        },
      ];
      const error = new Error('Bulk operation error');
      mockClient.bulk.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.batch_store_vectors(vectors)
      ).rejects.toThrow(error);
    });
  });
});