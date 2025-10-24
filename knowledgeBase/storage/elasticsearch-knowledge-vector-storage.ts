/* eslint-disable @typescript-eslint/no-unsafe-argument */
import createLoggerWithPrefix from '@aikb/log-management/logger';
import { Client } from '@elastic/elasticsearch';
import { AbstractKnowledgeVectorStorage } from './abstract-storage';

/**
 * Concrete implementation of KnowledgeVectorStorage using ElasticSearch for vector storage
 */
class ElasticsearchKnowledgeVectorStorage extends AbstractKnowledgeVectorStorage {
  private readonly indexName = 'knowledge_vectors';
  private client: Client;
  private vectorDimensions: number;

  logger = createLoggerWithPrefix('ElasticsearchKnowledgeVectorStorage');

  constructor(
    elasticsearchUrl: string = 'http://elasticsearch:9200',
    vectorDimensions: number = 1536,
  ) {
    super();
    this.vectorDimensions = vectorDimensions;
    this.client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
  }

  /**
   * Initialize the index with proper mappings for vector storage
   */
  private async initializeIndex(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                knowledgeId: {
                  type: 'keyword',
                },
                vector: {
                  type: 'dense_vector',
                  dims: this.vectorDimensions,
                },
                metadata: {
                  type: 'object',
                  dynamic: true,
                },
                createdAt: {
                  type: 'date',
                },
                updatedAt: {
                  type: 'date',
                },
              },
            },
          } as any,
        });
        this.logger.info(
          `Created index: ${this.indexName} with vector dimensions: ${this.vectorDimensions}`,
        );
      }
    } catch (error) {
      // If index already exists, just continue
      if (
        error?.meta?.body?.error?.type === 'resource_already_exists_exception'
      ) {
        this.logger.info(`Index ${this.indexName} already exists, continuing`);
        return;
      }
      this.logger.error('Failed to initialize index:', error);
      throw error;
    }
  }

  async store_knowledge_vector(
    knowledgeId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.initializeIndex();

      // Validate vector dimensions
      if (vector.length !== this.vectorDimensions) {
        throw new Error(
          `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${vector.length}`,
        );
      }

      const document = {
        knowledgeId,
        vector,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
      };

      await this.client.index({
        index: this.indexName,
        id: knowledgeId,
        body: document,
      });

      this.logger.info(`Stored vector for knowledge ID: ${knowledgeId}`);
    } catch (error) {
      this.logger.error(
        `Failed to store vector for knowledge ID ${knowledgeId}:`,
        error,
      );
      throw error;
    }
  }

  async get_knowledge_vector(knowledgeId: string): Promise<{
    vector: number[];
    metadata?: Record<string, any>;
  } | null> {
    try {
      const result = await this.client.get({
        index: this.indexName,
        id: knowledgeId,
      });

      if (result.found) {
        const { _source } = result as any;
        this.logger.info(`Retrieved vector for knowledge ID: ${knowledgeId}`);
        return {
          vector: _source.vector,
          metadata: _source.metadata,
        };
      }

      this.logger.warn(`Vector for knowledge ID ${knowledgeId} not found`);
      return null;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(`Vector for knowledge ID ${knowledgeId} not found`);
        return null;
      }
      this.logger.error(
        `Failed to get vector for knowledge ID ${knowledgeId}:`,
        error,
      );
      throw error;
    }
  }

  async update_knowledge_vector(
    knowledgeId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Validate vector dimensions
      if (vector.length !== this.vectorDimensions) {
        throw new Error(
          `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${vector.length}`,
        );
      }

      // First check if the vector exists
      const existing = await this.get_knowledge_vector(knowledgeId);
      if (!existing) {
        // If it doesn't exist, store it as a new vector
        await this.store_knowledge_vector(knowledgeId, vector, metadata);
        return;
      }

      const document = {
        knowledgeId,
        vector,
        metadata: metadata || existing.metadata || {},
        updatedAt: new Date().toISOString(),
      };

      await this.client.update({
        index: this.indexName,
        id: knowledgeId,
        body: {
          doc: document,
        } as any,
      });

      this.logger.info(`Updated vector for knowledge ID: ${knowledgeId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update vector for knowledge ID ${knowledgeId}:`,
        error,
      );
      throw error;
    }
  }

  async delete_knowledge_vector(knowledgeId: string): Promise<boolean> {
    try {
      const result = await this.client.delete({
        index: this.indexName,
        id: knowledgeId,
      });

      if (result.result === 'not_found') {
        this.logger.warn(
          `Vector for knowledge ID ${knowledgeId} not found for deletion`,
        );
        return false;
      }

      this.logger.info(`Deleted vector for knowledge ID: ${knowledgeId}`);
      return true;
    } catch (error) {
      if (error?.meta?.statusCode === 404) {
        this.logger.warn(
          `Vector for knowledge ID ${knowledgeId} not found for deletion`,
        );
        return false;
      }
      this.logger.error(
        `Failed to delete vector for knowledge ID ${knowledgeId}:`,
        error,
      );
      throw error;
    }
  }

  async find_similar_knowledge_vectors(
    vector: number[],
    limit: number = 10,
    threshold: number = 0.7,
  ): Promise<
    Array<{
      knowledgeId: string;
      similarity: number;
      metadata?: Record<string, any>;
    }>
  > {
    try {
      // Validate vector dimensions
      if (vector.length !== this.vectorDimensions) {
        throw new Error(
          `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${vector.length}`,
        );
      }

      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            script_score: {
              query: {
                exists: {
                  field: 'vector',
                },
              },
              script: {
                source: "cosineSimilarity(params.query_vector, 'vector') + 1.0",
                params: {
                  query_vector: vector,
                },
              },
            },
          },
          size: limit,
        } as any,
      });

      const hits = result.hits.hits;
      const similarVectors = hits
        .map((hit) => {
          const { _id, _source, _score } = hit;
          const similarity = _score;

          // Apply threshold filter
          if (similarity && similarity < threshold) {
            return null;
          }

          return {
            knowledgeId: _id,
            similarity: similarity || 0,
            metadata: (_source as any).metadata,
          };
        })
        .filter(Boolean) as Array<{
        knowledgeId: string;
        similarity: number;
        metadata?: Record<string, any>;
      }>;

      this.logger.info(
        `Found ${similarVectors.length} similar knowledge vectors`,
      );
      return similarVectors;
    } catch (error) {
      if (error?.meta?.body?.error?.type === 'index_not_found_exception') {
        this.logger.info(
          'Knowledge vector index does not exist, returning empty array',
        );
        return [];
      }
      this.logger.error('Failed to find similar knowledge vectors:', error);
      throw error;
    }
  }

  async batch_store_knowledge_vectors(
    vectors: Array<{
      knowledgeId: string;
      vector: number[];
      metadata?: Record<string, any>;
    }>,
  ): Promise<void> {
    try {
      await this.initializeIndex();

      // Validate all vectors have correct dimensions
      for (const item of vectors) {
        if (item.vector.length !== this.vectorDimensions) {
          throw new Error(
            `Vector dimensions mismatch for knowledge ID ${item.knowledgeId}. Expected: ${this.vectorDimensions}, Got: ${item.vector.length}`,
          );
        }
      }

      const body = vectors.flatMap((item) => [
        { index: { _index: this.indexName, _id: item.knowledgeId } },
        {
          knowledgeId: item.knowledgeId,
          vector: item.vector,
          metadata: item.metadata || {},
          createdAt: new Date().toISOString(),
        },
      ]);

      await this.client.bulk({
        body,
      });

      this.logger.info(`Batch stored ${vectors.length} knowledge vectors`);
    } catch (error) {
      this.logger.error('Failed to batch store knowledge vectors:', error);
      throw error;
    }
  }
}

export { ElasticsearchKnowledgeVectorStorage };
