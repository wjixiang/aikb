import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PdfPartTrackerImpl } from '../pdf-part-tracker-impl';
import { PdfPartTrackerElasticsearchImpl } from '../pdf-part-tracker-impl-elasticsearch';
import { IPdfPartTracker } from '../pdf-part-tracker';
import { PdfPartStatus } from '../message.types';
import { PdfPartTrackerFactory, getPdfPartTrackerWithStorage } from '../pdf-part-tracker-factory';

describe('PdfPartTracker', () => {
  let tracker: IPdfPartTracker;
  const testItemId = 'test-pdf-123';
  const testTotalParts = 5;

  beforeEach(() => {
    // Use a fresh instance for each test
    tracker = new PdfPartTrackerImpl();
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await tracker.cleanupPdfProcessing(testItemId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initializePdfProcessing', () => {
    it('should initialize PDF processing with correct number of parts', async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
      
      const status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status).toBeDefined();
      expect(status!.itemId).toBe(testItemId);
      expect(status!.totalParts).toBe(testTotalParts);
      expect(status!.status).toBe('pending');
      expect(status!.completedParts).toHaveLength(0);
      expect(status!.failedParts).toHaveLength(0);
      expect(status!.processingParts).toHaveLength(0);
      expect(status!.pendingParts).toHaveLength(testTotalParts);
    });

    it('should reset existing processing status if already initialized', async () => {
      // Initialize once
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);
      
      // Initialize again
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
      
      const status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status!.completedParts).toHaveLength(0);
      expect(status!.status).toBe('pending');
    });
  });

  describe('updatePartStatus', () => {
    beforeEach(async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    it('should update part status to processing', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.PROCESSING);
      
      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.PROCESSING);
      expect(allParts[0].startTime).toBeDefined();
    });

    it('should update part status to completed', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.PROCESSING);
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);
      
      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.COMPLETED);
      expect(allParts[0].endTime).toBeDefined();
      
      const completedParts = await tracker.getCompletedParts(testItemId);
      expect(completedParts).toContain(0);
    });

    it('should update part status to failed', async () => {
      const errorMessage = 'Test error';
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.FAILED, errorMessage);
      
      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.FAILED);
      expect(allParts[0].error).toBe(errorMessage);
      expect(allParts[0].endTime).toBeDefined();
      
      const failedParts = await tracker.getFailedParts(testItemId);
      expect(failedParts).toContain(0);
    });

    it('should update overall status when parts are processed', async () => {
      // Start processing
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.PROCESSING);
      let status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status!.status).toBe('processing');
      
      // Complete a part
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);
      status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status!.status).toBe('processing');
      expect(status!.completedParts).toContain(0);
      
      // Complete all parts
      for (let i = 1; i < testTotalParts; i++) {
        await tracker.updatePartStatus(testItemId, i, PdfPartStatus.COMPLETED);
      }
      
      status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status!.status).toBe('completed');
      expect(status!.completedParts).toHaveLength(testTotalParts);
      expect(status!.endTime).toBeDefined();
    });
  });

  describe('areAllPartsCompleted', () => {
    beforeEach(async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    it('should return false when no parts are completed', async () => {
      const result = await tracker.areAllPartsCompleted(testItemId);
      expect(result).toBe(false);
    });

    it('should return false when some parts are completed', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);
      const result = await tracker.areAllPartsCompleted(testItemId);
      expect(result).toBe(false);
    });

    it('should return true when all parts are completed', async () => {
      for (let i = 0; i < testTotalParts; i++) {
        await tracker.updatePartStatus(testItemId, i, PdfPartStatus.COMPLETED);
      }
      const result = await tracker.areAllPartsCompleted(testItemId);
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPartFailed', () => {
    beforeEach(async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    it('should return false when no parts have failed', async () => {
      const result = await tracker.hasAnyPartFailed(testItemId);
      expect(result).toBe(false);
    });

    it('should return true when a part has failed', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.FAILED);
      const result = await tracker.hasAnyPartFailed(testItemId);
      expect(result).toBe(true);
    });
  });

  describe('retryFailedParts', () => {
    beforeEach(async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    it('should retry failed parts', async () => {
      // Fail some parts
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.FAILED);
      await tracker.updatePartStatus(testItemId, 1, PdfPartStatus.FAILED);
      
      const retriedParts = await tracker.retryFailedParts(testItemId);
      expect(retriedParts).toContain(0);
      expect(retriedParts).toContain(1);
      
      // Check that parts are now pending
      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.PENDING);
      expect(allParts[1].status).toBe(PdfPartStatus.PENDING);
      expect(allParts[0].retryCount).toBe(1);
      expect(allParts[1].retryCount).toBe(1);
    });
  });

  describe('getFailedPartsDetails', () => {
    beforeEach(async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    it('should return details of failed parts', async () => {
      const errorMessage = 'Test error';
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.FAILED, errorMessage);
      
      const failedParts = await tracker.getFailedPartsDetails(testItemId);
      expect(failedParts).toHaveLength(1);
      expect(failedParts[0].partIndex).toBe(0);
      expect(failedParts[0].error).toBe(errorMessage);
    });
  });

  describe('cleanup', () => {
    it('should clean up PDF processing status', async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);
      
      await tracker.cleanupPdfProcessing(testItemId);
      
      const status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status).toBeNull();
      
      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts).toHaveLength(0);
    });
  });
});

describe('PdfPartTrackerFactory', () => {
  beforeEach(() => {
    // Reset factory state before each test
    PdfPartTrackerFactory.resetInstance();
  });

  it('should return singleton instance', () => {
    const tracker1 = PdfPartTrackerFactory.getInstance();
    const tracker2 = PdfPartTrackerFactory.getInstance();
    expect(tracker1).toBe(tracker2);
  });

  it('should return MongoDB instance by default', () => {
    const tracker = PdfPartTrackerFactory.getInstance();
    expect(tracker).toBeInstanceOf(PdfPartTrackerImpl);
  });

  it('should return Elasticsearch instance when environment variable is set', () => {
    // Save original env var
    const originalEnv = process.env.PDF_PART_TRACKER_STORAGE;
    
    try {
      // Set environment variable
      process.env.PDF_PART_TRACKER_STORAGE = 'elasticsearch';
      
      // Reset factory to pick up new env var
      PdfPartTrackerFactory.resetInstance();
      
      const tracker = PdfPartTrackerFactory.getInstance();
      expect(tracker).toBeInstanceOf(PdfPartTrackerElasticsearchImpl);
    } finally {
      // Restore original env var
      process.env.PDF_PART_TRACKER_STORAGE = originalEnv;
    }
  });

  it('should allow setting custom instance', () => {
    const customTracker = new PdfPartTrackerImpl();
    PdfPartTrackerFactory.setInstance(customTracker);
    
    const tracker = PdfPartTrackerFactory.getInstance();
    expect(tracker).toBe(customTracker);
  });

  it('should allow resetting instance', () => {
    const tracker1 = PdfPartTrackerFactory.getInstance();
    PdfPartTrackerFactory.resetInstance();
    
    const tracker2 = PdfPartTrackerFactory.getInstance();
    expect(tracker1).not.toBe(tracker2);
  });

  it('should create MongoDB instance with getInstanceWithStorage', () => {
    const tracker = PdfPartTrackerFactory.getInstanceWithStorage('mongodb');
    expect(tracker).toBeInstanceOf(PdfPartTrackerImpl);
  });

  it('should create Elasticsearch instance with getInstanceWithStorage', () => {
    const tracker = PdfPartTrackerFactory.getInstanceWithStorage('elasticsearch');
    expect(tracker).toBeInstanceOf(PdfPartTrackerElasticsearchImpl);
  });

  it('should create Elasticsearch instance with custom URL', () => {
    const customUrl = 'http://custom-elasticsearch:9200';
    const tracker = PdfPartTrackerFactory.getInstanceWithStorage('elasticsearch', customUrl);
    expect(tracker).toBeInstanceOf(PdfPartTrackerElasticsearchImpl);
  });
});

describe('getPdfPartTrackerWithStorage', () => {
  it('should create MongoDB instance', () => {
    const tracker = getPdfPartTrackerWithStorage('mongodb');
    expect(tracker).toBeInstanceOf(PdfPartTrackerImpl);
  });

  it('should create Elasticsearch instance', () => {
    const tracker = getPdfPartTrackerWithStorage('elasticsearch');
    expect(tracker).toBeInstanceOf(PdfPartTrackerElasticsearchImpl);
  });

  it('should create Elasticsearch instance with custom URL', () => {
    const customUrl = 'http://custom-elasticsearch:9200';
    const tracker = getPdfPartTrackerWithStorage('elasticsearch', customUrl);
    expect(tracker).toBeInstanceOf(PdfPartTrackerElasticsearchImpl);
  });
});