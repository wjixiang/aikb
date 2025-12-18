import { defaultChunkingConfig } from 'chunking';
import {
  ChunkEmbedGroupMetadata,
  IItemVectorStorage,
  ItemChunk,
  ItemChunkSemanticSearchQuery,
  ItemVectorStorageStatus,
  ChunkEmbedGroupStatus,
  ChunkEmbedGroupConfig,
} from './types.js';
import { prisma } from 'postgre-vector-db';
import { generateChunkEmbedGroupToken } from 'utils';
import { defaultEmbeddingConfig } from 'embedding';

export class PrismaItemVectorStorage implements IItemVectorStorage {
  constructor() {
    // Initialize any necessary resources
  }

  async getStatus(groupId: string): Promise<ItemVectorStorageStatus> {
    try {
      const group = await prisma.chunk_embed_groups.findUnique({
        where: { id: groupId },
        select: { status: true },
      });

      if (!group) {
        throw new Error(`Group with id ${groupId} not found`);
      }

      // Map ChunkEmbedGroupStatus to ItemVectorStorageStatus
      switch (group.status) {
        case ChunkEmbedGroupStatus.WAIT_FOR_CHUNK_EMBED:
          return ItemVectorStorageStatus.PENDING;
        case ChunkEmbedGroupStatus.CHUNK_EMBED_COMPLETE:
          return ItemVectorStorageStatus.COMPLETED;
        case ChunkEmbedGroupStatus.CHUNK_EMBED_FAILED:
          return ItemVectorStorageStatus.FAILED;
        default:
          return ItemVectorStorageStatus.PENDING;
      }
    } catch (error) {
      console.error('Error getting status:', error);
      throw error;
    }
  }

  async semanticSearch(
    query: ItemChunkSemanticSearchQuery,
  ): Promise<Omit<ItemChunk, 'embedding'>> {
    try {
      // Convert searchVector to PostgreSQL vector format
      const vectorString = `[${query.searchVector.join(',')}]`;

      // Create a proper array for PostgreSQL ANY operator with UUID casting
      const itemIdPlaceholders = query.itemId
        .map((_, index) => `$${index + 2}::uuid`)
        .join(', ');
      const itemIdValues = query.itemId;

      // Use pgvector's <=> operator for cosine similarity with raw SQL
      // Note: Use parameterized query to avoid JSON formatting issues
      const results = (await prisma.$queryRawUnsafe(
        `
                SELECT
                    id,
                    item_id as "itemId",
                    dense_vector_index_group_id as "denseVectorIndexGroupId",
                    title,
                    content,
                    "index",
                    strategy_metadata as "strategyMetadata",
                    metadata,
                    created_at as "createdAt",
                    updated_at as "updatedAt"
                FROM item_chunks
                WHERE
                    item_id = ANY(ARRAY[${itemIdPlaceholders}])
                    AND dense_vector_index_group_id = $${itemIdValues.length + 2}::uuid
                    AND 1 - (embedding <=> $1::vector) >= $${itemIdValues.length + 3}
                ORDER BY 1 - (embedding <=> $1::vector) DESC
                LIMIT $${itemIdValues.length + 4}
            `,
        vectorString,
        ...itemIdValues,
        query.groupId,
        query.threshold,
        query.resultNum,
      )) as any[];

      if (results.length === 0) {
        throw new Error('No results found');
      }

      // Return first result without embedding field
      const result = results[0];
      return {
        id: result.id,
        itemId: result.itemId,
        denseVectorIndexGroupId: result.denseVectorIndexGroupId,
        title: result.title,
        content: result.content,
        index: result.index,
        strategyMetadata: result.strategyMetadata as any,
        metadata: result.metadata as any,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      };
    } catch (error) {
      console.error('Error in semantic search:', error);
      throw error;
    }
  }

  async semanticSearchByItemidAndGroupid(
    groupId: string,
    searchVector: number[],
    topK: number,
    scoreThreshold: number,
    filter?: { [key: string]: string },
    itemId?: string,
  ): Promise<Array<Omit<ItemChunk, 'embedding'> & { similarity: number }>> {
    try {
      const vectorString = `[${searchVector.join(',')}]`;

      // Build parameterized query to avoid SQL injection with UUID casting
      let whereClause = `
                dense_vector_index_group_id = $2::uuid
                AND 1 - (embedding <=> $1::vector) >= $3
            `;

      // Add JSON filtering if provided
      const params: any[] = [vectorString, groupId, scoreThreshold];
      let paramIndex = 4;

      // Add itemId filter if provided
      if (itemId) {
        whereClause += ` AND item_id = $${paramIndex}::uuid`;
        params.push(itemId);
        paramIndex++;
      }

      if (filter && Object.keys(filter).length > 0) {
        Object.entries(filter).forEach(([key, value]) => {
          if (key === 'chunkType') {
            whereClause += ` AND metadata->>'chunkType' = $${paramIndex}`;
            params.push(value);
            paramIndex++;
          }
          // Add more filter conditions as needed
        });
      }

      // Add LIMIT parameter
      params.push(topK);

      // Use pgvector's <=> operator for cosine similarity with raw SQL
      // Note: Use parameterized query to avoid JSON formatting issues
      const results = (await prisma.$queryRawUnsafe(
        `
                SELECT
                    id,
                    item_id as "itemId",
                    dense_vector_index_group_id as "denseVectorIndexGroupId",
                    title,
                    content,
                    "index",
                    1 - (embedding <=> $1::vector) as similarity,
                    strategy_metadata as "strategyMetadata",
                    metadata,
                    created_at as "createdAt",
                    updated_at as "updatedAt"
                FROM item_chunks
                WHERE ${whereClause}
                ORDER BY similarity DESC
                LIMIT $${paramIndex}
            `,
        ...params,
      )) as any[];

      return results;
    } catch (error) {
      console.error('Error in semantic search by item and group:', error);
      throw error;
    }
  }

  async insertItemChunk(
    group: ChunkEmbedGroupMetadata,
    itemChunk: ItemChunk,
  ): Promise<boolean> {
    try {
      // Convert embedding array to PostgreSQL vector format
      const vectorString = `[${itemChunk.embedding.join(',')}]`;

      // Use parameterized query to avoid SQL injection and handle Unsupported type properly
      await prisma.$executeRawUnsafe(
        `
                INSERT INTO item_chunks (
                    id, item_id, dense_vector_index_group_id, title, content, "index",
                    embedding, strategy_metadata, metadata, created_at, updated_at
                ) VALUES (
                    $1::uuid, $2::uuid, $3::uuid,
                    $4, $5, $6,
                    $7::vector, $8, $9, $10, $11
                )
            `,
        itemChunk.id,
        itemChunk.itemId,
        itemChunk.denseVectorIndexGroupId,
        itemChunk.title,
        itemChunk.content,
        itemChunk.index,
        vectorString,
        JSON.stringify(itemChunk.strategyMetadata),
        JSON.stringify(itemChunk.metadata || {}),
        itemChunk.createdAt,
        itemChunk.updatedAt,
      );
      return true;
    } catch (error) {
      console.error('Error inserting item chunk:', error);
      return false;
    }
  }

  async batchInsertItemChunks(
    group: ChunkEmbedGroupMetadata,
    itemChunks: ItemChunk[],
    batchSize: number = 100,
  ): Promise<boolean> {
    try {
      // Process chunks in batches to avoid timeout issues with large datasets
      const totalChunks = itemChunks.length;
      let processedChunks = 0;

      // Process chunks in batches
      for (let i = 0; i < itemChunks.length; i += batchSize) {
        const batch = itemChunks.slice(i, i + batchSize);

        // Use a transaction for each batch insert with raw SQL
        // Increase timeout to 30 seconds for serverless database startup time
        await prisma.$transaction(
          async (tx) => {
            for (const chunk of batch) {
              // Convert embedding array to PostgreSQL vector format
              const vectorString = `[${chunk.embedding.join(',')}]`;

              // Use parameterized query to avoid SQL injection and handle Unsupported type properly
              await tx.$executeRawUnsafe(
                `
                          INSERT INTO item_chunks (
                              id, item_id, dense_vector_index_group_id, title, content, "index",
                              embedding, strategy_metadata, metadata, created_at, updated_at
                          ) VALUES (
                              $1::uuid, $2::uuid, $3::uuid,
                              $4, $5, $6,
                              $7::vector, $8, $9, $10, $11
                          )
                      `,
                chunk.id,
                chunk.itemId,
                chunk.denseVectorIndexGroupId,
                chunk.title,
                chunk.content,
                chunk.index,
                vectorString,
                JSON.stringify(chunk.strategyMetadata),
                JSON.stringify(chunk.metadata || {}),
                chunk.createdAt,
                chunk.updatedAt,
              );
            }
          },
          {
            timeout: 30000, // 30 seconds timeout per batch
          },
        );

        processedChunks += batch.length;
        console.log(
          `Processed ${processedChunks}/${totalChunks} chunks (${Math.round((processedChunks / totalChunks) * 100)}%)`,
        );
      }

      console.log(
        `Successfully inserted all ${totalChunks} chunks in ${Math.ceil(totalChunks / batchSize)} batches`,
      );
      return true;
    } catch (error) {
      console.error('Error batch inserting item chunks:', error);
      return false;
    }
  }

  async createNewChunkEmbedGroupInfo(
    config: ChunkEmbedGroupConfig,
  ): Promise<ChunkEmbedGroupMetadata> {
    try {
      // Use default configurations if not provided
      const chunkingConfig = config.chunkingConfig || defaultChunkingConfig;
      const embeddingConfig = config.embeddingConfig || defaultEmbeddingConfig;

      const token = generateChunkEmbedGroupToken(
        chunkingConfig.strategy?.toString() ||
        defaultChunkingConfig.strategy?.toString() ||
        'h1',
        embeddingConfig.model.toString(),
        embeddingConfig.dimension,
      );

      // // Check if a group with the same token already exists
      // const existingGroup = await prisma.chunk_embed_groups.findFirst({
      //   where: { token: token },
      // });

      // if (existingGroup) {
      //   // Return the existing group if found
      //   return {
      //     id: existingGroup.id,
      //     token: existingGroup.token,
      //     itemId: existingGroup.item_id,
      //     name: existingGroup.name,
      //     description: existingGroup.description || undefined,
      //     chunkingConfig: existingGroup.chunking_config as any,
      //     embeddingConfig: existingGroup.embedding_config as any,
      //     isDefault: existingGroup.is_default,
      //     isActive: existingGroup.is_active,
      //     createdAt: existingGroup.created_at,
      //     updatedAt: existingGroup.updated_at,
      //     createdBy: existingGroup.created_by || undefined,
      //     tags: existingGroup.tags,
      //     status: existingGroup.status as ChunkEmbedGroupStatus,
      //   };
      // }

      // Create new group if no existing one found
      const newGroup = await prisma.chunk_embed_groups.create({
        data: {
          item_id: config.itemId,
          token: token,
          name: config.name,
          description: config.description,
          chunking_config: chunkingConfig as any,
          embedding_config: embeddingConfig as any,
          is_default: config.isDefault,
          is_active: config.isActive,
          created_at: config.createdAt,
          updated_at: config.updatedAt,
          created_by: config.createdBy,
          tags: config.tags || [],
          status: config.status || ChunkEmbedGroupStatus.WAIT_FOR_CHUNK_EMBED,
        },
      });

      return {
        id: newGroup.id,
        token: newGroup.token,
        itemId: newGroup.item_id,
        name: newGroup.name,
        description: newGroup.description || undefined,
        chunkingConfig: newGroup.chunking_config as any,
        embeddingConfig: newGroup.embedding_config as any,
        isDefault: newGroup.is_default,
        isActive: newGroup.is_active,
        createdAt: newGroup.created_at,
        updatedAt: newGroup.updated_at,
        createdBy: newGroup.created_by || undefined,
        tags: newGroup.tags,
        status: newGroup.status as ChunkEmbedGroupStatus,
      };
    } catch (error) {
      console.error('Error creating new chunk embed group:', error);
      throw error;
    }
  }

  async getChunkEmbedGroupInfoById(
    groupId: string,
  ): Promise<ChunkEmbedGroupMetadata> {
    try {
      const group = await prisma.chunk_embed_groups.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        throw new Error(`Group with id ${groupId} not found`);
      }

      return {
        id: group.id,
        token: group.token,
        itemId: group.item_id,
        name: group.name,
        description: group.description || undefined,
        chunkingConfig: group.chunking_config as any,
        embeddingConfig: group.embedding_config as any,
        isDefault: group.is_default,
        isActive: group.is_active,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        createdBy: group.created_by || undefined,
        tags: group.tags,
        status: group.status as ChunkEmbedGroupStatus,
      };
    } catch (error) {
      console.error('Error getting chunk embed group info:', error);
      throw error;
    }
  }

  async deleteChunkEmbedGroupById(
    groupId: string,
  ): Promise<{ deletedGroupId: string; deletedChunkNum: number }> {
    try {
      // First, count and delete all associated chunks
      const deleteChunksResult = await prisma.item_chunks.deleteMany({
        where: { dense_vector_index_group_id: groupId },
      });

      // Then delete the group
      const deleteGroupResult = await prisma.chunk_embed_groups.delete({
        where: { id: groupId },
      });

      return {
        deletedGroupId: deleteGroupResult.id,
        deletedChunkNum: deleteChunksResult.count,
      };
    } catch (error) {
      console.error('Error deleting chunk embed group:', error);
      throw error;
    }
  }

  async listChunkEmbedGroupInfo(
    itemId?: string,
    pageSize?: number,
    pageToken?: string,
    filter?: string,
    orderBy?: string,
  ): Promise<{
    groups: ChunkEmbedGroupMetadata[];
    nextPageToken?: string;
    totalSize: number;
  }> {
    try {
      // Build where clause
      const where: any = {};
      if (itemId) {
        where.item_id = itemId;
      }
      if (filter) {
        // Simple text filter implementation
        where.OR = [
          { name: { contains: filter, mode: 'insensitive' } },
          { description: { contains: filter, mode: 'insensitive' } },
        ];
      }

      // Build the order by clause
      const orderByClause: any = [];
      if (orderBy) {
        // Simple orderBy parsing (field:direction)
        const [field, direction] = orderBy.split(':');
        if (field && direction) {
          orderByClause.push({ [field]: direction.toLowerCase() });
        }
      } else {
        // Default ordering
        orderByClause.push({ created_at: 'desc' });
      }

      // Calculate pagination
      const skip = pageToken ? parseInt(pageToken) : 0;
      const take = pageSize || 20;

      // Get total count
      const totalSize = await prisma.chunk_embed_groups.count({ where });

      // Get the groups
      const groups = await prisma.chunk_embed_groups.findMany({
        where,
        orderBy: orderByClause,
        skip,
        take,
      });

      // Transform to the expected format
      const transformedGroups = groups.map((group) => ({
        id: group.id,
        token: group.token,
        itemId: group.item_id,
        name: group.name,
        description: group.description || undefined,
        chunkingConfig: group.chunking_config as any,
        embeddingConfig: group.embedding_config as any,
        isDefault: group.is_default,
        isActive: group.is_active,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        createdBy: group.created_by || undefined,
        tags: group.tags,
        status: group.status as ChunkEmbedGroupStatus,
      }));

      // Calculate next page token
      const nextPageToken =
        skip + take < totalSize ? (skip + take).toString() : undefined;

      return {
        groups: transformedGroups,
        nextPageToken,
        totalSize,
      };
    } catch (error) {
      console.error('Error listing chunk embed groups:', error);
      throw error;
    }
  }

  async getChunkById(chunkId: string): Promise<ItemChunk | null> {
    try {
      // Use raw query to get the embedding field which is a vector type
      const result = (await prisma.$queryRawUnsafe(
        `
                SELECT
                    id,
                    token,
                    item_id as "itemId",
                    dense_vector_index_group_id as "denseVectorIndexGroupId",
                    title,
                    content,
                    "index",
                    embedding,
                    strategy_metadata as "strategyMetadata",
                    metadata,
                    created_at as "createdAt",
                    updated_at as "updatedAt"
                FROM item_chunks
                WHERE id = $1::uuid
            `,
        chunkId,
      )) as any[];

      if (result.length === 0) {
        return null;
      }

      const chunk = result[0];
      return {
        id: chunk.id,
        itemId: chunk.itemId,
        denseVectorIndexGroupId: chunk.denseVectorIndexGroupId,
        title: chunk.title,
        content: chunk.content,
        index: chunk.index,
        embedding: chunk.embedding as number[],
        strategyMetadata: chunk.strategyMetadata as any,
        metadata: chunk.metadata as any,
        createdAt: chunk.createdAt,
        updatedAt: chunk.updatedAt,
      };
    } catch (error) {
      console.error('Error getting chunk by ID:', error);
      throw error;
    }
  }
}
