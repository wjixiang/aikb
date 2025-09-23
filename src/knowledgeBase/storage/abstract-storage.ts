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
  static generate_entity_id() {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  abstract entityContentStorage: AbstractEntityContentStorage;
  abstract entityGraphStorage: AbstractEntityGraphStorage;
  abstract entityVectorStorage: AbstractEntityVectorStorage;
  abstract create_new_entity(entity: EntityData): Promise<EntityDataWithId>;
}

export abstract class AbstractEntityContentStorage {
  abstract create_new_entity_content(
    entity: EntityData,
    id: string,
  ): Promise<EntityDataWithId>;
  abstract get_entity_by_name(name: string[]): Promise<EntityDataWithId | null>;
  abstract get_entity_by_id(id: string): Promise<EntityDataWithId | null>;
  abstract update_entity(
    old_entity: EntityDataWithId,
    new_entity_data: EntityData,
  ): Promise<EntityDataWithId>;
  abstract delete_entity_by_id(id: string): Promise<boolean>;
  abstract search_entities(query: string): Promise<EntityData[]>;
  abstract list_all_entities(): Promise<EntityData[]>;
}

export abstract class AbstractEntityGraphStorage {
  /**
   * Create a relationship between two entities
   * @param sourceId ID of the source entity
   * @param targetId ID of the target entity
   * @param relationType Type of relationship
   * @param properties Additional properties of the relationship
   */
  abstract create_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>,
  ): Promise<void>;

  /**
   * Get all relations for an entity
   * @param entityId ID of the entity
   * @param relationType Optional filter by relation type
   * @returns Promise resolving to array of relations
   */
  abstract get_entity_relations(
    entityId: string,
    relationType?: string,
  ): Promise<
    Array<{
      sourceId: string;
      targetId: string;
      relationType: string;
      properties?: Record<string, any>;
    }>
  >;

  /**
   * Update a relation between entities
   * @param sourceId ID of the source entity
   * @param targetId ID of the target entity
   * @param relationType Type of relationship
   * @param properties Updated properties of the relationship
   */
  abstract update_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties: Record<string, any>,
  ): Promise<void>;

  /**
   * Delete a relation between entities
   * @param sourceId ID of the source entity
   * @param targetId ID of the target entity
   * @param relationType Type of relationship
   */
  abstract delete_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
  ): Promise<boolean>;

  /**
   * Find paths between two entities
   * @param sourceId ID of the source entity
   * @param targetId ID of the target entity
   * @param maxDepth Maximum depth to search
   * @returns Promise resolving to array of paths
   */
  abstract find_paths(
    sourceId: string,
    targetId: string,
    maxDepth?: number,
  ): Promise<
    Array<
      Array<{
        entityId: string;
        relationType: string;
      }>
    >
  >;
}

export abstract class AbstractEntityVectorStorage {
  /**
   * Store vector for an entity
   * @param entityId ID of the entity
   * @param vector Vector data to store
   * @param metadata Optional metadata associated with the vector
   */
  abstract store_vector(
    entityId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void>;

  /**
   * Get vector for an entity
   * @param entityId ID of the entity
   * @returns Promise resolving to vector data and metadata or null if not found
   */
  abstract get_vector(entityId: string): Promise<{
    vector: number[];
    metadata?: Record<string, any>;
  } | null>;

  /**
   * Update vector for an entity
   * @param entityId ID of the entity
   * @param vector Updated vector data
   * @param metadata Updated metadata
   */
  abstract update_vector(
    entityId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void>;

  /**
   * Delete vector for an entity
   * @param entityId ID of the entity
   */
  abstract delete_vector(entityId: string): Promise<boolean>;

  /**
   * Find similar vectors
   * @param vector Query vector
   * @param limit Maximum number of results
   * @param threshold Similarity threshold (0-1)
   * @returns Promise resolving to array of similar entities with similarity scores
   */
  abstract find_similar_vectors(
    vector: number[],
    limit?: number,
    threshold?: number,
  ): Promise<
    Array<{
      entityId: string;
      similarity: number;
      metadata?: Record<string, any>;
    }>
  >;

  /**
   * Batch store vectors for multiple entities
   * @param vectors Array of entity vectors to store
   */
  abstract batch_store_vectors(
    vectors: Array<{
      entityId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>,
  ): Promise<void>;
}

export abstract class AbstractKnowledgeStorage {
  abstract knowledgeContentStorage: AbstractKnowledgeContentStorage;
  abstract knowledgeGraphStorage: AbstractKnowledgeGraphStorage;
  abstract knowledgeVectorStorage: AbstractKnowledgeVectorStorage;

  static generate_knowledge_id() {
    return `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

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
  abstract get_knowledge_content_by_id(id: string): Promise<KnowledgeDataWithId>
}

export abstract class AbstractKnowledgeGraphStorage {
  abstract create_new_link(sourceId: string, targetId: string): Promise<void>;
}

export abstract class AbstractKnowledgeVectorStorage {
  /**
   * Store vector for knowledge
   * @param knowledgeId ID of the knowledge
   * @param vector Vector data to store
   * @param metadata Optional metadata associated with the vector
   */
  abstract store_knowledge_vector(
    knowledgeId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void>;

  /**
   * Get vector for knowledge
   * @param knowledgeId ID of the knowledge
   * @returns Promise resolving to vector data and metadata or null if not found
   */
  abstract get_knowledge_vector(knowledgeId: string): Promise<{
    vector: number[];
    metadata?: Record<string, any>;
  } | null>;

  /**
   * Update vector for knowledge
   * @param knowledgeId ID of the knowledge
   * @param vector Updated vector data
   * @param metadata Updated metadata
   */
  abstract update_knowledge_vector(
    knowledgeId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void>;

  /**
   * Delete vector for knowledge
   * @param knowledgeId ID of the knowledge
   */
  abstract delete_knowledge_vector(knowledgeId: string): Promise<boolean>;

  /**
   * Find similar knowledge vectors
   * @param vector Query vector
   * @param limit Maximum number of results
   * @param threshold Similarity threshold (0-1)
   * @returns Promise resolving to array of similar knowledge items with similarity scores
   */
  abstract find_similar_knowledge_vectors(
    vector: number[],
    limit?: number,
    threshold?: number,
  ): Promise<
    Array<{
      knowledgeId: string;
      similarity: number;
      metadata?: Record<string, any>;
    }>
  >;

  /**
   * Batch store knowledge vectors
   * @param vectors Array of knowledge vectors to store
   */
  abstract batch_store_knowledge_vectors(
    vectors: Array<{
      knowledgeId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>,
  ): Promise<void>;
}
