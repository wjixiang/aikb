import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { EntityWhereInput, Entity, CreateEntityInput, UpdateEntityInput, DeleteEntityInput } from '../graphql';
import { EntityService } from './entity.service';

/**
 * EntityResolver handles GraphQL queries for entities with filtering capabilities
 */
@Resolver('entity')
export class EntityResolver {
    constructor(
        private entityService: EntityService
    ) { }

    /**
     * Get a single entity based on filter criteria
     * @param filter - The filter criteria to match entities
     * @returns The first matching entity or null if no match found
     */
    @Query()
    async entity(@Args('where') filter: EntityWhereInput): Promise<Entity | null> {
        return await this.entityService.getEntity(filter);
    }

    /**
     * Get all entities based on filter criteria
     * @param filter - The filter criteria to match entities
     * @returns Array of matching entities
     */
    @Query()
    async entities(@Args('where') filter: EntityWhereInput): Promise<Entity[]> {
        return await this.entityService.getEntities(filter);
    }

    /**
     * Create a new entity
     * @param input - The input data for creating the entity
     * @returns The newly created entity
     */
    @Mutation()
    async createEntity(@Args('input') input: CreateEntityInput): Promise<Entity> {
        return await this.entityService.createEntity(input);
    }

    /**
     * Update an existing entity
     * @param input - The input data for updating the entity
     * @returns The updated entity
     */
    @Mutation()
    async updateEntity(@Args('input') input: UpdateEntityInput): Promise<Entity> {
        return await this.entityService.updateEntity(input);
    }

    /**
     * Delete an entity
     * @param input - The input data for deleting the entity
     * @returns The deleted entity
     */
    @Mutation()
    async deleteEntity(@Args('input') input: DeleteEntityInput): Promise<Entity> {
        return await this.entityService.deleteEntity(input);
    }
}
