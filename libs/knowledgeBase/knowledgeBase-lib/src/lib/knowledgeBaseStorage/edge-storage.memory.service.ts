import { Injectable } from '@nestjs/common';
import { IEdgeStorage, EdgeData } from '../types';

/**
 * In-memory implementation of IEdgeStorage for testing and development purposes.
 * This implementation stores edges in a simple Map structure.
 */
@Injectable()
export class EdgeStorageMemoryService implements IEdgeStorage {
    private edges: Map<string, EdgeData> = new Map();

    /**
     * Create a new edge
     * @param edge The edge data to create
     * @returns Promise resolving to the created edge with generated ID
     */
    async create(edge: Omit<EdgeData, 'id'>): Promise<EdgeData> {
        const id = this.generateId();
        const newEdge: EdgeData = {
            id,
            ...edge
        };
        this.edges.set(id, newEdge);
        return { ...newEdge };
    }

    /**
     * Retrieve an edge by ID
     * @param id The edge ID
     * @returns Promise resolving to the edge data or null if not found
     */
    async findById(id: string): Promise<EdgeData | null> {
        const edge = this.edges.get(id);
        return edge ? { ...edge } : null;
    }

    /**
     * Retrieve multiple edges by their IDs
     * @param ids Array of edge IDs
     * @returns Promise resolving to array of edges (null for not found edges)
     */
    async findByIds(ids: string[]): Promise<(EdgeData | null)[]> {
        return ids.map(id => {
            const edge = this.edges.get(id);
            return edge ? { ...edge } : null;
        });
    }

    /**
     * Update an existing edge
     * @param id The edge ID to update
     * @param updates Partial edge data to update
     * @returns Promise resolving to the updated edge or null if not found
     */
    async update(id: string, updates: Partial<Omit<EdgeData, 'id'>>): Promise<EdgeData | null> {
        const existingEdge = this.edges.get(id);
        if (!existingEdge) {
            return null;
        }

        const updatedEdge: EdgeData = {
            ...existingEdge,
            ...updates,
            id // Ensure ID doesn't change
        };
        this.edges.set(id, updatedEdge);
        return { ...updatedEdge };
    }

    /**
     * Delete an edge by ID
     * @param id The edge ID to delete
     * @returns Promise resolving to true if deleted, false if not found
     */
    async delete(id: string): Promise<boolean> {
        return this.edges.delete(id);
    }

    /**
     * Find edges by their input node ID
     * @param inId The input node ID
     * @returns Promise resolving to array of edges that have this input
     */
    async findByIn(inId: string): Promise<EdgeData[]> {
        const result: EdgeData[] = [];
        for (const edge of this.edges.values()) {
            if (edge.in === inId) {
                result.push({ ...edge });
            }
        }
        return result;
    }

    /**
     * Find edges by their output node ID
     * @param outId The output node ID
     * @returns Promise resolving to array of edges that have this output
     */
    async findByOut(outId: string): Promise<EdgeData[]> {
        const result: EdgeData[] = [];
        for (const edge of this.edges.values()) {
            if (edge.out === outId) {
                result.push({ ...edge });
            }
        }
        return result;
    }

    /**
     * Find edges by type
     * @param type The edge type ('start', 'middle', or 'end')
     * @returns Promise resolving to array of edges of the specified type
     */
    async findByType(type: 'start' | 'middle' | 'end'): Promise<EdgeData[]> {
        const result: EdgeData[] = [];
        for (const edge of this.edges.values()) {
            if (edge.type === type) {
                result.push({ ...edge });
            }
        }
        return result;
    }

    /**
     * Get all edges with pagination
     * @param options Pagination options
     * @returns Promise resolving to paginated edges and total count
     */
    async findAll(options?: {
        limit?: number;
        offset?: number;
    }): Promise<{ edges: EdgeData[]; total: number }> {
        const allEdges = Array.from(this.edges.values());
        const total = allEdges.length;
        
        let filteredEdges = allEdges;
        
        if (options?.offset) {
            filteredEdges = filteredEdges.slice(options.offset);
        }
        
        if (options?.limit) {
            filteredEdges = filteredEdges.slice(0, options.limit);
        }
        
        return {
            edges: filteredEdges.map(edge => ({ ...edge })),
            total
        };
    }

    /**
     * Check if an edge exists
     * @param id The edge ID
     * @returns Promise resolving to true if edge exists
     */
    async exists(id: string): Promise<boolean> {
        return this.edges.has(id);
    }

    /**
     * Generate a unique ID for edges
     * @returns A unique ID string
     */
    private generateId(): string {
        // Simple ID generation - in production, use UUID or similar
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Clear all edges (useful for testing)
     */
    clear(): void {
        this.edges.clear();
    }

    /**
     * Get the current number of stored edges
     * @returns Number of edges
     */
    count(): number {
        return this.edges.size;
    }
}
