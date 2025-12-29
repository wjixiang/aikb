// task/task.module.ts
import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskEventsHandler } from './task-events.handler';
import { AgentDBPrismaService } from 'agent-db';

@Module({
  providers: [TaskService, TaskEventsHandler, AgentDBPrismaService],
  exports: [TaskService],
})
export class TaskModule { }
