import createLoggerWithPrefix from 'log-management/logger';
import { IMarkdownPartCache } from './markdown-part-cache.interface';
import { MarkdownPartCache } from './markdown-part-cache-impl';

const logger = createLoggerWithPrefix('MarkdownPartCacheFactory');

/**
 * Factory for creating markdown part cache instances
 */
export class MarkdownPartCacheFactory {
  private static instance: IMarkdownPartCache | null = null;

  /**
   * Get a markdown part cache instance based on environment configuration
   * @returns IMarkdownPartCache instance
   */
  static getInstance(): IMarkdownPartCache {
    if (this.instance) {
      return this.instance;
    }

    const cacheType = process.env['MARKDOWN_PART_CACHE_TYPE'] || 'memory';

    switch (cacheType.toLowerCase()) {
      case 'memory':
      default:
        logger.info('Creating in-memory markdown part cache');
        this.instance = new MarkdownPartCache();
        break;
    }

    return this.instance;
  }

  /**
   * Create a new markdown part cache instance with specific type
   * @param type - Type of cache to create ('memory')
   * @returns IMarkdownPartCache instance
   */
  static createCache(type: 'memory'): IMarkdownPartCache {
    switch (type) {
      case 'memory':
      default:
        logger.info('Creating in-memory markdown part cache');
        return new MarkdownPartCache();
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * Get cache type from environment
   * @returns string - Current cache type
   */
  static getCacheType(): string {
    return process.env['MARKDOWN_PART_CACHE_TYPE'] || 'memory';
  }
}

/**
 * Convenience function to get a markdown part cache instance
 * @returns IMarkdownPartCache instance
 */
export function getMarkdownPartCache(): IMarkdownPartCache {
  return MarkdownPartCacheFactory.getInstance();
}

/**
 * Convenience function to create a specific type of markdown part cache
 * @param type - Type of cache to create
 * @returns IMarkdownPartCache instance
 */
export function createMarkdownPartCache(type: 'memory'): IMarkdownPartCache {
  return MarkdownPartCacheFactory.createCache(type);
}
