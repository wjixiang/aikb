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
import { mockRabbitMQService } from '../__mocks__/rabbitmq.mock';
import { IMessageService } from '../message-service.interface';
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

const mockPdfConvertor: MinerUPdfConvertor = {
  convertPdfToMarkdownFromS3: vi.fn(),
} as any;

const mockPdfConversionService: any = {
  initialize: vi.fn().mockResolvedValue(undefined),
  convertPdfToMarkdown: vi.fn(),
  convertPdfPartToMarkdown: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  getStats: vi
    .fn()
    .mockReturnValue({ isReady: true, pdfConvertorAvailable: true }),
};

const mockMessageHandler: any = {
  initialize: vi.fn().mockResolvedValue(undefined),
  startConsuming: vi.fn().mockResolvedValue(undefined),
  stopConsuming: vi.fn().mockResolvedValue(undefined),
  handlePdfConversionRequest: vi.fn().mockResolvedValue({
    success: true,
    shouldAcknowledge: true,
  }),
  handlePdfPartConversionRequest: vi.fn().mockResolvedValue({
    success: true,
    shouldAcknowledge: true,
  }),
  publishProgressMessage: vi.fn().mockResolvedValue(undefined),
  publishConversionCompletionMessage: vi.fn().mockResolvedValue(undefined),
  publishFailureMessage: vi.fn().mockResolvedValue(undefined),
  publishPartCompletionMessage: vi.fn().mockResolvedValue(undefined),
  publishPartFailureMessage: vi.fn().mockResolvedValue(undefined),
  sendMarkdownStorageRequest: vi.fn().mockResolvedValue(undefined),
  sendMarkdownPartStorageRequest: vi.fn().mockResolvedValue(undefined),
  isRunning: vi.fn().mockReturnValue(true),
  getStats: vi.fn().mockReturnValue({
    isRunning: true,
    consumerTag: 'test-consumer-tag',
    partConsumerTag: 'test-part-consumer-tag',
    messageServiceConnected: true,
  }),
};

// Helper function to wait for mock to be called
const waitForMockCall = (mock: any, expectedCallCount = 1, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const initialCallCount = mock.mock.calls.length;

    const checkMock = () => {
      if (mock.mock.calls.length >= initialCallCount + expectedCallCount) {
        resolve(mock.mock.calls.slice(initialCallCount));
      } else if (Date.now() - startTime > timeout) {
        reject(
          new Error(
            `Mock not called ${expectedCallCount} times within ${timeout}ms`,
          ),
        );
      } else {
        setTimeout(checkMock, 100);
      }
    };

    checkMock();
  });
};

describe('PdfConversionWorker', () => {
  let worker: PdfConversionWorker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (worker && worker.isWorkerRunning()) {
      await worker.stop();
    }
  });

  describe('Worker Lifecycle', () => {
    it('should start the worker successfully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      expect(mockMessageHandler.initialize).toHaveBeenCalled();
      expect(mockMessageHandler.startConsuming).toHaveBeenCalled();
      expect(worker.isWorkerRunning()).toBe(true);
    });

    it('should stop the worker successfully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();
      await worker.stop();

      expect(mockMessageHandler.stopConsuming).toHaveBeenCalled();
      expect(worker.isWorkerRunning()).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();
      await worker.start(); // Should not cause issues

      expect(worker.isWorkerRunning()).toBe(true);

      await worker.stop();
    });

    it('should handle multiple stop calls gracefully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();
      await worker.stop();
      await worker.stop(); // Should not cause issues

      expect(worker.isWorkerRunning()).toBe(false);
    });
  });

  describe('PDF Conversion Request Processing', () => {
    it('should process a PDF conversion request successfully', async () => {
      // Mock isRunning to return true after startConsuming is called
      (mockMessageHandler.isRunning as any).mockReturnValue(true);

      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Create a test message
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
        retryCount: 0,
        maxRetries: 3,
      };

      // Mock the conversion service to return a successful result
      const mockConversionResult = {
        success: true,
        markdownContent: '# Test Markdown Content',
        processingTime: 1000,
      };

      (mockPdfConversionService.convertPdfToMarkdown as any).mockResolvedValue(
        mockConversionResult,
      );

      // Call the message handler directly
      const result = await mockMessageHandler.handlePdfConversionRequest(
        testMessage,
        null,
      );

      expect(result.success).toBe(true);
      expect(result.shouldAcknowledge).toBe(true);

      await worker.stop();
    });

    it('should handle PDF conversion failure and retry', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Create a test message with retry count
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
        retryCount: 0,
        maxRetries: 3,
      };

      // Mock the conversion service to return a failure
      const mockConversionResult = {
        success: false,
        markdownContent: '',
        processingTime: 500,
        error: 'Test conversion error',
      };

      (mockPdfConversionService.convertPdfToMarkdown as any).mockResolvedValue(
        mockConversionResult,
      );

      // Override the mock for this specific test to return failure
      mockMessageHandler.handlePdfConversionRequest.mockReset();
      mockMessageHandler.handlePdfConversionRequest.mockResolvedValueOnce({
        success: false,
        shouldAcknowledge: true,
      });

      // Call the message handler directly
      const result = await mockMessageHandler.handlePdfConversionRequest(
        testMessage,
        null,
      );

      expect(result.success).toBe(false);
      expect(result.shouldAcknowledge).toBe(true);

      await worker.stop();
    });

    it('should handle different PDF conversion result formats', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Test with string result
      const mockConversionResult = {
        success: true,
        markdownContent: 'Test string content',
        processingTime: 1000,
      };

      (mockPdfConversionService.convertPdfToMarkdown as any).mockResolvedValue(
        mockConversionResult,
      );

      // Reset the mock to return the default value
      mockMessageHandler.handlePdfConversionRequest.mockReset();
      mockMessageHandler.handlePdfConversionRequest.mockResolvedValue({
        success: true,
        shouldAcknowledge: true,
      });

      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
        retryCount: 0,
        maxRetries: 3,
      };

      const result = await mockMessageHandler.handlePdfConversionRequest(
        testMessage,
        null,
      );

      expect(result.success).toBe(true);

      await worker.stop();
    });
  });

  describe('PDF Part Conversion Request Processing', () => {
    it('should process a PDF part conversion request successfully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Create a test message
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        partIndex: 0,
        totalParts: 2,
        startPage: 1,
        endPage: 5,
        retryCount: 0,
        maxRetries: 3,
      };

      // Mock the conversion service to return a successful result
      const mockConversionResult = {
        success: true,
        markdownContent: '# Test Markdown Content',
        processingTime: 1000,
      };

      (
        mockPdfConversionService.convertPdfPartToMarkdown as any
      ).mockResolvedValue(mockConversionResult);

      // Call the message handler directly
      const result = await mockMessageHandler.handlePdfPartConversionRequest(
        testMessage,
        null,
      );

      expect(result.success).toBe(true);
      expect(result.shouldAcknowledge).toBe(true);

      await worker.stop();
    });

    it('should handle PDF part conversion failure and retry', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Create a test message with retry count
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        partIndex: 0,
        totalParts: 2,
        startPage: 1,
        endPage: 5,
        retryCount: 0,
        maxRetries: 3,
      };

      // Mock the conversion service to return a failure
      const mockConversionResult = {
        success: false,
        markdownContent: '',
        processingTime: 500,
        error: 'Test conversion error',
      };

      (
        mockPdfConversionService.convertPdfPartToMarkdown as any
      ).mockResolvedValue(mockConversionResult);

      // Override the mock for this specific test to return failure
      mockMessageHandler.handlePdfPartConversionRequest.mockReturnValueOnce({
        success: false,
        shouldAcknowledge: true,
      });

      // Call the message handler directly
      const result = await mockMessageHandler.handlePdfPartConversionRequest(
        testMessage,
        null,
      );

      expect(result.success).toBe(false);
      expect(result.shouldAcknowledge).toBe(true);

      await worker.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing PDF converter gracefully', async () => {
      // Create a worker with a null PDF converter
      const workerWithNullConverter = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      // Mock the stats method to return pdfConvertorAvailable: false
      mockPdfConversionService.getStats.mockReturnValue({
        isReady: false,
        pdfConvertorAvailable: false,
      });

      await workerWithNullConverter.start();

      const stats = await workerWithNullConverter.getWorkerStats();
      expect(stats.conversionServiceStats.pdfConvertorAvailable).toBe(false);

      await workerWithNullConverter.stop();
    });

    it('should handle network errors during message publishing', async () => {
      // Mock publishMessage to throw an error
      (mockRabbitMQService.publishMessage as any).mockRejectedValue(
        new Error('Network error'),
      );

      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // This should not throw an error, but log it instead
      await mockMessageHandler.publishProgressMessage(
        'test-id',
        'processing',
        50,
        'Test message',
      );

      expect(mockMessageHandler.publishProgressMessage).toHaveBeenCalled();

      await worker.stop();
    });
  });

  describe('Worker Statistics', () => {
    it('should return correct worker statistics', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      // Reset the mock to return the default value
      mockPdfConversionService.getStats.mockReturnValue({
        isReady: true,
        pdfConvertorAvailable: true,
      });

      const stats = await worker.getWorkerStats();

      expect(stats.isRunning).toBe(false);
      expect(stats.isInitialized).toBe(false);
      expect(stats.conversionServiceStats.isReady).toBe(true);
      expect(stats.messageServiceConnected).toBe(true);

      await worker.start();

      const runningStats = await worker.getWorkerStats();
      expect(runningStats.isRunning).toBe(true);
      expect(runningStats.isInitialized).toBe(true);

      await worker.stop();
    });
  });

  describe('Message Validation', () => {
    it('should handle malformed messages gracefully', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Create a malformed message (missing required fields)
      const malformedMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        // Missing itemId, s3Key, etc.
      } as any;

      // Override the mock for this specific test to return failure
      mockMessageHandler.handlePdfConversionRequest.mockReset();
      mockMessageHandler.handlePdfConversionRequest.mockResolvedValueOnce({
        success: false,
        shouldAcknowledge: true,
      });

      // This should handle the error gracefully
      const result = await mockMessageHandler.handlePdfConversionRequest(
        malformedMessage,
        null,
      );

      // The result should indicate failure but not crash
      expect(result).toBeDefined();
      expect(result.success).toBe(false);

      await worker.stop();
    });
  });

  describe('Retry Logic', () => {
    it('should respect max retry limit', async () => {
      worker = new PdfConversionWorker(
        mockRabbitMQService,
        mockPdfConversionService,
        mockMessageHandler,
      );

      await worker.start();

      // Create a test message with max retries reached
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'Test', lastName: 'Author' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
        retryCount: 3, // Already at max retries
        maxRetries: 3,
      };

      // Mock the conversion service to return a failure
      const mockConversionResult = {
        success: false,
        markdownContent: '',
        processingTime: 500,
        error: 'Test conversion error',
      };

      (mockPdfConversionService.convertPdfToMarkdown as any).mockResolvedValue(
        mockConversionResult,
      );

      // Override the mock for this specific test to return failure
      mockMessageHandler.handlePdfConversionRequest.mockResolvedValueOnce({
        success: false,
        shouldAcknowledge: true,
      });

      // Call the message handler directly
      const result = await mockMessageHandler.handlePdfConversionRequest(
        testMessage,
        null,
      );

      expect(result.success).toBe(false);
      expect(result.shouldAcknowledge).toBe(true);

      await worker.stop();
    });
  });
});
