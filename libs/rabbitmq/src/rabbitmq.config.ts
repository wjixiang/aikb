import {
  RabbitMQConfig,
  RabbitMQQueueConfig,
  RabbitMQExchangeConfig,
} from './message.types';

/**
 * Default RabbitMQ configuration
 */
export const defaultRabbitMQConfig: RabbitMQConfig = {
  url:
    process.env.RABBITMQ_URL &&
    process.env.RABBITMQ_URL !== 'amqp://rabbitmq:15672'
      ? process.env.RABBITMQ_URL
      : `amqp://${process.env.RABBITMQ_USERNAME || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'admin'}@${process.env.RABBITMQ_HOSTNAME || 'rabbitmq'}:${process.env.RABBITMQ_PORT || '15672'}${process.env.RABBITMQ_VHOST ? '/' + process.env.RABBITMQ_VHOST : ''}`,
  hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
  port: parseInt(process.env.RABBITMQ_PORT || '15672'),
  username: process.env.RABBITMQ_USERNAME || 'admin',
  password: process.env.RABBITMQ_PASSWORD || 'admin123',
  vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
  frameMax: parseInt(process.env.RABBITMQ_FRAME_MAX || '0'),
  heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || '60'),
  locale: process.env.RABBITMQ_LOCALE || 'en_US',
};

/**
 * RabbitMQ configuration for different environments
 */
export const rabbitMQConfigs = {
  development: {
    ...defaultRabbitMQConfig,
    url: process.env.RABBITMQ_URL_DEV || 'amqp://rabbitmq:15672',
  },
  production: {
    ...defaultRabbitMQConfig,
    url: process.env.RABBITMQ_URL_PROD || 'amqp://rabbitmq:15672',
    heartbeat: 120,
  },
  test: {
    ...defaultRabbitMQConfig,
    url:
      process.env.RABBITMQ_URL_TEST ||
      `amqp://${process.env.RABBITMQ_USERNAME || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'admin123'}@${process.env.RABBITMQ_HOSTNAME || 'rabbitmq'}:${process.env.RABBITMQ_PORT || '15672'}${process.env.RABBITMQ_VHOST ? '/' + process.env.RABBITMQ_VHOST : ''}`,
    heartbeat: 30,
  },
};

/**
 * Get RabbitMQ configuration for the current environment
 */
export function getRabbitMQConfig(
  env: string = process.env.NODE_ENV || 'development',
): RabbitMQConfig {
  return (
    rabbitMQConfigs[env as keyof typeof rabbitMQConfigs] ||
    rabbitMQConfigs.development
  );
}

/**
 * Validate RabbitMQ configuration
 */
export function validateRabbitMQConfig(config: RabbitMQConfig): boolean {
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
 * Get validated RabbitMQ configuration
 */
export function getValidatedRabbitMQConfig(
  env?: string,
): RabbitMQConfig | null {
  const config = getRabbitMQConfig(env);

  if (!validateRabbitMQConfig(config)) {
    return null;
  }

  return config;
}

/**
 * RabbitMQ queue configurations
 */
export const rabbitMQQueueConfigs: Record<string, RabbitMQQueueConfig> = {
  'pdf-conversion-request': {
    name: 'pdf-conversion-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 10000, // Maximum 10,000 messages in queue
    },
  },
  'pdf-conversion-progress': {
    name: 'pdf-conversion-progress',
    durable: true, // Changed to true to match existing queue
    exclusive: false,
    autoDelete: false, // Changed to false to match existing queue
    arguments: {
      // Remove x-message-ttl to match existing queue configuration
      // 'x-message-ttl': 300000, // 5 minutes in milliseconds
    },
  },
  'pdf-conversion-completed': {
    name: 'pdf-conversion-completed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 86400000, // 24 hours in milliseconds
      'x-max-length': 50000, // Maximum 50,000 messages
    },
  },
  'pdf-conversion-failed': {
    name: 'pdf-conversion-failed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 604800000, // 7 days in milliseconds
      'x-max-length': 10000, // Maximum 10,000 messages
    },
  },
  'pdf-analysis-request': {
    name: 'pdf-analysis-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 1800000, // 30 minutes in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages
    },
  },
  'pdf-analysis-completed': {
    name: 'pdf-analysis-completed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 10000, // Maximum 10,000 messages
    },
  },
  'pdf-analysis-failed': {
    name: 'pdf-analysis-failed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 604800000, // 7 days in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages
    },
  },
  'pdf-part-conversion-request': {
    name: 'pdf-part-conversion-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 7200000, // 2 hours in milliseconds
      'x-max-length': 20000, // Maximum 20,000 messages
    },
  },
  'pdf-part-conversion-completed': {
    name: 'pdf-part-conversion-completed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 10000, // Maximum 10,000 messages
    },
  },
  'pdf-part-conversion-failed': {
    name: 'pdf-part-conversion-failed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 604800000, // 7 days in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages
    },
  },
  'pdf-merging-request': {
    name: 'pdf-merging-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 1000, // Maximum 1,000 messages
    },
  },
  'pdf-merging-progress': {
    name: 'pdf-merging-progress',
    durable: false, // Progress messages are transient
    exclusive: false,
    autoDelete: true,
    arguments: {
      'x-message-ttl': 300000, // 5 minutes in milliseconds
    },
  },
  'pdf-conversion-dlq': {
    name: 'pdf-conversion-dlq',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 2592000000, // 30 days in milliseconds
    },
  },
  'markdown-storage-request': {
    name: 'markdown-storage-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages
    },
  },
  'markdown-storage-completed': {
    name: 'markdown-storage-completed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 86400000, // 24 hours in milliseconds
      'x-max-length': 50000, // Maximum 50,000 messages
    },
  },
  'markdown-storage-failed': {
    name: 'markdown-storage-failed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 604800000, // 7 days in milliseconds
      'x-max-length': 10000, // Maximum 10,000 messages
    },
  },
  'markdown-part-storage-request': {
    name: 'markdown-part-storage-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages
    },
  },
  'markdown-part-storage-progress': {
    name: 'markdown-part-storage-progress',
    durable: false, // Progress messages are transient
    exclusive: false,
    autoDelete: true, // Auto-delete when no consumers
    arguments: {
      'x-message-ttl': 300000, // 5 minutes in milliseconds
      'x-max-length': 1000, // Keep only recent progress messages
    },
  },
  'markdown-part-storage-completed': {
    name: 'markdown-part-storage-completed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 3600000, // 1 hour in milliseconds (to match existing queue)
      'x-max-length': 10000, // Maximum 10,000 messages (to match existing queue)
    },
  },
  'markdown-part-storage-failed': {
    name: 'markdown-part-storage-failed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 604800000, // 7 days in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages (to match existing queue)
    },
  },
  'health-check': {
    name: 'health-check',
    durable: false, // Health check queue doesn't need to be durable
    exclusive: false,
    autoDelete: true, // Auto-delete when no consumers
    arguments: {
      'x-message-ttl': 60000, // 1 minute in milliseconds
      'x-max-length': 10, // Keep only a few health check messages
    },
  },
  'chunking-embedding-request': {
    name: 'chunking-embedding-request',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-dead-letter-exchange': 'pdf-conversion-dlx',
      'x-dead-letter-routing-key': 'pdf.conversion.dlq',
      'x-message-ttl': 7200000, // 2 hours in milliseconds
      'x-max-length': 20000, // Maximum 20,000 messages
    },
  },
  'chunking-embedding-progress': {
    name: 'chunking-embedding-progress',
    durable: false, // Progress messages are transient
    exclusive: false,
    autoDelete: true, // Auto-delete when no consumers
    arguments: {
      'x-message-ttl': 300000, // 5 minutes in milliseconds
      'x-max-length': 1000, // Keep only recent progress messages
    },
  },
  'chunking-embedding-completed': {
    name: 'chunking-embedding-completed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 3600000, // 1 hour in milliseconds
      'x-max-length': 10000, // Maximum 10,000 messages
    },
  },
  'chunking-embedding-failed': {
    name: 'chunking-embedding-failed',
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: {
      'x-message-ttl': 604800000, // 7 days in milliseconds
      'x-max-length': 5000, // Maximum 5,000 messages
    },
  },
};

/**
 * RabbitMQ exchange configurations
 */
export const rabbitMQExchangeConfigs: Record<string, RabbitMQExchangeConfig> = {
  'pdf-conversion-exchange': {
    name: 'pdf-conversion-exchange',
    type: 'topic',
    durable: true,
    autoDelete: false,
    internal: false,
    arguments: {},
  },
  'pdf-conversion-dlx': {
    name: 'pdf-conversion-dlx',
    type: 'topic',
    durable: true,
    autoDelete: false,
    internal: false,
    arguments: {},
  },
};

/**
 * RabbitMQ connection options
 */
export const rabbitMQConnectionOptions = {
  retry: {
    initialRetryTime: parseInt(
      process.env.RABBITMQ_RETRY_INITIAL_TIME || '1000',
    ),
    retries: parseInt(process.env.RABBITMQ_RETRY_COUNT || '5'),
    factor: 2,
    maxRetryTime: parseInt(process.env.RABBITMQ_RETRY_MAX_TIME || '60000'),
  },
  timeout: parseInt(process.env.RABBITMQ_CONNECTION_TIMEOUT || '30000'),
  keepAlive: process.env.RABBITMQ_KEEP_ALIVE !== 'false',
};

/**
 * RabbitMQ health check configuration
 */
export const rabbitMQHealthCheckConfig = {
  timeout: parseInt(process.env.RABBITMQ_HEALTH_CHECK_TIMEOUT || '5000'),
  interval: parseInt(process.env.RABBITMQ_HEALTH_CHECK_INTERVAL || '30000'),
  retries: parseInt(process.env.RABBITMQ_HEALTH_CHECK_RETRIES || '3'),
};

/**
 * RabbitMQ monitoring configuration
 */
export const rabbitMQMonitoringConfig = {
  enabled: process.env.RABBITMQ_MONITORING_ENABLED === 'true',
  metricsInterval: parseInt(
    process.env.RABBITMQ_MONITORING_METRICS_INTERVAL || '60000',
  ),
  logLevel: process.env.RABBITMQ_MONITORING_LOG_LEVEL || 'info',
};

/**
 * Get queue configuration by name
 */
export function getQueueConfig(queueName: string): RabbitMQQueueConfig | null {
  return rabbitMQQueueConfigs[queueName] || null;
}

/**
 * Get exchange configuration by name
 */
export function getExchangeConfig(
  exchangeName: string,
): RabbitMQExchangeConfig | null {
  return rabbitMQExchangeConfigs[exchangeName] || null;
}

/**
 * All queue configurations
 */
export function getAllQueueConfigs(): Array<RabbitMQQueueConfig> {
  return Object.values(rabbitMQQueueConfigs);
}

/**
 * All exchange configurations
 */
export function getAllExchangeConfigs(): Array<RabbitMQExchangeConfig> {
  return Object.values(rabbitMQExchangeConfigs);
}

/**
 * Get updated RabbitMQ configuration (alias for getValidatedRabbitMQConfig)
 * This function provides compatibility with the previous rabbitmq.config.updated.ts
 */
export function getValidatedUpdatedRabbitMQConfig(): RabbitMQConfig | null {
  return getValidatedRabbitMQConfig();
}

/**
 * Get updated RabbitMQ configuration (alias for defaultRabbitMQConfig)
 * This function provides compatibility with the previous rabbitmq.config.updated.ts
 */
export function getUpdatedRabbitMQConfig(): RabbitMQConfig {
  return defaultRabbitMQConfig;
}

/**
 * Validate updated RabbitMQ configuration (alias for validateRabbitMQConfig)
 * This function provides compatibility with the previous rabbitmq.config.updated.ts
 */
export function validateUpdatedRabbitMQConfig(config: RabbitMQConfig): boolean {
  return validateRabbitMQConfig(config);
}
