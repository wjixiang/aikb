import { Injectable } from '@nestjs/common';
import { TaskService } from 'agent-lib';
import {
  TaskInfo,
  TaskStatus,
  CreateTaskInput,
  StartTaskResult,
  StartTaskInput
} from '../graphql';
import { ApiMessage } from 'agent-lib';

// Map lowercase status from agent-lib to uppercase GraphQL enum
const statusMap: Record<string, TaskStatus> = {
  idle: TaskStatus.IDLE,
  running: TaskStatus.RUNNING,
  completed: TaskStatus.COMPLETED,
  aborted: TaskStatus.ABORTED,
};

@Injectable()
export class AppService {
  constructor(private taskService: TaskService) { }

  /**
   * Get user ID from request context
   * @param context - GraphQL context object
   * @returns User ID
   * @throws Error if user is not authenticated
   */
  private getUserId(context: any): string {
    const userId = context.req?.user?.sub;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  }

  /**
   * List all tasks for the authenticated user
   * @param context - GraphQL context object
   * @returns Array of TaskInfo
   */
  async listTaskInfo(context: any): Promise<TaskInfo[]> {
    const userId = this.getUserId(context);

    const tasks = await this.taskService.listTasksByUserId(userId);
    return tasks.map((task) => ({
      id: task.id,
      taskInput: task.taskInput,
      taskStatus: task.status.toUpperCase() as TaskStatus,
      createdAt: task.createdAt.toISOString(),
    }));
  }

  /**
   * Get a single task by ID for the authenticated user
   * @param taskId - The ID of the task to retrieve
   * @param context - GraphQL context object
   * @returns TaskInfo
   * @throws Error if task not found or user not authorized
   */
  async getTaskInfo(taskId: string, context: any): Promise<TaskInfo> {
    const userId = this.getUserId(context);

    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.userId !== userId) {
      throw new Error('User not authorized to access this task');
    }

    return {
      id: task.id,
      taskInput: task.taskInput,
      taskStatus: task.status.toUpperCase() as TaskStatus,
      createdAt: task.createdAt.toISOString(),
    };
  }

  /**
   * Get all messages for a task for the authenticated user
   * @param taskId - The ID of the task
   * @param context - GraphQL context object
   * @returns Array of ApiMessage
   * @throws Error if task not found or user not authorized
   */
  async getTaskMessages(taskId: string, context: any): Promise<ApiMessage[]> {
    const userId = this.getUserId(context);

    const task = await this.taskService.getTaskById(taskId);

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.userId !== userId) {
      throw new Error('User not authorized to access this task');
    }

    // taskService.getTaskMessages now returns properly formatted ApiMessage[]
    return this.taskService.getTaskMessages(taskId);
  }

  /**
   * Create a new task for the authenticated user
   * @param input - CreateTaskInput containing taskInput
   * @param context - GraphQL context object
   * @returns TaskInfo of the created task
   */
  async createTask(input: CreateTaskInput, context: any): Promise<TaskInfo> {
    console.log('creating task', input);
    try {
      const userId = this.getUserId(context);
      const task = await this.taskService.createTask(input.taskInput, userId);

      return {
        id: task.taskId,
        taskInput: task.taskInput,
        taskStatus: statusMap[task.status] || TaskStatus.IDLE,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error(
        `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Start a task by its ID
   * @param input - StartTaskInput containing taskId
   * @param context - GraphQL context object
   * @returns StartTaskResult indicating success or failure
   */
  async startTask(
    input: StartTaskInput,
    context: any,
  ): Promise<StartTaskResult> {
    console.log('start task', input);
    try {
      const userId = this.getUserId(context);
      const result = await this.taskService.startTask(input.taskId);
      return {
        isSuccess: result.isSuccess,
        failedReason: result.failedReason,
      };
    } catch (error) {
      throw error;
    }
  }
}
