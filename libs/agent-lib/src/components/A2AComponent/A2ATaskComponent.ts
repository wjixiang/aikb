/**
 * A2ATaskComponent - Component for managing A2A task acknowledgment and responses
 *
 * This component provides tools that allow an Agent to:
 * - View pending A2A tasks awaiting acknowledgment
 * - Acknowledge tasks when ready to process
 * - Send task results or failures
 *
 * ## Usage
 *
 * The component uses `injectSymbols` to receive IA2AHandler via DI:
 *
 * ```typescript
 * class A2ATaskComponent extends ToolComponent {
 *   static readonly injectSymbols = {
 *     a2aHandler: TYPES.IA2AHandler,
 *   } as const;
 *   // ...
 * }
 * ```
 *
 * @module A2ATaskComponent
 */

import { Container } from 'inversify';
import {
  ToolComponent,
  ExportOptions,
  type ExportResult,
  type InjectSymbolsMap,
} from '../core/toolComponent.js';
import type { Tool, ToolCallResult } from '../core/types.js';
import type { TUIElement } from '../ui/TUIElement.js';
import { tdiv, th } from '../ui/index.js';
import { TYPES } from '../../core/di/types.js';
import type { IA2AHandler, PendingTask } from '../../core/a2a/A2AHandler.js';
import type { IA2AClient } from '../../core/a2a/A2AClient.js';
import type { A2ATaskStatus } from '../../core/a2a/types.js';
import {
  a2aTaskToolSchemas,
  type A2ATaskToolName,
  type AcknowledgeTaskParams,
  type CompleteTaskParams,
  type FailTaskParams,
  type SendTaskResultParams,
  type SendTaskParams,
  type A2ATaskToolReturnTypes,
} from './a2aTaskSchemas.js';

/**
 * A2ATaskComponent - Tools for managing A2A task acknowledgment
 */
export class A2ATaskComponent extends ToolComponent {
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

**Critical:**
- The conversationId is a unique ID like "conv_1234567890_abc123", NOT the task description
- ALWAYS call getPendingTasks first to get the correct conversationId before calling acknowledgeTask
- NEVER make up or guess a conversationId - use the value from getPendingTasks
- Always acknowledge tasks before processing to prevent sender timeout`;

  static override readonly injectSymbols: InjectSymbolsMap = {
    a2aHandler: TYPES.IA2AHandler,
    a2aClient: TYPES.IA2AClient,
  };

  private _a2aHandler!: IA2AHandler;
  private _a2aClient!: IA2AClient;
  // Note: _a2aHandler and _a2aClient are auto-injected by base class via injectSymbols
  // Both are REQUIRED dependencies - component cannot function without them

  override toolSet: Map<string, Tool>;

  constructor() {
    super();
    this.toolSet = this.initializeToolSet();
  }

  /**
   * Inject dependencies from DI container
   * A2AHandler and A2AClient are bound to container during initialization,
   * so they should be available when injectDependencies is called.
   */
  protected override injectDependencies(container: Container): void {
    super.injectDependencies(container);
  }

  /**
   * Get the A2A Handler
   * Note: A2AHandler is initialized and bound to container before this component is created
   */
  private getA2AHandler(): IA2AHandler {
    return this._a2aHandler;
  }

  /**
   * Get the A2A Client
   * Note: A2AClient is initialized and bound to container before this component is created
   */
  private getA2AClient(): IA2AClient {
    return this._a2aClient;
  }

  /**
   * Initialize the tool set
   */
  private initializeToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    const toolEntries: [
      string,
      (typeof a2aTaskToolSchemas)[keyof typeof a2aTaskToolSchemas],
    ][] = [
      ['acknowledgeTask', a2aTaskToolSchemas.acknowledgeTask],
      ['completeTask', a2aTaskToolSchemas.completeTask],
      ['failTask', a2aTaskToolSchemas.failTask],
      ['sendTaskResult', a2aTaskToolSchemas.sendTaskResult],
      ['getPendingTasks', a2aTaskToolSchemas.getPendingTasks],
      ['sendTask', a2aTaskToolSchemas.sendTask],
    ];

    toolEntries.forEach(([name, toolDef]) => {
      tools.set(name, {
        toolName: toolDef.toolName,
        desc: toolDef.desc,
        paramsSchema: toolDef.paramsSchema,
      });
    });

    return tools;
  }

  /**
   * Handle tool calls from the LLM
   */
  handleToolCall: {
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

  /**
   * Render the tool section UI
   */
  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];

    elements.push(
      new th({
        content: 'A2A Task Manager',
        styles: { align: 'center' },
      }),
    );

    try {
      const pending = this.getA2AHandler().getPendingTasks();

      if (pending.length === 0) {
        elements.push(new tdiv({ content: 'No pending tasks' }));
      } else {
        const acknowledged = pending.filter((t) => t.acknowledged).length;
        const pendingCount = pending.length - acknowledged;
        elements.push(
          new tdiv({
            content: `Pending: ${pendingCount} | Acknowledged: ${acknowledged}`,
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
      elements.push(new tdiv({ content: 'Unable to get pending tasks' }));
    }

    return elements;
  };

  /**
   * Export component data
   */
  async exportData(_options?: ExportOptions): Promise<ExportResult> {
    try {
      const pending = this.getA2AHandler().getPendingTasks();
      return {
        data: {
          pendingTasks: pending,
          count: pending.length,
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

  /**
   * Handle acknowledgeTask tool call
   */
  private async handleAcknowledgeTask(
    params: AcknowledgeTaskParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      await this.getA2AHandler().acknowledge(params.conversationId);
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

  /**
   * Handle completeTask tool call
   */
  private async handleCompleteTask(
    params: CompleteTaskParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      // Signal task completion via callback (waits for result)
      // The actual result sending is handled by the task handler
      this.getA2AHandler().completeTask(
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

  /**
   * Handle failTask tool call
   */
  private async handleFailTask(
    params: FailTaskParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      // Signal task failure via callback
      this.getA2AHandler().completeTask(
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

  /**
   * Handle sendTaskResult tool call
   */
  private async handleSendTaskResult(
    params: SendTaskResultParams,
  ): Promise<ToolCallResult<{ success: boolean; conversationId: string }>> {
    try {
      const status: A2ATaskStatus = params.status || 'completed';
      await this.getA2AHandler().sendTaskResult(
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

  /**
   * Handle getPendingTasks tool call
   */
  private async handleGetPendingTasks(): Promise<
    ToolCallResult<{ tasks: PendingTask[] }>
  > {
    try {
      const pending = this.getA2AHandler().getPendingTasks();
      const formattedTasks = pending.map((task) => ({
        ...task,
        displayId: task.acknowledged
          ? `[ACK] ${task.conversationId}`
          : task.conversationId,
      }));
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

  /**
   * Handle sendTask tool call
   */
  private async handleSendTask(params: SendTaskParams): Promise<
    ToolCallResult<{
      success: boolean;
      result?: {
        taskId: string;
        status: string;
        output?: unknown;
        error?: string;
      };
      error?: string;
    }>
  > {
    try {
      const result = await this.getA2AClient().sendTask(
        params.targetAgentId,
        params.taskId,
        params.description,
        params.input ?? {},
        { priority: params.priority ?? 'normal' },
      );
      return {
        success: true,
        data: {
          success: true,
          result: {
            taskId: result.taskId,
            status: result.status,
            output: result.output,
            error: result.error,
          },
        },
        summary: `[A2A Task] Sent task ${params.taskId} to ${params.targetAgentId}: ${result.status}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as { success: boolean; error: string },
        summary: `[A2A Task] Failed to send task: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
}
