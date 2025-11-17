import { MessageProtocol } from './message-service.interface';
import createLoggerWithPrefix from 'log-management/logger';
import { IRabbitMQService } from './rabbitmq-service.interface';

const logger = createLoggerWithPrefix('RabbitMQDebugTools');

/**
 * Mock RabbitMQ Service for testing and debugging
 */
export class MockRabbitMQService implements IRabbitMQService {
  private messageProtocol: MessageProtocol;
  private connected = false;
  private messages: any[] = [];

  constructor(protocol: MessageProtocol = MessageProtocol.AMQP) {
    this.messageProtocol = protocol;
  }

  get protocol(): MessageProtocol {
    return this.messageProtocol;
  }

  async initialize(): Promise<void> {
    logger.info('Mock RabbitMQ service initialized');
    this.connected = true;
  }

  async publishMessage(routingKey: string, message: any): Promise<boolean> {
    logger.debug(`Mock publishing to ${routingKey}:`, message);
    this.messages.push({ routingKey, message, timestamp: Date.now() });
    return true;
  }

  async consumeMessages(
    queueName: string,
    onMessage: (message: any, originalMessage: any) => void,
  ): Promise<string> {
    logger.debug(`Mock consuming from ${queueName}`);
    return 'mock-consumer-' + Date.now();
  }

  async stopConsuming(consumerTag: string): Promise<void> {
    logger.debug(`Mock stopping consumer: ${consumerTag}`);
  }

  async getQueueInfo(queueName: string): Promise<any> {
    logger.debug(`Mock getting queue info for: ${queueName}`);
    return { messageCount: this.messages.length, consumerCount: 1 };
  }

  async purgeQueue(queueName: string): Promise<void> {
    logger.debug(`Mock purging queue: ${queueName}`);
    this.messages = [];
  }

  async healthCheck(): Promise<any> {
    return {
      status: this.connected ? 'healthy' : 'unhealthy',
      details: {
        connected: this.connected,
        channelOpen: this.connected,
        reconnectAttempts: 0,
      },
    };
  }

  async close(): Promise<void> {
    logger.info('Mock RabbitMQ service closed');
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConnectionStatus():
    | 'connected'
    | 'disconnected'
    | 'connecting'
    | 'reconnecting' {
    return this.connected ? 'connected' : 'disconnected';
  }

  // PDF-specific methods (simplified implementations)
  async publishPdfConversionRequest(request: any): Promise<boolean> {
    return this.publishMessage('pdf.conversion.request', request);
  }

  async publishPdfConversionProgress(progress: any): Promise<boolean> {
    return this.publishMessage('pdf.conversion.progress', progress);
  }

  async publishPdfConversionCompleted(completed: any): Promise<boolean> {
    return this.publishMessage('pdf.conversion.completed', completed);
  }

  async publishPdfConversionFailed(failed: any): Promise<boolean> {
    return this.publishMessage('pdf.conversion.failed', failed);
  }

  async publishPdfAnalysisRequest(request: any): Promise<boolean> {
    return this.publishMessage('pdf.analysis.request', request);
  }

  async publishPdfAnalysisCompleted(completed: any): Promise<boolean> {
    return this.publishMessage('pdf.analysis.completed', completed);
  }

  async publishPdfAnalysisFailed(failed: any): Promise<boolean> {
    return this.publishMessage('pdf.analysis.failed', failed);
  }

  async publishPdfPartConversionRequest(request: any): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.request', request);
  }

  async publishPdfPartConversionCompleted(completed: any): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.completed', completed);
  }

  async publishPdfPartConversionFailed(failed: any): Promise<boolean> {
    return this.publishMessage('pdf.part.conversion.failed', failed);
  }

  async publishPdfMergingRequest(request: any): Promise<boolean> {
    return this.publishMessage('pdf.merging.request', request);
  }

  async publishPdfMergingProgress(progress: any): Promise<boolean> {
    return this.publishMessage('pdf.merging.progress', progress);
  }

  async publishMarkdownStorageRequest(request: any): Promise<boolean> {
    return this.publishMessage('markdown.storage.request', request);
  }

  async publishMarkdownStorageCompleted(completed: any): Promise<boolean> {
    return this.publishMessage('markdown.storage.completed', completed);
  }

  async publishMarkdownStorageFailed(failed: any): Promise<boolean> {
    return this.publishMessage('markdown.storage.failed', failed);
  }

  async publishMarkdownPartStorageRequest(request: any): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.request', request);
  }

  async publishMarkdownPartStorageProgress(progress: any): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.progress', progress);
  }

  async publishMarkdownPartStorageCompleted(completed: any): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.completed', completed);
  }

  async publishMarkdownPartStorageFailed(failed: any): Promise<boolean> {
    return this.publishMessage('markdown.part.storage.failed', failed);
  }

  async publishChunkingEmbeddingRequest(request: any): Promise<boolean> {
    return this.publishMessage('chunking.embedding.request', request);
  }

  async publishChunkingEmbeddingProgress(progress: any): Promise<boolean> {
    return this.publishMessage('chunking.embedding.progress', progress);
  }

  async publishChunkingEmbeddingCompleted(completed: any): Promise<boolean> {
    return this.publishMessage('chunking.embedding.completed', completed);
  }

  async publishChunkingEmbeddingFailed(failed: any): Promise<boolean> {
    return this.publishMessage('chunking.embedding.failed', failed);
  }
}

/**
 * RabbitMQ Debug Tools
 * Provides utilities for debugging and testing RabbitMQ functionality
 */
export class RabbitMQDebugTools {
  /**
   * Get a mock RabbitMQ service for testing
   * @param protocol - The message protocol to use
   * @returns Mock RabbitMQ service instance
   */
  static getMockService(
    protocol: MessageProtocol = MessageProtocol.AMQP,
  ): IRabbitMQService {
    return new MockRabbitMQService(protocol);
  }

  /**
   * Create a test message
   * @param type - The message type
   * @param data - The message data
   * @returns Test message object
   */
  static createTestMessage(type: string, data: any = {}): any {
    return {
      messageId: `test-${Date.now()}`,
      timestamp: Date.now(),
      eventType: type,
      ...data,
    };
  }

  /**
   * Validate message structure
   * @param message - The message to validate
   * @returns True if valid, false otherwise
   */
  static validateMessage(message: any): boolean {
    return (
      message &&
      typeof message.messageId === 'string' &&
      typeof message.timestamp === 'number' &&
      typeof message.eventType === 'string'
    );
  }

  /**
   * Log message details for debugging
   * @param message - The message to log
   * @param context - Additional context information
   */
  static logMessage(message: any, context?: string): void {
    const contextStr = context ? `[${context}] ` : '';
    logger.debug(`${contextStr}Message:`, {
      messageId: message.messageId,
      eventType: message.eventType,
      timestamp: new Date(message.timestamp).toISOString(),
    });
  }
}

/**
 * Get debug mock RabbitMQ service
 * @param protocol - The message protocol to use
 * @returns Mock RabbitMQ service instance
 */
export function getDebugMockRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): IRabbitMQService {
  return RabbitMQDebugTools.getMockService(protocol);
}
