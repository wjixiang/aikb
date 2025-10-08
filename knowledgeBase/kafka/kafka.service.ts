import {
  KafkaProducerService,
  initializeKafkaProducer,
} from './kafka-producer.service';
import {
  KafkaConsumerService,
  initializeKafkaConsumer,
  KafkaConsumerFactory,
} from './kafka-consumer.service';
import {
  KafkaEntityStorage,
  KafkaEntityProcessorFactory,
} from './kafka-entity-storage';
import { getValidatedKafkaConfig } from './kafka.config';
import {
  AbstractEntityContentStorage,
  AbstractEntityGraphStorage,
  AbstractEntityVectorStorage,
} from '../storage/abstract-storage';
import createLoggerWithPrefix from '../lib/logger';

const logger = createLoggerWithPrefix('KafkaService');

/**
 * Main Kafka service that manages producers and consumers
 */
export class KafkaService {
  private producer: KafkaProducerService | null = null;
  private contentConsumer: KafkaConsumerService | null = null;
  private graphConsumer: KafkaConsumerService | null = null;
  private vectorConsumer: KafkaConsumerService | null = null;
  private entityStorage: KafkaEntityStorage | null = null;
  private processors: {
    contentProcessor?: any;
    graphProcessor?: any;
    vectorProcessor?: any;
  } = {};

  constructor(
    private entityContentStorage: AbstractEntityContentStorage,
    private entityGraphStorage: AbstractEntityGraphStorage,
    private entityVectorStorage: AbstractEntityVectorStorage,
  ) {}

  /**
   * Initialize Kafka service
   */
  async initialize(): Promise<void> {
    try {
      const config = getValidatedKafkaConfig();
      if (!config) {
        throw new Error('Invalid Kafka configuration');
      }

      // Initialize producer
      this.producer = await initializeKafkaProducer(config.producer);
      logger.info('Kafka producer initialized');

      // Initialize consumers
      this.contentConsumer = await initializeKafkaConsumer(
        KafkaConsumerFactory.createEntityContentProcessor(config.consumer),
      );

      this.graphConsumer = await initializeKafkaConsumer(
        KafkaConsumerFactory.createEntityGraphProcessor(config.consumer),
      );

      this.vectorConsumer = await initializeKafkaConsumer(
        KafkaConsumerFactory.createEntityVectorProcessor(config.consumer),
      );

      logger.info('Kafka consumers initialized');

      // Initialize Kafka-enabled entity storage
      this.entityStorage = new KafkaEntityStorage(
        this.producer,
        this.entityContentStorage,
        this.entityGraphStorage,
        this.entityVectorStorage,
      );

      logger.info('Kafka service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Kafka service:', error);
      throw error;
    }
  }

  /**
   * Start all processors
   */
  async start(): Promise<void> {
    if (!this.contentConsumer || !this.graphConsumer || !this.vectorConsumer) {
      throw new Error('Kafka service not initialized');
    }

    try {
      // Start all processors
      this.processors =
        await KafkaEntityProcessorFactory.createAndStartProcessors(
          this.contentConsumer,
          this.graphConsumer,
          this.vectorConsumer,
          this.entityContentStorage,
          this.entityGraphStorage,
          this.entityVectorStorage,
        );

      logger.info('All Kafka processors started');
    } catch (error) {
      logger.error('Failed to start Kafka processors:', error);
      throw error;
    }
  }

  /**
   * Stop all processors and disconnect
   */
  async stop(): Promise<void> {
    try {
      // Stop all processors
      if (
        this.processors.contentProcessor &&
        this.processors.graphProcessor &&
        this.processors.vectorProcessor
      ) {
        await KafkaEntityProcessorFactory.stopProcessors(
          this.processors.contentProcessor,
          this.processors.graphProcessor,
          this.processors.vectorProcessor,
        );
      }

      // Disconnect producer
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
      }

      // Disconnect consumers
      if (this.contentConsumer) {
        await this.contentConsumer.disconnect();
        this.contentConsumer = null;
      }

      if (this.graphConsumer) {
        await this.graphConsumer.disconnect();
        this.graphConsumer = null;
      }

      if (this.vectorConsumer) {
        await this.vectorConsumer.disconnect();
        this.vectorConsumer = null;
      }

      logger.info('Kafka service stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Kafka service:', error);
      throw error;
    }
  }

  /**
   * Get the Kafka-enabled entity storage
   */
  getEntityStorage(): KafkaEntityStorage | null {
    return this.entityStorage;
  }

  /**
   * Get the Kafka producer
   */
  getProducer(): KafkaProducerService | null {
    return this.producer;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return !!(
      this.producer &&
      this.contentConsumer &&
      this.graphConsumer &&
      this.vectorConsumer
    );
  }

  /**
   * Check if the service is running
   */
  isRunning(): boolean {
    return !!(
      this.producer?.isProducerConnected() &&
      this.contentConsumer?.isConsumerRunning() &&
      this.graphConsumer?.isConsumerRunning() &&
      this.vectorConsumer?.isConsumerRunning()
    );
  }

  /**
   * Health check for the Kafka service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      producer: boolean;
      contentConsumer: boolean;
      graphConsumer: boolean;
      vectorConsumer: boolean;
    };
  }> {
    const details = {
      producer: this.producer?.isProducerConnected() ?? false,
      contentConsumer: this.contentConsumer?.isConsumerConnected() ?? false,
      graphConsumer: this.graphConsumer?.isConsumerConnected() ?? false,
      vectorConsumer: this.vectorConsumer?.isConsumerConnected() ?? false,
    };

    const status = Object.values(details).every((connected) => connected)
      ? 'healthy'
      : 'unhealthy';

    return { status, details };
  }
}

/**
 * Singleton instance for the Kafka service
 */
let kafkaServiceInstance: KafkaService | null = null;

/**
 * Get or create the Kafka service singleton instance
 */
export function getKafkaService(
  entityContentStorage?: AbstractEntityContentStorage,
  entityGraphStorage?: AbstractEntityGraphStorage,
  entityVectorStorage?: AbstractEntityVectorStorage,
): KafkaService | null {
  if (!kafkaServiceInstance) {
    if (!entityContentStorage || !entityGraphStorage || !entityVectorStorage) {
      throw new Error(
        'All storage implementations are required for first initialization',
      );
    }
    kafkaServiceInstance = new KafkaService(
      entityContentStorage,
      entityGraphStorage,
      entityVectorStorage,
    );
  }
  return kafkaServiceInstance;
}

/**
 * Initialize and start the Kafka service
 */
export async function initializeAndStartKafkaService(
  entityContentStorage: AbstractEntityContentStorage,
  entityGraphStorage: AbstractEntityGraphStorage,
  entityVectorStorage: AbstractEntityVectorStorage,
): Promise<KafkaService> {
  const service = getKafkaService(
    entityContentStorage,
    entityGraphStorage,
    entityVectorStorage,
  );

  if (!service) {
    throw new Error('Failed to create Kafka service instance');
  }

  await service.initialize();
  await service.start();

  return service;
}

/**
 * Stop and cleanup the Kafka service
 */
export async function stopKafkaService(): Promise<void> {
  if (kafkaServiceInstance) {
    await kafkaServiceInstance.stop();
    kafkaServiceInstance = null;
  }
}
