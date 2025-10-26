import {
  BaseRabbitMQMessage,
  ChunkingEmbeddingProgressMessage,
  ChunkingEmbeddingCompletedMessage,
  ChunkingEmbeddingFailedMessage,
  ChunkingEmbeddingRequestMessage,
} from './message.types';

/**
 * Connection status for message service
 */
export type ConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting';

/**
 * Health check result for message service
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  details: {
    connected: boolean;
    [key: string]: any;
  };
}

/**
 * Queue information
 */
export interface QueueInfo {
  messageCount: number;
  consumerCount: number;
  [key: string]: any;
}

/**
 * Consumer options
 */
export interface ConsumerOptions {
  consumerTag?: string;
  noAck?: boolean;
  exclusive?: boolean;
  priority?: number;
}

/**
 * Message consumer callback
 */
export type MessageConsumer<T = ChunkingEmbeddingRequestMessage> = (
  message: T,
  originalMessage: any,
) => void | Promise<void>;

/**
 * Message service interface - abstracts core message operations
 * This interface provides a contract for different messaging protocol implementations
 * (RabbitMQ, STOMP, etc.) while maintaining a consistent API
 */
export interface IMessageService {
  /**
   * Initialize the message service connection
   */
  initialize(): Promise<void>;

  /**
   * Close the connection and cleanup resources
   */
  close(): Promise<void>;

  /**
   * Check if the service is connected
   */
  isConnected(): boolean;

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus;

  /**
   * Perform health check on the service
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Publish a message with the specified routing key
   */
  publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options?: any,
  ): Promise<boolean>;

  /**
   * Consume messages from a queue
   */
  consumeMessages(
    queueName: string,
    onMessage: MessageConsumer,
    options?: ConsumerOptions,
  ): Promise<string>;

  /**
   * Stop consuming messages with the given consumer tag
   */
  stopConsuming(consumerTag: string): Promise<void>;

  /**
   * Get information about a queue
   */
  getQueueInfo(queueName: string): Promise<QueueInfo | null>;

  /**
   * Purge all messages from a queue
   */
  purgeQueue(queueName: string): Promise<void>;

  /**
   * Setup queues, exchanges, and bindings
   * This is protocol-specific and may not apply to all implementations
   */
  setupTopology?(): Promise<void>;
}

/**
 * Message service factory interface
 */
export interface IMessageServiceFactory {
  /**
   * Create a new message service instance
   */
  create(config?: any): IMessageService;
}

/**
 * Protocol types supported by the message service
 */
export enum MessageProtocol {
  AMQP = 'amqp',
  STOMP = 'stomp',
}

/**
 * Message service configuration
 */
export interface MessageServiceConfig {
  protocol: MessageProtocol;
  connectionOptions: any;
  topology?: {
    queues?: any[];
    exchanges?: any[];
    bindings?: any[];
  };
  reconnect?: {
    maxAttempts: number;
    delay: number;
  };
  healthCheck?: {
    interval: number;
    timeout: number;
  };
}