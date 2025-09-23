import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElasticsearchEntityContentStorage } from '../elasticsearch-entity-content-storage';
import { Client } from '@elastic/elasticsearch';
import { EntityData } from '../../knowledge.type';

// Mock the ElasticSearch client
vi.mock('@elastic/elasticsearch');
const MockClient = vi.mocked(Client);

// Mock the logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../../lib/logger', () => ({
  default: vi.fn().mockImplementation(() => mockLogger),
}));

describe('ElasticsearchEntityContentStorage', () => {
  let elasticsearchStorage: ElasticsearchEntityContentStorage;
  let mockClient: any;
  let mockIndex: any;

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

    // Mock the Client constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    MockClient.mockImplementation(() => mockClient);

    // Create storage instance
    elasticsearchStorage = new ElasticsearchEntityContentStorage(
      'http://localhost:9200',
    );

    // Mock the logger instance on the storage class
    (elasticsearchStorage as any).logger = mockLogger;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default URL', () => {
      // Act
      const storage = new ElasticsearchEntityContentStorage();

      // Assert
      expect(storage).toBeInstanceOf(ElasticsearchEntityContentStorage);
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://localhost:9200',
        auth: {
          apiKey: '',
        },
      });
    });

    it('should create instance with custom URL', () => {
      // Act
      const storage = new ElasticsearchEntityContentStorage('http://custom:9200');

      // Assert
      expect(storage).toBeInstanceOf(ElasticsearchEntityContentStorage);
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
      const storage = new ElasticsearchEntityContentStorage('http://custom:9200');

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
      const initializeIndex = (
        elasticsearchStorage as any
      ).initializeIndex.bind(elasticsearchStorage);

      // Act
      await initializeIndex();

      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'entities',
      });
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: 'entities',
        body: {
          mappings: {
            properties: {
              name: {
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword',
                  },
                },
              },
              tags: {
                type: 'text',
                fields: {
                  keyword: {
                    type: 'keyword',
                  },
                },
              },
              definition: {
                type: 'text',
                analyzer: 'standard',
              },
              nameString: {
                type: 'keyword',
              },
            },
          },
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Created index: entities');
    });

    it('should not create index if it already exists', async () => {
      // Arrange
      mockClient.indices.exists.mockResolvedValue(true);

      // Access private method for testing
      const initializeIndex = (
        elasticsearchStorage as any
      ).initializeIndex.bind(elasticsearchStorage);

      // Act
      await initializeIndex();

      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'entities',
      });
      expect(mockClient.indices.create).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        'Created index: entities',
      );
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
      const initializeIndex = (
        elasticsearchStorage as any
      ).initializeIndex.bind(elasticsearchStorage);

      // Act
      await initializeIndex();

      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'entities',
      });
      expect(mockClient.indices.create).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Index entities already exists, continuing',
      );
    });

    it('should throw error if index creation fails with other error', async () => {
      // Arrange
      const error = new Error('Index creation failed');
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockRejectedValue(error);

      // Access private method for testing
      const initializeIndex = (
        elasticsearchStorage as any
      ).initializeIndex.bind(elasticsearchStorage);

      // Act & Assert
      await expect(initializeIndex()).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize index:',
        error,
      );
    });
  });

  describe('create_new_entity', () => {
    it('should create a new entity successfully', async () => {
      // Arrange
      const entityId = 'test.entity.id';
      mockClient.index.mockResolvedValue({});

      // Act
      const result = await elasticsearchStorage.create_new_entity_content(mockEntity, entityId);

      // // Assert
      // expect(result).toEqual(mockEntity);
      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'entities',
        id: entityId,
        body: {
          ...mockEntity,
          nameString: 'test.entity',
          createdAt: expect.any(String),
        },
      });
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const entityId = 'test.entity.id';
      const error = new Error('ElasticSearch error');
      mockClient.index.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.create_new_entity_content(mockEntity, entityId),
      ).rejects.toThrow(error);
    });
  });

  describe('get_entity_by_name', () => {
    it('should get an entity by name successfully', async () => {
      // Arrange
      mockClient.get.mockResolvedValue({
        found: true,
        _source: mockEntity,
      });

      // Act
      const result = await elasticsearchStorage.get_entity_by_name([
        'test',
        'entity',
      ]);

      // Assert
      expect(result).toEqual(mockEntity);
      expect(mockClient.get).toHaveBeenCalledWith({
        index: 'entities',
        id: 'test.entity',
      });
    });

    it('should return null if entity is not found', async () => {
      // Arrange
      mockClient.get.mockResolvedValue({ found: false });

      // Act
      const result = await elasticsearchStorage.get_entity_by_name([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBeNull();
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.get.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.get_entity_by_name(['test', 'entity']),
      ).rejects.toThrow(error);
    });
  });

  describe('update_entity', () => {
    it('should update an entity successfully', async () => {
      // Arrange
      const oldEntity = {
        ...mockEntity,
        id: 'entity_12345_abcde',
      };
      const newEntityData = {
        ...mockEntity,
        tags: ['updated', 'tags'],
      };
      mockClient.update.mockResolvedValue({ result: 'updated' });

      // Act
      const result = await elasticsearchStorage.update_entity(oldEntity, newEntityData);

      // Assert
      expect(result).toEqual({
        ...newEntityData,
        id: 'entity_12345_abcde',
      });
      expect(mockClient.update).toHaveBeenCalledWith({
        index: 'entities',
        id: 'entity_12345_abcde',
        body: {
          doc: {
            ...newEntityData,
            nameString: 'test.entity',
            updatedAt: expect.any(String),
          },
        },
      } as any);
    });

    it('should throw an error if entity is not found', async () => {
      // Arrange
      const oldEntity = {
        ...mockEntity,
        id: 'entity_12345_abcde',
      };
      const newEntityData = {
        ...mockEntity,
        tags: ['updated', 'tags'],
      };
      mockClient.update.mockResolvedValue({ result: 'noop' });

      // Act & Assert
      await expect(
        elasticsearchStorage.update_entity(oldEntity, newEntityData),
      ).rejects.toThrow('Entity with ID entity_12345_abcde not found');
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const oldEntity = {
        ...mockEntity,
        id: 'entity_12345_abcde',
      };
      const newEntityData = {
        ...mockEntity,
        tags: ['updated', 'tags'],
      };
      const error = new Error('ElasticSearch error');
      mockClient.update.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.update_entity(oldEntity, newEntityData),
      ).rejects.toThrow(error);
    });
  });

  describe('delete_entity', () => {
    it('should delete an entity successfully', async () => {
      // Arrange
      mockClient.delete.mockResolvedValue({ result: 'deleted' });

      // Act
      const result = await elasticsearchStorage.delete_entity([
        'test',
        'entity',
      ]);

      // Assert
      expect(result).toBe(true);
      expect(mockClient.delete).toHaveBeenCalledWith({
        index: 'entities',
        id: 'test.entity',
      });
    });

    it('should return false if entity is not found', async () => {
      // Arrange
      mockClient.delete.mockResolvedValue({ result: 'not_found' });

      // Act
      const result = await elasticsearchStorage.delete_entity([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.delete_entity(['test', 'entity']),
      ).rejects.toThrow(error);
    });
  });

  describe('search_entities', () => {
    it('should search entities successfully', async () => {
      // Arrange
      mockClient.search.mockResolvedValue({
        hits: {
          hits: [{ _source: mockEntity }, { _source: mockEntity2 }],
        },
      });

      // Act
      const result = await elasticsearchStorage.search_entities('test');

      // Assert
      expect(result).toEqual([mockEntity, mockEntity2]);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'entities',
        body: {
          query: {
            multi_match: {
              query: 'test',
              fields: ['name', 'tags', 'definition'],
              fuzziness: 'AUTO',
            },
          },
        },
      } as any);
    });

    it('should return empty array if no entities match', async () => {
      // Arrange
      mockClient.search.mockResolvedValue({
        hits: {
          hits: [],
        },
      });

      // Act
      const result = await elasticsearchStorage.search_entities('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.search.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.search_entities('test'),
      ).rejects.toThrow(error);
    });
  });

  describe('list_all_entities', () => {
    it('should list all entities successfully', async () => {
      // Arrange
      mockClient.search.mockResolvedValue({
        hits: {
          hits: [{ _source: mockEntity }, { _source: mockEntity2 }],
        },
      });

      // Act
      const result = await elasticsearchStorage.list_all_entities();

      // Assert
      expect(result).toEqual([mockEntity, mockEntity2]);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: 'entities',
        body: {
          query: {
            match_all: {},
          },
          size: 10000,
        },
      } as any);
    });

    it('should return empty array if no entities exist', async () => {
      // Arrange
      mockClient.search.mockResolvedValue({
        hits: {
          hits: [],
        },
      });

      // Act
      const result = await elasticsearchStorage.list_all_entities();

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.search.mockRejectedValue(error);

      // Act & Assert
      await expect(elasticsearchStorage.list_all_entities()).rejects.toThrow(
        error,
      );
    });
  });
});
