import { Client } from '@elastic/elasticsearch';
import { createLoggerWithPrefix } from 'log-management';
import { EmbeddingConfig } from 'embedding';
import {
  IItemVectorStorage,
  ItemChunk,
  ItemChunkSemanticSearchQuery,
  ItemVectorStorageStatus,
  ChunkEmbedGroupMetadata,
} from './types.js';

/**
 * Elasticsearch implementation of IItemVectorStorage
 */
export class ElasticsearchItemVectorStorage implements IItemVectorStorage {
  private readonly client: Client;
  private readonly chunksIndexName = 'item_chunks';
  private readonly groupsIndexName = 'chunk_embedding_groups';

  private readonly logger: ReturnType<typeof createLoggerWithPrefix>;

  /**
   * Get the chunks index name for a specific embedding configuration
   */
  private getChunksIndexNameForEmbeddingConfig(
    embeddingConfig: EmbeddingConfig,
  ): string {
    // Create a unique index name based on provider, model, and dimension
    // This ensures different embedding configurations use different indices
    const { provider, model, dimension } = embeddingConfig;
    return `${this.chunksIndexName}_${provider}_${model}_${dimension}`;
  }

  constructor(
    elasticsearchUrl = process.env['ELASTICSEARCH_URL'] ??
      'http://elasticsearch:9200',
  ) {
    this.logger = createLoggerWithPrefix('ElasticsearchItemVectorStorage');
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env['ELASTICSEARCH_API_KEY'] || '',
      },
    });
  }

  /**
   * Initialize the indices with proper mappings
   */
  private async initializeIndices(
    embeddingConfig?: EmbeddingConfig,
  ): Promise<void> {
    try {
      if (embeddingConfig) {
        await this.initializeEmbeddingConfigChunksIndex(embeddingConfig);
      } else {
        await this.initializeDefaultChunksIndex();
      }

      await this.initializeGroupsIndex();
    } catch (error) {
      if (
        (error as any)?.meta?.body?.error?.type ===
        'resource_already_exists_exception'
      ) {
        this.logger.info('Indices already exist, continuing');
        return;
      }
      this.logger.error('Failed to initialize indices:', error);
      throw error;
    }
  }

  /**
   * Initialize chunks index for a specific embedding configuration
   */
  private async initializeEmbeddingConfigChunksIndex(
    embeddingConfig: EmbeddingConfig,
  ): Promise<void> {
    const chunksIndexName =
      this.getChunksIndexNameForEmbeddingConfig(embeddingConfig);
    const chunksExists = await this.client.indices.exists({
      index: chunksIndexName,
    });

    if (!chunksExists) {
      await this.client.indices.create({
        index: chunksIndexName,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            itemId: { type: 'keyword' },
            denseVectorIndexGroupId: { type: 'keyword' },
            title: { type: 'text' },
            content: { type: 'text' },
            index: { type: 'integer' },
            embedding: {
              type: 'dense_vector',
              dims: embeddingConfig.dimension,
            },
            strategyMetadata: {
              properties: {
                chunkingStrategy: { type: 'keyword' },
                chunkingConfig: { type: 'object', dynamic: true },
                embeddingConfig: { type: 'object', dynamic: true },
                processingTimestamp: { type: 'date' },
                processingDuration: { type: 'float' },
              },
            },
            metadata: {
              type: 'object',
              dynamic: true,
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      } as any);
      this.logger.info(
        `Created chunks index for embedding config ${embeddingConfig.provider}_${embeddingConfig.model}_${embeddingConfig.dimension}: ${chunksIndexName}`,
      );
    }
  }

  /**
   * Initialize default chunks index (for backward compatibility)
   */
  private async initializeDefaultChunksIndex(): Promise<void> {
    const chunksExists = await this.client.indices.exists({
      index: this.chunksIndexName,
    });

    if (!chunksExists) {
      await this.client.indices.create({
        index: this.chunksIndexName,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            itemId: { type: 'keyword' },
            denseVectorIndexGroupId: { type: 'keyword' },
            title: { type: 'text' },
            content: { type: 'text' },
            index: { type: 'integer' },
            embedding: {
              type: 'dense_vector',
              dims: 1536, // Default dimension
            },
            strategyMetadata: {
              properties: {
                chunkingStrategy: { type: 'keyword' },
                chunkingConfig: { type: 'object', dynamic: true },
                embeddingConfig: { type: 'object', dynamic: true },
                processingTimestamp: { type: 'date' },
                processingDuration: { type: 'float' },
              },
            },
            metadata: {
              type: 'object',
              dynamic: true,
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      } as any);
      this.logger.info(`Created default chunks index: ${this.chunksIndexName}`);
    }
  }

  /**
   * Initialize groups index
   */
  private async initializeGroupsIndex(): Promise<void> {
    const groupsExists = await this.client.indices.exists({
      index: this.groupsIndexName,
    });

    if (!groupsExists) {
      await this.client.indices.create({
        index: this.groupsIndexName,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' },
            description: { type: 'text' },
            chunkingConfig: { type: 'object', dynamic: true },
            embeddingConfig: { type: 'object', dynamic: true },
            isDefault: { type: 'boolean' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            createdBy: { type: 'keyword' },
            tags: { type: 'keyword' },
          },
        },
      } as any);
      this.logger.info(`Created groups index: ${this.groupsIndexName}`);
    }
  }

  async getStatus(groupId: string): Promise<ItemVectorStorageStatus> {
    try {
      const group = await this.getChunkEmbedGroupInfoById(groupId);

      if (!group.isActive) {
        return ItemVectorStorageStatus.FAILED;
      }

      // Check if there are any chunks for this group
      // Try the embedding config specific index first
      const chunksIndexName = this.getChunksIndexNameForEmbeddingConfig(
        group.embeddingConfig,
      );
      let result;

      try {
        result = await this.client.search({
          index: chunksIndexName,
          body: {
            query: {
              term: {
                denseVectorIndexGroupId: groupId,
              },
            },
          },
          size: 1,
        } as any);
      } catch (searchError) {
        // If dimension-specific index doesn't exist, try the default index
        if ((searchError as any)?.meta?.statusCode === 404) {
          try {
            result = await this.client.search({
              index: this.chunksIndexName,
              body: {
                query: {
                  term: {
                    denseVectorIndexGroupId: groupId,
                  },
                },
              },
              size: 1,
            } as any);
          } catch (defaultIndexError) {
            // If default index also doesn't exist or has an error, assume no chunks
            return ItemVectorStorageStatus.PENDING;
          }
        } else {
          // For other errors, re-throw
          throw searchError;
        }
      }

      if (result.hits.hits.length === 0) {
        return ItemVectorStorageStatus.PENDING;
      }

      return ItemVectorStorageStatus.COMPLETED;
    } catch (error) {
      this.logger.error(`Failed to get status for group ${groupId}:`, error);
      return ItemVectorStorageStatus.FAILED;
    }
  }

  async semanticSearch(
    query: ItemChunkSemanticSearchQuery,
  ): Promise<Omit<ItemChunk, 'embedding'>> {
    try {
      // First, get the embedding for the search text
      // Note: This assumes you have an embedding service available
      // You might need to inject this dependency or use a service
      // const queryEmbedding = await this.getEmbeddingForText(query.searchText);

      const result = await this.client.search({
        index: this.chunksIndexName,
        body: {
          query: {
            bool: {
              must: [
                {
                  terms: {
                    itemId: query.itemId,
                  },
                },
                {
                  term: {
                    denseVectorIndexGroupId: query.groupId,
                  },
                },
              ],
              should: [
                {
                  script_score: {
                    query: { match_all: {} },
                    script: {
                      source:
                        "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                      params: {
                        query_vector: query.searchVector,
                      },
                    },
                  },
                },
              ],
              minimum_should_match: 1,
            },
          },
          size: query.resultNum,
          min_score: query.threshold,
        },
      } as any);

      const hits = result.hits.hits;
      const chunks = hits.map(
        (hit): Omit<ItemChunk, 'embedding'> & { similarity: number } => {
          const { _source } = hit as any;
          const { embedding: _embedding, ...chunkWithoutEmbedding } = _source;
          return {
            ...chunkWithoutEmbedding,
            similarity: hit._score || 0,
          };
        },
      );

      // NOTE: There's a design mismatch in the interface. The query includes `resultNum`
      // suggesting multiple results should be returned, but the interface expects a single ItemChunk.
      // For now, we'll return the first result as that's what the interface specifies.
      // Consider updating the interface to return an array for better semantic search functionality.

      if (chunks.length === 0) {
        throw new Error('No matching chunks found');
      }

      return chunks[0];
    } catch (error) {
      this.logger.error('Failed to perform semantic search:', error);
      throw error;
    }
  }

  async insertItemChunk(
    group: ChunkEmbedGroupMetadata,
    itemChunk: ItemChunk,
  ): Promise<boolean> {
    try {
      await this.initializeIndices(group.embeddingConfig);

      // Validate vector dimensions against group configuration
      if (itemChunk.embedding.length !== group.embeddingConfig.dimension) {
        throw new Error(
          `Vector dimensions mismatch. Expected: ${group.embeddingConfig.dimension}, Got: ${itemChunk.embedding.length}`,
        );
      }

      const document = {
        ...itemChunk,
        denseVectorIndexGroupId: group.id,
        createdAt: itemChunk.createdAt.toISOString(),
        updatedAt: itemChunk.updatedAt.toISOString(),
        strategyMetadata: {
          ...itemChunk.strategyMetadata,
          processingTimestamp:
            itemChunk.strategyMetadata.processingTimestamp.toISOString(),
        },
      };

      const chunksIndexName = this.getChunksIndexNameForEmbeddingConfig(
        group.embeddingConfig,
      );
      await this.client.index({
        index: chunksIndexName,
        id: itemChunk.id,
        body: document,
        refresh: true, // Force refresh to ensure insertion is immediately visible
      } as any);

      this.logger.info(
        `Inserted item chunk: ${itemChunk.id} to index ${chunksIndexName}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to insert item chunk ${itemChunk.id}:`, error);
      throw error;
    }
  }

  async batchInsertItemChunks(
    group: ChunkEmbedGroupMetadata,
    itemChunks: ItemChunk[],
  ): Promise<boolean> {
    try {
      await this.initializeIndices(group.embeddingConfig);

      // Validate all vectors have correct dimensions based on group configuration
      for (const chunk of itemChunks) {
        if (chunk.embedding.length !== group.embeddingConfig.dimension) {
          throw new Error(
            `Vector dimensions mismatch for chunk ${chunk.id}. Expected: ${group.embeddingConfig.dimension}, Got: ${chunk.embedding.length}`,
          );
        }
      }

      const chunksIndexName = this.getChunksIndexNameForEmbeddingConfig(
        group.embeddingConfig,
      );
      const body = itemChunks.flatMap((chunk) => [
        { index: { _index: chunksIndexName, _id: chunk.id } },
        {
          ...chunk,
          denseVectorIndexGroupId: group.id,
          createdAt: chunk.createdAt.toISOString(),
          updatedAt: chunk.updatedAt.toISOString(),
          strategyMetadata: {
            ...chunk.strategyMetadata,
            processingTimestamp:
              chunk.strategyMetadata.processingTimestamp.toISOString(),
          },
        },
      ]);

      await this.client.bulk({
        body,
        refresh: true, // Force refresh to ensure insertion is immediately visible
      });

      this.logger.info(
        `Batch inserted ${itemChunks.length} item chunks to index ${chunksIndexName}`,
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to batch insert item chunks:', error);
      throw error;
    }
  }

  async createNewChunkEmbedGroupInfo(
    config: Omit<ChunkEmbedGroupMetadata, 'id'>,
  ): Promise<ChunkEmbedGroupMetadata> {
    try {
      await this.initializeIndices();

      const id = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const groupInfo: ChunkEmbedGroupMetadata = {
        ...config,
        id,
        createdAt: now,
        updatedAt: now,
      };

      const document = {
        ...groupInfo,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await this.client.index({
        index: this.groupsIndexName,
        id,
        body: document,
      } as any);

      this.logger.info(`Created new chunk embedding group: ${id}`);
      return groupInfo;
    } catch (error) {
      this.logger.error('Failed to create new chunk embedding group:', error);
      throw error;
    }
  }

  async getChunkEmbedGroupInfoById(
    groupId: string,
  ): Promise<ChunkEmbedGroupMetadata> {
    try {
      const result = await this.client.get({
        index: this.groupsIndexName,
        id: groupId,
      });

      if (result.found) {
        const { _source } = result as any;
        return {
          ..._source,
          createdAt: new Date(_source.createdAt),
          updatedAt: new Date(_source.updatedAt),
        } as ChunkEmbedGroupMetadata;
      }

      throw new Error(`Chunk embedding group ${groupId} not found`);
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        throw new Error(`Chunk embedding group ${groupId} not found`);
      }
      this.logger.error(
        `Failed to get chunk embedding group ${groupId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteChunkEmbedGroupById(groupId: string): Promise<{
    deletedGroupId: string;
    deletedChunkNum: number;
  }> {
    try {
      // Get the group info to determine the dimension
      let group: ChunkEmbedGroupMetadata;
      try {
        group = await this.getChunkEmbedGroupInfoById(groupId);
      } catch (error) {
        // If group doesn't exist, return 0 chunks deleted
        this.logger.warn(`Group ${groupId} not found for deletion`);
        return {
          deletedGroupId: groupId,
          deletedChunkNum: 0,
        };
      }

      // Count and delete chunks from the dimension-specific index
      const chunksIndexName = this.getChunksIndexNameForEmbeddingConfig(
        group.embeddingConfig,
      );
      let chunkCount = 0;

      try {
        const countResult = await this.client.count({
          index: chunksIndexName,
          body: {
            query: {
              term: {
                denseVectorIndexGroupId: groupId,
              },
            },
          },
        } as any);

        chunkCount = countResult.count;

        if (chunkCount > 0) {
          // Delete all chunks associated with this group
          await this.client.deleteByQuery({
            index: chunksIndexName,
            body: {
              query: {
                term: {
                  denseVectorIndexGroupId: groupId,
                },
              },
            },
            refresh: true, // Force refresh to ensure deletion is immediately visible
          } as any);
        }
      } catch (error) {
        // If the dimension-specific index doesn't exist, try the default index
        this.logger.warn(
          `Dimension-specific index ${chunksIndexName} not found, trying default index`,
        );
        try {
          const countResult = await this.client.count({
            index: this.chunksIndexName,
            body: {
              query: {
                term: {
                  denseVectorIndexGroupId: groupId,
                },
              },
            },
          } as any);

          chunkCount = countResult.count;

          if (chunkCount > 0) {
            // Delete all chunks associated with this group
            await this.client.deleteByQuery({
              index: this.chunksIndexName,
              body: {
                query: {
                  term: {
                    denseVectorIndexGroupId: groupId,
                  },
                },
              },
              refresh: true, // Force refresh to ensure deletion is immediately visible
            } as any);
          }
        } catch (defaultIndexError) {
          this.logger.error(
            `Failed to delete chunks from default index:`,
            defaultIndexError,
          );
        }
      }

      // Delete the group itself
      await this.client.delete({
        index: this.groupsIndexName,
        id: groupId,
        refresh: true, // Force refresh to ensure deletion is immediately visible
      });

      this.logger.info(
        `Deleted group ${groupId} and ${chunkCount} associated chunks`,
      );

      return {
        deletedGroupId: groupId,
        deletedChunkNum: chunkCount,
      };
    } catch (error) {
      if ((error as any)?.meta?.statusCode === 404) {
        this.logger.warn(`Group ${groupId} not found for deletion`);
        return {
          deletedGroupId: groupId,
          deletedChunkNum: 0,
        };
      }
      this.logger.error(`Failed to delete group ${groupId}:`, error);
      throw error;
    }
  }

  async listChunkEmbedGroupInfo(
    itemId?: string,
    pageSize: number = 10,
    pageToken?: string,
    filter?: string,
    orderBy?: string,
  ): Promise<{
    groups: ChunkEmbedGroupMetadata[];
    nextPageToken?: string;
    totalSize: number;
  }> {
    try {
      // Build the query
      const query: any = {
        query: {
          match_all: {},
        },
        size: pageSize,
        sort: [],
      };

      // Add item ID filter if provided
      if (itemId) {
        query.query = {
          term: {
            itemId: itemId,
          },
        };
      }

      // Add filter if provided
      if (filter) {
        const existingQuery = query.query;
        query.query = {
          bool: {
            must: [existingQuery],
            should: [
              {
                match: {
                  name: {
                    query: filter,
                    boost: 2.0,
                  },
                },
              },
              {
                match: {
                  description: filter,
                },
              },
              {
                match: {
                  tags: filter,
                },
              },
            ],
            minimum_should_match: 1,
          },
        };
      }

      // Add sorting
      if (orderBy) {
        const [field, direction] = orderBy.split(' ');
        const sortField = field === 'name' ? 'name.keyword' : field;
        query.sort.push({
          [sortField]: {
            order: direction?.toLowerCase() === 'desc' ? 'desc' : 'asc',
          },
        });
      } else {
        // Default sort by createdAt descending
        query.sort.push({
          createdAt: {
            order: 'desc',
          },
        });
      }

      // Add pagination
      if (pageToken) {
        query.search_after = JSON.parse(Buffer.from(pageToken, 'base64').toString());
      }

      const result = await this.client.search({
        index: this.groupsIndexName,
        body: query,
      } as any);

      const hits = result.hits.hits;
      const groups = hits.map((hit: any) => {
        const { _source } = hit;
        return {
          ..._source,
          createdAt: new Date(_source.createdAt),
          updatedAt: new Date(_source.updatedAt),
        } as ChunkEmbedGroupMetadata;
      });

      // Get total count
      const countResult = await this.client.count({
        index: this.groupsIndexName,
        body: {
          query: query.query,
        },
      } as any);

      // Generate next page token if there are more results
      let nextPageToken;
      if (hits.length === pageSize && hits.length > 0) {
        const lastHit = hits[hits.length - 1];
        const sortValues = lastHit.sort;
        nextPageToken = Buffer.from(JSON.stringify(sortValues)).toString('base64');
      }

      return {
        groups,
        nextPageToken,
        totalSize: countResult.count,
      };
    } catch (error) {
      this.logger.error('Failed to list chunk embedding groups:', error);
      throw error;
    }
  }

  /**
   * Helper method to get embedding for text
   * This should be implemented based on your embedding service
   */
  private getEmbeddingForText(_text: string): Promise<number[]> {
    // This is a placeholder implementation
    // In a real scenario, you would integrate with your embedding service
    // For example, OpenAI, Cohere, or a local embedding model

    // For now, return a zero vector of default dimensions
    // This should be replaced with actual embedding logic
    return Promise.resolve(new Array(1536).fill(0) as number[]);
  }
}
