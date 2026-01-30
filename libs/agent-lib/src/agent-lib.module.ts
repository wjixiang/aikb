import { Module } from '@nestjs/common';
import { TaskModule } from './task/task.module';

@Module({
  imports: [TaskModule],
  controllers: [],
  providers: [],
  exports: [TaskModule],
})
export class AgentLibModule {}
