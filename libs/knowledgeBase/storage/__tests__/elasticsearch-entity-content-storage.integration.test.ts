import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ElasticsearchEntityContentStorage } from '../elasticsearch-entity-content-storage';
import { Client } from '@elastic/elasticsearch';
import { EntityData, EntityDataWithId } from '../../knowledge.type';
import * as dotenv from 'dotenv';

dotenv.config();

// Helper function to check if ElasticSearch is available
async function isElasticSearchAvailable(url: string): Promise<boolean> {
  const client = new Client({
    node: url,
    auth: {
      apiKey:
        process.env.ELASTICSEARCH_API_KEY ||
        'X2xNeEM1a0JuWUJ6SHhoMlBSNTI6d3d3NXZGM2J0NjJqVHhjN29RZEp1UQ==',
    },
  });
  try {
    await client.ping();
    await client.close();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

describe('ElasticsearchEntityContentStorage Integration Tests', () => {
  let elasticsearchStorage: ElasticsearchEntityContentStorage;
  let client: Client;
  const indexName = 'entities';
  let elasticSearchAvailable = false;

  it('should connect to elasticSearch', async () => {
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200';
    console.info(`esUrl: ${esUrl}`);
    elasticSearchAvailable = await isElasticSearchAvailable(esUrl);
    expect(elasticSearchAvailable).toBe(true);
  });
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

  // Expected result with ID (what the storage methods actually return)
  const expectedTestEntityWithId: EntityDataWithId = {
    ...testEntity,
    id: 'test.entity',
  };

  const expectedTestEntity2WithId: EntityDataWithId = {
    ...testEntity2,
    id: 'another.entity',
  };

  beforeAll(async () => {
    // Connect to ElasticSearch
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';

    // Check if ElasticSearch is available
    elasticSearchAvailable = await isElasticSearchAvailable(esUrl);

    if (!elasticSearchAvailable) {
      console.log('ElasticSearch is not available, skipping integration tests');
      return;
    }

    client = new Client({
      node: esUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_API_KEY || '',
      },
    });

    // Create storage instance
    elasticsearchStorage = new ElasticsearchEntityContentStorage(esUrl);

    // Wait for ElasticSearch to be ready with retries
    let isConnected = false;
    let retries = 10;
    while (!isConnected && retries > 0) {
      try {
        await client.ping();
        isConnected = true;
        console.log('Connected to ElasticSearch');
      } catch (error) {
        console.log(
          `ElasticSearch not ready, retrying... (${retries} attempts left)`,
        );
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!isConnected) {
      throw new Error(
        'Failed to connect to ElasticSearch after multiple attempts',
      );
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

  describe('create_new_entity_content', () => {
    it('should create a new entity successfully', async () => {
      // Arrange
      const entityId = 'test.entity.id';

      // Act
      const result = await elasticsearchStorage.create_new_entity_content(
        testEntity,
        entityId,
      );
      console.log(result);
      // Assert
      expect(result).toEqual({ ...expectedTestEntityWithId, id: entityId });

      // Verify entity was actually inserted into ElasticSearch
      const entityInEs = await client.get({
        index: indexName,
        id: entityId,
      });

      expect(entityInEs.found).toBe(true);
      expect((entityInEs._source as any)?.name).toEqual(testEntity.name);
      expect((entityInEs._source as any)?.tags).toEqual(testEntity.tags);
      expect((entityInEs._source as any)?.definition).toEqual(
        testEntity.definition,
      );
    }, 30000);

    it('should update entity if it already exists (ElasticSearch behavior)', async () => {
      // Arrange - Insert entity directly to ElasticSearch
      const entityId = 'test.entity.id';
      await client.index({
        index: indexName,
        id: entityId,
        body: {
          ...testEntity,
          nameString: 'test.entity',
          createdAt: new Date().toISOString(),
        },
      });

      // Act
      const result = await elasticsearchStorage.create_new_entity_content(
        testEntity,
        entityId,
      );

      // Assert
      expect(result).toEqual({ ...expectedTestEntityWithId, id: entityId });

      // Verify entity was actually updated in ElasticSearch
      const entityInEs = await client.get({
        index: indexName,
        id: entityId,
      });

      expect(entityInEs.found).toBe(true);
      expect((entityInEs._source as any)?.name).toEqual(testEntity.name);
    }, 30000);
  });

  describe('get_entity_by_name', () => {
    it('should get an entity by name successfully', async () => {
      // Arrange - Insert entity directly to ElasticSearch
      await client.index({
        index: indexName,
        id: 'test.entity',
        body: {
          ...testEntity,
          nameString: 'test.entity',
          createdAt: new Date().toISOString(),
        },
      });

      // Act
      const result = await elasticsearchStorage.get_entity_by_name([
        'test',
        'entity',
      ]);

      // Assert
      expect(result).toEqual(expectedTestEntityWithId);
    }, 30000);

    it('should return null if entity is not found', async () => {
      // Act
      const result = await elasticsearchStorage.get_entity_by_name([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update_entity', () => {
    it('should update an entity successfully', async () => {
      // Arrange - Insert entity directly to ElasticSearch
      const entityId = 'test.entity';
      await client.index({
        index: indexName,
        id: entityId,
        body: {
          ...testEntity,
          nameString: 'test.entity',
          createdAt: new Date().toISOString(),
        },
      });

      const oldEntity = {
        id: entityId,
        ...testEntity,
      };

      const newEntityData = {
        ...testEntity,
        tags: ['updated', 'tags'],
        definition: 'Updated definition',
      };

      // Act
      const result = await elasticsearchStorage.update_entity(
        oldEntity,
        newEntityData,
      );

      // Assert
      expect(result).toEqual({
        ...newEntityData,
        id: entityId,
      });

      // Verify entity was actually updated in ElasticSearch
      const entityInEs = await client.get({
        index: indexName,
        id: entityId,
      });

      expect(entityInEs.found).toBe(true);
      expect((entityInEs._source as any)?.tags).toEqual(newEntityData.tags);
      expect((entityInEs._source as any)?.definition).toEqual(
        newEntityData.definition,
      );
    }, 30000);

    it('should create entity if it does not exist (ElasticSearch behavior)', async () => {
      const oldEntity = {
        id: 'new.entity',
        name: ['new', 'entity'],
        tags: ['new', 'creation'],
        definition: 'A new entity for testing',
      };

      const newEntityData = {
        name: ['new', 'entity'],
        tags: ['new', 'creation'],
        definition: 'A new entity for testing',
      };

      // Act
      const result = await elasticsearchStorage.update_entity(
        oldEntity,
        newEntityData,
      );

      // Assert
      expect(result).toEqual(oldEntity);

      // Verify entity was actually created in ElasticSearch
      const entityInEs = await client.get({
        index: indexName,
        id: 'new.entity',
      });

      expect(entityInEs.found).toBe(true);
      expect((entityInEs._source as any)?.name).toEqual(newEntityData.name);
      expect((entityInEs._source as any)?.tags).toEqual(newEntityData.tags);
      expect((entityInEs._source as any)?.definition).toEqual(
        newEntityData.definition,
      );
    }, 30000);
  });

  describe('delete_entity', () => {
    it('should delete an entity successfully', async () => {
      // Arrange - Insert entity directly to ElasticSearch
      await client.index({
        index: indexName,
        id: 'test.entity',
        body: {
          ...testEntity,
          nameString: 'test.entity',
          createdAt: new Date().toISOString(),
        },
      });

      // Refresh the index to make sure the document is available
      await client.indices.refresh({ index: indexName });

      // Act
      const result = await elasticsearchStorage.delete_entity([
        'test',
        'entity',
      ]);

      // Assert
      expect(result).toBe(true);

      // Wait a bit to ensure deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify entity was actually deleted from ElasticSearch
      try {
        const entityInEs = await client.get({
          index: indexName,
          id: 'test.entity',
        });
        expect(entityInEs.found).toBe(false);
      } catch (error) {
        // If we get a 404, that means the entity was successfully deleted
        if (error?.meta?.statusCode === 404) {
          // This is expected behavior
        } else {
          throw error;
        }
      }
    }, 30000);

    it('should return false if entity is not found', async () => {
      // Act
      const result = await elasticsearchStorage.delete_entity([
        'non',
        'existent',
      ]);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('search_entities', () => {
    beforeEach(async () => {
      // Insert test entities
      await client.index({
        index: indexName,
        id: 'test.entity',
        body: {
          ...testEntity,
          nameString: 'test.entity',
          createdAt: new Date().toISOString(),
        },
      });

      await client.index({
        index: indexName,
        id: 'another.entity',
        body: {
          ...testEntity2,
          nameString: 'another.entity',
          createdAt: new Date().toISOString(),
        },
      });

      // Refresh the index to make sure documents are available for search
      await client.indices.refresh({ index: indexName });
    });

    it('should search entities by name', async () => {
      // Act
      const result = await elasticsearchStorage.search_entities('test');

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.name.join('.') === 'test.entity')).toBe(true);
    });

    it('should search entities by tags', async () => {
      // Act
      const result = await elasticsearchStorage.search_entities('integration');

      // Assert
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((e) => e.name.join('.') === 'test.entity')).toBe(true);
    });

    it('should search entities by definition', async () => {
      // Act
      const result = await elasticsearchStorage.search_entities(
        'integration testing',
      );

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array if no entities match', async () => {
      // Act
      const result = await elasticsearchStorage.search_entities('nonexistent');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('list_all_entities', () => {
    it('should list all entities successfully', async () => {
      // Arrange - Insert test entities
      await client.index({
        index: indexName,
        id: 'test.entity',
        body: {
          ...testEntity,
          nameString: 'test.entity',
          createdAt: new Date().toISOString(),
        },
      });

      await client.index({
        index: indexName,
        id: 'another.entity',
        body: {
          ...testEntity2,
          nameString: 'another.entity',
          createdAt: new Date().toISOString(),
        },
      });

      // Refresh the index to make sure documents are available for search
      await client.indices.refresh({ index: indexName });

      // Act
      const result = await elasticsearchStorage.list_all_entities();

      // Assert
      expect(result.length).toBe(2);
      expect(result.some((e) => e.name.join('.') === 'test.entity')).toBe(true);
      expect(result.some((e) => e.name.join('.') === 'another.entity')).toBe(
        true,
      );
    }, 30000);

    it('should return empty array if no entities exist', async () => {
      // Act
      const result = await elasticsearchStorage.list_all_entities();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('full CRUD workflow', () => {
    it('should support full CRUD operations', async () => {
      // Create
      const entityId = 'test.entity.crud';
      const createdEntity =
        await elasticsearchStorage.create_new_entity_content(
          testEntity,
          entityId,
        );
      expect(createdEntity).toEqual({
        ...expectedTestEntityWithId,
        id: entityId,
      });

      // Refresh the index to make sure the document is available
      await client.indices.refresh({ index: indexName });

      // Read
      const retrievedEntity = await elasticsearchStorage.get_entity_by_name([
        'test',
        'entity',
        'crud',
      ]);
      expect(retrievedEntity).toEqual({
        ...expectedTestEntityWithId,
        id: entityId,
      });

      // Update
      const oldEntity = {
        id: entityId,
        ...testEntity,
      };
      const newEntityData = {
        ...testEntity,
        tags: ['updated', 'tags'],
        definition: 'Updated definition',
      };

      // Expected entity after update
      const updatedEntity = {
        ...testEntity,
        tags: ['updated', 'tags'],
        definition: 'Updated definition',
      };
      await elasticsearchStorage.update_entity(oldEntity, newEntityData);

      // Refresh the index again after update
      await client.indices.refresh({ index: indexName });

      const retrievedUpdatedEntity =
        await elasticsearchStorage.get_entity_by_name([
          'test',
          'entity',
          'crud',
        ]);
      expect(retrievedUpdatedEntity).toEqual({
        ...updatedEntity,
        id: 'test.entity.crud',
      });

      // Delete
      const deleteResult = await elasticsearchStorage.delete_entity([
        'test',
        'entity',
        'crud',
      ]);
      expect(deleteResult).toBe(true);

      // Refresh the index after delete
      await client.indices.refresh({ index: indexName });

      const deletedEntity = await elasticsearchStorage.get_entity_by_name([
        'test',
        'entity',
        'crud',
      ]);
      expect(deletedEntity).toBeNull();
    }, 30000);
  });
});
