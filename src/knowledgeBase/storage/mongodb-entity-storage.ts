import createLoggerWithPrefix from '../logger';
import { connectToDatabase } from '../database/mongodb';
import { AbstractEntityStorage } from './abstract-storage';
import { EntityData, EntityDataWithId } from '../knowledge.type';

/**
 * Concrete implementation of EntityStorage using MongoDB
 */
class MongodbEntityStorage extends AbstractEntityStorage {
  private collectionName = 'entities';

  logger = createLoggerWithPrefix('MongodbEntityStorage');

  async create_new_entity(entity: EntityData): Promise<EntityDataWithId> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Convert name array to a string for unique indexing
      const entityName = entity.name.join('.');
      const entityWithId = { ...entity, entityName };

      const result = await collection.insertOne(entityWithId);
      this.logger.info(
        `Created entity with _id: ${JSON.stringify(result.insertedId)}`,
      );

      return {...entity, id: result.insertedId.toString()};
    } catch (error) {
      this.logger.error('Failed to create entity:', error);
      throw error;
    }
  }

  async get_entity_by_name(name: string[]): Promise<EntityData | null> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const entityName = name.join('.');
      const entity = await collection.findOne({
        entityName,
      });

      if (entity) {
        // Remove MongoDB-specific _id and entityName fields before returning
        const { _id, entityName, ...entityData } = entity;
        return entityData as EntityData;
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get entity by name:', error);
      throw error;
    }
  }

  async update_entity(entity: EntityData): Promise<EntityData> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const entityName = entity.name.join('.');
      const updateResult = await collection.replaceOne(
        { entityName },
        { ...entity, entityName },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`EntityData with name ${entityName} not found`);
      }

      this.logger.info(`Updated entity with name: ${entityName}`);
      return entity;
    } catch (error) {
      this.logger.error('Failed to update entity:', error);
      throw error;
    }
  }

  async delete_entity(name: string[]): Promise<boolean> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const entityName = name.join('.');
      const deleteResult = await collection.deleteOne({
        entityName,
      });

      if (deleteResult.deletedCount === 0) {
        this.logger.warn(
          `EntityData with name ${entityName} not found for deletion`,
        );
        return false;
      }

      this.logger.info(`Deleted entity with name: ${entityName}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete entity:', error);
      throw error;
    }
  }

  async search_entities(query: string): Promise<EntityData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Search in entityName, tags, and definition fields
      const searchRegex = new RegExp(query, 'i');
      const entities = await collection
        .find({
          $or: [
            { entityName: { $regex: searchRegex } },
            { tags: { $regex: searchRegex } },
            { definition: { $regex: searchRegex } },
          ],
        })
        .toArray();

      // Remove MongoDB-specific _id and entityName fields before returning
      const result = entities.map(
        ({ _id, entityName, ...entityData }) => entityData as EntityData,
      );

      this.logger.info(
        `Found ${result.length} entities matching query: ${query}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to search entities:', error);
      throw error;
    }
  }

  async list_all_entities(): Promise<EntityData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const entities = await collection.find({}).toArray();

      // Remove MongoDB-specific _id and entityName fields before returning
      const result = entities.map(
        ({ _id, entityName, ...entityData }) => entityData as EntityData,
      );

      this.logger.info(`Listed ${result.length} entities`);
      return result;
    } catch (error) {
      this.logger.error('Failed to list all entities:', error);
      throw error;
    }
  }
}

export { MongodbEntityStorage };
