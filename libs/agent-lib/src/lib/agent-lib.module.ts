import { Module } from '@nestjs/common';
import { AgentService } from './agent/agent.service';
import { ToolExecutionService } from './agent/tool-execution.service';
import { MessageManagerService } from './agent/message-manager.service';
import { ConversationService } from './conversation/conversation.service';

@Module({
  controllers: [],
  providers: [
    AgentService,
    ToolExecutionService,
    MessageManagerService,
    ConversationService,
  ],
  exports: [],
})
export class AgentLibModule {}
