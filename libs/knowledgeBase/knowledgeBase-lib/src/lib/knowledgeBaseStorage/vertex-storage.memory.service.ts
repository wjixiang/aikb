import { Injectable } from '@nestjs/common';
import { IVertexStorage, VertexData } from '../types';

/**
 * In-memory implementation of IVertexStorage for testing and development purposes.
 * This implementation stores vertices in a simple Map structure.
 */
@Injectable()
export class VertexStorageMemoryService implements IVertexStorage {
    private vertices: Map<string, VertexData> = new Map();

    /**
     * Create a new vertex
     * @param vertex The vertex data to create
     * @returns Promise resolving to created vertex with generated ID
     */
    async create(vertex: Omit<VertexData, 'id'>): Promise<VertexData> {
        const id = this.generateId();
        const newVertex: VertexData = {
            id,
            ...vertex
        };
        this.vertices.set(id, newVertex);
        return { ...newVertex };
    }

    /**
     * Retrieve a vertex by ID
     * @param id The vertex ID
     * @returns Promise resolving to the vertex data or null if not found
     */
    async findById(id: string): Promise<VertexData | null> {
        const vertex = this.vertices.get(id);
        return vertex ? { ...vertex } : null;
    }

    /**
     * Retrieve multiple vertices by their IDs
     * @param ids Array of vertex IDs
     * @returns Promise resolving to array of vertices (null for not found vertices)
     */
    async findByIds(ids: string[]): Promise<(VertexData | null)[]> {
        return ids.map(id => {
            const vertex = this.vertices.get(id);
            return vertex ? { ...vertex } : null;
        });
    }

    /**
     * Update an existing vertex
     * @param id The vertex ID to update
     * @param updates Partial vertex data to update
     * @returns Promise resolving to the updated vertex or null if not found
     */
    async update(id: string, updates: Partial<Omit<VertexData, 'id'>>): Promise<VertexData | null> {
        const existingVertex = this.vertices.get(id);
        if (!existingVertex) {
            return null;
        }

        const updatedVertex: VertexData = {
            ...existingVertex,
            ...updates,
            id // Ensure ID doesn't change
        };
        this.vertices.set(id, updatedVertex);
        return { ...updatedVertex };
    }

    /**
     * Delete a vertex by ID
     * @param id The vertex ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    async delete(id: string): Promise<boolean> {
        return this.vertices.delete(id);
    }

    /**
     * Find vertices by type
     * @param type The vertex type ('concept', 'attribute', or 'relationship')
     * @returns Promise resolving to array of vertices of the specified type
     */
    async findByType(type: 'concept' | 'attribute' | 'relationship'): Promise<VertexData[]> {
        const result: VertexData[] = [];
        for (const vertex of this.vertices.values()) {
            if (vertex.type === type) {
                result.push({ ...vertex });
            }
        }
        return result;
    }

    /**
     * Search vertices by content
     * @param query The search query
     * @param options Optional search parameters like limit, offset
     * @returns Promise resolving to array of matching vertices
     */
    async search(query: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<VertexData[]> {
        const allVertices = Array.from(this.vertices.values());
        const filteredVertices = allVertices.filter(vertex => 
            vertex.content.toLowerCase().includes(query.toLowerCase())
        );
        
        let result = filteredVertices;
        
        if (options?.offset) {
            result = result.slice(options.offset);
        }
        
        if (options?.limit) {
            result = result.slice(0, options.limit);
        }
        
        return result.map(vertex => ({ ...vertex }));
    }

    /**
     * Get all vertices with pagination
     * @param options Pagination options
     * @returns Promise resolving to paginated vertices and total count
     */
    async findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<{ vertices: VertexData[]; total: number }> {
        const allVertices = Array.from(this.vertices.values());
        const total = allVertices.length;
        
        let filteredVertices = allVertices;
        
        if (options?.offset) {
            filteredVertices = filteredVertices.slice(options.offset);
        }
        
        if (options?.limit) {
            filteredVertices = filteredVertices.slice(0, options.limit);
        }
        
        return {
            vertices: filteredVertices.map(vertex => ({ ...vertex })),
            total
        };
    }

    /**
     * Check if a vertex exists
     * @param id The vertex ID
     * @returns Promise resolving to true if vertex exists
     */
    async exists(id: string): Promise<boolean> {
        return this.vertices.has(id);
    }

    /**
     * Generate a unique ID for vertices
     * @returns A unique ID string
     */
    private generateId(): string {
        // Simple ID generation - in production, use UUID or similar
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Clear all vertices (useful for testing)
     */
    clear(): void {
        this.vertices.clear();
    }

    /**
     * Get the current number of stored vertices
     * @returns Number of vertices
     */
    count(): number {
        return this.vertices.size;
    }
}
