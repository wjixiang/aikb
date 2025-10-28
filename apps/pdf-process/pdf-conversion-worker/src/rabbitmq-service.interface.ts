/**
 * RabbitMQ Service interface
 * Provides a simplified interface for RabbitMQ operations
 */
export interface IRabbitMQService {
  /**
   * Initialize the service
   */
  initialize(): Promise<void>;

  /**
   * Check if connected
   */
  isConnected(): boolean;

  /**
   * Publish PDF conversion request
   */
  publishPdfConversionRequest(request: any): Promise<boolean>;

  /**
   * Publish PDF conversion progress
   */
  publishPdfConversionProgress(progress: any): Promise<boolean>;

  /**
   * Publish PDF conversion completed
   */
  publishPdfConversionCompleted(completed: any): Promise<boolean>;

  /**
   * Publish PDF conversion failed
   */
  publishPdfConversionFailed(failed: any): Promise<boolean>;

  /**
   * Publish PDF part conversion request
   */
  publishPdfPartConversionRequest(request: any): Promise<boolean>;

  /**
   * Publish PDF part conversion completed
   */
  publishPdfPartConversionCompleted(completed: any): Promise<boolean>;

  /**
   * Publish PDF part conversion failed
   */
  publishPdfPartConversionFailed(failed: any): Promise<boolean>;

  /**
   * Publish markdown storage request
   */
  publishMarkdownStorageRequest(request: any): Promise<boolean>;

  /**
   * Publish markdown part storage request
   */
  publishMarkdownPartStorageRequest(request: any): Promise<boolean>;

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

  /**
   * Close connection and cleanup
   */
  close(): Promise<void>;
}
