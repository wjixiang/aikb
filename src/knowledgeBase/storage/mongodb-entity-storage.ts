import createLoggerWithPrefix from "../logger";
import MongoDBConnection from "../database/mongodb";
import { ObjectId } from "mongodb";
import { AbstractEntityStorage } from "./storage";

/**
 * 实体为一个"点"，通过以下多个坐标对其进行定位
 */
interface entity {
  name: string[];
  tags: string[];
  definition: string;
}


/**
 * Concrete implementation of EntityStorage using MongoDB
 */
class MongodbEntityStorage extends AbstractEntityStorage {
    private dbConnection: MongoDBConnection;
    private collectionName = 'entities';
    
    logger = createLoggerWithPrefix("MongodbEntityStorage")

    constructor(dbConnection: MongoDBConnection){
      super()
      this.dbConnection = dbConnection;
    }
 
    async create_new_entity(entity: entity): Promise<entity> {
      try {
        const db = await this.dbConnection.connect();
        const collection = db.collection(this.collectionName);
        
        // Convert name array to a string for unique indexing
        const entityName = entity.name.join('.');
        const entityWithId = { ...entity, _id: new ObjectId(entityName) };
        
        const result = await collection.insertOne(entityWithId);
        this.logger.info(`Created entity with _id: ${result.insertedId}`);
        
        return entity;
      } catch (error) {
        this.logger.error('Failed to create entity:', error);
        throw error;
      }
    }
  
    async get_entity_by_name(name: string[]): Promise<entity | null> {
      try {
        const db = await this.dbConnection.connect();
        const collection = db.collection(this.collectionName);
        
        const entityName = name.join('.');
        const entity = await collection.findOne({ _id: new ObjectId(entityName) });
        
        if (entity) {
          // Remove MongoDB-specific _id field before returning
          const { _id, ...entityData } = entity;
          return entityData as entity;
        }
        
        return null;
      } catch (error) {
        this.logger.error('Failed to get entity by name:', error);
        throw error;
      }
    }
  
    async update_entity(entity: entity): Promise<entity> {
      try {
        const db = await this.dbConnection.connect();
        const collection = db.collection(this.collectionName);
        
        const entityName = entity.name.join('.');
        const updateResult = await collection.replaceOne(
          { _id: new ObjectId(entityName) },
          { ...entity, _id: new ObjectId(entityName) }
        );
        
        if (updateResult.modifiedCount === 0) {
          throw new Error(`Entity with name ${entityName} not found`);
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
        const db = await this.dbConnection.connect();
        const collection = db.collection(this.collectionName);
        
        const entityName = name.join('.');
        const deleteResult = await collection.deleteOne({ _id: new ObjectId(entityName) });
        
        if (deleteResult.deletedCount === 0) {
          this.logger.warn(`Entity with name ${entityName} not found for deletion`);
          return false;
        }
        
        this.logger.info(`Deleted entity with name: ${entityName}`);
        return true;
      } catch (error) {
        this.logger.error('Failed to delete entity:', error);
        throw error;
      }
    }
  
    async search_entities(query: string): Promise<entity[]> {
      try {
        const db = await this.dbConnection.connect();
        const collection = db.collection(this.collectionName);
        
        // Search in name, tags, and definition fields
        const searchRegex = new RegExp(query, 'i');
        const entities = await collection.find({
          $or: [
            { name: { $regex: searchRegex } },
            { tags: { $regex: searchRegex } },
            { definition: { $regex: searchRegex } }
          ]
        }).toArray();
        
        // Remove MongoDB-specific _id field before returning
        const result = entities.map(({ _id, ...entityData }) => entityData as entity);
        
        this.logger.info(`Found ${result.length} entities matching query: ${query}`);
        return result as entity[];
      } catch (error) {
        this.logger.error('Failed to search entities:', error);
        throw error;
      }
    }
  
    async list_all_entities(): Promise<entity[]> {
      try {
        const db = await this.dbConnection.connect();
        const collection = db.collection(this.collectionName);
        
        const entities = await collection.find({}).toArray();
        
        // Remove MongoDB-specific _id field before returning
        const result = entities.map(({ _id, ...entityData }) => entityData as entity);
        
        this.logger.info(`Listed ${result.length} entities`);
        return result as entity[];
      } catch (error) {
        this.logger.error('Failed to list all entities:', error);
        throw error;
      }
    }
}

export type { entity };
export { AbstractEntityStorage, MongodbEntityStorage };