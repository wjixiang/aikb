import {
  AbstractEntityContentStorage,
  AbstractEntityGraphStorage,
  AbstractEntityVectorStorage,
} from '../storage/abstract-storage';
import { EntityData, EntityDataWithId } from '../knowledge.type';

/**
 * Mock implementation of EntityContentStorage for testing and examples
 */
export class MockEntityContentStorage extends AbstractEntityContentStorage {
  private entities: Map<string, EntityDataWithId> = new Map();

  async create_new_entity_content(
    entity: EntityData,
    id: string,
  ): Promise<EntityDataWithId> {
    const entityWithId = { ...entity, id };
    this.entities.set(id, entityWithId);
    return entityWithId;
  }

  async get_entity_by_name(name: string[]): Promise<EntityDataWithId | null> {
    for (const entity of this.entities.values()) {
      if (JSON.stringify(entity.name) === JSON.stringify(name)) {
        return entity;
      }
    }
    return null;
  }

  async get_entity_by_id(id: string): Promise<EntityDataWithId | null> {
    return this.entities.get(id) || null;
  }

  async update_entity(
    oldEntity: EntityDataWithId,
    newEntityData: EntityData,
  ): Promise<EntityDataWithId> {
    const updatedEntity = { ...newEntityData, id: oldEntity.id };
    this.entities.set(oldEntity.id, updatedEntity);
    return updatedEntity;
  }

  async delete_entity_by_id(id: string): Promise<boolean> {
    return this.entities.delete(id);
  }

  async search_entities(query: string): Promise<EntityData[]> {
    // Simple mock implementation - returns all entities containing the query
    const results: EntityData[] = [];
    for (const entity of this.entities.values()) {
      if (
        entity.name.some((name) =>
          name.toLowerCase().includes(query.toLowerCase()),
        ) ||
        entity.definition.toLowerCase().includes(query.toLowerCase()) ||
        entity.tags.some((tag) =>
          tag.toLowerCase().includes(query.toLowerCase()),
        )
      ) {
        const { id, ...entityData } = entity;
        results.push(entityData);
      }
    }
    return results;
  }

  async list_all_entities(): Promise<EntityData[]> {
    const results: EntityData[] = [];
    for (const entity of this.entities.values()) {
      const { id, ...entityData } = entity;
      results.push(entityData);
    }
    return results;
  }

  // Helper method for testing
  clear(): void {
    this.entities.clear();
  }

  // Helper method for testing
  count(): number {
    return this.entities.size;
  }
}

/**
 * Mock implementation of EntityGraphStorage for testing and examples
 */
export class MockEntityGraphStorage extends AbstractEntityGraphStorage {
  private relations: Array<{
    sourceId: string;
    targetId: string;
    relationType: string;
    properties?: Record<string, any>;
  }> = [];

  async create_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties?: Record<string, any>,
  ): Promise<void> {
    this.relations.push({
      sourceId,
      targetId,
      relationType,
      properties,
    });
  }

  async get_entity_relations(
    entityId: string,
    relationType?: string,
  ): Promise<
    Array<{
      sourceId: string;
      targetId: string;
      relationType: string;
      properties?: Record<string, any>;
    }>
  > {
    return this.relations.filter(
      (r) =>
        (r.sourceId === entityId || r.targetId === entityId) &&
        (!relationType || r.relationType === relationType),
    );
  }

  async update_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
    properties: Record<string, any>,
  ): Promise<void> {
    const relation = this.relations.find(
      (r) =>
        r.sourceId === sourceId &&
        r.targetId === targetId &&
        r.relationType === relationType,
    );
    if (relation) {
      relation.properties = properties;
    }
  }

  async delete_relation(
    sourceId: string,
    targetId: string,
    relationType: string,
  ): Promise<boolean> {
    const index = this.relations.findIndex(
      (r) =>
        r.sourceId === sourceId &&
        r.targetId === targetId &&
        r.relationType === relationType,
    );
    if (index !== -1) {
      this.relations.splice(index, 1);
      return true;
    }
    return false;
  }

  async find_paths(
    sourceId: string,
    targetId: string,
    maxDepth?: number,
  ): Promise<Array<Array<{ entityId: string; relationType: string }>>> {
    // Simple mock implementation - returns empty array
    // In a real implementation, this would use graph traversal algorithms
    return [];
  }

  // Helper method for testing
  clear(): void {
    this.relations = [];
  }

  // Helper method for testing
  count(): number {
    return this.relations.length;
  }
}

/**
 * Mock implementation of EntityVectorStorage for testing and examples
 */
export class MockEntityVectorStorage extends AbstractEntityVectorStorage {
  private vectors: Map<
    string,
    {
      vector: number[];
      metadata?: Record<string, any>;
    }
  > = new Map();

  async store_vector(
    entityId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    this.vectors.set(entityId, { vector, metadata });
  }

  async get_vector(entityId: string): Promise<{
    vector: number[];
    metadata?: Record<string, any>;
  } | null> {
    return this.vectors.get(entityId) || null;
  }

  async update_vector(
    entityId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    this.vectors.set(entityId, { vector, metadata });
  }

  async delete_vector(entityId: string): Promise<boolean> {
    return this.vectors.delete(entityId);
  }

  async find_similar_vectors(
    vector: number[],
    limit?: number,
    threshold?: number,
  ): Promise<
    Array<{
      entityId: string;
      similarity: number;
      metadata?: Record<string, any>;
    }>
  > {
    // Simple mock implementation - returns empty array
    // In a real implementation, this would use vector similarity algorithms
    return [];
  }

  async batch_store_vectors(
    vectors: Array<{
      entityId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>,
  ): Promise<void> {
    for (const v of vectors) {
      this.vectors.set(v.entityId, { vector: v.vector, metadata: v.metadata });
    }
  }

  // Helper method for testing
  clear(): void {
    this.vectors.clear();
  }

  // Helper method for testing
  count(): number {
    return this.vectors.size;
  }
}

/**
 * Factory function to create mock storage implementations
 */
export function createMockStorages() {
  return {
    contentStorage: new MockEntityContentStorage(),
    graphStorage: new MockEntityGraphStorage(),
    vectorStorage: new MockEntityVectorStorage(),
  };
}

/**
 * Helper function to create test entity data
 */
export function createTestEntityData(
  overrides: Partial<EntityData> = {},
): EntityData {
  return {
    name: ['Test Entity'],
    tags: ['test'],
    definition: 'This is a test entity for demonstration purposes.',
    ...overrides,
  };
}

/**
 * Helper function to create test vector
 */
export function createTestVector(dimension: number = 1536): number[] {
  return Array.from({ length: dimension }, () => Math.random() - 0.5);
}
