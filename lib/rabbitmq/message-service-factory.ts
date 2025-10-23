import {
  IMessageService,
  IMessageServiceFactory,
  MessageProtocol,
  MessageServiceConfig,
} from './message-service.interface';
import { RabbitMQImplementation } from './rabbitmq-implementation';
import { StompImplementation } from './stomp-implementation';

/**
 * Message service factory implementation
 * This factory creates message service instances based on the specified protocol
 */
export class MessageServiceFactory implements IMessageServiceFactory {
  /**
   * Create a new message service instance
   */
  create(config?: MessageServiceConfig): IMessageService {
    if (!config) {
      throw new Error('Message service configuration is required');
    }

    switch (config.protocol) {
      case MessageProtocol.AMQP:
        return new RabbitMQImplementation(config);

      case MessageProtocol.STOMP:
        return new StompImplementation();

      default:
        throw new Error(`Unsupported message protocol: ${config.protocol}`);
    }
  }
}

/**
 * Singleton instance for the message service factory
 */
let messageServiceFactoryInstance: MessageServiceFactory | null = null;

/**
 * Get or create the message service factory singleton instance
 */
export function getMessageServiceFactory(): MessageServiceFactory {
  if (!messageServiceFactoryInstance) {
    messageServiceFactoryInstance = new MessageServiceFactory();
  }
  return messageServiceFactoryInstance;
}

/**
 * Create a message service instance with the specified protocol and configuration
 */
export function createMessageService(
  protocol: MessageProtocol,
  config?: Partial<MessageServiceConfig>,
): IMessageService {
  const factory = getMessageServiceFactory();
  const fullConfig: MessageServiceConfig = {
    protocol,
    connectionOptions: {},
    reconnect: {
      maxAttempts: 5,
      delay: 5000,
    },
    healthCheck: {
      interval: 30000,
      timeout: 5000,
    },
    ...config,
  };
  return factory.create(fullConfig);
}
