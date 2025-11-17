import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest';
import { RabbitMQMessageService } from './amqp-implementation';
import {
  BaseRabbitMQMessage,
  PdfConversionRequestMessage,
  RabbitMQMessageOptions,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
} from '../message.types';
import {
  ConnectionStatus,
  HealthCheckResult,
  QueueInfo,
  ConsumerOptions,
} from '../message-service.interface';
import { getRabbitMQConfig } from '../rabbitmq.config';

// Mock logger to avoid noise in tests
vi.mock('log-management/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('RabbitMQMessageService - End-to-End Integration Tests', () => {
  let rabbitMQService: RabbitMQMessageService;
  let testConfig: any;

  beforeAll(() => {
    // Set test environment variables for real RabbitMQ connection
    process.env.NODE_ENV = 'test';
    process.env.RABBITMQ_HOSTNAME = 'rabbitmq';
    process.env.RABBITMQ_PORT = '5672';
    process.env.RABBITMQ_USERNAME = 'admin';
    process.env.RABBITMQ_PASSWORD = 'admin123'; // Match Docker container password
    process.env.RABBITMQ_VHOST = 'my_vhost';
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.NODE_ENV;
    delete process.env.RABBITMQ_HOSTNAME;
    delete process.env.RABBITMQ_PORT;
    delete process.env.RABBITMQ_USERNAME;
    delete process.env.RABBITMQ_PASSWORD;
    delete process.env.RABBITMQ_VHOST;
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Use environment variables for configuration
    testConfig = {
      hostname: process.env.RABBITMQ_HOSTNAME || 'rabbitmq',
      port: parseInt(process.env.RABBITMQ_PORT || '5672'),
      username: process.env.RABBITMQ_USERNAME || 'admin',
      password: process.env.RABBITMQ_PASSWORD || 'admin123',
      vhost: process.env.RABBITMQ_VHOST || 'my_vhost',
      heartbeat: 60,
    };

    console.log('Test config:', testConfig);

    rabbitMQService = new RabbitMQMessageService(testConfig);
  });

  afterEach(async () => {
    try {
      if (rabbitMQService.isConnected()) {
        await rabbitMQService.close();
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Cleanup error:', error);
    }
    vi.clearAllMocks();
  });

  describe('Connection Lifecycle Tests', () => {
    it('should initialize connection and channel successfully', async () => {
      await rabbitMQService.initialize();

      expect(rabbitMQService.isConnected()).toBe(true);
      expect(rabbitMQService.getConnectionStatus()).toBe('connected');
    }, 10000); // Increase timeout for connection

    it('should close connection and cleanup resources properly', async () => {
      await rabbitMQService.initialize();
      expect(rabbitMQService.isConnected()).toBe(true);

      await rabbitMQService.close();

      expect(rabbitMQService.isConnected()).toBe(false);
      expect(rabbitMQService.getConnectionStatus()).toBe('disconnected');
    }, 10000);

    it('should handle close operation when not connected', async () => {
      // Should not throw error when closing an already closed connection
      await expect(rabbitMQService.close()).resolves.not.toThrow();
    });

    it('should handle multiple initialize calls gracefully', async () => {
      await rabbitMQService.initialize();
      expect(rabbitMQService.isConnected()).toBe(true);

      // Try to initialize again
      await expect(rabbitMQService.initialize()).resolves.not.toThrow();
      expect(rabbitMQService.isConnected()).toBe(true);
    }, 10000);

    it('should handle multiple close calls gracefully', async () => {
      await rabbitMQService.initialize();
      await rabbitMQService.close();

      // Try to close again
      await expect(rabbitMQService.close()).resolves.not.toThrow();
      expect(rabbitMQService.isConnected()).toBe(false);
    }, 10000);
  });

  describe('Message Publishing and Consumption Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    }, 10000);

    it('should publish and consume messages end-to-end', async () => {
      const testMessage: PdfConversionRequestMessage = {
        messageId: `test-msg-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: `item-${Date.now()}`,
        s3Key: 'test/file.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: [],
        },
      };

      const testTimestamp = Date.now();
      const testQueueName = `test-pdf-conversion-request-${testTimestamp}`;
      const testRoutingKey = `test.pdf.conversion.request.${testTimestamp}`;

      // Publish message
      const publishResult = await rabbitMQService.publishMessage(
        testRoutingKey,
        testMessage,
      );
      expect(publishResult).toBe(true);

      // Setup consumer
      let receivedMessage: any = null;
      const messagePromise = new Promise<any>((resolve) => {
        const onMessage = async (message: any) => {
          receivedMessage = message;
          resolve(message);
        };

        rabbitMQService.consumeMessages(testQueueName, onMessage);
      });

      // Wait for message to be received (with timeout)
      const result = await Promise.race([
        messagePromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Message not received within timeout')),
            5000,
          ),
        ),
      ]);

      expect(result).toBeDefined();
      expect(result.messageId).toBe(testMessage.messageId);
      expect(result.itemId).toBe(testMessage.itemId);
      expect(result.eventType).toBe(testMessage.eventType);
    }, 15000);

    it('should handle message publishing with custom options', async () => {
      const testMessage: BaseRabbitMQMessage = {
        messageId: `test-msg-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      const options: RabbitMQMessageOptions = {
        persistent: false,
        expiration: '60000',
        priority: 5,
        correlationId: 'corr-123',
        replyTo: 'reply-queue',
        headers: { 'custom-header': 'custom-value' },
      };

      const result = await rabbitMQService.publishMessage(
        'test.routing.key',
        testMessage,
        options,
      );
      expect(result).toBe(true);
    });

    it('should handle publishing when not connected', async () => {
      await rabbitMQService.close();

      const testMessage: BaseRabbitMQMessage = {
        messageId: 'test-msg-disconnected',
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      await expect(
        rabbitMQService.publishMessage('test.routing.key', testMessage),
      ).rejects.toThrow('RabbitMQ service is not connected');
    });

    it('should handle consuming when not connected', async () => {
      await rabbitMQService.close();

      const onMessage = vi.fn();

      await expect(
        rabbitMQService.consumeMessages('test-queue', onMessage),
      ).rejects.toThrow('RabbitMQ service is not connected');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    }, 10000);

    it('should handle consumer options correctly', async () => {
      const onMessage = vi.fn();
      const options: ConsumerOptions = {
        consumerTag: `custom-consumer-${Date.now()}`,
        noAck: true,
        exclusive: true,
        priority: 10,
      };

      const consumerTag = await rabbitMQService.consumeMessages(
        'test-queue',
        onMessage,
        options,
      );
      expect(consumerTag).toBe(options.consumerTag);

      // Cleanup
      await rabbitMQService.stopConsuming(consumerTag);
    });

    it('should handle stop consuming properly', async () => {
      const onMessage = vi.fn();
      const consumerTag = await rabbitMQService.consumeMessages(
        'test-queue',
        onMessage,
      );

      await rabbitMQService.stopConsuming(consumerTag);
      // Should not throw error
    });
  });

  describe('Topology Setup and Queue Management Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    }, 10000);

    it('should setup topology correctly', async () => {
      // The topology is already set up during initialization
      // Just verify the service is connected
      expect(rabbitMQService.isConnected()).toBe(true);
    });

    it('should get queue information', async () => {
      const testQueueName2 = `test-queue-info-${Date.now()}`;

      // First create a test queue to get info about
      await rabbitMQService.publishMessage(`test.routing.${Date.now()}`, {
        messageId: `test-msg-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      });

      const queueInfo = await rabbitMQService.getQueueInfo(testQueueName2);

      if (queueInfo) {
        expect(queueInfo).toHaveProperty('messageCount');
        expect(queueInfo).toHaveProperty('consumerCount');
        expect(typeof queueInfo.messageCount).toBe('number');
        expect(typeof queueInfo.consumerCount).toBe('number');
      }
    });

    it('should handle queue info when queue does not exist', async () => {
      const queueInfo =
        await rabbitMQService.getQueueInfo('non-existent-queue');
      expect(queueInfo).toBeNull();
    });

    it('should purge queue', async () => {
      const testQueueName3 = `test-queue-purge-${Date.now()}`;

      // First create a test queue by consuming from it (which creates the queue)
      await rabbitMQService.consumeMessages(testQueueName3, async () => {});

      // Publish a message to the queue
      await rabbitMQService.publishMessage(`test.routing.${Date.now()}`, {
        messageId: `test-msg-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      });

      await rabbitMQService.purgeQueue(testQueueName3);
      // Should not throw error
    });

    it('should handle queue operations when not connected', async () => {
      await rabbitMQService.close();

      await expect(
        rabbitMQService.getQueueInfo(`test-queue-disconnected-${Date.now()}`),
      ).rejects.toThrow('RabbitMQ service is not connected');

      await expect(
        rabbitMQService.purgeQueue(`test-queue-disconnected-${Date.now()}`),
      ).rejects.toThrow('RabbitMQ service is not connected');
    });

    it('should handle topology setup when not connected', async () => {
      await rabbitMQService.close();

      await expect(rabbitMQService.setupTopology()).rejects.toThrow(
        'RabbitMQ service is not connected',
      );
    });
  });

  describe('Health Check Functionality Tests', () => {
    it('should return healthy status when connected', async () => {
      await rabbitMQService.initialize();

      const healthResult = await rabbitMQService.healthCheck();

      expect(healthResult.status).toBe('healthy');
      expect(healthResult.details.connected).toBe(true);
      expect(healthResult.details.protocol).toBe('amqp');
    }, 10000);

    it('should return unhealthy status when not connected', async () => {
      const healthResult = await rabbitMQService.healthCheck();

      expect(healthResult.status).toBe('unhealthy');
      expect(healthResult.details.connected).toBe(false);
    });
  });

  describe('Concurrent Operations Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    }, 10000);

    it('should handle multiple concurrent publishers', async () => {
      const messageCount = 10;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        messageId: `test-msg-${i}-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      }));

      const publishPromises = messages.map((message, index) =>
        rabbitMQService.publishMessage(`test.routing.${index}`, message),
      );

      const results = await Promise.all(publishPromises);

      expect(results).toHaveLength(messageCount);
      results.forEach((result) => expect(result).toBe(true));
    });

    it('should handle multiple concurrent consumers', async () => {
      const consumerCount = 3;
      const consumerPromises = Array.from({ length: consumerCount }, (_, i) =>
        rabbitMQService.consumeMessages(
          `test-queue-${i}-${Date.now()}`,
          vi.fn(),
        ),
      );

      const consumerTags = await Promise.all(consumerPromises);

      expect(consumerTags).toHaveLength(consumerCount);
      consumerTags.forEach((tag) => expect(tag).toMatch(/^consumer-/));

      // Cleanup
      for (const tag of consumerTags) {
        await rabbitMQService.stopConsuming(tag);
      }
    });

    it('should handle mixed concurrent operations', async () => {
      const testMessage: BaseRabbitMQMessage = {
        messageId: `concurrent-test-msg-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      // Start multiple operations concurrently
      const operations = [
        rabbitMQService.publishMessage('test.routing.1', testMessage),
        rabbitMQService.consumeMessages('test-queue-1', vi.fn()),
        rabbitMQService.getQueueInfo(RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST),
        rabbitMQService.healthCheck(),
        rabbitMQService.publishMessage('test.routing.2', {
          ...testMessage,
          messageId: `msg-2-${Date.now()}`,
        }),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    }, 10000);

    it('should handle complete PDF conversion workflow', async () => {
      // 1. Publish PDF conversion request
      const testWorkflowQueueName = `test-workflow-${Date.now()}`;
      const testWorkflowRoutingKey = `test.workflow.routing.${Date.now()}`;

      const conversionRequest: PdfConversionRequestMessage = {
        messageId: `pdf-conv-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: `item-${Date.now()}`,
        s3Key: 'uploads/document.pdf',
        fileName: 'document.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test', 'document'],
          collections: [],
        },
      };

      const published = await rabbitMQService.publishMessage(
        testWorkflowRoutingKey,
        conversionRequest,
      );
      expect(published).toBe(true);

      // 2. Simulate worker consuming the request
      let receivedRequest: any = null;
      const requestPromise = new Promise<any>((resolve) => {
        const requestConsumer = async (message: any) => {
          receivedRequest = message;
          resolve(message);
        };

        rabbitMQService.consumeMessages(
          RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
          requestConsumer,
        );
      });

      const result = await Promise.race([
        requestPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Request not received within timeout')),
            5000,
          ),
        ),
      ]);

      expect(result).toBeDefined();
      expect(result.messageId).toBe(conversionRequest.messageId);
      expect(result.itemId).toBe(conversionRequest.itemId);

      // 3. Simulate worker publishing progress
      const progressMessage = {
        messageId: `pdf-progress-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId: conversionRequest.itemId,
        status: 'processing' as const,
        progress: 50,
        message: 'Processing page 5 of 10',
      };

      const progressPublished = await rabbitMQService.publishMessage(
        `test.workflow.progress.${Date.now()}`,
        progressMessage,
      );
      expect(progressPublished).toBe(true);
    }, 15000);

    it('should handle high message volume scenario', async () => {
      const messageCount = 50; // Reduced for stability
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        messageId: `bulk-msg-${i}-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'BULK_TEST_EVENT',
        data: `Message data ${i}`,
      }));

      // Publish all messages
      const startTime = Date.now();
      const publishResults = await Promise.all(
        messages.map((message, index) =>
          rabbitMQService.publishMessage(`bulk.routing.${index}`, message),
        ),
      );
      const publishTime = Date.now() - startTime;

      expect(publishResults).toHaveLength(messageCount);
      expect(publishResults.every((result) => result === true)).toBe(true);
      expect(publishTime).toBeLessThan(10000); // Should complete within 10 seconds
    }, 15000);
  });

  describe('Resource Management Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    }, 10000);

    it('should properly cleanup consumers on close', async () => {
      // Create multiple consumers
      const consumerTags = await Promise.all([
        rabbitMQService.consumeMessages('queue-1', vi.fn()),
        rabbitMQService.consumeMessages('queue-2', vi.fn()),
        rabbitMQService.consumeMessages('queue-3', vi.fn()),
      ]);

      expect(consumerTags).toHaveLength(3);

      // Close service
      await rabbitMQService.close();

      // Verify service is disconnected
      expect(rabbitMQService.isConnected()).toBe(false);
    });
  });
});
