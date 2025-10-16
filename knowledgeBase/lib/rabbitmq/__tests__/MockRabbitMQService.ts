import { vi } from 'vitest';
import {
  BaseRabbitMQMessage,
  PdfConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfPartConversionRequestMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  PdfMergingRequestMessage,
  PdfMergingProgressMessage,
  MarkdownStorageRequestMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  MarkdownPartStorageRequestMessage,
  MarkdownPartStorageProgressMessage,
  MarkdownPartStorageCompletedMessage,
  MarkdownPartStorageFailedMessage,
  ChunkingEmbeddingRequestMessage,
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  RabbitMQMessageOptions,
  PdfProcessingStatus,
} from '../message.types';

/**
 * Mock RabbitMQ Service for testing purposes
 * Simulates the behavior of the real RabbitMQ service without requiring actual RabbitMQ connection
 */
export class MockRabbitMQService {
  private isInitializedValue = false;
  private isConnectedValue = false;
  private messageHandlers: Map<string, Function> = new Map();
  private publishedMessages: Array<{ routingKey: string; message: any }> = [];
  private consumerTags: Map<string, string> = new Map();

  /**
   * Initialize the mock RabbitMQ service
   */
  async initialize(): Promise<void> {
    console.log('[MockRabbitMQService] Initializing...');
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
    this.isInitializedValue = true;
    this.isConnectedValue = true;
    console.log('[MockRabbitMQService] Initialized successfully');
  }

  /**
   * Close the mock RabbitMQ service
   */
  async close(): Promise<void> {
    console.log('[MockRabbitMQService] Closing...');
    this.isInitializedValue = false;
    this.isConnectedValue = false;
    this.messageHandlers.clear();
    this.consumerTags.clear();
    console.log('[MockRabbitMQService] Closed successfully');
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return this.isConnectedValue;
  }

  /**
   * Publish a message to RabbitMQ (mock implementation)
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options: RabbitMQMessageOptions = {},
  ): Promise<boolean> {
    console.log(`[MockRabbitMQService] Publishing message to ${routingKey}:`, message.eventType);
    
    // Store the published message for testing verification
    this.publishedMessages.push({ routingKey, message });
    
    // Simulate message publishing delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return true;
  }

  /**
   * Consume messages from a queue (mock implementation)
   */
  async consumeMessages(
    queueName: string,
    handler: Function,
    options: any = {},
  ): Promise<string> {
    console.log(`[MockRabbitMQService] Starting to consume messages from queue: ${queueName}`);
    
    // Store the handler for later use in tests
    this.messageHandlers.set(queueName, handler);
    
    // Generate a mock consumer tag
    const consumerTag = `mock-consumer-${queueName}-${Date.now()}`;
    this.consumerTags.set(queueName, consumerTag);
    
    return consumerTag;
  }

  /**
   * Stop consuming messages from a queue (mock implementation)
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    console.log(`[MockRabbitMQService] Stopping consumer: ${consumerTag}`);
    
    // Find and remove the consumer tag
    for (const [queueName, tag] of this.consumerTags.entries()) {
      if (tag === consumerTag) {
        this.consumerTags.delete(queueName);
        this.messageHandlers.delete(queueName);
        break;
      }
    }
  }

  /**
   * Get the message handler for a specific queue (for testing purposes)
   */
  getMessageHandler(queueName: string): Function | undefined {
    return this.messageHandlers.get(queueName);
  }

  /**
   * Get all published messages (for testing purposes)
   */
  getPublishedMessages(): Array<{ routingKey: string; message: any }> {
    return [...this.publishedMessages];
  }

  /**
   * Clear published messages (for testing purposes)
   */
  clearPublishedMessages(): void {
    this.publishedMessages = [];
  }

  /**
   * Simulate receiving a message on a specific queue (for testing purposes)
   */
  async simulateMessage(queueName: string, message: any): Promise<void> {
    const handler = this.messageHandlers.get(queueName);
    if (handler) {
      const mockOriginalMessage = {
        fields: {
          routingKey: queueName,
        },
        properties: {
          messageId: message.messageId || 'mock-message-id',
          timestamp: message.timestamp || Date.now(),
        },
        content: Buffer.from(JSON.stringify(message)),
      };
      
      // Mock the ack and nack functions
      const mockAck = vi.fn();
      const mockNack = vi.fn();
      
      try {
        await handler(message, mockOriginalMessage);
        // Auto-ack the message
        mockAck();
      } catch (error) {
        console.error(`[MockRabbitMQService] Error handling message on queue ${queueName}:`, error);
        // Auto-nack on error
        mockNack();
      }
    } else {
      console.warn(`[MockRabbitMQService] No handler found for queue: ${queueName}`);
    }
  }

  // Specific publish methods for different message types

  async publishPdfConversionRequest(message: PdfConversionRequestMessage): Promise<boolean> {
    return this.publishMessage('pdf.conversion.request', message);
  }

  async publishPdfConversionProgress(message: PdfConversionProgressMessage): Promise<boolean> {
    return this.publishMessage('pdf.conversion.progress', message);
  }

  async publishPdfConversionCompleted(message: PdfConversionCompletedMessage): Promise<boolean> {
    return this.publishMessage('pdf.conversion.completed', message);
  }

  async publishPdfConversionFailed(message: PdfConversionFailedMessage): Promise<boolean> {
    return this.publishMessage('pdf.conversion.failed', message);
  }

  async publishPdfAnalysisRequest(message: PdfAnalysisRequestMessage): Promise<boolean> {
    return this.publishMessage('pdf.analysis.request', message);
  }

  async publishPdfAnalysisCompleted(message: PdfAnalysisCompletedMessage): Promise<boolean> {
    return this.publishMessage('pdf.analysis.completed', message);
  }

  async publishPdfAnalysisFailed(message: PdfAnalysisFailedMessage): Promise<boolean> {
    return this.publishMessage('pdf.analysis.failed', message);
  }

  async publishPdfPartConversionRequest(message: PdfPartConversionRequestMessage): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.request', message);
  }

  async publishPdfPartConversionCompleted(message: PdfPartConversionCompletedMessage): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.completed', message);
  }

  async publishPdfPartConversionFailed(message: PdfPartConversionFailedMessage): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.failed', message);
  }

  async publishPdfMergingRequest(message: PdfMergingRequestMessage): Promise<boolean> {
    return this.publishMessage('pdf.merging.request', message);
  }

  async publishPdfMergingProgress(message: PdfMergingProgressMessage): Promise<boolean> {
    return this.publishMessage('pdf.merging.progress', message);
  }

  async publishMarkdownStorageRequest(message: MarkdownStorageRequestMessage): Promise<boolean> {
    return this.publishMessage('markdown.storage.request', message);
  }

  async publishMarkdownStorageCompleted(message: MarkdownStorageCompletedMessage): Promise<boolean> {
    return this.publishMessage('markdown.storage.completed', message);
  }

  async publishMarkdownStorageFailed(message: MarkdownStorageFailedMessage): Promise<boolean> {
    return this.publishMessage('markdown.storage.failed', message);
  }

  async publishMarkdownPartStorageRequest(message: MarkdownPartStorageRequestMessage): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.request', message);
  }

  async publishMarkdownPartStorageProgress(message: MarkdownPartStorageProgressMessage): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.progress', message);
  }

  async publishMarkdownPartStorageCompleted(message: MarkdownPartStorageCompletedMessage): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.completed', message);
  }

  async publishMarkdownPartStorageFailed(message: MarkdownPartStorageFailedMessage): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.failed', message);
  }

  async publishChunkingEmbeddingRequest(message: ChunkingEmbeddingRequestMessage): Promise<boolean> {
    return this.publishMessage('chunking.embedding.request', message);
  }

  async publishChunkingEmbeddingProgress(message: ChunkingEmbeddingProgressMessage): Promise<boolean> {
    return this.publishMessage('chunking.embedding.progress', message);
  }

  async publishChunkingEmbeddingCompleted(message: ChunkingEmbeddingCompletedMessage): Promise<boolean> {
    return this.publishMessage('chunking.embedding.completed', message);
  }

  async publishChunkingEmbeddingFailed(message: ChunkingEmbeddingFailedMessage): Promise<boolean> {
    return this.publishMessage('chunking.embedding.failed', message);
  }

  /**
   * Get queue info (mock implementation)
   */
  async getQueueInfo(queueName: string): Promise<any> {
    return {
      queue: queueName,
      messageCount: 0,
      consumerCount: this.messageHandlers.has(queueName) ? 1 : 0,
    };
  }

  /**
   * Purge queue (mock implementation)
   */
  async purgeQueue(queueName: string): Promise<void> {
    console.log(`[MockRabbitMQService] Purging queue: ${queueName}`);
    // Nothing to purge in mock implementation
  }

  /**
   * Health check (mock implementation)
   */
  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      connected: this.isConnectedValue,
      initialized: this.isInitializedValue,
      queues: Array.from(this.messageHandlers.keys()),
    };
  }
}

// Singleton instance for testing
let mockRabbitMQServiceInstance: MockRabbitMQService | null = null;

/**
 * Get or create the mock RabbitMQ service instance
 */
export function getMockRabbitMQService(): MockRabbitMQService {
  if (!mockRabbitMQServiceInstance) {
    mockRabbitMQServiceInstance = new MockRabbitMQService();
  }
  return mockRabbitMQServiceInstance;
}

/**
 * Reset the mock RabbitMQ service instance
 */
export function resetMockRabbitMQService(): void {
  if (mockRabbitMQServiceInstance) {
    mockRabbitMQServiceInstance.close();
    mockRabbitMQServiceInstance = null;
  }
}