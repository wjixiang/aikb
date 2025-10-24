import createLoggerWithPrefix from '@aikb/log-management/logger';
import { connectToDatabase } from '../../libs/utils/mongodb';
import { AbstractKnowledgeContentStorage } from './abstract-storage';
import { KnowledgeData, KnowledgeDataWithId } from '../knowledge.type';

/**
 * Concrete implementation of KnowledgeContentStorage using MongoDB
 */
class MongodbKnowledgeContentStorage extends AbstractKnowledgeContentStorage {
  private collectionName = 'knowledge_contents';

  logger = createLoggerWithPrefix('MongodbKnowledgeContentStorage');

  async create_new_knowledge_content(
    knowledge: KnowledgeData,
  ): Promise<KnowledgeDataWithId> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Generate a unique ID
      const knowledgeId = `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const knowledgeWithId = {
        ...knowledge,
        id: knowledgeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(knowledgeWithId);
      this.logger.info(
        `Created knowledge with _id: ${JSON.stringify(result.insertedId)}`,
      );

      return {
        ...knowledge,
        id: knowledgeId,
        childKnowledgeId: knowledge.childKnowledgeId || [],
      };
    } catch (error) {
      this.logger.error('Failed to create knowledge content:', error);
      throw error;
    }
  }

  async get_knowledge_content_by_id(id: string): Promise<KnowledgeDataWithId> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const knowledge = await collection.findOne({
        id,
      });

      if (knowledge) {
        // Remove MongoDB-specific _id, createdAt, and updatedAt fields before returning
        const { _id, createdAt, updatedAt, ...knowledgeData } = knowledge;
        return knowledgeData as KnowledgeDataWithId;
      }

      throw new Error(`Knowledge with ID ${id} not found`);
    } catch (error) {
      this.logger.error('Failed to get knowledge by ID:', error);
      throw error;
    }
  }

  async update_knowledge_content(
    id: string,
    knowledgeData: Partial<KnowledgeData>,
  ): Promise<KnowledgeDataWithId> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const updateResult = await collection.updateOne(
        { id },
        {
          $set: {
            ...knowledgeData,
            updatedAt: new Date(),
          },
        },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`Knowledge with ID ${id} not found`);
      }

      this.logger.info(`Updated knowledge with ID: ${id}`);

      // Get the updated knowledge
      return await this.get_knowledge_content_by_id(id);
    } catch (error) {
      this.logger.error('Failed to update knowledge content:', error);
      throw error;
    }
  }

  async delete_knowledge_content_by_id(id: string): Promise<boolean> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const deleteResult = await collection.deleteOne({
        id,
      });

      if (deleteResult.deletedCount === 0) {
        this.logger.warn(`Knowledge with ID ${id} not found for deletion`);
        return false;
      }

      this.logger.info(`Deleted knowledge with ID: ${id}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete knowledge content:', error);
      throw error;
    }
  }

  async search_knowledge_contents(query: string): Promise<KnowledgeData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      // Search in scope and content fields
      const searchRegex = new RegExp(query, 'i');
      const knowledgeItems = await collection
        .find({
          $or: [
            { scope: { $regex: searchRegex } },
            { content: { $regex: searchRegex } },
          ],
        })
        .toArray();

      // Remove MongoDB-specific fields before returning
      const result = knowledgeItems.map(
        ({ _id, id, createdAt, updatedAt, ...knowledgeData }) =>
          knowledgeData as KnowledgeData,
      );

      this.logger.info(
        `Found ${result.length} knowledge items matching query: ${query}`,
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to search knowledge contents:', error);
      throw error;
    }
  }

  async list_all_knowledge_contents(): Promise<KnowledgeData[]> {
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection(this.collectionName);

      const knowledgeItems = await collection.find({}).toArray();

      // Remove MongoDB-specific fields before returning
      const result = knowledgeItems.map(
        ({ _id, id, createdAt, updatedAt, ...knowledgeData }) =>
          knowledgeData as KnowledgeData,
      );

      this.logger.info(`Listed ${result.length} knowledge items`);
      return result;
    } catch (error) {
      this.logger.error('Failed to list all knowledge contents:', error);
      throw error;
    }
  }
}

export { MongodbKnowledgeContentStorage };
