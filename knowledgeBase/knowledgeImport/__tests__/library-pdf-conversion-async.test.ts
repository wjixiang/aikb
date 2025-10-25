import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Library from '../library';
import { S3MongoLibraryStorage } from '../library';
import { PdfProcessingStatus } from '../../../lib/rabbitmq/message.types';
import { getRabbitMQService } from '../../../lib/rabbitmq/rabbitmq.service';
import { createPdfConversionWorker } from '../../../lib/rabbitmq/pdf-conversion.worker';
import { MinerUPdfConvertor } from 'lib/pdfConvertor/MinerUPdfConvertor';

// Mock RabbitMQ service
const mockRabbitMQService = {
  isConnected: vi.fn(() => true),
  initialize: vi.fn(() => Promise.resolve()),
  publishPdfConversionRequest: vi.fn(() => Promise.resolve(true)),
  publishPdfAnalysisRequest: vi.fn(() => Promise.resolve(true)),
  consumeMessages: vi.fn(() => Promise.resolve('test-consumer-tag')),
  stopConsuming: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
};

vi.mock('../../../lib/rabbitmq/rabbitmq.service', () => ({
  getRabbitMQService: vi.fn(() => mockRabbitMQService),
}));

// Mock PDF converter
vi.mock('../PdfConvertor', () => ({
  MinerUPdfConvertor: vi.fn().mockImplementation(() => ({
    convertPdfToMarkdownFromS3: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: '# Test PDF Content\n\nThis is a test PDF converted to markdown.',
      }),
    ),
  })),
  createMinerUConvertorFromEnv: vi.fn(() => ({
    convertPdfToMarkdownFromS3: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: '# Test PDF Content\n\nThis is a test PDF converted to markdown.',
      }),
    ),
  })),
}));

describe('Library Async PDF Conversion', () => {
  let library: Library;
  let storage: S3MongoLibraryStorage;
  let mockPdfConvertor: MinerUPdfConvertor;
  let testPdfBuffer: Buffer;

  beforeEach(async () => {
    // Create test PDF buffer with unique content for each test run
    testPdfBuffer = Buffer.from(
      `test pdf content ${Date.now()} ${Math.random()}`,
    );

    // Initialize storage
    storage = new S3MongoLibraryStorage();

    // Create mock PDF converter
    mockPdfConvertor = new MinerUPdfConvertor({
      baseUrl: 'http://localhost:8000',
      token: 'test-token',
    });

    // Initialize library
    library = new Library(storage);

    // Clear any existing test data
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  async function cleanupTestData() {
    try {
      // Clean up test data if needed
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }

  describe('storePdf with async processing', () => {
    it('should create library item with pending status and queue for processing', async () => {
      const fileName = 'test-document.pdf';
      const metadata = {
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        tags: ['test', 'document'],
      };

      const result = await library.storePdf(testPdfBuffer, fileName, metadata);

      expect(result).toBeDefined();
      expect(result.metadata.title).toBe('Test Document');
      expect(result.metadata.pdfProcessingStatus).toBe(
        PdfProcessingStatus.PENDING,
      );
      expect(result.metadata.pdfProcessingStartedAt).toBeDefined();
      expect(result.metadata.pdfProcessingProgress).toBe(0);
      expect(result.metadata.pdfProcessingMessage).toBe(
        'Queued for processing',
      );

      // Verify RabbitMQ service was called
      const rabbitMQService = getRabbitMQService();
      expect(rabbitMQService.publishPdfAnalysisRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'PDF_ANALYSIS_REQUEST',
          itemId: result.metadata.id,
          fileName,

          s3Key: result.metadata.s3Key,
        }),
      );
    });

    it('should handle duplicate PDF content correctly', async () => {
      const fileName = 'duplicate-test.pdf';
      const metadata = {
        title: 'Duplicate Test',
        authors: [{ firstName: 'Jane', lastName: 'Smith' }],
      };

      // Store the same PDF twice
      const result1 = await library.storePdf(testPdfBuffer, fileName, metadata);
      const result2 = await library.storePdf(
        testPdfBuffer,
        fileName + '-2',
        metadata,
      );

      // Should return the same item for duplicate content
      expect(result1.metadata.id).toBe(result2.metadata.id);
      expect(result1.metadata.contentHash).toBe(result2.metadata.contentHash);
    });

    it('should handle RabbitMQ service failure gracefully', async () => {
      // Reset the mock to return rejection for this test
      mockRabbitMQService.publishPdfAnalysisRequest.mockRejectedValueOnce(
        new Error('RabbitMQ unavailable'),
      );

      const fileName = 'error-test.pdf';
      const metadata = {
        title: 'Error Test',
        authors: [{ firstName: 'Error', lastName: 'Test' }],
      };

      const result = await library.storePdf(testPdfBuffer, fileName, metadata);

      // Should still create the item but mark as failed
      expect(result).toBeDefined();

      // Wait a bit for the async status update to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Refresh the item to get the updated status
      const updatedItem = await library.getItem(result.metadata.id!);
      expect(updatedItem?.metadata.pdfProcessingStatus).toBe(
        PdfProcessingStatus.FAILED,
      );
      expect(updatedItem?.metadata.pdfProcessingError).toContain(
        'Failed to queue for processing',
      );
    });
  });

  describe('processing status queries', () => {
    it('should return correct processing status for an item', async () => {
      const fileName = 'status-test.pdf';
      const metadata = {
        title: 'Status Test',
        authors: [{ firstName: 'Status', lastName: 'Test' }],
      };

      const item = await library.storePdf(testPdfBuffer, fileName, metadata);
      const status = await library.getProcessingStatus(item.metadata.id!);

      expect(status).toBeDefined();
      expect(status?.status).toBe(PdfProcessingStatus.PENDING);
      expect(status?.progress).toBe(0);
      expect(status?.message).toBe('Queued for processing');
      expect(status?.startedAt).toBeDefined();
    });

    it('should return null for non-existent item', async () => {
      const status = await library.getProcessingStatus('non-existent-id');
      expect(status).toBeNull();
    });

    it('should correctly identify completed processing', async () => {
      const fileName = 'completed-test.pdf';
      const metadata = {
        title: 'Completed Test',
        authors: [{ firstName: 'Completed', lastName: 'Test' }],
      };

      const item = await library.storePdf(testPdfBuffer, fileName, metadata);

      // Manually update status to completed
      await item.updateMetadata({
        pdfProcessingStatus: PdfProcessingStatus.COMPLETED,
        pdfProcessingCompletedAt: new Date(),
        pdfProcessingProgress: 100,
      });

      const isCompleted = await library.isProcessingCompleted(
        item.metadata.id!,
      );
      expect(isCompleted).toBe(true);

      const isFailed = await library.isProcessingFailed(item.metadata.id!);
      expect(isFailed).toBe(false);
    });

    it('should correctly identify failed processing', async () => {
      const fileName = 'failed-test.pdf';
      const metadata = {
        title: 'Failed Test',
        authors: [{ firstName: 'Failed', lastName: 'Test' }],
      };

      const item = await library.storePdf(testPdfBuffer, fileName, metadata);

      // Manually update status to failed
      await item.updateMetadata({
        pdfProcessingStatus: PdfProcessingStatus.FAILED,
        pdfProcessingError: 'Test error',
      });

      const isCompleted = await library.isProcessingCompleted(
        item.metadata.id!,
      );
      expect(isCompleted).toBe(false);

      const isFailed = await library.isProcessingFailed(item.metadata.id!);
      expect(isFailed).toBe(true);
    });

    it('should wait for processing completion with timeout', async () => {
      const fileName = 'wait-test.pdf';
      const metadata = {
        title: 'Wait Test',
        authors: [{ firstName: 'Wait', lastName: 'Test' }],
      };

      const item = await library.storePdf(testPdfBuffer, fileName, metadata);

      // Test timeout scenario
      const result = await library.waitForProcessingCompletion(
        item.metadata.id!,
        1000, // 1 second timeout
        100, // 100ms interval
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('PDF conversion worker', () => {
    it('should create and start worker successfully', async () => {
      const worker = await createPdfConversionWorker(mockPdfConvertor);

      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(true);

      const stats = await worker.getWorkerStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.messageServiceConnected).toBe(true);

      await worker.stop();
      expect(worker.isWorkerRunning()).toBe(false);
    });

    it('should handle worker stop correctly', async () => {
      const worker = await createPdfConversionWorker(mockPdfConvertor);
      expect(worker.isWorkerRunning()).toBe(true);

      await worker.stop();
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should handle complete async PDF conversion workflow', async () => {
      const fileName = 'integration-test.pdf';
      const metadata = {
        title: 'Integration Test',
        authors: [{ firstName: 'Integration', lastName: 'Test' }],
        tags: ['integration', 'test'],
      };

      // Step 1: Store PDF (should queue for processing)
      const item = await library.storePdf(testPdfBuffer, fileName, metadata);
      expect(item.metadata.pdfProcessingStatus).toBe(
        PdfProcessingStatus.PENDING,
      );

      // Step 2: Check initial status
      const initialStatus = await library.getProcessingStatus(
        item.metadata.id!,
      );
      expect(initialStatus?.status).toBe(PdfProcessingStatus.PENDING);

      // Step 3: Simulate worker processing (in real scenario, worker would process this)
      // For now, we'll manually update the status to simulate completion
      await item.updateMetadata({
        pdfProcessingStatus: PdfProcessingStatus.COMPLETED,
        pdfProcessingCompletedAt: new Date(),
        pdfProcessingProgress: 100,
        pdfProcessingMessage: 'Processing completed successfully',
        markdownContent:
          '# Test PDF Content\n\nThis is a test PDF converted to markdown.',
        markdownUpdatedDate: new Date(),
      });

      // Step 4: Verify final status
      const finalStatus = await library.getProcessingStatus(item.metadata.id!);
      expect(finalStatus?.status).toBe(PdfProcessingStatus.COMPLETED);
      expect(finalStatus?.progress).toBe(100);
      expect(finalStatus?.completedAt).toBeDefined();

      // Step 5: Check if processing is completed
      const isCompleted = await library.isProcessingCompleted(
        item.metadata.id!,
      );
      expect(isCompleted).toBe(true);
    });

    it('should handle error scenarios in workflow', async () => {
      const fileName = 'error-workflow-test.pdf';
      const metadata = {
        title: 'Error Workflow Test',
        authors: [{ firstName: 'Error', lastName: 'Workflow' }],
      };

      // Store PDF
      const item = await library.storePdf(testPdfBuffer, fileName, metadata);

      // Simulate processing failure
      await item.updateMetadata({
        pdfProcessingStatus: PdfProcessingStatus.FAILED,
        pdfProcessingError: 'Simulated processing error',
        pdfProcessingRetryCount: 1,
      });

      // Verify error status
      const status = await library.getProcessingStatus(item.metadata.id!);
      expect(status?.status).toBe(PdfProcessingStatus.FAILED);
      expect(status?.error).toBe('Simulated processing error');
      expect(status?.retryCount).toBe(1);

      // Check if processing failed
      const isFailed = await library.isProcessingFailed(item.metadata.id!);
      expect(isFailed).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle invalid file names', async () => {
      const metadata = {
        title: 'Invalid File Test',
        authors: [{ firstName: 'Invalid', lastName: 'File' }],
      };

      await expect(
        library.storePdf(testPdfBuffer, '', metadata),
      ).rejects.toThrow('File name is required');
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      const mockStorage = {
        uploadPdf: vi.fn(() => Promise.reject(new Error('Storage error'))),
        saveMetadata: vi.fn(),
        getMetadata: vi.fn(),
        updateMetadata: vi.fn(),
        getMetadataByHash: vi.fn(),
        getPdf: vi.fn(),
        getPdfDownloadUrl: vi.fn(),
        getMarkdown: vi.fn(),
        saveMarkdown: vi.fn(),
        getChunksByItemId: vi.fn(),
        searchMetadata: vi.fn(),
        saveCollection: vi.fn(),
        getCollections: vi.fn(),
        addItemToCollection: vi.fn(),
        removeItemFromCollection: vi.fn(),
        saveCitation: vi.fn(),
        deleteMetadata: vi.fn(),
        deleteCollection: vi.fn(),
        ensureIndexes: vi.fn(),
      } as any;

      const errorLibrary = new Library(mockStorage);

      const metadata = {
        title: 'Storage Error Test',
        authors: [{ firstName: 'Storage', lastName: 'Error' }],
      };

      await expect(
        errorLibrary.storePdf(testPdfBuffer, 'error-test.pdf', metadata),
      ).rejects.toThrow('Storage error');
    });
  });
});
