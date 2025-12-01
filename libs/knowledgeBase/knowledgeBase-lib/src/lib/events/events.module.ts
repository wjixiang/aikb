import { Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import type { IEventBus } from './event-bus.interface';

@Module({
  providers: [
    {
      provide: EventBusService,
      useFactory: () => new EventBusService(),
    },
  ],
  exports: [EventBusService],
})
export class EventsModule {}
