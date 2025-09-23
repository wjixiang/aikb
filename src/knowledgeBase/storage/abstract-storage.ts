import {
  EntityData,
  EntityDataWithId,
  KnowledgeData,
  KnowledgeDataWithId,
} from '../knowledge.type';
import Knowledge from '../Knowledge';

/**
 * Abstract base class for EntityStorage to decouple from specific database implementations
 */
export abstract class AbstractEntityStorage {
  abstract create_new_entity(entity: EntityData): Promise<EntityDataWithId>;
}

export abstract class AbstractEntityContentStorage {
  abstract create_new_entity(entity: EntityData): Promise<EntityDataWithId>;
  abstract get_entity_by_name(name: string[]): Promise<EntityDataWithId | null>;
  abstract get_entity_by_id(id: string): Promise<EntityDataWithId | null>;
  abstract update_entity(entity: EntityDataWithId): Promise<EntityDataWithId>;
  abstract delete_entity(name: string[]): Promise<boolean>;
  abstract delete_entity_by_id(id: string): Promise<boolean>;
  abstract search_entities(query: string): Promise<EntityData[]>;
  abstract list_all_entities(): Promise<EntityData[]>;
}



export abstract class AbstractKnowledgeStorage {
  abstract knowledgeContentStorage: AbstractKnowledgeContentStorage;
  abstract knowledgeGraphStorage: AbstractKnowledgeGraphStorage;

  /**
   * Create new knowledge in storage
   * @param knowledge Knowledge data to create
   * @param sourceId ID of source Entity/Knowledge, both objects will be treated equally in graph storage.
   */
  abstract create_new_knowledge(
    knowledge: KnowledgeData,
    sourceId: string,
  ): Promise<KnowledgeDataWithId>;

  /**
   * Create a Knowledge instance from KnowledgeDataWithId with resolved children
   * @param knowledgeData The KnowledgeDataWithId to convert
   * @param childKnowledge Array of child Knowledge instances (resolved from childKnowledgeId)
   * @returns Promise resolving to a Knowledge instance
   */
  abstract create_knowledge_instance(
    knowledgeData: KnowledgeDataWithId,
    childKnowledge?: Knowledge[],
  ): Promise<Knowledge>;

  /**
   * Resolve child knowledge IDs into actual Knowledge instances
   * @param childKnowledgeIds Array of child knowledge IDs to resolve
   * @returns Promise resolving to an array of Knowledge instances
   */
  abstract resolve_child_knowledge(
    childKnowledgeIds: string[],
  ): Promise<Knowledge[]>;

  /**
   * Get a single knowledge instance by ID
   * @param knowledgeId The ID of the knowledge to retrieve
   * @returns Promise resolving to a Knowledge instance or null if not found
   */
  abstract get_knowledge_by_id(knowledgeId: string): Promise<Knowledge | null>;

  /**
   * Process KnowledgeDataWithId into a complete Knowledge instance with resolved children
   * @param knowledgeData The KnowledgeDataWithId to process
   * @returns Promise resolving to a complete Knowledge instance with all children resolved
   */
  abstract process_knowledge_with_children(
    knowledgeData: KnowledgeDataWithId,
  ): Promise<Knowledge>;
}

export abstract class AbstractKnowledgeContentStorage {
  abstract create_new_knowledge_content(
    knowledge: KnowledgeData,
  ): Promise<KnowledgeDataWithId>;
}

export abstract class AbstractKnowledgeGraphStorage {
  abstract create_new_link(sourceId: string, targetId: string): Promise<void>;
}
