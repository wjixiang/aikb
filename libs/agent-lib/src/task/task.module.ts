// task/task.module.ts
import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { AgentDBModule } from 'agent-db';

@Module({
  imports: [AgentDBModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule { }
