import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ReactiveToolComponent } from '../core/reactiveToolComponent.js';
import type { ExportResult } from '../core/toolComponent.js';
import type { Tool, ToolCallResult } from '../core/types.js';
import type { TUIElement } from '../ui/TUIElement.js';
import { tdiv, th } from '../ui/index.js';
import { TYPES } from '../../core/di/types.js';
import type { IA2AHandler, PendingTask } from '../../core/a2a/A2AHandler.js';
import type { IA2AClient } from '../../core/a2a/A2AClient.js';
import type { A2ATaskResult, A2ATaskStatus } from '../../core/a2a/types.js';
import type { IAgentSleepControl } from '../../core/runtime/AgentSleepControl.js';
import {
  a2aTaskToolSchemas,
  type A2ATaskToolName,
  type AcknowledgeTaskParams,
  type CompleteTaskParams,
  type FailTaskParams,
  type SendTaskResultParams,
  type SendTaskParams,
  type A2ATaskToolReturnTypes,
  type SentTaskInfo,
  type WaitForResultParams,
} from './a2aTaskSchemas.js';

interface A2ATaskState {
  sentTasks: Record<string, SentTaskInfo>;
}

@injectable()
export class A2ATaskComponent extends ReactiveToolComponent<A2ATaskState> {
  override componentId = 'a2a-task';
  override displayName = 'A2A Task Manager';
  override description = 'Manage A2A task acknowledgment and responses';
  override componentPrompt = `
This component handles Agent-to-Agent (A2A) task communication.

**Workflow:**
1. Receive task requests from other agents via A2A protocol
2. MUST call getPendingTasks first to get the list of pending tasks with their conversationId
3. Use the conversationId from getPendingTasks result to acknowledge via acknowledgeTask
4. Process the task using appropriate tools
5. Report results via completeTask or report failures via failTask

**Sending tasks:**
- sendTask sends a task and returns immediately after ACK (async mode)
- The task result is tracked in the background
- Use waitForResult to sleep and wait for the result of a specific task
- Or check getSentTasks or the component render to see task status
- Results are available on the next agent turn after completion

**Waiting for results:**
- waitForResult puts the agent to sleep until the A2A result arrives
- The agent automatically wakes up when the result is ready
- This is useful when you need to wait for a task before proceeding

**Critical:**
- The conversationId is a unique ID like "conv_1234567890_abc123", NOT the task description
- ALWAYS call getPendingTasks first to get the correct conversationId before calling acknowledgeTask
- NEVER make up or guess a conversationId - use the value from getPendingTasks
- Always acknowledge tasks before processing to prevent sender timeout`;

  protected a2aHandler: IA2AHandler;
  protected a2aClient: IA2AClient;
  protected sleepControl: IAgentSleepControl;

  constructor(
    @inject(TYPES.IA2AHandler) a2aHandler: IA2AHandler,
    @inject(TYPES.IA2AClient) a2aClient: IA2AClient,
    @inject(TYPES.AgentSleepControl) sleepControl: IAgentSleepControl,
  ) {
    super();
    this.a2aHandler = a2aHandler;
    this.a2aClient = a2aClient;
    this.sleepControl = sleepControl;
  }

  protected override initialState(): A2ATaskState {
    return { sentTasks: {} };
  }

  protected override toolDefs() {
    return {
      acknowledgeTask: {
        desc: a2aTaskToolSchemas.acknowledgeTask.desc,
        paramsSchema: a2aTaskToolSchemas.acknowledgeTask.paramsSchema,
      },
      completeTask: {
        desc: a2aTaskToolSchemas.completeTask.desc,
        paramsSchema: a2aTaskToolSchemas.completeTask.paramsSchema,
      },
      failTask: {
        desc: a2aTaskToolSchemas.failTask.desc,
        paramsSchema: a2aTaskToolSchemas.failTask.paramsSchema,
      },
      sendTaskResult: {
        desc: a2aTaskToolSchemas.sendTaskResult.desc,
        paramsSchema: a2aTaskToolSchemas.sendTaskResult.paramsSchema,
      },
      getPendingTasks: {
        desc: a2aTaskToolSchemas.getPendingTasks.desc,
        paramsSchema: a2aTaskToolSchemas.getPendingTasks.paramsSchema,
      },
      sendTask: {
        desc: a2aTaskToolSchemas.sendTask.desc,
        paramsSchema: a2aTaskToolSchemas.sendTask.paramsSchema,
      },
      getSentTasks: {
        desc: a2aTaskToolSchemas.getSentTasks.desc,
        paramsSchema: a2aTaskToolSchemas.getSentTasks.paramsSchema,
      },
      waitForResult: {
        desc: a2aTaskToolSchemas.waitForResult.desc,
        paramsSchema: a2aTaskToolSchemas.waitForResult.paramsSchema,
      },
    };
  }

  override handleToolCall: {
    <T extends A2ATaskToolName>(
      toolName: T,
      params: unknown,
    ): Promise<ToolCallResult<A2ATaskToolReturnTypes[T]>>;
    (toolName: string, params: unknown): Promise<ToolCallResult<unknown>>;
  } = async (
    toolName: string,
    params: unknown,
  ): Promise<ToolCallResult<unknown>> => {
    try {
      switch (toolName) {
        case 'acknowledgeTask':
          return await this.handleAcknowledgeTask(
            params as AcknowledgeTaskParams,
          );
        case 'completeTask':
          return await this.handleCompleteTask(params as CompleteTaskParams);
        case 'failTask':
          return await this.handleFailTask(params as FailTaskParams);
        case 'sendTaskResult':
          return await this.handleSendTaskResult(
            params as SendTaskResultParams,
          );
        case 'getPendingTasks':
          return await this.handleGetPendingTasks();
        case 'sendTask':
          return await this.handleSendTask(params as SendTaskParams);
        case 'getSentTaskInfos':
          return await this.handleGetSentTaskInfos();
        case 'waitForResult':
          return await this.handleWaitForResult(params as WaitForResultParams);
        default:
          return {
            success: false,
            data: { error: `Unknown tool: ${toolName}` },
            summary: `[A2A Task] Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: { error: errorMessage },
        summary: `[A2A Task] Error: ${errorMessage}`,
      };
    }
  };

  private getSentTasksArray(): SentTaskInfo[] {
    return Object.values(this.snapshot.sentTasks);
  }

  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'A2A Task Manager',
        styles: { align: 'center' },
      }),
    );

    const inFlight = this.getInFlightTasks();
    const completed = this.getCompletedTasks();
    const failed = this.getFailedTasks();

    if (inFlight.length > 0) {
      elements.push(
        new th({
          content: `In-Flight (${inFlight.length})`,
          styles: { align: 'left' },
        }),
      );
      for (const t of inFlight) {
        const elapsed = Math.round((Date.now() - t.sentAt) / 1000);
        elements.push(
          new tdiv({
            content: `→ ${t.taskId} → ${t.targetAgentId}: ${t.description} (${elapsed}s)`,
          }),
        );
      }
    }

    if (completed.length > 0) {
      elements.push(
        new th({
          content: `Completed (${completed.length})`,
          styles: { align: 'left' },
        }),
      );
      for (const t of completed.slice(-5)) {
        const elapsed = t.completedAt
          ? Math.round((t.completedAt - t.sentAt) / 1000)
          : '?';
        elements.push(
          new tdiv({
            content: `✓ ${t.taskId} → ${t.targetAgentId}: ${t.description} (${elapsed}s)`,
          }),
        );
      }
      if (completed.length > 5) {
        elements.push(
          new tdiv({
            content: `  ... and ${completed.length - 5} more (use getSentTaskInfos to view all)`,
          }),
        );
      }
    }

    if (failed.length > 0) {
      elements.push(
        new th({
          content: `Failed (${failed.length})`,
          styles: { align: 'left' },
        }),
      );
      for (const t of failed.slice(-3)) {
        elements.push(
          new tdiv({
            content: `✗ ${t.taskId} → ${t.targetAgentId}: ${t.error ?? t.status}`,
          }),
        );
      }
    }

    try {
      const pending = this.a2aHandler.getPendingTasks();

      if (pending.length > 0) {
        const acknowledged = pending.filter((t) => t.acknowledged).length;
        const pendingCount = pending.length - acknowledged;
        elements.push(
          new th({
            content: `Incoming (${pendingCount} pending, ${acknowledged} acked)`,
            styles: { align: 'left' },
          }),
        );

        for (const task of pending) {
          const payload = task.payload;
          const desc = payload.description || payload.taskId || 'Unknown task';
          const ackTag = task.acknowledged ? '[ACK]' : '[PENDING]';
          elements.push(
            new tdiv({
              content: `• ${ackTag} [${task.messageType}] ${desc} (id: ${task.conversationId}) from ${task.from}`,
            }),
          );
        }
      }
    } catch {
      // ignore
    }

    if (
      inFlight.length === 0 &&
      completed.length === 0 &&
      failed.length === 0
    ) {
      elements.push(new tdiv({ content: 'No tasks' }));
    }

    return elements;
  };

  override async exportData(_options?: any): Promise<ExportResult> {
    try {
      const pending = this.a2aHandler.getPendingTasks();
      const allSentTaskInfos = this.getSentTasksArray();
      return {
        data: {
          pendingTasks: pending,
          sentTasks: allSentTaskInfos,
          inFlightCount: this.getInFlightTasks().length,
          completedCount: this.getCompletedTasks().length,
          failedCount: this.getFailedTasks().length,
        },
        format: 'json',
      };
    } catch (error) {
      return {
        data: { error: String(error) },
        format: 'json',
      };
    }
  }

  getInFlightTasks(): SentTaskInfo[] {
    return this.getSentTasksArray().filter((t) => t.status === 'in-flight');
  }

  getCompletedTasks(): SentTaskInfo[] {
    return this.getSentTasksArray().filter((t) => t.status === 'completed');
  }

  getFailedTasks(): SentTaskInfo[] {
    return this.getSentTasksArray().filter(
      (t) => t.status === 'failed' || t.status === 'timeout',
    );
  }

  private async trackSentTaskInfo(sentTask: SentTaskInfo): Promise<void> {
    try {
      const result = await this.a2aClient.waitForResult(
        sentTask.conversationId,
      );
      this.reactive.sentTasks[sentTask.taskId] = {
        ...sentTask,
        status: 'completed',
        result,
        completedAt: Date.now(),
      };
      if (this.sleepControl.isSleeping()) {
        this.sleepControl.wakeUp(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.reactive.sentTasks[sentTask.taskId] = {
        ...sentTask,
        status: msg.includes('Timeout') ? 'timeout' : 'failed',
        error: msg,
        completedAt: Date.now(),
      };
      if (this.sleepControl.isSleeping()) {
        this.sleepControl.wakeUp(undefined);
      }
    }
  }

  private async handleAcknowledgeTask(
    params: AcknowledgeTaskParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      await this.a2aHandler.acknowledge(params.conversationId);
      return {
        success: true,
        data: {
          success: true,
          conversationId: params.conversationId,
        },
        summary: `[A2A Task] Acknowledged task: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as { success: boolean; conversationId: string; error: string },
        summary: `[A2A Task] Failed to acknowledge: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleCompleteTask(
    params: CompleteTaskParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      this.a2aHandler.completeTask(
        params.conversationId,
        params.output,
        params.status || 'completed',
      );
      return {
        success: true,
        data: {
          success: true,
          conversationId: params.conversationId,
        },
        summary: `[A2A Task] Completed task: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as { success: boolean; conversationId: string; error: string },
        summary: `[A2A Task] Failed to complete: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleFailTask(
    params: FailTaskParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      this.a2aHandler.completeTask(
        params.conversationId,
        { error: params.error },
        'failed',
      );
      return {
        success: true,
        data: {
          success: true,
          conversationId: params.conversationId,
        },
        summary: `[A2A Task] Failed task: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as { success: boolean; conversationId: string; error: string },
        summary: `[A2A Task] Failed to send error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleSendTaskResult(
    params: SendTaskResultParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      const status: A2ATaskStatus = params.status || 'completed';
      await this.a2aHandler.sendTaskResult(
        params.conversationId,
        params.output,
        status,
        params.error,
      );
      return {
        success: true,
        data: {
          success: true,
          conversationId: params.conversationId,
        },
        summary: `[A2A Task] Sent result for: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as { success: boolean; conversationId: string; error: string },
        summary: `[A2A Task] Failed to send result: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleGetPendingTasks(): Promise<
    ToolCallResult<{ tasks: PendingTask[] }>
  > {
    try {
      const pending = this.a2aHandler.getPendingTasks();
      return {
        success: true,
        data: { tasks: pending },
        summary: `[A2A Task] Found ${pending.length} pending tasks${
          pending.some((t) => t.acknowledged)
            ? ` (${pending.filter((t) => t.acknowledged).length} acknowledged)`
            : ''
        }`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          tasks: [] as PendingTask[],
          error: error instanceof Error ? error.message : String(error),
        } as { tasks: PendingTask[]; error: string },
        summary: `[A2A Task] Failed to get pending: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleSendTask(params: SendTaskParams): Promise<
    ToolCallResult<{
      success: boolean;
      conversationId: string;
      taskId: string;
      status: string;
      error?: string;
    }>
  > {
    try {
      const conversationId = await this.a2aClient.sendTaskAndWaitForAck(
        params.targetAgentId,
        params.taskId,
        params.description,
        params.input ?? {},
        { priority: params.priority ?? 'normal' },
      );

      const sentTask: SentTaskInfo = {
        taskId: params.taskId,
        conversationId,
        targetAgentId: params.targetAgentId,
        description: params.description,
        status: 'in-flight',
        sentAt: Date.now(),
      };
      this.reactive.sentTasks[params.taskId] = sentTask;

      this.trackSentTaskInfo(sentTask).catch(() => {});

      return {
        success: true,
        data: {
          success: true,
          conversationId,
          taskId: params.taskId,
          status: 'in-flight',
        },
        summary: `[A2A Task] Sent task ${params.taskId} to ${params.targetAgentId} (ACK received, result pending)`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: '',
          taskId: params.taskId,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        },
        summary: `[A2A Task] Failed to send task: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private async handleGetSentTaskInfos(): Promise<
    ToolCallResult<{
      tasks: SentTaskInfo[];
    }>
  > {
    const tasks = this.getSentTasksArray();
    return {
      success: true,
      data: {
        tasks,
      },
      summary: `[A2A Task] ${tasks.length} sent tasks (${this.getInFlightTasks().length} in-flight, ${this.getCompletedTasks().length} completed, ${this.getFailedTasks().length} failed)`,
    };
  }

  private async handleWaitForResult(params: WaitForResultParams): Promise<
    ToolCallResult<{
      success: boolean;
      conversationId: string;
      result?: A2ATaskResult;
      error?: string;
    }>
  > {
    const sentTask = Object.values(this.snapshot.sentTasks).find(
      (t) => t.conversationId === params.conversationId,
    );

    if (!sentTask) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: `No sent task found with conversationId: ${params.conversationId}`,
        },
        summary: `[A2A Task] No sent task found for conversationId: ${params.conversationId}`,
      };
    }

    if (sentTask.status === 'completed') {
      return {
        success: true,
        data: {
          success: true,
          conversationId: params.conversationId,
          result: sentTask.result,
        },
        summary: `[A2A Task] Task already completed: ${params.conversationId}`,
      };
    }

    if (sentTask.status === 'failed' || sentTask.status === 'timeout') {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: sentTask.error,
        },
        summary: `[A2A Task] Task already ${sentTask.status}: ${params.conversationId}`,
      };
    }

    try {
      const wakeData = await this.sleepControl.sleep(
        `Waiting for A2A result: ${params.conversationId}`,
      );

      const task = this.snapshot.sentTasks[sentTask.taskId];
      if (task && task.status === 'completed') {
        return {
          success: true,
          data: {
            success: true,
            conversationId: params.conversationId,
            result: task.result,
          },
          summary: `[A2A Task] Woke up, result received: ${params.conversationId}`,
        };
      }

      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: task?.error ?? 'Woken up without result (possibly aborted)',
        },
        summary: `[A2A Task] Woken up without result: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        },
        summary: `[A2A Task] Failed to wait for result: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}
