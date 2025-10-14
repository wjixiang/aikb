import { MongoDBMarkdownPartCache } from '../markdown-part-cache-mongodb';
import { MarkdownPartCacheError } from '../markdown-part-cache';

describe('MongoDBMarkdownPartCache', () => {
  let cache: MongoDBMarkdownPartCache;
  const testItemId = 'test-item-123';

  beforeAll(async () => {
    cache = new MongoDBMarkdownPartCache();
    await cache.initialize();
  });

  afterAll(async () => {
    // Clean up test data
    await cache.cleanup(testItemId);
    await cache.close();
  });

  describe('storePartMarkdown', () => {
    it('should store markdown part successfully', async () => {
      const partIndex = 0;
      const content = '# Test Part 0\n\nThis is test content for part 0.';
      
      await expect(
        cache.storePartMarkdown(testItemId, partIndex, content)
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid itemId', async () => {
      await expect(
        cache.storePartMarkdown('', 0, 'content')
      ).rejects.toThrow(MarkdownPartCacheError);
    });

    it('should throw error for invalid partIndex', async () => {
      await expect(
        cache.storePartMarkdown(testItemId, -1, 'content')
      ).rejects.toThrow(MarkdownPartCacheError);
    });
  });

  describe('getPartMarkdown', () => {
    it('should retrieve stored markdown part', async () => {
      const partIndex = 1;
      const content = '# Test Part 1\n\nThis is test content for part 1.';
      
      // Store the part first
      await cache.storePartMarkdown(testItemId, partIndex, content);
      
      // Retrieve the part
      const retrievedContent = await cache.getPartMarkdown(testItemId, partIndex);
      expect(retrievedContent).toBe(content);
    });

    it('should return null for non-existent part', async () => {
      const nonExistentPart = await cache.getPartMarkdown(testItemId, 999);
      expect(nonExistentPart).toBeNull();
    });
  });

  describe('getAllParts', () => {
    it('should retrieve all parts for an item', async () => {
      // Store multiple parts
      await cache.storePartMarkdown(testItemId, 0, '# Part 0\n\nContent 0');
      await cache.storePartMarkdown(testItemId, 1, '# Part 1\n\nContent 1');
      await cache.storePartMarkdown(testItemId, 2, '# Part 2\n\nContent 2');
      
      // Retrieve all parts
      const allParts = await cache.getAllParts(testItemId);
      
      expect(allParts).toHaveLength(3);
      expect(allParts[0].partIndex).toBe(0);
      expect(allParts[1].partIndex).toBe(1);
      expect(allParts[2].partIndex).toBe(2);
      expect(allParts[0].content).toBe('# Part 0\n\nContent 0');
      expect(allParts[1].content).toBe('# Part 1\n\nContent 1');
      expect(allParts[2].content).toBe('# Part 2\n\nContent 2');
    });

    it('should return empty array for item with no parts', async () => {
      const emptyParts = await cache.getAllParts('non-existent-item');
      expect(emptyParts).toEqual([]);
    });
  });

  describe('mergeAllParts', () => {
    it('should merge all parts into complete markdown', async () => {
      // Store multiple parts
      await cache.storePartMarkdown(testItemId, 0, '# Part 0\n\nContent 0');
      await cache.storePartMarkdown(testItemId, 1, '# Part 1\n\nContent 1');
      
      // Merge all parts
      const mergedContent = await cache.mergeAllParts(testItemId);
      
      expect(mergedContent).toBe('# Part 0\n\nContent 0\n\n# Part 1\n\nContent 1');
    });

    it('should throw error for item with no parts', async () => {
      await expect(
        cache.mergeAllParts('non-existent-item')
      ).rejects.toThrow(MarkdownPartCacheError);
    });
  });

  describe('updatePartStatus', () => {
    it('should update part status successfully', async () => {
      const partIndex = 0;
      const newStatus = 'processing';
      
      // Store a part first
      await cache.storePartMarkdown(testItemId, partIndex, '# Test Content');
      
      // Update status
      await expect(
        cache.updatePartStatus(testItemId, partIndex, newStatus)
      ).resolves.not.toThrow();
      
      // Verify status was updated
      const status = await cache.getPartStatus(testItemId, partIndex);
      expect(status).toBe(newStatus);
    });

    it('should throw error for non-existent part', async () => {
      await expect(
        cache.updatePartStatus(testItemId, 999, 'processing')
      ).rejects.toThrow(MarkdownPartCacheError);
    });
  });

  describe('getPartStatus', () => {
    it('should retrieve part status', async () => {
      const partIndex = 0;
      const status = 'completed';
      
      // Store a part first
      await cache.storePartMarkdown(testItemId, partIndex, '# Test Content');
      
      // Update status
      await cache.updatePartStatus(testItemId, partIndex, status);
      
      // Retrieve status
      const retrievedStatus = await cache.getPartStatus(testItemId, partIndex);
      expect(retrievedStatus).toBe(status);
    });

    it('should return null for non-existent part', async () => {
      const status = await cache.getPartStatus(testItemId, 999);
      expect(status).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should clean up all parts and metadata for an item', async () => {
      // Store some parts
      await cache.storePartMarkdown(testItemId, 0, '# Part 0');
      await cache.storePartMarkdown(testItemId, 1, '# Part 1');
      
      // Verify parts exist
      const partsBeforeCleanup = await cache.getAllParts(testItemId);
      expect(partsBeforeCleanup.length).toBeGreaterThan(0);
      
      // Clean up
      await cache.cleanup(testItemId);
      
      // Verify parts are gone
      const partsAfterCleanup = await cache.getAllParts(testItemId);
      expect(partsAfterCleanup).toEqual([]);
    });
  });

  describe('getMetadata', () => {
    it('should retrieve metadata for an item', async () => {
      // Store a part first
      await cache.storePartMarkdown(testItemId, 0, '# Test Content');
      
      // Get metadata
      const metadata = await cache.getMetadata(testItemId);
      
      expect(metadata).toBeDefined();
      expect(metadata.itemId).toBe(testItemId);
      expect(metadata.totalParts).toBe(1);
      expect(metadata.completedParts).toContain(0);
      expect(metadata.status).toBe('completed');
    });

    it('should return null for non-existent item', async () => {
      const metadata = await cache.getMetadata('non-existent-item');
      expect(metadata).toBeNull();
    });
  });
});