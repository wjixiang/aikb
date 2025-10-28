import { v4 as uuidv4 } from 'uuid';
import createLoggerWithPrefix from '@aikb/log-management/logger';
import {
  IPdfPartTracker,
  PdfPartTrackingData,
} from './pdf-part-tracker.interface';

const logger = createLoggerWithPrefix('PdfPartTracker');

/**
 * In-memory implementation of PDF part tracker
 * Suitable for development and testing environments
 */
export class PdfPartTracker implements IPdfPartTracker {
  private trackingSessions: Map<string, PdfPartTrackingData> = new Map();

  /**
   * Initialize a new PDF part tracking session
   */
  async initializeTracking(pdfId: string, totalParts: number): Promise<string> {
    const trackingId = uuidv4();
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

    this.trackingSessions.set(trackingId, trackingData);
    logger.info(
      `Initialized tracking for PDF ${pdfId} with ${totalParts} parts, tracking ID: ${trackingId}`,
    );

    return trackingId;
  }

  /**
   * Mark a part as completed
   */
  async markPartCompleted(
    trackingId: string,
    partNumber: number,
    partData?: any,
  ): Promise<boolean> {
    const trackingData = this.trackingSessions.get(trackingId);

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

    this.trackingSessions.set(trackingId, trackingData);
    logger.debug(
      `Marked part ${partNumber} as completed for tracking ID: ${trackingId}`,
    );

    return true;
  }

  /**
   * Check if all parts are completed
   */
  async isTrackingComplete(trackingId: string): Promise<boolean> {
    const trackingData = this.trackingSessions.get(trackingId);

    if (!trackingData) {
      logger.warn(`Tracking session not found: ${trackingId}`);
      return false;
    }

    return trackingData.isComplete;
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
    const trackingData = this.trackingSessions.get(trackingId);

    if (!trackingData) {
      logger.warn(`Tracking session not found: ${trackingId}`);
      throw new Error(`Tracking session not found: ${trackingId}`);
    }

    return {
      totalParts: trackingData.totalParts,
      completedParts: trackingData.completedParts,
      isComplete: trackingData.isComplete,
      completedPartNumbers: [...trackingData.completedPartNumbers],
    };
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
    const trackingData = this.trackingSessions.get(trackingId);

    if (!trackingData) {
      logger.warn(`Tracking session not found: ${trackingId}`);
      throw new Error(`Tracking session not found: ${trackingId}`);
    }

    return [...trackingData.parts];
  }

  /**
   * Clean up tracking session
   */
  async cleanupTracking(trackingId: string): Promise<boolean> {
    const trackingData = this.trackingSessions.get(trackingId);

    if (!trackingData) {
      logger.warn(`Tracking session not found: ${trackingId}`);
      return false;
    }

    this.trackingSessions.delete(trackingId);
    logger.info(`Cleaned up tracking session: ${trackingId}`);

    return true;
  }

  /**
   * Get all active tracking sessions (for debugging/monitoring)
   */
  getAllTrackingSessions(): Map<string, PdfPartTrackingData> {
    return new Map(this.trackingSessions);
  }

  /**
   * Get tracking session by PDF ID
   */
  async getTrackingByPdfId(pdfId: string): Promise<PdfPartTrackingData | null> {
    for (const [trackingId, trackingData] of this.trackingSessions) {
      if (trackingData.pdfId === pdfId) {
        return trackingData;
      }
    }
    return null;
  }
}
