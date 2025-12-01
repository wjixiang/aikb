import { Injectable } from '@nestjs/common';
import { IEdgeStorage, EdgeData } from '../types';
import { GraphDBPrismaService } from 'graph-db';

@Injectable()
export class EdgeStorageService implements IEdgeStorage {
  constructor(private readonly prisma: GraphDBPrismaService) {}
  /**
   * Create a new edge
   * @param edge The edge data to create
   * @returns Promise resolving to the created edge with generated ID
   */
  async create(edge: Omit<EdgeData, 'id'>): Promise<EdgeData> {
    const createdEdge = await this.prisma.edge.create({
      data: {
        type: edge.type,
        inId: edge.in,
        outId: edge.out,
      },
    });

    return {
      id: createdEdge.id,
      type: createdEdge.type as 'start' | 'middle' | 'end',
      in: createdEdge.inId,
      out: createdEdge.outId,
    };
  }

  /**
   * Retrieve an edge by ID
   * @param id The edge ID
   * @returns Promise resolving to the edge data or null if not found
   */
  async findById(id: string): Promise<EdgeData | null> {
    const edge = await this.prisma.edge.findUnique({
      where: { id, deletedAt: null },
    });

    if (!edge) return null;

    return {
      id: edge.id,
      type: edge.type as 'start' | 'middle' | 'end',
      in: edge.inId,
      out: edge.outId,
    };
  }

  /**
   * Retrieve multiple edges by their IDs
   * @param ids Array of edge IDs
   * @returns Promise resolving to array of edges (null for not found edges)
   */
  async findByIds(ids: string[]): Promise<(EdgeData | null)[]> {
    const edges = await this.prisma.edge.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
    });

    const edgeMap = new Map(edges.map((edge: any) => [edge.id, edge]));
    
    return ids.map(id => {
      const edge = edgeMap.get(id);
      if (!edge) return null;
      
      return {
        id: edge.id,
        type: edge.type as 'start' | 'middle' | 'end',
        in: edge.inId,
        out: edge.outId,
      };
    });
  }

  /**
   * Update an existing edge
   * @param id The edge ID to update
   * @param updates Partial edge data to update
   * @returns Promise resolving to the updated edge or null if not found
   */
  async update(
    id: string,
    updates: Partial<Omit<EdgeData, 'id'>>,
  ): Promise<EdgeData | null> {
    const updateData: any = {};
    
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.in !== undefined) updateData.inId = updates.in;
    if (updates.out !== undefined) updateData.outId = updates.out;

    const updatedEdge = await this.prisma.edge.update({
      where: { id, deletedAt: null },
      data: updateData,
    });

    if (!updatedEdge) return null;

    return {
      id: updatedEdge.id,
      type: updatedEdge.type as 'start' | 'middle' | 'end',
      in: updatedEdge.inId,
      out: updatedEdge.outId,
    };
  }

  /**
   * Delete an edge by ID (soft delete)
   * @param id The edge ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.edge.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find edges by their input node ID
   * @param inId The input node ID
   * @returns Promise resolving to array of edges that have this input
   */
  async findByIn(inId: string): Promise<EdgeData[]> {
    const edges = await this.prisma.edge.findMany({
      where: {
        inId,
        deletedAt: null,
      },
    });

    return edges.map((edge: any) => ({
      id: edge.id,
      type: edge.type as 'start' | 'middle' | 'end',
      in: edge.inId,
      out: edge.outId,
    }));
  }

  /**
   * Find edges by their output node ID
   * @param outId The output node ID
   * @returns Promise resolving to array of edges that have this output
   */
  async findByOut(outId: string): Promise<EdgeData[]> {
    const edges = await this.prisma.edge.findMany({
      where: {
        outId,
        deletedAt: null,
      },
    });

    return edges.map((edge: any) => ({
      id: edge.id,
      type: edge.type as 'start' | 'middle' | 'end',
      in: edge.inId,
      out: edge.outId,
    }));
  }

  /**
   * Find edges by type
   * @param type The edge type ('start', 'middle', or 'end')
   * @returns Promise resolving to array of edges of the specified type
   */
  async findByType(type: 'start' | 'middle' | 'end'): Promise<EdgeData[]> {
    const edges = await this.prisma.edge.findMany({
      where: {
        type,
        deletedAt: null,
      },
    });

    return edges.map((edge: any) => ({
      id: edge.id,
      type: edge.type as 'start' | 'middle' | 'end',
      in: edge.inId,
      out: edge.outId,
    }));
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
    const { limit = 50, offset = 0 } = options || {};

    const [edges, total] = await Promise.all([
      this.prisma.edge.findMany({
        where: { deletedAt: null },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.edge.count({
        where: { deletedAt: null },
      }),
    ]);

    return {
      edges: edges.map((edge: any) => ({
        id: edge.id,
        type: edge.type as 'start' | 'middle' | 'end',
        in: edge.inId,
        out: edge.outId,
      })),
      total,
    };
  }

  /**
   * Check if an edge exists
   * @param id The edge ID
   * @returns Promise resolving to true if edge exists
   */
  async exists(id: string): Promise<boolean> {
    const edge = await this.prisma.edge.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    
    return !!edge;
  }
}
