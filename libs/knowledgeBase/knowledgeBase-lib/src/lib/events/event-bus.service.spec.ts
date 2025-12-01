import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import type { IEventBus } from './event-bus.interface';
import { KnowledgeEvent } from './types';

// Mock UUID module
let uuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `mock-uuid-${++uuidCounter}`)
}));

describe('EventBusService', () => {
  let eventBus: IEventBus;
  let testEvent: KnowledgeEvent;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EventBusService,
          useFactory: () => new EventBusService(),
        },
      ],
    }).compile();

    eventBus = module.get<IEventBus>(EventBusService);
    
    testEvent = {
      eventId: 'test-event-1',
      eventType: 'test.event',
      timestamp: new Date(),
      userId: 'test-user',
      sessionId: 'test-session'
    };
  });

  describe('publish', () => {
    it('should publish event successfully', async () => {
      let receivedEvent: KnowledgeEvent | null = null;
      
      const handler = async (event: KnowledgeEvent) => {
        receivedEvent = event;
      };

      await eventBus.subscribe('test.event', handler);
      await eventBus.publish(testEvent);

      expect(receivedEvent).toEqual(testEvent);
    });

    it('should handle multiple handlers for same event type', async () => {
      const receivedEvents: KnowledgeEvent[] = [];
      
      const handler1 = async (event: KnowledgeEvent) => {
        receivedEvents.push(event);
      };
      
      const handler2 = async (Event: KnowledgeEvent) => {
        receivedEvents.push(Event);
      };

      await eventBus.subscribe('test.event', handler1);
      await eventBus.subscribe('test.event', handler2);
      await eventBus.publish(testEvent);

      expect(receivedEvents).toHaveLength(2);
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventBus.subscribe('test.event', errorHandler);
      
      // Create a new EventBusService with retry disabled for this test
      const eventBusNoRetry = new EventBusService({ enableRetry: false });
      await eventBusNoRetry.subscribe('test.event', errorHandler);
      
      try {
        await eventBusNoRetry.publish(testEvent);
      } catch (error) {
        // Expected to throw
      }

      expect(errorHandler).toHaveBeenCalledWith(testEvent);
      consoleSpy.mockRestore();
    });
  });

  describe('subscribe', () => {
    it('should return subscription ID', async () => {
      const handler = async () => {};
      
      const subscriptionId = await eventBus.subscribe('test.event', handler);
      
      expect(subscriptionId).toBeDefined();
      expect(typeof subscriptionId).toBe('string');
    });

    it('should add handler to correct event type', async () => {
      const handler = async () => {};
      
      await eventBus.subscribe('test.event', handler);
      
      const stats = eventBus.getSubscriptionStats();
      expect(stats['test.event']).toBe(1);
    });
  });

  describe('unsubscribe', () => {
    it('should remove handler correctly', async () => {
      const handler = async () => {};
      
      const subscriptionId = await eventBus.subscribe('test.event', handler);
      expect(eventBus.getSubscriptionStats()['test.event']).toBe(1);
      
      await eventBus.unsubscribe(subscriptionId);
      expect(eventBus.getSubscriptionStats()['test.event']).toBe(0);
    });

    it('should handle non-existent subscription gracefully', async () => {
      // Create a new EventBusService to test the unsubscribe method directly
      const testEventBus = new EventBusService();
      const loggerSpy = jest.spyOn(testEventBus['logger'], 'warn').mockImplementation();
      
      await testEventBus.unsubscribe('non-existent-id');
      
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Subscription non-existent-id not found')
      );
      loggerSpy.mockRestore();
    });
  });

  describe('publishBatch', () => {
    it('should publish multiple events', async () => {
      const events: KnowledgeEvent[] = [
        { ...testEvent, eventId: 'test-event-1', eventType: 'test.event1' },
        { ...testEvent, eventId: 'test-event-2', eventType: 'test.event2' },
        { ...testEvent, eventId: 'test-event-3', eventType: 'test.event3' }
      ];

      const receivedEvents: KnowledgeEvent[] = [];
      
      events.forEach(event => {
        eventBus.subscribe(event.eventType, async (e) => {
          receivedEvents.push(e);
        });
      });

      await eventBus.publishBatch(events);

      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents.map(e => e.eventId)).toEqual(
        expect.arrayContaining(['test-event-1', 'test-event-2', 'test-event-3'])
      );
    });

    it('should handle empty batch gracefully', async () => {
      await expect(eventBus.publishBatch([])).resolves.toBeUndefined();
    });
  });

  describe('getSubscriptionStats', () => {
    it('should return correct statistics', async () => {
      const handler1 = async () => {};
      const handler2 = async () => {};
      
      await eventBus.subscribe('test.event1', handler1);
      await eventBus.subscribe('test.event2', handler2);
      await eventBus.subscribe('test.event1', handler2); // 同一事件类型，多个处理器
      
      const stats = eventBus.getSubscriptionStats();
      
      expect(stats).toEqual({
        'test.event1': 2,
        'test.event2': 1
      });
    });
  });

  describe('getSubscriptions', () => {
    it('should return all subscriptions', async () => {
      const handler1 = async () => {};
      const handler2 = async () => {};
      
      const subscriptionId1 = await eventBus.subscribe('test.event1', handler1);
      const subscriptionId2 = await eventBus.subscribe('test.event2', handler2);
      
      const subscriptions = eventBus.getSubscriptions();
      
      expect(subscriptions).toHaveLength(2);
      expect(subscriptions.map(s => s.id)).toEqual(
        expect.arrayContaining([subscriptionId1, subscriptionId2])
      );
    });
  });

  describe('clear', () => {
    it('should clear all subscriptions', async () => {
      const handler1 = async () => {};
      const handler2 = async () => {};
      
      await eventBus.subscribe('test.event1', handler1);
      await eventBus.subscribe('test.event2', handler2);
      expect(eventBus.getSubscriptionStats()['test.event1']).toBe(1);
      expect(eventBus.getSubscriptionStats()['test.event2']).toBe(1);
      
      await eventBus.clear();
      
      const stats = eventBus.getSubscriptionStats();
      expect(Object.keys(stats)).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should continue processing other handlers when one fails', async () => {
      const results: string[] = [];
      
      const successHandler = async () => {
        results.push('success');
      };
      
      const errorHandler = async () => {
        throw new Error('Handler error');
      };
      
      // Create a new EventBusService with retry disabled for this test
      const eventBusNoRetry = new EventBusService({ enableRetry: false });
      await eventBusNoRetry.subscribe('test.event', successHandler);
      await eventBusNoRetry.subscribe('test.event', errorHandler);
      
      await eventBusNoRetry.publish(testEvent);
      
      // 等待异步处理完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(results).toContain('success');
    });
  });

  describe('concurrent processing', () => {
    it('should limit concurrent handlers', async () => {
      const eventBus = new EventBusService({ maxConcurrentHandlers: 2, enableRetry: false });
      let activeCount = 0;
      let maxActiveCount = 0;
      
      const slowHandler = async () => {
        activeCount++;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await new Promise(resolve => setTimeout(resolve, 50));
        activeCount--;
      };
      
      // 注册4个处理器
      for (let i = 0; i < 4; i++) {
        await eventBus.subscribe('test.event', slowHandler);
      }
      
      await eventBus.publish(testEvent);
      
      // 等待处理完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 由于限制为2，最多应该有2个并发处理器
      expect(maxActiveCount).toBeLessThanOrEqual(2);
    });
  });
});