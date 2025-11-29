import { EmbeddingConfig } from "embedding";

export interface Tag {
    id: string;
    name: string;
    description: string;
}

export interface EntityNomanclature {
    name: string;
    acronym: string | null;
    language: 'en' | 'zh'
}

export interface EntityData {
    id: string;
    nomanclature: EntityNomanclature[];
    abstract: {
        description: string;
        embedding: {
            config: EmbeddingConfig;
            vector: number[];
        }
    };
    
}

export interface PropertyData {
    id: string;
    // edgePath: string[];
    content: string;
}

export interface EdgeData {
    type: 'start' | 'middle' | 'end'
    in: string;
    out: string;
}


export interface IEntityStorage {
    /**
     * Create a new entity
     * @param entity The entity data to create
     * @returns Promise resolving to the created entity with generated ID
     */
    create(entity: Omit<EntityData, 'id'>): Promise<EntityData>;

    /**
     * Retrieve an entity by ID
     * @param id The entity ID
     * @returns Promise resolving to the entity data or null if not found
     */
    findById(id: string): Promise<EntityData | null>;

    /**
     * Retrieve multiple entities by their IDs
     * @param ids Array of entity IDs
     * @returns Promise resolving to array of entities (null for not found entities)
     */
    findByIds(ids: string[]): Promise<(EntityData | null)[]>;

    /**
     * Update an existing entity
     * @param id The entity ID to update
     * @param updates Partial entity data to update
     * @returns Promise resolving to the updated entity or null if not found
     */
    update(id: string, updates: Partial<Omit<EntityData, 'id'>>): Promise<EntityData | null>;

    /**
     * Delete an entity by ID
     * @param id The entity ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    delete(id: string): Promise<boolean>;

    /**
     * Search entities by text query (searches in nomenclature names and abstract description)
     * @param query The search query
     * @param options Optional search parameters like limit, offset, language filter
     * @returns Promise resolving to array of matching entities
     */
    search(query: string, options?: {
        limit?: number;
        offset?: number;
        language?: 'en' | 'zh';
    }): Promise<EntityData[]>;

    /**
     * Find entities by similarity using vector embedding
     * @param vector The embedding vector to compare against
     * @param options Optional search parameters like limit, threshold
     * @returns Promise resolving to array of similar entities with similarity scores
     */
    findBySimilarity(vector: number[], options?: {
        limit?: number;
        threshold?: number;
    }): Promise<Array<{ entity: EntityData; similarity: number }>>;

    /**
     * Get all entities with pagination
     * @param options Pagination options
     * @returns Promise resolving to paginated entities and total count
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<{ entities: EntityData[]; total: number }>;

    /**
     * Check if an entity exists
     * @param id The entity ID
     * @returns Promise resolving to true if entity exists
     */
    exists(id: string): Promise<boolean>;
}

export interface IPropertyStorage {
    /**
     * Create a new property
     * @param property The property data to create
     * @returns Promise resolving to the created property with generated ID
     */
    create(property: Omit<PropertyData, 'id'>): Promise<PropertyData>;

    /**
     * Retrieve an property by ID
     * @param id The property ID
     * @returns Promise resolving to the property data or null if not found
     */
    findById(id: string): Promise<PropertyData | null>;

    /**
     * Retrieve multiple properties by their IDs
     * @param ids Array of property IDs
     * @returns Promise resolving to array of properties (null for not found properties)
     */
    findByIds(ids: string[]): Promise<(PropertyData | null)[]>;

    /**
     * Update an existing property
     * @param id The property ID to update
     * @param updates Partial property data to update
     * @returns Promise resolving to the updated property or null if not found
     */
    update(id: string, updates: Partial<Omit<PropertyData, 'id'>>): Promise<PropertyData | null>;

    /**
     * Delete an property by ID
     * @param id The property ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    delete(id: string): Promise<boolean>;

    /**
     * Check if an property exists
     * @param id The property ID
     * @returns Promise resolving to true if property exists
     */
    exists(id: string): Promise<boolean>;
}
