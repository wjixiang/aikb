import { Module } from '@nestjs/common';
import { TaskService } from './task/task.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TaskModule } from './task/task.module';


@Module({
  imports: [EventEmitterModule.forRoot(), TaskModule],
  controllers: [],
  providers: [
    TaskService
  ],
  exports: [TaskService],
})
export class AgentLibModule { }
