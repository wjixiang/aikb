import { ConsumeMessage } from "amqplib";
import { vi } from "vitest";
import { IMessageService, MessageProtocol } from "../message-service.interface";
import { IRabbitMQService } from "../rabbitmq-service.interface";
import { BaseRabbitMQMessage, RabbitMQMessageOptions, PdfConversionRequestMessage, PdfConversionProgressMessage, PdfConversionCompletedMessage, PdfConversionFailedMessage, PdfAnalysisRequestMessage, PdfAnalysisCompletedMessage, PdfAnalysisFailedMessage, PdfPartConversionRequestMessage, PdfPartConversionCompletedMessage, PdfPartConversionFailedMessage, PdfMergingRequestMessage, PdfMergingProgressMessage, MarkdownStorageRequestMessage, MarkdownStorageCompletedMessage, MarkdownStorageFailedMessage, MarkdownPartStorageRequestMessage, MarkdownPartStorageProgressMessage, MarkdownPartStorageCompletedMessage, MarkdownPartStorageFailedMessage, ChunkingEmbeddingRequestMessage, ChunkingEmbeddingProgressMessage, ChunkingEmbeddingCompletedMessage, ChunkingEmbeddingFailedMessage, PdfConversionMessage } from "../message.types";

// Mock dependencies
export const mockMessageService: IMessageService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
  getConnectionStatus: vi.fn().mockReturnValue('connected'),
  healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', details: { connected: true } }),
  publishMessage: vi.fn().mockResolvedValue(true),
  consumeMessages: vi.fn().mockResolvedValue('test-consumer-tag'),
  stopConsuming: vi.fn().mockResolvedValue(undefined),
  getQueueInfo: vi.fn().mockResolvedValue({ messageCount: 0, consumerCount: 1 }),
  purgeQueue: vi.fn().mockResolvedValue(undefined),
  setupTopology: vi.fn().mockResolvedValue(undefined),
};

// Create a mock object with all the required methods and properties
const mockRabbitMQServiceImpl = {
  // Private properties (accessed through type assertion)
  messageService: mockMessageService,
  isInitialized: false,
  isConnecting: false,
  initializationPromise: null,
  initializationResolver: null,
  protocol: MessageProtocol.AMQP,
  
  // Public methods
  initialize: vi.fn().mockResolvedValue(undefined),
  waitForConnectionReady: vi.fn().mockResolvedValue(undefined),
  publishMessage: vi.fn().mockResolvedValue(true),
  publishPdfConversionRequest: vi.fn().mockResolvedValue(true),
  publishPdfConversionProgress: vi.fn().mockResolvedValue(true),
  publishPdfConversionCompleted: vi.fn().mockResolvedValue(true),
  publishPdfConversionFailed: vi.fn().mockResolvedValue(true),
  publishPdfAnalysisRequest: vi.fn().mockResolvedValue(true),
  publishPdfAnalysisCompleted: vi.fn().mockResolvedValue(true),
  publishPdfAnalysisFailed: vi.fn().mockResolvedValue(true),
  publishPdfPartConversionRequest: vi.fn().mockResolvedValue(true),
  publishPdfPartConversionCompleted: vi.fn().mockResolvedValue(true),
  publishPdfPartConversionFailed: vi.fn().mockResolvedValue(true),
  publishPdfMergingRequest: vi.fn().mockResolvedValue(true),
  publishPdfMergingProgress: vi.fn().mockResolvedValue(true),
  publishMarkdownStorageRequest: vi.fn().mockResolvedValue(true),
  publishMarkdownStorageCompleted: vi.fn().mockResolvedValue(true),
  publishMarkdownStorageFailed: vi.fn().mockResolvedValue(true),
  publishMarkdownPartStorageRequest: vi.fn().mockResolvedValue(true),
  publishMarkdownPartStorageProgress: vi.fn().mockResolvedValue(true),
  publishMarkdownPartStorageCompleted: vi.fn().mockResolvedValue(true),
  publishMarkdownPartStorageFailed: vi.fn().mockResolvedValue(true),
  publishChunkingEmbeddingRequest: vi.fn().mockResolvedValue(true),
  publishChunkingEmbeddingProgress: vi.fn().mockResolvedValue(true),
  publishChunkingEmbeddingCompleted: vi.fn().mockResolvedValue(true),
  publishChunkingEmbeddingFailed: vi.fn().mockResolvedValue(true),
  consumeMessages: vi.fn().mockResolvedValue('test-consumer-tag'),
  stopConsuming: vi.fn().mockResolvedValue(undefined),
  getQueueInfo: vi.fn().mockResolvedValue({ messageCount: 0, consumerCount: 1 }),
  purgeQueue: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', details: { connected: true } }),
  close: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
};

// Export with type assertion to bypass the private property issue
export const mockRabbitMQService = mockRabbitMQServiceImpl as unknown as IRabbitMQService;

// Also export a helper to access the mock properties for testing
export const getMockRabbitMQServiceImpl = () => mockRabbitMQServiceImpl;