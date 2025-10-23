import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PdfAnalysisWorker } from '../pdf-analysis.worker';
import { AbstractLibraryStorage } from '../../../knowledgeBase/knowledgeImport/library';
import { PdfAnalysisRequestMessage } from '../message.types';
import { MessageProtocol } from '../message-service.interface';
import { getRabbitMQService } from '../rabbitmq.service';
import { createPdfAnalyzerService } from '../pdf-analyzer.service';

// Mock the storage implementation
const mockStorage: Partial<AbstractLibraryStorage> = {
  getMetadata: vi.fn(),
  updateMetadata: vi.fn(),
};

// Mock PDF analyzer service
vi.mock('../pdf-analyzer.service', () => ({
  createPdfAnalyzerService: vi.fn(() => ({
    analyzePdf: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Create a simple test to verify protocol compatibility
describe('PdfAnalysisWorker Protocol Compatibility', () => {
  let worker: PdfAnalysisWorker;
  let originalProtocol: string | undefined;

  beforeEach(async () => {
    // Reset environment
    vi.clearAllMocks();

    // Store original protocol
    originalProtocol = process.env.RABBITMQ_PROTOCOL;

    // Create a new worker instance for each test
    worker = new PdfAnalysisWorker(mockStorage as AbstractLibraryStorage);

    // Mock the storage getMetadata to return a valid item
    (mockStorage.getMetadata as any).mockResolvedValue({
      id: 'test-item-id',
      title: 'Test PDF',
      pdfProcessingStatus: 'pending',
    });
  });

  afterEach(async () => {
    // Restore original protocol
    if (originalProtocol !== undefined) {
      process.env.RABBITMQ_PROTOCOL = originalProtocol;
    } else {
      delete process.env.RABBITMQ_PROTOCOL;
    }

    // Stop the worker if it's running
    if (worker && worker.isWorkerRunning()) {
      await worker.stop();
    }
  });

  describe('Protocol Detection', () => {
    it('should detect AMQP protocol from environment', () => {
      // Set protocol to AMQP
      process.env.RABBITMQ_PROTOCOL = 'amqp';

      // Create a new worker to pick up the environment variable
      const amqpWorker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
      );

      // The worker should be created with AMQP protocol
      expect(amqpWorker).toBeDefined();
    });

    it('should detect STOMP protocol from environment', () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';

      // Create a new worker to pick up the environment variable
      const stompWorker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
        MessageProtocol.STOMP,
      );

      // The worker should be created with STOMP protocol
      expect(stompWorker).toBeDefined();
      // expect(stompWorker.)
    });
  });

  describe('Protocol Switching', () => {
    it('should handle protocol switching between AMQP and STOMP', async () => {
      // Test with AMQP first
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      const amqpWorker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
      );
      expect(amqpWorker).toBeDefined();

      // Switch to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      const stompWorker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
        MessageProtocol.STOMP,
      );
      const status = await stompWorker.getWorkerStats();

      expect(status.protocol).toBe(MessageProtocol.STOMP);
    });
  });

  describe('Worker Functionality', () => {
    it('should create worker with default protocol', () => {
      // Create worker without setting protocol
      const defaultWorker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
      );
      expect(defaultWorker).toBeDefined();
      expect(defaultWorker.isWorkerRunning()).toBe(false);
    });

    it('should have required methods available', () => {
      expect(typeof worker.start).toBe('function');
      expect(typeof worker.stop).toBe('function');
      expect(typeof worker.isWorkerRunning).toBe('function');
      expect(typeof worker.getWorkerStats).toBe('function');
    });
  });

  describe('Message Consumption', () => {
    it('should publish and consume message using AMQP protocol', async () => {
      // Set protocol to AMQP
      process.env.RABBITMQ_PROTOCOL = 'amqp';

      // Get the RabbitMQ service instance first
      const rabbitmqService = getRabbitMQService(MessageProtocol.AMQP);

      // Initialize the service - this will wait until connection is truly ready
      await rabbitmqService.initialize();

      // Now create the worker (it will use the same initialized service)
      const worker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
        MessageProtocol.AMQP,
      );
      const handlePdfAnalysisRequestSpy = vi
        .spyOn(worker, 'handlePdfAnalysisRequest')
        .mockImplementation(async () => {});

      // Start the worker - no need to wait since service is already initialized
      await worker.start();

      // Wait a moment for initialization to complete
      // await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the service is connected
      expect(rabbitmqService.isConnected()).toBe(true);

      // Check queue info before publishing
      const queueInfoBefore = await rabbitmqService.getQueueInfo(
        'pdf-analysis-request',
      );
      console.log(
        `AMQP Queue info before publishing: ${JSON.stringify(queueInfoBefore)}`,
      );

      // Publish a test message
      const testMessage: PdfAnalysisRequestMessage = {
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId: 'test_item_id_amqp',
        s3Key: 'test_s3_key_amqp',
        fileName: 'test_file_amqp.pdf',
        messageId: 'test_message_id_amqp',
        timestamp: Date.now(),
      };

      const published =
        await rabbitmqService.publishPdfAnalysisRequest(testMessage);
      expect(published).toBe(true);

      // Check queue info after publishing
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const queueInfoAfter = await rabbitmqService.getQueueInfo(
        'pdf-analysis-request',
      );
      console.log(
        `AMQP Queue info after publishing: ${JSON.stringify(queueInfoAfter)}`,
      );

      expect(handlePdfAnalysisRequestSpy).toBeCalled();
      // Verify the service is still connected
      expect(rabbitmqService.isConnected()).toBe(true);
    });

    it('should publish and consume message using STOMP protocol', async () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';

      // Get the RabbitMQ service instance first
      const rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);

      // Initialize the service - this will wait until connection is truly ready
      await rabbitmqService.initialize();

      // Now create the worker (it will use the same initialized service)
      const worker = new PdfAnalysisWorker(
        mockStorage as AbstractLibraryStorage,
        MessageProtocol.STOMP,
      );
      const handlePdfAnalysisRequestSpy = vi
        .spyOn(worker, 'handlePdfAnalysisRequest')
        .mockImplementation(async () => {});

      // Start the worker - no need to wait since service is already initialized
      await worker.start();

      // Check queue info before publishing
      const queueInfoBefore = await rabbitmqService.getQueueInfo(
        'pdf-analysis-request',
      );
      console.log(
        `STOMP Queue info before publishing: ${JSON.stringify(queueInfoBefore)}`,
      );

      // Publish a test message
      const testMessage: PdfAnalysisRequestMessage = {
        eventType: 'PDF_ANALYSIS_REQUEST',
        itemId: 'test_item_id_stomp',
        s3Key: 'test_s3_key_stomp',
        fileName: 'test_file_stomp.pdf',
        messageId: 'test_message_id_stomp',
        timestamp: Date.now(),
      };

      const published =
        await rabbitmqService.publishPdfAnalysisRequest(testMessage);
      expect(published).toBe(true);

      // Check queue info after publishing
      await new Promise((resolve) => setTimeout(resolve, 100));
      const queueInfoAfter = await rabbitmqService.getQueueInfo(
        'pdf-analysis-request',
      );
      console.log(
        `STOMP Queue info after publishing: ${JSON.stringify(queueInfoAfter)}`,
      );

      expect(handlePdfAnalysisRequestSpy).toBeCalled();
      // Verify the service is connected
      expect(rabbitmqService.isConnected()).toBe(true);
    });
  });
});
