import createLoggerWithPrefix from '../logger';
import { AbstractEntityContentStorage } from './abstract-storage';
import { EntityData, EntityDataWithId } from '../knowledge.type';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Concrete implementation of EntityStorage using local file storage
 */
class LocalEntityStorage extends AbstractEntityContentStorage {
  private storagePath: string;
  private entitiesFile: string;

  logger = createLoggerWithPrefix('LocalEntityStorage');

  constructor(storagePath: string = './data/entities') {
    super();
    this.storagePath = storagePath;
    this.entitiesFile = path.join(storagePath, 'entities.json');

    // Ensure directory exists
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    // Initialize entities file if it doesn't exist
    if (!fs.existsSync(this.entitiesFile)) {
      fs.writeFileSync(this.entitiesFile, JSON.stringify([], null, 2));
    }
  }

  private async readEntities(): Promise<EntityDataWithId[]> {
    try {
      const data = await fs.promises.readFile(this.entitiesFile, 'utf8');
      return JSON.parse(data) as EntityDataWithId[];
    } catch (error) {
      this.logger.error('Failed to read entities file:', error);
      return [];
    }
  }

  private async writeEntities(entities: EntityDataWithId[]): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.entitiesFile,
        JSON.stringify(entities, null, 2),
      );
    } catch (error) {
      this.logger.error('Failed to write entities file:', error);
      throw error;
    }
  }

  private generateEntityId(name: string[]): string {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async create_new_entity_content(entity: EntityData): Promise<EntityDataWithId> {
    try {
      const entities = await this.readEntities();
      const entityId = this.generateEntityId(entity.name);

      // Check if entity already exists
      const existingEntity = entities.find(
        (e) => e.id === entityId,
      );
      if (existingEntity) {
        throw new Error(`EntityData with ID ${entityId} already exists`);
      }

      const entityWithId = {
        ...entity,
        id: entityId,
      };

      entities.push(entityWithId);
      await this.writeEntities(entities);

      this.logger.info(`Created entity with ID: ${entityId}`);
      return entityWithId;
    } catch (error) {
      this.logger.error('Failed to create entity:', error);
      throw error;
    }
  }

  async get_entity_by_name(name: string[]): Promise<EntityDataWithId | null> {
    try {
      const entities = await this.readEntities();
      const entityName = name.join('.');

      const entity = entities.find(
        (e) => e.name.join('.') === entityName,
      );

      if (entity) {
        this.logger.info(`Found entity with name: ${entityName}`);
        return entity;
      }

      this.logger.warn(`EntityData with name ${entityName} not found`);
      return null;
    } catch (error) {
      this.logger.error('Failed to get entity by name:', error);
      throw error;
    }
  }

  async update_entity(old_entity: EntityDataWithId, new_entity_data: EntityData): Promise<EntityDataWithId> {
    try {
      const entities = await this.readEntities();

      const index = entities.findIndex(
        (e) => e.id === old_entity.id,
      );
      if (index === -1) {
        throw new Error(`EntityData with ID ${old_entity.id} not found`);
      }

      const updatedEntity = {
        ...new_entity_data,
        id: old_entity.id,
      };

      entities[index] = updatedEntity;
      await this.writeEntities(entities);

      this.logger.info(`Updated entity with ID: ${old_entity.id}`);
      return updatedEntity;
    } catch (error) {
      this.logger.error('Failed to update entity:', error);
      throw error;
    }
  }

  async get_entity_by_id(id: string): Promise<EntityDataWithId | null> {
    try {
      const entities = await this.readEntities();

      const entity = entities.find(
        (e) => e.id === id,
      );

      if (entity) {
        this.logger.info(`Found entity with ID: ${id}`);
        return entity;
      }

      this.logger.warn(`EntityData with ID ${id} not found`);
      return null;
    } catch (error) {
      this.logger.error('Failed to get entity by ID:', error);
      throw error;
    }
  }

  async delete_entity_by_id(id: string): Promise<boolean> {
    try {
      const entities = await this.readEntities();

      const initialLength = entities.length;
      const filteredEntities = entities.filter(
        (e) => e.id !== id,
      );

      if (filteredEntities.length === initialLength) {
        this.logger.warn(
          `EntityData with ID ${id} not found for deletion`,
        );
        return false;
      }

      await this.writeEntities(filteredEntities);
      this.logger.info(`Deleted entity with ID: ${id}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete entity:', error);
      throw error;
    }
  }

  async delete_entity(name: string[]): Promise<boolean> {
    try {
      const entities = await this.readEntities();
      const entityId = this.generateEntityId(name);

      const initialLength = entities.length;
      const filteredEntities = entities.filter(
        (e) => e.id !== entityId,
      );

      if (filteredEntities.length === initialLength) {
        this.logger.warn(
          `EntityData with name ${entityId} not found for deletion`,
        );
        return false;
      }

      await this.writeEntities(filteredEntities);
      this.logger.info(`Deleted entity with name: ${entityId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete entity:', error);
      throw error;
    }
  }

  async search_entities(query: string): Promise<EntityData[]> {
    try {
      const entities = await this.readEntities();
      const searchRegex = new RegExp(query, 'i');

      const results = entities.filter(
        (entity) =>
          searchRegex.test(entity.name.join('.')) ||
          entity.tags.some((tag) => searchRegex.test(tag)) ||
          searchRegex.test(entity.definition),
      );

      // Remove id field before returning
      const sanitizedResults = results.map(
        ({ id, ...entityData }) => entityData as EntityData,
      );

      this.logger.info(
        `Found ${sanitizedResults.length} entities matching query: ${query}`,
      );
      return sanitizedResults;
    } catch (error) {
      this.logger.error('Failed to search entities:', error);
      throw error;
    }
  }

  async list_all_entities(): Promise<EntityData[]> {
    try {
      const entities = await this.readEntities();
      // Remove id field before returning
      const sanitizedEntities = entities.map(
        ({ id, ...entityData }) => entityData as EntityData,
      );
      this.logger.info(`Listed ${sanitizedEntities.length} entities`);
      return sanitizedEntities;
    } catch (error) {
      this.logger.error('Failed to list all entities:', error);
      throw error;
    }
  }
}

export { LocalEntityStorage };
