// task/task-events.handler.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ToolUsage } from '../types/tool.type';
import { TokenUsage } from '../types/message.type';
import { TaskService } from './task.service';

@Injectable()
export class TaskEventsHandler {
  constructor(private taskService: TaskService) {}

  @OnEvent('task.created')
  handleTaskCreated(payload: { taskId: string }) {
    // Start task immediately after created
    this.taskService.startTask(payload.taskId);
    console.log(`Start Task: ${payload.taskId} `);
  }

  @OnEvent('task.started')
  handleTaskStarted(payload: { taskId: string }) {
    console.log(`Task ${payload.taskId} started`);
  }

  @OnEvent('task.completed')
  handleTaskCompleted(payload: {
    taskId: string;
    tokenUsage: TokenUsage;
    toolUsage: ToolUsage;
  }) {
    console.log(`Task ${payload.taskId} completed`);
  }

  @OnEvent('task.aborted')
  handleTaskAborted(payload: { taskId: string }) {
    console.log(`Task ${payload.taskId} aborted`);
  }
}
