import { Injectable, Inject } from '@nestjs/common';
import { wikiPrismaService } from 'wiki-db';
import { CreateEntityInput, UpdateEntityInput, DeleteEntityInput, Entity, EntityWhereInput, Nomenclature, NomenclatureInput, SemanticSearchInput } from '../graphql';
import { EmbeddingService } from 'EmbeddingModule';

// Define a custom injection token
export const WIKI_PRISMA_SERVICE_TOKEN = Symbol('wikiPrismaService');

@Injectable()
export class EntityService {

    constructor(
        @Inject(WIKI_PRISMA_SERVICE_TOKEN)
        private storageService: wikiPrismaService,
        private embeddingService: EmbeddingService,
    ) { }

    /**
     * Get a single entity based on filter criteria
     * @param filter - The filter criteria to match entities
     * @returns The first matching entity or null if no match found
     */
    async getEntity(filter: EntityWhereInput): Promise<Entity | null> {
        const prismaFilter = this.convertToPrismaWhere(filter);
        const entity = await this.storageService.entity.findFirst({
            where: prismaFilter,
            include: {
                nomenclatures: true
            }
        });
        return entity ? this.convertToGraphQLEntity(entity) : null;
    }

    /**
     * Get all entities based on filter criteria
     * @param filter - The filter criteria to match entities
     * @returns Array of matching entities
     */
    async getEntities(filter: EntityWhereInput): Promise<Entity[]> {

        // Identify semantic search query
        if (filter.definition_semantic_search) {
            return this.performSemanticSearch(filter.definition_semantic_search);
        } else {
            const prismaFilter = this.convertToPrismaWhere(filter);
            const entities = await this.storageService.entity.findMany({
                where: prismaFilter,
                include: {
                    nomenclatures: true
                }
            });
            return entities.map(e => this.convertToGraphQLEntity(e));
        }
    }

    /**
     * Perform semantic search on entity definitions
     * @param semanticSearchInput - The semantic search parameters
     * @returns Array of matching entities ordered by similarity
     */
    private async performSemanticSearch(
        semanticSearchInput: SemanticSearchInput
    ): Promise<Entity[]> {
        // Generate embedding for the search query
        const embeddingResult = await this.embeddingService.embed({
            text: semanticSearchInput.searchText,
        });

        if (!embeddingResult.success || !embeddingResult.embedding) {
            throw new Error(
                `Failed to generate embedding: ${embeddingResult.error || 'Unknown error'}`
            );
        }

        const searchVector = embeddingResult.embedding;
        const topK = semanticSearchInput.topK ?? 10;
        const threshold = semanticSearchInput.threshold ?? 0.0;

        // Convert searchVector to PostgreSQL vector format
        const vectorString = `[${searchVector.join(',')}]`;

        try {
            // Use pgvector's <=> operator for cosine similarity with raw SQL
            // The <=> operator returns the cosine distance (1 - cosine similarity)
            // So we use 1 - (embedding <=> query) to get cosine similarity
            const results = (await this.storageService.$queryRawUnsafe(
                `
                SELECT
                    e.id,
                    e.definition,
                    1 - (ee.vector <=> $1::vector) as similarity
                FROM entities e
                INNER JOIN "EntityEmbedding" ee ON e.id = ee."entityId"
                WHERE 1 - (ee.vector <=> $1::vector) >= $2
                ORDER BY similarity DESC
                LIMIT $3
            `,
                vectorString,
                threshold,
                topK,
            )) as any[];

            if (results.length === 0) {
                return [];
            }

            // Fetch full entity data with nomenclatures for all matching IDs
            const entityIds = results.map((r) => r.id);
            const entities = await this.storageService.entity.findMany({
                where: {
                    id: { in: entityIds },
                },
                include: {
                    nomenclatures: true,
                },
            });

            // Sort entities by similarity score from the search results
            const entityMap = new Map(
                entities.map((e) => [e.id, this.convertToGraphQLEntity(e)])
            );

            return results
                .map((r) => entityMap.get(r.id))
                .filter((e): e is Entity => e !== undefined);
        } catch (error) {
            console.error('Error in semantic search:', error);
            throw error;
        }
    }

    /**
     * Create a new entity
     * @param input - The input data for creating the entity
     * @returns The newly created entity
     */
    async createEntity(input: CreateEntityInput): Promise<Entity> {
        const newEntity = await this.storageService.entity.create({
            data: {
                definition: input.definition,
                nomenclatures: {
                    create: input.nomenclature.map(n => ({
                        name: n.name,
                        acronym: n.acronym,
                        language: n.language
                    }))
                }
            },
            include: {
                nomenclatures: true
            }
        });
        return this.convertToGraphQLEntity(newEntity);
    }

    /**
     * Update an existing entity
     * @param input - The input data for updating the entity
     * @returns The updated entity
     */
    async updateEntity(input: UpdateEntityInput): Promise<Entity> {
        // First, fetch the entity before updating to check if it exists
        const existingEntity = await this.storageService.entity.findUnique({
            where: { id: input.entityId },
            include: { nomenclatures: true }
        });

        if (!existingEntity) {
            throw new Error(`Entity with id ${input.entityId} not found`);
        }

        // Prepare update data
        const updateData: any = {};

        if (input.definition !== undefined) {
            updateData.definition = input.definition;
        }

        // If nomenclature is provided, we need to update the nomenclatures
        if (input.nomenclature !== undefined && input.nomenclature !== null) {
            // Delete all existing nomenclatures
            await this.storageService.nomenclature.deleteMany({
                where: { entityId: input.entityId }
            });

            // Create new nomenclatures
            updateData.nomenclatures = {
                create: input.nomenclature.filter((n): n is NomenclatureInput => n !== null).map(n => ({
                    name: n.name,
                    acronym: n.acronym ?? null,
                    language: n.language
                }))
            };
        }

        // Update the entity
        const updatedEntity = await this.storageService.entity.update({
            where: { id: input.entityId },
            data: updateData,
            include: { nomenclatures: true }
        });

        return this.convertToGraphQLEntity(updatedEntity);
    }

    /**
     * Delete an entity
     * @param input - The input data for deleting the entity
     * @returns The deleted entity
     */
    async deleteEntity(input: DeleteEntityInput): Promise<Entity> {
        // First, fetch the entity before deletion to return it
        const entity = await this.storageService.entity.findUnique({
            where: { id: input.entityId },
            include: { nomenclatures: true }
        });

        if (!entity) {
            throw new Error(`Entity with id ${input.entityId} not found`);
        }

        // Delete the entity (Prisma will handle cascading deletes for related nomenclatures)
        await this.storageService.entity.delete({
            where: { id: input.entityId }
        });

        return this.convertToGraphQLEntity(entity);
    }

    /**
     * Convert GraphQL filter to Prisma where clause
     * @param filter - The GraphQL filter input
     * @returns Prisma where clause
     */
    private convertToPrismaWhere(filter: EntityWhereInput): any {
        if (!filter) {
            return {};
        }

        const where: any = {};

        // Handle NOT operator
        if (filter.NOT) {
            where.NOT = this.convertToPrismaWhere(filter.NOT);
        }

        // Handle AND operator
        if (filter.AND && filter.AND.length > 0) {
            where.AND = filter.AND.map(f => this.convertToPrismaWhere(f));
        }

        // Handle OR operator
        if (filter.OR && filter.OR.length > 0) {
            where.OR = filter.OR.map(f => this.convertToPrismaWhere(f));
        }

        // Filter by id
        if (filter.id !== undefined && filter.id !== null) {
            where.id = filter.id;
        }

        // Filter by id_in
        if (filter.id_in && filter.id_in.length > 0) {
            where.id = { in: filter.id_in };
        }

        // Filter by id_not_in
        if (filter.id_not_in && filter.id_not_in.length > 0) {
            where.id = { notIn: filter.id_not_in };
        }

        // Filter by definition
        if (filter.definition !== undefined && filter.definition !== null) {
            where.definition = filter.definition;
        }

        // Filter by definition_contains
        if (filter.definition_contains !== undefined && filter.definition_contains !== null) {
            where.definition = { contains: filter.definition_contains, mode: 'insensitive' };
        }

        // Filter by definition_starts_with
        if (filter.definition_starts_with !== undefined && filter.definition_starts_with !== null) {
            where.definition = { startsWith: filter.definition_starts_with, mode: 'insensitive' };
        }

        // Filter by definition_ends_with
        if (filter.definition_ends_with !== undefined && filter.definition_ends_with !== null) {
            where.definition = { endsWith: filter.definition_ends_with, mode: 'insensitive' };
        }

        // Filter by definition_in
        if (filter.definition_in && filter.definition_in.length > 0) {
            where.definition = { in: filter.definition_in };
        }

        // Filter by definition_not_in
        if (filter.definition_not_in && filter.definition_not_in.length > 0) {
            where.definition = { notIn: filter.definition_not_in };
        }

        // Filter by nomenclature (exact match on at least one nomenclature)
        if (filter.nomenclature) {
            where.nomenclatures = { some: this.convertNomenclatureFilter(filter.nomenclature) };
        }

        // Filter by nomenclature_some (at least one nomenclature matches)
        if (filter.nomenclature_some) {
            where.nomenclatures = { some: this.convertNomenclatureFilter(filter.nomenclature_some) };
        }

        // Filter by nomenclature_every (all nomenclatures match)
        if (filter.nomenclature_every) {
            where.nomenclatures = { every: this.convertNomenclatureFilter(filter.nomenclature_every) };
        }

        // Filter by nomenclature_none (no nomenclature matches)
        if (filter.nomenclature_none) {
            where.nomenclatures = { none: this.convertNomenclatureFilter(filter.nomenclature_none) };
        }

        return where;
    }

    /**
     * Convert GraphQL nomenclature filter to Prisma nomenclature filter
     * @param filter - The nomenclature filter criteria
     * @returns Prisma nomenclature filter
     */
    private convertNomenclatureFilter(filter: any): any {
        const where: any = {};

        // Handle NOT operator
        if (filter.NOT) {
            where.NOT = this.convertNomenclatureFilter(filter.NOT);
        }

        // Handle AND operator
        if (filter.AND && filter.AND.length > 0) {
            where.AND = filter.AND.map((f: any) => this.convertNomenclatureFilter(f));
        }

        // Handle OR operator
        if (filter.OR && filter.OR.length > 0) {
            where.OR = filter.OR.map((f: any) => this.convertNomenclatureFilter(f));
        }

        // Filter by name
        if (filter.name !== undefined && filter.name !== null) {
            where.name = filter.name;
        }

        // Filter by name_contains
        if (filter.name_contains !== undefined && filter.name_contains !== null) {
            where.name = { contains: filter.name_contains, mode: 'insensitive' };
        }

        // Filter by name_starts_with
        if (filter.name_starts_with !== undefined && filter.name_starts_with !== null) {
            where.name = { startsWith: filter.name_starts_with, mode: 'insensitive' };
        }

        // Filter by name_ends_with
        if (filter.name_ends_with !== undefined && filter.name_ends_with !== null) {
            where.name = { endsWith: filter.name_ends_with, mode: 'insensitive' };
        }

        // Filter by name_in
        if (filter.name_in && filter.name_in.length > 0) {
            where.name = { in: filter.name_in };
        }

        // Filter by name_not_in
        if (filter.name_not_in && filter.name_not_in.length > 0) {
            where.name = { notIn: filter.name_not_in };
        }

        // Filter by acronym
        if (filter.acronym !== undefined && filter.acronym !== null) {
            where.acronym = filter.acronym;
        }

        // Filter by acronym_contains
        if (filter.acronym_contains !== undefined && filter.acronym_contains !== null) {
            where.acronym = { contains: filter.acronym_contains, mode: 'insensitive' };
        }

        // Filter by acronym_starts_with
        if (filter.acronym_starts_with !== undefined && filter.acronym_starts_with !== null) {
            where.acronym = { startsWith: filter.acronym_starts_with, mode: 'insensitive' };
        }

        // Filter by acronym_ends_with
        if (filter.acronym_ends_with !== undefined && filter.acronym_ends_with !== null) {
            where.acronym = { endsWith: filter.acronym_ends_with, mode: 'insensitive' };
        }

        // Filter by acronym_in
        if (filter.acronym_in && filter.acronym_in.length > 0) {
            where.acronym = { in: filter.acronym_in };
        }

        // Filter by acronym_not_in
        if (filter.acronym_not_in && filter.acronym_not_in.length > 0) {
            where.acronym = { notIn: filter.acronym_not_in };
        }

        // Filter by acronym_is_null
        if (filter.acronym_is_null !== undefined && filter.acronym_is_null !== null) {
            where.acronym = filter.acronym_is_null ? null : { not: null };
        }

        // Filter by language
        if (filter.language !== undefined && filter.language !== null) {
            where.language = filter.language;
        }

        // Filter by language_contains
        if (filter.language_contains !== undefined && filter.language_contains !== null) {
            where.language = { contains: filter.language_contains, mode: 'insensitive' };
        }

        // Filter by language_starts_with
        if (filter.language_starts_with !== undefined && filter.language_starts_with !== null) {
            where.language = { startsWith: filter.language_starts_with, mode: 'insensitive' };
        }

        // Filter by language_ends_with
        if (filter.language_ends_with !== undefined && filter.language_ends_with !== null) {
            where.language = { endsWith: filter.language_ends_with, mode: 'insensitive' };
        }

        // Filter by language_in
        if (filter.language_in && filter.language_in.length > 0) {
            where.language = { in: filter.language_in };
        }

        // Filter by language_not_in
        if (filter.language_not_in && filter.language_not_in.length > 0) {
            where.language = { notIn: filter.language_not_in };
        }

        return where;
    }

    /**
     * Convert Prisma entity to GraphQL entity
     * @param entity - The Prisma entity
     * @returns GraphQL entity
     */
    private convertToGraphQLEntity(entity: any): Entity {
        return {
            id: entity.id,
            definition: entity.definition,
            nomenclature: entity.nomenclatures.map((n: any) => ({
                name: n.name,
                acronym: n.acronym,
                language: n.language
            }))
        };
    }
}
