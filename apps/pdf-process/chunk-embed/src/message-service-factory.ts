import { IMessageService, MessageProtocol } from './message-service.interface';
import { AmqpMessageService } from './amqp-message-service';
import { StompMessageService } from './stomp-message-service';

/**
 * Create a message service instance based on protocol
 */
export function createMessageService(protocol: MessageProtocol): IMessageService {
  switch (protocol) {
    case MessageProtocol.AMQP:
      return new AmqpMessageService();
    case MessageProtocol.STOMP:
      return new StompMessageService();
    default:
      throw new Error(`Unsupported message protocol: ${protocol}`);
  }
}

/**
 * Get available protocols
 */
export function getAvailableProtocols(): MessageProtocol[] {
  return [MessageProtocol.AMQP, MessageProtocol.STOMP];
}