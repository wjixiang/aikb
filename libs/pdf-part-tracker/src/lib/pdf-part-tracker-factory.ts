import createLoggerWithPrefix from '@aikb/log-management/logger';
import { IPdfPartTracker } from './pdf-part-tracker.interface';
import { PdfPartTracker } from './pdf-part-tracker-impl';
import { PdfPartTrackerElasticsearch } from './pdf-part-tracker-impl-elasticsearch';

const logger = createLoggerWithPrefix('PdfPartTrackerFactory');

/**
 * Factory for creating PDF part tracker instances
 */
export class PdfPartTrackerFactory {
  private static instance: IPdfPartTracker | null = null;

  /**
   * Get a PDF part tracker instance based on environment configuration
   * @returns IPdfPartTracker instance
   */
  static getInstance(): IPdfPartTracker {
    if (this.instance) {
      return this.instance;
    }

    const trackerType = process.env['PDF_PART_TRACKER_TYPE'] || 'memory';

    switch (trackerType.toLowerCase()) {
      case 'elasticsearch':
        logger.info('Creating Elasticsearch PDF part tracker');
        this.instance = new PdfPartTrackerElasticsearch();
        break;

      case 'memory':
      default:
        logger.info('Creating in-memory PDF part tracker');
        this.instance = new PdfPartTracker();
        break;
    }

    return this.instance;
  }

  /**
   * Create a new PDF part tracker instance with specific type
   * @param type - Type of tracker to create ('memory' or 'elasticsearch')
   * @param options - Configuration options for the tracker
   * @returns IPdfPartTracker instance
   */
  static createTracker(
    type: 'memory' | 'elasticsearch',
    options?: {
      elasticsearchUrl?: string;
      indexName?: string;
    },
  ): IPdfPartTracker {
    switch (type) {
      case 'elasticsearch':
        logger.info(
          'Creating Elasticsearch PDF part tracker with custom options',
        );
        return new PdfPartTrackerElasticsearch(
          options?.elasticsearchUrl,
          options?.indexName,
        );

      case 'memory':
      default:
        logger.info('Creating in-memory PDF part tracker');
        return new PdfPartTracker();
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * Get tracker type from environment
   * @returns string - Current tracker type
   */
  static getTrackerType(): string {
    return process.env['PDF_PART_TRACKER_TYPE'] || 'memory';
  }

  /**
   * Check if Elasticsearch is configured
   * @returns boolean - True if Elasticsearch is properly configured
   */
  static isElasticsearchConfigured(): boolean {
    const elasticsearchUrl = process.env['ELASTICSEARCH_URL'];
    const indexName = process.env['PDF_PART_TRACKING_INDEX'];

    return !!(elasticsearchUrl && indexName);
  }
}

/**
 * Convenience function to get a PDF part tracker instance
 * @returns IPdfPartTracker instance
 */
export function getPdfPartTracker(): IPdfPartTracker {
  return PdfPartTrackerFactory.getInstance();
}

/**
 * Convenience function to create a specific type of PDF part tracker
 * @param type - Type of tracker to create
 * @param options - Configuration options
 * @returns IPdfPartTracker instance
 */
export function createPdfPartTracker(
  type: 'memory' | 'elasticsearch',
  options?: {
    elasticsearchUrl?: string;
    indexName?: string;
  },
): IPdfPartTracker {
  return PdfPartTrackerFactory.createTracker(type, options);
}
