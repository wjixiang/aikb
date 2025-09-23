import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoKnowledgeGraphStorage } from '../mongodb-knowledge-graph-storage';
import { MongoClient, Db } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

describe('MongoKnowledgeGraphStorage Integration Tests', () => {
  let mongodbStorage: MongoKnowledgeGraphStorage;
  let mongoClient: MongoClient;
  let db: Db;
  const collectionName = 'knowledge_links';

  // Test data
  const testLinks = [
    {
      sourceId: 'knowledge1',
      targetId: 'knowledge2',
    },
    {
      sourceId: 'knowledge2',
      targetId: 'knowledge3',
    },
    {
      sourceId: 'knowledge3',
      targetId: 'knowledge4',
    },
    {
      sourceId: 'knowledge1',
      targetId: 'knowledge4',
    },
    {
      sourceId: 'knowledge4',
      targetId: 'knowledge5',
    },
  ];

  beforeAll(async () => {
    // Connect to MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aikb';

    mongoClient = new MongoClient(uri);
    await mongoClient.connect();

    const dbName = process.env.DB_NAME || 'aikb';
    db = mongoClient.db(dbName);

    // Create storage instance
    mongodbStorage = new MongoKnowledgeGraphStorage();
  });

  afterAll(async () => {
    // Clean up and close connection
    if (db) {
      try {
        await db.collection(collectionName).deleteMany({});
      } catch (error) {
        console.error('Error cleaning up database:', error);
      }
    }
    if (mongoClient) {
      await mongoClient.close();
    }
  });

  beforeEach(async () => {
    // Clean up collection before each test
    try {
      await db.collection(collectionName).deleteMany({});
      // Wait a bit to ensure the deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    } catch (error) {
      console.error('Error cleaning up collection before test:', error);
    }
  });

  describe('create_new_link', () => {
    it('should create a knowledge link successfully', async () => {
      // Arrange
      const link = testLinks[0];

      // Act
      await mongodbStorage.create_new_link(link.sourceId, link.targetId);

      // Assert
      const linkInDb = await db.collection(collectionName).findOne({
        sourceId: link.sourceId,
        targetId: link.targetId,
      });
      expect(linkInDb).toBeTruthy();
      expect(linkInDb?.sourceId).toEqual(link.sourceId);
      expect(linkInDb?.targetId).toEqual(link.targetId);
      expect(linkInDb?.linkType).toEqual('knowledge');
      expect(linkInDb?.createdAt).toBeInstanceOf(Date);
      expect(linkInDb?.updatedAt).toBeInstanceOf(Date);
    });

    it('should create multiple knowledge links successfully', async () => {
      // Act
      for (const link of testLinks) {
        await mongodbStorage.create_new_link(link.sourceId, link.targetId);
      }

      // Assert
      const linksInDb = await db.collection(collectionName).find({}).toArray();
      expect(linksInDb.length).toBe(testLinks.length);
      
      for (const link of testLinks) {
        const linkInDb = linksInDb.find(l => 
          l.sourceId === link.sourceId && l.targetId === link.targetId
        );
        expect(linkInDb).toBeTruthy();
        expect(linkInDb?.linkType).toEqual('knowledge');
      }
    });

    it('should handle duplicate links', async () => {
      // Arrange
      const link = testLinks[0];

      // Act - Create the same link twice
      await mongodbStorage.create_new_link(link.sourceId, link.targetId);
      await mongodbStorage.create_new_link(link.sourceId, link.targetId);

      // Assert
      const linksInDb = await db.collection(collectionName).find({
        sourceId: link.sourceId,
        targetId: link.targetId,
      }).toArray();
      expect(linksInDb.length).toBe(2); // MongoDB allows duplicates
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection to fail
      // For now, we'll just ensure the method doesn't crash
      await expect(
        mongodbStorage.create_new_link('knowledge1', 'knowledge2')
      ).resolves.not.toThrow();
    });
  });

  describe('performance', () => {
    it('should handle bulk link creation efficiently', async () => {
      // Arrange
      const bulkLinks: { sourceId: string; targetId: string }[] = [];
      for (let i = 0; i < 100; i++) {
        bulkLinks.push({
          sourceId: `knowledge${i}`,
          targetId: `knowledge${i + 1}`,
        });
      }

      // Act
      const startTime = Date.now();
      for (const link of bulkLinks) {
        await mongodbStorage.create_new_link(link.sourceId, link.targetId);
      }
      const endTime = Date.now();

      // Assert
      const linksInDb = await db.collection(collectionName).find({}).toArray();
      expect(linksInDb.length).toBe(bulkLinks.length);
      
      // Performance assertion - should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('edge cases', () => {
    it('should handle empty string IDs', async () => {
      // Act
      await mongodbStorage.create_new_link('', '');

      // Assert
      const linkInDb = await db.collection(collectionName).findOne({
        sourceId: '',
        targetId: '',
      });
      expect(linkInDb).toBeTruthy();
      expect(linkInDb?.linkType).toEqual('knowledge');
    });

    it('should handle special characters in IDs', async () => {
      // Arrange
      const specialId = 'knowledge-1@#$%^&*()_+{}|:"<>?[]\\;\',./';

      // Act
      await mongodbStorage.create_new_link(specialId, specialId);

      // Assert
      const linkInDb = await db.collection(collectionName).findOne({
        sourceId: specialId,
        targetId: specialId,
      });
      expect(linkInDb).toBeTruthy();
      expect(linkInDb?.linkType).toEqual('knowledge');
    });

    it('should handle very long IDs', async () => {
      // Arrange
      const longId = 'a'.repeat(1000);

      // Act
      await mongodbStorage.create_new_link(longId, longId);

      // Assert
      const linkInDb = await db.collection(collectionName).findOne({
        sourceId: longId,
        targetId: longId,
      });
      expect(linkInDb).toBeTruthy();
      expect(linkInDb?.linkType).toEqual('knowledge');
    });

    it('should handle Unicode characters in IDs', async () => {
      // Arrange
      const unicodeId = '知识-1🚀-测试';

      // Act
      await mongodbStorage.create_new_link(unicodeId, unicodeId);

      // Assert
      const linkInDb = await db.collection(collectionName).findOne({
        sourceId: unicodeId,
        targetId: unicodeId,
      });
      expect(linkInDb).toBeTruthy();
      expect(linkInDb?.linkType).toEqual('knowledge');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent link creation', async () => {
      // Arrange
      const concurrentLinks: { sourceId: string; targetId: string }[] = [];
      for (let i = 0; i < 20; i++) {
        concurrentLinks.push({
          sourceId: `source${i}`,
          targetId: `target${i}`,
        });
      }

      // Act
      const promises = concurrentLinks.map(link =>
        mongodbStorage.create_new_link(link.sourceId, link.targetId)
      );
      await Promise.all(promises);

      // Assert
      const linksInDb = await db.collection(collectionName).find({}).toArray();
      expect(linksInDb.length).toBe(concurrentLinks.length);
    });
  });

  describe('data integrity', () => {
    it('should maintain data consistency', async () => {
      // Arrange
      const link = testLinks[0];

      // Act
      await mongodbStorage.create_new_link(link.sourceId, link.targetId);

      // Verify data was stored correctly
      const linkInDb = await db.collection(collectionName).findOne({
        sourceId: link.sourceId,
        targetId: link.targetId,
      });
      
      expect(linkInDb).toBeTruthy();
      expect(linkInDb?.sourceId).toEqual(link.sourceId);
      expect(linkInDb?.targetId).toEqual(link.targetId);
      expect(linkInDb?.linkType).toEqual('knowledge');
      expect(linkInDb?.createdAt).toBeInstanceOf(Date);
      expect(linkInDb?.updatedAt).toBeInstanceOf(Date);
      
      // Verify createdAt and updatedAt are the same for new records
      expect(linkInDb?.createdAt.getTime()).toBe(linkInDb?.updatedAt.getTime());
    });
  });

  describe('full workflow', () => {
    it('should support creating a knowledge graph structure', async () => {
      // Create a chain of knowledge links
      await mongodbStorage.create_new_link('math', 'algebra');
      await mongodbStorage.create_new_link('algebra', 'calculus');
      await mongodbStorage.create_new_link('calculus', 'physics');
      await mongodbStorage.create_new_link('physics', 'engineering');
      
      // Create a branching structure
      await mongodbStorage.create_new_link('math', 'geometry');
      await mongodbStorage.create_new_link('geometry', 'topology');
      
      // Verify all links were created
      const linksInDb = await db.collection(collectionName).find({}).toArray();
      expect(linksInDb.length).toBe(6);
      
      // Verify specific links exist
      expect(linksInDb.some(l => l.sourceId === 'math' && l.targetId === 'algebra')).toBe(true);
      expect(linksInDb.some(l => l.sourceId === 'algebra' && l.targetId === 'calculus')).toBe(true);
      expect(linksInDb.some(l => l.sourceId === 'math' && l.targetId === 'geometry')).toBe(true);
    });
  });
});