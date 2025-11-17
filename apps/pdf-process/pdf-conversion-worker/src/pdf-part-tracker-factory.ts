import { IPdfPartTracker } from './pdf-part-tracker.js';
import { PdfPartTrackerImpl } from './pdf-part-tracker-impl.js';
import { PdfPartTrackerElasticsearchImpl } from './pdf-part-tracker-impl-elasticsearch.js';
import createLoggerWithPrefix from 'log-management/logger';

const logger = createLoggerWithPrefix('PdfPartTrackerFactory');

/**
 * PDF部分状态跟踪器工厂
 */
export class PdfPartTrackerFactory {
  private static instance: IPdfPartTracker | null = null;

  /**
   * 获取PDF部分状态跟踪器单例实例
   */
  static getInstance(): IPdfPartTracker {
    if (!this.instance) {
      const storageType = process.env.PDF_PART_TRACKER_STORAGE || 'mongodb';
      logger.info(
        `Creating new PDF part tracker instance with ${storageType} storage`,
      );

      if (storageType === 'elasticsearch') {
        const elasticsearchUrl =
          process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
        this.instance = new PdfPartTrackerElasticsearchImpl(elasticsearchUrl);
      } else {
        // 默认使用MongoDB
        this.instance = new PdfPartTrackerImpl();
      }
    } else {
      logger.debug('Returning existing PDF part tracker instance');
    }
    return this.instance!;
  }

  /**
   * 获取指定存储类型的PDF部分状态跟踪器实例
   */
  static getInstanceWithStorage(
    storageType: 'mongodb' | 'elasticsearch',
    elasticsearchUrl?: string,
  ): IPdfPartTracker {
    logger.info(
      `Creating new PDF part tracker instance with ${storageType} storage`,
    );

    if (storageType === 'elasticsearch') {
      const url =
        elasticsearchUrl ||
        process.env.ELASTICSEARCH_URL ||
        'http://elasticsearch:9200';
      return new PdfPartTrackerElasticsearchImpl(url);
    } else {
      return new PdfPartTrackerImpl();
    }
  }

  /**
   * 设置自定义的PDF部分状态跟踪器实例（主要用于测试）
   */
  static setInstance(instance: IPdfPartTracker): void {
    logger.info('Setting custom PDF part tracker instance');
    this.instance = instance;
  }

  /**
   * 重置单例实例（主要用于测试）
   */
  static resetInstance(): void {
    logger.info('Resetting PDF part tracker instance');
    this.instance = null;
  }
}

/**
 * 获取PDF部分状态跟踪器实例的便捷函数
 */
export function getPdfPartTracker(): IPdfPartTracker {
  return PdfPartTrackerFactory.getInstance();
}

/**
 * 获取指定存储类型的PDF部分状态跟踪器实例的便捷函数
 */
export function getPdfPartTrackerWithStorage(
  storageType: 'mongodb' | 'elasticsearch',
  elasticsearchUrl?: string,
): IPdfPartTracker {
  return PdfPartTrackerFactory.getInstanceWithStorage(
    storageType,
    elasticsearchUrl,
  );
}
