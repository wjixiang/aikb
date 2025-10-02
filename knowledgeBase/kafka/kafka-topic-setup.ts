import { Kafka } from 'kafkajs';
import { getValidatedKafkaConfig, createTopicsConfig } from './kafka.config';
import { KAFKA_TOPICS } from './kafka.types';
import createLoggerWithPrefix from '../lib/logger';

const logger = createLoggerWithPrefix('KafkaTopicSetup');

/**
 * Create Kafka topics if they don't exist
 */
export async function createKafkaTopics(): Promise<boolean> {
  try {
    const config = getValidatedKafkaConfig();
    if (!config) {
      logger.error('Invalid Kafka configuration');
      return false;
    }

    const kafka = new Kafka({
      clientId: 'aikb-topic-setup',
      brokers: config.producer.brokers,
      ssl: config.producer.ssl,
      sasl: config.producer.sasl ? {
        mechanism: config.producer.sasl.mechanism as any,
        username: config.producer.sasl.username,
        password: config.producer.sasl.password,
      } : undefined,
      connectionTimeout: config.producer.connectionTimeout,
      requestTimeout: config.producer.requestTimeout,
      retry: config.producer.retry,
    });

    const admin = kafka.admin();
    
    try {
      await admin.connect();
      logger.info('Connected to Kafka admin client');

      // Get existing topics
      const existingTopics = await admin.listTopics();
      logger.info(`Existing topics: ${existingTopics.join(', ')}`);

      // Create topics configuration
      const topicsToCreate = createTopicsConfig();
      
      // Filter out topics that already exist
      const newTopics = topicsToCreate.filter(topicConfig => 
        !existingTopics.includes(topicConfig.topic)
      );

      if (newTopics.length === 0) {
        logger.info('All required topics already exist');
        await admin.disconnect();
        return true;
      }

      logger.info(`Creating ${newTopics.length} new topics: ${newTopics.map(t => t.topic).join(', ')}`);

      // Create new topics
      await admin.createTopics({
        topics: newTopics,
        waitForLeaders: true,
      });

      logger.info('Successfully created Kafka topics');
      
      // Verify topics were created
      const updatedTopics = await admin.listTopics();
      const createdTopics = newTopics.filter(topicConfig => 
        updatedTopics.includes(topicConfig.topic)
      );

      if (createdTopics.length === newTopics.length) {
        logger.info(`All topics created successfully: ${createdTopics.map(t => t.topic).join(', ')}`);
      } else {
        const failedTopics = newTopics.filter(topicConfig => 
          !updatedTopics.includes(topicConfig.topic)
        );
        logger.error(`Failed to create topics: ${failedTopics.map(t => t.topic).join(', ')}`);
      }

      await admin.disconnect();
      return createdTopics.length === newTopics.length;
    } catch (error) {
      logger.error('Error during topic creation:', error);
      await admin.disconnect();
      return false;
    }
  } catch (error) {
    logger.error('Failed to setup Kafka topics:', error);
    return false;
  }
}

/**
 * Delete Kafka topics (useful for cleanup)
 */
export async function deleteKafkaTopics(): Promise<boolean> {
  try {
    const config = getValidatedKafkaConfig();
    if (!config) {
      logger.error('Invalid Kafka configuration');
      return false;
    }

    const kafka = new Kafka({
      clientId: 'aikb-topic-cleanup',
      brokers: config.producer.brokers,
      ssl: config.producer.ssl,
      sasl: config.producer.sasl ? {
        mechanism: config.producer.sasl.mechanism as any,
        username: config.producer.sasl.username,
        password: config.producer.sasl.password,
      } : undefined,
      connectionTimeout: config.producer.connectionTimeout,
      requestTimeout: config.producer.requestTimeout,
      retry: config.producer.retry,
    });

    const admin = kafka.admin();
    
    try {
      await admin.connect();
      logger.info('Connected to Kafka admin client for cleanup');

      // Get existing topics
      const existingTopics = await admin.listTopics();
      
      // Filter for our application topics
      const topicsToDelete = Object.values(KAFKA_TOPICS).filter(topic => 
        existingTopics.includes(topic)
      );

      if (topicsToDelete.length === 0) {
        logger.info('No application topics to delete');
        await admin.disconnect();
        return true;
      }

      logger.info(`Deleting ${topicsToDelete.length} topics: ${topicsToDelete.join(', ')}`);

      // Delete topics
      await admin.deleteTopics({
        topics: topicsToDelete,
      });

      logger.info('Successfully deleted Kafka topics');
      
      await admin.disconnect();
      return true;
    } catch (error) {
      logger.error('Error during topic deletion:', error);
      await admin.disconnect();
      return false;
    }
  } catch (error) {
    logger.error('Failed to cleanup Kafka topics:', error);
    return false;
  }
}

/**
 * Check if Kafka topics exist
 */
export async function checkKafkaTopics(): Promise<boolean> {
  try {
    const config = getValidatedKafkaConfig();
    if (!config) {
      logger.error('Invalid Kafka configuration');
      return false;
    }

    const kafka = new Kafka({
      clientId: 'aikb-topic-check',
      brokers: config.producer.brokers,
      ssl: config.producer.ssl,
      sasl: config.producer.sasl ? {
        mechanism: config.producer.sasl.mechanism as any,
        username: config.producer.sasl.username,
        password: config.producer.sasl.password,
      } : undefined,
      connectionTimeout: config.producer.connectionTimeout,
      requestTimeout: config.producer.requestTimeout,
      retry: config.producer.retry,
    });

    const admin = kafka.admin();
    
    try {
      await admin.connect();
      logger.info('Connected to Kafka admin client for topic check');

      // Get existing topics
      const existingTopics = await admin.listTopics();
      
      // Check if all required topics exist
      const requiredTopics = Object.values(KAFKA_TOPICS);
      const missingTopics = requiredTopics.filter(topic => 
        !existingTopics.includes(topic)
      );

      if (missingTopics.length === 0) {
        logger.info('All required topics exist');
        await admin.disconnect();
        return true;
      } else {
        logger.warn(`Missing topics: ${missingTopics.join(', ')}`);
        await admin.disconnect();
        return false;
      }
    } catch (error) {
      logger.error('Error during topic check:', error);
      await admin.disconnect();
      return false;
    }
  } catch (error) {
    logger.error('Failed to check Kafka topics:', error);
    return false;
  }
}

// If this file is run directly, create the topics
if (require.main === module) {
  (async () => {
    const success = await createKafkaTopics();
    process.exit(success ? 0 : 1);
  })();
}