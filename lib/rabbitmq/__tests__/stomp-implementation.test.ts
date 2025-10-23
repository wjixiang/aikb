import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StompImplementation } from '../stomp-implementation';
import { MessageProtocol } from '../message-service.interface';
import {
  PdfConversionRequestMessage,
  PdfConversionCompletedMessage,
  RABBITMQ_ROUTING_KEYS,
} from '../message.types';

describe('StompImplementation', () => {
  let stompService: StompImplementation;

  beforeEach(() => {
    // Create STOMP service instance with test configuration
    stompService = new StompImplementation();
  });

  afterEach(async () => {
    // Clean up after each test
    if (stompService.isConnected()) {
      await stompService.close();
    }
  });

  describe('Configuration', () => {
    it('should create service with correct protocol', () => {
      expect(stompService.getConnectionStatus()).toBe('disconnected');
    });

    it('should have default configuration values', () => {
      const service = new StompImplementation();
      expect(service.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('Connection Management', () => {
    it('should initialize connection status correctly', () => {
      expect(stompService.getConnectionStatus()).toBe('disconnected');
      expect(stompService.isConnected()).toBe(false);
    });

    it('should handle initialization failure gracefully', async () => {
      // Create service with invalid configuration by setting environment variables
      const originalBrokerUrl = process.env.STOMP_BROKER_URL;
      const originalLogin = process.env.STOMP_LOGIN;
      const originalPasscode = process.env.STOMP_PASSCODE;
      const originalMaxAttempts = process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
      const originalReconnectDelay = process.env.STOMP_RECONNECT_DELAY;

      // Set invalid configuration
      process.env.STOMP_BROKER_URL = 'ws://invalid-host:9999/ws';
      process.env.STOMP_LOGIN = 'invalid';
      process.env.STOMP_PASSCODE = 'invalid';
      process.env.STOMP_MAX_RECONNECT_ATTEMPTS = '1';
      process.env.STOMP_RECONNECT_DELAY = '100';

      const invalidService = new StompImplementation();

      // Restore environment variables after creating the service
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

      try {
        await invalidService.initialize();
        // If it doesn't throw, check connection status
        const status = invalidService.getConnectionStatus();
        expect(status === 'connecting' || status === 'disconnected').toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // After error, should be disconnected
        expect(invalidService.getConnectionStatus()).toBe('disconnected');
      }
    }, 15000); // Increase timeout to 15 seconds

    it('should properly reject connection with invalid URL', async () => {
      // Create service with clearly invalid URL by setting environment variables
      const originalBrokerUrl = process.env.STOMP_BROKER_URL;
      const originalLogin = process.env.STOMP_LOGIN;
      const originalPasscode = process.env.STOMP_PASSCODE;
      const originalMaxAttempts = process.env.STOMP_MAX_RECONNECT_ATTEMPTS;
      const originalReconnectDelay = process.env.STOMP_RECONNECT_DELAY;

      // Set invalid configuration
      process.env.STOMP_BROKER_URL = 'ws://nonexistent-host-12345:9999/ws';
      process.env.STOMP_LOGIN = 'guest';
      process.env.STOMP_PASSCODE = 'guest';
      process.env.STOMP_MAX_RECONNECT_ATTEMPTS = '0';
      process.env.STOMP_RECONNECT_DELAY = '100';

      const invalidService = new StompImplementation();

      // Restore environment variables after creating the service
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

      // Should definitely throw an error
      await expect(invalidService.initialize()).rejects.toThrow();

      // Should be disconnected after failed initialization
      expect(invalidService.getConnectionStatus()).toBe('disconnected');
      expect(invalidService.isConnected()).toBe(false);
    }, 15000);
  });

  describe('Health Check', () => {
    it('should return unhealthy status when not connected', async () => {
      const health = await stompService.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.details.connected).toBe(false);
      expect(health.details.protocol).toBe('stomp');
    });

    it('should include subscription count in health details', async () => {
      const health = await stompService.healthCheck();
      expect(health.details.subscriptionCount).toBeDefined();
      expect(health.details.subscriptionCount).toBe(0);
    });
  });

  describe.skip('Message Publishing', () => {
    // it('should throw error when publishing while not connected', async () => {
    //   const message: PdfConversionRequestMessage = {
    //     messageId: 'test-message-id',
    //     timestamp: Date.now(),
    //     eventType: 'PDF_CONVERSION_REQUEST',
    //     itemId: 'test-item-id',
    //     s3Key: 'test-s3-key',
    //     fileName: 'test-file.pdf',
    //     metadata: {
    //       title: 'Test Document',
    //       authors: [],
    //       tags: [],
    //       collections: [],
    //     },
    //   };
    //   await expect(
    //     stompService.publishMessage(RABBITMQ_ROUTING_KEYS.PDF_CONVERSION_REQUEST, message)
    //   ).rejects.toThrow('STOMP implementation not connected');
    // });
  });

  describe('Message Consumption', () => {
    it('should throw error when consuming while not connected', async () => {
      await expect(
        stompService.consumeMessages('test-destination', async () => {}),
      ).rejects.toThrow('STOMP implementation not connected');
    });

    it('should handle stopping consumption gracefully when not connected', async () => {
      // stopConsuming should not throw when not connected, it should just return
      await expect(
        stompService.stopConsuming('test-subscription-id'),
      ).resolves.not.toThrow();
    });
  });

  describe('Connection Status Tracking', () => {
    it('should track connection status changes', () => {
      expect(stompService.getConnectionStatus()).toBe('disconnected');

      // Status should change during initialization (but may not reach 'connected' in test)
      const initPromise = stompService.initialize();
      const status = stompService.getConnectionStatus();
      expect(status === 'connecting' || status === 'disconnected').toBe(true);

      // Clean up
      initPromise.catch(() => {}); // Ignore potential connection errors
    });
  });

  describe('Error Handling', () => {
    it('should handle close operation gracefully when not connected', async () => {
      await expect(stompService.close()).resolves.not.toThrow();
      expect(stompService.getConnectionStatus()).toBe('disconnected');
    });
  });
});

describe('STOMP Integration with Message Service Factory', () => {
  it('should be creatable through message service factory', async () => {
    const { createMessageService } = await import(
      '../message-service-factory.js'
    );

    const stompService = createMessageService(MessageProtocol.STOMP, {
      connectionOptions: {
        brokerURL: 'ws://localhost:15674/ws',
        connectHeaders: {
          login: 'guest',
          passcode: 'guest',
        },
      },
    });

    expect(stompService).toBeDefined();
    expect(stompService.getConnectionStatus()).toBe('disconnected');
    expect(stompService.isConnected()).toBe(false);
  });
});

describe('STOMP Configuration', () => {
  it('should provide valid default configuration', async () => {
    const { getValidatedStompConfig } = await import('../stomp.config.js');

    const config = getValidatedStompConfig('test');
    expect(config).toBeDefined();
    expect(config?.protocol).toBe('stomp');
    expect(config?.connectionOptions?.brokerURL).toBeDefined();
    expect(config?.connectionOptions?.connectHeaders?.login).toBeDefined();
    expect(config?.connectionOptions?.connectHeaders?.passcode).toBeDefined();
  });

  it('should validate configuration correctly', async () => {
    const { validateStompConfig } = await import('../stomp.config.js');

    const validConfig = {
      protocol: MessageProtocol.STOMP,
      connectionOptions: {
        brokerURL: 'ws://localhost:15674/ws',
        connectHeaders: {
          login: 'guest',
          passcode: 'guest',
        },
      },
    };

    expect(validateStompConfig(validConfig)).toBe(true);
  });

  it('should reject invalid configuration', async () => {
    const { validateStompConfig } = await import('../stomp.config.js');

    const invalidConfig = {
      protocol: MessageProtocol.STOMP,
      connectionOptions: {
        brokerURL: '',
        connectHeaders: {
          login: '',
          passcode: '',
        },
      },
    };

    expect(validateStompConfig(invalidConfig)).toBe(false);
  });
});
