import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { TaskInfo, Message, MessageRole, MessageBlock } from '../graphql';
import { AppService } from './app.service';
import { GqlJwtAuthGuard } from 'auth-lib';
import { UseGuards } from '@nestjs/common';
import { ApiMessage } from 'agent-lib';

@Resolver()
@UseGuards(GqlJwtAuthGuard)
export class QueryResolver {
  constructor(private appService: AppService) { }

  @Query('listTaskInfo')
  async listTaskInfo(@Context() context: any): Promise<TaskInfo[]> {
    return this.appService.listTaskInfo(context);
  }

  @Query('getTaskInfo')
  async getTaskInfo(
    @Args('taskId') taskId: string,
    @Context() context: any,
  ): Promise<TaskInfo> {
    return this.appService.getTaskInfo(taskId, context);
  }

  @Query('getTaskMessages')
  async getTaskMessages(
    @Args('taskId') taskId: string,
    @Context() context: any,
  ): Promise<Message[]> {
    const result = await this.appService.getTaskMessages(taskId, context);
    return result.map((msg: ApiMessage) => this.mapApiMessageToMessage(msg));
  }

  /**
   * Map ApiMessage from agent-lib to GraphQL Message type
   */
  private mapApiMessageToMessage(msg: ApiMessage): Message {
    const message: Message = {
      role: this.mapRole(msg.role),
      ts: msg.ts ? String(msg.ts) : null,
    };

    // Handle content based on its type
    if (typeof msg.content === 'string') {
      message.text = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Map content blocks to MessageBlock[]
      message.blocks = msg.content.map((block) => this.mapContentBlockToMessageBlock(block)).filter(Boolean) as MessageBlock[];
    }

    return message;
  }

  /**
   * Map lowercase role to uppercase MessageRole enum
   */
  private mapRole(role: string): MessageRole {
    const roleUpper = role.toUpperCase();
    return roleUpper as MessageRole;
  }

  /**
   * Map Anthropic content block to GraphQL MessageBlock
   */
  private mapContentBlockToMessageBlock(block: any): MessageBlock | null {
    const messageBlock: MessageBlock = {
      type: block.type,
    };

    switch (block.type) {
      case 'text':
        messageBlock.text = block.text;
        break;
      case 'image':
        if (block.source) {
          messageBlock.imageSource = {
            type: block.source.type,
            media_type: block.source.media_type,
            data: block.source.data,
          };
        }
        break;
      case 'tool_use':
        messageBlock.toolUseId = block.id;
        messageBlock.toolName = block.name;
        messageBlock.toolInput = typeof block.input === 'string' ? block.input : JSON.stringify(block.input);
        break;
      case 'tool_result':
        messageBlock.toolResultId = block.tool_use_id;
        messageBlock.toolResultContent = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        break;
      case 'thinking':
        // Handle thinking block - map as text for now
        messageBlock.text = block.thinking;
        break;
      default:
        // Unknown block type, return null to filter it out
        return null;
    }

    return messageBlock;
  }
}
