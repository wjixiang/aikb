/**
 * PDF part tracking interface
 * Manages tracking of PDF parts during conversion process
 */
export interface IPdfPartTracker {
  /**
   * Initialize a new PDF part tracking session
   * @param pdfId - Unique identifier for the PDF
   * @param totalParts - Total number of parts expected
   * @returns Promise resolving to the tracking session ID
   */
  initializeTracking(pdfId: string, totalParts: number): Promise<string>;

  /**
   * Mark a part as completed
   * @param trackingId - Tracking session ID
   * @param partNumber - Part number that was completed
   * @param partData - Optional data about the completed part
   * @returns Promise resolving to success status
   */
  markPartCompleted(
    trackingId: string,
    partNumber: number,
    partData?: any
  ): Promise<boolean>;

  /**
   * Check if all parts are completed
   * @param trackingId - Tracking session ID
   * @returns Promise resolving to completion status
   */
  isTrackingComplete(trackingId: string): Promise<boolean>;

  /**
   * Get tracking progress
   * @param trackingId - Tracking session ID
   * @returns Promise resolving to progress information
   */
  getTrackingProgress(trackingId: string): Promise<{
    totalParts: number;
    completedParts: number;
    isComplete: boolean;
    completedPartNumbers: number[];
  }>;

  /**
   * Get all completed parts data
   * @param trackingId - Tracking session ID
   * @returns Promise resolving to array of completed parts data
   */
  getCompletedParts(trackingId: string): Promise<Array<{
    partNumber: number;
    data?: any;
    completedAt: Date;
  }>>;

  /**
   * Clean up tracking session
   * @param trackingId - Tracking session ID
   * @returns Promise resolving to success status
   */
  cleanupTracking(trackingId: string): Promise<boolean>;
}

/**
 * PDF part tracking data structure
 */
export interface PdfPartTrackingData {
  trackingId: string;
  pdfId: string;
  totalParts: number;
  completedParts: number;
  isComplete: boolean;
  completedPartNumbers: number[];
  parts: Array<{
    partNumber: number;
    data?: any;
    completedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}