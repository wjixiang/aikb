import * as amqp from 'amqplib';
import {
  IMessageService,
  ConnectionStatus,
  HealthCheckResult,
  QueueInfo,
  ConsumerOptions,
  MessageConsumer,
} from './message-service.interface';
import { BaseRabbitMQMessage } from './message.types';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('AmqpMessageService');

/**
 * AMQP implementation of IMessageService
 */
export class AmqpMessageService implements IMessageService {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  constructor() {
    this.setupErrorHandlers();
  }

  /**
   * Initialize the AMQP connection
   */
  async initialize(): Promise<void> {
    try {
      this.connectionStatus = 'connecting';
      
      const url = process.env['RABBITMQ_URL'] || 'amqp://localhost:5672';
      this.connection = await amqp.connect(url) as unknown as amqp.Connection;
      
      this.channel = await (this.connection as any).createChannel();
      
      // Setup topology
      await this.setupTopology();
      
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      
      logger.info('AMQP connection established successfully');
    } catch (error) {
      this.connectionStatus = 'disconnected';
      logger.error('Failed to initialize AMQP connection:', error);
      throw error;
    }
  }

  /**
   * Close the connection and cleanup resources
   */
  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await (this.connection as any).close();
        this.connection = null;
      }
      
      this.connectionStatus = 'disconnected';
      logger.info('AMQP connection closed successfully');
    } catch (error) {
      logger.error('Error closing AMQP connection:', error);
      throw error;
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.connection !== null;
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
    const connected = this.isConnected();
    
    return {
      status: connected ? 'healthy' : 'unhealthy',
      details: {
        connected,
        reconnectAttempts: this.reconnectAttempts,
      },
    };
  }

  /**
   * Publish a message with the specified routing key
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options: any = {},
  ): Promise<boolean> {
    if (!this.channel) {
      throw new Error('AMQP channel not available');
    }

    try {
      const published = this.channel.publish(
        'chunking-embedding-exchange',
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: options.persistent || false,
          expiration: options.expiration,
          priority: options.priority,
          correlationId: options.correlationId,
          replyTo: options.replyTo,
          headers: options.headers,
        },
      );

      return published;
    } catch (error) {
      logger.error('Failed to publish AMQP message:', error);
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
    if (!this.channel) {
      throw new Error('AMQP channel not available');
    }

    try {
      const consumerTag = await this.channel.consume(
        queueName,
        async (msg) => {
          if (!msg) {
            logger.warn('Received null message, consumer cancelled');
            return;
          }

          try {
            const message = JSON.parse(msg.content.toString());
            await onMessage(message, msg);
            
            if (!options.noAck) {
              this.channel?.ack(msg);
            }
          } catch (error) {
            logger.error('Error processing message:', error);
            
            if (!options.noAck) {
              this.channel?.nack(msg, false, true);
            }
          }
        },
        {
          consumerTag: options.consumerTag,
          noAck: options.noAck || false,
          exclusive: options.exclusive || false,
          priority: options.priority,
        },
      );

      logger.info(`Started consuming from queue: ${queueName}`);
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
    if (!this.channel) {
      return;
    }

    try {
      await this.channel.cancel(consumerTag);
      logger.info(`Stopped consuming for consumer tag: ${consumerTag}`);
    } catch (error) {
      logger.error(`Failed to stop consuming for consumer tag ${consumerTag}:`, error);
      throw error;
    }
  }

  /**
   * Get information about a queue
   */
  async getQueueInfo(queueName: string): Promise<QueueInfo | null> {
    if (!this.channel) {
      return null;
    }

    try {
      const info = await this.channel.checkQueue(queueName);
      return {
        queue: info.queue,
        messageCount: info.messageCount,
        consumerCount: info.consumerCount,
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
    if (!this.channel) {
      throw new Error('AMQP channel not available');
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
      throw new Error('AMQP channel not available');
    }

    try {
      // Declare exchange
      await this.channel.assertExchange('chunking-embedding-exchange', 'topic', {
        durable: true,
      });

      // Declare queues
      await this.channel.assertQueue('chunking-embedding-request', { durable: true });
      await this.channel.assertQueue('chunking-embedding-progress', { durable: true });
      await this.channel.assertQueue('chunking-embedding-completed', { durable: true });
      await this.channel.assertQueue('chunking-embedding-failed', { durable: true });

      // Bind queues to exchange
      await this.channel.bindQueue(
        'chunking-embedding-request',
        'chunking-embedding-exchange',
        'chunking-embedding-request',
      );
      await this.channel.bindQueue(
        'chunking-embedding-progress',
        'chunking-embedding-exchange',
        'chunking-embedding-progress',
      );
      await this.channel.bindQueue(
        'chunking-embedding-completed',
        'chunking-embedding-exchange',
        'chunking-embedding-completed',
      );
      await this.channel.bindQueue(
        'chunking-embedding-failed',
        'chunking-embedding-exchange',
        'chunking-embedding-failed',
      );

      logger.info('AMQP topology setup completed');
    } catch (error) {
      logger.error('Failed to setup AMQP topology:', error);
      throw error;
    }
  }

  /**
   * Setup error handlers for connection and channel
   */
  private setupErrorHandlers(): void {
    // Connection error handler
    const handleConnectionError = (error: any) => {
      logger.error('AMQP connection error:', error);
      this.connectionStatus = 'disconnected';
      this.attemptReconnect();
    };

    // Connection close handler
    const handleConnectionClose = () => {
      logger.warn('AMQP connection closed');
      this.connectionStatus = 'disconnected';
      this.attemptReconnect();
    };

    // Channel error handler
    const handleChannelError = (error: any) => {
      logger.error('AMQP channel error:', error);
    };

    // Channel close handler
    const handleChannelClose = () => {
      logger.warn('AMQP channel closed');
    };

    // Set up handlers when connection is established
    const setupConnectionHandlers = () => {
      if (this.connection) {
        this.connection.on('error', handleConnectionError);
        this.connection.on('close', handleConnectionClose);
      }
      
      if (this.channel) {
        this.channel.on('error', handleChannelError);
        this.channel.on('close', handleChannelClose);
      }
    };

    // Call setup after connection is established
    this.setupConnectionHandlers = setupConnectionHandlers;
  }

  private setupConnectionHandlers: () => void = () => {};

  /**
   * Attempt to reconnect to AMQP server
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, this.reconnectDelay);
  }
}