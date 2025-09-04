import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ElasticsearchKnowledgeStorage from '../elasticsearch-knowledge-storage';
import { Client } from '@elastic/elasticsearch';
import { KnowledgeData, KnowledgeDataWithId } from '../../knowledge.type';

// Extended interface for testing purposes to include additional fields
interface KnowledgeDataWithIdExtended extends KnowledgeDataWithId {
  createdAt?: string;
  scopePathString?: string;
}

// Mock the ElasticSearch client
vi.mock('@elastic/elasticsearch');
const MockClient = vi.mocked(Client);

// Mock the logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock('../../logger', () => ({
  default: vi.fn(() => mockLogger),
}));

describe('ElasticsearchKnowledgeStorage', () => {
  let elasticsearchStorage: ElasticsearchKnowledgeStorage;
  let mockClient: any;

  const mockKnowledge: KnowledgeData = {
    scopePath: {
      entities: ['test', 'entity'],
      scopes: [['test', 'scope'], ['another', 'scope']]
    },
    content: 'This is test knowledge content for unit testing',
    metadata: {
      tags: ['test','knowledge','unit'],
      createDate: new Date()
    }
  };

  const mockKnowledge2: KnowledgeData = {
    scopePath: {
      entities: ['another', 'entity'],
      scopes: [['another', 'scope']]
    },
    content: 'This is another test knowledge content for unit testing',
    metadata: {
      tags: ['another','test','knowledge'],
      createDate: new Date()
    }
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
    };

    mockClient.indices.exists.mockResolvedValue(false);
    mockClient.indices.create.mockResolvedValue({});
    mockClient.index.mockResolvedValue({});

    // Mock the Client constructor
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    MockClient.mockImplementation(() => mockClient);

    // Create storage instance
    elasticsearchStorage = new ElasticsearchKnowledgeStorage('http://localhost:9200');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default URL', () => {
      // Act
      const storage = new ElasticsearchKnowledgeStorage();
      
      // Assert
      expect(storage).toBeInstanceOf(ElasticsearchKnowledgeStorage);
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://localhost:9200',
        auth: {
          apiKey: ""
        }
      });
    });

    it('should create instance with custom URL', () => {
      // Act
      const storage = new ElasticsearchKnowledgeStorage('http://custom:9200');
      
      // Assert
      expect(storage).toBeInstanceOf(ElasticsearchKnowledgeStorage);
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://custom:9200',
        auth: {
          apiKey: ""
        }
      });
    });

    it('should use API key from environment variable', () => {
      // Arrange
      process.env.ELASTICSEARCH_URL_API_KEY = 'test-api-key';
      
      // Act
      const storage = new ElasticsearchKnowledgeStorage('http://custom:9200');
      
      // Assert
      expect(MockClient).toHaveBeenCalledWith({
        node: 'http://custom:9200',
        auth: {
          apiKey: 'test-api-key'
        }
      });
      
      // Cleanup
      delete process.env.ELASTICSEARCH_URL_API_KEY;
    });
  });

  describe('formatScopePath', () => {
    it('should format scope path with entities and multiple scopes', () => {
      // Arrange
      const scopePath = {
        entities: ['test', 'entity'],
        scopes: [['scope1', 'subscope1'], ['scope2']]
      };
      
      // Access private method for testing
      const formatScopePath = (elasticsearchStorage as any).formatScopePath.bind(elasticsearchStorage);
      
      // Act
      const result = formatScopePath(scopePath);
      
      // Assert
      expect(result).toBe('test.entity|scope1.subscope1|scope2');
    });

    it('should format scope path with single entity and no scopes', () => {
      // Arrange
      const scopePath = {
        entities: ['single'],
        scopes: []
      };
      
      // Access private method for testing
      const formatScopePath = (elasticsearchStorage as any).formatScopePath.bind(elasticsearchStorage);
      
      // Act
      const result = formatScopePath(scopePath);
      
      // Assert
      expect(result).toBe('single|');
    });

    it('should format scope path with multiple entities and multiple scopes', () => {
      // Arrange
      const scopePath = {
        entities: ['deeply', 'nested', 'entity'],
        scopes: [['level1', 'level2'], ['level3'], ['level4', 'level5', 'level6']]
      };
      
      // Access private method for testing
      const formatScopePath = (elasticsearchStorage as any).formatScopePath.bind(elasticsearchStorage);
      
      // Act
      const result = formatScopePath(scopePath);
      
      // Assert
      expect(result).toBe('deeply.nested.entity|level1.level2|level3|level4.level5.level6');
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
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: 'entities' });
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: 'entities',
        body: {
          mappings: {
            properties: {
              scopePath: {
                type: 'object',
                properties: {
                  entities: {
                    type: 'text',
                    fields: {
                      keyword: {
                        type: 'keyword',
                      },
                    },
                  },
                  scopes: {
                    type: 'nested',
                    properties: {
                      scope: {
                        type: 'text',
                        fields: {
                          keyword: {
                            type: 'keyword',
                          },
                        },
                      },
                    },
                  },
                },
              },
              scopePathString: {
                type: 'keyword',
              },
              content: {
                type: 'text',
                analyzer: 'standard',
              },
              metadata: {
                type: 'object',
                properties: {
                  tags: {
                    type: 'text',
                    fields: {
                      keyword: {
                        type: 'keyword',
                      },
                    },
                  },
                  createDate: {
                    type: 'date',
                  },
                },
              },
              id: {
                type: 'keyword',
              },
              createdAt: {
                type: 'date',
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
      const initializeIndex = (elasticsearchStorage as any).initializeIndex.bind(elasticsearchStorage);
      
      // Act
      await initializeIndex();
      
      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: 'entities' });
      expect(mockClient.indices.create).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith('Created index: entities');
    });

    it('should handle resource_already_exists_exception gracefully', async () => {
      // Arrange
      const error = {
        meta: {
          body: {
            error: {
              type: 'resource_already_exists_exception'
            }
          }
        }
      };
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockRejectedValue(error);
      
      // Access private method for testing
      const initializeIndex = (elasticsearchStorage as any).initializeIndex.bind(elasticsearchStorage);
      
      // Act
      await initializeIndex();
      
      // Assert
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: 'entities' });
      expect(mockClient.indices.create).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Index entities already exists, continuing');
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

  describe('create_new_knowledge', () => {
    it('should create a new knowledge successfully', async () => {
      // Arrange
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});
      mockClient.index.mockResolvedValue({});

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(mockKnowledge);

      // Assert
      expect(result).toMatchObject<KnowledgeDataWithId>({
        scopePath: mockKnowledge.scopePath,
        content: mockKnowledge.content,
        metadata: mockKnowledge.metadata,
        id: expect.any(String)
      });
      
      // Cast to extended interface to check additional properties
      const extendedResult = result;
      expect(extendedResult).toHaveProperty('scopePathString');
      expect(typeof extendedResult.scopePathString).toBe('string');
      
      expect(mockClient.index).toHaveBeenCalledWith({
        index: 'entities',
        id: result.id,
        body: {
          scopePath: mockKnowledge.scopePath,
          content: mockKnowledge.content,
          metadata: mockKnowledge.metadata,
          scopePathString: 'test.entity|test.scope|another.scope',
          createdAt: expect.any(String),
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(`Created knowledge with id: ${result.id}`);
    });

    it('should create knowledge with different scope paths', async () => {
      // Arrange
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});
      mockClient.index.mockResolvedValue({});

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(mockKnowledge2);

      // Assert
      expect(result).toMatchObject<KnowledgeDataWithId>({
        scopePath: mockKnowledge2.scopePath,
        content: mockKnowledge2.content,
        metadata: mockKnowledge2.metadata,
        id: expect.any(String)
      });

    //   // Cast to extended interface to check additional properties
    //   const extendedResult = result as KnowledgeDataWithIdExtended;
    //   expect(extendedResult).toHaveProperty('createdAt');
    //   expect(extendedResult).toHaveProperty('scopePathString');
      
    //   // Verify the formatted scope path string
    //   const expectedScopePathString = 'another.entity|another.scope';
    //   expect(extendedResult.scopePathString).toBe(expectedScopePathString);
    });

    it('should generate unique IDs for different knowledge entries', async () => {
      // Arrange
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});
      mockClient.index.mockResolvedValue({});

      // Act
      const result1 = await elasticsearchStorage.create_new_knowledge(mockKnowledge);
      const result2 = await elasticsearchStorage.create_new_knowledge(mockKnowledge2);

      // Assert
      expect(result1.id).not.toBe(result2.id);
    });

    it('should throw an error if database operation fails', async () => {
      // Arrange
      const error = new Error('ElasticSearch error');
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockResolvedValue({});
      mockClient.index.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.create_new_knowledge(mockKnowledge),
      ).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create knowledge:', error);
    });

    it('should throw an error if index initialization fails', async () => {
      // Arrange
      const error = new Error('Index initialization failed');
      mockClient.indices.exists.mockResolvedValue(false);
      mockClient.indices.create.mockRejectedValue(error);

      // Act & Assert
      await expect(
        elasticsearchStorage.create_new_knowledge(mockKnowledge),
      ).rejects.toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize index:', error);
    });
  });
});