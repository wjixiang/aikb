import { Injectable } from '@nestjs/common';
import { EntityDBPrismaService, Prisma } from 'entity-db';
import { IEntityStorage, EntityData } from '../types';

@Injectable()
export class EntityStorageService implements IEntityStorage {
  constructor(private readonly prisma: EntityDBPrismaService) {}

  /**
   * Create a new entity
   * @param entity The entity data to create
   * @returns Promise resolving to created entity with generated ID
   */
  async create(entity: Omit<EntityData, 'id'>): Promise<EntityData> {
    // Create entity first without embedding
    const createdEntity = await this.prisma.entity.create({
      data: {
        description: entity.abstract.description,
        nomenclatures: {
          create: entity.nomenclature.map((nom) => ({
            name: nom.name,
            acronym: nom.acronym,
            language: nom.language,
          })),
        },
      },
      include: {
        nomenclatures: true,
        embedding: true,
      },
    });

    // If embedding exists, create it separately using raw SQL
    if (entity.abstract.embedding) {
      const vectorSize = JSON.stringify(
        entity.abstract.embedding.vector,
      ).length;
      console.log(
        `[DEBUG] Embedding vector size: ${vectorSize} bytes, dimensions: ${entity.abstract.embedding.config.dimension}`,
      );

      try {
        await this.prisma.$executeRaw`
          INSERT INTO embeddings (id, "entityId", model, dimension, "batchSize", "maxRetries", timeout, provider, vector)
          VALUES (${createdEntity.id}, ${createdEntity.id}, ${entity.abstract.embedding.config.model}, ${entity.abstract.embedding.config.dimension}, ${entity.abstract.embedding.config.batchSize || 32}, ${entity.abstract.embedding.config.maxRetries || 3}, ${entity.abstract.embedding.config.timeout || 30000}, ${entity.abstract.embedding.config.provider || 'default'}, ${JSON.stringify(entity.abstract.embedding.vector)}::vector)
        `;
      } catch (error) {
        console.error(
          `[DEBUG] Failed to insert embedding vector: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        console.error(
          `[DEBUG] Vector details: size=${vectorSize} bytes, dimensions=${entity.abstract.embedding.config.dimension}`,
        );
        throw error;
      }
    }

    // Fetch the complete entity with embedding
    const completeEntity = await this.prisma.entity.findUnique({
      where: { id: createdEntity.id },
      include: {
        nomenclatures: true,
        embedding: true,
      },
    });

    return this.mapPrismaEntityToEntityData(completeEntity!);
  }

  /**
   * Retrieve an entity by ID
   * @param id The entity ID
   * @returns Promise resolving to entity data or null if not found
   */
  async findById(id: string): Promise<EntityData | null> {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      include: {
        nomenclatures: true,
        embedding: true,
      },
    });

    return entity ? this.mapPrismaEntityToEntityData(entity) : null;
  }

  /**
   * Retrieve multiple entities by their IDs
   * @param ids Array of entity IDs
   * @returns Promise resolving to array of entities (null for not found entities)
   */
  async findByIds(ids: string[]): Promise<(EntityData | null)[]> {
    const entities = await this.prisma.entity.findMany({
      where: { id: { in: ids } },
      include: {
        nomenclatures: true,
        embedding: true,
      },
    });

    const entityMap = new Map(
      entities.map((e) => [e.id, this.mapPrismaEntityToEntityData(e)]),
    );

    return ids.map((id) => entityMap.get(id) || null);
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
    const updateData: any = {};

    if (updates.abstract?.description) {
      updateData.description = updates.abstract.description;
    }

    if (updates.nomenclature) {
      updateData.nomenclatures = {
        deleteMany: {},
        create: updates.nomenclature.map((nom) => ({
          name: nom.name,
          acronym: nom.acronym,
          language: nom.language,
        })),
      };
    }

    if (updates.abstract?.embedding) {
      // Handle embedding update separately with raw SQL
      await this.prisma.$executeRaw`
        INSERT INTO embeddings (id, "entityId", model, dimension, "batchSize", "maxRetries", timeout, provider, vector)
        VALUES (gen_random_uuid(), ${id}, ${updates.abstract.embedding.config.model}, ${updates.abstract.embedding.config.dimension}, ${updates.abstract.embedding.config.batchSize || 32}, ${updates.abstract.embedding.config.maxRetries || 3}, ${updates.abstract.embedding.config.timeout || 30000}, ${updates.abstract.embedding.config.provider || 'default'}, ${JSON.stringify(updates.abstract.embedding.vector)}::vector)
        ON CONFLICT ("entityId")
        DO UPDATE SET
          model = EXCLUDED.model,
          dimension = EXCLUDED.dimension,
          "batchSize" = EXCLUDED."batchSize",
          "maxRetries" = EXCLUDED."maxRetries",
          timeout = EXCLUDED.timeout,
          provider = EXCLUDED.provider,
          vector = EXCLUDED.vector
      `;
    }

    try {
      const updatedEntity = await this.prisma.entity.update({
        where: { id },
        data: updateData,
        include: {
          nomenclatures: true,
          embedding: true,
        },
      });

      return this.mapPrismaEntityToEntityData(updatedEntity);
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete an entity by ID
   * @param id The entity ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.entity.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
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
      limit?: number | string;
      offset?: number | string;
      language?: 'en' | 'zh';
    },
  ): Promise<EntityData[]> {
    const where: any = {
      OR: [
        {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          nomenclatures: {
            some: {
              name: {
                contains: query,
                mode: 'insensitive',
              },
              ...(options?.language && { language: options.language }),
            },
          },
        },
      ],
    };

    const entities = await this.prisma.entity.findMany({
      where,
      take: options?.limit ? parseInt(options.limit.toString(), 10) : 50,
      skip: options?.offset ? parseInt(options.offset.toString(), 10) : 0,
      include: {
        nomenclatures: true,
        embedding: true,
      },
    });

    return entities.map((entity) => this.mapPrismaEntityToEntityData(entity));
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
    // For now, return empty array as vector similarity search requires pgvector extension
    // This would need to be implemented with raw SQL queries using pgvector operators
    return [];
  }

  /**
   * Get all entities with pagination
   * @param options Pagination options
   * @returns Promise resolving to paginated entities and total count
   */
  async findAll(options?: {
    limit?: number | string;
    offset?: number | string;
  }): Promise<{ entities: EntityData[]; total: number }> {
    const [entities, total] = await Promise.all([
      this.prisma.entity.findMany({
        take: options?.limit ? parseInt(options.limit.toString(), 10) : 50,
        skip: options?.offset ? parseInt(options.offset.toString(), 10) : 0,
        include: {
          nomenclatures: true,
          embedding: true,
        },
      }),
      this.prisma.entity.count(),
    ]);

    return {
      entities: entities.map((entity) =>
        this.mapPrismaEntityToEntityData(entity),
      ),
      total,
    };
  }

  /**
   * Check if an entity exists
   * @param id The entity ID
   * @returns Promise resolving to true if entity exists
   */
  async exists(id: string): Promise<boolean> {
    const entity = await this.prisma.entity.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!entity;
  }

  /**
   * Map Prisma Entity to EntityData format
   * @param entity Prisma Entity with relations
   * @returns EntityData
   */
  private mapPrismaEntityToEntityData(entity: any): EntityData {
    return {
      id: entity.id,
      nomenclature: entity.nomenclatures.map((nom: any) => ({
        name: nom.name,
        acronym: nom.acronym,
        language: nom.language as 'en' | 'zh',
      })),
      abstract: {
        description: entity.description,
        ...(entity.embedding && {
          embedding: {
            config: {
              model: entity.embedding.model,
              dimension: entity.embedding.dimension,
              batchSize: entity.embedding.batchSize,
              maxRetries: entity.embedding.maxRetries,
              timeout: entity.embedding.timeout,
              provider: entity.embedding.provider,
            },
            vector: Array.isArray(entity.embedding.vector)
              ? entity.embedding.vector
              : [],
          },
        }),
      },
    };
  }
}
