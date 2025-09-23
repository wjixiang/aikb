import createLoggerWithPrefix from '../../lib/logger';
import { MongodbEntityContentStorage } from './mongodb-entity-content-storage';
import { AbstractEntityStorage } from './abstract-storage';

interface StorageConfig {
  // Configuration options for knowledge storage
  storagePath?: string;
  maxEntities?: number;
}

/**
 * Fuction:
 * 1. Store knowledge in specific format
 * 2. Implement agent-friendly searching & retrieving interface
 */
class Storage {
  entityStorage: AbstractEntityStorage;

  constructor(entityStorage: AbstractEntityStorage) {
    this.entityStorage = entityStorage;
  }
}

export type { StorageConfig };
export { Storage, AbstractEntityStorage, MongodbEntityContentStorage };
