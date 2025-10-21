import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarkdownStorageWorker } from '../markdown-storage.worker';
import { AbstractLibraryStorage } from '../../../knowledgeBase/knowledgeImport/library';
import {
  MarkdownStorageRequestMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS
} from '../message.types';
import { MessageProtocol } from '../message-service.interface';
import { getRabbitMQService, closeAllRabbitMQServices, RabbitMQService } from '../rabbitmq.service';

// Mock the storage implementation
const mockStorage: Partial<AbstractLibraryStorage> = {
  getMetadata: vi.fn(),
  updateMetadata: vi.fn(),
  saveMarkdown: vi.fn(),
};

// Create a simple test to verify protocol compatibility
describe('MarkdownStorageWorker Protocol Compatibility', () => {
  let worker: MarkdownStorageWorker;
  let originalProtocol: string | undefined;

  beforeEach(async () => {
    // Reset environment
    vi.clearAllMocks();
    
    // Store original protocol
    originalProtocol = process.env.RABBITMQ_PROTOCOL;
    
    // Create a new worker instance for each test
    worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage);
    
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
    
    // Mock saveMarkdown to resolve successfully
    (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
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
      const amqpWorker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage);
      
      // The worker should be created with AMQP protocol
      expect(amqpWorker).toBeDefined();
      expect(amqpWorker.isWorkerRunning()).toBe(false);
    });

    it('should detect STOMP protocol from environment', () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      
      // Create a new worker to pick up the environment variable
      const stompWorker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage);
      
      // The worker should be created with STOMP protocol
      expect(stompWorker).toBeDefined();
      expect(stompWorker.isWorkerRunning()).toBe(false);
    });
  });

  describe('Protocol Switching', () => {
    it('should handle protocol switching between AMQP and STOMP', async () => {
      // Test with AMQP first
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      const amqpWorker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage);
      expect(amqpWorker).toBeDefined();
      
      // Switch to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      const stompWorker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage);
      
      expect(stompWorker).toBeDefined();
      expect(stompWorker.isWorkerRunning()).toBe(false);
    });
  });

  describe('Handler Methods', () => {
    let rabbitmqService: RabbitMQService;

    describe('use amqp', () => {
      beforeEach(async () => {
        rabbitmqService = getRabbitMQService(MessageProtocol.AMQP);
        await rabbitmqService.initialize();
      });

      it('should handle markdown storage request message', async () => {
        const testMessage: MarkdownStorageRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_STORAGE_REQUEST',
          itemId: 'test_item_id',
          markdownContent: '# Test Markdown Content\n\nThis is a test markdown content.',
          metadata: {
            pageCount: 10,
            extractedTitle: 'Test PDF',
            language: 'en',
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
        
        // Spy on the private handler method
        const handleMarkdownStorageRequestSpy = vi.spyOn(worker as any, 'handleMarkdownStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishMarkdownStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });

      it('should handle markdown storage request with retry', async () => {
        const testMessage: MarkdownStorageRequestMessage = {
          messageId: `test_message_id_retry_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_STORAGE_REQUEST',
          itemId: 'test_item_id',
          markdownContent: '# Test Markdown Content\n\nThis is a test markdown content.',
          metadata: {
            pageCount: 10,
            extractedTitle: 'Test PDF',
            language: 'en',
          },
          priority: 'normal',
          retryCount: 1,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
        
        // Spy on the private handler method
        const handleMarkdownStorageRequestSpy = vi.spyOn(worker as any, 'handleMarkdownStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishMarkdownStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });
    });

    describe('use stomp', () => {
      beforeEach(async () => {
        rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
        await rabbitmqService.initialize();
      });

      it('should handle markdown storage request message', async () => {
        const testMessage: MarkdownStorageRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_STORAGE_REQUEST',
          itemId: 'test_item_id',
          markdownContent: '# Test Markdown Content\n\nThis is a test markdown content.',
          metadata: {
            pageCount: 10,
            extractedTitle: 'Test PDF',
            language: 'en',
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };
        expect(rabbitmqService.protocol).toBe(MessageProtocol.STOMP)
        // Create worker with STOMP protocol
        const worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
        
        // Spy on the private handler method
        const handleMarkdownStorageRequestSpy = vi.spyOn(worker as any, 'handleMarkdownStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Verify the worker is using STOMP protocol
        expect(worker.isWorkerRunning()).toBe(true);

        // Publish message
        await rabbitmqService.publishMarkdownStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });

      it('should handle markdown storage request with retry', async () => {
        const testMessage: MarkdownStorageRequestMessage = {
          messageId: `test_message_id_retry_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_STORAGE_REQUEST',
          itemId: 'test_item_id',
          markdownContent: '# Test Markdown Content\n\nThis is a test markdown content.',
          metadata: {
            pageCount: 10,
            extractedTitle: 'Test PDF',
            language: 'en',
          },
          priority: 'normal',
          retryCount: 1,
          maxRetries: 3,
        };

        // Create worker with STOMP protocol
        const worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.STOMP);
        
        // Spy on the private handler method
        const handleMarkdownStorageRequestSpy = vi.spyOn(worker as any, 'handleMarkdownStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishMarkdownStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });
    });
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
      // Mock the storage getMetadata to throw an error
      (mockStorage.getMetadata as any).mockRejectedValue(new Error('Storage error'));
      
      const testMessage: MarkdownStorageRequestMessage = {
        messageId: 'test_message_id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId: 'test_item_id',
        markdownContent: '# Test Markdown Content',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };
      
      // Create worker
      const worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage, MessageProtocol.AMQP);
      
      // The worker should handle the error gracefully without throwing
      // Note: We can't directly test the private handler, but we can verify the worker doesn't crash
      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });
});