import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import { PdfPartTrackerElasticsearchImpl } from '../pdf-part-tracker-impl-elasticsearch';
import { IPdfPartTracker } from '../pdf-part-tracker';
import { PdfPartStatus } from '../message.types';
import { Client } from '@elastic/elasticsearch';

describe('PdfPartTrackerElasticsearchImpl', () => {
  let tracker: IPdfPartTracker;
  let client: Client;
  const testItemId = 'test-pdf-123';
  const testTotalParts = 5;
  const elasticsearchUrl =
    process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
  let elasticsearchAvailable = false;

  // Helper function to check if ElasticSearch is available
  async function isElasticSearchAvailable(url: string): Promise<boolean> {
    try {
      const testClient = new Client({
        node: url,
        auth: {
          apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
        },
      });
      await testClient.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  beforeAll(async () => {
    // Check if ElasticSearch is available
    elasticsearchAvailable = await isElasticSearchAvailable(elasticsearchUrl);
    if (!elasticsearchAvailable) {
      console.log(
        'ElasticSearch is not available, skipping ElasticSearch implementation tests',
      );
      return;
    }

    client = new Client({
      node: elasticsearchUrl,
      auth: {
        apiKey: process.env.ELASTICSEARCH_URL_API_KEY || '',
      },
    });
  });

  afterAll(async () => {
    if (elasticsearchAvailable && client) {
      // Clean up test indices
      try {
        await client.indices.delete({
          index: ['pdf_processing_status', 'pdf_part_status'],
        });
      } catch (error: any) {
        // Ignore cleanup errors, especially if indices don't exist
        if (error?.meta?.statusCode !== 404) {
          console.error('Error cleaning up test indices:', error);
        }
      }
    }
  });

  beforeEach(() => {
    if (!elasticsearchAvailable) {
      return;
    }
    // Use a fresh instance for each test
    tracker = new PdfPartTrackerElasticsearchImpl(elasticsearchUrl);
  });

  afterEach(async () => {
    if (!elasticsearchAvailable) {
      return;
    }
    // Clean up after each test
    try {
      await tracker.cleanupPdfProcessing(testItemId);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Skip all tests if ElasticSearch is not available
  const testOrSkip = elasticsearchAvailable ? it : it.skip;

  describe('initializePdfProcessing', () => {
    testOrSkip(
      'should initialize PDF processing with correct number of parts',
      async () => {
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
      },
    );

    testOrSkip(
      'should reset existing processing status if already initialized',
      async () => {
        // Initialize once
        await tracker.initializePdfProcessing(testItemId, testTotalParts);
        await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);

        // Initialize again
        await tracker.initializePdfProcessing(testItemId, testTotalParts);

        const status = await tracker.getPdfProcessingStatus(testItemId);
        expect(status!.completedParts).toHaveLength(0);
        expect(status!.status).toBe('pending');
      },
    );
  });

  describe('updatePartStatus', () => {
    beforeEach(async () => {
      if (!elasticsearchAvailable) return;
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    testOrSkip('should update part status to processing', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.PROCESSING);

      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.PROCESSING);
      expect(allParts[0].startTime).toBeDefined();
    });

    testOrSkip('should update part status to completed', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.PROCESSING);
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);

      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.COMPLETED);
      expect(allParts[0].endTime).toBeDefined();

      const completedParts = await tracker.getCompletedParts(testItemId);
      expect(completedParts).toContain(0);
    });

    testOrSkip('should update part status to failed', async () => {
      const errorMessage = 'Test error';
      await tracker.updatePartStatus(
        testItemId,
        0,
        PdfPartStatus.FAILED,
        errorMessage,
      );

      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts[0].status).toBe(PdfPartStatus.FAILED);
      expect(allParts[0].error).toBe(errorMessage);
      expect(allParts[0].endTime).toBeDefined();

      const failedParts = await tracker.getFailedParts(testItemId);
      expect(failedParts).toContain(0);
    });

    testOrSkip(
      'should update overall status when parts are processed',
      async () => {
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
          await tracker.updatePartStatus(
            testItemId,
            i,
            PdfPartStatus.COMPLETED,
          );
        }

        status = await tracker.getPdfProcessingStatus(testItemId);
        expect(status!.status).toBe('completed');
        expect(status!.completedParts).toHaveLength(testTotalParts);
        expect(status!.endTime).toBeDefined();
      },
    );
  });

  describe('areAllPartsCompleted', () => {
    beforeEach(async () => {
      if (!elasticsearchAvailable) return;
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    testOrSkip('should return false when no parts are completed', async () => {
      const result = await tracker.areAllPartsCompleted(testItemId);
      expect(result).toBe(false);
    });

    testOrSkip(
      'should return false when some parts are completed',
      async () => {
        await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);
        const result = await tracker.areAllPartsCompleted(testItemId);
        expect(result).toBe(false);
      },
    );

    testOrSkip('should return true when all parts are completed', async () => {
      for (let i = 0; i < testTotalParts; i++) {
        await tracker.updatePartStatus(testItemId, i, PdfPartStatus.COMPLETED);
      }
      const result = await tracker.areAllPartsCompleted(testItemId);
      expect(result).toBe(true);
    });
  });

  describe('hasAnyPartFailed', () => {
    beforeEach(async () => {
      if (!elasticsearchAvailable) return;
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    testOrSkip('should return false when no parts have failed', async () => {
      const result = await tracker.hasAnyPartFailed(testItemId);
      expect(result).toBe(false);
    });

    testOrSkip('should return true when a part has failed', async () => {
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.FAILED);
      const result = await tracker.hasAnyPartFailed(testItemId);
      expect(result).toBe(true);
    });
  });

  describe('retryFailedParts', () => {
    beforeEach(async () => {
      if (!elasticsearchAvailable) return;
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    testOrSkip('should retry failed parts', async () => {
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
      if (!elasticsearchAvailable) return;
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
    });

    testOrSkip('should return details of failed parts', async () => {
      const errorMessage = 'Test error';
      await tracker.updatePartStatus(
        testItemId,
        0,
        PdfPartStatus.FAILED,
        errorMessage,
      );

      const failedParts = await tracker.getFailedPartsDetails(testItemId);
      expect(failedParts).toHaveLength(1);
      expect(failedParts[0].partIndex).toBe(0);
      expect(failedParts[0].error).toBe(errorMessage);
    });
  });

  describe('cleanup', () => {
    testOrSkip('should clean up PDF processing status', async () => {
      await tracker.initializePdfProcessing(testItemId, testTotalParts);
      await tracker.updatePartStatus(testItemId, 0, PdfPartStatus.COMPLETED);

      await tracker.cleanupPdfProcessing(testItemId);

      const status = await tracker.getPdfProcessingStatus(testItemId);
      expect(status).toBeNull();

      const allParts = await tracker.getAllPartStatuses(testItemId);
      expect(allParts).toHaveLength(0);
    });
  });

  describe('getAllProcessingPdfs', () => {
    testOrSkip('should return all processing PDFs', async () => {
      const testItemIds = ['test-pdf-1', 'test-pdf-2', 'test-pdf-3'];

      // Initialize multiple PDFs
      for (const itemId of testItemIds) {
        await tracker.initializePdfProcessing(itemId, 3);
      }

      // Start processing one and complete another
      await tracker.updatePartStatus(
        testItemIds[0],
        0,
        PdfPartStatus.PROCESSING,
      );
      await tracker.updatePartStatus(
        testItemIds[1],
        0,
        PdfPartStatus.COMPLETED,
      );

      const processingPdfs = await tracker.getAllProcessingPdfs();
      expect(processingPdfs).toContain(testItemIds[0]);
      expect(processingPdfs).toContain(testItemIds[1]);
      expect(processingPdfs).toContain(testItemIds[2]);
    });
  });
});
