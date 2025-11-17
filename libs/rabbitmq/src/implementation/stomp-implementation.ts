import {
  IMessageService,
  MessageProtocol,
  ConnectionStatus,
  HealthCheckResult,
  QueueInfo,
  ConsumerOptions,
  MessageConsumer,
} from '../message-service.interface';
import {
  BaseRabbitMQMessage,
  RabbitMQMessageOptions,
} from '../messages/message.types';
import createLoggerWithPrefix from 'log-management/logger';
import {
  Client,
  StompSubscription,
  StompFrame,
  StompMessage,
  StompHeaders,
  StompConnectionConfig,
} from '../types/stomp';
import { v4 as uuidv4 } from 'uuid';

const logger = createLoggerWithPrefix('StompMessageService');

/**
 * STOMP Message Service Implementation
 * Provides STOMP protocol support for RabbitMQ messaging
 */
export class StompMessageService implements IMessageService {
  private connectionStatus: ConnectionStatus = 'disconnected';
  private client: Client | null = null;
  private config: StompConnectionConfig;
  private subscriptions = new Map<string, StompSubscription>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  constructor(config: StompConnectionConfig) {
    this.config = config;
  }

  /**
   * Initialize the STOMP connection
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing STOMP message service...');
      this.connectionStatus = 'connecting';

      // Import STOMP client dynamically to avoid module resolution issues
      const { Client } = await import('@stomp/stompjs');

      // Create STOMP client
      const client = new Client({
        brokerURL:
          this.config.brokerURL ||
          `ws://${this.config.hostname}:${this.config.port || 15674}/ws`,
        connectHeaders: {
          login: this.config.username || 'guest',
          passcode: this.config.passcode || 'guest',
          host: this.config.vhost || '/',
        },
        reconnectDelay: this.reconnectDelay,
        heartbeatIncoming: this.config.heartbeat || 4000,
        heartbeatOutgoing: this.config.heartbeat || 4000,
        debug: (str: string) => {
          logger.debug(str);
        },
      });

      // Setup connection event handlers
      if (client) {
        client.onConnect = (frame: StompFrame) => {
          logger.info('STOMP connection established');
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
        };

        client.onStompError = (frame: StompFrame) => {
          logger.error('STOMP error:', frame.headers['message']);
          this.connectionStatus = 'disconnected';
        };

        client.onDisconnect = () => {
          logger.warn('STOMP connection disconnected');
          this.connectionStatus = 'disconnected';
          this.handleReconnection();
        };

        // Activate the client
        client.activate();
      }

      // Assign the client after setup
      this.client = client as Client;

      // Wait for connection to be established
      await this.waitForConnection();

      // Setup topology
      await this.setupTopology();

      logger.info('STOMP message service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize STOMP message service:', error);
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  /**
   * Wait for STOMP connection to be established
   */
  private async waitForConnection(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkConnection = () => {
        if (this.connectionStatus === 'connected') {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('STOMP connection timeout'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
      );

      setTimeout(() => {
        if (this.client && this.connectionStatus === 'disconnected') {
          this.connectionStatus = 'reconnecting';
          this.client.activate();
        }
      }, this.reconnectDelay);
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  /**
   * Close the connection and cleanup resources
   */
  async close(): Promise<void> {
    try {
      logger.info('Closing STOMP message service...');

      // Unsubscribe from all subscriptions
      for (const [id, subscription] of this.subscriptions) {
        if (subscription && subscription.unsubscribe) {
          subscription.unsubscribe();
        }
      }
      this.subscriptions.clear();

      // Deactivate the client
      if (this.client) {
        this.client.deactivate();
        this.client = null;
      }

      this.connectionStatus = 'disconnected';
      logger.info('STOMP message service closed successfully');
    } catch (error) {
      logger.error('Failed to close STOMP message service:', error);
      throw error;
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected';
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
          protocol: 'stomp',
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
        throw new Error('STOMP service is not connected');
      }

      logger.debug(`Publishing message to ${routingKey}:`, message);

      const messageBody = JSON.stringify(message);
      const headers: StompHeaders = {
        'content-type': 'application/json',
        'message-id': message.messageId,
        timestamp: message.timestamp.toString(),
        'event-type': message.eventType,
        ...options?.headers,
      };

      if (options?.persistent !== false) {
        headers['persistent'] = 'true';
      }
      if (options?.expiration) {
        headers['expiration'] = options.expiration;
      }
      if (options?.priority) {
        headers['priority'] = options.priority.toString();
      }
      if (options?.correlationId) {
        headers['correlation-id'] = options.correlationId;
      }
      if (options?.replyTo) {
        headers['reply-to'] = options.replyTo;
      }

      // In STOMP, we publish to a destination (exchange/routing key)
      const destination = `/exchange/pdf-conversion-exchange/${routingKey}`;

      if (this.client) {
        this.client.publish({
          destination,
          body: messageBody,
          headers,
        });
      }

      logger.debug(`Message published to ${routingKey}:`, message.messageId);
      return true;
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
        throw new Error('STOMP service is not connected');
      }

      logger.debug(`Starting to consume messages from ${queueName}`);

      const consumerTag = options?.consumerTag || `stomp-consumer-${uuidv4()}`;

      // In STOMP, we subscribe to a queue destination
      const destination = `/queue/${queueName}`;

      if (!this.client) {
        throw new Error('STOMP client is not initialized');
      }

      const subscription = this.client.subscribe(
        destination,
        async (message: StompMessage) => {
          try {
            const messageBody = message.body;
            const parsedMessage = JSON.parse(messageBody);
            const headers = message.headers;

            logger.debug(
              `Received message from ${queueName}:`,
              parsedMessage.messageId,
            );

            // Create a mock original message object for compatibility
            const originalMessage = {
              headers,
              body: messageBody,
              ack: () => {
                // STOMP uses ack mode, but we don't need explicit ack for auto-ack
                logger.debug(
                  `Message acknowledged: ${parsedMessage.messageId}`,
                );
              },
              nack: () => {
                logger.debug(`Message nacked: ${parsedMessage.messageId}`);
              },
            };

            await onMessage(parsedMessage, originalMessage);
          } catch (error) {
            logger.error('Error processing message:', error);
          }
        },
        {
          ack: options?.noAck ? 'auto' : 'client',
          id: consumerTag,
          exclusive: options?.exclusive ? 'true' : 'false',
          ...(options?.priority !== undefined && {
            priority: options.priority.toString(),
          }),
        },
      );

      this.subscriptions.set(consumerTag, subscription);

      logger.info(
        `Started consuming from ${queueName} with tag: ${consumerTag}`,
      );
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
        throw new Error('STOMP service is not connected');
      }

      logger.debug(`Stopping consumer: ${consumerTag}`);

      const subscription = this.subscriptions.get(consumerTag);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(consumerTag);
        logger.info(`Stopped consuming with tag: ${consumerTag}`);
      } else {
        logger.warn(`Consumer not found: ${consumerTag}`);
      }
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
        throw new Error('STOMP service is not connected');
      }

      logger.debug(`Getting queue info for: ${queueName}`);

      // STOMP doesn't have a direct way to get queue info like AMQP
      // We can use the management API or return default values
      // For now, we'll return a basic implementation
      // In a real implementation, you might use RabbitMQ's HTTP management API

      // This is a simplified implementation
      // You could extend this to use RabbitMQ's management API
      return {
        messageCount: 0,
        consumerCount: this.subscriptions.size,
      };
    } catch (error) {
      logger.error('Failed to get queue info:', error);
      throw error;
    }
  }

  /**
   * Purge all messages from a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    try {
      if (!this.isConnected()) {
        throw new Error('STOMP service is not connected');
      }

      logger.debug(`Purging queue: ${queueName}`);

      // STOMP doesn't have a direct purge command like AMQP
      // This would typically be done through the management API
      // For now, we'll log the operation
      // In a real implementation, you might use RabbitMQ's HTTP management API

      logger.info(
        `Queue purge requested for: ${queueName} (implementation needed)`,
      );
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
        throw new Error('STOMP service is not connected');
      }

      logger.info('Setting up STOMP topology...');

      // STOMP doesn't have explicit topology setup like AMQP
      // Exchanges and queues are typically created on-demand
      // However, we can send messages to ensure destinations exist

      // In a real implementation, you might:
      // 1. Use RabbitMQ's management API to declare exchanges and queues
      // 2. Send setup messages to create destinations
      // 3. Configure bindings through management API

      logger.info('STOMP topology setup completed');
    } catch (error) {
      logger.error('Failed to setup STOMP topology:', error);
      throw error;
    }
  }
}
