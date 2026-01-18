// task/task.service.ts
import { Injectable } from '@nestjs/common';
import { Task } from './task.entity';
import { AgentDBPrismaService } from 'agent-db';
import { v4 } from 'uuid';
import { ApiMessage } from './task.type';
import { TaskStatus } from './task.type';
import { ProviderSettings } from '../types/provider-settings';

/**
 * @deprecated
 */
@Injectable()
export class TaskService {
  constructor(private db: AgentDBPrismaService) { }

  tasks = new Map<string, Task>();

  private cleanupCallbacks = new Map<string, Array<() => void>>();

  async listTasksByUserId(userId: string) {
    return this.db.task.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Query tasks with custom where clause
   * @param where - Prisma where clause
   * @returns Array of tasks
   */
  async queryTasks(where: any) {
    return this.db.task.findMany({
      where: where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Query a single task with custom where clause
   * @param where - Prisma where clause
   * @returns Single task or null
   */
  async queryTask(where: any) {
    return this.db.task.findFirst({
      where: where,
    });
  }

  async getTaskById(taskId: string) {
    return this.db.task.findUnique({
      where: { id: taskId },
    });
  }

  async getTaskMessages(taskId: string): Promise<ApiMessage[]> {
    const messages = await this.db.conversationMessage.findMany({
      where: { taskId: taskId },
      orderBy: { timestamp: 'asc' },
    });
    return messages.map((msg) => this.mapConversationMessageToApiMessage(msg));
  }

  /**
   * Map database ConversationMessage to ApiMessage
   * Restores the message format from database storage
   */
  private mapConversationMessageToApiMessage(msg: any): ApiMessage {
    const apiMessage: ApiMessage = {
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content as any,
      ts: Number(msg.timestamp),
    };

    // If reasoning exists and role is assistant, prepend thinking block
    if (msg.reasoning && msg.role === 'assistant') {
      const thinkingBlock = {
        type: 'thinking' as const,
        thinking: msg.reasoning,
      };

      // If content is already an array, prepend thinking block
      if (Array.isArray(apiMessage.content)) {
        apiMessage.content = [thinkingBlock, ...apiMessage.content];
      } else if (typeof apiMessage.content === 'string') {
        // If content is a string, convert to array with thinking block and text block
        apiMessage.content = [
          thinkingBlock,
          {
            type: 'text' as const,
            text: apiMessage.content,
          },
        ];
      }
    }

    return apiMessage;
  }

  async createTask(taskInput: string, userId: string): Promise<Task> {
    const taskCreatedRes = await this.db.task.create({
      data: {
        id: v4(),
        userId: userId,
        taskInput: taskInput,
        createdAt: new Date(),
      },
    });
    const task = this.initializeTask(taskCreatedRes.id, taskInput);
    return task;
  }

  /**
   * Initialize a Task instance with observers for message and status changes
   */
  private initializeTask(taskId: string, taskInput: string): Task {
    // Temporarily use hard-code setting
    const testApiConfig: ProviderSettings = {
      apiProvider: 'zai',
      apiKey: process.env['GLM_API_KEY'],
      apiModelId: 'glm-4.7',
      toolProtocol: 'xml',
      zaiApiLine: 'china_coding',
    };

    const task = new Task(taskId, taskInput, testApiConfig);
    this.tasks.set(task.taskId, task);

    // Register observer
    // Observe LLM messages
    const cleanup1 = task.onMessageAdded(
      async (taskId: string, message: ApiMessage) => {
        // Extract reasoning from assistant messages (thinking blocks)
        let reasoning: string | undefined;
        let contentToStore = message.content;

        if (message.role === 'assistant' && Array.isArray(message.content)) {
          const thinkingBlock = message.content.find(
            (block: any) => block.type === 'thinking',
          );
          if (thinkingBlock) {
            reasoning = (thinkingBlock as any).thinking;
            // Remove thinking block from content for storage
            contentToStore = message.content.filter(
              (block: any) => block.type !== 'thinking',
            );
          }
        }

        // Store the message to database
        await this.db.conversationMessage.create({
          data: {
            taskId: taskId,
            role: message.role,
            content: contentToStore as any,
            reasoning: reasoning,
            timestamp: message.ts || Date.now(),
          },
        });
      },
    );

    // Observe task status changed
    const cleanup2 = task.onStatusChanged(
      async (taskId: string, changedStatus: TaskStatus) => {
        const taskStatusUpdatedResult = await this.db.task.update({
          where: {
            id: taskId,
          },
          data: {
            status: changedStatus,
          },
        });
      },
    );

    // Store cleanup function for later use
    this.cleanupCallbacks.set(taskId, [cleanup1, cleanup2]);

    return task;
  }

  async startTask(taskId: string): Promise<{
    isSuccess: boolean;
    failedReason?: string;
  }> {
    let task = this.tasks.get(taskId);

    if (!task) {
      // Check if task exists in database
      const taskRecord = await this.db.task.findUnique({
        where: { id: taskId },
        include: {
          conversationMessages: {
            orderBy: { timestamp: 'asc' },
          },
        },
      });

      if (!taskRecord) {
        return { isSuccess: false, failedReason: 'Task not found' };
      }

      // Restore task status
      if (
        taskRecord.status === 'completed' ||
        taskRecord.status === 'aborted'
      ) {
        return {
          isSuccess: false,
          failedReason: 'Task already completed or aborted',
        };
      }

      // Reinitialize the task from database record
      task = this.initializeTask(taskRecord.id, taskRecord.taskInput);

      // Restore conversation history
      task.conversationHistory = taskRecord.conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content as any,
        ts: Number(msg.timestamp),
      }));
    }

    // Start the task
    await task.start();
    return { isSuccess: true };
  }

  completeTask() // taskId: string,
    // tokenUsage: TokenUsage,
    // toolUsage: ToolUsage,
    : void {
    // const task = this.tasks.get(taskId);
    // if (!task) return;
    // const { event, data } = task.complete(tokenUsage, toolUsage);
    // this.eventEmitter.emit(event, data);
  }

  abortTask(taskId: string): void {
    // const task = this.tasks.get(taskId);
    // if (!task) return;
    // const { event, data } = task.abort();
    // this.eventEmitter.emit(event, data);
  }

  destroyTask(taskId: string): void {
    const cleanups = this.cleanupCallbacks.get(taskId);
    if (cleanups) {
      // 调用所有清理函数，从 Task 的回调列表中移除
      cleanups.forEach((cleanup) => cleanup());
      this.cleanupCallbacks.delete(taskId);
    }

    this.tasks.delete(taskId);
  }
}
