import * as amqp from 'amqplib';
import {
  IMessageService,
  ConnectionStatus,
  HealthCheckResult,
  QueueInfo,
  ConsumerOptions,
  MessageConsumer,
  MessageServiceConfig,
} from './message-service.interface';
import {
  BaseRabbitMQMessage,
  PdfConversionMessage,
  RabbitMQMessageOptions,
  RABBITMQ_QUEUES,
  RABBITMQ_EXCHANGES,
  RABBITMQ_ROUTING_KEYS,
} from './message.types';
import {
  getValidatedRabbitMQConfig,
  rabbitMQHealthCheckConfig,
  getAllQueueConfigs,
  getAllExchangeConfigs,
} from './rabbitmq.config';
import createLoggerWithPrefix from '../logger';

const logger = createLoggerWithPrefix('RabbitMQImplementation');

/**
 * RabbitMQ implementation of the IMessageService interface
 * This class handles all RabbitMQ-specific operations and connection management
 */
export class RabbitMQImplementation implements IMessageService {
  private connection: any | null = null;
  private channel: any | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private config: MessageServiceConfig;

  constructor(config?: Partial<MessageServiceConfig>) {
    this.config = {
      protocol: 'rabbitmq' as any,
      connectionOptions: getValidatedRabbitMQConfig() || {},
      reconnect: {
        maxAttempts: 5,
        delay: 5000,
      },
      healthCheck: {
        interval: rabbitMQHealthCheckConfig.interval,
        timeout: rabbitMQHealthCheckConfig.timeout,
      },
      ...config,
    };

    if (this.config.reconnect) {
      this.maxReconnectAttempts = this.config.reconnect.maxAttempts;
      this.reconnectDelay = this.config.reconnect.delay;
    }
  }

  /**
   * Initialize RabbitMQ connection and setup topology
   */
  async initialize(): Promise<void> {
    if (this.connectionStatus === 'connected' || this.connectionStatus === 'connecting') {
      return;
    }

    this.connectionStatus = 'connecting';

    try {
      const rabbitConfig = getValidatedRabbitMQConfig();
      if (!rabbitConfig) {
        throw new Error('Invalid RabbitMQ configuration');
      }

      logger.info('Connecting to RabbitMQ...');
      this.connection = await amqp.connect(rabbitConfig);

      logger.info('Creating RabbitMQ channel...');
      if (this.connection) {
        this.channel = await this.connection.createChannel();
      }

      // Setup topology (queues, exchanges, bindings)
      await this.setupTopology();

      // Setup connection event handlers
      this.setupConnectionHandlers();

      // Start heartbeat
      this.startHeartbeat();

      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;

      logger.info('RabbitMQ implementation initialized successfully');
    } catch (error) {
      this.connectionStatus = 'disconnected';
      logger.error('Failed to initialize RabbitMQ implementation:', error);
      throw error;
    }
  }

  /**
   * Close connection and cleanup resources
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

      this.connectionStatus = 'disconnected';
      logger.info('RabbitMQ implementation closed successfully');
    } catch (error) {
      logger.error('Error closing RabbitMQ implementation:', error);
      throw error;
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.connection !== null && this.channel !== null;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Perform health check on the service
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const details = {
      connected: this.connection !== null,
      channelOpen: this.channel !== null,
      reconnectAttempts: this.reconnectAttempts,
      connectionStatus: this.connectionStatus,
    };

    const status = this.isConnected() ? 'healthy' : 'unhealthy';

    return { status, details };
  }

  /**
   * Publish a message with the specified routing key
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options: RabbitMQMessageOptions = {},
  ): Promise<boolean> {
    if (!this.isConnected() || !this.channel) {
      logger.error('RabbitMQ implementation not connected when attempting to publish', {
        connectionStatus: this.connectionStatus,
        hasChannel: !!this.channel,
        routingKey,
      });
      throw new Error('RabbitMQ implementation not connected');
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
        publishOptions,
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
   * Consume messages from a queue
   */
  async consumeMessages(
    queueName: string,
    onMessage: MessageConsumer,
    options: ConsumerOptions = {},
  ): Promise<string> {
    if (!this.isConnected() || !this.channel) {
      throw new Error('RabbitMQ implementation not connected');
    }

    try {
      const consumeOptions: amqp.Options.Consume = {
        noAck: options.noAck ?? false,
        exclusive: options.exclusive ?? false,
        consumerTag: options.consumerTag,
        priority: options.priority,
      };

      const consumerTag = await this.channel.consume(
        queueName,
        async (message) => {
          logger.info(`Consumer callback triggered for queue: ${queueName}`);
          if (!message) {
            logger.warn(`Received null message from queue: ${queueName}`);
            return;
          }

          try {
            const messageContent = JSON.parse(
              message.content.toString(),
            ) as PdfConversionMessage;
            logger.info(`Received message from queue ${queueName}:`, {
              eventType: messageContent.eventType,
              itemId: messageContent.itemId,
            });
            await onMessage(messageContent, message);

            if (!consumeOptions.noAck) {
              this.channel!.ack(message);
            }
          } catch (error) {
            logger.error(
              `Error processing message from queue ${queueName}:`,
              error,
            );
            logger.error(
              `Message content was:`,
              message.content.toString(),
            );

            if (!consumeOptions.noAck) {
              // Negative acknowledgment and requeue
              this.channel!.nack(message, false, true);
            }
          }
        },
        consumeOptions,
      );

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
   * Stop consuming messages with the given consumer tag
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    if (!this.isConnected() || !this.channel) {
      return;
    }

    try {
      await this.channel.cancel(consumerTag);
      logger.info(`Stopped consuming messages for consumer tag: ${consumerTag}`);
    } catch (error) {
      logger.error(
        `Failed to stop consuming for consumer tag ${consumerTag}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get information about a queue
   */
  async getQueueInfo(queueName: string): Promise<QueueInfo | null> {
    if (!this.isConnected() || !this.channel) {
      throw new Error('RabbitMQ implementation not connected');
    }

    try {
      const queueInfo = await this.channel.checkQueue(queueName);
      return {
        messageCount: queueInfo.messageCount,
        consumerCount: queueInfo.consumerCount,
      };
    } catch (error) {
      logger.error(`Failed to get queue info for ${queueName}:`, error);
      return null;
    }
  }

  /**
   * Purge all messages from a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    if (!this.isConnected() || !this.channel) {
      throw new Error('RabbitMQ implementation not connected');
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
   * Setup queues, exchanges, and bindings
   */
  async setupTopology(): Promise<void> {
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
          },
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

          const queueResult = await this.channel.assertQueue(queueConfig.name, {
            durable: queueConfig.durable,
            exclusive: queueConfig.exclusive,
            autoDelete: queueConfig.autoDelete,
            arguments: queueConfig.arguments,
          });
          logger.info(
            `Queue ${queueConfig.name} created/verified successfully`,
            {
              messageCount: queueResult.messageCount,
              consumerCount: queueResult.consumerCount,
            },
          );
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
            logger.warn(
              `Attempting to check existing queue configuration for ${queueConfig.name}...`,
            );
            try {
              const existingQueue = await this.channel.checkQueue(
                queueConfig.name,
              );
              logger.info(`Existing queue ${queueConfig.name} found:`, {
                messageCount: existingQueue.messageCount,
                consumerCount: existingQueue.consumerCount,
              });

              // Try passive declaration to see current configuration
              logger.warn(
                `Queue ${queueConfig.name} already exists with different configuration. Consider deleting the queue manually or updating the configuration to match.`,
              );
            } catch (checkError: any) {
              logger.error(
                `Failed to check existing queue ${queueConfig.name}:`,
                checkError.message,
              );
            }
          }

          throw queueError;
        }
      }

      // Setup queue bindings
      await this.setupQueueBindings();
    } catch (error) {
      logger.error('Failed to setup topology:', error);
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
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_PROGRESS,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_COMPLETED,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_CONVERSION_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_FAILED,
      );

      // Bind PDF analysis queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_ANALYSIS_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_ANALYSIS_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_COMPLETED,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_ANALYSIS_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_ANALYSIS_FAILED,
      );

      // Bind PDF part conversion queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_COMPLETED,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_PART_CONVERSION_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_PART_CONVERSION_FAILED,
      );

      // Bind PDF merging queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_MERGING_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_MERGING_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.PDF_MERGING_PROGRESS,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.PDF_MERGING_PROGRESS,
      );

      // Bind markdown storage queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_COMPLETED,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_STORAGE_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_STORAGE_FAILED,
      );

      // Bind markdown part storage queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_PROGRESS,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_PROGRESS,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_COMPLETED,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.MARKDOWN_PART_STORAGE_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.MARKDOWN_PART_STORAGE_FAILED,
      );

      // Bind chunking embedding queues
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.CHUNKING_EMBEDDING_REQUEST,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_REQUEST,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.CHUNKING_EMBEDDING_PROGRESS,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_PROGRESS,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.CHUNKING_EMBEDDING_COMPLETED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_COMPLETED,
      );

      await this.channel.bindQueue(
        RABBITMQ_QUEUES.CHUNKING_EMBEDDING_FAILED,
        RABBITMQ_EXCHANGES.PDF_CONVERSION,
        RABBITMQ_ROUTING_KEYS.CHUNKING_EMBEDDING_FAILED,
      );

      // Bind DLQ to DLX
      await this.channel.bindQueue(
        RABBITMQ_QUEUES.DEAD_LETTER_QUEUE,
        RABBITMQ_EXCHANGES.DEAD_LETTER,
        RABBITMQ_ROUTING_KEYS.DEAD_LETTER,
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
      logger.error(`RabbitMQ connection error: ${JSON.stringify(error, null, 2)}` );
      if (error.message !== 'Connection closing') {
        this.handleReconnection();
      }
    });

    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.connectionStatus = 'disconnected';
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
    if (
      this.connectionStatus === 'connecting' ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      return;
    }

    this.connectionStatus = 'reconnecting';
    this.reconnectAttempts++;
    logger.info(
      `Attempting to reconnect to RabbitMQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error(
          `Reconnection attempt ${this.reconnectAttempts} failed:`,
          error,
        );
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnection();
        } else {
          logger.error('Max reconnection attempts reached. Giving up.');
          this.connectionStatus = 'disconnected';
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

    const interval = this.config.healthCheck?.interval || rabbitMQHealthCheckConfig.interval;
    
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
    }, interval);
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
}