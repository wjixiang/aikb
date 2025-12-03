import { Injectable } from '@nestjs/common';
import { IEntityStorage, EntityData } from '../types';

/**
 * In-memory implementation of IEntityStorage for testing and development purposes.
 * This implementation stores entities in a simple Map structure.
 */
@Injectable()
export class EntityStorageMemoryService implements IEntityStorage {
  private entities: Map<string, EntityData> = new Map();

  /**
   * Create a new entity
   * @param entity The entity data to create
   * @returns Promise resolving to the created entity with generated ID
   */
  async create(entity: Omit<EntityData, 'id'>): Promise<EntityData> {
    const newEntity: EntityData = {
      id: this.generateId(),
      ...entity,
    };

    this.entities.set(newEntity.id, newEntity);
    return newEntity;
  }

  /**
   * Retrieve an entity by ID
   * @param id The entity ID
   * @returns Promise resolving to the entity data or null if not found
   */
  async findById(id: string): Promise<EntityData | null> {
    const entity = this.entities.get(id);
    return entity ? { ...entity } : null;
  }

  /**
   * Retrieve multiple entities by their IDs
   * @param ids Array of entity IDs
   * @returns Promise resolving to array of entities (null for not found entities)
   */
  async findByIds(ids: string[]): Promise<(EntityData | null)[]> {
    return ids.map((id) => {
      const entity = this.entities.get(id);
      return entity ? { ...entity } : null;
    });
  }

  /**
   * Update an existing entity
   * @param id The entity ID to update
   * @param updates Partial entity data to update
   * @returns Promise resolving to the updated entity or null if not found
   */
  async update(
    id: string,
    updates: Partial<Omit<EntityData, 'id'>>,
  ): Promise<EntityData | null> {
    const existingEntity = this.entities.get(id);
    if (!existingEntity) {
      return null;
    }

    const updatedEntity: EntityData = {
      ...existingEntity,
      ...updates,
      id, // Ensure ID doesn't change
    };

    this.entities.set(id, updatedEntity);
    return { ...updatedEntity };
  }

  /**
   * Delete an entity by ID
   * @param id The entity ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return this.entities.delete(id);
  }

  /**
   * Search entities by text query
   * @param query The search query
   * @param options Optional search parameters
   * @returns Promise resolving to array of matching entities
   */
  async search(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      language?: 'en' | 'zh';
    },
  ): Promise<EntityData[]> {
    const { limit = 50, offset = 0, language } = options || {};
    const lowerQuery = query.toLowerCase();

    let results = Array.from(this.entities.values()).filter((entity) => {
      // Filter by language if specified
      if (
        language &&
        !entity.nomenclature.some((n) => n.language === language)
      ) {
        return false;
      }

      // Search in nomenclature names and descriptions
      const nameMatch = entity.nomenclature.some(
        (n) =>
          n.name.toLowerCase().includes(lowerQuery) ||
          (n.acronym && n.acronym.toLowerCase().includes(lowerQuery)),
      );

      const descriptionMatch = entity.abstract.description
        .toLowerCase()
        .includes(lowerQuery);

      return nameMatch || descriptionMatch;
    });

    // Apply pagination
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedResults = results.slice(startIndex, endIndex);

    return paginatedResults.map((entity) => ({ ...entity }));
  }

  /**
   * Find entities by similarity using vector embedding
   * @param vector The embedding vector to compare against
   * @param options Optional search parameters
   * @returns Promise resolving to array of similar entities with similarity scores
   */
  async findBySimilarity(
    vector: number[],
    options?: {
      limit?: number;
      threshold?: number;
    },
  ): Promise<Array<{ entity: EntityData; similarity: number }>> {
    const { limit = 10, threshold = 0.5 } = options || {};

    const similarities = Array.from(this.entities.values())
      .filter(
        (entity) =>
          entity.abstract.embedding && entity.abstract.embedding.vector,
      ) // Only include entities with embeddings
      .map((entity) => {
        const similarity = this.cosineSimilarity(
          vector,
          entity.abstract.embedding!.vector,
        );
        return { entity: { ...entity }, similarity };
      })
      .filter((item) => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities;
  }

  /**
   * Get all entities with pagination
   * @param options Pagination options
   * @returns Promise resolving to paginated entities and total count
   */
  async findAll(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ entities: EntityData[]; total: number }> {
    const { limit = 50, offset = 0 } = options || {};

    const allEntities = Array.from(this.entities.values());
    const total = allEntities.length;

    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedEntities = allEntities.slice(startIndex, endIndex);

    return {
      entities: paginatedEntities.map((entity) => ({ ...entity })),
      total,
    };
  }

  /**
   * Check if an entity exists
   * @param id The entity ID
   * @returns Promise resolving to true if entity exists
   */
  async exists(id: string): Promise<boolean> {
    return this.entities.has(id);
  }

  /**
   * Generate a unique ID for entities
   * @returns A unique ID string
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vecA First vector
   * @param vecB Second vector
   * @returns Cosine similarity score (0-1)
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Clear all entities (useful for testing)
   */
  clear(): void {
    this.entities.clear();
  }

  /**
   * Get the current number of stored entities
   * @returns Number of entities
   */
  count(): number {
    return this.entities.size;
  }
}
