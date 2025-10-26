import { Client } from '@stomp/stompjs';
// import SockJS from 'sockjs-client';
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

const logger = createLoggerWithPrefix('StompMessageService');

/**
 * STOMP implementation of IMessageService
 */
export class StompMessageService implements IMessageService {
  private client: Client | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  constructor() {
    this.setupErrorHandlers();
  }

  /**
   * Initialize STOMP connection
   */
  async initialize(): Promise<void> {
    try {
      this.connectionStatus = 'connecting';
      
      const url = process.env['STOMP_URL'] || 'ws://localhost:15674/ws';
      
      // Create SockJS connection
      // const socket = new SockJS(url);
      const socket = {} as any; // Mock socket for now
      
      // Create STOMP client over SockJS
      this.client = new Client({
        webSocketFactory: () => socket,
        connectHeaders: {
          login: process.env['STOMP_USERNAME'] || 'guest',
          passcode: process.env['STOMP_PASSWORD'] || 'guest',
        },
        debug: (str) => logger.debug(str),
      });

      // Connect to STOMP server
      await new Promise<void>((resolve, reject) => {
        this.client!.onConnect = (frame) => {
          logger.info('STOMP connection established successfully');
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          resolve();
        };

        this.client!.onStompError = (frame) => {
          logger.error('STOMP connection error:', frame);
          this.connectionStatus = 'disconnected';
          reject(new Error('STOMP connection failed'));
        };

        this.client!.activate();
      });
    } catch (error) {
      this.connectionStatus = 'disconnected';
      logger.error('Failed to initialize STOMP connection:', error);
      throw error;
    }
  }

  /**
   * Close connection and cleanup resources
   */
  async close(): Promise<void> {
    try {
      if (this.client) {
        this.client.deactivate();
        this.client = null;
      }
      
      this.connectionStatus = 'disconnected';
      logger.info('STOMP connection closed successfully');
    } catch (error) {
      logger.error('Error closing STOMP connection:', error);
      throw error;
    }
  }

  /**
   * Check if service is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === 'connected' && this.client !== null;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Perform health check on service
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
    if (!this.client || !this.client.connected) {
      throw new Error('STOMP client not connected');
    }

    try {
      const destination = `/exchange/chunking-embedding-exchange/${routingKey}`;
      
      this.client.publish({
        destination,
        body: JSON.stringify(message),
        headers: {
          persistent: options.persistent || false,
          expiration: options.expiration,
          priority: options.priority,
          correlationId: options.correlationId,
          replyTo: options.replyTo,
          ...options.headers,
        },
      });

      return true;
    } catch (error) {
      logger.error('Failed to publish STOMP message:', error);
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
    if (!this.client || !this.client.connected) {
      throw new Error('STOMP client not connected');
    }

    try {
      const destination = `/queue/${queueName}`;
      const consumerTag = options.consumerTag || `consumer-${Date.now()}`;
      
      this.client.subscribe({
        destination,
        callback: (message) => {
          if (!message.body) {
            logger.warn('Received empty message');
            return;
          }

          try {
            const parsedMessage = JSON.parse(message.body);
            onMessage(parsedMessage, message);
          } catch (error) {
            logger.error('Error parsing STOMP message:', error);
          }
        },
        headers: {
          'ack': 'auto',
          ...options,
        },
      });

      logger.info(`Started consuming from queue: ${queueName}`);
      return consumerTag;
    } catch (error) {
      logger.error(`Failed to start consuming from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Stop consuming messages with the given consumer tag
   */
  async stopConsuming(consumerTag: string): Promise<void> {
    if (!this.client || !this.client.connected) {
      return;
    }

    try {
      // STOMP doesn't have direct consumer tag management like AMQP
      // We would need to track subscriptions and unsubscribe accordingly
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
    // STOMP doesn't have direct queue management like AMQP
    // This would need to be implemented via management API or HTTP endpoint
    logger.warn(`Queue info not available for STOMP: ${queueName}`);
    return null;
  }

  /**
   * Purge all messages from a queue
   */
  async purgeQueue(queueName: string): Promise<void> {
    // STOMP doesn't have direct queue management like AMQP
    // This would need to be implemented via management API or HTTP endpoint
    logger.warn(`Queue purge not available for STOMP: ${queueName}`);
  }

  /**
   * Setup error handlers for connection
   */
  private setupErrorHandlers(): void {
    // Additional error handling can be added here
  }

  /**
   * Attempt to reconnect to STOMP server
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