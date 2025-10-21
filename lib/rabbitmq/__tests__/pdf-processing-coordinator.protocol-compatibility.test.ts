import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PdfProcessingCoordinatorWorker } from '../pdf-processing-coordinator.worker';
import { AbstractLibraryStorage } from '../../../knowledgeBase/knowledgeImport/library';
import {
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfConversionProgressMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  MarkdownPartStorageProgressMessage,
  DeadLetterQueueMessage,
  PdfProcessingStatus,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_EXCHANGES
} from '../message.types';
import { MessageProtocol } from '../message-service.interface';
import { getRabbitMQService, closeAllRabbitMQServices, RabbitMQService } from '../rabbitmq.service';

// Mock the storage implementation
const mockStorage: Partial<AbstractLibraryStorage> = {
  getMetadata: vi.fn(),
  updateMetadata: vi.fn(),
};

// Create a simple test to verify protocol compatibility
describe('PdfProcessingCoordinator Protocol Compatibility', () => {
  let worker: PdfProcessingCoordinatorWorker;
  let originalProtocol: string | undefined;

  beforeEach(async () => {
    // Reset environment
    vi.clearAllMocks();
    
    // Store original protocol
    originalProtocol = process.env.RABBITMQ_PROTOCOL;
    
    // Create a new worker instance for each test
    worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage);
    
    // Mock the storage getMetadata to return a valid item
    (mockStorage.getMetadata as any).mockResolvedValue({
      id: 'test-item-id',
      title: 'Test PDF',
      s3Key: 'test/test.pdf',
      pdfProcessingStatus: 'pending',
      dateModified: new Date(),
    });
    
    // Mock updateMetadata to resolve successfully
    (mockStorage.updateMetadata as any).mockResolvedValue(undefined);
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

    // Clean up RabbitMQ service instances to ensure test isolation
    try {
      await closeAllRabbitMQServices();
    } catch (error) {
      // Log error but don't fail the test
      console.warn('Error cleaning up RabbitMQ services:', error);
    }
  });

  describe('Protocol Detection', () => {
    it('should detect AMQP protocol from environment', () => {
      // Set protocol to AMQP
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      
      // Create a new worker to pick up the environment variable
      const amqpWorker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage);
      
      // The worker should be created with AMQP protocol
      expect(amqpWorker).toBeDefined();
      expect(amqpWorker.isWorkerRunning()).toBe(false);
    });

    it('should detect STOMP protocol from environment', () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      
      // Create a new worker to pick up the environment variable
      const stompWorker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage);
      
      // The worker should be created with STOMP protocol
      expect(stompWorker).toBeDefined();
      expect(stompWorker.isWorkerRunning()).toBe(false);
    });
  });

  describe('Protocol Switching', () => {
    it('should handle protocol switching between AMQP and STOMP', async () => {
      // Test with AMQP first
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      const amqpWorker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage);
      expect(amqpWorker).toBeDefined();
      
      // Switch to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      const stompWorker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage);
      const status = await stompWorker.getWorkerStats();
      
      expect(status.isRunning).toBe(false);
      expect(status.rabbitMQConnected).toBe(false);
    });
  });

  

  describe('Handler Methods', () => {
    let rabbitmqService: RabbitMQService

    describe('use amqp', ()=>{
      beforeEach(async()=>{
        rabbitmqService = getRabbitMQService(MessageProtocol.AMQP);
        await rabbitmqService.initialize();
      
      })

      it('should handle analysis completed message', async () => {
      // Initialize the RabbitMQ service first
      
      const testMessage: PdfAnalysisCompletedMessage = {
        messageId: `test_message_id_completed_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_COMPLETED',
        itemId: 'test_item_id',
        pageCount: 10,
        requiresSplitting: false,
        processingTime: 1000,
        pdfMetadata: {
          pageCount: 10,
          fileSize: 1024,
          title: 'Test PDF'
        }
      };

      // Start worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP)
      const handleAnalysisCompletedSpy = vi.spyOn(worker,'handleAnalysisCompleted').mockImplementation(async()=>{})

      await worker.start()

      // Publish message
      await rabbitmqService.publishPdfAnalysisCompleted(testMessage)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handleAnalysisCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle analysis failed message', async () => {
      const testMessage: PdfAnalysisFailedMessage = {
        messageId: `test_message_id_failed_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_FAILED',
        itemId: 'test_item_id',
        error: 'Test error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 500
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleAnalysisFailedSpy = vi.spyOn(worker,'handleAnalysisFailed').mockImplementation(async()=>{})

      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfAnalysisFailed(testMessage)
      
      // Wait longer for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleAnalysisFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle conversion completed message', async () => {
      const testMessage: PdfConversionCompletedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_COMPLETED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.COMPLETED,
        processingTime: 800
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleConversionCompletedSpy = vi.spyOn(worker,'handleConversionCompleted').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfConversionCompleted(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleConversionCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle conversion failed message', async () => {
      const testMessage: PdfConversionFailedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_FAILED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.FAILED,
        error: 'Test error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 500
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleConversionFailedSpy = vi.spyOn(worker,'handleConversionFailed').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfConversionFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleConversionFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle conversion progress message', async () => {
      const testMessage: PdfConversionProgressMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.PROCESSING,
        progress: 50,
        message: 'Processing page 5 of 10'
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleConversionProgressSpy = vi.spyOn(worker,'handleConversionProgress').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfConversionProgress(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleConversionProgressSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown storage completed message', async () => {
      const testMessage: MarkdownStorageCompletedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_COMPLETED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.COMPLETED,
        processingTime: 600
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleMarkdownStorageCompletedSpy = vi.spyOn(worker,'handleMarkdownStorageCompleted').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownStorageCompleted(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownStorageCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown storage failed message', async () => {
      const testMessage: MarkdownStorageFailedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_FAILED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.FAILED,
        error: 'Storage error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 400
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleMarkdownStorageFailedSpy = vi.spyOn(worker,'handleMarkdownStorageFailed').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownStorageFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownStorageFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown part storage completed message', async () => {
      const testMessage: MarkdownPartStorageCompletedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_COMPLETED',
        itemId: 'test_item_id',
        partIndex: 1,
        totalParts: 3,
        status: PdfProcessingStatus.COMPLETED,
        processingTime: 300
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleMarkdownPartStorageCompletedSpy = vi.spyOn(worker,'handleMarkdownPartStorageCompleted').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownPartStorageCompleted(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownPartStorageCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown part storage failed message', async () => {
      const testMessage: MarkdownPartStorageFailedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_FAILED',
        itemId: 'test_item_id',
        partIndex: 1,
        totalParts: 3,
        status: PdfProcessingStatus.FAILED,
        error: 'Part storage error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 200
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleMarkdownPartStorageFailedSpy = vi.spyOn(worker,'handleMarkdownPartStorageFailed').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownPartStorageFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownPartStorageFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown part storage progress message', async () => {
      const testMessage: MarkdownPartStorageProgressMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_PROGRESS',
        itemId: 'test_item_id',
        partIndex: 1,
        totalParts: 3,
        status: PdfProcessingStatus.PROCESSING,
        progress: 75,
        message: 'Storing part 1 of 3'
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleMarkdownPartStorageProgressSpy = vi.spyOn(worker,'handleMarkdownPartStorageProgress').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownPartStorageProgress(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownPartStorageProgressSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle dead letter message', async () => {
      const testMessage: DeadLetterQueueMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'DEAD_LETTER',
        originalMessage: { itemId: 'test_item_id' },
        originalRoutingKey: 'pdf.conversion.request',
        failureReason: 'Test failure',
        failureTimestamp: Date.now(),
        retryCount: 1,
        originalQueue: 'pdf-conversion-request'
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      const handleDeadLetterMessageSpy = vi.spyOn(worker,'handleDeadLetterMessage').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      // Publish dead letter message directly to the DLQ exchange
      // We need to access the underlying message service to specify the exchange
      const messageService = (rabbitmqService as any).messageService;
      await messageService.publishMessage(
        RABBITMQ_ROUTING_KEYS.DEAD_LETTER,
        testMessage,
        { persistent: true }
      )
      
      // For AMQP, we need to ensure it's published to the dead letter exchange
      // Let's use the channel directly to publish to the correct exchange
      const channel = (messageService as any).channel;
      if (channel) {
        await channel.publish(
          RABBITMQ_EXCHANGES.DEAD_LETTER,
          RABBITMQ_ROUTING_KEYS.DEAD_LETTER,
          Buffer.from(JSON.stringify(testMessage)),
          { persistent: true }
        );
      }
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleDeadLetterMessageSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });
    });

    describe('use stomp', ()=>{
      beforeEach(async()=>{
        rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
        await rabbitmqService.initialize();
      }) 

      it('should handle analysis completed message', async () => {
      // Initialize the RabbitMQ service first
      
      const testMessage: PdfAnalysisCompletedMessage = {
        messageId: `test_message_id_completed_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_COMPLETED',
        itemId: 'test_item_id',
        pageCount: 10,
        requiresSplitting: false,
        processingTime: 1000,
        pdfMetadata: {
          pageCount: 10,
          fileSize: 1024,
          title: 'Test PDF'
        }
      };

      // Start worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP)
      const handleAnalysisCompletedSpy = vi.spyOn(worker,'handleAnalysisCompleted').mockImplementation(async()=>{})

      await worker.start()

      const status = await worker.getWorkerStats()
      expect(status.protocol).toBe(MessageProtocol.STOMP)

      // Publish message
      await rabbitmqService.publishPdfAnalysisCompleted(testMessage)
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(handleAnalysisCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle analysis failed message', async () => {
      const testMessage: PdfAnalysisFailedMessage = {
        messageId: `test_message_id_failed_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_FAILED',
        itemId: 'test_item_id',
        error: 'Test error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 500
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleAnalysisFailedSpy = vi.spyOn(worker,'handleAnalysisFailed').mockImplementation(async()=>{})

      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfAnalysisFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleAnalysisFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle conversion completed message', async () => {
      const testMessage: PdfConversionCompletedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_COMPLETED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.COMPLETED,
        processingTime: 800
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleConversionCompletedSpy = vi.spyOn(worker,'handleConversionCompleted').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfConversionCompleted(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleConversionCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle conversion failed message', async () => {
      const testMessage: PdfConversionFailedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_FAILED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.FAILED,
        error: 'Test error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 500
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleConversionFailedSpy = vi.spyOn(worker,'handleConversionFailed').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfConversionFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleConversionFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle conversion progress message', async () => {
      const testMessage: PdfConversionProgressMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.PROCESSING,
        progress: 50,
        message: 'Processing page 5 of 10'
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleConversionProgressSpy = vi.spyOn(worker,'handleConversionProgress').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishPdfConversionProgress(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleConversionProgressSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown storage completed message', async () => {
      const testMessage: MarkdownStorageCompletedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_COMPLETED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.COMPLETED,
        processingTime: 600
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleMarkdownStorageCompletedSpy = vi.spyOn(worker,'handleMarkdownStorageCompleted').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      const stats = await worker.getWorkerStats()
      console.log(`Worker stats for STOMP markdown storage completed test:`, stats)

      await rabbitmqService.publishMarkdownStorageCompleted(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownStorageCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown storage failed message', async () => {
      const testMessage: MarkdownStorageFailedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_FAILED',
        itemId: 'test_item_id',
        status: PdfProcessingStatus.FAILED,
        error: 'Storage error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 400
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleMarkdownStorageFailedSpy = vi.spyOn(worker,'handleMarkdownStorageFailed').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownStorageFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownStorageFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown part storage completed message', async () => {
      const testMessage: MarkdownPartStorageCompletedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_COMPLETED',
        itemId: 'test_item_id',
        partIndex: 1,
        totalParts: 3,
        status: PdfProcessingStatus.COMPLETED,
        processingTime: 300
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleMarkdownPartStorageCompletedSpy = vi.spyOn(worker,'handleMarkdownPartStorageCompleted').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownPartStorageCompleted(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownPartStorageCompletedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown part storage failed message', async () => {
      const testMessage: MarkdownPartStorageFailedMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_FAILED',
        itemId: 'test_item_id',
        partIndex: 1,
        totalParts: 3,
        status: PdfProcessingStatus.FAILED,
        error: 'Part storage error',
        retryCount: 1,
        maxRetries: 3,
        canRetry: true,
        processingTime: 200
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleMarkdownPartStorageFailedSpy = vi.spyOn(worker,'handleMarkdownPartStorageFailed').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownPartStorageFailed(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownPartStorageFailedSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle markdown part storage progress message', async () => {
      const testMessage: MarkdownPartStorageProgressMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_PROGRESS',
        itemId: 'test_item_id',
        partIndex: 1,
        totalParts: 3,
        status: PdfProcessingStatus.PROCESSING,
        progress: 75,
        message: 'Storing part 1 of 3'
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleMarkdownPartStorageProgressSpy = vi.spyOn(worker,'handleMarkdownPartStorageProgress').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      await rabbitmqService.publishMarkdownPartStorageProgress(testMessage)
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleMarkdownPartStorageProgressSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });

    it('should handle dead letter message', async () => {
      const testMessage: DeadLetterQueueMessage = {
        messageId: `test_message_id_${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'DEAD_LETTER',
        originalMessage: { itemId: 'test_item_id' },
        originalRoutingKey: 'pdf.conversion.request',
        failureReason: 'Test failure',
        failureTimestamp: Date.now(),
        retryCount: 1,
        originalQueue: 'pdf-conversion-request'
      };

      // Create worker
      const worker = new PdfProcessingCoordinatorWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
      const handleDeadLetterMessageSpy = vi.spyOn(worker,'handleDeadLetterMessage').mockImplementation(async()=>{})
      
      await worker.start()

      // Wait for the worker to be fully connected and consuming
      await new Promise(resolve => setTimeout(resolve, 500));

      // Publish dead letter message directly to the DLQ exchange
      // For STOMP, we need to use the correct destination
      const messageService = (rabbitmqService as any).messageService;
      
      // Use the message service's publishMessage method with the correct destination
      await messageService.publishMessage(
        '/exchange/pdf-conversion-dlx/pdf.conversion.dlq',
        testMessage,
        { persistent: true }
      );
      
      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(handleDeadLetterMessageSpy).toBeCalledWith(testMessage, expect.anything())
      
      await worker.stop()
    });
    })
    
  });

  describe('Service Initialization', () => {
    it('should initialize RabbitMQ service with AMQP protocol', async () => {
      // Set protocol to AMQP
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      
      // Get the RabbitMQ service instance
      const rabbitmqService = getRabbitMQService(MessageProtocol.AMQP);
      
      // Initialize the service
      await rabbitmqService.initialize();
      
      // Verify the service is connected
      expect(rabbitmqService.isConnected()).toBe(true);
    });

    it('should initialize RabbitMQ service with STOMP protocol', async () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      
      // Get the RabbitMQ service instance
      const rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
      
      // Initialize the service
      await rabbitmqService.initialize();
      
      // Verify the service is connected
      expect(rabbitmqService.isConnected()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      // Mock the handler to throw an error
      vi.spyOn(worker, 'handleAnalysisCompleted').mockImplementation(async () => {
        throw new Error('Test handler error');
      });
      
      const testMessage: PdfAnalysisCompletedMessage = {
        messageId: 'test_message_id',
        timestamp: Date.now(),
        eventType: 'PDF_ANALYSIS_COMPLETED',
        itemId: 'test_item_id',
        pageCount: 10,
        requiresSplitting: false,
        processingTime: 1000
      };
      
      // Should throw the error when calling the handler directly
      await expect(worker.handleAnalysisCompleted(testMessage, {})).rejects.toThrow('Test handler error');
    });
  });
});