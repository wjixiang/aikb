import { Module } from '@nestjs/common';
import { TaskModule } from './task/TaskModule';

@Module({
  imports: [TaskModule],
  controllers: [],
  providers: [],
  exports: [TaskModule],
})
export class AgentLibModule { }
