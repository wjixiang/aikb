import {
  ToolComponent,
  ExportOptions,
  type ExportResult,
} from '../core/toolComponent.js';
import { Tool, ToolCallResult, TUIElement, tdiv, th, tp } from '../ui/index.js';
import type { RuntimeTask, RuntimeTaskResult, TaskPriority } from './types.js';
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
import type { ICentralTaskQueue } from '../../core/runtime/index.js';
import type { HookModule } from '../../core/hooks/HookModule.js';
import { HookType } from '../../core/hooks/types.js';

export interface RuntimeTaskComponentConfig {
  instanceId: string;
  storage?: ITaskStorage;
  maxQueueSize?: number;
  centralTaskQueue?: ICentralTaskQueue; // 可选的中心任务队列
  hookModule?: HookModule; // 可选的 HookModule 用于触发任务钩子
}

export class RuntimeTaskComponent extends ToolComponent {
  override componentId = 'runtime-task';
  override displayName = 'Runtime Task Queue';
  override description = 'In-memory task queue for agent communication';

  toolSet: Map<string, Tool>;
  private config: RuntimeTaskComponentConfig;
  private storage: ITaskStorage;
  private _centralTaskQueue?: ICentralTaskQueue;
  private _hookModule?: HookModule;

  constructor(config: RuntimeTaskComponentConfig) {
    super();
    this.config = {
      maxQueueSize: 100,
      ...config,
    };
    this.storage = config.storage ?? new InMemoryTaskStorage();
    this._centralTaskQueue = config.centralTaskQueue;
    this._hookModule = config.hookModule;
    this.toolSet = this.initializeToolSet();
  }

  /**
   * Get the central task queue
   */
  get centralTaskQueue(): ICentralTaskQueue | undefined {
    return this._centralTaskQueue;
  }

  /**
   * Set the central task queue (used by runtime to connect agent to central queue)
   */
  set centralTaskQueue(queue: ICentralTaskQueue | undefined) {
    this._centralTaskQueue = queue;
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
      // Get tasks from both local storage and central queue
      const localTasks = await this.storage.getPending(this.config.instanceId);
      let centralTasks: RuntimeTask[] = [];

      if (this.centralTaskQueue) {
        // Convert RuntimeTask from CentralTaskQueue to local format
        const queueTasks = await this.centralTaskQueue.getForAgent(
          this.config.instanceId,
        );
        centralTasks = queueTasks.map((t) => ({
          taskId: t.taskId,
          description: t.description,
          input: t.input,
          priority: t.priority as TaskPriority,
          status: t.status as RuntimeTask['status'],
          targetInstanceId: t.targetInstanceId,
          sender: undefined,
          receiver: this.config.instanceId,
          correlationId: undefined,
          parentTaskId: undefined,
          createdAt: t.createdAt,
        }));
      }

      // Merge and deduplicate by taskId
      const allTasks = new Map<string, RuntimeTask>();
      for (const task of [...localTasks, ...centralTasks]) {
        allTasks.set(task.taskId, task);
      }

      const mergedTasks = Array.from(allTasks.values()).sort(
        (a, b) =>
          (b.priority === 'urgent' ? 1 : 0) -
            (a.priority === 'urgent' ? 1 : 0) ||
          b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const limitedTasks = mergedTasks.slice(0, params.limit);
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
      // Check if this is a central task (taskId format: task_xxx)
      const isCentralTask = params.taskId.startsWith('task_');

      // Get task before updating (for hook context)
      const task = await this.storage.get(params.taskId);

      if (isCentralTask && this.centralTaskQueue) {
        // Report to central task queue
        if (params.success) {
          const result = {
            taskId: params.taskId,
            success: true,
            output: params.output as Record<string, ExportResult> | undefined,
            completedAt: new Date(),
          };
          await this.centralTaskQueue.complete(params.taskId, result);

          // Trigger task:completed hook
          if (this._hookModule) {
            await this._hookModule.executeHooks(HookType.TASK_COMPLETED, {
              type: HookType.TASK_COMPLETED,
              timestamp: new Date(),
              instanceId: this.config.instanceId,
              taskId: params.taskId,
              result,
            });
          }
        } else {
          const error = new Error(params.error ?? 'Task failed');
          await this.centralTaskQueue.fail(
            params.taskId,
            params.error ?? 'Task failed',
          );

          // Trigger task:failed hook
          if (this._hookModule && task) {
            await this._hookModule.executeHooks(HookType.TASK_FAILED, {
              type: HookType.TASK_FAILED,
              timestamp: new Date(),
              instanceId: this.config.instanceId,
              taskId: params.taskId,
              task,
              error,
            });
          }
        }
      } else {
        // Report to local storage
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

        // Trigger hooks
        if (this._hookModule) {
          if (params.success) {
            await this._hookModule.executeHooks(HookType.TASK_COMPLETED, {
              type: HookType.TASK_COMPLETED,
              timestamp: new Date(),
              instanceId: this.config.instanceId,
              taskId: params.taskId,
              result,
            });
          } else {
            await this._hookModule.executeHooks(HookType.TASK_FAILED, {
              type: HookType.TASK_FAILED,
              timestamp: new Date(),
              instanceId: this.config.instanceId,
              taskId: params.taskId,
              task,
              error: new Error(params.error ?? 'Task failed'),
            });
          }
        }
      }

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

    // Trigger task:submitted hook
    if (this._hookModule) {
      await this._hookModule.executeHooks(HookType.TASK_SUBMITTED, {
        type: HookType.TASK_SUBMITTED,
        timestamp: new Date(),
        instanceId: this.config.instanceId,
        taskId,
        task: newTask,
        source: 'local',
      });
    }

    return taskId;
  }

  async getTaskResult(taskId: string): Promise<RuntimeTaskResult | undefined> {
    return this.storage.getResult(taskId);
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
      // Get tasks from local storage
      const localActiveTasks = await this.storage.getActive(
        this.config.instanceId,
      );

      // Get tasks from central queue (if available)
      let centralActiveTasks: RuntimeTask[] = [];
      if (this.centralTaskQueue) {
        const queueTasks = await this.centralTaskQueue.getForAgent(
          this.config.instanceId,
        );
        centralActiveTasks = queueTasks.map((t) => ({
          taskId: t.taskId,
          description: t.description,
          input: t.input,
          priority: t.priority as TaskPriority,
          status: t.status as RuntimeTask['status'],
          targetInstanceId: t.targetInstanceId,
          sender: undefined,
          receiver: this.config.instanceId,
          correlationId: undefined,
          parentTaskId: undefined,
          createdAt: t.createdAt,
        }));
      }

      // Merge tasks
      const allTasksMap = new Map<string, RuntimeTask>();
      for (const task of [...localActiveTasks, ...centralActiveTasks]) {
        allTasksMap.set(task.taskId, task);
      }
      const allTasks = Array.from(allTasksMap.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const pendingTasks = allTasks.filter((t) => t.status === 'pending');
      const processingTasks = allTasks.filter((t) => t.status === 'processing');

      elements.push(
        new tp({
          content: `Active: ${allTasks.length} (Pending: ${pendingTasks.length} | Processing: ${processingTasks.length})`,
          indent: 1,
        }),
      );

      if (allTasks.length > 0) {
        elements.push(new tp({ content: '─'.repeat(60), indent: 1 }));

        const displayTasks = allTasks.slice(0, 10);
        displayTasks.forEach((task, index) => {
          const pinPrefix = task.status === 'processing' ? '📌 ' : '';
          const isCentral = task.taskId.startsWith('task_');
          const prefix = isCentral ? '🌐 ' : '';

          elements.push(
            new tp({
              content: `${index + 1}. ${prefix}${pinPrefix}[${task.priority}] ${task.description.substring(0, 55)}${task.description.length > 55 ? '...' : ''}`,
              indent: 1,
            }),
          );
          elements.push(
            new tp({
              content: `   ID: ${task.taskId} | From: ${task.sender ?? 'external'} | ${task.createdAt.toISOString()}`,
              indent: 2,
            }),
          );
        });

        if (allTasks.length > 10) {
          elements.push(
            new tp({
              content: `... and ${allTasks.length - 10} more task(s)`,
              indent: 1,
            }),
          );
        }
      } else {
        elements.push(new tp({ content: 'No active tasks.', indent: 1 }));
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
    const activeTasks = await this.storage.getActive(this.config.instanceId);
    const allTasks = await this.storage.query({});

    return {
      data: {
        config: this.config,
        activeTasks: activeTasks.length,
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
