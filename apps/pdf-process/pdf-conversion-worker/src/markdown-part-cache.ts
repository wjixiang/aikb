/**
 * Markdown part cache entry
 */
export interface MarkdownPartCacheEntry {
  itemId: string;
  partIndex: number;
  markdownContent: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Markdown Part Cache interface
 * Caches markdown content for PDF parts
 */
export interface MarkdownPartCache {
  /**
   * Initialize the cache
   */
  initialize(): Promise<void>;

  /**
   * Cache markdown content for a PDF part
   */
  cacheMarkdownPart(
    itemId: string,
    partIndex: number,
    markdownContent: string,
  ): Promise<void>;

  /**
   * Get cached markdown content for a PDF part
   */
  getCachedMarkdownPart(
    itemId: string,
    partIndex: number,
  ): Promise<MarkdownPartCacheEntry | null>;

  /**
   * Get all cached markdown parts for an item
   */
  getAllCachedMarkdownParts(itemId: string): Promise<MarkdownPartCacheEntry[]>;

  /**
   * Check if a PDF part is cached
   */
  isMarkdownPartCached(itemId: string, partIndex: number): Promise<boolean>;

  /**
   * Remove cached markdown content for a PDF part
   */
  removeCachedMarkdownPart(itemId: string, partIndex: number): Promise<void>;

  /**
   * Remove all cached markdown content for an item
   */
  removeAllCachedMarkdownParts(itemId: string): Promise<void>;

  /**
   * Clean up old cache entries
   */
  cleanup(olderThanHours: number): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    totalEntries: number;
    totalItems: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }>;
}
