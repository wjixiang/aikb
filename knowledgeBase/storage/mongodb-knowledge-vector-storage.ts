import createLoggerWithPrefix from '@aikb/log-management/logger';
import { connectToDatabase } from '../../libs/utils/mongodb';
import { AbstractKnowledgeVectorStorage } from './abstract-storage';

/**
 * Concrete implementation of KnowledgeVectorStorage using MongoDB
 */
class MongodbKnowledgeVectorStorage extends AbstractKnowledgeVectorStorage {
  private collectionName = 'knowledge_vectors';
  private vectorDimensions: number;

  logger = createLoggerWithPrefix('MongodbKnowledgeVectorStorage');

  constructor(vectorDimensions: number = 1536) {
    super();
    this.vectorDimensions = vectorDimensions;
  }

  async store_knowledge_vector(
    knowledgeId: string,
    vector: number[],
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Validate vector dimensions
      if (vector.length !== this.vectorDimensions) {
        throw new Error(
          `Vector dimensions mismatch. Expected: ${this.vectorDimensions}, Got: ${vector.length}`,
        );
      }

      const vectorDocument = {
        knowledgeId,
        vector,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Check if vector already exists and replace it
      const existingVector = await collection.findOne({ knowledgeId });

      if (existingVector) {
        await collection.replaceOne(
          { knowledgeId },
          {
            ...vectorDocument,
            createdAt: existingVector.createdAt, // Preserve original creation time
          },
        );
        this.logger.info(
          `Replaced existing vector for knowledge ID: ${knowledgeId}`,
        );
      } else {
        await collection.insertOne(vectorDocument);
        this.logger.info(`Stored vector for knowledge ID: ${knowledgeId}`);
      }
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
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const vectorDocument = await collection.findOne({
        knowledgeId,
      });

      if (vectorDocument) {
        // Remove MongoDB-specific fields before returning
        const { _id, createdAt, updatedAt, ...vectorData } = vectorDocument;
        this.logger.info(`Retrieved vector for knowledge ID: ${knowledgeId}`);
        return {
          vector: vectorData.vector,
          metadata: vectorData.metadata,
        };
      }

      this.logger.warn(`Vector for knowledge ID ${knowledgeId} not found`);
      return null;
    } catch (error) {
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

      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const updateResult = await collection.updateOne(
        { knowledgeId },
        {
          $set: {
            vector,
            metadata: metadata || existing.metadata || {},
            updatedAt: new Date(),
          },
        },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`Vector for knowledge ID ${knowledgeId} not found`);
      }

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
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const deleteResult = await collection.deleteOne({
        knowledgeId,
      });

      if (deleteResult.deletedCount === 0) {
        this.logger.warn(
          `Vector for knowledge ID ${knowledgeId} not found for deletion`,
        );
        return false;
      }

      this.logger.info(`Deleted vector for knowledge ID: ${knowledgeId}`);
      return true;
    } catch (error) {
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

      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Get all vectors from the database
      const allVectors = await collection.find({}).toArray();

      // Calculate cosine similarity for each vector
      const similarVectors = allVectors
        .map((vectorDoc) => {
          const { _id, ...vectorData } = vectorDoc;
          const similarity = this.calculateCosineSimilarity(
            vector,
            vectorData.vector,
          );

          // Apply threshold filter
          if (similarity < threshold) {
            return null;
          }

          return {
            knowledgeId: vectorData.knowledgeId,
            similarity,
            metadata: vectorData.metadata,
          };
        })
        .filter(Boolean) as Array<{
        knowledgeId: string;
        similarity: number;
        metadata?: Record<string, any>;
      }>;

      // Sort by similarity (descending) and limit results
      const result = similarVectors
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      this.logger.info(`Found ${result.length} similar knowledge vectors`);
      return result;
    } catch (error) {
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
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Validate all vectors have correct dimensions
      for (const item of vectors) {
        if (item.vector.length !== this.vectorDimensions) {
          throw new Error(
            `Vector dimensions mismatch for knowledge ID ${item.knowledgeId}. Expected: ${this.vectorDimensions}, Got: ${item.vector.length}`,
          );
        }
      }

      // Prepare bulk operations
      const bulkOps = vectors.map((item) => {
        const vectorDocument = {
          knowledgeId: item.knowledgeId,
          vector: item.vector,
          metadata: item.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return {
          updateOne: {
            filter: { knowledgeId: item.knowledgeId },
            update: {
              $set: vectorDocument,
            },
            upsert: true,
          },
        };
      });

      await collection.bulkWrite(bulkOps);

      this.logger.info(`Batch stored ${vectors.length} knowledge vectors`);
    } catch (error) {
      this.logger.error('Failed to batch store knowledge vectors:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vecA First vector
   * @param vecB Second vector
   * @returns Cosine similarity score (0-1)
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export { MongodbKnowledgeVectorStorage };
