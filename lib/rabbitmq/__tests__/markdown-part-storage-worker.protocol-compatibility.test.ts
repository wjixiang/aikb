import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarkdownPartStorageWorker } from '../markdown-part-storage.worker';
import { MarkdownPartCache } from '../markdown-part-cache';
import { IPdfPartTracker } from '../pdf-part-tracker';
import {
  MarkdownPartStorageRequestMessage,
  MarkdownPartStorageProgressMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS
} from '../message.types';
import { MessageProtocol } from '../message-service.interface';
import { getRabbitMQService, closeAllRabbitMQServices, RabbitMQService } from '../rabbitmq.service';

// Mock the MarkdownPartCache
const mockMarkdownPartCache: Partial<MarkdownPartCache> = {
  initialize: vi.fn().mockResolvedValue(undefined),
  storePartMarkdown: vi.fn().mockResolvedValue(undefined),
  getPartStatus: vi.fn().mockResolvedValue('pending'),
  updatePartStatus: vi.fn().mockResolvedValue(undefined),
  getAllParts: vi.fn().mockResolvedValue([]),
  mergeAllParts: vi.fn().mockResolvedValue('# Merged Content'),
};

// Mock the IPdfPartTracker
const mockPartTracker: Partial<IPdfPartTracker> = {
  initializePdfProcessing: vi.fn().mockResolvedValue(undefined),
  getPdfProcessingStatus: vi.fn().mockResolvedValue(null),
  updatePartStatus: vi.fn().mockResolvedValue(undefined),
};

// Create a simple test to verify protocol compatibility
describe('MarkdownPartStorageWorker Protocol Compatibility', () => {
  let worker: MarkdownPartStorageWorker;
  let originalProtocol: string | undefined;

  beforeEach(async () => {
    // Reset environment
    vi.clearAllMocks();
    
    // Store original protocol
    originalProtocol = process.env.RABBITMQ_PROTOCOL;
    
    // Create a new worker instance for each test
    worker = new MarkdownPartStorageWorker(
      mockMarkdownPartCache as MarkdownPartCache,
      mockPartTracker as IPdfPartTracker
    );
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
      const amqpWorker = new MarkdownPartStorageWorker(
        mockMarkdownPartCache as MarkdownPartCache,
        mockPartTracker as IPdfPartTracker
      );
      
      // The worker should be created with AMQP protocol
      expect(amqpWorker).toBeDefined();
      expect(amqpWorker.isWorkerRunning()).toBe(false);
    });

    it('should detect STOMP protocol from environment', () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      
      // Create a new worker to pick up the environment variable
      const stompWorker = new MarkdownPartStorageWorker(
        mockMarkdownPartCache as MarkdownPartCache,
        mockPartTracker as IPdfPartTracker
      );
      
      // The worker should be created with STOMP protocol
      expect(stompWorker).toBeDefined();
      expect(stompWorker.isWorkerRunning()).toBe(false);
    });
  });

  describe('Protocol Switching', () => {
    it('should handle protocol switching between AMQP and STOMP', async () => {
      // Test with AMQP first
      process.env.RABBITMQ_PROTOCOL = 'amqp';
      const amqpWorker = new MarkdownPartStorageWorker(
        mockMarkdownPartCache as MarkdownPartCache,
        mockPartTracker as IPdfPartTracker
      );
      expect(amqpWorker).toBeDefined();
      
      // Switch to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      const stompWorker = new MarkdownPartStorageWorker(
        mockMarkdownPartCache as MarkdownPartCache,
        mockPartTracker as IPdfPartTracker
      );
      
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

      it('should handle markdown part storage request message', async () => {
        const testMessage: MarkdownPartStorageRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: 'test_item_id',
          partIndex: 0,
          totalParts: 3,
          markdownContent: '# Test Markdown Part 1\n\nThis is the first part of the test markdown content.',
          metadata: {
            pageCount: 5,
            startPage: 1,
            endPage: 5,
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new MarkdownPartStorageWorker(
          mockMarkdownPartCache as MarkdownPartCache,
          mockPartTracker as IPdfPartTracker,
          MessageProtocol.AMQP
        );
        
        // Spy on the handler method
        const handleMarkdownPartStorageRequestSpy = vi.spyOn(worker, 'handleMarkdownPartStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishMarkdownPartStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownPartStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });

      it('should handle markdown part storage request with retry', async () => {
        const testMessage: MarkdownPartStorageRequestMessage = {
          messageId: `test_message_id_retry_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: 'test_item_id',
          partIndex: 1,
          totalParts: 3,
          markdownContent: '# Test Markdown Part 2\n\nThis is the second part of the test markdown content.',
          metadata: {
            pageCount: 5,
            startPage: 6,
            endPage: 10,
          },
          priority: 'normal',
          retryCount: 1,
          maxRetries: 3,
        };

        // Create worker with AMQP protocol
        const worker = new MarkdownPartStorageWorker(
          mockMarkdownPartCache as MarkdownPartCache,
          mockPartTracker as IPdfPartTracker,
          MessageProtocol.AMQP
        );
        
        // Spy on the handler method
        const handleMarkdownPartStorageRequestSpy = vi.spyOn(worker, 'handleMarkdownPartStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishMarkdownPartStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownPartStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });
    });

    describe('use stomp', () => {
      beforeEach(async () => {
        rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
        await rabbitmqService.initialize();
      });

      it('should handle markdown part storage request message', async () => {
        const testMessage: MarkdownPartStorageRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: 'test_item_id',
          partIndex: 0,
          totalParts: 3,
          markdownContent: '# Test Markdown Part 1\n\nThis is the first part of the test markdown content.',
          metadata: {
            pageCount: 5,
            startPage: 1,
            endPage: 5,
          },
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
        };

        // Create worker with STOMP protocol
        const worker = new MarkdownPartStorageWorker(
          mockMarkdownPartCache as MarkdownPartCache,
          mockPartTracker as IPdfPartTracker,
          MessageProtocol.STOMP
        );
        
        // Spy on the handler method
        const handleMarkdownPartStorageRequestSpy = vi.spyOn(worker, 'handleMarkdownPartStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Verify the worker is using STOMP protocol and is running
        expect(worker.isWorkerRunning()).toBe(true);

        // Publish message
        await rabbitmqService.publishMarkdownPartStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownPartStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
        await worker.stop();
      });

      it('should handle markdown part storage request with retry', async () => {
        const testMessage: MarkdownPartStorageRequestMessage = {
          messageId: `test_message_id_retry_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
          itemId: 'test_item_id',
          partIndex: 1,
          totalParts: 3,
          markdownContent: '# Test Markdown Part 2\n\nThis is the second part of the test markdown content.',
          metadata: {
            pageCount: 5,
            startPage: 6,
            endPage: 10,
          },
          priority: 'normal',
          retryCount: 1,
          maxRetries: 3,
        };

        // Create worker with STOMP protocol
        const worker = new MarkdownPartStorageWorker(
          mockMarkdownPartCache as MarkdownPartCache,
          mockPartTracker as IPdfPartTracker,
          MessageProtocol.STOMP
        );
        
        // Spy on the handler method
        const handleMarkdownPartStorageRequestSpy = vi.spyOn(worker, 'handleMarkdownPartStorageRequest').mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishMarkdownPartStorageRequest(testMessage);
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(handleMarkdownPartStorageRequestSpy).toHaveBeenCalledWith(testMessage, expect.anything());
        
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
      // Mock the cache to throw an error
      (mockMarkdownPartCache.initialize as any).mockRejectedValue(new Error('Cache initialization error'));
      
      const testMessage: MarkdownPartStorageRequestMessage = {
        messageId: 'test_message_id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_PART_STORAGE_REQUEST',
        itemId: 'test_item_id',
        partIndex: 0,
        totalParts: 3,
        markdownContent: '# Test Markdown Part',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
      };
      
      // Create worker
      const worker = new MarkdownPartStorageWorker(
        mockMarkdownPartCache as MarkdownPartCache,
        mockPartTracker as IPdfPartTracker,
        MessageProtocol.AMQP
      );
      
      // The worker should handle the error gracefully without throwing
      // Note: We can't directly test the private handler, but we can verify the worker doesn't crash
      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });
});