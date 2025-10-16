import createLoggerWithPrefix from '../../lib/logger';
import { MongodbEntityContentStorage } from './mongodb-entity-content-storage';
import { MongodbKnowledgeContentStorage } from './mongodb-knowledge-content-storage';
import { MongodbKnowledgeVectorStorage } from './mongodb-knowledge-vector-storage';
import { MongoKnowledgeGraphStorage } from './mongodb-knowledge-graph-storage';
import {
  AbstractEntityStorage,
  AbstractKnowledgeStorage,
} from './abstract-storage';
import {
  EntityData,
  EntityDataWithId,
  KnowledgeData,
  KnowledgeDataWithId,
} from '../knowledge.type';
import Knowledge from '../Knowledge';

interface StorageConfig {
  // Configuration options for knowledgeBase storage
}

/**
 * Fuction:
 * 1. Store knowledge in specific format
 * 2. Implement agent-friendly searching & retrieving interface
 */
class KBStorage {
  private logger = createLoggerWithPrefix('KBStorage');

  constructor(
    public entityStorage: AbstractEntityStorage,
    public knowledgeStorage: AbstractKnowledgeStorage,
  ) {}

  /**
   * Store an entity in the knowledge base
   * @param entity The entity data to store
   * @returns Promise resolving to the stored entity with ID
   */
  async storeEntity(entity: EntityData): Promise<EntityDataWithId> {
    this.logger.info('Storing entity', { entityName: entity.name });
    return await this.entityStorage.create_new_entity(entity);
  }

  /**
   * Store knowledge in the knowledge base
   * @param knowledge The knowledge data to store
   * @param sourceId The ID of the source entity or knowledge
   * @returns Promise resolving to the stored knowledge with ID
   */
  async storeKnowledge(
    knowledge: KnowledgeData,
    sourceId: string,
  ): Promise<KnowledgeDataWithId> {
    this.logger.info('Storing knowledge', { scope: knowledge.scope, sourceId });
    return await this.knowledgeStorage.create_new_knowledge(
      knowledge,
      sourceId,
    );
  }

  /**
   * Retrieve knowledge by ID
   * @param knowledgeId The ID of the knowledge to retrieve
   * @returns Promise resolving to the Knowledge instance or null if not found
   */
  async getKnowledge(knowledgeId: string): Promise<Knowledge | null> {
    this.logger.info('Retrieving knowledge', { knowledgeId });
    return await this.knowledgeStorage.get_knowledge_by_id(knowledgeId);
  }

  /**
   * Initialize the knowledge base storage
   * @param config Configuration options for the storage
   */
  async initialize(config: StorageConfig = {}): Promise<void> {
    this.logger.info('Initializing KBStorage', { config });
    // Implementation would depend on specific storage requirements
  }

  /**
   * Get storage statistics
   * @returns Promise resolving to storage statistics
   */
  async getStorageStats(): Promise<{
    entityCount: number;
    knowledgeCount: number;
  }> {
    this.logger.info('Getting storage statistics');
    // This is a placeholder implementation
    return {
      entityCount: 0,
      knowledgeCount: 0,
    };
  }
}

export type { StorageConfig };
export {
  KBStorage,
  AbstractEntityStorage,
  MongodbEntityContentStorage,
  MongodbKnowledgeContentStorage,
  MongodbKnowledgeVectorStorage,
  MongoKnowledgeGraphStorage,
};
