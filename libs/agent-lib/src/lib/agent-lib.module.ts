import { Module } from '@nestjs/common';
import { AgentService } from './agent/agent.service';
import { ToolExecutionService } from './agent/tool-execution.service';
import { MessageManagerService } from './agent/message-manager.service';
import { ConversationService } from './conversation/conversation.service';
import { TaskService } from './task/task.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TaskModule } from './task/task.module';
import { ApiService } from './api/api.service';

@Module({
  imports: [EventEmitterModule.forRoot(), TaskModule],
  controllers: [],
  providers: [
    AgentService,
    ToolExecutionService,
    MessageManagerService,
    ConversationService,
    TaskService,
    ApiService,
  ],
  exports: [],
})
export class AgentLibModule {}
