import { IMessageService, MessageServiceConfig, MessageProtocol } from './message-service.interface';

/**
 * Message Service Factory
 * Creates appropriate message service instances based on protocol
 */
export class MessageServiceFactory {
  /**
   * Create a new message service instance
   * @param config - Message service configuration
   * @returns Message service instance
   */
  static create(config?: MessageServiceConfig): IMessageService {
    if (!config) {
      throw new Error('Message service configuration is required');
    }

    switch (config.protocol) {
      case MessageProtocol.AMQP:
        // Will be implemented by RabbitMQMessageService
        throw new Error('AMQP message service not yet implemented');
      case MessageProtocol.STOMP:
        // Will be implemented by StompMessageService
        throw new Error('STOMP message service not yet implemented');
      default:
        throw new Error(`Unsupported protocol: ${config.protocol}`);
    }
  }
}

/**
 * Message Service Factory Interface
 */
export interface IMessageServiceFactory {
  create(config?: MessageServiceConfig): IMessageService;
}

/**
 * Export singleton factory instance
 */
export const messageServiceFactory: IMessageServiceFactory = MessageServiceFactory;