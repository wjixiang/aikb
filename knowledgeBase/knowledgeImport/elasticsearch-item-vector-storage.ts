import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from 'lib/logManagement/logger';
import {
  IItemVectorStorage,
  ItemVectorStorageStatus,
  ItemChunkSemanticSearchQuery,
  ItemChunk,
  ChunkingEmbeddingGroup,
  ChunkSearchFilter,
} from './library';
import { IdUtils } from './library';
import {
  defaultEmbeddingConfig,
  Embedding,
  EmbeddingConfig,
} from '../../lib/embedding/embedding';
import { ChunkingManager } from 'lib/chunking/chunkingManager';
import { v4 } from 'uuid';
import { threadId } from 'worker_threads';
import { ChunkingConfig } from 'lib/chunking/chunkingTool';
import { defaultChunkingConfig } from 'lib/chunking/chunkingStrategy';

const logger = createLoggerWithPrefix('ElasticSearchItemVectorStorage');

/**
 * ElasticSearch implementation of IItemVectorStorage interface
 * This class provides vector storage capabilities for a specific item using ElasticSearch
 */
export class ElasticSearchItemVectorStorage implements IItemVectorStorage {
  public readonly itemId: string;
  public readonly groupInfo: ChunkingEmbeddingGroup;

  private client: Client;
  private chunksIndexName: string;
  private vectorDimensions: number;
  private isInitialized = false;
  private embeddingService: Embedding;

  constructor(
    itemId: string,
    groupInfo: ChunkingEmbeddingGroup,
    embeddingService: Embedding,
    private chunkingService: ChunkingManager,
    elasticsearchUrl: string = process.env.ELASTICSEARCH_URL ??
      'http://elasticsearch:9200',
  ) {
    this.itemId = itemId;
    this.groupInfo = groupInfo;
    this.chunksIndexName = groupInfo.name;
    this.vectorDimensions = groupInfo.embeddingConfig.dimension;
    this.embeddingService = embeddingService;

    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
  }
  async chunkEmbed(text: string) {
    const chunks = this.chunkingService.chunkWithStrategy(
      text,
      this.groupInfo.chunkingConfig.strategy,
    );
    const embeddings = await this.embeddingService.embedBatch(
      chunks.map((e) => e.content),
    );
    if (embeddings.filter((e) => !e).length > 0)
      throw new Error(
        `Invalid embedding for item ${this.itemId}, stop embedding`,
      );

    const itemChunks: ItemChunk[] = chunks.map((e, index) => {
      const chunk: ItemChunk = {
        id: v4(),
        itemId: this.itemId,
        denseVectorIndexGroupId: this.groupInfo.id,
        title: e.content.substring(0, 6) + '...',
        content: e.content,
        index: index,
        embedding: embeddings[index] as number[],
        strategyMetadata: {
          chunkingStrategy: this.groupInfo.chunkingConfig.strategy || 'h1',
          chunkingConfig: this.groupInfo.chunkingConfig,
          embeddingConfig: this.groupInfo.embeddingConfig,
          processingTimestamp: new Date(),
          processingDuration: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return chunk;
    });

    await this.batchInsertItemChunks(itemChunks);
  }

  /**
   * Initialize the storage by ensuring the index exists
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if index exists
      const indexExists = await this.client.indices.exists({
        index: this.chunksIndexName,
      });

      if (!indexExists) {
        logger.info(`Creating index: ${this.chunksIndexName}`);
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
                dims: this.vectorDimensions,
                index: true,
                similarity: 'cosine',
              },
              strategyMetadata: {
                properties: {
                  chunkingStrategy: { type: 'keyword' },
                  chunkingConfig: { type: 'object' },
                  embeddingConfig: { type: 'object' },
                  processingTimestamp: { type: 'date' },
                  processingDuration: { type: 'float' },
                },
              },
              metadata: { type: 'object' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        });
      }

      this.isInitialized = true;
      logger.info(
        `ElasticSearchItemVectorStorage initialized for item: ${this.itemId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to initialize ElasticSearchItemVectorStorage:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get the current status of the vector storage
   */
  async getStatus(): Promise<ItemVectorStorageStatus> {
    try {
      await this.initialize();

      // Check if there are any chunks for this item and group
      const response = await this.client.search({
        index: this.chunksIndexName,
        query: {
          bool: {
            must: [
              { term: { itemId: this.itemId } },
              { term: { denseVectorIndexGroupId: this.groupInfo.id } },
            ],
          },
        },
        size: 0, // We only need the count
      });

      const chunkCount = response.hits.total as any;

      if (chunkCount === 0) {
        return ItemVectorStorageStatus.FAILED;
      }

      return ItemVectorStorageStatus.COMPLETED;
    } catch (error) {
      logger.error(`Failed to get status for item ${this.itemId}:`, error);
      return ItemVectorStorageStatus.FAILED;
    }
  }

  /**
   * Perform semantic search on the stored chunks
   */
  async semanticSearch(
    query: ItemChunkSemanticSearchQuery,
  ): Promise<Omit<ItemChunk, 'embedding'>> {
    try {
      await this.initialize();

      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.embed(
        query.searchText,
        this.groupInfo.embeddingConfig.provider,
      );

      const searchResponse = await this.client.search({
        index: this.chunksIndexName,
        query: {
          bool: {
            must: [
              { term: { itemId: this.itemId } },
              { term: { denseVectorIndexGroupId: this.groupInfo.id } },
            ],
            should: [
              {
                script_score: {
                  query: { match_all: {} },
                  script: {
                    source:
                      "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                    params: { query_vector: queryEmbedding },
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        size: query.resultNum,
        min_score: query.threshold + 1.0, // cosineSimilarity returns values between -1 and 1, we add 1 to make it 0-2
      });

      const hits = searchResponse.hits.hits as any[];

      if (hits.length === 0) {
        throw new Error('No results found for semantic search');
      }

      // Return the first result
      const hit = hits[0];
      const { embedding, ...chunkWithoutEmbedding } = hit._source as ItemChunk;
      return {
        ...chunkWithoutEmbedding,
        similarity: (hit._score || 0) - 1.0, // Convert back to -1 to 1 range
      } as Omit<ItemChunk, 'embedding'>;
    } catch (error) {
      logger.error(
        `Failed to perform semantic search for item ${this.itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Insert a single chunk into the vector storage
   */
  async insertItemChunk(chunk: ItemChunk): Promise<boolean> {
    try {
      await this.initialize();

      // Validate chunk belongs to this item and group
      if (chunk.itemId !== this.itemId) {
        throw new Error(
          `Chunk itemId ${chunk.itemId} does not match storage itemId ${this.itemId}`,
        );
      }

      if (chunk.denseVectorIndexGroupId !== this.groupInfo.id) {
        throw new Error(
          `Chunk denseVectorIndexGroupId ${chunk.denseVectorIndexGroupId} does not match storage group id ${this.groupInfo.id}`,
        );
      }

      // Validate embedding dimensions
      if (chunk.embedding.length !== this.vectorDimensions) {
        throw new Error(
          `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${chunk.embedding.length}`,
        );
      }

      // Ensure chunk has an ID
      if (!chunk.id) {
        chunk.id = IdUtils.generateId();
      }

      await this.client.index({
        index: this.chunksIndexName,
        id: chunk.id,
        document: chunk,
        refresh: true,
      });

      logger.debug(`Inserted chunk ${chunk.id} for item ${this.itemId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to insert chunk for item ${this.itemId}:`, error);
      return false;
    }
  }

  /**
   * Insert multiple chunks into the vector storage
   */
  async batchInsertItemChunks(chunks: ItemChunk[]): Promise<boolean> {
    try {
      await this.initialize();

      // Validate all chunks belong to this item and group
      for (const chunk of chunks) {
        if (chunk.itemId !== this.itemId) {
          throw new Error(
            `Chunk itemId ${chunk.itemId} does not match storage itemId ${this.itemId}`,
          );
        }

        if (chunk.denseVectorIndexGroupId !== this.groupInfo.id) {
          throw new Error(
            `Chunk denseVectorIndexGroupId ${chunk.denseVectorIndexGroupId} does not match storage group id ${this.groupInfo.id}`,
          );
        }

        // Validate embedding dimensions
        if (chunk.embedding.length !== this.vectorDimensions) {
          throw new Error(
            `Vector dimensions mismatch for chunk ${chunk.id}. Expected: ${this.vectorDimensions}, Got: ${chunk.embedding.length}`,
          );
        }

        // Ensure chunk has an ID
        if (!chunk.id) {
          chunk.id = IdUtils.generateId();
        }
      }

      const body = chunks.flatMap((chunk) => [
        { index: { _index: this.chunksIndexName, _id: chunk.id } },
        chunk,
      ]);

      const bulkResponse = await this.client.bulk({
        body,
        refresh: true,
      });

      // Check for errors in bulk response
      if ((bulkResponse as any).errors) {
        const errors = (bulkResponse as any).items?.filter(
          (item: any) => item.index?.error,
        );
        logger.error(`Bulk operation had errors:`, errors);
        return false;
      }

      logger.info(
        `Successfully inserted ${chunks.length} chunks for item ${this.itemId}`,
      );
      return true;
    } catch (error) {
      logger.error(
        `Failed to batch insert chunks for item ${this.itemId}:`,
        error,
      );
      return false;
    }
  }
}



/**
 * Factory function to create an ElasticSearchItemVectorStorage instance
 * @param itemId The ID of the item
 * @param groupInfo The group information (without the id field)
 * @param elasticsearchUrl Optional ElasticSearch URL
 * @param vectorDimensions Optional vector dimensions
 * @returns An instance of IItemVectorStorage implemented with ElasticSearch
 */
export function createItemVectorStorage(
  itemId: string,
  groupInfo: Omit<ChunkingEmbeddingGroup, 'id'>,
  embeddingService: Embedding,
  chunkingService: ChunkingManager,
  elasticsearchUrl?: string,
): IItemVectorStorage {
  // Generate a unique ID for the group
  const fullGroupInfo: ChunkingEmbeddingGroup = {
    ...groupInfo,
    id: `${itemId}-${groupInfo.name}-${Date.now()}`,
  };

  return new ElasticSearchItemVectorStorage(
    itemId,
    fullGroupInfo,
    embeddingService,
    chunkingService,
    elasticsearchUrl,
  );
}
