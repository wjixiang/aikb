import { Client, StompSubscription } from '@stomp/stompjs';
import WebSocket from 'ws';
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
} from './message.types';
import { getValidatedStompConfig, getStompDestination } from './stomp.config';
import { getRoutingKeyForQueue } from './queue-routing-mappings';
import createLoggerWithPrefix from '@aikb/log-management/logger';
const logger = createLoggerWithPrefix('StompImplementation');

/**
 * STOMP implementation of the IMessageService interface
 * This class handles all STOMP-specific operations and connection management
 */
export class StompImplementation implements IMessageService {
  private client: Client | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private subscriptions: Map<string, StompSubscription> = new Map();
  private config: MessageServiceConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    const config = getValidatedStompConfig();
    if (!config) {
      throw new Error('Invalid STOMP configuration');
    }
    this.config = config;

    if (this.config.reconnect) {
      this.maxReconnectAttempts = this.config.reconnect.maxAttempts;
      this.reconnectDelay = this.config.reconnect.delay;
    }
  }

  /**
   * Initialize STOMP connection
   */
  async initialize(): Promise<void> {
    if (
      this.connectionStatus === 'connected' ||
      this.connectionStatus === 'connecting'
    ) {
      return;
    }

    this.connectionStatus = 'connecting';

    try {
      logger.info('Connecting to STOMP server...', {
        brokerURL: this.config.connectionOptions.brokerURL,
        login: this.config.connectionOptions.connectHeaders.login,
        passcode: this.config.connectionOptions.connectHeaders.passcode
          ? '[REDACTED]'
          : undefined,
        vhost: this.config.connectionOptions.connectHeaders.host,
        reconnectDelay: this.config.connectionOptions.reconnectDelay,
        maxReconnectAttempts: this.config.reconnect?.maxAttempts,
        heartbeatIncoming: this.config.connectionOptions.heartbeatIncoming,
        heartbeatOutgoing: this.config.connectionOptions.heartbeatOutgoing,
      });

      // Create STOMP client
      const clientOptions: any = {
        brokerURL: this.config.connectionOptions.brokerURL,
        connectHeaders: this.config.connectionOptions.connectHeaders,
        reconnectDelay: this.config.connectionOptions.reconnectDelay,
        heartbeatIncoming: this.config.connectionOptions.heartbeatIncoming,
        heartbeatOutgoing: this.config.connectionOptions.heartbeatOutgoing,
        webSocketFactory: () =>
          new WebSocket(this.config.connectionOptions.brokerURL),
        onConnect: (frame) => {
          logger.info('STOMP connected successfully');
          this.connectionStatus = 'connected';
          this.reconnectAttempts = 0;
          this.startHeartbeat();
        },
        onDisconnect: (frame) => {
          logger.warn('STOMP disconnected');
          this.connectionStatus = 'disconnected';
          this.handleReconnection();
        },
        onStompError: (frame) => {
          logger.error('STOMP error:', {
            message: frame.headers['message'],
            command: frame.command,
            headers: frame.headers,
            connectionStatus: this.connectionStatus,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            brokerURL: this.config.connectionOptions.brokerURL,
            vhost: this.config.connectionOptions.connectHeaders.host,
            login: this.config.connectionOptions.connectHeaders.login,
          });
          this.connectionStatus = 'disconnected';
          this.handleReconnection();
        },
        onWebSocketError: (error) => {
          logger.error('STOMP WebSocket error:', {
            error: error.message || error,
            stack: error.stack,
            connectionStatus: this.connectionStatus,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            brokerURL: this.config.connectionOptions.brokerURL,
          });
          this.connectionStatus = 'disconnected';
          this.handleReconnection();
        },
      };

      // Disable debug function to avoid context issues
      // debug: undefined is set in the configuration

      this.client = new Client(clientOptions);

      // Activate the client
      this.client.activate();

      // Wait for connection to be established
      await this.waitForConnection();

      logger.info('STOMP implementation initialized successfully');
    } catch (error) {
      this.connectionStatus = 'disconnected';
      logger.error('Failed to initialize STOMP implementation:', error);
      throw error;
    }
  }

  /**
   * Close STOMP connection and cleanup resources
   */
  async close(): Promise<void> {
    try {
      this.stopHeartbeat();

      // Unsubscribe from all subscriptions
      for (const [subscriptionId, subscription] of this.subscriptions) {
        if (subscription && this.client && this.client.connected) {
          try {
            this.client.unsubscribe(subscription.id);
          } catch (error) {
            // Ignore unsubscribe errors if connection is already closed
            logger.debug('Error unsubscribing:', error);
          }
        }
      }
      this.subscriptions.clear();

      if (this.client && this.client.connected) {
        this.client.deactivate();
      }

      this.client = null;
      this.connectionStatus = 'disconnected';
      logger.info('STOMP implementation closed successfully');
    } catch (error) {
      logger.error('Error closing STOMP implementation:', error);
      throw error;
    }
  }

  /**
   * Check if the service is connected
   */
  isConnected(): boolean {
    return (
      this.connectionStatus === 'connected' &&
      this.client !== null &&
      this.client.connected
    );
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
    const isConnected = this.isConnected();
    const details = {
      connected: isConnected,
      protocol: 'stomp',
      reconnectAttempts: this.reconnectAttempts,
      subscriptionCount: this.subscriptions.size,
      connectionStatus: this.connectionStatus,
      brokerURL: this.config.connectionOptions.brokerURL,
    };

    const status = isConnected ? 'healthy' : 'unhealthy';

    logger.debug('STOMP health check:', {
      status,
      connected: isConnected,
      connectionStatus: this.connectionStatus,
      subscriptionCount: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      brokerURL: this.config.connectionOptions.brokerURL,
    });

    return { status, details };
  }

  /**
   * Publish a message to a STOMP destination
   */
  async publishMessage(
    destination: string,
    message: BaseRabbitMQMessage,
    options: RabbitMQMessageOptions = {},
  ): Promise<boolean> {
    if (!this.isConnected()) {
      await this.initialize();
    }

    try {
      const headers: any = {
        'content-type': 'application/json',
        'x-message-type': message.eventType,
        'x-timestamp': Date.now(),
        ...options.headers,
      };

      // Add STOMP-specific headers
      if (options.persistent !== false) {
        headers['persistent'] = 'true';
      }
      if (options.priority) {
        headers['priority'] = options.priority.toString();
      }
      if (options.expiration) {
        headers['expiration'] = options.expiration;
      }
      if (options.correlationId) {
        headers['correlation-id'] = options.correlationId;
      }
      if (options.replyTo) {
        headers['reply-to'] = options.replyTo;
      }

      const messageBody = JSON.stringify(message);

      this.client!.publish({
        destination,
        body: messageBody,
        headers,
      });

      logger.debug(`Message published to STOMP destination: ${destination}`, {
        messageId: message.messageId,
        eventType: message.eventType,
      });

      return true;
    } catch (error) {
      logger.error('Failed to publish STOMP message:', error);
      throw error;
    }
  }

  /**
   * Subscribe to a STOMP destination
   */
  async consumeMessages(
    destination: string,
    onMessage: MessageConsumer,
    options: ConsumerOptions = {},
  ): Promise<string> {
    if (!this.isConnected()) {
      logger.error('STOMP implementation not connected');
      throw new Error('STOMP implementation not connected');
    }

    try {
      const subscriptionId =
        options.consumerTag ||
        `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const headers: any = {
        ack: options.noAck ? 'auto' : 'client',
        id: subscriptionId,
      };

      if (options.exclusive) {
        headers['exclusive'] = 'true';
      }
      if (options.priority) {
        headers['priority'] = options.priority.toString();
      }

      // Convert queue name to STOMP destination if needed
      let stompDestination = destination;
      if (
        destination.startsWith('pdf-') ||
        destination.startsWith('markdown-') ||
        destination.startsWith('chunking-')
      ) {
        // This looks like a queue name, convert it to an exchange destination
        try {
          const routingKey = getRoutingKeyForQueue(destination);
          stompDestination = getStompDestination(routingKey);
          logger.info(
            `Converted queue ${destination} to STOMP destination ${stompDestination}`,
          );
        } catch (error) {
          // If conversion fails, try direct queue access
          stompDestination = `/queue/${destination}`;
          logger.info(
            `Using direct queue access for ${destination}: ${stompDestination}`,
          );
        }
      }

      const subscription = this.client!.subscribe(
        stompDestination,
        (message) => {
          logger.info(
            `Received message from STOMP destination: ${stompDestination} (original: ${destination})`,
          );

          if (!message.body) {
            logger.warn(
              `Received empty message from STOMP destination: ${stompDestination}`,
            );
            return;
          }

          try {
            const messageContent = JSON.parse(
              message.body,
            ) as PdfConversionMessage;
            logger.info(
              `Processed STOMP message from destination ${stompDestination}:`,
              {
                eventType: messageContent.eventType,
                itemId: (messageContent as any).itemId,
              },
            );

            // Call the message handler
            onMessage(messageContent, message);

            // Manually acknowledge if not auto-ack
            if (!options.noAck && message.headers['message-id']) {
              this.client!.ack(message.headers['message-id']);
            }
          } catch (error) {
            logger.error(
              `Error processing STOMP message from destination ${stompDestination}:`,
              error,
            );
            logger.error(`Message content was:`, message.body);

            // Negative acknowledgment if not auto-ack
            if (!options.noAck && message.headers['message-id']) {
              this.client!.nack(message.headers['message-id']);
            }
          }
        },
        headers,
      );

      this.subscriptions.set(subscriptionId, subscription);

      logger.info(`Subscribed to STOMP destination: ${destination}`, {
        subscriptionId,
      });

      return subscriptionId;
    } catch (error) {
      logger.error(
        `Failed to subscribe to STOMP destination ${destination}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Unsubscribe from a STOMP destination
   */
  async stopConsuming(subscriptionId: string): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription && this.client) {
        this.client.unsubscribe(subscription.id);
        this.subscriptions.delete(subscriptionId);
        logger.info(`Unsubscribed from STOMP subscription: ${subscriptionId}`);
      }
    } catch (error) {
      logger.error(
        `Failed to unsubscribe from STOMP subscription ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get information about a STOMP destination
   */
  async getQueueInfo(destination: string): Promise<QueueInfo | null> {
    if (!this.isConnected()) {
      await this.initialize();
    }

    try {
      // STOMP doesn't have a direct way to get destination info like RabbitMQ
      // We can make a temporary subscription to check if destination exists
      // but for now, return basic info
      logger.info(`Getting info for STOMP destination: ${destination}`);

      return {
        messageCount: 0, // STOMP doesn't provide message count
        consumerCount: this.subscriptions.size,
      };
    } catch (error) {
      logger.error(
        `Failed to get STOMP destination info for ${destination}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Purge messages from a STOMP destination
   */
  async purgeQueue(destination: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('STOMP implementation not connected');
    }

    try {
      // STOMP doesn't have a direct purge command like RabbitMQ
      // This would need to be implemented at the broker level
      logger.info(`Purge requested for STOMP destination: ${destination}`);
      logger.warn('STOMP destination purge is not directly supported');
    } catch (error) {
      logger.error(`Failed to purge STOMP destination ${destination}:`, error);
      throw error;
    }
  }

  /**
   * Wait for connection to be established
   */
  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('STOMP connection timeout'));
      }, 10000); // 10 seconds timeout

      const checkConnection = () => {
        if (this.isConnected()) {
          clearTimeout(timeout);
          resolve();
        } else if (this.connectionStatus === 'disconnected') {
          clearTimeout(timeout);
          reject(new Error('STOMP connection failed'));
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
  private async handleReconnection(): Promise<void> {
    if (
      this.connectionStatus === 'connecting' ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      logger.debug('Skipping reconnection:', {
        connectionStatus: this.connectionStatus,
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.maxReconnectAttempts,
      });
      return;
    }

    this.connectionStatus = 'reconnecting';
    this.reconnectAttempts++;
    logger.info(
      `Attempting to reconnect to STOMP (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
      {
        brokerURL: this.config.connectionOptions.brokerURL,
        reconnectDelay: this.reconnectDelay,
        connectionStatus: this.connectionStatus,
      },
    );

    setTimeout(async () => {
      try {
        logger.debug(`Starting reconnection attempt ${this.reconnectAttempts}`);
        await this.initialize();
        logger.info(
          `STOMP reconnection successful on attempt ${this.reconnectAttempts}`,
        );
      } catch (error) {
        logger.error(
          `STOMP reconnection attempt ${this.reconnectAttempts} failed:`,
          {
            error: error.message || error,
            stack: error.stack,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            brokerURL: this.config.connectionOptions.brokerURL,
          },
        );
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.handleReconnection();
        } else {
          logger.error('Max STOMP reconnection attempts reached. Giving up.', {
            totalAttempts: this.reconnectAttempts,
            finalConnectionStatus: this.connectionStatus,
            brokerURL: this.config.connectionOptions.brokerURL,
          });
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

    const interval = this.config.healthCheck?.interval || 30000;

    this.heartbeatInterval = setInterval(async () => {
      if (this.isConnected()) {
        try {
          // STOMP doesn't have a direct health check command
          // We can check if the connection is still active
          const health = await this.healthCheck();
          if (health.status === 'unhealthy') {
            logger.warn('STOMP health check failed');
          }
        } catch (error) {
          logger.warn('STOMP health check failed:', error);
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
