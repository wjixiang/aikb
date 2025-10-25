import { ConsumeMessage } from 'amqplib';
import { IMessageService, MessageProtocol, ConnectionStatus, HealthCheckResult, QueueInfo, ConsumerOptions, MessageConsumer } from './message-service.interface';
import { BaseRabbitMQMessage, RabbitMQMessageOptions } from './message.types';
import { getRabbitMQConfig, rabbitMQQueueConfigs, rabbitMQExchangeConfigs } from './rabbitmq.config';
import { getRoutingKeyForQueue } from './queue-routing-mappings';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('RabbitMQMessageService');

/**
 * RabbitMQ Message Service Implementation
 * Provides AMQP protocol support for RabbitMQ messaging
 */
export class RabbitMQMessageService implements IMessageService {
  private connection: any = null;
  private channel: any = null;
  private config: any;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private consumers = new Map<string, any>();

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Initialize the AMQP connection and channel
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing RabbitMQ message service...');
      
      const amqp = require('amqplib');
      const { connect } = amqp;
      
      this.connection = await connect(this.config.connectionOptions);
      this.channel = await this.connection.createChannel();
      
      logger.info('RabbitMQ connection established');
      this.connectionStatus = 'connected';
      
      // Setup topology
      await this.setupTopology();
      
      logger.info('RabbitMQ message service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RabbitMQ message service:', error);
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  /**
   * Close the connection and cleanup resources
   */
  async close(): Promise<void> {
    try {
      logger.info('Closing RabbitMQ message service...');
      
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      this.connectionStatus = 'disconnected';
      this.consumers.clear();
      
      logger.info('RabbitMQ message service closed successfully');
    } catch (error) {
      logger.error('Failed to close RabbitMQ message service:', error);
      throw error;
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.connection && this.channel;
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
    try {
      const isConnected = this.isConnected();
      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        details: {
          connected: isConnected,
          protocol: 'amqp',
        },
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Publish a message with the specified routing key
   */
  async publishMessage(
    routingKey: string,
    message: BaseRabbitMQMessage,
    options?: RabbitMQMessageOptions,
  ): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        throw new Error('RabbitMQ service is not connected');
      }

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const publishOptions = {
        persistent: options?.persistent ?? true,
        expiration: options?.expiration,
        priority: options?.priority,
        correlationId: options?.correlationId,
        replyTo: options?.replyTo,
        headers: options?.headers,
      };

      const published = this.channel.publish(
        'pdf-conversion-exchange', // Default exchange
        routingKey,
        messageBuffer,
        publishOptions,
      );

      if (published) {
        logger.debug(`Message published to ${routingKey}:`, message.messageId);
        return true;
      } else {
        logger.error(`Failed to publish message to ${routingKey}`);
        return false;
      }
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
    options?: ConsumerOptions,
  ): Promise<string> {
    try {
      if (!this.isConnected()) {
        throw new Error('RabbitMQ service is not connected');
      }

      const consumerTag = options?.consumerTag || `consumer-${Date.now()}`;
      
      await this.channel.consume(queueName, async (msg: ConsumeMessage) => {
        try {
          const messageContent = msg.content.toString();
          const message = JSON.parse(messageContent);
          
          logger.debug(`Received message from ${queueName}:`, message.messageId);
          
          await onMessage(message, msg);
          
          this.channel.ack(msg);
        } catch (error) {
          logger.error('Error processing message:', error);
          this.channel.nack(msg, false, false);
        }
      }, {
        consumerTag,
        noAck: options?.noAck ?? false,
        exclusive: options?.exclusive ?? false,
        priority: options?.priority,
      });

      this.consumers.set(consumerTag, { queueName, onMessage, options });
      
      logger.info(`Started consuming from ${queueName} with tag: ${consumerTag}`);
      return consumerTag;
    } catch (error) {
      logger.error('Failed to consume messages:', error);
      throw error;
    }
  }

  /**
   * Stop consuming messages with the given consumer tag
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('RabbitMQ service is not connected');
      }

      await this.channel.cancel(consumerTag);
      this.consumers.delete(consumerTag);
      
      logger.info(`Stopped consuming with tag: ${consumerTag}`);
    } catch (error) {
      logger.error('Failed to stop consuming:', error);
      throw error;
    }
  }

  /**
   * Get information about a queue
   */
  async getQueueInfo(queueName: string): Promise<QueueInfo | null> {
    try {
      if (!this.isConnected()) {
        throw new Error('RabbitMQ service is not connected');
      }

      const info = await this.channel.checkQueue(queueName);
      
      return {
        messageCount: info.messageCount,
        consumerCount: info.consumerCount,
      };
    } catch (error) {
      logger.error('Failed to get queue info:', error);
      return null;
    }
  }

  /**
   * Purge all messages from a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('RabbitMQ service is not connected');
      }

      await this.channel.purgeQueue(queueName);
      logger.info(`Purged queue: ${queueName}`);
    } catch (error) {
      logger.error('Failed to purge queue:', error);
      throw error;
    }
  }

  /**
   * Setup queues, exchanges, and bindings
   */
  async setupTopology(): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('RabbitMQ service is not connected');
      }

      // Create exchanges
      for (const exchangeConfig of Object.values(rabbitMQExchangeConfigs)) {
        await this.channel.assertExchange(
          exchangeConfig.name,
          exchangeConfig.type,
          exchangeConfig.arguments,
        );
        logger.debug(`Created exchange: ${exchangeConfig.name}`);
      }

      // Create queues
      for (const queueConfig of Object.values(rabbitMQQueueConfigs)) {
        await this.channel.assertQueue(
          queueConfig.name,
          queueConfig.arguments,
        );
        logger.debug(`Created queue: ${queueConfig.name}`);

        // Bind queue to exchange with routing key
        const routingKey = getRoutingKeyForQueue(queueConfig.name);
        await this.channel.bindQueue(queueConfig.name, 'pdf-conversion-exchange', routingKey);
        logger.debug(`Bound queue ${queueConfig.name} to exchange with routing key: ${routingKey}`);
      }

      logger.info('RabbitMQ topology setup completed');
    } catch (error) {
      logger.error('Failed to setup topology:', error);
      throw error;
    }
  }
}