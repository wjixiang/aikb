// task/task.module.ts
import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskEventsHandler } from './task-events.handler';

@Module({
  providers: [TaskService, TaskEventsHandler],
  exports: [TaskService],
})
export class TaskModule {}
