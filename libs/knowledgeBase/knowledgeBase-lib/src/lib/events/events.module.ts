import { Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import type { IEventBus } from './event-bus.interface';

@Module({
  providers: [
    EventBusService
  ],
  exports: [EventBusService],
})
export class EventsModule {}