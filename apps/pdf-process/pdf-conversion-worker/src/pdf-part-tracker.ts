/**
 * PDF processing status
 */
export interface PdfProcessingStatus {
  itemId: string;
  totalParts: number;
  completedParts: number;
  failedParts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PDF part status
 */
export interface PdfPartStatus {
  itemId: string;
  partIndex: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PDF Part Tracker interface
 * Tracks the status of PDF parts during processing
 */
export interface IPdfPartTracker {
  /**
   * Initialize PDF processing for an item
   */
  initializePdfProcessing(itemId: string, totalParts: number): Promise<void>;

  /**
   * Get PDF processing status for an item
   */
  getPdfProcessingStatus(itemId: string): Promise<PdfProcessingStatus | null>;

  /**
   * Update part status
   */
  updatePartStatus(
    itemId: string,
    partIndex: number,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    error?: string,
  ): Promise<void>;

  /**
   * Get part status
   */
  getPartStatus(
    itemId: string,
    partIndex: number,
  ): Promise<PdfPartStatus | null>;

  /**
   * Get all part statuses for an item
   */
  getAllPartStatuses(itemId: string): Promise<PdfPartStatus[]>;

  /**
   * Mark PDF processing as completed
   */
  markPdfProcessingCompleted(itemId: string): Promise<void>;

  /**
   * Mark PDF processing as failed
   */
  markPdfProcessingFailed(itemId: string, error: string): Promise<void>;

  /**
   * Clean up old processing records
   */
  cleanup(olderThanHours: number): Promise<void>;
}
