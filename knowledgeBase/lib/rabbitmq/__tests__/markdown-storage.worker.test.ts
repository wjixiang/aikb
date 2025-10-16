import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarkdownStorageWorker } from '../markdown-storage.worker';
import {
  MarkdownStorageRequestMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  PdfProcessingStatus,
  RABBITMQ_QUEUES,
  RABBITMQ_CONSUMER_TAGS,
} from '../message.types';
import {
  AbstractLibraryStorage,
  BookMetadata,
} from '../../../knowledgeImport/library';
import Library from '../../../knowledgeImport/library';
import { ChunkingStrategyType } from '../../../lib/chunking/chunkingStrategy';
import { getRabbitMQService } from '../rabbitmq.service';

// Mock the RabbitMQ service
vi.mock('../rabbitmq.service', () => ({
  getRabbitMQService: vi.fn(() => ({
    isConnected: vi.fn(() => true),
    initialize: vi.fn(() => Promise.resolve()),
    consumeMessages: vi.fn(() => Promise.resolve('test-consumer-tag')),
    stopConsuming: vi.fn(() => Promise.resolve()),
    publishMarkdownStorageRequest: vi.fn(() => Promise.resolve(true)),
    publishMarkdownStorageCompleted: vi.fn(() => Promise.resolve(true)),
    publishMarkdownStorageFailed: vi.fn(() => Promise.resolve(true)),
    publishChunkingEmbeddingRequest: vi.fn(() => Promise.resolve(true)),
  })),
}));

// Mock the Library class
vi.mock('../../../knowledgeImport/library', () => ({
  default: vi.fn().mockImplementation(() => ({
    processItemChunks: vi.fn(() => Promise.resolve()),
  })),
  // Import other needed exports from the module
  AbstractLibraryStorage: class {},
  BookMetadata: {},
  Author: {},
  Collection: {},
  Citation: {},
  BookChunk: {},
  ChunkSearchFilter: {},
  HashUtils: {
    generateHashFromBuffer: vi.fn(() => 'mock-hash'),
    generateHashFromPath: vi.fn(() => Promise.resolve('mock-hash')),
    generateHashFromMetadata: vi.fn(() => 'mock-hash'),
  },
  IdUtils: {
    generateId: vi.fn(() => 'mock-id'),
    generateUUID: vi.fn(() => 'mock-uuid'),
  },
}));

// Mock the logger
vi.mock('../../../lib/logger', () => ({
  default: vi.fn(() => ({
    debug: vi.fn(console.log),
    info: vi.fn(console.log),
    warn: vi.fn(console.log),
    error: vi.fn(console.log),
  })),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-message-id'),
}));

describe('MarkdownStorageWorker', () => {
  let worker: MarkdownStorageWorker;
  let mockStorage: Partial<AbstractLibraryStorage>;
  let mockRabbitMQService: any;
  let mockLibrary: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock storage
    mockStorage = {
      getMetadata: vi.fn(),
      saveMarkdown: vi.fn(),
      updateMetadata: vi.fn(),
    };

    // Create mock RabbitMQ service
    mockRabbitMQService = {
      isConnected: vi.fn(() => false), // Return false to trigger initialize
      initialize: vi.fn(() => Promise.resolve()),
      consumeMessages: vi.fn((queue, handler) => {
        // Store the handler for later use in tests
        (mockRabbitMQService as any).messageHandler = handler;
        return Promise.resolve('test-consumer-tag');
      }),
      stopConsuming: vi.fn(() => Promise.resolve()),
      publishMarkdownStorageRequest: vi.fn(() => Promise.resolve(true)),
      publishMarkdownStorageCompleted: vi.fn(() => Promise.resolve(true)),
      publishMarkdownStorageFailed: vi.fn(() => Promise.resolve(true)),
      publishChunkingEmbeddingRequest: vi.fn(() => Promise.resolve(true)),
    };

    // Create mock Library
    mockLibrary = {
      processItemChunks: vi.fn(() => Promise.resolve()),
    };

    // Mock the getRabbitMQService function
    (getRabbitMQService as any).mockReturnValue(mockRabbitMQService);

    // Create worker instance
    worker = new MarkdownStorageWorker(mockStorage as AbstractLibraryStorage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Worker lifecycle', () => {
    it('should start the worker successfully', async () => {
      await worker.start();
      expect(worker.isWorkerRunning()).toBe(true);
      expect(mockRabbitMQService.initialize).toHaveBeenCalled();
      expect(mockRabbitMQService.consumeMessages).toHaveBeenCalledWith(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_REQUEST,
        expect.any(Function),
        {
          consumerTag: RABBITMQ_CONSUMER_TAGS.MARKDOWN_STORAGE_WORKER,
          noAck: false,
        },
      );
    });

    it('should not start if already running', async () => {
      await worker.start();
      await worker.start(); // Try to start again
      expect(mockRabbitMQService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should stop the worker successfully', async () => {
      await worker.start();
      await worker.stop();
      expect(worker.isWorkerRunning()).toBe(false);
      expect(mockRabbitMQService.stopConsuming).toHaveBeenCalledWith(
        'test-consumer-tag',
      );
    });

    it('should not stop if not running', async () => {
      await worker.stop();
      expect(mockRabbitMQService.stopConsuming).not.toHaveBeenCalled();
    });
  });

  describe('Markdown storage flow - Normal case', () => {
    it('should process markdown storage request successfully', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify storage operations
      expect(mockStorage.getMetadata).toHaveBeenCalledWith(itemId);
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        itemId,
        markdownContent,
      );

      // Verify status updates (called twice: processing and completed)
      expect(mockStorage.updateMetadata).toHaveBeenCalledTimes(2);

      // Verify chunks processing request was sent
      expect(mockRabbitMQService.publishChunkingEmbeddingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          chunkingStrategy: 'paragraph',
        }),
      );

      // Verify completion message
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          status: PdfProcessingStatus.COMPLETED,
        }),
      );

      // Note: The RabbitMQ service handles acknowledgment automatically
      // when the handler completes successfully
    });
  });

  describe('Markdown storage flow - Large content handling', () => {
    it('should handle large markdown content successfully', async () => {
      const itemId = 'test-item-id';
      // Create a large markdown content (100KB)
      const largeContent =
        '# Large Document\n\n' + 'This is a large paragraph. '.repeat(2000);
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Large Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent: largeContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify storage operations
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        itemId,
        largeContent,
      );
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
    });
  });

  describe('Markdown storage flow - Small content handling', () => {
    it('should handle small markdown content successfully', async () => {
      const itemId = 'test-item-id';
      const smallContent = '# Small Document\n\nMinimal content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Small Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent: smallContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify storage operations
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        itemId,
        smallContent,
      );
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
    });
  });

  describe('Storage failure handling - Save failed', () => {
    it('should handle save markdown failure gracefully', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockRejectedValue(
        new Error('Storage failure'),
      );
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        retryCount: 0,
        maxRetries: 3,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify error handling
      expect(mockStorage.updateMetadata).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: itemId,
          pdfProcessingStatus: PdfProcessingStatus.FAILED,
          pdfProcessingError: 'Storage failure',
          pdfProcessingMessage: 'Markdown storage failed: Storage failure',
        }),
      );

      // Verify retry mechanism
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          retryCount: 1,
        }),
      );

      // Note: The RabbitMQ service handles acknowledgment automatically
    });
  });

  describe('Storage failure handling - Metadata update failed', () => {
    it('should handle metadata update failure gracefully', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockRejectedValue(
        new Error('Metadata update failed'),
      );

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        retryCount: 0,
        maxRetries: 3,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify that metadata update failure doesn't prevent message completion
      expect(mockStorage.saveMarkdown).toHaveBeenCalled();
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
      // Note: The RabbitMQ service handles acknowledgment automatically
    });
  });

  describe('Chunks and embeddings processing - Normal case', () => {
    it('should process chunks and embeddings successfully', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify chunks processing request was sent
      expect(mockRabbitMQService.publishChunkingEmbeddingRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          chunkingStrategy: 'paragraph',
        }),
      );
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
    });
  });

  describe('Chunks and embeddings processing - Failure case', () => {
    it('should handle chunks processing failure without affecting main flow', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library with failure
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => ({
        processItemChunks: vi
          .fn()
          .mockRejectedValue(new Error('Chunks processing failed')),
      }));

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify that chunks processing failure doesn't prevent message completion
      expect(mockStorage.saveMarkdown).toHaveBeenCalled();
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
      // Note: The RabbitMQ service handles acknowledgment automatically
    });
  });

  describe('Completion message publishing', () => {
    it('should publish completion message successfully', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify completion message
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'test-message-id',
          itemId,
          status: PdfProcessingStatus.COMPLETED,
          processingTime: expect.any(Number),
        }),
      );
    });
  });

  describe('Failure message publishing', () => {
    it('should publish failure message when max retries reached', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockRejectedValue(
        new Error('Storage failure'),
      );
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        retryCount: 3, // Max retries reached
        maxRetries: 3,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify failure message
      expect(
        mockRabbitMQService.publishMarkdownStorageFailed,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          status: PdfProcessingStatus.FAILED,
          error: 'Storage failure',
          retryCount: 3,
          maxRetries: 3,
          canRetry: false,
          processingTime: expect.any(Number),
        }),
      );
    });
  });

  describe('Retry mechanism', () => {
    it('should retry processing when retry count is less than max retries', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockRejectedValue(
        new Error('Storage failure'),
      );
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        retryCount: 1, // Less than max retries
        maxRetries: 3,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify retry request
      expect(
        mockRabbitMQService.publishMarkdownStorageRequest,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          retryCount: 2, // Incremented
          messageId: 'test-message-id', // New message ID
        }),
      );
    });
  });

  describe('Status update verification', () => {
    it('should update status to processing', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify processing status update
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: itemId,
          pdfProcessingStatus: PdfProcessingStatus.PROCESSING,
          pdfProcessingMessage: 'Storing markdown content',
        }),
      );
    });

    it('should update status to completed', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify completed status update
      expect(mockStorage.updateMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: itemId,
          pdfProcessingStatus: PdfProcessingStatus.COMPLETED,
          pdfProcessingMessage: 'Markdown storage completed successfully',
          pdfProcessingProgress: 100,
          pdfProcessingCompletedAt: expect.any(Date),
        }),
      );
    });

    it('should update status to failed on error', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockRejectedValue(
        new Error('Storage failure'),
      );
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        retryCount: 3, // Max retries reached
        maxRetries: 3,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify failed status update
      expect(mockStorage.updateMetadata).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: itemId,
          pdfProcessingStatus: PdfProcessingStatus.FAILED,
          pdfProcessingMessage: 'Markdown storage failed: Storage failure',
          pdfProcessingError: 'Storage failure',
        }),
      );
    });
  });

  describe('Project not found handling', () => {
    it('should handle item not found gracefully', async () => {
      const itemId = 'non-existent-item';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(null);

      await worker.start();

      // Get the message handler and simulate a message
      const messageHandler = (mockRabbitMQService as any).messageHandler;

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        retryCount: 3, // Max retries reached
        maxRetries: 3,
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify error handling
      expect(mockStorage.getMetadata).toHaveBeenCalledWith(itemId);
      expect(
        mockRabbitMQService.publishMarkdownStorageFailed,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId,
          status: PdfProcessingStatus.FAILED,
          error: 'Item non-existent-item not found',
        }),
      );
    });
  });

  describe('Metadata handling', () => {
    it('should handle message with additional metadata', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        metadata: {
          pageCount: 10,
          extractedTitle: 'Extracted Title',
          extractedAuthors: [{ firstName: 'Jane', lastName: 'Smith' }],
          language: 'en',
          processingTime: 5000,
          partIndex: 1,
          isPart: true,
        },
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify processing with metadata
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        itemId,
        markdownContent,
      );
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
    });

    it('should handle message without metadata', async () => {
      const itemId = 'test-item-id';
      const markdownContent = '# Test Markdown\n\nThis is a test content.';
      const mockMetadata: BookMetadata = {
        id: itemId,
        title: 'Test Document',
        authors: [{ firstName: 'John', lastName: 'Doe' }],
        dateAdded: new Date(),
        dateModified: new Date(),
        tags: [],
        collections: [],
        fileType: 'pdf',
      };

      // Mock storage methods
      (mockStorage.getMetadata as any).mockResolvedValue(mockMetadata);
      (mockStorage.saveMarkdown as any).mockResolvedValue(undefined);
      (mockStorage.updateMetadata as any).mockResolvedValue(undefined);

      // Mock Library
      const LibraryMock = Library as any;
      LibraryMock.mockImplementation(() => mockLibrary);

      await worker.start();

      // Get the message handler and simulate a message
      const consumeCall = (mockRabbitMQService.consumeMessages as any).mock
        .calls[0];
      const messageHandler = consumeCall[1];

      const message: MarkdownStorageRequestMessage = {
        messageId: 'test-message-id',
        timestamp: Date.now(),
        eventType: 'MARKDOWN_STORAGE_REQUEST',
        itemId,
        markdownContent,
        // No metadata field
      };

      const originalMessage = { ack: vi.fn(), nack: vi.fn() };

      await messageHandler(message, originalMessage);

      // Verify processing without metadata
      expect(mockStorage.saveMarkdown).toHaveBeenCalledWith(
        itemId,
        markdownContent,
      );
      expect(
        mockRabbitMQService.publishMarkdownStorageCompleted,
      ).toHaveBeenCalled();
    });
  });
});
