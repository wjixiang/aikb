import createLoggerWithPrefix from '../lib/logger';
import { connectToDatabase } from '../lib/mongodb';
import { AbstractKnowledgeGraphStorage } from './abstract-storage';

/**
 * Concrete implementation of KnowledgeGraphStorage using MongoDB
 */
class MongoKnowledgeGraphStorage extends AbstractKnowledgeGraphStorage {
  private collectionName = 'knowledge_links';

  logger = createLoggerWithPrefix('MongoKnowledgeGraphStorage');

  async create_new_link(sourceId: string, targetId: string): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const link = {
        sourceId,
        targetId,
        linkType: 'knowledge', // Default link type, can be extended in the future
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(link);
      this.logger.info(
        `Created knowledge link with _id: ${JSON.stringify(result.insertedId)} from ${sourceId} to ${targetId}`,
      );
    } catch (error) {
      this.logger.error('Failed to create knowledge link:', error);
      throw error;
    }
  }

  async get_knowledge_links_by_source(sourceId: string): Promise<
    Array<{
      sourceId: string;
      targetId: string;
      linkType: string;
    }>
  > {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const links = await collection.find({ sourceId }).toArray();

      // Remove MongoDB-specific fields before returning
      const result = links.map(
        ({ _id, createdAt, updatedAt, ...link }) =>
          link as {
            sourceId: string;
            targetId: string;
            linkType: string;
          },
      );

      this.logger.info(
        `Found ${result.length} knowledge links for source ${sourceId}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to get knowledge links by source:', error);
      throw error;
    }
  }
}

export { MongoKnowledgeGraphStorage };
