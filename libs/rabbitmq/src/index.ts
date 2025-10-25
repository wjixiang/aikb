// Export the main RabbitMQ service and interface
export { RabbitMQService } from './rabbitmq.service';
export type { IRabbitMQService } from './rabbitmq-service.interface';

// Export helper functions
export {
  getRabbitMQService,
  initializeRabbitMQService,
  closeRabbitMQService,
  closeAllRabbitMQServices,
} from './rabbitmq.service';

// Export message service interface and types
export type {
  IMessageService,
  MessageProtocol,
} from './message-service.interface';
export * from './message.types';

// Export configuration
export * from './rabbitmq.config';

// Export queue routing mappings
export * from './queue-routing-mappings';

// Export debug tools
export { RabbitMQDebugTools, getDebugMockRabbitMQService } from './debug-tools';

// Export message service factory
export { MessageServiceFactory } from './message-service-factory';

// Export STOMP implementation
export { StompMessageService } from './stomp-implementation';

// Export RabbitMQ implementation
export { RabbitMQMessageService } from './rabbitmq-implementation';