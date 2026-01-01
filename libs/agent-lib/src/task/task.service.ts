// task/task.service.ts
import { Injectable } from '@nestjs/common';
import { Task } from './task.entity';
import { AgentDBPrismaService } from 'agent-db';
import { v4 } from 'uuid';
import { ApiMessage } from './task.type';
import { TaskStatus } from './task.type';

@Injectable()
export class TaskService {
  constructor(
    private db: AgentDBPrismaService
  ) { }

  tasks = new Map<string, Task>()

  private cleanupCallbacks = new Map<string, Array<() => void>>();

  async listTasksByUserId(userId: string) {
    return this.db.task.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async createTask(taskInput: string, userId: string): Promise<Task> {
    const taskCreatedRes = await this.db.task.create({
      data: {
        id: v4(),
        userId: userId,
        taskInput: taskInput,
        createdAt: new Date()
      }
    })
    const task = new Task(taskCreatedRes.id, taskInput, {} as any);
    this.tasks.set(task.taskId, task)

    // Register observer
    // Observe LLM messages
    const cleanup1 = task.onMessageAdded(async (taskId: string, message: ApiMessage) => {
      // Extract reasoning from assistant messages (thinking blocks)
      let reasoning: string | undefined;
      let contentToStore = message.content;

      if (message.role === 'assistant' && Array.isArray(message.content)) {
        const thinkingBlock = message.content.find((block: any) => block.type === 'thinking');
        if (thinkingBlock) {
          reasoning = (thinkingBlock as any).thinking;
          // Remove thinking block from content for storage
          contentToStore = message.content.filter((block: any) => block.type !== 'thinking');
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
        }
      });
    });

    // Observe task status changed
    const cleanup2 = task.onStatusChanged(async (taskId: string, changedStatus: TaskStatus) => {
      const taskStatusUpdatedResult = await this.db.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: changedStatus
        }
      })
    })

    // Store cleanup function for later use
    this.cleanupCallbacks.set(taskCreatedRes.id, [cleanup1, cleanup2]);

    return task;
  }

  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.start();
  }

  completeTask(
    // taskId: string,
    // tokenUsage: TokenUsage,
    // toolUsage: ToolUsage,
  ): void {
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
      cleanups.forEach(cleanup => cleanup());
      this.cleanupCallbacks.delete(taskId);
    }

    this.tasks.delete(taskId)
  }
}
