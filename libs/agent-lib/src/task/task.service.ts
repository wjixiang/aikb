// task/task.service.ts
import { Injectable } from '@nestjs/common';
import { Task } from './task.entity';
import { AgentDBPrismaService } from 'agent-db';
import { v4 } from 'uuid';

@Injectable()
export class TaskService {
  constructor(
    private db: AgentDBPrismaService
  ) { }

  async createTask(taskInput: string): Promise<Task> {
    const taskCreatedRes = await this.db.task.create({
      data: {
        id: v4(),
        createdAt: new Date()
      }
    })
    const task = new Task(taskCreatedRes.id, {} as any);


    return task;
  }

  startTask(taskId: string): void {
    // const task = this.tasks.get(taskId);
    // if (!task) return;
    // const { event, data } = task.start();
    // this.eventEmitter.emit(event, data);
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
}
