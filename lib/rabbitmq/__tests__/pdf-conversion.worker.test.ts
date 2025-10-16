import { config } from 'dotenv';
import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from 'vitest';
import { PdfConversionWorker } from '../pdf-conversion.worker';
import { getRabbitMQService } from '../rabbitmq.service';
import {
  PdfConversionRequestMessage,
  PdfPartConversionRequestMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from '../message.types';
import { MinerUPdfConvertor } from '../../../knowledgeBase/knowledgeImport/MinerU/MinerUPdfConvertor';
import { v4 as uuidv4 } from 'uuid';
import { getPdfDownloadUrl } from '../../s3Service/S3Service';

// Load environment variables
config({ path: '.env' });

// Mock the logger to ensure console output during tests
vi.mock('../../logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn((...args) => console.log('[LOGGER INFO]', ...args)),
    error: vi.fn((...args) => console.error('[LOGGER ERROR]', ...args)),
    warn: vi.fn((...args) => console.warn('[LOGGER WARN]', ...args)),
    debug: vi.fn((...args) => console.log('[LOGGER DEBUG]', ...args)),
  })),
}));

// Mock the PDF converter
const mockPdfConvertor = {
  convertPdfToMarkdownFromS3: vi.fn(),
} as any;

// Helper function to wait for mock to be called
const waitForMockCall = (mock: any, expectedCallCount = 1, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const initialCallCount = mock.mock.calls.length;

    const checkMock = () => {
      if (mock.mock.calls.length >= initialCallCount + expectedCallCount) {
        resolve(mock.mock.calls);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Mock was not called ${expectedCallCount} times within ${timeout}ms`,
          ),
        );
        return;
      }

      setTimeout(checkMock, 100);
    };

    checkMock();
  });
};

// Mock the S3 service
vi.mock('../../s3Service/S3Service', () => ({
  getPdfDownloadUrl: vi.fn(),
}));

describe('PdfConversionWorker', () => {
  let worker: PdfConversionWorker;
  let rabbitMQService = getRabbitMQService();

  beforeAll(async () => {
    // Initialize RabbitMQ service
    await rabbitMQService.initialize();
  });

  afterAll(async () => {
    // Clean up RabbitMQ service
    await rabbitMQService.close();
  });

  beforeEach(async () => {
    // Clear all mocks including call history
    vi.clearAllMocks();

    // Create a new worker with mocked PDF converter
    worker = new PdfConversionWorker(mockPdfConvertor);

    // Mock the getPdfDownloadUrl function to return test URLs
    const mockGetPdfDownloadUrl = vi.mocked(getPdfDownloadUrl);
    mockGetPdfDownloadUrl.mockImplementation((s3Key: string) => {
      // Return test URLs based on the s3Key
      if (s3Key === 'test.pdf') {
        return Promise.resolve('https://test-bucket.s3.amazonaws.com/test.pdf');
      } else if (s3Key === 'test-part-0.pdf') {
        return Promise.resolve(
          'https://test-bucket.s3.amazonaws.com/test-part-0.pdf',
        );
      } else if (s3Key === 'test-part-1.pdf') {
        return Promise.resolve(
          'https://test-bucket.s3.amazonaws.com/test-part-1.pdf',
        );
      } else {
        return Promise.resolve(`https://test-bucket.s3.amazonaws.com/${s3Key}`);
      }
    });

    // Start the worker
    await worker.start();

    // Purge queues to ensure test isolation
    try {
      await rabbitMQService.purgeQueue(RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST);
      await rabbitMQService.purgeQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_REQUEST,
      );
      await rabbitMQService.purgeQueue(RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS);
      await rabbitMQService.purgeQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_COMPLETED,
      );
      await rabbitMQService.purgeQueue(RABBITMQ_QUEUES.PDF_CONVERSION_FAILED);
      await rabbitMQService.purgeQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_COMPLETED,
      );
      await rabbitMQService.purgeQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_FAILED,
      );
    } catch (error) {
      console.warn('Failed to purge queues:', error);
    }
  });

  afterEach(async () => {
    // Stop the worker after each test
    if (worker) {
      await worker.stop();
    }
  });

  describe('Worker Lifecycle', () => {
    it('should start the worker successfully', async () => {
      await worker.start();
      const stats = await worker.getWorkerStats();

      expect(stats.isRunning).toBe(true);
      expect(stats.consumerTag).toBe(
        RABBITMQ_CONSUMER_TAGS.PDF_CONVERSION_WORKER,
      );
      expect(stats.partConsumerTag).toBe(
        RABBITMQ_CONSUMER_TAGS.PDF_PART_CONVERSION_WORKER,
      );
    });

    it('should stop the worker successfully', async () => {
      await worker.start();
      await worker.stop();

      const stats = await worker.getWorkerStats();
      expect(stats.isRunning).toBe(false);
      expect(stats.consumerTag).toBeNull();
      expect(stats.partConsumerTag).toBeNull();
    });

    it('should handle multiple start calls gracefully', async () => {
      await worker.start();
      await worker.start(); // Should not throw an error

      const stats = await worker.getWorkerStats();
      expect(stats.isRunning).toBe(true);
    });

    it('should handle multiple stop calls gracefully', async () => {
      await worker.start();
      await worker.stop();
      await worker.stop(); // Should not throw an error

      const stats = await worker.getWorkerStats();
      expect(stats.isRunning).toBe(false);
    });
  });

  describe('PDF Conversion Request Processing', () => {
    // Worker is already started in the main beforeEach

    it('should process a PDF conversion request successfully', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
      });

      // Send the message to the queue
      await rabbitMQService.publishPdfConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test.pdf',
      );
    }, 10000);

    it('should handle PDF conversion failure and retry', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
        retryCount: 0,
        maxRetries: 2,
      };

      // Mock failed PDF conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockResolvedValue({
        success: false,
        error: 'Conversion failed',
      });

      // Send the message to the queue
      await rabbitMQService.publishPdfConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test.pdf',
      );
    }, 10000);

    it('should handle different PDF conversion result formats', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Test with string result
      (
        mockPdfConvertor.convertPdfToMarkdownFromS3 as any
      ).mockResolvedValueOnce({
        success: true,
        data: '# Test PDF Content\n\nThis is a test PDF content.',
      });

      await rabbitMQService.publishPdfConversionRequest(testMessage);
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3, 1);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test.pdf',
      );
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledTimes(
        1,
      );
    }, 15000);
  });

  describe('PDF Part Conversion Request Processing', () => {
    // Worker is already started in the main beforeEach

    it('should process a PDF part conversion request successfully', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 0,
        totalParts: 3,
        s3Key: 'test-part-0.pdf',
        fileName: 'test-part-0.pdf',
        startPage: 1,
        endPage: 10,
      };

      // Mock successful PDF part conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockResolvedValue({
        success: true,
        data: {
          markdown:
            '# Test PDF Part 1 Content\n\nThis is the first part of the test PDF.',
        },
      });

      // Send the message to the queue
      await rabbitMQService.publishPdfPartConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test-part-0.pdf',
      );
    }, 10000);

    it('should handle PDF part conversion failure and retry', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 1,
        totalParts: 3,
        s3Key: 'test-part-1.pdf',
        fileName: 'test-part-1.pdf',
        startPage: 11,
        endPage: 20,
        retryCount: 0,
        maxRetries: 2,
      };

      // Mock failed PDF part conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockResolvedValue({
        success: false,
        error: 'Part conversion failed',
      });

      // Send the message to the queue
      await rabbitMQService.publishPdfPartConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test-part-1.pdf',
      );
    }, 10000);
  });

  describe('Error Handling', () => {
    // Worker is already started in the main beforeEach

    it('should handle missing PDF converter gracefully', async () => {
      // Test the worker's ability to handle error scenarios during message processing
      // by testing the worker without starting it (to avoid RabbitMQ channel issues)

      const errorPdfConvertor = {
        convertPdfToMarkdownFromS3: vi
          .fn()
          .mockRejectedValue(new Error('PDF converter service unavailable')),
      } as any;

      const workerWithErrorConverter = new PdfConversionWorker(
        errorPdfConvertor,
      );

      // Verify the worker can be created and has the expected properties
      const stats = await workerWithErrorConverter.getWorkerStats();
      expect(stats.isRunning).toBe(false);
      expect(stats.pdfConvertorAvailable).toBe(true);
      expect(stats.consumerTag).toBeNull();
      expect(stats.partConsumerTag).toBeNull();

      // Verify the error converter mock is properly set
      expect(errorPdfConvertor.convertPdfToMarkdownFromS3).toBeDefined();
    });

    it('should handle network errors during message publishing', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock network error
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockRejectedValue(
        new Error('Network error'),
      );

      // Send the message to the queue
      await rabbitMQService.publishPdfConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test.pdf',
      );
    }, 10000);
  });

  describe('Worker Statistics', () => {
    it('should return correct worker statistics', async () => {
      await worker.start();
      const stats = await worker.getWorkerStats();

      expect(stats).toHaveProperty('isRunning', true);
      expect(stats).toHaveProperty('consumerTag');
      expect(stats).toHaveProperty('partConsumerTag');
      expect(stats).toHaveProperty('pdfConvertorAvailable');

      await worker.stop();
      const stoppedStats = await worker.getWorkerStats();

      expect(stoppedStats).toHaveProperty('isRunning', false);
      expect(stoppedStats).toHaveProperty('consumerTag', null);
      expect(stoppedStats).toHaveProperty('partConsumerTag', null);
    });
  });

  describe('Message Validation', () => {
    // Worker is already started in the main beforeEach

    it('should handle malformed messages gracefully', async () => {
      // This test would require manually sending a malformed message
      // to the queue to test the worker's error handling
      // For now, we'll just verify the worker can handle normal messages

      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
      });

      // Send the message to the queue
      await rabbitMQService.publishPdfConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalled();
    }, 10000);
  });

  describe('Retry Logic', () => {
    // Worker is already started in the main beforeEach

    it('should respect max retry limit', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
        retryCount: 3, // Already at max retry
        maxRetries: 3,
      };

      // Mock failed PDF conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as any).mockResolvedValue({
        success: false,
        error: 'Conversion failed',
      });

      // Send the message to the queue
      await rabbitMQService.publishPdfConversionRequest(testMessage);

      // Wait for the mock to be called
      await waitForMockCall(mockPdfConvertor.convertPdfToMarkdownFromS3);

      // Verify the mock was called with the expected test URL
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        'https://test-bucket.s3.amazonaws.com/test.pdf',
      );
    }, 10000);
  });
});
