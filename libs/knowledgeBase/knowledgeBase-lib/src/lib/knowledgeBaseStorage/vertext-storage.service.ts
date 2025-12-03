import { Injectable } from '@nestjs/common';
import { IVertexStorage, VertexData } from '../types';
import { GraphDBPrismaService } from 'graph-db';

@Injectable()
export class VertextStorageService implements IVertexStorage {
  constructor(private readonly prisma: GraphDBPrismaService) {}
  /**
   * Create a new vertex
   * @param vertex The vertex data to create
   * @returns Promise resolving to created vertex with generated ID
   */
  async create(vertex: Omit<VertexData, 'id'>): Promise<VertexData> {
    const createdVertex = await this.prisma.vertex.create({
      data: {
        content: vertex.content,
        type: vertex.type,
        metadata: vertex.metadata ?? undefined,
      },
    });

    return {
      id: createdVertex.id,
      content: createdVertex.content,
      type: createdVertex.type as 'concept' | 'attribute' | 'relationship',
      metadata: createdVertex.metadata as Record<string, any> | undefined,
    };
  }

  /**
   * Retrieve a vertex by ID
   * @param id The vertex ID
   * @returns Promise resolving to the vertex data or null if not found
   */
  async findById(id: string): Promise<VertexData | null> {
    const vertex = await this.prisma.vertex.findUnique({
      where: { id, deletedAt: null },
    });

    if (!vertex) return null;

    return {
      id: vertex.id,
      content: vertex.content,
      type: vertex.type as 'concept' | 'attribute' | 'relationship',
      metadata: vertex.metadata as Record<string, any> | undefined,
    };
  }

  /**
   * Retrieve multiple vertices by their IDs
   * @param ids Array of vertex IDs
   * @returns Promise resolving to array of vertices (null for not found vertices)
   */
  async findByIds(ids: string[]): Promise<(VertexData | null)[]> {
    const vertices = await this.prisma.vertex.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
    });

    const vertexMap = new Map(
      vertices.map((vertex: any) => [vertex.id, vertex]),
    );

    return ids.map((id) => {
      const vertex = vertexMap.get(id);
      if (!vertex) return null;

      return {
        id: vertex.id,
        content: vertex.content,
        type: vertex.type as 'concept' | 'attribute' | 'relationship',
        metadata: vertex.metadata as Record<string, any> | undefined,
      };
    });
  }

  /**
   * Update an existing vertex
   * @param id The vertex ID to update
   * @param updates Partial vertex data to update
   * @returns Promise resolving to the updated vertex or null if not found
   */
  async update(
    id: string,
    updates: Partial<Omit<VertexData, 'id'>>,
  ): Promise<VertexData | null> {
    const updateData: any = {};

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.metadata !== undefined)
      updateData.metadata = updates.metadata ?? undefined;

    const updatedVertex = await this.prisma.vertex.update({
      where: { id, deletedAt: null },
      data: updateData,
    });

    if (!updatedVertex) return null;

    return {
      id: updatedVertex.id,
      content: updatedVertex.content,
      type: updatedVertex.type as 'concept' | 'attribute' | 'relationship',
      metadata: updatedVertex.metadata as Record<string, any> | undefined,
    };
  }

  /**
   * Delete a vertex by ID (soft delete)
   * @param id The vertex ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.vertex.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find vertices by type
   * @param type The vertex type ('concept', 'attribute', or 'relationship')
   * @returns Promise resolving to array of vertices of the specified type
   */
  async findByType(
    type: 'concept' | 'attribute' | 'relationship',
  ): Promise<VertexData[]> {
    const vertices = await this.prisma.vertex.findMany({
      where: {
        type,
        deletedAt: null,
      },
    });

    return vertices.map((vertex: any) => ({
      id: vertex.id,
      content: vertex.content,
      type: vertex.type as 'concept' | 'attribute' | 'relationship',
      metadata: vertex.metadata as Record<string, any> | undefined,
    }));
  }

  /**
   * Search vertices by content
   * @param query The search query
   * @param options Optional search parameters like limit, offset
   * @returns Promise resolving to array of matching vertices
   */
  async search(
    query: string,
    options?: {
      limit?: number | string;
      offset?: number | string;
    },
  ): Promise<VertexData[]> {
    const { limit = 50, offset = 0 } = options || {};
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : offset;

    const vertices = await this.prisma.vertex.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      take: parsedLimit,
      skip: parsedOffset,
      orderBy: { createdAt: 'desc' },
    });

    return vertices.map((vertex: any) => ({
      id: vertex.id,
      content: vertex.content,
      type: vertex.type as 'concept' | 'attribute' | 'relationship',
      metadata: vertex.metadata as Record<string, any> | undefined,
    }));
  }

  /**
   * Get all vertices with pagination
   * @param options Pagination options
   * @returns Promise resolving to paginated vertices and total count
   */
  async findAll(options?: {
    limit?: number | string;
    offset?: number | string;
  }): Promise<{ vertices: VertexData[]; total: number }> {
    const { limit = 50, offset = 0 } = options || {};
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : offset;

    const [vertices, total] = await Promise.all([
      this.prisma.vertex.findMany({
        where: { deletedAt: null },
        take: parsedLimit,
        skip: parsedOffset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vertex.count({
        where: { deletedAt: null },
      }),
    ]);

    return {
      vertices: vertices.map((vertex: any) => ({
        id: vertex.id,
        content: vertex.content,
        type: vertex.type as 'concept' | 'attribute' | 'relationship',
        metadata: vertex.metadata as Record<string, any> | undefined,
      })),
      total,
    };
  }

  /**
   * Check if a vertex exists
   * @param id The vertex ID
   * @returns Promise resolving to true if vertex exists
   */
  async exists(id: string): Promise<boolean> {
    const vertex = await this.prisma.vertex.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    return !!vertex;
  }
}
