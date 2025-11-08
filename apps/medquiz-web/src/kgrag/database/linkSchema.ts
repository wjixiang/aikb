/**
 * MongoDB schema and indexes for link relationships
 */

import { connectToDatabase } from '@/lib/db/mongodb';

export class LinkSchemaManager {
  /**
   * Create indexes for optimal link queries
   */
  static async createIndexes(): Promise<void> {
    try {
      const { db } = await connectToDatabase();
      const linksCollection = db.collection('links');

      // Compound indexes for common queries - allow duplicates for different link types
      await linksCollection.createIndex(
        { sourceId: 1, targetId: 1, linkType: 1 },
        { unique: true },
      );
      await linksCollection.createIndex({
        targetId: 1,
        sourceId: 1,
        linkType: 1,
      });
      await linksCollection.createIndex({ sourceId: 1, linkType: 1 });
      await linksCollection.createIndex({ targetId: 1, linkType: 1 });

      // Text indexes for title searches
      await linksCollection.createIndex({
        sourceTitle: 'text',
        targetTitle: 'text',
      });

      // Date indexes for sorting
      await linksCollection.createIndex({ createdAt: -1 });
      await linksCollection.createIndex({ updatedAt: -1 });

      console.log('Link indexes created successfully');
    } catch (error) {
      console.error('Failed to create link indexes:', error);
      throw error;
    }
  }

  /**
   * Initialize the links collection with proper schema validation
   */
  static async initializeCollection(): Promise<void> {
    try {
      const { db } = await connectToDatabase();

      // Create collection if it doesn't exist
      const collections = await db.listCollections({ name: 'links' }).toArray();
      if (collections.length === 0) {
        await db.createCollection('links');
      }

      // Create indexes
      await this.createIndexes();

      console.log('Links collection initialized successfully');
    } catch (error) {
      console.error('Failed to initialize links collection:', error);
      throw error;
    }
  }

  /**
   * Drop and recreate the links collection
   * Use with caution - this will delete all existing links
   */
  static async resetCollection(): Promise<void> {
    try {
      const { db } = await connectToDatabase();

      // Drop collection if it exists
      const collections = await db.listCollections({ name: 'links' }).toArray();
      if (collections.length > 0) {
        await db.collection('links').drop();
      }

      // Recreate collection
      await this.initializeCollection();

      console.log('Links collection reset successfully');
    } catch (error) {
      console.error('Failed to reset links collection:', error);
      throw error;
    }
  }
}
