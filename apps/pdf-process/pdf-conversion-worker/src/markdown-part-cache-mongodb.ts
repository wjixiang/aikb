import {
  MarkdownPartCache,
  MarkdownPartCacheEntry,
} from './markdown-part-cache';
import createLoggerWithPrefix from 'log-management/logger';

const logger = createLoggerWithPrefix('MongoDBMarkdownPartCache');

/**
 * In-memory implementation of Markdown part cache for simplicity
 * In a production environment, this would be replaced with a proper MongoDB implementation
 */
export class MongoDBMarkdownPartCache implements MarkdownPartCache {
  private cacheEntries = new Map<string, MarkdownPartCacheEntry>();
  private isInitialized = false;

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // In a real implementation, this would initialize database connections
      this.isInitialized = true;
      logger.info('Markdown part cache initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Markdown part cache:', error);
      throw error;
    }
  }

  /**
   * Ensure initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Cache markdown content for a PDF part
   */
  async cacheMarkdownPart(
    itemId: string,
    partIndex: number,
    markdownContent: string,
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const now = new Date();
      const cacheKey = `${itemId}-${partIndex}`;

      const cacheEntry: MarkdownPartCacheEntry = {
        itemId,
        partIndex,
        markdownContent,
        createdAt: now,
        updatedAt: now,
      };

      this.cacheEntries.set(cacheKey, cacheEntry);
      logger.debug(`Cached markdown part ${partIndex} for item ${itemId}`);
    } catch (error) {
      logger.error(
        `Failed to cache markdown part for item ${itemId}, part ${partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get cached markdown content for a PDF part
   */
  async getCachedMarkdownPart(
    itemId: string,
    partIndex: number,
  ): Promise<MarkdownPartCacheEntry | null> {
    await this.ensureInitialized();

    try {
      const cacheKey = `${itemId}-${partIndex}`;
      return this.cacheEntries.get(cacheKey) || null;
    } catch (error) {
      logger.error(
        `Failed to get cached markdown part for item ${itemId}, part ${partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all cached markdown parts for an item
   */
  async getAllCachedMarkdownParts(
    itemId: string,
  ): Promise<MarkdownPartCacheEntry[]> {
    await this.ensureInitialized();

    try {
      const parts: MarkdownPartCacheEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        // Reasonable limit
        const cacheKey = `${itemId}-${i}`;
        const cacheEntry = this.cacheEntries.get(cacheKey);
        if (cacheEntry) {
          parts.push(cacheEntry);
        } else {
          // Stop when we can't find more parts
          if (parts.length > 0) break;
        }
      }
      return parts.sort((a, b) => a.partIndex - b.partIndex);
    } catch (error) {
      logger.error(
        `Failed to get all cached markdown parts for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Check if a PDF part is cached
   */
  async isMarkdownPartCached(
    itemId: string,
    partIndex: number,
  ): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const cacheKey = `${itemId}-${partIndex}`;
      return this.cacheEntries.has(cacheKey);
    } catch (error) {
      logger.error(
        `Failed to check if markdown part is cached for item ${itemId}, part ${partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove cached markdown content for a PDF part
   */
  async removeCachedMarkdownPart(
    itemId: string,
    partIndex: number,
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const cacheKey = `${itemId}-${partIndex}`;
      const deleted = this.cacheEntries.delete(cacheKey);

      if (deleted) {
        logger.debug(
          `Removed cached markdown part ${partIndex} for item ${itemId}`,
        );
      } else {
        logger.warn(
          `No cached markdown part found to remove for item ${itemId}, part ${partIndex}`,
        );
      }
    } catch (error) {
      logger.error(
        `Failed to remove cached markdown part for item ${itemId}, part ${partIndex}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Remove all cached markdown content for an item
   */
  async removeAllCachedMarkdownParts(itemId: string): Promise<void> {
    await this.ensureInitialized();

    try {
      let deletedCount = 0;
      this.cacheEntries.forEach((entry, cacheKey) => {
        if (entry.itemId === itemId) {
          this.cacheEntries.delete(cacheKey);
          deletedCount++;
        }
      });

      logger.info(
        `Removed ${deletedCount} cached markdown parts for item ${itemId}`,
      );
    } catch (error) {
      logger.error(
        `Failed to remove all cached markdown parts for item ${itemId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clean up old cache entries
   */
  async cleanup(olderThanHours: number): Promise<void> {
    await this.ensureInitialized();

    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      let cleanedCount = 0;

      this.cacheEntries.forEach((entry, cacheKey) => {
        if (entry.updatedAt < cutoffTime) {
          this.cacheEntries.delete(cacheKey);
          cleanedCount++;
        }
      });

      logger.info(
        `Cleaned up ${cleanedCount} old cache entries older than ${olderThanHours} hours`,
      );
    } catch (error) {
      logger.error(`Failed to cleanup old cache entries:`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalItems: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  }> {
    await this.ensureInitialized();

    try {
      const entries = Array.from(this.cacheEntries.values());
      const itemIds = new Set(entries.map((entry) => entry.itemId));

      let oldestEntry: Date | null = null;
      let newestEntry: Date | null = null;

      if (entries.length > 0) {
        oldestEntry = entries.reduce(
          (oldest, entry) =>
            entry.createdAt < oldest ? entry.createdAt : oldest,
          entries[0].createdAt,
        );
        newestEntry = entries.reduce(
          (newest, entry) =>
            entry.createdAt > newest ? entry.createdAt : newest,
          entries[0].createdAt,
        );
      }

      return {
        totalEntries: entries.length,
        totalItems: itemIds.size,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      logger.error(`Failed to get cache statistics:`, error);
      throw error;
    }
  }
}
