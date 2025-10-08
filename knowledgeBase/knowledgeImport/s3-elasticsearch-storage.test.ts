import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { S3ElasticSearchLibraryStorage } from './liberary';
import { BookMetadata, Collection, Citation } from './liberary';

describe('S3ElasticSearchLibraryStorage', () => {
  let storage: S3ElasticSearchLibraryStorage;
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
  let elasticsearchAvailable = false;

  beforeAll(async () => {
    // Check if Elasticsearch is available
    try {
      const { Client } = await import('@elastic/elasticsearch');
      const client = new Client({
        node: elasticsearchUrl,
        auth: {
          apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
        },
      });
      await client.ping();
      elasticsearchAvailable = true;
      console.log('Elasticsearch is available, running integration tests');
    } catch (error) {
      console.log('Elasticsearch is not available, skipping integration tests');
      console.log('To run these tests, start Elasticsearch using:');
      console.log(
        '  ./knowledgeBase/knowledgeImport/scripts/check-elasticsearch-simple.sh',
      );
      console.log('Or: cd elastic-start-local && ./start.sh');
      console.log(
        'Or: node knowledgeBase/knowledgeImport/scripts/check-elasticsearch.js',
      );
    }

    if (elasticsearchAvailable) {
      // Create storage instance
      storage = new S3ElasticSearchLibraryStorage(elasticsearchUrl);
    }
  });

  describe('Metadata Operations', () => {
    it('check existance of document', async () => {
      const md = await storage.getMarkdown('68e624929343ced7805027eb');
      console.log(md);
    });

    it('should save and retrieve metadata', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      const metadata: BookMetadata = {
        title: 'Test Book',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        abstract: 'This is a test book',
        publicationYear: 2023,
        publisher: 'Test Publisher',
        tags: ['test', 'book'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        fileType: 'book',
      };

      const savedMetadata = await storage.saveMetadata(metadata);
      expect(savedMetadata.id).toBeDefined();

      const retrievedMetadata = await storage.getMetadata(savedMetadata.id!);
      expect(retrievedMetadata).not.toBeNull();
      expect(retrievedMetadata?.title).toBe('Test Book');
      expect(retrievedMetadata?.authors[0].lastName).toBe('Doe');
    });

    it('should find metadata by content hash', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      const metadata: BookMetadata = {
        title: 'Hash Test Book',
        authors: [{ firstName: 'Jane', lastName: 'Smith' }],
        contentHash: 'test-hash-123',
        tags: ['hash-test'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        fileType: 'book',
      };

      await storage.saveMetadata(metadata);

      const foundMetadata = await storage.getMetadataByHash('test-hash-123');
      expect(foundMetadata).not.toBeNull();
      expect(foundMetadata?.title).toBe('Hash Test Book');
    });

    it('should update metadata', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      const metadata: BookMetadata = {
        title: 'Original Title',
        authors: [{ firstName: 'Original', lastName: 'Author' }],
        tags: ['original'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        fileType: 'book',
      };

      const savedMetadata = await storage.saveMetadata(metadata);

      // Update the metadata
      const updatedMetadata: BookMetadata = {
        ...savedMetadata,
        title: 'Updated Title',
        dateModified: new Date(),
      };

      await storage.updateMetadata(updatedMetadata);

      const retrievedMetadata = await storage.getMetadata(savedMetadata.id!);
      expect(retrievedMetadata?.title).toBe('Updated Title');
    });

    it('should search metadata with filters', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      // Create test metadata
      const metadata1: BookMetadata = {
        title: 'Search Test Book 1',
        authors: [{ firstName: 'Search', lastName: 'Author1' }],
        tags: ['search', 'test1'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        fileType: 'book',
      };

      const metadata2: BookMetadata = {
        title: 'Search Test Book 2',
        authors: [{ firstName: 'Search', lastName: 'Author2' }],
        tags: ['search', 'test2'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        fileType: 'article',
      };

      await storage.saveMetadata(metadata1);
      await storage.saveMetadata(metadata2);

      // Search by title
      const titleResults = await storage.searchMetadata({
        query: 'Search Test',
      });
      expect(titleResults.length).toBeGreaterThanOrEqual(2);

      // Search by tags
      const tagResults = await storage.searchMetadata({
        tags: ['search'],
      });
      expect(tagResults.length).toBeGreaterThanOrEqual(2);

      // Search by file type
      const typeResults = await storage.searchMetadata({
        fileType: ['book'],
      });
      expect(typeResults.length).toBeGreaterThanOrEqual(1);
      expect(
        typeResults.some((item) => item.title === 'Search Test Book 1'),
      ).toBe(true);
    });
  });

  describe('Collection Operations', () => {
    it('should save and retrieve collections', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      const collection: Collection = {
        name: 'Test Collection',
        description: 'A test collection',
        dateAdded: new Date(),
        dateModified: new Date(),
      };

      const savedCollection = await storage.saveCollection(collection);
      expect(savedCollection.id).toBeDefined();

      const collections = await storage.getCollections();
      expect(collections.length).toBeGreaterThanOrEqual(1);
      expect(collections.some((c) => c.name === 'Test Collection')).toBe(true);
    });
  });

  describe('Citation Operations', () => {
    it('should save and retrieve citations', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      const citation: Citation = {
        id: 'test-citation-id',
        itemId: 'test-item-id',
        citationStyle: 'APA',
        citationText: 'Doe, J. (2023). Test Book. Test Publisher.',
        dateGenerated: new Date(),
      };

      await storage.saveCitation(citation);

      const citations = await storage.getCitations('test-item-id');
      expect(citations.length).toBeGreaterThanOrEqual(1);
      expect(citations.some((c) => c.id === 'test-citation-id')).toBe(true);
    });
  });

  describe('Collection Item Management', () => {
    it('should add and remove items from collections', async () => {
      if (!elasticsearchAvailable) {
        console.log('Skipping test - Elasticsearch not available');
        return;
      }
      // Create a test item
      const metadata: BookMetadata = {
        title: 'Collection Test Item',
        authors: [{ firstName: 'Collection', lastName: 'Test' }],
        tags: ['collection-test'],
        collections: [],
        dateAdded: new Date(),
        dateModified: new Date(),
        fileType: 'book',
      };

      const savedMetadata = await storage.saveMetadata(metadata);

      // Create a test collection
      const collection: Collection = {
        name: 'Test Collection for Items',
        dateAdded: new Date(),
        dateModified: new Date(),
      };

      const savedCollection = await storage.saveCollection(collection);

      // Add item to collection
      await storage.addItemToCollection(savedMetadata.id!, savedCollection.id!);

      // Verify item is in collection
      const updatedMetadata = await storage.getMetadata(savedMetadata.id!);
      expect(updatedMetadata?.collections).toContain(savedCollection.id);

      // Remove item from collection
      await storage.removeItemFromCollection(
        savedMetadata.id!,
        savedCollection.id!,
      );

      // Verify item is no longer in collection
      const finalMetadata = await storage.getMetadata(savedMetadata.id!);
      expect(finalMetadata?.collections).not.toContain(savedCollection.id);
    });
  });
});
