import createLoggerWithPrefix from '../lib/logger';
import { MongodbEntityContentStorage } from './mongodb-entity-content-storage';
import {
  AbstractEntityStorage,
  AbstractKnowledgeStorage,
} from './abstract-storage';

interface StorageConfig {
  // Configuration options for knowledgeBase storage
}

/**
 * Fuction:
 * 1. Store knowledge in specific format
 * 2. Implement agent-friendly searching & retrieving interface
 */
class KBStorage {
  constructor(
    public entityStorage: AbstractEntityStorage,
    public knowledgeStorage: AbstractKnowledgeStorage,
  ) {}
}

export type { StorageConfig };
export { KBStorage, AbstractEntityStorage, MongodbEntityContentStorage };
