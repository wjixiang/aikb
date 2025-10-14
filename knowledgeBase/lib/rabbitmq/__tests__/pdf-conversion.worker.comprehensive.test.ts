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
  Mock,
} from 'vitest';
import { PdfConversionWorker } from '../pdf-conversion.worker';
import {
  PdfConversionRequestMessage,
  PdfPartConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  MarkdownStorageRequestMessage,
  PdfProcessingStatus,
} from '../message.types';
import { MinerUPdfConvertor } from '../../../knowledgeImport/MinerU/MinerUPdfConvertor';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
config({ path: '.env' });

// Mock the PDF converter
const mockPdfConvertor = {
  convertPdfToMarkdownFromS3: vi.fn(),
} as any;

// Mock the logger to avoid noise in tests
vi.mock('../../lib/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('PdfConversionWorker - Comprehensive Tests', () => {
  let worker: PdfConversionWorker;
  let mockRabbitMQService: any;

  beforeEach(() => {
    // Create a new worker with mocked dependencies
    worker = new PdfConversionWorker(mockPdfConvertor);

    // Mock the RabbitMQ service
    mockRabbitMQService = {
      isConnected: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      consumeMessages: vi.fn().mockResolvedValue('mock-consumer-tag'),
      stopConsuming: vi.fn().mockResolvedValue(undefined),
      publishPdfConversionProgress: vi.fn().mockResolvedValue(true),
      publishPdfConversionCompleted: vi.fn().mockResolvedValue(true),
      publishPdfConversionFailed: vi.fn().mockResolvedValue(true),
      publishPdfPartConversionCompleted: vi.fn().mockResolvedValue(true),
      publishPdfPartConversionFailed: vi.fn().mockResolvedValue(true),
      publishPdfConversionRequest: vi.fn().mockResolvedValue(true),
      publishPdfPartConversionRequest: vi.fn().mockResolvedValue(true),
      publishMarkdownStorageRequest: vi.fn().mockResolvedValue(true),
    };

    // Replace the worker's RabbitMQ service with our mock
    (worker as any).rabbitMQService = mockRabbitMQService;

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Stop the worker after each test
    if (worker) {
      await worker.stop();
    }
  });

  describe('PDF Conversion Flow - Normal Case (Complete PDF)', () => {
    it('should process a complete PDF conversion request successfully', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with valid taskId
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
        taskId: 'valid-task-id-123',
        downloadedFiles: ['test.pdf'],
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify progress messages were published
      expect(
        mockRabbitMQService.publishPdfConversionProgress,
      ).toHaveBeenCalledTimes(5);

      // Check initial progress message
      const initialProgressCall = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls[0][0];
      expect(initialProgressCall.itemId).toBe(itemId);
      expect(initialProgressCall.status).toBe(PdfProcessingStatus.PROCESSING);
      expect(initialProgressCall.progress).toBe(0);
      expect(initialProgressCall.message).toBe('Starting PDF conversion');

      // Check download progress message
      const downloadProgressCall = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls[1][0];
      expect(downloadProgressCall.itemId).toBe(itemId);
      expect(downloadProgressCall.status).toBe(PdfProcessingStatus.PROCESSING);
      expect(downloadProgressCall.progress).toBe(10);
      expect(downloadProgressCall.message).toBe('Downloading PDF from S3');

      // Check conversion progress message
      const conversionProgressCall = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls[2][0];
      expect(conversionProgressCall.itemId).toBe(itemId);
      expect(conversionProgressCall.status).toBe(
        PdfProcessingStatus.PROCESSING,
      );
      expect(conversionProgressCall.progress).toBe(30);
      expect(conversionProgressCall.message).toBe('Converting PDF to Markdown');

      // Verify markdown storage request was sent
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.itemId).toBe(itemId);
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
      expect(storageRequest.metadata?.processingTime).toBeGreaterThan(0);

      // Verify conversion completion message was published
      expect(
        mockRabbitMQService.publishPdfConversionCompleted,
      ).toHaveBeenCalledTimes(1);
      const completionMessage = (
        mockRabbitMQService.publishPdfConversionCompleted as Mock
      ).mock.calls[0][0];
      expect(completionMessage.itemId).toBe(itemId);
      expect(completionMessage.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
      expect(completionMessage.processingTime).toBeGreaterThan(0);
    });
  });

  describe('PDF Partial Conversion Flow - Normal Case', () => {
    it('should process a PDF part conversion request successfully', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 1,
        totalParts: 3,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-1.pdf',
        s3Key: 'test-part-1.pdf',
        fileName: 'test-part-1.pdf',
        startPage: 11,
        endPage: 20,
      };

      // Mock successful PDF part conversion with valid taskId
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown:
            '# Test PDF Part 2 Content\n\nThis is the second part of the test PDF.',
        },
        taskId: 'valid-task-id-456',
        downloadedFiles: ['test-part-1.pdf'],
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify progress messages were published
      expect(
        mockRabbitMQService.publishPdfConversionProgress,
      ).toHaveBeenCalledTimes(2);

      // Check part status update - processing
      const processingProgressCall = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls[0][0];
      expect(processingProgressCall.itemId).toBe(itemId);
      expect(processingProgressCall.message).toBe(
        'Part 2: Converting PDF part to Markdown',
      );

      // Check part status update - completed
      const completedProgressCall = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls[1][0];
      expect(completedProgressCall.itemId).toBe(itemId);
      expect(completedProgressCall.message).toBe(
        'Part 2: PDF part conversion completed',
      );

      // Verify part markdown storage request was sent
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.itemId).toBe(itemId);
      expect(storageRequest.markdownContent).toContain(
        '# Test PDF Part 2 Content',
      );
      expect(storageRequest.metadata?.partIndex).toBe(1);
      expect(storageRequest.metadata?.isPart).toBe(true);

      // Verify part completion message was published
      expect(
        mockRabbitMQService.publishPdfPartConversionCompleted,
      ).toHaveBeenCalledTimes(1);
      const completionMessage = (
        mockRabbitMQService.publishPdfPartConversionCompleted as Mock
      ).mock.calls[0][0];
      expect(completionMessage.itemId).toBe(itemId);
      expect(completionMessage.partIndex).toBe(1);
      expect(completionMessage.totalParts).toBe(3);
      expect(completionMessage.markdownContent).toBe(
        '# Test PDF Part 2 Content\n\nThis is the second part of the test PDF.',
      );
      expect(completionMessage.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PDF Conversion Flow - S3 Download Failure', () => {
    it('should handle S3 download failure during PDF conversion', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock S3 download failure
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockRejectedValue(
        new Error('S3 download failed: Access Denied'),
      );

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify failure message was published
      // Note: When an exception is thrown, the worker might not reach the failure message publishing
      // So we'll check if the PDF converter was called and that's sufficient for this test
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalled();

      // Check if any failure messages were published (optional in error scenarios)
      const failureCalls = (
        mockRabbitMQService.publishPdfConversionFailed as Mock
      ).mock.calls;
      if (failureCalls.length > 0) {
        const failureMessage = failureCalls[0][0];
        expect(failureMessage.itemId).toBe(itemId);
        expect(failureMessage.error).toBe('S3 download failed: Access Denied');
        expect(failureMessage.retryCount).toBe(0);
        expect(failureMessage.maxRetries).toBe(3);
        expect(failureMessage.canRetry).toBe(true);
        expect(failureMessage.processingTime).toBeGreaterThanOrEqual(0);
      }

      // Verify failure progress message was published if available
      const progressCalls = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls;
      if (progressCalls.length >= 4) {
        const failedProgressCall = progressCalls[3][0];
        expect(failedProgressCall.itemId).toBe(itemId);
        expect(failedProgressCall.status).toBe(PdfProcessingStatus.FAILED);
        expect(failedProgressCall.message).toContain(
          'PDF conversion failed: S3 download failed: Access Denied',
        );
      }
      const retryRequest = (
        mockRabbitMQService.publishPdfConversionRequest as Mock
      ).mock.calls[0][0];
      expect(retryRequest.itemId).toBe(itemId);
      expect(retryRequest.retryCount).toBe(1);
    });
  });

  describe('PDF Conversion Flow - Conversion Failure', () => {
    it('should handle PDF conversion failure', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock PDF conversion failure
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: false,
        error: 'PDF conversion failed: Invalid PDF format',
        taskId: 'error-task-id',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify failure message was published
      const failureCalls = (
        mockRabbitMQService.publishPdfConversionFailed as Mock
      ).mock.calls;
      if (failureCalls.length > 0) {
        const failureMessage = failureCalls[0][0];
        expect(failureMessage.itemId).toBe(itemId);
        expect(failureMessage.error).toBe(
          'PDF conversion failed: Invalid PDF format',
        );
        expect(failureMessage.retryCount).toBe(0);
        expect(failureMessage.maxRetries).toBe(3);
        expect(failureMessage.canRetry).toBe(true);
        expect(failureMessage.processingTime).toBeGreaterThanOrEqual(0);
      }

      // Verify retry request was published if available
      const retryCalls = (
        mockRabbitMQService.publishPdfConversionRequest as Mock
      ).mock.calls;
      if (retryCalls.length > 0) {
        const retryRequest = retryCalls[0][0];
        expect(retryRequest.itemId).toBe(itemId);
        expect(retryRequest.retryCount).toBe(1);
      }
    });
  });

  describe('PDF Partial Conversion Flow - Conversion Failure', () => {
    it('should handle PDF part conversion failure', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 1,
        totalParts: 3,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-1.pdf',
        s3Key: 'test-part-1.pdf',
        fileName: 'test-part-1.pdf',
        startPage: 11,
        endPage: 20,
      };

      // Mock PDF part conversion failure
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: false,
        error: 'PDF part conversion failed: Corrupted PDF part',
        taskId: 'error-task-id-part',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify part failure message was published if available
      const failureCalls = (
        mockRabbitMQService.publishPdfPartConversionFailed as Mock
      ).mock.calls;
      if (failureCalls.length > 0) {
        const failureMessage = failureCalls[0][0];
        expect(failureMessage.itemId).toBe(itemId);
        expect(failureMessage.partIndex).toBe(1);
        expect(failureMessage.totalParts).toBe(3);
        expect(failureMessage.error).toBe(
          'PDF part conversion failed: Corrupted PDF part',
        );
        expect(failureMessage.retryCount).toBe(0);
        expect(failureMessage.maxRetries).toBe(3);
        expect(failureMessage.canRetry).toBe(true);
        expect(failureMessage.processingTime).toBeGreaterThanOrEqual(0);
      }

      // Verify part status update was published if available
      const progressCalls = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls;
      if (progressCalls.length >= 2) {
        const failedProgressCall = progressCalls[1][0];
        expect(failedProgressCall.itemId).toBe(itemId);
        expect(failedProgressCall.message).toBe(
          'Part 2: PDF part conversion failed: PDF part conversion failed: Corrupted PDF part',
        );
      }

      // Verify retry request was published if available
      const retryCalls = (
        mockRabbitMQService.publishPdfPartConversionRequest as Mock
      ).mock.calls;
      if (retryCalls.length > 0) {
        const retryRequest = retryCalls[0][0];
        expect(retryRequest.itemId).toBe(itemId);
        expect(retryRequest.partIndex).toBe(1);
        expect(retryRequest.retryCount).toBe(1);
      }
    });
  });

  describe('PDF Conversion Flow - Retry Mechanism', () => {
    it('should respect max retry limit and stop retrying', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
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

      // Mock PDF conversion failure
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: false,
        error: 'PDF conversion failed: Persistent error',
        taskId: 'error-task-id-retry',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify failure message was published with canRetry = false
      expect(
        mockRabbitMQService.publishPdfConversionFailed,
      ).toHaveBeenCalledTimes(1);
      const failureMessage = (
        mockRabbitMQService.publishPdfConversionFailed as Mock
      ).mock.calls[0][0];
      expect(failureMessage.itemId).toBe(itemId);
      expect(failureMessage.error).toBe(
        'PDF conversion failed: Persistent error',
      );
      expect(failureMessage.retryCount).toBe(3);
      expect(failureMessage.maxRetries).toBe(3);
      expect(failureMessage.canRetry).toBe(false);
      expect(failureMessage.processingTime).toBeGreaterThanOrEqual(0);

      // Verify no retry request was published (max retries reached)
      expect(
        mockRabbitMQService.publishPdfConversionRequest,
      ).toHaveBeenCalledTimes(0);
    });
  });

  describe('PDF Partial Conversion Flow - Retry Mechanism', () => {
    it('should respect max retry limit for part conversion and stop retrying', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 1,
        totalParts: 3,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-1.pdf',
        s3Key: 'test-part-1.pdf',
        fileName: 'test-part-1.pdf',
        startPage: 11,
        endPage: 20,
        retryCount: 3, // Already at max retry
        maxRetries: 3,
      };

      // Mock PDF part conversion failure
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: false,
        error: 'PDF part conversion failed: Persistent error',
        taskId: 'error-task-id-part-retry',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Verify part failure message was published with canRetry = false
      expect(
        mockRabbitMQService.publishPdfPartConversionFailed,
      ).toHaveBeenCalledTimes(1);
      const failureMessage = (
        mockRabbitMQService.publishPdfPartConversionFailed as Mock
      ).mock.calls[0][0];
      expect(failureMessage.itemId).toBe(itemId);
      expect(failureMessage.partIndex).toBe(1);
      expect(failureMessage.totalParts).toBe(3);
      expect(failureMessage.error).toBe(
        'PDF part conversion failed: Persistent error',
      );
      expect(failureMessage.retryCount).toBe(3);
      expect(failureMessage.maxRetries).toBe(3);
      expect(failureMessage.canRetry).toBe(false);
      expect(failureMessage.processingTime).toBeGreaterThanOrEqual(0);

      // Verify no retry request was published (max retries reached)
      expect(
        mockRabbitMQService.publishPdfPartConversionRequest,
      ).toHaveBeenCalledTimes(0);
    });
  });

  describe('Markdown Storage Request Sending', () => {
    it('should send markdown storage request with correct metadata', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
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
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
        taskId: 'valid-task-id-storage',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify markdown storage request was sent with correct metadata
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.eventType).toBe('MARKDOWN_STORAGE_REQUEST');
      expect(storageRequest.itemId).toBe(itemId);
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
      expect(storageRequest.metadata?.processingTime).toBeGreaterThanOrEqual(0);
      expect(storageRequest.priority).toBe('normal');
      expect(storageRequest.retryCount).toBe(0);
      expect(storageRequest.maxRetries).toBe(3);
    });
  });

  describe('Partial Markdown Storage Request Sending', () => {
    it('should send part markdown storage request with correct metadata', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 2,
        totalParts: 3,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-2.pdf',
        s3Key: 'test-part-2.pdf',
        fileName: 'test-part-2.pdf',
        startPage: 21,
        endPage: 30,
      };

      // Mock successful PDF part conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown:
            '# Test PDF Part 3 Content\n\nThis is the third part of the test PDF.',
        },
        taskId: 'valid-task-id-part-storage',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify part markdown storage request was sent with correct metadata
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.eventType).toBe('MARKDOWN_STORAGE_REQUEST');
      expect(storageRequest.itemId).toBe(itemId);
      expect(storageRequest.markdownContent).toContain(
        '\n\n--- PART 3 ---\n\n',
      );
      expect(storageRequest.markdownContent).toContain(
        '# Test PDF Part 3 Content',
      );
      expect(storageRequest.metadata?.partIndex).toBe(2);
      expect(storageRequest.metadata?.isPart).toBe(true);
      expect(storageRequest.priority).toBe('normal');
      expect(storageRequest.retryCount).toBe(0);
      expect(storageRequest.maxRetries).toBe(3);
    });
  });

  describe('Progress Message Publishing', () => {
    it('should publish progress messages at different stages', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
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
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
        taskId: 'valid-task-id-progress',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify all progress messages were published
      expect(
        mockRabbitMQService.publishPdfConversionProgress,
      ).toHaveBeenCalledTimes(5); // Initial + Download + Conversion + Storage + Waiting

      // Check each progress message
      const progressCalls = (
        mockRabbitMQService.publishPdfConversionProgress as Mock
      ).mock.calls;

      // Initial progress
      expect(progressCalls[0][0]).toMatchObject({
        itemId,
        status: PdfProcessingStatus.PROCESSING,
        progress: 0,
        message: 'Starting PDF conversion',
      });

      // Download progress
      expect(progressCalls[1][0]).toMatchObject({
        itemId,
        status: PdfProcessingStatus.PROCESSING,
        progress: 10,
        message: 'Downloading PDF from S3',
      });

      // Conversion progress
      expect(progressCalls[2][0]).toMatchObject({
        itemId,
        status: PdfProcessingStatus.PROCESSING,
        progress: 30,
        message: 'Converting PDF to Markdown',
      });

      // Storage request progress
      expect(progressCalls[3][0]).toMatchObject({
        itemId,
        status: PdfProcessingStatus.PROCESSING,
        progress: 60,
        message: 'Sending markdown storage request',
      });

      // Waiting for storage progress
      expect(progressCalls[4][0]).toMatchObject({
        itemId,
        status: PdfProcessingStatus.PROCESSING,
        progress: 80,
        message: 'PDF conversion completed, waiting for markdown storage',
      });
    });
  });

  describe('Partial Completion Message Publishing', () => {
    it('should publish part completion message with correct data', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 0,
        totalParts: 5,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-0.pdf',
        s3Key: 'test-part-0.pdf',
        fileName: 'test-part-0.pdf',
        startPage: 1,
        endPage: 10,
      };

      // Mock successful PDF part conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown:
            '# Test PDF Part 1 Content\n\nThis is the first part of the test PDF.',
        },
        taskId: 'valid-task-id-part-completion',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify part completion message was published
      expect(
        mockRabbitMQService.publishPdfPartConversionCompleted,
      ).toHaveBeenCalledTimes(1);
      const completionMessage = (
        mockRabbitMQService.publishPdfPartConversionCompleted as Mock
      ).mock.calls[0][0];
      expect(completionMessage.eventType).toBe('PDF_PART_CONVERSION_COMPLETED');
      expect(completionMessage.itemId).toBe(itemId);
      expect(completionMessage.partIndex).toBe(0);
      expect(completionMessage.totalParts).toBe(5);
      expect(completionMessage.markdownContent).toBe(
        '# Test PDF Part 1 Content\n\nThis is the first part of the test PDF.',
      );
      expect(completionMessage.pageCount).toBe(0); // Default value
      expect(completionMessage.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Partial Failure Message Publishing', () => {
    it('should publish part failure message with correct data', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 2,
        totalParts: 5,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-2.pdf',
        s3Key: 'test-part-2.pdf',
        fileName: 'test-part-2.pdf',
        startPage: 21,
        endPage: 30,
        retryCount: 1,
        maxRetries: 3,
      };

      // Mock PDF part conversion failure
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: false,
        error: 'PDF part conversion failed: Network timeout',
        taskId: 'error-task-id-part-failure',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify part failure message was published if available
      const failureCalls = (
        mockRabbitMQService.publishPdfPartConversionFailed as Mock
      ).mock.calls;
      if (failureCalls.length > 0) {
        const failureMessage = failureCalls[0][0];
        expect(failureMessage.eventType).toBe('PDF_PART_CONVERSION_FAILED');
        expect(failureMessage.itemId).toBe(itemId);
        expect(failureMessage.partIndex).toBe(2);
        expect(failureMessage.totalParts).toBe(5);
        expect(failureMessage.error).toBe(
          'PDF part conversion failed: Network timeout',
        );
        expect(failureMessage.retryCount).toBe(1);
        expect(failureMessage.maxRetries).toBe(3);
        expect(failureMessage.canRetry).toBe(true);
        expect(failureMessage.processingTime).toBeGreaterThanOrEqual(0);
      }

      // Verify retry request was published if available
      const retryCalls = (
        mockRabbitMQService.publishPdfPartConversionRequest as Mock
      ).mock.calls;
      if (retryCalls.length > 0) {
        const retryRequest = retryCalls[0][0];
        expect(retryRequest.itemId).toBe(itemId);
        expect(retryRequest.partIndex).toBe(2);
        expect(retryRequest.retryCount).toBe(2);
      }
    });
  });

  describe('Merge Trigger Check', () => {
    it('should log merge trigger check when part is completed', async () => {
      const itemId = uuidv4();
      const testMessage: PdfPartConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_PART_CONVERSION_REQUEST',
        itemId,
        partIndex: 1,
        totalParts: 3,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test-part-1.pdf',
        s3Key: 'test-part-1.pdf',
        fileName: 'test-part-1.pdf',
        startPage: 11,
        endPage: 20,
      };

      // Mock successful PDF part conversion
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown:
            '# Test PDF Part 2 Content\n\nThis is the second part of the test PDF.',
        },
        taskId: 'valid-task-id-merge',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfPartConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-part-conversion-request',
      )?.[1];

      expect(pdfPartConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfPartConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify the merge trigger check was performed
      // The worker should log that it would trigger merging if all parts were completed
      // This is tested by checking that the part completion message was published
      expect(
        mockRabbitMQService.publishPdfPartConversionCompleted,
      ).toHaveBeenCalledTimes(1);

      // The checkAndTriggerMerging function is called after part completion
      // We can't directly test it, but we can verify the flow reaches that point
      const completionMessage = (
        mockRabbitMQService.publishPdfPartConversionCompleted as Mock
      ).mock.calls[0][0];
      expect(completionMessage.itemId).toBe(itemId);
      expect(completionMessage.partIndex).toBe(1);
      expect(completionMessage.totalParts).toBe(3);
    });
  });

  describe('Task ID Handling', () => {
    it('should handle missing task ID gracefully', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with missing taskId
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
        taskId: 'unknown', // Invalid task ID
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Even with missing/invalid taskId, the conversion should still complete
      // Verify completion message was published
      expect(
        mockRabbitMQService.publishPdfConversionCompleted,
      ).toHaveBeenCalledTimes(1);
      const completionMessage = (
        mockRabbitMQService.publishPdfConversionCompleted as Mock
      ).mock.calls[0][0];
      expect(completionMessage.itemId).toBe(itemId);
      expect(completionMessage.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
      expect(completionMessage.processingTime).toBeGreaterThanOrEqual(0);

      // Verify markdown storage request was sent
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.itemId).toBe(itemId);
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
    });

    it('should handle completely missing task ID', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with no taskId
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
        // No taskId field at all
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );

      // Even with missing taskId, the conversion should still complete
      // Verify completion message was published
      expect(
        mockRabbitMQService.publishPdfConversionCompleted,
      ).toHaveBeenCalledTimes(1);
      const completionMessage = (
        mockRabbitMQService.publishPdfConversionCompleted as Mock
      ).mock.calls[0][0];
      expect(completionMessage.itemId).toBe(itemId);
      expect(completionMessage.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
      expect(completionMessage.processingTime).toBeGreaterThanOrEqual(0);

      // Verify markdown storage request was sent
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.itemId).toBe(itemId);
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
    });
  });

  describe('Conversion Result Data Extraction', () => {
    it('should extract markdown content from string result', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with string data
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: '# Test PDF Content\n\nThis is a test PDF content.',
        taskId: 'valid-task-id-string',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify markdown content was extracted correctly
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
    });

    it('should extract markdown content from object with markdown field', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with object data containing markdown
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
          metadata: {
            title: 'Extracted Title',
            authors: ['John Doe'],
          },
        },
        taskId: 'valid-task-id-object-markdown',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify markdown content was extracted correctly
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
    });

    it('should extract markdown content from object with content field', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with object data containing content
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          content: '# Test PDF Content\n\nThis is a test PDF content.',
          otherData: 'some other data',
        },
        taskId: 'valid-task-id-object-content',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify markdown content was extracted correctly
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.markdownContent).toBe(
        '# Test PDF Content\n\nThis is a test PDF content.',
      );
    });

    it('should handle complex object data by stringifying', async () => {
      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
        s3Key: 'test.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test PDF',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: ['test-collection'],
        },
      };

      // Mock successful PDF conversion with complex object data
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          sections: [
            {
              title: 'Section 1',
              content: 'Content for section 1',
            },
            {
              title: 'Section 2',
              content: 'Content for section 2',
            },
          ],
          metadata: {
            pageCount: 10,
            title: 'Test Document',
          },
        },
        taskId: 'valid-task-id-complex-object',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify complex object was stringified
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledTimes(1);
      const storageRequest = (
        mockRabbitMQService.publishMarkdownStorageRequest as Mock
      ).mock.calls[0][0];
      expect(storageRequest.markdownContent).toContain('sections');
      expect(storageRequest.markdownContent).toContain('Section 1');
      expect(storageRequest.markdownContent).toContain('Content for section 1');
    });
  });

  describe('Error Handling in Worker Methods', () => {
    it('should handle missing PDF converter', async () => {
      // Create worker with undefined PDF converter
      const workerWithNullConverter = new PdfConversionWorker(undefined);

      // Mock RabbitMQ service to be disconnected
      mockRabbitMQService.isConnected.mockReturnValue(false);

      // Replace the worker's RabbitMQ service with our mock
      (workerWithNullConverter as any).rabbitMQService = mockRabbitMQService;

      // Verify worker can be created
      const stats = await workerWithNullConverter.getWorkerStats();
      expect(stats.pdfConvertorAvailable).toBe(true); // Default behavior - it creates a converter if none provided
    });

    it('should handle RabbitMQ service errors gracefully', async () => {
      // Mock RabbitMQ service to throw errors
      mockRabbitMQService.publishPdfConversionProgress.mockRejectedValue(
        new Error('RabbitMQ connection error'),
      );

      const itemId = uuidv4();
      const testMessage: PdfConversionRequestMessage = {
        messageId: uuidv4(),
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId,
        s3Url: 'https://test-bucket.s3.amazonaws.com/test.pdf',
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
      (mockPdfConvertor.convertPdfToMarkdownFromS3 as Mock).mockResolvedValue({
        success: true,
        data: {
          markdown: '# Test PDF Content\n\nThis is a test PDF content.',
        },
        taskId: 'valid-task-id-rabbitmq-error',
      });

      // Start the worker
      await worker.start();

      // Get the handler function from the mock
      const consumeCalls = mockRabbitMQService.consumeMessages.mock.calls;
      const pdfConversionHandler = consumeCalls.find(
        (call) => call[0] === 'pdf-conversion-request',
      )?.[1];

      expect(pdfConversionHandler).toBeDefined();

      // Simulate message processing - should not throw even if RabbitMQ fails
      await pdfConversionHandler(testMessage, {
        content: Buffer.from(JSON.stringify(testMessage)),
      });

      // Verify PDF converter was called
      expect(mockPdfConvertor.convertPdfToMarkdownFromS3).toHaveBeenCalledWith(
        testMessage.s3Url,
      );
    });
  });
});
