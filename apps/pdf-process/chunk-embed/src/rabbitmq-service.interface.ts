/**
 * RabbitMQ service interface
 */
export interface IRabbitMQService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Close the service
   */
  close(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Publish chunking and embedding request
   */
  publishChunkingEmbeddingRequest(request: any): Promise<boolean>;

  /**
   * Publish chunking and embedding progress
   */
  publishChunkingEmbeddingProgress(progress: any): Promise<boolean>;

  /**
   * Publish chunking and embedding completed
   */
  publishChunkingEmbeddingCompleted(completed: any): Promise<boolean>;

  /**
   * Publish chunking and embedding failed
   */
  publishChunkingEmbeddingFailed(failed: any): Promise<boolean>;

  /**
   * Consume messages from a queue
   */
  consumeMessages(
    queueName: string,
    onMessage: (message: any, originalMessage: any) => void,
    options?: {
      consumerTag?: string;
      noAck?: boolean;
      exclusive?: boolean;
      priority?: number;
    },
  ): Promise<string>;

  /**
   * Stop consuming messages
   */
  stopConsuming(consumerTag: string): Promise<void>;

  /**
   * Get queue information
   */
  getQueueInfo(queueName: string): Promise<any>;

  /**
   * Purge a queue
   */
  purgeQueue(queueName: string): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      channelOpen: boolean;
      reconnectAttempts: number;
    };
  }>;
}