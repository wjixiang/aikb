import * as amqp from 'amqplib';
import {
  BaseRabbitMQMessage,
  PdfConversionMessage,
  PdfConversionRequestMessage,
  PdfConversionProgressMessage,
  PdfConversionCompletedMessage,
  PdfConversionFailedMessage,
  PdfAnalysisRequestMessage,
  PdfAnalysisCompletedMessage,
  PdfAnalysisFailedMessage,
  PdfSplittingRequestMessage,
  PdfPartConversionRequestMessage,
  PdfPartConversionCompletedMessage,
  PdfPartConversionFailedMessage,
  PdfMergingRequestMessage,
  PdfMergingProgressMessage,
  MarkdownStorageRequestMessage,
  MarkdownStorageCompletedMessage,
  MarkdownStorageFailedMessage,
  RabbitMQMessageOptions,
  RABBITMQ_QUEUES,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
  RABBITMQ_CONSUMER_TAGS,
  PdfProcessingStatus,
} from './message.types';
import {
  getValidatedRabbitMQConfig,
  rabbitMQConnectionOptions,
  rabbitMQHealthCheckConfig,
  getQueueConfig,
  getExchangeConfig,
  getAllQueueConfigs,
  getAllExchangeConfigs,
} from './rabbitmq.config';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('RabbitMQService');

/**
 * RabbitMQ service for handling PDF conversion messages
 */
export class RabbitMQService {
  private connection: any | null = null;
  private channel: any | null = null;
  private isInitialized = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(private configPath?: string) {}

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    
    try {
      const config = getValidatedRabbitMQConfig();
      if (!config) {
        throw new Error('Invalid RabbitMQ configuration');
      }

      logger.info('Connecting to RabbitMQ...');
      this.connection = await amqp.connect(config);
      
      logger.info('Creating RabbitMQ channel...');
      if (this.connection) {
        this.channel = await this.connection.createChannel();
      }

      // Setup queues and exchanges
      await this.setupQueuesAndExchanges();

      // Setup connection event handlers
      this.setupConnectionHandlers();

      // Start heartbeat
      this.startHeartbeat();

      this.isInitialized = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      logger.info('RabbitMQ service initialized successfully');
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to initialize RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Setup queues and exchanges
   */
  private async setupQueuesAndExchanges(): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      // Setup exchanges
      const exchangeConfigs = getAllExchangeConfigs();
      for (const exchangeConfig of exchangeConfigs) {
        await this.channel.assertExchange(
          exchangeConfig.name,
          exchangeConfig.type,
          {
            durable: exchangeConfig.durable,
            autoDelete: exchangeConfig.autoDelete,
            internal: exchangeConfig.internal,
            arguments: exchangeConfig.arguments,
          }
        );
        logger.info(`Exchange ${exchangeConfig.name} created/verified`);
      }

      // Setup queues
      const queueConfigs = getAllQueueConfigs();
      for (const queueConfig of queueConfigs) {
        try {
          logger.info(`Attempting to declare queue: ${queueConfig.name}`, {
            durable: queueConfig.durable,
            exclusive: queueConfig.exclusive,
            autoDelete: queueConfig.autoDelete,
            arguments: queueConfig.arguments,
          });
          
          const queueResult = await this.channel.assertQueue(
            queueConfig.name,
            {
              durable: queueConfig.durable,
              exclusive: queueConfig.exclusive,
              autoDelete: queueConfig.autoDelete,
              arguments: queueConfig.arguments,
            }
          );
          logger.info(`Queue ${queueConfig.name} created/verified successfully`, {
            messageCount: queueResult.messageCount,
            consumerCount: queueResult.consumerCount,
          });
        } catch (queueError: any) {
          logger.error(`Failed to declare queue ${queueConfig.name}:`, {
            error: queueError.message,
            code: queueError.code,
            queueConfig: {
              name: queueConfig.name,
              arguments: queueConfig.arguments,
            },
          });
          
          // If it's a PRECONDITION-FAILED error, try to check existing queue configuration
          if (queueError.code === 406) {
            logger.warn(`Attempting to check existing queue configuration for ${queueConfig.name}...`);
            try {
              const existingQueue = await this.channel.checkQueue(queueConfig.name);
              logger.info(`Existing queue ${queueConfig.name} found:`, {
                messageCount: existingQueue.messageCount,
                consumerCount: existingQueue.consumerCount,
              });
              
              // Try passive declaration to see current configuration
              logger.warn(`Queue ${queueConfig.name} already exists with different configuration. Consider deleting the queue manually or updating the configuration to match.`);
            } catch (checkError: any) {
              logger.error(`Failed to check existing queue ${queueConfig.name}:`, checkError.message);
            }
          }
          
          throw queueError;
        }
      }

      // Setup queue bindings
      await this.setupQueueBindings();

    } catch (error) {
      logger.error('Failed to setup queues and exchanges:', error);
      throw error;
    }
  }

  /**
   * Setup queue bindings to exchanges
   */
  private async setupQueueBindings(): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    try {
      // Bind PDF conversion queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_PROGRESS
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_COMPLETED
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_FAILED
      );

      // Bind PDF analysis queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_ANALYSIS_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_REQUEST
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_ANALYSIS_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_COMPLETED
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_ANALYSIS_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_FAILED
      );

      // Bind PDF splitting queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_SPLITTING_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_SPLITTING_REQUEST
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_SPLITTING_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_SPLITTING_COMPLETED
      );

      // Bind PDF part conversion queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_REQUEST
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_COMPLETED
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_FAILED
      );

      // Bind PDF merging queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_MERGING_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_MERGING_REQUEST
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_MERGING_PROGRESS,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_MERGING_PROGRESS
      );

      // Bind markdown storage queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_REQUEST
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_COMPLETED
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_FAILED
      );

      // Bind DLQ to DLX
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.DEAD_LETTER_QUEUE,
        RABBITMQ_EXCHANGES.DEAD_LETTER,
        RABBITMQ_ROUTING_KEYS.DEAD_LETTER
      );

      logger.info('Queue bindings setup completed');
    } catch (error) {
      logger.error('Failed to setup queue bindings:', error);
      throw error;
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.connection) {
      return;
    }

    this.connection.on('error', (error) => {
      logger.error('RabbitMQ connection error:', error);
      if (error.message !== 'Connection closing') {
        this.handleReconnection();
      }
    });

    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.isInitialized = false;
      this.handleReconnection();
    });

    this.connection.on('blocked', (reason) => {
      logger.warn('RabbitMQ connection blocked:', reason);
    });

    this.connection.on('unblocked', () => {
      logger.info('RabbitMQ connection unblocked');
    });
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnection(): Promise<void> {
    if (this.isConnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect to RabbitMQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnection();
        } else {
          logger.error('Max reconnection attempts reached. Giving up.');
        }
      }
    }, this.reconnectDelay);
  }

  /**
   * Start heartbeat to monitor connection health
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.connection && this.channel) {
        try {
          // Check connection health by checking server properties
          await this.channel.checkQueue('health-check');
        } catch (error) {
          logger.warn('Health check failed:', error);
          // Don't automatically reconnect here, let the connection handlers handle it
        }
      }
    }, rabbitMQHealthCheckConfig.interval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Publish a message to RabbitMQ
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options: RabbitMQMessageOptions = {}
  ): Promise<boolean> {
    if (!this.isInitialized || !this.channel) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      const publishOptions: amqp.Options.Publish = {
        persistent: options.persistent !== false,
        expiration: options.expiration,
        priority: options.priority,
        correlationId: options.correlationId,
        replyTo: options.replyTo,
        headers: {
          ...options.headers,
          'x-message-type': message.eventType,
          'x-timestamp': Date.now(),
        },
        timestamp: Date.now(),
        messageId: message.messageId,
      };

      const published = this.channel.publish(
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        routingKey,
        messageBuffer,
        publishOptions
      );

      if (published) {
        logger.debug(`Message published to routing key: ${routingKey}`, {
          messageId: message.messageId,
          eventType: message.eventType,
        });
      } else {
        logger.warn(`Failed to publish message to routing key: ${routingKey}`, {
          messageId: message.messageId,
          eventType: message.eventType,
        });
      }

      return published;
    } catch (error) {
      logger.error('Failed to publish message:', error);
      throw error;
    }
  }

  /**
   * Publish PDF conversion request
   */
  async publishPdfConversionRequest(request: PdfConversionRequestMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST,
      request,
      {
        persistent: true,
        priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      }
    );
  }

  /**
   * Publish PDF conversion progress
   */
  async publishPdfConversionProgress(progress: PdfConversionProgressMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_PROGRESS,
      progress,
      {
        persistent: false, // Progress messages are transient
        expiration: '300000', // 5 minutes
      }
    );
  }

  /**
   * Publish PDF conversion completed
   */
  async publishPdfConversionCompleted(completed: PdfConversionCompletedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_COMPLETED,
      completed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish PDF conversion failed
   */
  async publishPdfConversionFailed(failed: PdfConversionFailedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_FAILED,
      failed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish PDF analysis request
   */
  async publishPdfAnalysisRequest(request: PdfAnalysisRequestMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_REQUEST,
      request,
      {
        persistent: true,
        priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      }
    );
  }

  /**
   * Publish PDF analysis completed
   */
  async publishPdfAnalysisCompleted(completed: PdfAnalysisCompletedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_COMPLETED,
      completed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish PDF analysis failed
   */
  async publishPdfAnalysisFailed(failed: PdfAnalysisFailedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_FAILED,
      failed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish PDF splitting request
   */
  async publishPdfSplittingRequest(request: PdfSplittingRequestMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_SPLITTING_REQUEST,
      request,
      {
        persistent: true,
        priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      }
    );
  }

  /**
   * Publish PDF part conversion request
   */
  async publishPdfPartConversionRequest(request: PdfPartConversionRequestMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_REQUEST,
      request,
      {
        persistent: true,
        priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      }
    );
  }

  /**
   * Publish PDF part conversion completed
   */
  async publishPdfPartConversionCompleted(completed: PdfPartConversionCompletedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_COMPLETED,
      completed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish PDF part conversion failed
   */
  async publishPdfPartConversionFailed(failed: PdfPartConversionFailedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_FAILED,
      failed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish PDF merging request
   */
  async publishPdfMergingRequest(request: PdfMergingRequestMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_MERGING_REQUEST,
      request,
      {
        persistent: true,
        priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      }
    );
  }

  /**
   * Publish PDF merging progress
   */
  async publishPdfMergingProgress(progress: PdfMergingProgressMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.PDF_MERGING_PROGRESS,
      progress,
      {
        persistent: false, // Progress messages are transient
        expiration: '300000', // 5 minutes
      }
    );
  }

  /**
   * Publish markdown storage request
   */
  async publishMarkdownStorageRequest(request: MarkdownStorageRequestMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_REQUEST,
      request,
      {
        persistent: true,
        priority: request.priority === 'high' ? 10 : request.priority === 'low' ? 1 : 5,
      }
    );
  }

  /**
   * Publish markdown storage completed
   */
  async publishMarkdownStorageCompleted(completed: MarkdownStorageCompletedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_COMPLETED,
      completed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Publish markdown storage failed
   */
  async publishMarkdownStorageFailed(failed: MarkdownStorageFailedMessage): Promise<boolean> {
    return this.publishMessage(
      RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_FAILED,
      failed,
      {
        persistent: true,
      }
    );
  }

  /**
   * Consume messages from a queue
   */
  async consumeMessages(
    queueName: string,
    onMessage: (message: PdfConversionMessage, originalMessage: amqp.ConsumeMessage) => void,
    options: {
      consumerTag?: string;
      noAck?: boolean;
      exclusive?: boolean;
      priority?: number;
    } = {}
  ): Promise<string> {
    if (!this.isInitialized || !this.channel) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      const consumeOptions: amqp.Options.Consume = {
        noAck: options.noAck ?? false,
        exclusive: options.exclusive ?? false,
        consumerTag: options.consumerTag,
        priority: options.priority,
      };

      const consumerTag = await this.channel.consume(queueName, async (message) => {
        if (!message) {
          logger.warn(`Received null message from queue: ${queueName}`);
          return;
        }

        try {
          const messageContent = JSON.parse(message.content.toString()) as PdfConversionMessage;
          await onMessage(messageContent, message);

          if (!consumeOptions.noAck) {
            this.channel!.ack(message);
          }
        } catch (error) {
          logger.error(`Error processing message from queue ${queueName}:`, error);
          
          if (!consumeOptions.noAck) {
            // Negative acknowledgment and requeue
            this.channel!.nack(message, false, true);
          }
        }
      }, consumeOptions);

      logger.info(`Started consuming messages from queue: ${queueName}`, {
        consumerTag: consumerTag.consumerTag,
      });

      return consumerTag.consumerTag;
    } catch (error) {
      logger.error(`Failed to start consuming from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    if (!this.isInitialized || !this.channel) {
      return;
    }

    try {
      await this.channel.cancel(consumerTag);
      logger.info(`Stopped consuming messages for consumer tag: ${consumerTag}`);
    } catch (error) {
      logger.error(`Failed to stop consuming for consumer tag ${consumerTag}:`, error);
      throw error;
    }
  }

  /**
   * Get queue information
   */
  async getQueueInfo(queueName: string): Promise<amqp.Replies.AssertQueue | null> {
    if (!this.isInitialized || !this.channel) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      return await this.channel.checkQueue(queueName);
    } catch (error) {
      logger.error(`Failed to get queue info for ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Purge a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    if (!this.isInitialized || !this.channel) {
      throw new Error('RabbitMQ service not initialized');
    }

    try {
      await this.channel.purgeQueue(queueName);
      logger.info(`Purged queue: ${queueName}`);
    } catch (error) {
      logger.error(`Failed to purge queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      channelOpen: boolean;
      reconnectAttempts: number;
    };
  }> {
    const details = {
      connected: this.connection !== null,
      channelOpen: this.channel !== null,
      reconnectAttempts: this.reconnectAttempts,
    };

    const status = details.connected && details.channelOpen ? 'healthy' : 'unhealthy';

    return { status, details };
  }

  /**
   * Close connection and cleanup
   */
  async close(): Promise<void> {
    try {
      this.stopHeartbeat();

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isInitialized = false;
      logger.info('RabbitMQ service closed successfully');
    } catch (error) {
      logger.error('Error closing RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isConnected(): boolean {
    return this.isInitialized && this.connection !== null && this.channel !== null;
  }
}

/**
 * Singleton instance for the RabbitMQ service
 */
let rabbitMQServiceInstance: RabbitMQService | null = null;

/**
 * Get or create the RabbitMQ service singleton instance
 */
export function getRabbitMQService(configPath?: string): RabbitMQService {
  if (!rabbitMQServiceInstance) {
    rabbitMQServiceInstance = new RabbitMQService(configPath);
  }
  return rabbitMQServiceInstance;
}

/**
 * Initialize the RabbitMQ service
 */
export async function initializeRabbitMQService(configPath?: string): Promise<RabbitMQService> {
  const service = getRabbitMQService(configPath);
  await service.initialize();
  return service;
}

/**
 * Close and cleanup the RabbitMQ service
 */
export async function closeRabbitMQService(): Promise<void> {
  if (rabbitMQServiceInstance) {
    await rabbitMQServiceInstance.close();
    rabbitMQServiceInstance = null;
  }
}