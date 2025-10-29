import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { RabbitMQMessageService } from './amqp-implementation';
import {
  BaseRabbitMQMessage,
  PdfConversionRequestMessage,
  RabbitMQMessageOptions,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS
} from '../message.types';
import { ConnectionStatus, HealthCheckResult, QueueInfo, ConsumerOptions } from '../message-service.interface';
import { getRabbitMQConfig } from '../rabbitmq.config';

// Use vi.hoisted to properly handle the hoisting issue
const { mockConnection, mockChannel } = vi.hoisted(() => {
  const mockConnection = {
    createChannel: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  const mockChannel = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    publish: vi.fn(),
    consume: vi.fn(),
    cancel: vi.fn(),
    checkQueue: vi.fn(),
    purgeQueue: vi.fn(),
    close: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return { mockConnection, mockChannel };
});

// Mock the entire amqplib module
vi.mock('amqplib', () => ({
  connect: vi.fn().mockResolvedValue(mockConnection),
}));

// Mock the logger
vi.mock('@aikb/log-management/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('RabbitMQMessageService - End-to-End Tests', () => {
  let rabbitMQService: RabbitMQMessageService;
  let testConfig: any;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.RABBITMQ_HOSTNAME = 'rabbitmq';
    process.env.RABBITMQ_PORT = '15762';
    process.env.RABBITMQ_USERNAME = 'testuser';
    process.env.RABBITMQ_PASSWORD = 'testpass';
    process.env.RABBITMQ_VHOST = 'test_vhost';
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

  beforeEach(() => {
    vi.clearAllMocks();
    
    testConfig = {
      hostname: 'rabbitmq',
      port: 15672,
      username: 'testuser',
      password: 'testpass',
      vhost: 'test_vhost',
      heartbeat: 60,
    };

    rabbitMQService = new RabbitMQMessageService(testConfig);
    
    // Setup default mock behaviors
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockChannel.assertExchange.mockResolvedValue({});
    mockChannel.assertQueue.mockResolvedValue({ queue: 'test-queue' });
    mockChannel.bindQueue.mockResolvedValue({});
    mockChannel.publish.mockReturnValue(true);
    mockChannel.consume.mockResolvedValue({ consumerTag: 'test-consumer-tag' });
    mockChannel.cancel.mockResolvedValue({});
    mockChannel.checkQueue.mockResolvedValue({
      messageCount: 0,
      consumerCount: 0,
    });
    mockChannel.purgeQueue.mockResolvedValue({});
  });

  afterEach(async () => {
    try {
      if (rabbitMQService.isConnected()) {
        await rabbitMQService.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  describe('Connection Lifecycle Tests', () => {
    it('should initialize connection and channel successfully', async () => {
      await rabbitMQService.initialize();

      const { connect } = await import('amqplib');
      expect(connect).toHaveBeenCalledWith(testConfig);
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertExchange).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalled();
      expect(mockChannel.bindQueue).toHaveBeenCalled();
      expect(rabbitMQService.isConnected()).toBe(true);
      expect(rabbitMQService.getConnectionStatus()).toBe('connected');
    });

    it('should handle initialization failure gracefully', async () => {
      const errorMessage = 'Connection failed';
      const { connect } = await import('amqplib');
      vi.mocked(connect).mockRejectedValueOnce(new Error(errorMessage));

      await expect(rabbitMQService.initialize()).rejects.toThrow(errorMessage);
      expect(rabbitMQService.isConnected()).toBe(false);
      expect(rabbitMQService.getConnectionStatus()).toBe('disconnected');
    });

    it('should close connection and cleanup resources properly', async () => {
      await rabbitMQService.initialize();
      expect(rabbitMQService.isConnected()).toBe(true);

      await rabbitMQService.close();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
      expect(rabbitMQService.isConnected()).toBe(false);
      expect(rabbitMQService.getConnectionStatus()).toBe('disconnected');
    });

    it('should handle close operation when not connected', async () => {
      // Should not throw error when closing an already closed connection
      await expect(rabbitMQService.close()).resolves.not.toThrow();
    });

    it('should handle connection errors during close', async () => {
      await rabbitMQService.initialize();
      
      const closeError = new Error('Close failed');
      mockChannel.close.mockRejectedValueOnce(closeError);

      await expect(rabbitMQService.close()).rejects.toThrow('Close failed');
    });

    it('should handle channel creation failure', async () => {
      mockConnection.createChannel.mockRejectedValueOnce(new Error('Channel creation failed'));

      await expect(rabbitMQService.initialize()).rejects.toThrow('Channel creation failed');
      expect(rabbitMQService.isConnected()).toBe(false);
    });
  });

  describe('Message Publishing and Consumption Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    });

    it('should publish and consume messages end-to-end', async () => {
      const testMessage: PdfConversionRequestMessage = {
        messageId: 'test-msg-123',
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'item-123',
        s3Key: 'test/file.pdf',
        fileName: 'test.pdf',
        metadata: {
          title: 'Test Document',
          authors: [{ firstName: 'John', lastName: 'Doe' }],
          tags: ['test'],
          collections: [],
        },
      };

      const routingKey = RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST;
      
      // Publish message
      const publishResult = await rabbitMQService.publishMessage(routingKey, testMessage);
      expect(publishResult).toBe(true);
      expect(mockChannel.publish).toHaveBeenCalledWith(
        'pdf-conversion-exchange',
        routingKey,
        Buffer.from(JSON.stringify(testMessage)),
        expect.objectContaining({
          persistent: true,
        })
      );

      // Setup consumer
      let receivedMessage: any = null;
      const onMessage = vi.fn().mockImplementation(async (message: any) => {
        receivedMessage = message;
      });

      const consumerTag = await rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        onMessage
      );

      expect(consumerTag).toMatch(/^consumer-/);
      expect(mockChannel.consume).toHaveBeenCalledWith(
        RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        expect.any(Function),
        expect.objectContaining({
          noAck: false,
          exclusive: false,
        })
      );

      // Simulate message reception
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      const mockConsumeMessage = {
        content: Buffer.from(JSON.stringify(testMessage)),
        fields: { deliveryTag: 1 },
      };

      await consumeCallback(mockConsumeMessage);

      expect(onMessage).toHaveBeenCalledWith(testMessage, mockConsumeMessage);
      expect(mockChannel.ack).toHaveBeenCalledWith(mockConsumeMessage);
      expect(receivedMessage).toEqual(testMessage);
    });

    it('should handle message publishing with custom options', async () => {
      const testMessage: BaseRabbitMQMessage = {
        messageId: 'test-msg-456',
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

      await rabbitMQService.publishMessage('test.routing.key', testMessage, options);

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'pdf-conversion-exchange',
        'test.routing.key',
        Buffer.from(JSON.stringify(testMessage)),
        expect.objectContaining({
          persistent: false,
          expiration: '60000',
          priority: 5,
          correlationId: 'corr-123',
          replyTo: 'reply-queue',
          headers: { 'custom-header': 'custom-value' },
        })
      );
    });

    it('should handle message processing errors and nack messages', async () => {
      const testMessage: BaseRabbitMQMessage = {
        messageId: 'test-msg-error',
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      const onMessage = vi.fn().mockRejectedValue(new Error('Processing failed'));

      await rabbitMQService.consumeMessages('test-queue', onMessage);

      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      const mockConsumeMessage = {
        content: Buffer.from(JSON.stringify(testMessage)),
        fields: { deliveryTag: 1 },
      };

      await consumeCallback(mockConsumeMessage);

      expect(onMessage).toHaveBeenCalled();
      expect(mockChannel.nack).toHaveBeenCalledWith(mockConsumeMessage, false, false);
    });

    it('should stop consuming messages properly', async () => {
      const onMessage = vi.fn();
      const consumerTag = await rabbitMQService.consumeMessages('test-queue', onMessage);

      await rabbitMQService.stopConsuming(consumerTag);

      expect(mockChannel.cancel).toHaveBeenCalledWith(consumerTag);
    });

    it('should handle publishing when not connected', async () => {
      await rabbitMQService.close();

      const testMessage: BaseRabbitMQMessage = {
        messageId: 'test-msg-disconnected',
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      await expect(
        rabbitMQService.publishMessage('test.routing.key', testMessage)
      ).rejects.toThrow('RabbitMQ service is not connected');
    });

    it('should handle consuming when not connected', async () => {
      await rabbitMQService.close();

      const onMessage = vi.fn();

      await expect(
        rabbitMQService.consumeMessages('test-queue', onMessage)
      ).rejects.toThrow('RabbitMQ service is not connected');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    });

    it('should handle malformed JSON messages', async () => {
      const onMessage = vi.fn();

      await rabbitMQService.consumeMessages('test-queue', onMessage);

      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      const mockConsumeMessage = {
        content: Buffer.from('invalid json'),
        fields: { deliveryTag: 1 },
      };

      await consumeCallback(mockConsumeMessage);

      expect(mockChannel.nack).toHaveBeenCalledWith(mockConsumeMessage, false, false);
    });

    it('should handle consumer options correctly', async () => {
      const onMessage = vi.fn();
      const options: ConsumerOptions = {
        consumerTag: 'custom-consumer',
        noAck: true,
        exclusive: true,
        priority: 10,
      };

      await rabbitMQService.consumeMessages('test-queue', onMessage, options);

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'test-queue',
        expect.any(Function),
        expect.objectContaining({
          consumerTag: 'custom-consumer',
          noAck: true,
          exclusive: true,
          priority: 10,
        })
      );
    });

    it('should handle publish failure', async () => {
      mockChannel.publish.mockReturnValueOnce(false);

      const testMessage: BaseRabbitMQMessage = {
        messageId: 'test-msg-fail',
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      const result = await rabbitMQService.publishMessage('test.routing.key', testMessage);
      expect(result).toBe(false);
    });

    it('should handle consume failure', async () => {
      mockChannel.consume.mockRejectedValueOnce(new Error('Consume failed'));

      const onMessage = vi.fn();

      await expect(
        rabbitMQService.consumeMessages('test-queue', onMessage)
      ).rejects.toThrow('Consume failed');
    });

    it('should handle stop consuming failure', async () => {
      mockChannel.cancel.mockRejectedValueOnce(new Error('Cancel failed'));

      await expect(
        rabbitMQService.stopConsuming('test-consumer')
      ).rejects.toThrow('Cancel failed');
    });
  });

  describe('Topology Setup and Queue Management Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    });

    it('should setup topology correctly', async () => {
      // The topology is already set up during initialization
      // Let's verify the correct calls were made
      expect(mockChannel.assertExchange).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalled();
      expect(mockChannel.bindQueue).toHaveBeenCalled();
    });

    it('should get queue information', async () => {
      const queueInfo = await rabbitMQService.getQueueInfo('test-queue');

      expect(mockChannel.checkQueue).toHaveBeenCalledWith('test-queue');
      expect(queueInfo).toEqual({
        messageCount: 0,
        consumerCount: 0,
      });
    });

    it('should handle queue info when queue does not exist', async () => {
      mockChannel.checkQueue.mockRejectedValueOnce(new Error('Queue not found'));

      const queueInfo = await rabbitMQService.getQueueInfo('non-existent-queue');
      expect(queueInfo).toBeNull();
    });

    it('should purge queue', async () => {
      await rabbitMQService.purgeQueue('test-queue');

      expect(mockChannel.purgeQueue).toHaveBeenCalledWith('test-queue');
    });

    it('should handle queue operations when not connected', async () => {
      await rabbitMQService.close();

      await expect(
        rabbitMQService.getQueueInfo('test-queue')
      ).rejects.toThrow('RabbitMQ service is not connected');

      await expect(
        rabbitMQService.purgeQueue('test-queue')
      ).rejects.toThrow('RabbitMQ service is not connected');
    });

    it('should handle topology setup when not connected', async () => {
      await rabbitMQService.close();

      await expect(
        rabbitMQService.setupTopology()
      ).rejects.toThrow('RabbitMQ service is not connected');
    });
  });

  describe('Health Check Functionality Tests', () => {
    it('should return healthy status when connected', async () => {
      await rabbitMQService.initialize();

      const healthResult = await rabbitMQService.healthCheck();

      expect(healthResult.status).toBe('healthy');
      expect(healthResult.details.connected).toBe(true);
      expect(healthResult.details.protocol).toBe('amqp');
    });

    it('should return unhealthy status when not connected', async () => {
      const healthResult = await rabbitMQService.healthCheck();

      expect(healthResult.status).toBe('unhealthy');
      expect(healthResult.details.connected).toBe(false);
    });

    it('should handle health check errors gracefully', async () => {
      await rabbitMQService.initialize();
      
      // Mock an error during health check
      const originalIsConnected = rabbitMQService.isConnected.bind(rabbitMQService);
      rabbitMQService.isConnected = vi.fn().mockImplementation(() => {
        throw new Error('Health check error');
      });

      const healthResult = await rabbitMQService.healthCheck();

      expect(healthResult.status).toBe('unhealthy');
      expect(healthResult.details.connected).toBe(false);
      expect(healthResult.details.error).toBe('Health check error');

      // Restore original method
      rabbitMQService.isConnected = originalIsConnected;
    });
  });

  describe('Concurrent Operations Tests', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    });

    it('should handle multiple concurrent publishers', async () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        messageId: `test-msg-${i}`,
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      }));

      const publishPromises = messages.map((message, index) =>
        rabbitMQService.publishMessage(`test.routing.${index}`, message)
      );

      const results = await Promise.all(publishPromises);

      expect(results).toHaveLength(10);
      results.forEach((result) => expect(result).toBe(true));
      expect(mockChannel.publish).toHaveBeenCalledTimes(10);
    });

    it('should handle multiple concurrent consumers', async () => {
      const consumerPromises = Array.from({ length: 5 }, (_, i) =>
        rabbitMQService.consumeMessages(`test-queue-${i}`, vi.fn())
      );

      const consumerTags = await Promise.all(consumerPromises);

      expect(consumerTags).toHaveLength(5);
      consumerTags.forEach((tag) => expect(tag).toMatch(/^consumer-/));
      expect(mockChannel.consume).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed concurrent operations', async () => {
      const testMessage: BaseRabbitMQMessage = {
        messageId: 'concurrent-test-msg',
        timestamp: Date.now(),
        eventType: 'TEST_EVENT',
      };

      // Start multiple operations concurrently
      const operations = [
        rabbitMQService.publishMessage('test.routing.1', testMessage),
        rabbitMQService.consumeMessages('test-queue-1', vi.fn()),
        rabbitMQService.getQueueInfo('test-queue-1'),
        rabbitMQService.healthCheck(),
        rabbitMQService.publishMessage('test.routing.2', { ...testMessage, messageId: 'msg-2' }),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    it('should handle consumer cleanup during concurrent operations', async () => {
      const consumerTags = await Promise.all([
        rabbitMQService.consumeMessages('test-queue-1', vi.fn()),
        rabbitMQService.consumeMessages('test-queue-2', vi.fn()),
        rabbitMQService.consumeMessages('test-queue-3', vi.fn()),
      ]);

      // Stop all consumers concurrently
      const stopPromises = consumerTags.map(tag =>
        rabbitMQService.stopConsuming(tag)
      );

      await expect(Promise.all(stopPromises)).resolves.not.toThrow();
      expect(mockChannel.cancel).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete PDF conversion workflow', async () => {
      await rabbitMQService.initialize();

      // 1. Publish PDF conversion request
      const conversionRequest: PdfConversionRequestMessage = {
        messageId: 'pdf-conv-123',
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'item-123',
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
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST,
        conversionRequest
      );
      expect(published).toBe(true);

      // 2. Simulate worker consuming the request
      let receivedRequest: any = null;
      const requestConsumer = vi.fn().mockImplementation(async (message: any) => {
        receivedRequest = message;
      });

      const requestConsumerTag = await rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_CONVERSION_REQUEST,
        requestConsumer
      );

      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      await consumeCallback({
        content: Buffer.from(JSON.stringify(conversionRequest)),
        fields: { deliveryTag: 1 },
      });

      expect(receivedRequest).toEqual(conversionRequest);

      // 3. Simulate worker publishing progress
      const progressMessage = {
        messageId: 'pdf-progress-123',
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_PROGRESS',
        itemId: 'item-123',
        status: 'processing' as const,
        progress: 50,
        message: 'Processing page 5 of 10',
      };

      const progressPublished = await rabbitMQService.publishMessage(
        RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_PROGRESS,
        progressMessage
      );
      expect(progressPublished).toBe(true);

      // 4. Simulate monitoring service consuming progress
      let receivedProgress: any = null;
      const progressConsumer = vi.fn().mockImplementation(async (message: any) => {
        receivedProgress = message;
      });

      const progressConsumerTag = await rabbitMQService.consumeMessages(
        RABBITMQ_QUEUES.PDF_CONVERSION_PROGRESS,
        progressConsumer
      );

      const progressConsumeCallback = mockChannel.consume.mock.calls[1][1];
      await progressConsumeCallback({
        content: Buffer.from(JSON.stringify(progressMessage)),
        fields: { deliveryTag: 2 },
      });

      expect(receivedProgress).toEqual(progressMessage);

      // 5. Cleanup
      await rabbitMQService.stopConsuming(requestConsumerTag);
      await rabbitMQService.stopConsuming(progressConsumerTag);
    });

    it('should handle connection recovery scenario', async () => {
      await rabbitMQService.initialize();
      expect(rabbitMQService.isConnected()).toBe(true);

      // Simulate connection loss
      rabbitMQService['connectionStatus'] = 'disconnected';
      rabbitMQService['connection'] = null;
      rabbitMQService['channel'] = null;

      expect(rabbitMQService.isConnected()).toBe(false);

      // Reinitialize
      await rabbitMQService.initialize();
      expect(rabbitMQService.isConnected()).toBe(true);
    });

    it('should handle high message volume scenario', async () => {
      await rabbitMQService.initialize();

      const messageCount = 100;
      const messages = Array.from({ length: messageCount }, (_, i) => ({
        messageId: `bulk-msg-${i}`,
        timestamp: Date.now(),
        eventType: 'BULK_TEST_EVENT',
        data: `Message data ${i}`,
      }));

      // Publish all messages
      const startTime = Date.now();
      const publishResults = await Promise.all(
        messages.map((message, index) =>
          rabbitMQService.publishMessage(`bulk.routing.${index}`, message)
        )
      );
      const publishTime = Date.now() - startTime;

      expect(publishResults).toHaveLength(messageCount);
      expect(publishResults.every(result => result === true)).toBe(true);
      expect(publishTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all messages were published
      expect(mockChannel.publish).toHaveBeenCalledTimes(messageCount);
    });
  });

  describe('Resource Management Tests', () => {
    it('should properly cleanup consumers on close', async () => {
      await rabbitMQService.initialize();

      // Create multiple consumers
      const consumerTags = await Promise.all([
        rabbitMQService.consumeMessages('queue-1', vi.fn()),
        rabbitMQService.consumeMessages('queue-2', vi.fn()),
        rabbitMQService.consumeMessages('queue-3', vi.fn()),
      ]);

      expect(consumerTags).toHaveLength(3);

      // Close the service
      await rabbitMQService.close();

      // Verify all consumers are cleaned up
      expect(rabbitMQService['consumers'].size).toBe(0);
    });

    it('should handle multiple initialize calls gracefully', async () => {
      await rabbitMQService.initialize();
      expect(rabbitMQService.isConnected()).toBe(true);

      // Try to initialize again
      await expect(rabbitMQService.initialize()).resolves.not.toThrow();
      expect(rabbitMQService.isConnected()).toBe(true);
    });

    it('should handle multiple close calls gracefully', async () => {
      await rabbitMQService.initialize();
      await rabbitMQService.close();

      // Try to close again
      await expect(rabbitMQService.close()).resolves.not.toThrow();
      expect(rabbitMQService.isConnected()).toBe(false);
    });
  });
});