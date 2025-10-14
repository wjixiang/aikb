import {
  RabbitMQConfig,
  RabbitMQQueueConfig,
  RabbitMQExchangeConfig,
} from './message.types';

/**
 * Updated RabbitMQ configuration to match docker-compose.yml
 */
export const updatedRabbitMQConfig: RabbitMQConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672',
  hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
  port: parseInt(process.env.RABBITMQ_PORT || '5672'),
  username: process.env.RABBITMQ_USERNAME || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin123',
  vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
  frameMax: parseInt(process.env.RABBITMQ_FRAME_MAX || '0'),
  heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60'),
  locale: process.env.RABBITMQ_LOCALE || 'en_US',
};

/**
 * Get updated RabbitMQ configuration
 */
export function getUpdatedRabbitMQConfig(): RabbitMQConfig {
  return updatedRabbitMQConfig;
}

/**
 * Validate updated RabbitMQ configuration
 */
export function validateUpdatedRabbitMQConfig(config: RabbitMQConfig): boolean {
  if (!config.url && (!config.hostname || !config.port)) {
    console.error('RabbitMQ URL or hostname and port are required');
    return false;
  }

  if (config.username && !config.password) {
    console.error('RabbitMQ password is required when username is provided');
    return false;
  }

  if (config.password && !config.username) {
    console.error('RabbitMQ username is required when password is provided');
    return false;
  }

  return true;
}

/**
 * Get validated updated RabbitMQ configuration
 */
export function getValidatedUpdatedRabbitMQConfig(): RabbitMQConfig | null {
  const config = getUpdatedRabbitMQConfig();

  if (!validateUpdatedRabbitMQConfig(config)) {
    return null;
  }

  return config;
}
