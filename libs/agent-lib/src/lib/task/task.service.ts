// task/task.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Task } from './task.entity';
import { TokenUsage } from '../types/message.type';
import { ToolUsage } from '../types/tool.type';
import Anthropic from '@anthropic-ai/sdk';
import { RooCodeEventName } from '../types/event.type';

@Injectable()
export class TaskService {
  constructor(private eventEmitter: EventEmitter2) {}

  private tasks = new Map<string, Task>();

  createTask(taskId: string): Task {
    const task = new Task(taskId);
    this.tasks.set(taskId, task);
    this.eventEmitter.emit('task.created', { taskId });
    return task;
  }

  startTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const { event, data } = task.start();
    this.eventEmitter.emit(event, data);
  }

  completeTask(taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const { event, data } = task.complete(tokenUsage, toolUsage);
    this.eventEmitter.emit(event, data);
  }

  abortTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const { event, data } = task.abort();
    this.eventEmitter.emit(event, data);
  }


}
