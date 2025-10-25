import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChunkingEmbeddingWorker } from '../chunking-embedding.worker';
import {
  AbstractLibraryStorage,
  ChunkingEmbeddingGroup,
} from '../../../knowledgeBase/knowledgeImport/library';
import Library from '../../../knowledgeBase/knowledgeImport/library';
import {
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  ChunkingEmbeddingRequestMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from '../message.types';
import { MessageProtocol } from '../message-service.interface';
import {
  getRabbitMQService,
  closeAllRabbitMQServices,
  RabbitMQService,
} from '../rabbitmq.service';
import {
  defaultEmbeddingConfig,
  EmbeddingProvider,
} from '@aikb/embedding';
import {
  ChunkingStrategy,
  defaultChunkingConfig,
} from '@aikb/chunking';

// Mock the Library class
vi.mock('../../../knowledgeBase/knowledgeImport/library', async () => {
  const actual = await vi.importActual(
    '../../../knowledgeBase/knowledgeImport/library',
  );
  return {
    ...actual,
    default: vi.fn().mockImplementation(() => ({
      processItemChunks: vi.fn().mockResolvedValue(undefined),
      getItemChunks: vi.fn().mockResolvedValue([]),
    })),
  };
});

// Mock the storage implementation
const mockStorage: Partial<AbstractLibraryStorage> = {
  getMetadata: vi.fn(),
  updateMetadata: vi.fn(),
  getMarkdown: vi.fn(),
};

const mockGroupConfig: ChunkingEmbeddingGroup = {
  id: 'testid',
  name: 'test_name',
  chunkingConfig: defaultChunkingConfig,
  embeddingConfig: defaultEmbeddingConfig,
  isDefault: false,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Create a simple test to verify protocol compatibility
describe('ChunkingEmbeddingWorker Protocol Compatibility', () => {
  let worker: ChunkingEmbeddingWorker;
  let originalProtocol: string | undefined;

  beforeEach(async () => {
    // Reset environment
    vi.clearAllMocks();

    // Store original protocol
    originalProtocol = process.env.RABBITMQ_PROTOCOL;

    // Create a new worker instance for each test
    worker = new ChunkingEmbeddingWorker(mockStorage as AbstractLibraryStorage);

    // Mock the storage getMetadata to return a valid item
    (mockStorage.getMetadata as any).mockResolvedValue({
      id: 'test-item-id',
      title: 'Test PDF',
      s3Key: 'test/test.pdf',
      pdfProcessingStatus: 'pending',
      dateModified: new Date(),
    });

    // Mock getMarkdown to return content
    (mockStorage.getMarkdown as any).mockResolvedValue(
      '# Test Markdown Content',
    );

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
      const amqpWorker = new ChunkingEmbeddingWorker(
        mockStorage as AbstractLibraryStorage,
      );

      // The worker should be created with AMQP protocol
      expect(amqpWorker).toBeDefined();
      expect(amqpWorker.isWorkerRunning()).toBe(false);
    });

    it('should detect STOMP protocol from environment', () => {
      // Set protocol to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';

      // Create a new worker to pick up the environment variable
      const stompWorker = new ChunkingEmbeddingWorker(
        mockStorage as AbstractLibraryStorage,
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
      const amqpWorker = new ChunkingEmbeddingWorker(
        mockStorage as AbstractLibraryStorage,
      );
      expect(amqpWorker).toBeDefined();

      // Switch to STOMP
      process.env.RABBITMQ_PROTOCOL = 'stomp';
      const stompWorker = new ChunkingEmbeddingWorker(
        mockStorage as AbstractLibraryStorage,
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

      it('should handle chunking embedding request message', async () => {
        const testMessage: ChunkingEmbeddingRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'CHUNKING_EMBEDDING_REQUEST',
          itemId: 'test_item_id',
          markdownContent:
            '# test markdown content\n\nthis is a test markdown content for chunking and embedding.',
          chunkingConfig: defaultChunkingConfig,
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
          groupConfig: mockGroupConfig,
        };

        // Create worker with AMQP protocol
        const worker = new ChunkingEmbeddingWorker(
          mockStorage as AbstractLibraryStorage,
          MessageProtocol.AMQP,
        );

        // Spy on the private handler method
        const handleMessageSpy = vi
          .spyOn(worker as any, 'handleMessage')
          .mockImplementation(async () => {});

        await worker.start();

        // Publish message
        await rabbitmqService.publishChunkingEmbeddingRequest(testMessage);
        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(handleMessageSpy).toHaveBeenCalledWith(
          testMessage,
          expect.anything(),
        );

        await worker.stop();
      });

      it('should handle multi-version chunking embedding request message', async () => {
        const testMessage: ChunkingEmbeddingRequestMessage = {
          messageId: `test_message_id_mv_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'CHUNKING_EMBEDDING_REQUEST',
          itemId: 'test_item_id',
          groupConfig: {
            name: 'Test Group',
            embeddingConfig: {
              model: 'text-embedding-ada-002' as any,
              dimension: 1536,
              batchSize: 100,
              maxRetries: 3,
              timeout: 30000,
              provider: EmbeddingProvider.OPENAI,
            },
            chunkingConfig: { maxChunkSize: 1000 },
            isDefault: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          priority: 'high',
          retryCount: 0,
          maxRetries: 3,
          forceReprocess: false,
          preserveExisting: true,
        };

        // Create worker with AMQP protocol
        const worker = new ChunkingEmbeddingWorker(
          mockStorage as AbstractLibraryStorage,
          MessageProtocol.AMQP,
        );

        // Spy on the private handler method
        const handleMessageSpy = vi
          .spyOn(worker as any, 'handleMessage')
          .mockImplementation(async () => {});

        await worker.start();

        // Publish the multi-version message directly using the generic publishMessage method
        await rabbitmqService.publishMessage(
          'chunking-embedding-request',
          testMessage,
          {
            persistent: true,
            priority:
              testMessage.priority === 'high'
                ? 10
                : testMessage.priority === 'low'
                  ? 1
                  : 5,
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Check that the handler was called with the correct message structure
        expect(handleMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            messageId: testMessage.messageId,
            eventType: 'CHUNKING_EMBEDDING_REQUEST',
            itemId: testMessage.itemId,
            priority: testMessage.priority,
            retryCount: testMessage.retryCount,
            maxRetries: testMessage.maxRetries,
            forceReprocess: testMessage.forceReprocess,
            preserveExisting: testMessage.preserveExisting,
            groupConfig: expect.objectContaining({
              name: testMessage.groupConfig?.name,
              chunkingStrategy:
                testMessage.groupConfig?.chunkingConfig.strategy,
              embeddingProvider:
                testMessage.groupConfig?.embeddingConfig.provider,
            }),
          }),
          expect.anything(),
        );

        await worker.stop();
      });
    });

    describe('use stomp', () => {
      beforeEach(async () => {
        rabbitmqService = getRabbitMQService(MessageProtocol.STOMP);
        await rabbitmqService.initialize();
      });

      it('should handle chunking embedding request message', async () => {
        const testMessage: ChunkingEmbeddingRequestMessage = {
          messageId: `test_message_id_${Date.now()}`,
          timestamp: Date.now(),
          eventType: 'CHUNKING_EMBEDDING_REQUEST',
          itemId: 'test_item_id',
          markdownContent:
            '# test markdown content\n\nthis is a test markdown content for chunking and embedding.',
          chunkingConfig: defaultChunkingConfig,
          priority: 'normal',
          retryCount: 0,
          maxRetries: 3,
          groupConfig: mockGroupConfig,
        };

        // Create worker with STOMP protocol
        const worker = new ChunkingEmbeddingWorker(
          mockStorage as AbstractLibraryStorage,
          MessageProtocol.STOMP,
        );

        // Spy on the private handler method
        const handleMessageSpy = vi
          .spyOn(worker as any, 'handleMessage')
          .mockImplementation(async () => {});

        await worker.start();

        // Verify the worker is using STOMP protocol and is running
        expect(worker.isWorkerRunning()).toBe(true);

        // Publish message
        await rabbitmqService.publishChunkingEmbeddingRequest(testMessage);
        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(handleMessageSpy).toHaveBeenCalledWith(
          testMessage,
          expect.anything(),
        );

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
      // Create worker
      const worker = new ChunkingEmbeddingWorker(
        mockStorage as AbstractLibraryStorage,
        MessageProtocol.AMQP,
      );

      // The worker should handle the error gracefully without throwing
      // Note: We can't directly test the private handler, but we can verify the worker doesn't crash
      expect(worker).toBeDefined();
      expect(worker.isWorkerRunning()).toBe(false);
    });
  });
});
