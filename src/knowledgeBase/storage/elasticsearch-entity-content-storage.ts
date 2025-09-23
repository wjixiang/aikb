/* eslint-disable @typescript-eslint/no-unsafe-argument */
import createLoggerWithPrefix from '../../lib/logger';
import { Client } from '@elastic/elasticsearch';
import { AbstractEntityContentStorage } from './abstract-storage';
import {
  EntityData,
  EntityDataWithId,
  ElasticsearchEntityResponse,
} from '../knowledge.type';

/**
 * Concrete implementation of EntityStorage using ElasticSearch
 */
class ElasticsearchEntityContentStorage extends AbstractEntityContentStorage {
  private readonly indexName = 'entities';
  private client: Client;

  logger = createLoggerWithPrefix('ElasticsearchEntityContentStorage');

  constructor(elasticsearchUrl: string = 'http://localhost:9200') {
    super();
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
  }

  /**
   * Initialize the index with proper mappings
   */
  private async initializeIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
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
          } as any,
        });
        this.logger.info(`Created index: ${this.indexName}`);
      }
    } catch (error) {
      // If index already exists, just continue
      if (
        error?.meta?.body?.error?.type === 'resource_already_exists_exception'
      ) {
        this.logger.info(`Index ${this.indexName} already exists, continuing`);
        return;
      }
      this.logger.error('Failed to initialize index:', error);
      throw error;
    }
  }

  async create_new_entity_content(
    entity: EntityData,
    id: string,
  ): Promise<EntityDataWithId> {
    try {
      await this.initializeIndex();

      const entityName = entity.name.join('.');
      // Use the provided ID instead of generating from name
      const entityId = id;

      const entityWithId = {
        ...entity,
        nameString: entityName,
        createdAt: new Date().toISOString(),
      };

      await this.client.index({
        index: this.indexName,
        id: entityId,
        body: entityWithId,
      });

      this.logger.info(`Created entity with ID: ${entityId}`);
      return {
        ...entity,
        id: entityId,
      };
    } catch (error) {
      this.logger.error('Failed to create entity:', error);
      throw error;
    }
  }

  async get_entity_by_name(name: string[]): Promise<EntityDataWithId | null> {
    try {
      const entityName = name.join('.');

      const result = (await this.client.get({
        index: this.indexName,
        id: entityName,
      })) as ElasticsearchEntityResponse;

      if (result.found) {
        const { _index, _id, _source } = result;
        const entityData = {
          id: _id,
          name: _source.name,
          tags: _source.tags,
          definition: _source.definition,
        };
        this.logger.info(`Found entity with name: ${entityName}`);
        return entityData;
      }

      this.logger.warn(`Entity with name ${entityName} not found`);
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(`Entity with name not found: ${name.join('.')}`);
        return null;
      }
      this.logger.error('Failed to get entity by name:', error);
      throw error;
    }
  }

  async get_entity_by_id(id: string): Promise<EntityDataWithId | null> {
    try {
      const result = (await this.client.get({
        index: this.indexName,
        id: id,
      })) as ElasticsearchEntityResponse;

      if (result.found) {
        const { _index, _id, _source } = result;
        const entityData = {
          id: _id,
          name: _source.name,
          tags: _source.tags,
          definition: _source.definition,
        };
        this.logger.info(`Found entity with ID: ${id}`);
        return entityData;
      }

      this.logger.warn(`Entity with ID ${id} not found`);
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(`Entity with ID not found: ${id}`);
        return null;
      }
      this.logger.error('Failed to get entity by ID:', error);
      throw error;
    }
  }

  async update_entity(
    old_entity: EntityDataWithId,
    new_entity_data: EntityData,
  ): Promise<EntityDataWithId> {
    try {
      const entityName = old_entity.name.join('.');
      const entityId = old_entity.id;

      // First check if the entity exists
      let currentEntity;
      try {
        const result = (await this.client.get({
          index: this.indexName,
          id: entityId,
        })) as ElasticsearchEntityResponse;
        currentEntity = result._source;
      } catch (error) {
        if (error?.meta?.statusCode === 404) {
          // Entity doesn't exist, create it and return the EntityDataWithId
          const createdEntity = await this.create_new_entity_content(
            new_entity_data,
            old_entity.id,
          );
          return createdEntity;
        }
        throw error;
      }

      // Use the current version to avoid version conflicts
      const result = await this.client.update({
        index: this.indexName,
        id: entityId,
        body: {
          doc: {
            ...new_entity_data,
            nameString: entityName,
            updatedAt: new Date().toISOString(),
          },
        } as any,
      });

      if (result.result === 'noop') {
        throw new Error(`Entity with ID ${entityId} not found`);
      }

      this.logger.info(`Updated entity with ID: ${entityId}`);
      return {
        ...new_entity_data,
        id: entityId,
      };
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        // Entity doesn't exist, create it and return the EntityDataWithId
        const createdEntity = await this.create_new_entity_content(
          new_entity_data,
          old_entity.id,
        );
        return createdEntity;
      }
      this.logger.error('Failed to update entity:', error);
      throw error;
    }
  }

  async delete_entity(name: string[]): Promise<boolean> {
    try {
      const entityName = name.join('.');

      const result = await this.client.delete({
        index: this.indexName,
        id: entityName,
      });

      if (result.result === 'not_found') {
        this.logger.warn(
          `Entity with name ${entityName} not found for deletion`,
        );
        return false;
      }

      this.logger.info(`Deleted entity with name: ${entityName}`);
      return true;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(
          `Entity with name ${name.join('.')} not found for deletion`,
        );
        return false;
      }
      this.logger.error('Failed to delete entity:', error);
      throw error;
    }
  }

  async delete_entity_by_id(id: string): Promise<boolean> {
    try {
      const result = await this.client.delete({
        index: this.indexName,
        id: id,
      });

      if (result.result === 'not_found') {
        this.logger.warn(`Entity with ID ${id} not found for deletion`);
        return false;
      }

      this.logger.info(`Deleted entity with ID: ${id}`);
      return true;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(`Entity with ID ${id} not found for deletion`);
        return false;
      }
      this.logger.error('Failed to delete entity:', error);
      throw error;
    }
  }

  async search_entities(query: string): Promise<EntityData[]> {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            multi_match: {
              query: query,
              fields: ['name', 'tags', 'definition'],
              fuzziness: 'AUTO',
            },
          },
        } as any,
      });

      const hits = result.hits.hits;
      const entities = hits.map((hit) => {
        const { _source } = hit;
        return {
          name: (_source as any).name,
          tags: (_source as any).tags,
          definition: (_source as any).definition,
        };
      });

      this.logger.info(
        `Found ${entities.length} entities matching query: ${query}`,
      );
      return entities;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        this.logger.info('Index does not exist, returning empty array');
        return [];
      }
      this.logger.error('Failed to search entities:', error);
      throw error;
    }
  }

  async list_all_entities(): Promise<EntityData[]> {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            match_all: {},
          },
          size: 10000, // Adjust based on expected number of entities
        },
      } as any);

      const hits = result.hits.hits;
      const entities = hits.map((hit) => {
        const { _source } = hit;
        return {
          name: (_source as any).name,
          tags: (_source as any).tags,
          definition: (_source as any).definition,
        };
      });

      this.logger.info(`Listed ${entities.length} entities`);
      return entities;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        this.logger.info('Index does not exist, returning empty array');
        return [];
      }
      this.logger.error('Failed to list all entities:', error);
      throw error;
    }
  }
}

export { ElasticsearchEntityContentStorage };
