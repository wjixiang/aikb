import createLoggerWithPrefix from '../logger';
import { MongodbEntityStorage } from './mongodb-entity-storage';
import { LocalEntityStorage } from './local-entity-storage';
import {
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

  constructor(
    entityStorage: AbstractEntityStorage,
  ) {
    this.entityStorage = entityStorage;
  }
}

export type { KnowledgeStorageConfig };
export {
  KnowledgeStorage,
  AbstractEntityStorage,
  MongodbEntityStorage,
  LocalEntityStorage,
};
