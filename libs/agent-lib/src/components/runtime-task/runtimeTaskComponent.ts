import { ToolComponent, ExportOptions } from '../core/toolComponent.js';
import { Tool, ToolCallResult, TUIElement, tdiv, th, tp } from '../ui/index.js';
import type {
  RuntimeTask,
  RuntimeTaskResult,
  TaskListener,
  TaskPriority,
} from './types.js';
import {
  runtimeTaskToolSchemas,
  type RuntimeTaskToolName,
  type ToolReturnType,
  type GetPendingTasksParams,
  type GetTaskByIdParams,
  type ReportTaskResultParams,
  type SendTaskToExpertParams,
  type MarkTaskProcessingParams,
} from './schemas.js';
import { type ITaskStorage, InMemoryTaskStorage } from './storage.js';

export interface RuntimeTaskComponentConfig {
  instanceId: string;
  storage?: ITaskStorage;
  maxQueueSize?: number;
}

export class RuntimeTaskComponent extends ToolComponent {
  override componentId = 'runtime-task';
  override displayName = 'Runtime Task Queue';
  override description = 'In-memory task queue for agent communication';

  toolSet: Map<string, Tool>;
  private config: RuntimeTaskComponentConfig;
  private storage: ITaskStorage;
  private listeners: Set<TaskListener> = new Set();

  constructor(config: RuntimeTaskComponentConfig) {
    super();
    this.config = {
      maxQueueSize: 100,
      ...config,
    };
    this.storage = config.storage ?? new InMemoryTaskStorage();
    this.toolSet = this.initializeToolSet();
  }

  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    const toolEntries: [string, Tool][] = [
      ['getPendingTasks', runtimeTaskToolSchemas.getPendingTasks],
      ['getTaskById', runtimeTaskToolSchemas.getTaskById],
      ['reportTaskResult', runtimeTaskToolSchemas.reportTaskResult],
      ['sendTaskToExpert', runtimeTaskToolSchemas.sendTaskToExpert],
      ['markTaskProcessing', runtimeTaskToolSchemas.markTaskProcessing],
    ];

    toolEntries.forEach(([name, tool]) => {
      tools.set(name, tool);
    });

    return tools;
  }

  handleToolCall: {
    <T extends RuntimeTaskToolName>(
      toolName: T,
      params: unknown,
    ): Promise<ToolCallResult<ToolReturnType<T>>>;
    (toolName: string, params: unknown): Promise<ToolCallResult<any>>;
  } = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult<any>> => {
    try {
      switch (toolName) {
        case 'getPendingTasks':
          return await this.handleGetPendingTasks(
            params as GetPendingTasksParams,
          );
        case 'getTaskById':
          return await this.handleGetTaskById(params as GetTaskByIdParams);
        case 'reportTaskResult':
          return await this.handleReportTaskResult(
            params as ReportTaskResultParams,
          );
        case 'sendTaskToExpert':
          return await this.handleSendTaskToExpert(
            params as SendTaskToExpertParams,
          );
        case 'markTaskProcessing':
          return await this.handleMarkTaskProcessing(
            params as MarkTaskProcessingParams,
          );
        default:
          return {
            success: false,
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[RuntimeTask] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage },
        summary: `[RuntimeTask] Error: ${errorMessage}`,
      };
    }
  };

  private async handleGetPendingTasks(
    params: GetPendingTasksParams,
  ): Promise<ToolCallResult<{ tasks: RuntimeTask[] }>> {
    try {
      const tasks = await this.storage.getPending(this.config.instanceId);
      const limitedTasks = tasks.slice(0, params.limit);
      return {
        success: true,
        data: { tasks: limitedTasks },
        summary: `[RuntimeTask] Got ${limitedTasks.length} pending task(s)`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[RuntimeTask] Failed to get pending tasks: ${errorMessage}`,
      };
    }
  }

  private async handleGetTaskById(
    params: GetTaskByIdParams,
  ): Promise<ToolCallResult<RuntimeTask>> {
    try {
      const task = await this.storage.get(params.taskId);
      if (!task) {
        return {
          success: false,
          data: { error: `Task not found: ${params.taskId}` } as any,
          summary: `[RuntimeTask] Task not found: ${params.taskId}`,
        };
      }
      return {
        success: true,
        data: task,
        summary: `[RuntimeTask] Got task: ${params.taskId}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[RuntimeTask] Failed to get task: ${errorMessage}`,
      };
    }
  }

  private async handleReportTaskResult(
    params: ReportTaskResultParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    try {
      const task = await this.storage.get(params.taskId);
      if (!task) {
        return {
          success: false,
          data: { error: `Task not found: ${params.taskId}` } as any,
          summary: `[RuntimeTask] Task not found: ${params.taskId}`,
        };
      }

      await this.storage.update(params.taskId, {
        status: params.success ? 'completed' : 'failed',
      });

      const result: RuntimeTaskResult = {
        taskId: params.taskId,
        success: params.success,
        output: params.output,
        error: params.error,
        completedAt: new Date(),
      };

      await this.storage.saveResult(result);

      return {
        success: true,
        data: { success: true },
        summary: params.success
          ? `[RuntimeTask] Task ${params.taskId} completed successfully`
          : `[RuntimeTask] Task ${params.taskId} failed`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[RuntimeTask] Failed to report task result: ${errorMessage}`,
      };
    }
  }

  private async handleSendTaskToExpert(
    params: SendTaskToExpertParams,
  ): Promise<ToolCallResult<{ taskId: string }>> {
    try {
      const taskId = await this.sendToExpert(params.receiverExpertId, {
        description: params.description,
        input: params.input,
        priority: params.priority ?? 'normal',
        sender: this.config.instanceId,
      });

      return {
        success: true,
        data: { taskId },
        summary: `[RuntimeTask] Sent task ${taskId} to ${params.receiverExpertId}`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[RuntimeTask] Failed to send task: ${errorMessage}`,
      };
    }
  }

  private async handleMarkTaskProcessing(
    params: MarkTaskProcessingParams,
  ): Promise<ToolCallResult<{ success: boolean }>> {
    try {
      const task = await this.storage.get(params.taskId);
      if (!task) {
        return {
          success: false,
          data: { error: `Task not found: ${params.taskId}` } as any,
          summary: `[RuntimeTask] Task not found: ${params.taskId}`,
        };
      }

      await this.storage.update(params.taskId, { status: 'processing' });

      return {
        success: true,
        data: { success: true },
        summary: `[RuntimeTask] Task ${params.taskId} marked as processing`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage } as any,
        summary: `[RuntimeTask] Failed to mark task as processing: ${errorMessage}`,
      };
    }
  }

  async submitTask(
    task: Omit<RuntimeTask, 'taskId' | 'createdAt' | 'status'>,
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const newTask: RuntimeTask = {
      taskId,
      description: task.description,
      input: task.input,
      priority: task.priority,
      status: 'pending',
      createdAt: new Date(),
      sender: task.sender,
      receiver: task.receiver ?? this.config.instanceId,
      correlationId: task.correlationId,
      parentTaskId: task.parentTaskId,
    };

    await this.storage.add(newTask);

    this.listeners.forEach((listener) => {
      void listener(newTask);
    });

    return taskId;
  }

  async getTaskResult(taskId: string): Promise<RuntimeTaskResult | undefined> {
    return this.storage.getResult(taskId);
  }

  onNewTask(listener: TaskListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async sendToExpert(
    receiverId: string,
    task: Omit<RuntimeTask, 'taskId' | 'createdAt' | 'status' | 'receiver'>,
  ): Promise<string> {
    return this.submitTask({
      ...task,
      receiver: receiverId,
    });
  }

  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'Runtime Task Queue',
        styles: { align: 'center' },
      }),
    );

    elements.push(
      new tdiv({
        content: `Expert: ${this.config.instanceId}`,
        styles: { align: 'center', padding: { vertical: 1 } },
      }),
    );

    try {
      const pendingTasks = await this.storage.getPending(
        this.config.instanceId,
      );

      elements.push(
        new tp({
          content: `Pending: ${pendingTasks.length}`,
          indent: 1,
          textStyle: { bold: true },
        }),
      );

      if (pendingTasks.length > 0) {
        elements.push(new tp({ content: '─'.repeat(60), indent: 1 }));

        pendingTasks.slice(0, 10).forEach((task, index) => {
          elements.push(
            new tp({
              content: `${index + 1}. [${task.priority}] ${task.description.substring(0, 60)}${task.description.length > 60 ? '...' : ''}`,
              indent: 1,
              textStyle: {
                bold: task.priority === 'urgent' || task.priority === 'high',
              },
            }),
          );
          elements.push(
            new tp({
              content: `   ID: ${task.taskId} | From: ${task.sender ?? 'external'} | ${task.createdAt.toISOString()}`,
              indent: 2,
            }),
          );
        });

        if (pendingTasks.length > 10) {
          elements.push(
            new tp({
              content: `... and ${pendingTasks.length - 10} more task(s)`,
              indent: 1,
              textStyle: { italic: true },
            }),
          );
        }
      } else {
        elements.push(new tp({ content: 'No pending tasks.', indent: 1 }));
      }
    } catch (error) {
      elements.push(
        new tp({
          content: `Error loading tasks: ${error instanceof Error ? error.message : String(error)}`,
          indent: 1,
        }),
      );
    }

    return elements;
  };

  async exportData(options?: ExportOptions) {
    const pendingTasks = await this.storage.getPending(this.config.instanceId);
    const allTasks = await this.storage.query({});

    return {
      data: {
        config: this.config,
        pendingTasks: pendingTasks.length,
        totalTasks: allTasks.length,
      },
      format: options?.format ?? 'json',
      metadata: {
        componentId: this.componentId,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}

export function createRuntimeTaskComponent(
  config: RuntimeTaskComponentConfig,
): RuntimeTaskComponent {
  return new RuntimeTaskComponent(config);
}
