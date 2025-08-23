import createLoggerWithPrefix from "../logger";
import {  MongodbEntityStorage } from "./mongodb-entity-storage";
import {  LocalEntityStorage } from "./local-entity-storage";

/**
 * 实体为一个"点"，通过以下多个坐标对其进行定位
 */
interface entity {
  name: string[];
  tags: string[];
  definition: string;
}

interface property {
  name: string[];
  content: string;
}

interface KnowledgeStorageConfig {
  // Configuration options for knowledge storage
  storagePath?: string;
  maxEntities?: number;
}

/**
 * Fuction:
 * 1. Store knowledge in specific format
 * 2. Implement agent-friendly searching & retrieving interface
 */
class KnowledgeStorage {
  entityStorage: AbstractEntityStorage;
  propertyStorage: AbstractPropertyStorage;

  constructor(entityStorage: AbstractEntityStorage, propertyStorage: AbstractPropertyStorage) {
    this.entityStorage = entityStorage;
    this.propertyStorage = propertyStorage;
  }
}



/**
 * Abstract base class for PropertyStorage to decouple from specific database implementations
 */
abstract class AbstractPropertyStorage {
  abstract create_property(property: property): Promise<property>;
  abstract get_property_by_name(name: string[]): Promise<property | null>;
  abstract update_property(property: property): Promise<property>;
  abstract delete_property(name: string[]): Promise<boolean>;
  abstract search_properties(query: string): Promise<property[]>;
  abstract list_all_properties(): Promise<property[]>;
}

/**
 * Abstract base class for EntityStorage to decouple from specific database implementations
 */
abstract class AbstractEntityStorage {
  abstract create_new_entity(entity: entity): Promise<entity>;
  abstract get_entity_by_name(name: string[]): Promise<entity | null>;
  abstract update_entity(entity: entity): Promise<entity>;
  abstract delete_entity(name: string[]): Promise<boolean>;
  abstract search_entities(query: string): Promise<entity[]>;
  abstract list_all_entities(): Promise<entity[]>;
}


export type { entity, property, KnowledgeStorageConfig };
export { KnowledgeStorage, AbstractPropertyStorage, AbstractEntityStorage, MongodbEntityStorage, LocalEntityStorage };

