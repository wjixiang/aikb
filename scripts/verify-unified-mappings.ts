#!/usr/bin/env ts-node

/**
 * Script to verify unified queue-to-routing-key mappings
 * This script validates that the mappings work correctly for both AMQP and STOMP protocols
 */

import {
  getRoutingKeyForQueue,
  hasRoutingKeyMapping,
  getAllMappedQueueNames,
} from '../lib/rabbitmq/queue-routing-mappings';
import { getStompDestination } from '../lib/rabbitmq/stomp.config';
import { RABBITMQ_ROUTING_KEYS } from '../lib/rabbitmq/message.types';
import createLoggerWithPrefix from '../lib/logger';

const logger = createLoggerWithPrefix('VerifyUnifiedMappings');

async function testUnifiedMappings() {
  logger.info('Starting unified queue-to-routing-key mappings verification...');

  try {
    // Test 1: Verify all standard queues have mappings
    const standardQueues = [
      'pdf-conversion-request',
      'pdf-analysis-request',
      'pdf-part-conversion-request',
      'pdf-merging-request',
      'markdown-storage-request',
      'markdown-part-storage-request',
      'chunking-embedding-request',
    ];

    logger.info('Test 1: Verifying standard queue mappings...');
    for (const queueName of standardQueues) {
      const hasMapping = hasRoutingKeyMapping(queueName);
      const routingKey = hasMapping
        ? getRoutingKeyForQueue(queueName)
        : 'NO MAPPING';

      logger.info(`Queue mapping check: ${queueName}`, {
        hasMapping,
        routingKey,
      });

      if (!hasMapping) {
        logger.error(`❌ Missing mapping for queue: ${queueName}`);
        throw new Error(`Missing mapping for queue: ${queueName}`);
      }
    }

    // Test 2: Verify STOMP destination generation
    logger.info('Test 2: Verifying STOMP destination generation...');
    for (const queueName of standardQueues) {
      const routingKey = getRoutingKeyForQueue(queueName);
      const stompDestination = getStompDestination(routingKey);
      const expectedDestination = `/exchange/pdf-conversion-exchange/${routingKey}`;

      logger.info(`STOMP destination check: ${queueName}`, {
        routingKey,
        stompDestination,
        expectedDestination,
        isCorrect: stompDestination === expectedDestination,
      });

      if (stompDestination !== expectedDestination) {
        logger.error(`❌ Incorrect STOMP destination for ${queueName}`);
        throw new Error(`Incorrect STOMP destination for ${queueName}`);
      }
    }

    // Test 3: Verify RABBITMQ_ROUTING_KEYS constants
    logger.info('Test 3: Verifying RABBITMQ_ROUTING_KEYS constants...');
    const keyChecks = [
      { queue: 'pdf-conversion-request', constant: 'PDF_CONVERSION_REQUEST' },
      { queue: 'pdf-analysis-request', constant: 'PDF_ANALYSIS_REQUEST' },
      {
        queue: 'pdf-part-conversion-request',
        constant: 'PDF_PART_CONVERSION_REQUEST',
      },
    ];

    for (const { queue, constant } of keyChecks) {
      const expectedRoutingKey = getRoutingKeyForQueue(queue);
      const actualRoutingKey =
        RABBITMQ_ROUTING_KEYS[constant as keyof typeof RABBITMQ_ROUTING_KEYS];

      logger.info(`Routing key constant check: ${constant}`, {
        queue,
        expectedRoutingKey,
        actualRoutingKey,
        isCorrect: actualRoutingKey === expectedRoutingKey,
      });

      if (actualRoutingKey !== expectedRoutingKey) {
        logger.error(`❌ Incorrect routing key constant for ${constant}`);
        throw new Error(`Incorrect routing key constant for ${constant}`);
      }
    }

    // Test 4: Verify consistency across all mappings
    logger.info('Test 4: Verifying mapping consistency...');
    const allQueues = getAllMappedQueueNames();
    logger.info(`Total mapped queues: ${allQueues.length}`);

    let inconsistencyCount = 0;
    for (const queueName of allQueues) {
      const routingKey = getRoutingKeyForQueue(queueName);
      const stompDestination = getStompDestination(routingKey);

      // Verify the routing key appears in the STOMP destination
      if (!stompDestination.includes(routingKey)) {
        logger.warn(`Potential inconsistency for queue: ${queueName}`, {
          routingKey,
          stompDestination,
        });
        inconsistencyCount++;
      }
    }

    if (inconsistencyCount > 0) {
      logger.warn(
        `Found ${inconsistencyCount} potential mapping inconsistencies`,
      );
    } else {
      logger.info('✅ All mappings are consistent');
    }

    logger.info(
      '✅ Unified queue-to-routing-key mappings verification completed successfully',
    );

    // Summary
    logger.info('Summary:', {
      totalQueuesMapped: allQueues.length,
      standardQueuesTested: standardQueues.length,
      inconsistenciesFound: inconsistencyCount,
    });
  } catch (error) {
    logger.error('❌ Unified mappings verification failed:', error);
    process.exit(1);
  }
}

// Run the test
testUnifiedMappings().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
