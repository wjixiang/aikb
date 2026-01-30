import { Injectable, Logger } from '@nestjs/common';
import { EventBusInterfaces, EventTypes } from 'knowledgeBase-lib';
import { v4 as uuidv4 } from 'uuid';

// Extract the types we need from the namespace
type IEventBus = EventBusInterfaces.IEventBus;
type EventHandler<T extends EventTypes.KnowledgeEvent> =
  EventBusInterfaces.EventHandler<T>;
type EventSubscription = EventBusInterfaces.EventSubscription;
type KnowledgeEvent = EventTypes.KnowledgeEvent;

@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);
  private subscriptions = new Map<string, EventSubscription>();
  private handlersByEventType = new Map<string, EventSubscription[]>();

  async publish<T extends KnowledgeEvent>(event: T): Promise<void> {
    this.logger.log(`Publishing event: ${event.eventType}`);

    const eventHandlers = this.handlersByEventType.get(event.eventType) || [];

    for (const subscription of eventHandlers) {
      try {
        await subscription.handler(event);
      } catch (error) {
        this.logger.error(
          `Error handling event ${event.eventType}: ${error.message}`,
        );
      }
    }
  }

  async subscribe<T extends KnowledgeEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): Promise<string> {
    this.logger.log(`Subscribing to event: ${eventType}`);

    const subscriptionId = uuidv4();
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      handler: handler as EventHandler<KnowledgeEvent>,
      createdAt: new Date(),
    };

    this.subscriptions.set(subscriptionId, subscription);

    if (!this.handlersByEventType.has(eventType)) {
      this.handlersByEventType.set(eventType, []);
    }

    this.handlersByEventType.get(eventType)!.push(subscription);

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    this.logger.log(`Unsubscribing: ${subscriptionId}`);

    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);

      const eventHandlers = this.handlersByEventType.get(
        subscription.eventType,
      );
      if (eventHandlers) {
        const index = eventHandlers.findIndex((h) => h.id === subscriptionId);
        if (index > -1) {
          eventHandlers.splice(index, 1);
        }
      }
    }
  }

  async publishBatch(events: KnowledgeEvent[]): Promise<void> {
    this.logger.log(`Publishing batch of ${events.length} events`);

    for (const event of events) {
      await this.publish(event);
    }
  }

  getSubscriptionStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const [eventType, handlers] of this.handlersByEventType.entries()) {
      stats[eventType] = handlers.length;
    }

    return stats;
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  async clear(): Promise<void> {
    this.logger.log('Clearing all subscriptions');

    this.subscriptions.clear();
    this.handlersByEventType.clear();
  }
}
