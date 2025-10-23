import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StompImplementation } from '../stomp-implementation';
import { MessageProtocol } from '../message-service.interface';
import {
  PdfConversionRequestMessage,
  RABBITMQ_ROUTING_KEYS,
} from '../message.types';
import { getValidatedStompConfig } from '../stomp.config';

describe('STOMP Integration Tests', () => {
  let stompService: StompImplementation;
  let isRabbitMQAvailable = false;

  beforeAll(async () => {
    // Check if RabbitMQ STOMP is available by trying to get config
    try {
      const config = getValidatedStompConfig('test');
      if (config && config.connectionOptions?.brokerURL) {
        // Test basic connectivity with a short timeout
        const testService = new StompImplementation();

        try {
          await testService.initialize();
          isRabbitMQAvailable = true;
          await testService.close();
        } catch (error) {
          console.log(
            'RabbitMQ STOMP not available for integration tests:',
            error.message,
          );
          isRabbitMQAvailable = false;
        }
      }
    } catch (error) {
      console.log('STOMP configuration not available:', error.message);
      isRabbitMQAvailable = false;
    }
  });

  beforeEach(() => {
    if (isRabbitMQAvailable) {
      // Set test environment variables
      const originalEnv = process.env.NODE_ENV;
      const originalMaxAttempts = process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
      const originalReconnectDelay = process.env.STOMP_RECONNECT_DELAY;

      process.env.NODE_ENV = 'test';
      process.env.STOMP_MAX_RECONNECT_ATTEMPTS = '2';
      process.env.STOMP_RECONNECT_DELAY = '1000';

      stompService = new StompImplementation();

      // Restore environment variables
      if (originalEnv) {
        process.env.NODE_ENV = originalEnv;
      } else {
        delete process.env.NODE_ENV;
      }
      if (originalMaxAttempts) {
        process.env.STOMP_MAX_RECONNECT_ATTEMPTS = originalMaxAttempts;
      } else {
        delete process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
      }
      if (originalReconnectDelay) {
        process.env.STOMP_RECONNECT_DELAY = originalReconnectDelay;
      } else {
        delete process.env.STOMP_RECONNECT_DELAY;
      }
    }
  });

  afterEach(async () => {
    if (stompService && stompService.isConnected()) {
      await stompService.close();
    }
  });

  describe('Real STOMP Connection', () => {
    it('should connect to RabbitMQ with valid configuration', async () => {
      if (!isRabbitMQAvailable) {
        console.log('Skipping test: RabbitMQ STOMP not available');
        return;
      }

      expect(stompService.getConnectionStatus()).toBe('disconnected');

      await stompService.initialize();

      expect(stompService.isConnected()).toBe(true);
      expect(stompService.getConnectionStatus()).toBe('connected');
    }, 10000);

    it('should publish and consume messages successfully', async () => {
      if (!isRabbitMQAvailable) {
        console.log('Skipping test: RabbitMQ STOMP not available');
        return;
      }

      await stompService.initialize();
      expect(stompService.isConnected()).toBe(true);

      // Create a test message
      const testMessage: PdfConversionRequestMessage = {
        messageId: `test-${Date.now()}`,
        timestamp: Date.now(),
        eventType: 'PDF_CONVERSION_REQUEST',
        itemId: 'test-item-id',
        s3Key: 'test-s3-key',
        fileName: 'test-file.pdf',
        metadata: {
          title: 'Test Document',
          authors: [],
          tags: [],
          collections: [],
        },
      };

      // Subscribe to a test destination
      let receivedMessage: any = null;
      const subscriptionId = await stompService.consumeMessages(
        '/queue/test-stomp-integration',
        async (message) => {
          receivedMessage = message;
        },
        {
          consumerTag: `test-consumer-${Date.now()}`,
        },
      );

      expect(subscriptionId).toBeDefined();

      // Publish the message
      const published = await stompService.publishMessage(
        '/queue/test-stomp-integration',
        testMessage,
      );

      expect(published).toBe(true);

      // Wait for message to be received
      let attempts = 0;
      while (!receivedMessage && attempts < 10) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
      }

      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.messageId).toBe(testMessage.messageId);
      expect(receivedMessage.eventType).toBe(testMessage.eventType);

      // Stop consuming
      await stompService.stopConsuming(subscriptionId);
    }, 15000);

    it('should handle health check correctly when connected', async () => {
      if (!isRabbitMQAvailable) {
        console.log('Skipping test: RabbitMQ STOMP not available');
        return;
      }

      await stompService.initialize();
      expect(stompService.isConnected()).toBe(true);

      const health = await stompService.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.connected).toBe(true);
      expect(health.details.protocol).toBe('stomp');
      expect(health.details.subscriptionCount).toBeGreaterThanOrEqual(0);
    }, 10000);

    it('should disconnect and reconnect properly', async () => {
      if (!isRabbitMQAvailable) {
        console.log('Skipping test: RabbitMQ STOMP not available');
        return;
      }

      await stompService.initialize();
      expect(stompService.isConnected()).toBe(true);

      // Close connection
      await stompService.close();
      expect(stompService.isConnected()).toBe(false);
      expect(stompService.getConnectionStatus()).toBe('disconnected');

      // Reconnect
      await stompService.initialize();
      expect(stompService.isConnected()).toBe(true);
      expect(stompService.getConnectionStatus()).toBe('connected');
    }, 15000);
  });

  describe('Environment Variable Configuration', () => {
    it('should use environment variables for configuration', async () => {
      // Test that the configuration respects environment variables
      const originalBrokerUrl = process.env.STOMP_BROKER_URL;
      const originalLogin = process.env.STOMP_LOGIN;
      const originalPasscode = process.env.STOMP_PASSCODE;

      try {
        // Set test environment variables
        process.env.STOMP_BROKER_URL = 'ws://test-host:15674/ws';
        process.env.STOMP_LOGIN = 'testuser';
        process.env.STOMP_PASSCODE = 'testpass';

        // Import the config again to pick up new env vars
        const { getValidatedStompConfig } = await import('../stomp.config.js');
        const config = getValidatedStompConfig('test');

        expect(config?.connectionOptions?.brokerURL).toBe(
          'ws://test-host:15674/ws',
        );
        expect(config?.connectionOptions?.connectHeaders?.login).toBe(
          'testuser',
        );
        expect(config?.connectionOptions?.connectHeaders?.passcode).toBe(
          'testpass',
        );
      } finally {
        // Restore original environment variables
        if (originalBrokerUrl) {
          process.env.STOMP_BROKER_URL = originalBrokerUrl;
        } else {
          delete process.env.STOMP_BROKER_URL;
        }
        if (originalLogin) {
          process.env.STOMP_LOGIN = originalLogin;
        } else {
          delete process.env.STOMP_LOGIN;
        }
        if (originalPasscode) {
          process.env.STOMP_PASSCODE = originalPasscode;
        } else {
          delete process.env.STOMP_PASSCODE;
        }
      }
    });

    it('should fail to connect with invalid environment variables', async () => {
      // Set invalid environment variables
      const originalBrokerUrl = process.env.STOMP_BROKER_URL;
      const originalLogin = process.env.STOMP_LOGIN;
      const originalPasscode = process.env.STOMP_PASSCODE;

      try {
        // Set invalid environment variables
        process.env.STOMP_BROKER_URL = 'ws://invalid-host:9999/ws';
        process.env.STOMP_LOGIN = 'invalid';
        process.env.STOMP_PASSCODE = 'invalid';

        // Create service with invalid config
        // Set additional environment variables for this test
        process.env.STOMP_MAX_RECONNECT_ATTEMPTS = '0';
        process.env.STOMP_RECONNECT_DELAY = '100';

        const invalidService = new StompImplementation();

        // Clean up additional environment variables
        delete process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
        delete process.env.STOMP_RECONNECT_DELAY;

        // Should fail to connect
        await expect(invalidService.initialize()).rejects.toThrow();
        expect(invalidService.getConnectionStatus()).toBe('disconnected');
      } finally {
        // Restore original environment variables
        if (originalBrokerUrl) {
          process.env.STOMP_BROKER_URL = originalBrokerUrl;
        } else {
          delete process.env.STOMP_BROKER_URL;
        }
        if (originalLogin) {
          process.env.STOMP_LOGIN = originalLogin;
        } else {
          delete process.env.STOMP_LOGIN;
        }
        if (originalPasscode) {
          process.env.STOMP_PASSCODE = originalPasscode;
        } else {
          delete process.env.STOMP_PASSCODE;
        }
      }
    }, 10000);
  });
});
