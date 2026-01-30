import { Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import type { IEventBus } from './event-bus.interface';
import { EntityEventHandler } from '../handlers/entity-event.handler';

@Module({
  providers: [
    {
      provide: EventBusService,
      useFactory: () => new EventBusService(),
    },
    EntityEventHandler, // 添加事件处理器
  ],
  exports: [EventBusService],
})
export class EventsModule {}
