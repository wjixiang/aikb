// task/task.module.ts
import { Module } from '@nestjs/common';
import { AgentDBModule } from 'agent-db';

@Module({
  imports: [AgentDBModule],
  providers: [],
  exports: [],
})
export class TaskModule { }
