import { Client } from '@elastic/elasticsearch';
import createLoggerWithPrefix from 'log-management/logger';
import {
  IPdfPartTracker,
  PdfPartTrackingData,
} from './pdf-part-tracker.interface';

const logger = createLoggerWithPrefix('PdfPartTrackerElasticsearch');

/**
 * Elasticsearch implementation of PDF part tracker
 * Suitable for production environments with distributed processing
 */
export class PdfPartTrackerElasticsearch implements IPdfPartTracker {
  private client: Client;
  private indexName: string;

  constructor(
    elasticsearchUrl: string = process.env['ELASTICSEARCH_URL'] ||
      'http://localhost:9200',
    indexName: string = process.env['PDF_PART_TRACKING_INDEX'] ||
      'pdf-part-tracking',
  ) {
    this.client = new Client({ node: elasticsearchUrl });
    this.indexName = indexName;
    this.initializeIndex();
  }

  /**
   * Initialize the Elasticsearch index if it doesn't exist
   */
  private async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            properties: {
              trackingId: { type: 'keyword' },
              pdfId: { type: 'keyword' },
              totalParts: { type: 'integer' },
              completedParts: { type: 'integer' },
              isComplete: { type: 'boolean' },
              completedPartNumbers: { type: 'integer' },
              parts: {
                type: 'nested',
                properties: {
                  partNumber: { type: 'integer' },
                  data: { type: 'object' },
                  completedAt: { type: 'date' },
                },
              },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        });
        logger.info(`Created Elasticsearch index: ${this.indexName}`);
      }
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch index:', error);
      throw error;
    }
  }

  /**
   * Initialize a new PDF part tracking session
   */
  async initializeTracking(pdfId: string, totalParts: number): Promise<string> {
    const trackingId = `tracking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const trackingData: PdfPartTrackingData = {
      trackingId,
      pdfId,
      totalParts,
      completedParts: 0,
      isComplete: false,
      completedPartNumbers: [],
      parts: [],
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.client.index({
        index: this.indexName,
        id: trackingId,
        body: trackingData,
      });

      logger.info(
        `Initialized tracking for PDF ${pdfId} with ${totalParts} parts, tracking ID: ${trackingId}`,
      );
      return trackingId;
    } catch (error) {
      logger.error('Failed to initialize tracking:', error);
      throw error;
    }
  }

  /**
   * Mark a part as completed
   */
  async markPartCompleted(
    trackingId: string,
    partNumber: number,
    partData?: any,
  ): Promise<boolean> {
    try {
      // Get current tracking data
      const getResult = await this.client.get({
        index: this.indexName,
        id: trackingId,
      });

      const trackingData = getResult._source as PdfPartTrackingData;

      if (!trackingData) {
        logger.warn(`Tracking session not found: ${trackingId}`);
        return false;
      }

      // Check if part is already completed
      if (trackingData.completedPartNumbers.includes(partNumber)) {
        logger.warn(
          `Part ${partNumber} already completed for tracking ID: ${trackingId}`,
        );
        return false;
      }

      // Add completed part
      const completedPart = {
        partNumber,
        data: partData,
        completedAt: new Date(),
      };

      trackingData.parts.push(completedPart);
      trackingData.completedPartNumbers.push(partNumber);
      trackingData.completedParts++;
      trackingData.updatedAt = new Date();

      // Check if all parts are completed
      if (trackingData.completedParts >= trackingData.totalParts) {
        trackingData.isComplete = true;
        logger.info(`All parts completed for tracking ID: ${trackingId}`);
      }

      // Update the document
      await this.client.update({
        index: this.indexName,
        id: trackingId,
        doc: trackingData,
      });

      logger.debug(
        `Marked part ${partNumber} as completed for tracking ID: ${trackingId}`,
      );
      return true;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        logger.warn(`Tracking session not found: ${trackingId}`);
        return false;
      }
      logger.error('Failed to mark part as completed:', error);
      throw error;
    }
  }

  /**
   * Check if all parts are completed
   */
  async isTrackingComplete(trackingId: string): Promise<boolean> {
    try {
      const getResult = await this.client.get({
        index: this.indexName,
        id: trackingId,
      });

      const trackingData = getResult._source as PdfPartTrackingData;
      return trackingData?.isComplete || false;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        logger.warn(`Tracking session not found: ${trackingId}`);
        return false;
      }
      logger.error('Failed to check tracking completion:', error);
      throw error;
    }
  }

  /**
   * Get tracking progress
   */
  async getTrackingProgress(trackingId: string): Promise<{
    totalParts: number;
    completedParts: number;
    isComplete: boolean;
    completedPartNumbers: number[];
  }> {
    try {
      const getResult = await this.client.get({
        index: this.indexName,
        id: trackingId,
      });

      const trackingData = getResult._source as PdfPartTrackingData;

      if (!trackingData) {
        throw new Error(`Tracking session not found: ${trackingId}`);
      }

      return {
        totalParts: trackingData.totalParts,
        completedParts: trackingData.completedParts,
        isComplete: trackingData.isComplete,
        completedPartNumbers: [...trackingData.completedPartNumbers],
      };
    } catch (error) {
      if ((error as any).statusCode === 404) {
        logger.warn(`Tracking session not found: ${trackingId}`);
        throw new Error(`Tracking session not found: ${trackingId}`);
      }
      logger.error('Failed to get tracking progress:', error);
      throw error;
    }
  }

  /**
   * Get all completed parts data
   */
  async getCompletedParts(trackingId: string): Promise<
    Array<{
      partNumber: number;
      data?: any;
      completedAt: Date;
    }>
  > {
    try {
      const getResult = await this.client.get({
        index: this.indexName,
        id: trackingId,
      });

      const trackingData = getResult._source as PdfPartTrackingData;

      if (!trackingData) {
        throw new Error(`Tracking session not found: ${trackingId}`);
      }

      return [...trackingData.parts];
    } catch (error) {
      if ((error as any).statusCode === 404) {
        logger.warn(`Tracking session not found: ${trackingId}`);
        throw new Error(`Tracking session not found: ${trackingId}`);
      }
      logger.error('Failed to get completed parts:', error);
      throw error;
    }
  }

  /**
   * Clean up tracking session
   */
  async cleanupTracking(trackingId: string): Promise<boolean> {
    try {
      await this.client.delete({
        index: this.indexName,
        id: trackingId,
      });

      logger.info(`Cleaned up tracking session: ${trackingId}`);
      return true;
    } catch (error) {
      if ((error as any).statusCode === 404) {
        logger.warn(`Tracking session not found: ${trackingId}`);
        return false;
      }
      logger.error('Failed to cleanup tracking session:', error);
      throw error;
    }
  }

  /**
   * Get tracking session by PDF ID
   */
  async getTrackingByPdfId(pdfId: string): Promise<PdfPartTrackingData | null> {
    try {
      const searchResult = await this.client.search({
        index: this.indexName,
        query: {
          term: {
            pdfId: pdfId,
          },
        },
        sort: [
          {
            createdAt: {
              order: 'desc',
            },
          },
        ],
        size: 1,
      });

      const hits = searchResult.hits.hits;
      if (hits.length === 0) {
        return null;
      }

      return hits[0]._source as PdfPartTrackingData;
    } catch (error) {
      logger.error('Failed to get tracking by PDF ID:', error);
      throw error;
    }
  }

  /**
   * Close the Elasticsearch client
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}
