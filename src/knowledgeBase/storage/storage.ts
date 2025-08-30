import createLoggerWithPrefix from '../logger';
import { MongodbEntityStorage } from './mongodb-entity-storage';
import { LocalEntityStorage } from './local-entity-storage';
import {
  AbstractPropertyStorage,
  AbstractEntityStorage,
} from './abstract-storage';
import { PropertyData, EntityData } from '../knowledge.type';

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

  constructor(
    entityStorage: AbstractEntityStorage,
    propertyStorage: AbstractPropertyStorage,
  ) {
    this.entityStorage = entityStorage;
    this.propertyStorage = propertyStorage;
  }
}

export type { KnowledgeStorageConfig };
export {
  KnowledgeStorage,
  AbstractPropertyStorage,
  AbstractEntityStorage,
  MongodbEntityStorage,
  LocalEntityStorage,
};
