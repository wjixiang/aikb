import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarkdownPartCache } from './markdown-part-cache-impl';
import { MarkdownPartCacheFactory } from './markdown-part-cache-factory';
import { IMarkdownPartCache } from './markdown-part-cache.interface';

describe('MarkdownPartCache', () => {
  let cache: IMarkdownPartCache;

  beforeEach(() => {
    cache = new MarkdownPartCache();
  });

  afterEach(() => {
    MarkdownPartCacheFactory.resetInstance();
  });

  it('should store and retrieve a markdown part', async () => {
    const result = await cache.storePart(
      'test-pdf-123',
      1,
      '# Part 1 Content',
      { title: 'Part 1' },
    );
    expect(result).toBe(true);

    const part = await cache.getPart('test-pdf-123', 1);
    expect(part).not.toBeNull();
    expect(part!.content).toBe('# Part 1 Content');
    expect(part!.metadata).toEqual({ title: 'Part 1' });
    expect(part!.cachedAt).toBeInstanceOf(Date);
  });

  it('should retrieve all parts for a PDF', async () => {
    await cache.storePart('test-pdf-123', 1, '# Part 1 Content', {
      title: 'Part 1',
    });
    await cache.storePart('test-pdf-123', 2, '# Part 2 Content', {
      title: 'Part 2',
    });
    await cache.storePart('test-pdf-123', 3, '# Part 3 Content', {
      title: 'Part 3',
    });

    const allParts = await cache.getAllParts('test-pdf-123');
    expect(allParts).toHaveLength(3);
    expect(allParts[0].partNumber).toBe(1);
    expect(allParts[0].content).toBe('# Part 1 Content');
    expect(allParts[1].partNumber).toBe(2);
    expect(allParts[1].content).toBe('# Part 2 Content');
    expect(allParts[2].partNumber).toBe(3);
    expect(allParts[2].content).toBe('# Part 3 Content');
  });

  it('should check if a part exists', async () => {
    await cache.storePart('test-pdf-123', 1, '# Part 1 Content');

    const exists = await cache.hasPart('test-pdf-123', 1);
    expect(exists).toBe(true);

    const notExists = await cache.hasPart('test-pdf-123', 2);
    expect(notExists).toBe(false);
  });

  it('should remove a part from the cache', async () => {
    await cache.storePart('test-pdf-123', 1, '# Part 1 Content');
    await cache.storePart('test-pdf-123', 2, '# Part 2 Content');

    const result = await cache.removePart('test-pdf-123', 1);
    expect(result).toBe(true);

    const part = await cache.getPart('test-pdf-123', 1);
    expect(part).toBeNull();

    const remainingParts = await cache.getAllParts('test-pdf-123');
    expect(remainingParts).toHaveLength(1);
    expect(remainingParts[0].partNumber).toBe(2);
  });

  it('should remove all parts for a PDF', async () => {
    await cache.storePart('test-pdf-123', 1, '# Part 1 Content');
    await cache.storePart('test-pdf-123', 2, '# Part 2 Content');
    await cache.storePart('test-pdf-123', 3, '# Part 3 Content');

    const removedCount = await cache.removeAllParts('test-pdf-123');
    expect(removedCount).toBe(3);

    const allParts = await cache.getAllParts('test-pdf-123');
    expect(allParts).toHaveLength(0);
  });

  it('should handle non-existent parts gracefully', async () => {
    const part = await cache.getPart('non-existent-pdf', 1);
    expect(part).toBeNull();

    const allParts = await cache.getAllParts('non-existent-pdf');
    expect(allParts).toHaveLength(0);

    const exists = await cache.hasPart('non-existent-pdf', 1);
    expect(exists).toBe(false);

    const removed = await cache.removePart('non-existent-pdf', 1);
    expect(removed).toBe(false);

    const removedCount = await cache.removeAllParts('non-existent-pdf');
    expect(removedCount).toBe(0);
  });

  it('should provide cache statistics', async () => {
    await cache.storePart('test-pdf-123', 1, '# Part 1 Content');
    await cache.storePart('test-pdf-123', 2, '# Part 2 Content');
    await cache.storePart('test-pdf-456', 1, '# Part 1 Content');

    const stats = await cache.getStats();
    expect(stats.totalCachedParts).toBe(3);
    expect(stats.totalCachedPdfs).toBe(2);
    expect(stats.cacheSize).toBe(3);
  });

  it('should clear the entire cache', async () => {
    await cache.storePart('test-pdf-123', 1, '# Part 1 Content');
    await cache.storePart('test-pdf-123', 2, '# Part 2 Content');
    await cache.storePart('test-pdf-456', 1, '# Part 1 Content');

    const result = await cache.clear();
    expect(result).toBe(true);

    const stats = await cache.getStats();
    expect(stats.totalCachedParts).toBe(0);
    expect(stats.totalCachedPdfs).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });
});

describe('MarkdownPartCacheFactory', () => {
  afterEach(() => {
    MarkdownPartCacheFactory.resetInstance();
  });

  it('should create in-memory cache by default', () => {
    const cache = MarkdownPartCacheFactory.getInstance();
    expect(cache).toBeInstanceOf(MarkdownPartCache);
  });

  it('should create in-memory cache when specified', () => {
    const cache = MarkdownPartCacheFactory.createCache('memory');
    expect(cache).toBeInstanceOf(MarkdownPartCache);
  });

  it('should return singleton instance', () => {
    const cache1 = MarkdownPartCacheFactory.getInstance();
    const cache2 = MarkdownPartCacheFactory.getInstance();
    expect(cache1).toBe(cache2);
  });

  it('should reset singleton instance', () => {
    const cache1 = MarkdownPartCacheFactory.getInstance();
    MarkdownPartCacheFactory.resetInstance();
    const cache2 = MarkdownPartCacheFactory.getInstance();
    expect(cache1).not.toBe(cache2);
  });

  it('should return cache type', () => {
    expect(MarkdownPartCacheFactory.getCacheType()).toBe('memory');
  });
});
