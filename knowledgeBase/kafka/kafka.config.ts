import {
  KafkaConfig,
  KafkaProducerConfig,
  KafkaConsumerConfig,
} from './kafka.types';

/**
 * Default Kafka configuration
 */
export const defaultKafkaConfig: KafkaConfig = {
  clientId: 'aikb-kafka-client',
  brokers: process.env.KAFKA_BROKERS
    ? process.env.KAFKA_BROKERS.split(',')
    : ['kafka:9092'],
  ssl: process.env.KAFKA_SSL === 'true',
  connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '10000'),
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000'),
  retry: {
    initialRetryTime: parseInt(process.env.KAFKA_RETRY_INITIAL_TIME || '100'),
    retries: parseInt(process.env.KAFKA_RETRY_COUNT || '8'),
  },
  sasl:
    process.env.KAFKA_SASL_MECHANISM &&
    process.env.KAFKA_SASL_USERNAME &&
    process.env.KAFKA_SASL_PASSWORD
      ? {
          mechanism: process.env.KAFKA_SASL_MECHANISM as
            | 'plain'
            | 'scram-sha-256'
            | 'scram-sha-512',
          username: process.env.KAFKA_SASL_USERNAME,
          password: process.env.KAFKA_SASL_PASSWORD,
        }
      : undefined,
};

/**
 * Default Kafka producer configuration
 */
export const defaultKafkaProducerConfig: KafkaProducerConfig = {
  ...defaultKafkaConfig,
  transactionTimeout: parseInt(
    process.env.KAFKA_PRODUCER_TRANSACTION_TIMEOUT || '60000',
  ),
  maxInFlightRequests: parseInt(
    process.env.KAFKA_PRODUCER_MAX_IN_FLIGHT || '5',
  ),
  idempotent: process.env.KAFKA_PRODUCER_IDEMPOTENT !== 'false',
};

/**
 * Default Kafka consumer configuration
 */
export const defaultKafkaConsumerConfig: KafkaConsumerConfig = {
  ...defaultKafkaConfig,
  groupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'aikb-consumer-group',
  sessionTimeout: parseInt(
    process.env.KAFKA_CONSUMER_SESSION_TIMEOUT || '30000',
  ),
  heartbeatInterval: parseInt(
    process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL || '3000',
  ),
  maxWaitTimeInMs: parseInt(process.env.KAFKA_CONSUMER_MAX_WAIT_TIME || '5000'),
  allowAutoTopicCreation:
    process.env.KAFKA_CONSUMER_AUTO_TOPIC_CREATION !== 'false',
  autoOffsetReset:
    (process.env.KAFKA_CONSUMER_AUTO_OFFSET_RESET as
      | 'earliest'
      | 'latest'
      | 'none') || 'latest',
};

/**
 * Kafka configuration for different environments
 */
export const kafkaConfigs = {
  development: {
    producer: {
      ...defaultKafkaProducerConfig,
      clientId: 'aikb-kafka-producer-dev',
    },
    consumer: {
      ...defaultKafkaConsumerConfig,
      clientId: 'aikb-kafka-consumer-dev',
    },
  },
  production: {
    producer: {
      ...defaultKafkaProducerConfig,
      clientId: 'aikb-kafka-producer-prod',
      idempotent: true,
      maxInFlightRequests: 1,
    },
    consumer: {
      ...defaultKafkaConsumerConfig,
      clientId: 'aikb-kafka-consumer-prod',
      sessionTimeout: 60000,
      heartbeatInterval: 5000,
    },
  },
  test: {
    producer: {
      ...defaultKafkaProducerConfig,
      clientId: 'aikb-kafka-producer-test',
      transactionTimeout: 5000,
    },
    consumer: {
      ...defaultKafkaConsumerConfig,
      clientId: 'aikb-kafka-consumer-test',
      sessionTimeout: 10000,
      heartbeatInterval: 1000,
      maxWaitTimeInMs: 1000,
    },
  },
};

/**
 * Get Kafka configuration for the current environment
 */
export function getKafkaConfig(
  env: string = process.env.NODE_ENV || 'development',
): {
  producer: KafkaProducerConfig;
  consumer: KafkaConsumerConfig;
} {
  return (
    kafkaConfigs[env as keyof typeof kafkaConfigs] || kafkaConfigs.development
  );
}

/**
 * Validate Kafka configuration
 */
export function validateKafkaConfig(config: KafkaConfig): boolean {
  if (!config.brokers || config.brokers.length === 0) {
    console.error('Kafka brokers are not configured');
    return false;
  }

  if (config.sasl) {
    if (!config.sasl.username || !config.sasl.password) {
      console.error(
        'Kafka SASL username and password are required when SASL is enabled',
      );
      return false;
    }
  }

  return true;
}

/**
 * Get Kafka configuration from environment variables with validation
 */
export function getValidatedKafkaConfig(env?: string): {
  producer: KafkaProducerConfig;
  consumer: KafkaConsumerConfig;
} | null {
  const config = getKafkaConfig(env);

  if (
    !validateKafkaConfig(config.producer) ||
    !validateKafkaConfig(config.consumer)
  ) {
    return null;
  }

  return config;
}

/**
 * Kafka topic configuration
 */
export const kafkaTopicConfigs = {
  'entity-events': {
    partitions: parseInt(
      process.env.KAFKA_TOPIC_ENTITY_EVENTS_PARTITIONS || '3',
    ),
    replicationFactor: parseInt(
      process.env.KAFKA_TOPIC_ENTITY_EVENTS_REPLICATION_FACTOR || '1',
    ),
  },
  'knowledge-events': {
    partitions: parseInt(
      process.env.KAFKA_TOPIC_KNOWLEDGE_EVENTS_PARTITIONS || '3',
    ),
    replicationFactor: parseInt(
      process.env.KAFKA_TOPIC_KNOWLEDGE_EVENTS_REPLICATION_FACTOR || '1',
    ),
  },
  'entity-vector-processing': {
    partitions: parseInt(
      process.env.KAFKA_TOPIC_ENTITY_VECTOR_PROCESSING_PARTITIONS || '6',
    ),
    replicationFactor: parseInt(
      process.env.KAFKA_TOPIC_ENTITY_VECTOR_PROCESSING_REPLICATION_FACTOR ||
        '1',
    ),
  },
  'knowledge-vector-processing': {
    partitions: parseInt(
      process.env.KAFKA_TOPIC_KNOWLEDGE_VECTOR_PROCESSING_PARTITIONS || '6',
    ),
    replicationFactor: parseInt(
      process.env.KAFKA_TOPIC_KNOWLEDGE_VECTOR_PROCESSING_REPLICATION_FACTOR ||
        '1',
    ),
  },
  'entity-relation-processing': {
    partitions: parseInt(
      process.env.KAFKA_TOPIC_ENTITY_RELATION_PROCESSING_PARTITIONS || '3',
    ),
    replicationFactor: parseInt(
      process.env.KAFKA_TOPIC_ENTITY_RELATION_PROCESSING_REPLICATION_FACTOR ||
        '1',
    ),
  },
  'dead-letter-queue': {
    partitions: parseInt(
      process.env.KAFKA_TOPIC_DEAD_LETTER_QUEUE_PARTITIONS || '3',
    ),
    replicationFactor: parseInt(
      process.env.KAFKA_TOPIC_DEAD_LETTER_QUEUE_REPLICATION_FACTOR || '1',
    ),
  },
};

/**
 * Create topics configuration for Kafka admin
 */
export function createTopicsConfig(): Array<{
  topic: string;
  numPartitions: number;
  replicationFactor: number;
}> {
  return Object.entries(kafkaTopicConfigs).map(([topic, config]) => ({
    topic,
    numPartitions: config.partitions,
    replicationFactor: config.replicationFactor,
  }));
}

/**
 * Kafka health check configuration
 */
export const kafkaHealthCheckConfig = {
  timeout: parseInt(process.env.KAFKA_HEALTH_CHECK_TIMEOUT || '5000'),
  interval: parseInt(process.env.KAFKA_HEALTH_CHECK_INTERVAL || '30000'),
  retries: parseInt(process.env.KAFKA_HEALTH_CHECK_RETRIES || '3'),
};

/**
 * Kafka monitoring configuration
 */
export const kafkaMonitoringConfig = {
  enabled: process.env.KAFKA_MONITORING_ENABLED === 'true',
  metricsInterval: parseInt(
    process.env.KAFKA_MONITORING_METRICS_INTERVAL || '60000',
  ),
  logLevel: process.env.KAFKA_MONITORING_LOG_LEVEL || 'info',
};
