import {
  Kafka,
  Consumer,
  ConsumerSubscribeTopic,
  ConsumerRunConfig,
  EachMessagePayload,
} from 'kafkajs';
import createLoggerWithPrefix from '../lib/logger';
import {
  KafkaEvent,
  KafkaConsumerConfig,
  KAFKA_TOPICS,
  KAFKA_CONSUMER_GROUPS,
} from './kafka.types';

const logger = createLoggerWithPrefix('KafkaConsumer');

/**
 * Event handler function type
 */
export type EventHandler<T extends KafkaEvent = KafkaEvent> = (
  event: T,
) => Promise<void>;

/**
 * Event handler registry
 */
interface EventHandlerRegistry {
  [eventType: string]: EventHandler[];
}

/**
 * Kafka Consumer service for processing events
 */
export class KafkaConsumerService {
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected = false;
  private isRunning = false;
  private eventHandlers: EventHandlerRegistry = {};

  constructor(private config: KafkaConsumerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      ssl: config.ssl,
      sasl: config.sasl
        ? {
            mechanism: config.sasl.mechanism as any,
            username: config.sasl.username,
            password: config.sasl.password,
          }
        : undefined,
      connectionTimeout: config.connectionTimeout,
      requestTimeout: config.requestTimeout,
      retry: config.retry,
    });

    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeout,
      heartbeatInterval: config.heartbeatInterval,
      maxWaitTimeInMs: config.maxWaitTimeInMs,
      allowAutoTopicCreation: config.allowAutoTopicCreation,
    });
  }

  /**
   * Connect to Kafka cluster
   */
  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      logger.info('Kafka consumer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka cluster
   */
  async disconnect(): Promise<void> {
    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      this.isRunning = false;
      logger.info('Kafka consumer disconnected successfully');
    } catch (error) {
      logger.error('Failed to disconnect Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Check if consumer is connected
   */
  isConsumerConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Check if consumer is running
   */
  isConsumerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Register an event handler for a specific event type
   */
  registerEventHandler<T extends KafkaEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(handler as EventHandler);
    logger.debug(`Registered handler for event type: ${eventType}`);
  }

  /**
   * Unregister event handlers for a specific event type
   */
  unregisterEventHandlers(eventType: string): void {
    delete this.eventHandlers[eventType];
    logger.debug(`Unregistered handlers for event type: ${eventType}`);
  }

  /**
   * Subscribe to a topic
   */
  async subscribeToTopic(topic: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka consumer is not connected');
    }

    try {
      const subscribeTopic: ConsumerSubscribeTopic = {
        topic,
        fromBeginning: this.config.autoOffsetReset === 'earliest',
      };

      await this.consumer.subscribe(subscribeTopic);
      logger.info(`Subscribed to topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to subscribe to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Start consuming messages
   */
  async startConsuming(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka consumer is not connected');
    }

    if (this.isRunning) {
      logger.warn('Consumer is already running');
      return;
    }

    try {
      const runConfig: ConsumerRunConfig = {
        eachMessage: async (payload: EachMessagePayload) => {
          await this.processMessage(payload);
        },
      };

      await this.consumer.run(runConfig);
      this.isRunning = true;
      logger.info('Kafka consumer started successfully');
    } catch (error) {
      logger.error('Failed to start Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsuming(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Consumer is not running');
      return;
    }

    try {
      await this.consumer.stop();
      this.isRunning = false;
      logger.info('Kafka consumer stopped successfully');
    } catch (error) {
      logger.error('Failed to stop Kafka consumer:', error);
      throw error;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      if (!message.value) {
        logger.warn('Received message with no value', { topic, partition });
        return;
      }

      const event: KafkaEvent = JSON.parse(message.value.toString());
      const eventType = event.eventType;

      logger.debug(`Processing event: ${eventType}`, {
        eventId: event.eventId,
        topic,
        partition,
        offset: message.offset,
      });

      const handlers = this.eventHandlers[eventType];
      if (handlers && handlers.length > 0) {
        // Execute all handlers for this event type
        await Promise.all(
          handlers.map(async (handler) => {
            try {
              await handler(event);
            } catch (handlerError) {
              logger.error(
                `Error in event handler for ${eventType}:`,
                handlerError,
              );
              // Continue processing other handlers even if one fails
            }
          }),
        );

        logger.debug(`Successfully processed event: ${eventType}`, {
          eventId: event.eventId,
        });
      } else {
        logger.warn(`No handlers registered for event type: ${eventType}`, {
          eventId: event.eventId,
        });
      }
    } catch (error) {
      logger.error('Failed to process message:', error, {
        topic,
        partition,
        offset: message.offset,
      });

      // Send to dead letter queue for failed messages
      await this.sendToDeadLetterQueue(topic, message, error as Error);
    }
  }

  /**
   * Send failed message to dead letter queue
   */
  private async sendToDeadLetterQueue(
    originalTopic: string,
    message: any,
    error: Error,
  ): Promise<void> {
    try {
      // This would require a producer instance to send to DLQ
      // For now, just log the error
      logger.error('Message processing failed, consider sending to DLQ:', {
        originalTopic,
        error: error.message,
        messageKey: message.key,
      });
    } catch (dlqError) {
      logger.error('Failed to send message to dead letter queue:', dlqError);
    }
  }

  /**
   * Setup consumer for entity content processing
   */
  async setupEntityContentProcessor(): Promise<void> {
    await this.subscribeToTopic(KAFKA_TOPICS.ENTITY_EVENTS);
    logger.info('Entity content processor setup completed');
  }

  /**
   * Setup consumer for entity graph processing
   */
  async setupEntityGraphProcessor(): Promise<void> {
    await this.subscribeToTopic(KAFKA_TOPICS.ENTITY_RELATION_PROCESSING);
    logger.info('Entity graph processor setup completed');
  }

  /**
   * Setup consumer for entity vector processing
   */
  async setupEntityVectorProcessor(): Promise<void> {
    await this.subscribeToTopic(KAFKA_TOPICS.ENTITY_VECTOR_PROCESSING);
    logger.info('Entity vector processor setup completed');
  }

  /**
   * Setup consumer for knowledge content processing
   */
  async setupKnowledgeContentProcessor(): Promise<void> {
    await this.subscribeToTopic(KAFKA_TOPICS.KNOWLEDGE_EVENTS);
    logger.info('Knowledge content processor setup completed');
  }

  /**
   * Setup consumer for knowledge vector processing
   */
  async setupKnowledgeVectorProcessor(): Promise<void> {
    await this.subscribeToTopic(KAFKA_TOPICS.KNOWLEDGE_VECTOR_PROCESSING);
    logger.info('Knowledge vector processor setup completed');
  }
}

/**
 * Factory function to create different types of consumers
 */
export class KafkaConsumerFactory {
  /**
   * Create entity content processor consumer
   */
  static createEntityContentProcessor(
    config: KafkaConsumerConfig,
  ): KafkaConsumerService {
    const consumer = new KafkaConsumerService({
      ...config,
      groupId: KAFKA_CONSUMER_GROUPS.ENTITY_CONTENT_PROCESSOR,
    });
    return consumer;
  }

  /**
   * Create entity graph processor consumer
   */
  static createEntityGraphProcessor(
    config: KafkaConsumerConfig,
  ): KafkaConsumerService {
    const consumer = new KafkaConsumerService({
      ...config,
      groupId: KAFKA_CONSUMER_GROUPS.ENTITY_GRAPH_PROCESSOR,
    });
    return consumer;
  }

  /**
   * Create entity vector processor consumer
   */
  static createEntityVectorProcessor(
    config: KafkaConsumerConfig,
  ): KafkaConsumerService {
    const consumer = new KafkaConsumerService({
      ...config,
      groupId: KAFKA_CONSUMER_GROUPS.ENTITY_VECTOR_PROCESSOR,
    });
    return consumer;
  }

  /**
   * Create knowledge content processor consumer
   */
  static createKnowledgeContentProcessor(
    config: KafkaConsumerConfig,
  ): KafkaConsumerService {
    const consumer = new KafkaConsumerService({
      ...config,
      groupId: KAFKA_CONSUMER_GROUPS.KNOWLEDGE_CONTENT_PROCESSOR,
    });
    return consumer;
  }

  /**
   * Create knowledge vector processor consumer
   */
  static createKnowledgeVectorProcessor(
    config: KafkaConsumerConfig,
  ): KafkaConsumerService {
    const consumer = new KafkaConsumerService({
      ...config,
      groupId: KAFKA_CONSUMER_GROUPS.KNOWLEDGE_VECTOR_PROCESSOR,
    });
    return consumer;
  }
}

/**
 * Initialize and connect a Kafka consumer
 */
export async function initializeKafkaConsumer(
  consumer: KafkaConsumerService,
): Promise<KafkaConsumerService> {
  await consumer.connect();
  return consumer;
}
