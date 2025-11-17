import { MarkdownPartCache } from './markdown-part-cache';
import { MongoDBMarkdownPartCache } from './markdown-part-cache-mongodb';
import createLoggerWithPrefix from 'log-management/logger';

const logger = createLoggerWithPrefix('MarkdownPartCacheFactory');

/**
 * Markdown部分缓存工厂
 */
export class MarkdownPartCacheFactory {
  private static instance: MarkdownPartCache | null = null;

  /**
   * 获取Markdown部分缓存单例实例
   */
  static getInstance(): MarkdownPartCache {
    if (!this.instance) {
      const storageType = process.env.MARKDOWN_PART_CACHE_STORAGE || 'mongodb';
      logger.info(
        `Creating new Markdown part cache instance with ${storageType} storage`,
      );

      if (storageType === 'mongodb') {
        this.instance = new MongoDBMarkdownPartCache();
      } else {
        // 默认使用MongoDB
        this.instance = new MongoDBMarkdownPartCache();
      }
    } else {
      logger.debug('Returning existing Markdown part cache instance');
    }
    return this.instance!;
  }

  /**
   * 获取指定存储类型的Markdown部分缓存实例
   */
  static getInstanceWithStorage(storageType: 'mongodb'): MarkdownPartCache {
    logger.info(
      `Creating new Markdown part cache instance with ${storageType} storage`,
    );

    if (storageType === 'mongodb') {
      return new MongoDBMarkdownPartCache();
    } else {
      // 默认使用MongoDB
      return new MongoDBMarkdownPartCache();
    }
  }

  /**
   * 设置自定义的Markdown部分缓存实例（主要用于测试）
   */
  static setInstance(instance: MarkdownPartCache): void {
    logger.info('Setting custom Markdown part cache instance');
    this.instance = instance;
  }

  /**
   * 重置单例实例（主要用于测试）
   */
  static resetInstance(): void {
    logger.info('Resetting Markdown part cache instance');
    this.instance = null;
  }
}

/**
 * 获取Markdown部分缓存实例的便捷函数
 */
export function getMarkdownPartCache(): MarkdownPartCache {
  return MarkdownPartCacheFactory.getInstance();
}

/**
 * 获取指定存储类型的Markdown部分缓存实例的便捷函数
 */
export function getMarkdownPartCacheWithStorage(
  storageType: 'mongodb',
): MarkdownPartCache {
  return MarkdownPartCacheFactory.getInstanceWithStorage(storageType);
}
