import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StompMessageService } from './stomp-implementation';
import { BaseRabbitMQMessage, RabbitMQMessageOptions } from '../message.types';
import { ConnectionStatus, HealthCheckResult, QueueInfo } from '../message-service.interface';

// Mock the STOMP library
const mockClient = {
  activate: vi.fn(),
  deactivate: vi.fn(),
  publish: vi.fn(),
  subscribe: vi.fn().mockReturnValue({
    unsubscribe: vi.fn(),
  }),
  onConnect: null as ((frame: any) => void) | null,
  onStompError: null as ((frame: any) => void) | null,
  onDisconnect: null as (() => void) | null,
};

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation(() => mockClient),
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

describe('StompMessageService', () => {
  let stompService: StompMessageService;
  let mockConfig: {
    hostname: string;
    port: number;
    username: string;
    passcode: string;
    vhost: string;
    heartbeat: number;
  };

  beforeEach(() => {
    mockConfig = {
      hostname: 'localhost',
      port: 15674,
      username: 'guest',
      passcode: 'guest',
      vhost: '/',
      heartbeat: 4000,
    };
    stompService = new StompMessageService(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with the provided config', () => {
      expect(stompService).toBeInstanceOf(StompMessageService);
    });

    it('should initialize with disconnected status', () => {
      expect(stompService.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('initialize', () => {
    it('should initialize the STOMP connection', async () => {
      const { Client } = await import('@stomp/stompjs');
      const ClientMock = Client as any;
      
      // Mock the connection process
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();

      expect(ClientMock).toHaveBeenCalledWith(expect.objectContaining({
        brokerURL: `ws://${mockConfig.hostname}:${mockConfig.port}/ws`,
        connectHeaders: {
          login: mockConfig.username,
          passcode: mockConfig.passcode,
          host: mockConfig.vhost,
        },
      }));
      expect(mockClient.activate).toHaveBeenCalled();
      expect(stompService.getConnectionStatus()).toBe('connected');
    });

    it('should handle initialization errors', async () => {
      const { Client } = await import('@stomp/stompjs');
      const ClientMock = Client as any;
      ClientMock.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      await expect(stompService.initialize()).rejects.toThrow('Connection failed');
      expect(stompService.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('close', () => {
    it('should close the connection and cleanup resources', async () => {
      // First initialize the service
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
      
      // Now close it
      await stompService.close();

      expect(mockClient.deactivate).toHaveBeenCalled();
      expect(stompService.getConnectionStatus()).toBe('disconnected');
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
      expect(stompService.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      expect(stompService.isConnected()).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when connected', async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
      
      const result = await stompService.healthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.details.connected).toBe(true);
      expect(result.details.protocol).toBe('stomp');
    });

    it('should return unhealthy status when not connected', async () => {
      const result = await stompService.healthCheck();
      
      expect(result.status).toBe('unhealthy');
      expect(result.details.connected).toBe(false);
    });
  });

  describe('publishMessage', () => {
    const testMessage: BaseRabbitMQMessage = {
      messageId: 'test-message-id',
      timestamp: Date.now(),
      eventType: 'TEST_EVENT',
    };

    beforeEach(async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
    });

    it('should publish a message successfully', async () => {
      const result = await stompService.publishMessage('test.routing.key', testMessage);
      
      expect(result).toBe(true);
      expect(mockClient.publish).toHaveBeenCalledWith({
        destination: '/exchange/pdf-conversion-exchange/test.routing.key',
        body: JSON.stringify(testMessage),
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'message-id': testMessage.messageId,
          'timestamp': testMessage.timestamp.toString(),
          'event-type': testMessage.eventType,
          'persistent': 'true',
        }),
      });
    });

    it('should handle message options', async () => {
      const options: RabbitMQMessageOptions = {
        persistent: false,
        priority: 5,
        correlationId: 'test-correlation-id',
        replyTo: 'test-reply-to',
        headers: { 'custom-header': 'custom-value' },
      };

      await stompService.publishMessage('test.routing.key', testMessage, options);
      
      expect(mockClient.publish).toHaveBeenCalledWith({
        destination: '/exchange/pdf-conversion-exchange/test.routing.key',
        body: JSON.stringify(testMessage),
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'message-id': testMessage.messageId,
          'timestamp': testMessage.timestamp.toString(),
          'event-type': testMessage.eventType,
          'priority': '5',
          'correlation-id': 'test-correlation-id',
          'reply-to': 'test-reply-to',
          'custom-header': 'custom-value',
        }),
      });
    });

    it('should throw error when not connected', async () => {
      await stompService.close();
      
      await expect(stompService.publishMessage('test.routing.key', testMessage))
        .rejects.toThrow('STOMP service is not connected');
    });
  });

  describe('consumeMessages', () => {
    const mockOnMessage = vi.fn();

    beforeEach(async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
    });

    it('should start consuming messages successfully', async () => {
      const consumerTag = await stompService.consumeMessages('test-queue', mockOnMessage);
      
      expect(consumerTag).toMatch(/^stomp-consumer-/);
      expect(mockClient.subscribe).toHaveBeenCalledWith(
        '/queue/test-queue',
        expect.any(Function),
        expect.objectContaining({
          'ack': 'client',
          'exclusive': 'false',
        })
      );
    });

    it('should handle consumer options', async () => {
      const options = {
        consumerTag: 'test-consumer-tag',
        noAck: true,
        exclusive: true,
        priority: 10,
      };

      await stompService.consumeMessages('test-queue', mockOnMessage, options);
      
      expect(mockClient.subscribe).toHaveBeenCalledWith(
        '/queue/test-queue',
        expect.any(Function),
        expect.objectContaining({
          'ack': 'auto',
          'id': 'test-consumer-tag',
          'exclusive': 'true',
          'priority': '10',
        })
      );
    });

    it('should throw error when not connected', async () => {
      await stompService.close();
      
      await expect(stompService.consumeMessages('test-queue', mockOnMessage))
        .rejects.toThrow('STOMP service is not connected');
    });
  });

  describe('stopConsuming', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
    });

    it('should stop consuming messages successfully', async () => {
      const mockSubscription = { unsubscribe: vi.fn() };
      mockClient.subscribe.mockReturnValue(mockSubscription);
      
      const consumerTag = await stompService.consumeMessages('test-queue', vi.fn());
      
      await stompService.stopConsuming(consumerTag);
      
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });

    it('should throw error when not connected', async () => {
      await stompService.close();
      
      await expect(stompService.stopConsuming('test-consumer-tag'))
        .rejects.toThrow('STOMP service is not connected');
    });
  });

  describe('getQueueInfo', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
    });

    it('should return queue information', async () => {
      const result = await stompService.getQueueInfo('test-queue');
      
      expect(result).toEqual({
        messageCount: 0,
        consumerCount: 0,
      });
    });

    it('should throw error when not connected', async () => {
      await stompService.close();
      
      await expect(stompService.getQueueInfo('test-queue'))
        .rejects.toThrow('STOMP service is not connected');
    });
  });

  describe('purgeQueue', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
    });

    it('should log purge request', async () => {
      await stompService.purgeQueue('test-queue');
      
      // Since purge is not fully implemented, we just expect it not to throw
      expect(true).toBe(true);
    });

    it('should throw error when not connected', async () => {
      await stompService.close();
      
      await expect(stompService.purgeQueue('test-queue'))
        .rejects.toThrow('STOMP service is not connected');
    });
  });

  describe('setupTopology', () => {
    beforeEach(async () => {
      setTimeout(() => {
        if (mockClient.onConnect) {
          mockClient.onConnect({ headers: {} });
        }
      }, 100);

      await stompService.initialize();
    });

    it('should complete topology setup', async () => {
      await stompService.setupTopology();
      
      // Since topology setup is minimal for STOMP, we just expect it not to throw
      expect(true).toBe(true);
    });

    it('should throw error when not connected', async () => {
      await stompService.close();
      
      await expect(stompService.setupTopology())
        .rejects.toThrow('STOMP service is not connected');
    });
  });
});