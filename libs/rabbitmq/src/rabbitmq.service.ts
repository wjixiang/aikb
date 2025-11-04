import { IRabbitMQService } from './rabbitmq-service.interface';
import { MessageProtocol } from './message-service.interface';
import {
  IMessageService,
  MessageServiceConfig,
} from './message-service.interface';
import { MessageServiceFactory } from './message-service-factory.js';
import { getRabbitMQConfig } from './rabbitmq.config';
import createLoggerWithPrefix from '@aikb/log-management/logger';

const logger = createLoggerWithPrefix('RabbitMQService');

/**
 * RabbitMQ Service Implementation
 * Provides a high-level interface for RabbitMQ operations
 */
export class RabbitMQService {
  private messageService: IMessageService;
  private messageProtocol: MessageProtocol;
  private isInitialized = false;

  constructor(protocol: MessageProtocol = MessageProtocol.AMQP) {
    this.messageProtocol = protocol;

    const config: MessageServiceConfig = {
      protocol,
      connectionOptions: getRabbitMQConfig(),
      topology: {
        queues: [], // Will be set up during initialization
        exchanges: [],
        bindings: [],
      },
      reconnect: {
        maxAttempts: 5,
        delay: 1000,
      },
      healthCheck: {
        interval: 30000,
        timeout: 5000,
      },
    };

    this.messageService = MessageServiceFactory.create(config);
  }

  /**
   * Initialize RabbitMQ connection and setup queues/exchanges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('RabbitMQ service is already initialized');
      return;
    }

    try {
      logger.info('Initializing RabbitMQ service...');
      await this.messageService.initialize();
      await this.messageService.setupTopology?.();
      this.isInitialized = true;
      logger.info('RabbitMQ service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize RabbitMQ service:', error);
      throw error;
    }
  }

  /**
   * Get the message protocol being used
   */
  get protocol(): MessageProtocol {
    return this.messageProtocol;
  }
  async close() {
    await this.messageService.close();
  }
  /**
   * Publish a message to RabbitMQ
   */
}

// Service instance management
const serviceInstances = new Map<MessageProtocol, RabbitMQService>();

/**
 * Get RabbitMQ service instance
 * @param protocol - The message protocol to use
 * @returns RabbitMQ service instance
 */
export function getRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): RabbitMQService {
  if (!serviceInstances.has(protocol)) {
    serviceInstances.set(protocol, new RabbitMQService(protocol));
  }
  return serviceInstances.get(protocol)!;
}

/**
 * Initialize RabbitMQ service
 * @param protocol - The message protocol to use
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): Promise<void> {
  const service = getRabbitMQService(protocol);
  return service.initialize();
}

/**
 * Close RabbitMQ service
 * @param protocol - The message protocol to close
 * @returns Promise that resolves when closing is complete
 */
export async function closeRabbitMQService(
  protocol: MessageProtocol = MessageProtocol.AMQP,
): Promise<void> {
  const service = serviceInstances.get(protocol);
  if (service) {
    await service.close();
    serviceInstances.delete(protocol);
  }
}

/**
 * Close all RabbitMQ services
 * @returns Promise that resolves when all services are closed
 */
export async function closeAllRabbitMQServices(): Promise<void> {
  const closePromises = Array.from(serviceInstances.entries()).map(
    async ([protocol]) => closeRabbitMQService(protocol),
  );
  await Promise.all(closePromises);
  serviceInstances.clear();
}
