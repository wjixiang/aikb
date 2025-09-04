import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import ElasticsearchKnowledgeStorage from '../elasticsearch-knowledge-storage';
import { Client } from '@elastic/elasticsearch';
import { KnowledgeData, KnowledgeDataWithId, ElasticsearchKnowledgeResponse } from '../../knowledge.type';
import * as dotenv from 'dotenv';

// Extended interface for testing purposes to include additional fields
interface KnowledgeDataWithIdExtended extends KnowledgeDataWithId {
  createdAt?: string;
  scopePathString?: string;
}

dotenv.config();

// Helper function to check if ElasticSearch is available
async function isElasticSearchAvailable(url: string): Promise<boolean> {
  const client = new Client({
    node: url,
    auth: {
      apiKey: process.env.ELASTICSEARCH_URL_API_KEY || "X2xNeEM1a0JuWUJ6SHhoMlBSNTI6d3d3NXZGM2J0NjJqVHhjN29RZEp1UQ=="
    }
  });
  try {
    await client.ping();
    await client.close();
    return true;
  } catch (error) {
    console.error(error)
    return false;
  }
}

describe('ElasticsearchKnowledgeStorage Integration Tests', () => {
  let elasticsearchStorage: ElasticsearchKnowledgeStorage;
  let client: Client;
  const indexName = 'entities';
  let elasticSearchAvailable = false;

  it("should connect to elasticSearch", async() => {
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200';
    console.info(`esUrl: ${esUrl}`)
    elasticSearchAvailable = await isElasticSearchAvailable(esUrl);
    expect(elasticSearchAvailable).toBe(true)
  })

  // Test data
  const testKnowledge: KnowledgeData = {
    scopePath: {
      entities: ['test', 'entity'],
      scopes: [['test', 'scope'], ['another', 'scope']]
    },
    content: 'This is test knowledge content for integration testing',
    metadata: {
      tags: ['test', 'knowledge', 'integration'],
      createDate: new Date()
    }
  };

  const testKnowledge2: KnowledgeData = {
    scopePath: {
      entities: ['another', 'entity'],
      scopes: [['another', 'scope']]
    },
    content: 'This is another test knowledge content for integration testing',
    metadata: {
      tags: ['another', 'test', 'knowledge'],
      createDate: new Date()
    }
  };

  beforeAll(async () => {
    // Connect to ElasticSearch
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

    // Check if ElasticSearch is available
    elasticSearchAvailable = await isElasticSearchAvailable(esUrl);
    
    if (!elasticSearchAvailable) {
      console.log('ElasticSearch is not available, skipping integration tests');
      return;
    }

    client = new Client({
      node: esUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || ""
      }
    });

    // Create storage instance
    elasticsearchStorage = new ElasticsearchKnowledgeStorage(esUrl);

    // Wait for ElasticSearch to be ready with retries
    let isConnected = false;
    let retries = 10;
    while (!isConnected && retries > 0) {
      try {
        await client.ping();
        isConnected = true;
        console.log('Connected to ElasticSearch');
      } catch (error) {
        console.log(`ElasticSearch not ready, retrying... (${retries} attempts left)`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!isConnected) {
      throw new Error('Failed to connect to ElasticSearch after multiple attempts');
    }
  });

  afterAll(async () => {
    // Clean up and close connection
    if (client) {
      try {
        // Delete the test index
        await client.indices.delete({ index: indexName });
      } catch (error) {
        // Ignore index not found errors during cleanup
        if (error?.meta?.body?.error?.type !== 'index_not_found_exception') {
          console.error('Error cleaning up index:', error);
        }
      }
      await client.close();
    }
  });

  beforeEach(async () => {
    // Clean up index before each test
    try {
      try {
        await client.indices.delete({ index: indexName });
      } catch (error) {
        // Index might not exist, which is fine
      }
      // Wait a bit to ensure the deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error cleaning up index before test:', error);
    }
  });

  describe('create_new_knowledge', () => {
    it('should create new knowledge successfully', async () => {
      // Act
      const result = await elasticsearchStorage.create_new_knowledge(testKnowledge);

      // Assert
      expect(result).toMatchObject<KnowledgeDataWithId>({
        scopePath: testKnowledge.scopePath,
        content: testKnowledge.content,
        metadata: testKnowledge.metadata,
        id: expect.any(String)
      });
      
      // Cast to extended interface to check additional properties
      const extendedResult = result ;
      console.log(extendedResult)
      expect(extendedResult).toHaveProperty('id');
      // expect(extendedResult).toHaveProperty('scopePath');
      // expect(typeof extendedResult.createdAt).toBe('string');
      expect(typeof extendedResult.id).toBe('string');

      // Verify knowledge was actually inserted into ElasticSearch
      const knowledgeInEs = await client.get({
        index: indexName,
        id: result.id,
      }) as ElasticsearchKnowledgeResponse;
      console.log(knowledgeInEs)
      expect(knowledgeInEs.found).toBe(true);
      expect(knowledgeInEs._source.knowledgeId).toBe(result.id);
      expect(knowledgeInEs._source.content).toBe(testKnowledge.content);
      expect(knowledgeInEs._source.scopePath).toEqual(testKnowledge.scopePath);
      expect(JSON.stringify(knowledgeInEs._source.metadata)).toEqual(JSON.stringify(testKnowledge.metadata));
    }, 30000);

    it('should create knowledge with different scope paths', async () => {
      // Act
      const result = await elasticsearchStorage.create_new_knowledge(testKnowledge2);

      // Assert
      expect(result).toMatchObject<KnowledgeDataWithId>({
        scopePath: testKnowledge2.scopePath,
        content: testKnowledge2.content,
        metadata: testKnowledge2.metadata,
        id: expect.any(String)
      });
    }, 30000);

    it('should create knowledge with different metadata', async () => {
      const knowledgeWithDifferentMetadata: KnowledgeData = {
        ...testKnowledge,
        metadata: {
          tags: ['different', 'metadata'],
          createDate: new Date('2023-01-01T00:00:00.000Z')
        }
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(knowledgeWithDifferentMetadata);

      // Assert
      expect(result).toMatchObject<KnowledgeDataWithId>({
        scopePath: knowledgeWithDifferentMetadata.scopePath,
        content: knowledgeWithDifferentMetadata.content,
        metadata: knowledgeWithDifferentMetadata.metadata,
        id: expect.any(String)
      });

      
    }, 30000);
  });

  describe('knowledge data validation', () => {
    it('should create knowledge with long content', async () => {
      const longContent = 'x'.repeat(10000); // 10KB content
      const knowledgeWithLongContent: KnowledgeData = {
        ...testKnowledge,
        content: longContent
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(knowledgeWithLongContent);

      // Assert
      expect(result.content).toBe(longContent);
    }, 30000);

    it('should create knowledge with complex scope paths', async () => {
      const complexScopePath: KnowledgeData = {
        ...testKnowledge,
        scopePath: {
          entities: ['very', 'deep', 'nested', 'entity'],
          scopes: [
            ['level1', 'level2'],
            ['level3', 'level4', 'level5'],
            ['single']
          ]
        }
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(complexScopePath);

      // Assert
      expect(result.scopePath).toEqual(complexScopePath.scopePath);
      

    }, 30000);
  });

  describe('multiple knowledge operations', () => {
    it('should create multiple knowledge entries', async () => {
      // Act
      const result1 = await elasticsearchStorage.create_new_knowledge(testKnowledge);
      const result2 = await elasticsearchStorage.create_new_knowledge(testKnowledge2);

      // Assert
      expect(result1.id).not.toBe(result2.id);
      expect(result1.content).toBe(testKnowledge.content);
      expect(result2.content).toBe(testKnowledge2.content);

      // Verify both exist in ElasticSearch
      const knowledge1InEs = await client.get({
        index: indexName,
        id: result1.id,
      }) as ElasticsearchKnowledgeResponse;
      const knowledge2InEs = await client.get({
        index: indexName,
        id: result2.id,
      }) as ElasticsearchKnowledgeResponse;

      expect(knowledge1InEs.found).toBe(true);
      expect(knowledge2InEs.found).toBe(true);
    }, 30000);

    it('should create knowledge with same content but different scope paths', async () => {
      const sameContentKnowledge: KnowledgeData = {
        ...testKnowledge,
        scopePath: {
          entities: ['different', 'entity'],
          scopes: [['different', 'scope']]
        }
      };

      // Act
      const result1 = await elasticsearchStorage.create_new_knowledge(testKnowledge);
      const result2 = await elasticsearchStorage.create_new_knowledge(sameContentKnowledge);

      // Assert
      expect(result1.id).not.toBe(result2.id);
      expect(result1.content).toBe(sameContentKnowledge.content);
      expect(result1.scopePath).not.toEqual(result2.scopePath);
    }, 30000);
  });

  describe('error handling', () => {
    it('should handle invalid knowledge data gracefully', async () => {
      // Act & Assert
      await expect(
        elasticsearchStorage.create_new_knowledge({
          ...testKnowledge,
          content: '' // Empty content
        })
      ).resolves.toBeDefined();

      await expect(
        elasticsearchStorage.create_new_knowledge({
          ...testKnowledge,
          scopePath: {
            entities: [],
            scopes: []
          }
        })
      ).resolves.toBeDefined();
    }, 30000);
  });

  describe('index mapping validation', () => {
    it('should create knowledge with all required fields properly typed', async () => {
      const result = await elasticsearchStorage.create_new_knowledge(testKnowledge);

      // Verify the document structure in ElasticSearch
      const knowledgeInEs = await client.get({
        index: indexName,
        id: result.id,
      }) as ElasticsearchKnowledgeResponse;
      console.log(`knowledge in es: ${JSON.stringify(knowledgeInEs)}`)
      const source = knowledgeInEs._source;
      
      // Verify all expected fields exist and have correct types
      expect(source.knowledgeId).toBeTypeOf('string');
      expect(source.scopePath).toEqual(testKnowledge.scopePath);
      expect(source.scopePathString).toBeTypeOf('string');
      expect(source.content).toBeTypeOf('string');
      // expect(source.metadata).toEqual(testKnowledge.metadata);
      expect(source.createdAt).toBeTypeOf('string');
      
      // Verify date fields are properly formatted
      expect(new Date(source.createdAt)).toBeInstanceOf(Date);
      expect(new Date(source.metadata.createDate)).toBeInstanceOf(Date);
    }, 30000);
  });

  describe('private methods testing', () => {
    it('should format scope path correctly', async () => {
      // Since formatScopePath is a private method, we'll test it indirectly
      // through the create_new_knowledge method by checking the scopePathString field
      
      const complexScopePath: KnowledgeData = {
        scopePath: {
          entities: ['test', 'entity'],
          scopes: [['scope1', 'subscope1'], ['scope2']]
        },
        content: 'Test content for scope path formatting',
        metadata: {
          tags: ['test', 'formatting'],
          createDate: new Date()
        }
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(complexScopePath);
      console.log(`format result: ${JSON.stringify(result)}`)
      // Assert
      const extendedResult = result as KnowledgeDataWithIdExtended;
      expect(JSON.stringify(extendedResult.scopePath)).toBe('{"entities":["test","entity"],"scopes":[["scope1","subscope1"],["scope2"]]}');
    }, 30000);

    it.skip('should throw error when scope path with single entity and no scopes', async () => {
      const minimalScopePath: KnowledgeData = {
        scopePath: {
          entities: ['single'],
          scopes: []
        },
        content: 'Test content for minimal scope path',
        metadata: {
          tags: ['test', 'minimal'],
          createDate: new Date()
        }
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(minimalScopePath);

      // Assert
      const extendedResult = result as KnowledgeDataWithIdExtended;
      expect(extendedResult.scopePathString).toBe('single|');
    }, 30000);

    it('should format scope path with multiple entities and multiple scopes', async () => {
      const multiEntityScopePath: KnowledgeData = {
        scopePath: {
          entities: ['deeply', 'nested', 'entity'],
          scopes: [['level1', 'level2'], ['level3'], ['level4', 'level5', 'level6']]
        },
        content: 'Test content for complex scope path',
        metadata: {
          tags: ['test', 'complex'],
          createDate: new Date()
        }
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(multiEntityScopePath);

      // Assert
      const extendedResult = result as KnowledgeDataWithIdExtended;
      expect(extendedResult.scopePathString).toBe('deeply.nested.entity|level1.level2|level3|level4.level5.level6');
    }, 30000);
  });

  describe('index initialization', () => {
    it('should initialize index with correct mappings', async () => {
      // Delete the index first to ensure it gets recreated
      try {
        await client.indices.delete({ index: indexName });
      } catch (error) {
        // Index might not exist, which is fine
      }

      // Act
      await elasticsearchStorage.create_new_knowledge(testKnowledge);

      // Assert
      const indexMappings = await client.indices.getMapping({ index: indexName });
      const mappings = indexMappings[indexName].mappings;
      
      // Verify all expected mappings exist
      expect(mappings.properties).toHaveProperty('scopePath');
      expect(mappings.properties).toHaveProperty('scopePathString');
      expect(mappings.properties).toHaveProperty('content');
      expect(mappings.properties).toHaveProperty('metadata');
      expect(mappings.properties).toHaveProperty('id');
      expect(mappings.properties).toHaveProperty('createdAt');
      
      // Verify specific mapping types
      expect(mappings.properties?.scopePathString?.type).toBe('keyword');
      expect(mappings.properties?.content?.type).toBe('text');
      expect(mappings.properties?.id?.type).toBe('keyword');
      expect(mappings.properties?.createdAt?.type).toBe('date');
    }, 30000);

    it('should handle index already exists scenario gracefully', async () => {
      // Create a knowledge entry first to ensure index exists
      await elasticsearchStorage.create_new_knowledge(testKnowledge);

      // Act - This should not throw an error even though index already exists
      const result = await elasticsearchStorage.create_new_knowledge(testKnowledge2);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe(testKnowledge2.content);
    }, 30000);
  });

  describe('error handling in create_new_knowledge', () => {
    it('should handle ElasticSearch connection errors', async () => {
      // Create a new storage instance with invalid URL
      const invalidStorage = new ElasticsearchKnowledgeStorage('http://invalid-url:9200');
      
      // Act & Assert
      await expect(invalidStorage.create_new_knowledge(testKnowledge)).rejects.toThrow();
    }, 30000);

    it('should handle knowledge with special characters in content', async () => {
      const knowledgeWithSpecialChars: KnowledgeData = {
        ...testKnowledge,
        content: 'Content with special chars: áéíóú 中文 🚀 \n\t\r{}[]<>:"/\\|?*'
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(knowledgeWithSpecialChars);

      // Assert
      expect(result.content).toBe(knowledgeWithSpecialChars.content);
      
      // Verify it was stored correctly
      const knowledgeInEs = await client.get({
        index: indexName,
        id: result.id,
      }) as ElasticsearchKnowledgeResponse;
      
      expect(knowledgeInEs.found).toBe(true);
      expect((knowledgeInEs._source as any).content).toBe(knowledgeWithSpecialChars.content);
    }, 30000);

    it('should handle knowledge with very long scope paths', async () => {
      const longEntityName = 'a'.repeat(100); // 100 character entity name
      const longScopeName = 'b'.repeat(100); // 100 character scope name
      
      const knowledgeWithLongPaths: KnowledgeData = {
        scopePath: {
          entities: [longEntityName, 'normal', 'entity'],
          scopes: [[longScopeName, 'normal'], ['scope']]
        },
        content: 'Test content with long scope paths',
        metadata: {
          tags: ['test', 'long-paths'],
          createDate: new Date()
        }
      };

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(knowledgeWithLongPaths);

      // Assert
      expect(result.scopePath.entities[0]).toBe(longEntityName);
      expect(result.scopePath.scopes[0][0]).toBe(longScopeName);
      
      // Verify scopePathString was created correctly
      const extendedResult = result as KnowledgeDataWithIdExtended;
      expect(extendedResult.scopePathString).toContain(longEntityName);
      expect(extendedResult.scopePathString).toContain(longScopeName);
    }, 30000);
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent knowledge creation', async () => {
      const concurrentKnowledge = Array.from({ length: 10 }, (_, i) => ({
        ...testKnowledge,
        content: `Concurrent test knowledge ${i}`,
        metadata: {
          ...testKnowledge.metadata,
          tags: [`concurrent`, 'test', `${i}`]
        }
      }));

      // Act - Create 10 knowledge entries concurrently
      const results = await Promise.all(
        concurrentKnowledge.map(knowledge =>
          elasticsearchStorage.create_new_knowledge(knowledge)
        )
      );

      // Assert
      expect(results).toHaveLength(10);
      
      // Verify all IDs are unique
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
      
      // Verify all entries were stored correctly
      for (let i = 0; i < results.length; i++) {
        const knowledgeInEs = await client.get({
          index: indexName,
          id: results[i].id,
        });
        
        expect(knowledgeInEs.found).toBe(true);
        expect((knowledgeInEs._source as any).content).toBe(concurrentKnowledge[i].content);
      }
    }, 60000);
  });

  describe('performance tests', () => {
    it('should handle creation of large content efficiently', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB content
      const knowledgeWithLargeContent: KnowledgeData = {
        ...testKnowledge,
        content: largeContent
      };

      const startTime = Date.now();

      // Act
      const result = await elasticsearchStorage.create_new_knowledge(knowledgeWithLargeContent);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(result.content).toBe(largeContent);
      console.log(`Creation of 100KB content took ${duration}ms`);
      
      // Verify it was stored correctly
      const knowledgeInEs = await client.get({
        index: indexName,
        id: result.id,
      });
      
      expect(knowledgeInEs.found).toBe(true);
      expect((knowledgeInEs._source as any).content).toBe(largeContent);
      
      // Performance assertion - should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds
    }, 60000);
  });
});