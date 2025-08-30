import createLoggerWithPrefix from '../logger';
import { AbstractEntityStorage } from './abstract-storage';
import { EntityData } from '../knowledge.type';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Concrete implementation of EntityStorage using local file storage
 */
class LocalEntityStorage extends AbstractEntityStorage {
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

  private async readEntities(): Promise<EntityData[]> {
    try {
      const data = await fs.promises.readFile(this.entitiesFile, 'utf8');
      return JSON.parse(data) as EntityData[];
    } catch (error) {
      this.logger.error('Failed to read entities file:', error);
      return [];
    }
  }

  private async writeEntities(entities: EntityData[]): Promise<void> {
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
    return name.join('.');
  }

  async create_new_entity(entity: EntityData): Promise<EntityData> {
    try {
      const entities = await this.readEntities();
      const entityId = this.generateEntityId(entity.name);

      // Check if entity already exists
      const existingEntity = entities.find(
        (e) => this.generateEntityId(e.name) === entityId,
      );
      if (existingEntity) {
        throw new Error(`EntityData with name ${entityId} already exists`);
      }

      entities.push(entity);
      await this.writeEntities(entities);

      this.logger.info(`Created entity with name: ${entityId}`);
      return entity;
    } catch (error) {
      this.logger.error('Failed to create entity:', error);
      throw error;
    }
  }

  async get_entity_by_name(name: string[]): Promise<EntityData | null> {
    try {
      const entities = await this.readEntities();
      const entityId = this.generateEntityId(name);

      const entity = entities.find(
        (e) => this.generateEntityId(e.name) === entityId,
      );

      if (entity) {
        this.logger.info(`Found entity with name: ${entityId}`);
        return entity;
      }

      this.logger.warn(`EntityData with name ${entityId} not found`);
      return null;
    } catch (error) {
      this.logger.error('Failed to get entity by name:', error);
      throw error;
    }
  }

  async update_entity(entity: EntityData): Promise<EntityData> {
    try {
      const entities = await this.readEntities();
      const entityId = this.generateEntityId(entity.name);

      const index = entities.findIndex(
        (e) => this.generateEntityId(e.name) === entityId,
      );
      if (index === -1) {
        throw new Error(`EntityData with name ${entityId} not found`);
      }

      entities[index] = entity;
      await this.writeEntities(entities);

      this.logger.info(`Updated entity with name: ${entityId}`);
      return entity;
    } catch (error) {
      this.logger.error('Failed to update entity:', error);
      throw error;
    }
  }

  async delete_entity(name: string[]): Promise<boolean> {
    try {
      const entities = await this.readEntities();
      const entityId = this.generateEntityId(name);

      const initialLength = entities.length;
      const filteredEntities = entities.filter(
        (e) => this.generateEntityId(e.name) !== entityId,
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

      this.logger.info(
        `Found ${results.length} entities matching query: ${query}`,
      );
      return results;
    } catch (error) {
      this.logger.error('Failed to search entities:', error);
      throw error;
    }
  }

  async list_all_entities(): Promise<EntityData[]> {
    try {
      const entities = await this.readEntities();
      this.logger.info(`Listed ${entities.length} entities`);
      return entities;
    } catch (error) {
      this.logger.error('Failed to list all entities:', error);
      throw error;
    }
  }
}

export { LocalEntityStorage };
