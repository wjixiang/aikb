import { EmbeddingConfig } from "embedding";

export interface Tag {
    id: string;
    name: string;
    description: string;
}

export interface Nomanclature {
    name: string;
    acronym: string | null;
    language: 'en' | 'zh'
}

export interface EntityData {
    id: string;
    nomanclature: Nomanclature[];
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
    id: string;
    type: 'start' | 'middle' | 'end'
    in: string;
    out: string;
    // Edge relationships:
    // - start: entity -> vertex
    // - middle: vertex -> vertex
    // - end: vertex -> property
}

export interface VertexData {
    id: string;
    content: string;
    type: 'concept' | 'attribute' | 'relationship';
    metadata?: Record<string, any>;
}

export interface IVertexStorage {
    /**
     * Create a new vertex
     * @param vertex The vertex data to create
     * @returns Promise resolving to the created vertex with generated ID
     */
    create(vertex: Omit<VertexData, 'id'>): Promise<VertexData>;

    /**
     * Retrieve a vertex by ID
     * @param id The vertex ID
     * @returns Promise resolving to the vertex data or null if not found
     */
    findById(id: string): Promise<VertexData | null>;

    /**
     * Retrieve multiple vertices by their IDs
     * @param ids Array of vertex IDs
     * @returns Promise resolving to array of vertices (null for not found vertices)
     */
    findByIds(ids: string[]): Promise<(VertexData | null)[]>;

    /**
     * Update an existing vertex
     * @param id The vertex ID to update
     * @param updates Partial vertex data to update
     * @returns Promise resolving to the updated vertex or null if not found
     */
    update(id: string, updates: Partial<Omit<VertexData, 'id'>>): Promise<VertexData | null>;

    /**
     * Delete a vertex by ID
     * @param id The vertex ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    delete(id: string): Promise<boolean>;

    /**
     * Find vertices by type
     * @param type The vertex type ('concept', 'attribute', or 'relationship')
     * @returns Promise resolving to array of vertices of the specified type
     */
    findByType(type: 'concept' | 'attribute' | 'relationship'): Promise<VertexData[]>;

    /**
     * Search vertices by content
     * @param query The search query
     * @param options Optional search parameters like limit, offset
     * @returns Promise resolving to array of matching vertices
     */
    search(query: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<VertexData[]>;

    /**
     * Get all vertices with pagination
     * @param options Pagination options
     * @returns Promise resolving to paginated vertices and total count
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<{ vertices: VertexData[]; total: number }>;

    /**
     * Check if a vertex exists
     * @param id The vertex ID
     * @returns Promise resolving to true if vertex exists
     */
    exists(id: string): Promise<boolean>;
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

export interface IEdgeStorage {
    /**
     * Create a new edge
     * @param edge The edge data to create
     * @returns Promise resolving to the created edge with generated ID
     */
    create(edge: Omit<EdgeData, 'id'>): Promise<EdgeData>;

    /**
     * Retrieve an edge by ID
     * @param id The edge ID
     * @returns Promise resolving to the edge data or null if not found
     */
    findById(id: string): Promise<EdgeData | null>;

    /**
     * Retrieve multiple edges by their IDs
     * @param ids Array of edge IDs
     * @returns Promise resolving to array of edges (null for not found edges)
     */
    findByIds(ids: string[]): Promise<(EdgeData | null)[]>;

    /**
     * Update an existing edge
     * @param id The edge ID to update
     * @param updates Partial edge data to update
     * @returns Promise resolving to the updated edge or null if not found
     */
    update(id: string, updates: Partial<Omit<EdgeData, 'id'>>): Promise<EdgeData | null>;

    /**
     * Delete an edge by ID
     * @param id The edge ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    delete(id: string): Promise<boolean>;

    /**
     * Find edges by their input node ID
     * @param inId The input node ID
     * @returns Promise resolving to array of edges that have this input
     */
    findByIn(inId: string): Promise<EdgeData[]>;

    /**
     * Find edges by their output node ID
     * @param outId The output node ID
     * @returns Promise resolving to array of edges that have this output
     */
    findByOut(outId: string): Promise<EdgeData[]>;

    /**
     * Find edges by type
     * @param type The edge type ('start', 'middle', or 'end')
     * @returns Promise resolving to array of edges of the specified type
     */
    findByType(type: 'start' | 'middle' | 'end'): Promise<EdgeData[]>;

    /**
     * Get all edges with pagination
     * @param options Pagination options
     * @returns Promise resolving to paginated edges and total count
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<{ edges: EdgeData[]; total: number }>;

    /**
     * Check if an edge exists
     * @param id The edge ID
     * @returns Promise resolving to true if edge exists
     */
    exists(id: string): Promise<boolean>;
}
