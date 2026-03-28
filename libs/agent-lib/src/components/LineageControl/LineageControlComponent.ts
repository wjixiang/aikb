import 'reflect-metadata';
import { injectable, inject, optional } from 'inversify';
import { ToolComponent, type ExportResult } from '../core/toolComponent.js';
import type { ToolCallResult } from '../core/types.js';
import type { TUIElement } from '../ui/TUIElement.js';
import { tdiv, th } from '../ui/index.js';
import { TYPES } from '../../core/di/types.js';
import type { IA2AHandler } from '../../core/a2a/A2AHandler.js';
import type { IA2AClient } from '../../core/a2a/A2AClient.js';
import type { IAgentSleepControl } from '../../core/runtime/AgentSleepControl.js';
import type { RuntimeControlState } from '../../core/runtime/RuntimeControlState.js';
import type { IRuntimeControlClient } from '../../core/runtime/types.js';
import type { AgentLineageInfo } from '../../core/runtime/types.js';
import type { AgentMetadata } from '../../core/runtime/types.js';
import { getGlobalAgentRegistry } from '../../core/a2a/index.js';
import type { IAgentCardRegistry } from '../../core/a2a/AgentCard.js';
import {
  lineageControlToolSchemas,
  type LineageControlToolReturnTypes,
  type AcknowledgeTaskParams,
  type CompleteTaskParams,
  type FailTaskParams,
  type SendTaskParams,
  type SendQueryParams,
  type WaitForResultParams,
  type CancelTaskParams,
  type CreateAgentByTypeParams,
  type StartAgentParams,
  type StopAgentParams,
  type DestroyAgentParams,
  type ListChildAgentsParams,
  type ListAllowedSoulsParams,
  type GetMyInfoParams,
  type GetStatsParams,
  type SentTaskInfo,
  type IncomingTaskInfo,
} from './lineageControlSchemas.js';

const MAX_SUMMARY_LENGTH = 500;

function summarizeResult(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (!str) return undefined;
  return str.length > MAX_SUMMARY_LENGTH
    ? str.slice(0, MAX_SUMMARY_LENGTH) + '...(truncated)'
    : str;
}

function summarizeOutput(result?: { output?: unknown }): string | undefined {
  if (!result?.output) return undefined;
  return summarizeResult(result.output);
}

interface ChildAgentRecord {
  instanceId: string;
  name?: string;
  soulType?: string;
  createdAt: number;
}

interface LineageControlState {
  sentTasks: Record<string, SentTaskInfo>;
  incomingTasks: Record<string, IncomingTaskInfo>;
  childAgents: Record<string, ChildAgentRecord>;
}

@injectable()
export class LineageControlComponent extends ToolComponent<LineageControlState> {
  override componentId = 'lineage-control';
  override displayName = 'Lineage Control';
  override description =
    'Unified component for agent inbox, task delegation, and lineage-based agent lifecycle management';

  override get componentPrompt(): string {
    if (!this.lineage) {
      return this.noLineagePrompt;
    }
    if (this.lineage.role === 'worker') {
      return this.workerPrompt;
    }
    return this.coordinatorPrompt;
  }

  protected a2aHandler: IA2AHandler;
  protected a2aClient: IA2AClient;
  protected sleepControl: IAgentSleepControl;
  private agentRegistry: IAgentCardRegistry;
  private runtimeClient?: IRuntimeControlClient;
  protected lineage?: AgentLineageInfo;

  constructor(
    @inject(TYPES.AgentInstanceId) private instanceId: string,
    @inject(TYPES.IA2AHandler) a2aHandler: IA2AHandler,
    @inject(TYPES.IA2AClient) a2aClient: IA2AClient,
    @inject(TYPES.AgentSleepControl) sleepControl: IAgentSleepControl,
    @inject(TYPES.RuntimeControlState)
    @optional()
    runtimeState?: RuntimeControlState,
    @inject(TYPES.AgentLineageInfo)
    @optional()
    lineage?: AgentLineageInfo,
  ) {
    super();
    this.a2aHandler = a2aHandler;
    this.a2aClient = a2aClient;
    this.sleepControl = sleepControl;
    this.agentRegistry = getGlobalAgentRegistry();
    this.runtimeClient = runtimeState?.getRuntimeClient();
    this.lineage = lineage;
  }

  protected override initialState(): LineageControlState {
    return { sentTasks: {}, incomingTasks: {}, childAgents: {} };
  }

  protected override toolDefs() {
    const tools: Record<string, { desc: string; paramsSchema: any }> = {
      checkInbox: {
        desc: lineageControlToolSchemas.checkInbox.desc,
        paramsSchema: lineageControlToolSchemas.checkInbox.paramsSchema,
      },
      acknowledgeTask: {
        desc: lineageControlToolSchemas.acknowledgeTask.desc,
        paramsSchema: lineageControlToolSchemas.acknowledgeTask.paramsSchema,
      },
      completeTask: {
        desc: lineageControlToolSchemas.completeTask.desc,
        paramsSchema: lineageControlToolSchemas.completeTask.paramsSchema,
      },
      failTask: {
        desc: lineageControlToolSchemas.failTask.desc,
        paramsSchema: lineageControlToolSchemas.failTask.paramsSchema,
      },
    };

    if (!this.lineage || this.lineage.role !== 'worker') {
      Object.assign(tools, {
        sendTask: {
          desc: lineageControlToolSchemas.sendTask.desc,
          paramsSchema: lineageControlToolSchemas.sendTask.paramsSchema,
        },
        sendQuery: {
          desc: lineageControlToolSchemas.sendQuery.desc,
          paramsSchema: lineageControlToolSchemas.sendQuery.paramsSchema,
        },
        checkSent: {
          desc: lineageControlToolSchemas.checkSent.desc,
          paramsSchema: lineageControlToolSchemas.checkSent.paramsSchema,
        },
        waitForResult: {
          desc: lineageControlToolSchemas.waitForResult.desc,
          paramsSchema: lineageControlToolSchemas.waitForResult.paramsSchema,
        },
        cancelTask: {
          desc: lineageControlToolSchemas.cancelTask.desc,
          paramsSchema: lineageControlToolSchemas.cancelTask.paramsSchema,
        },
        listChildAgents: {
          desc: lineageControlToolSchemas.listChildAgents.desc,
          paramsSchema: lineageControlToolSchemas.listChildAgents.paramsSchema,
        },
        createAgentByType: {
          desc: lineageControlToolSchemas.createAgentByType.desc,
          paramsSchema:
            lineageControlToolSchemas.createAgentByType.paramsSchema,
        },
        startAgent: {
          desc: lineageControlToolSchemas.startAgent.desc,
          paramsSchema: lineageControlToolSchemas.startAgent.paramsSchema,
        },
        stopAgent: {
          desc: lineageControlToolSchemas.stopAgent.desc,
          paramsSchema: lineageControlToolSchemas.stopAgent.paramsSchema,
        },
        destroyAgent: {
          desc: lineageControlToolSchemas.destroyAgent.desc,
          paramsSchema: lineageControlToolSchemas.destroyAgent.paramsSchema,
        },
        listAllowedSouls: {
          desc: lineageControlToolSchemas.listAllowedSouls.desc,
          paramsSchema: lineageControlToolSchemas.listAllowedSouls.paramsSchema,
        },
        getMyInfo: {
          desc: lineageControlToolSchemas.getMyInfo.desc,
          paramsSchema: lineageControlToolSchemas.getMyInfo.paramsSchema,
        },
        getStats: {
          desc: lineageControlToolSchemas.getStats.desc,
          paramsSchema: lineageControlToolSchemas.getStats.paramsSchema,
        },
      });
    }

    return tools;
  }

  // ===========================================================================
  // INBOX
  // ===========================================================================

  async onCheckInbox(): Promise<
    ToolCallResult<LineageControlToolReturnTypes['checkInbox']>
  > {
    try {
      const handlerPending = this.a2aHandler.getPendingTasks();

      for (const task of handlerPending) {
        if (this.snapshot.incomingTasks[task.conversationId]) continue;

        const fromAgent = this.agentRegistry.getAgent(task.from);
        this.reactive.incomingTasks[task.conversationId] = {
          conversationId: task.conversationId,
          from: task.from,
          fromAgentName: fromAgent?.name ?? task.from,
          description:
            task.payload.description ?? task.payload.taskId ?? 'Unknown task',
          priority:
            (task.payload.metadata?.[
              'priority'
            ] as IncomingTaskInfo['priority']) ?? 'normal',
          status: task.acknowledged ? 'acknowledged' : 'pending',
          receivedAt: task.receivedAt,
          acknowledgedAt: task.acknowledged ? Date.now() : undefined,
        };
      }

      const all = Object.values(this.snapshot.incomingTasks);
      const pending = all.filter((t) => t.status === 'pending');
      const acknowledged = all.filter((t) => t.status === 'acknowledged');
      const completed = all.filter((t) => t.status === 'completed');
      const failed = all.filter((t) => t.status === 'failed');

      return {
        success: true,
        data: { pending, acknowledged, completed, failed, total: all.length },
        summary: `[Inbox] ${pending.length} pending, ${acknowledged.length} processing, ${completed.length} completed, ${failed.length} failed (total: ${all.length})`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          pending: [],
          acknowledged: [],
          completed: [],
          failed: [],
          total: 0,
          error: error instanceof Error ? error.message : String(error),
        } as LineageControlToolReturnTypes['checkInbox'] & { error: string },
        summary: `[Inbox] Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onAcknowledgeTask(
    params: AcknowledgeTaskParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['acknowledgeTask']>> {
    try {
      await this.a2aHandler.acknowledge(params.conversationId);

      const incoming = this.reactive.incomingTasks[params.conversationId];
      if (incoming && incoming.status === 'pending') {
        incoming.status = 'acknowledged';
        incoming.acknowledgedAt = Date.now();
      }

      return {
        success: true,
        data: { success: true, conversationId: params.conversationId },
        summary: `[Inbox] Acknowledged task: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as LineageControlToolReturnTypes['acknowledgeTask'] & {
          error: string;
        },
        summary: `[Inbox] Failed to acknowledge: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onCompleteTask(
    params: CompleteTaskParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['completeTask']>> {
    try {
      this.a2aHandler.completeTask(
        params.conversationId,
        params.output,
        'completed',
      );

      const incoming = this.reactive.incomingTasks[params.conversationId];
      if (incoming) {
        incoming.status = 'completed';
        incoming.completedAt = Date.now();
        incoming.resultSummary = summarizeResult(params.output);
      }

      return {
        success: true,
        data: { success: true, conversationId: params.conversationId },
        summary: `[Inbox] Completed task: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as LineageControlToolReturnTypes['completeTask'] & { error: string },
        summary: `[Inbox] Failed to complete: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onFailTask(
    params: FailTaskParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['failTask']>> {
    try {
      this.a2aHandler.completeTask(
        params.conversationId,
        { error: params.error },
        'failed',
      );

      const incoming = this.reactive.incomingTasks[params.conversationId];
      if (incoming) {
        incoming.status = 'failed';
        incoming.completedAt = Date.now();
        incoming.error = params.error;
      }

      return {
        success: true,
        data: { success: true, conversationId: params.conversationId },
        summary: `[Inbox] Failed task: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as LineageControlToolReturnTypes['failTask'] & { error: string },
        summary: `[Inbox] Failed to report failure: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  // ===========================================================================
  // SENT (coordinator only)
  // ===========================================================================

  async onSendTask(
    params: SendTaskParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['sendTask']>> {
    try {
      const conversationId = await this.a2aClient.sendTaskAndWaitForAck(
        params.targetAgentId,
        params.taskId,
        params.description,
        params.input ?? {},
        { priority: params.priority ?? 'normal' },
      );

      const targetAgent = this.agentRegistry.getAgent(params.targetAgentId);

      const sentTask: SentTaskInfo = {
        taskId: params.taskId,
        conversationId,
        targetAgentId: params.targetAgentId,
        targetAgentName: targetAgent?.name ?? params.targetAgentId,
        description: params.description,
        status: 'in-flight',
        sentAt: Date.now(),
        acknowledgedAt: Date.now(),
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
        summary: `[Sent] Delegated ${params.taskId} to ${targetAgent?.name ?? params.targetAgentId} (ACK received)`,
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
        summary: `[Sent] Failed to delegate: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onSendQuery(
    params: SendQueryParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['sendQuery']>> {
    try {
      const output = await this.a2aClient.sendQuery(
        params.targetAgentId,
        params.query,
      );

      return {
        success: true,
        data: { success: true, from: params.targetAgentId, output },
        summary: `[Sent] Query to ${params.targetAgentId}: got response`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          from: params.targetAgentId,
          error: error instanceof Error ? error.message : String(error),
        } as LineageControlToolReturnTypes['sendQuery'] & { error: string },
        summary: `[Sent] Query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onCheckSent(): Promise<
    ToolCallResult<LineageControlToolReturnTypes['checkSent']>
  > {
    const tasks = Object.values(this.snapshot.sentTasks);
    return {
      success: true,
      data: {
        tasks,
        inFlightCount: tasks.filter((t) => t.status === 'in-flight').length,
        completedCount: tasks.filter((t) => t.status === 'completed').length,
        failedCount: tasks.filter(
          (t) => t.status === 'failed' || t.status === 'timeout',
        ).length,
      },
      summary: `[Sent] ${tasks.length} tasks (${tasks.filter((t) => t.status === 'in-flight').length} in-flight, ${tasks.filter((t) => t.status === 'completed').length} completed, ${tasks.filter((t) => t.status === 'failed' || t.status === 'timeout').length} failed)`,
    };
  }

  async onWaitForResult(
    params: WaitForResultParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['waitForResult']>> {
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
        summary: `[Sent] No sent task found for conversationId: ${params.conversationId}`,
      };
    }

    if (sentTask.status === 'completed') {
      return {
        success: true,
        data: {
          success: true,
          conversationId: params.conversationId,
          resultSummary: sentTask.resultSummary,
        },
        summary: `[Sent] Task already completed: ${params.conversationId}`,
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
        summary: `[Sent] Task already ${sentTask.status}: ${params.conversationId}`,
      };
    }

    if (sentTask.status === 'cancelled') {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: 'Task was cancelled',
        },
        summary: `[Sent] Task was cancelled: ${params.conversationId}`,
      };
    }

    try {
      await this.sleepControl.sleep(
        `Waiting for A2A result: ${params.conversationId}`,
      );

      const task = this.snapshot.sentTasks[sentTask.taskId];
      if (task && task.status === 'completed') {
        return {
          success: true,
          data: {
            success: true,
            conversationId: params.conversationId,
            resultSummary: task.resultSummary,
          },
          summary: `[Sent] Woke up, result received: ${params.conversationId}`,
        };
      }

      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: task?.error ?? 'Woken up without result (possibly aborted)',
        },
        summary: `[Sent] Woken up without result: ${params.conversationId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        },
        summary: `[Sent] Failed to wait: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onCancelTask(
    params: CancelTaskParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['cancelTask']>> {
    try {
      const sentTask = Object.values(this.snapshot.sentTasks).find(
        (t) => t.conversationId === params.conversationId,
      );

      if (!sentTask) {
        return {
          success: false,
          data: {
            success: false,
            conversationId: params.conversationId,
          },
          summary: `[Sent] No sent task found for conversationId: ${params.conversationId}`,
        };
      }

      if (sentTask.status !== 'in-flight') {
        return {
          success: false,
          data: {
            success: false,
            conversationId: params.conversationId,
          },
          summary: `[Sent] Task is not in-flight (current: ${sentTask.status})`,
        };
      }

      await this.a2aClient.sendCancel(
        sentTask.targetAgentId,
        sentTask.taskId,
        sentTask.conversationId,
      );

      this.reactive.sentTasks[sentTask.taskId] = {
        ...sentTask,
        status: 'cancelled',
        cancelledAt: Date.now(),
      };

      if (this.sleepControl.isSleeping()) {
        this.sleepControl.wakeUp(undefined);
      }

      return {
        success: true,
        data: { success: true, conversationId: params.conversationId },
        summary: `[Sent] Cancelled task ${sentTask.taskId}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          success: false,
          conversationId: params.conversationId,
          error: error instanceof Error ? error.message : String(error),
        } as LineageControlToolReturnTypes['cancelTask'] & { error: string },
        summary: `[Sent] Failed to cancel: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  // ===========================================================================
  // LIFECYCLE (coordinator only)
  // ===========================================================================

  private noClient<T = unknown>(): ToolCallResult<T> {
    return {
      success: false,
      data: {
        error:
          'Runtime control client not available. Agent must have lineage info.',
      } as T,
      summary: '[Lifecycle] Runtime control client not available',
    };
  }

  private clientError<T = unknown>(error: unknown): ToolCallResult<T> {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: { error: msg } as T,
      summary: `[Lifecycle] Failed: ${msg}`,
    };
  }

  async onListChildAgents(): Promise<
    ToolCallResult<LineageControlToolReturnTypes['listChildAgents']>
  > {
    if (!this.runtimeClient) return this.noClient();
    try {
      const children = await this.runtimeClient.listChildAgents();
      const agents = children.map((c) => ({
        instanceId: c.instanceId,
        alias: c.alias,
        name: c.name,
        status: c.status,
        agentType: c.agentType,
      }));
      return {
        success: true,
        data: { agents },
        summary: `[Lifecycle] Listed ${agents.length} child agent(s)`,
      };
    } catch (error) {
      return this.clientError(error);
    }
  }

  async onCreateAgentByType(
    params: CreateAgentByTypeParams,
  ): Promise<
    ToolCallResult<LineageControlToolReturnTypes['createAgentByType']>
  > {
    if (!this.runtimeClient) return this.noClient();
    try {
      const instanceId = await this.runtimeClient.createAgent({
        agent: {
          type: params.soulType,
          name: params.name || params.soulType,
        },
      });

      this.reactive.childAgents[instanceId] = {
        instanceId,
        name: params.name || params.soulType,
        soulType: params.soulType,
        createdAt: Date.now(),
      };

      return {
        success: true,
        data: {
          success: true,
          instanceId,
          name: params.name || params.soulType,
          soulType: params.soulType,
        },
        summary: `[Lifecycle] Created ${params.name || params.soulType} (${instanceId.slice(0, 8)})`,
      };
    } catch (error) {
      return this.clientError(error);
    }
  }

  async onStartAgent(
    params: StartAgentParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['startAgent']>> {
    if (!this.runtimeClient) return this.noClient();
    try {
      await this.runtimeClient.startAgent(params.agentId);
      return {
        success: true,
        data: { success: true },
        summary: `[Lifecycle] Started agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.clientError(error);
    }
  }

  async onStopAgent(
    params: StopAgentParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['stopAgent']>> {
    if (!this.runtimeClient) return this.noClient();
    try {
      await this.runtimeClient.stopAgent(params.agentId);
      return {
        success: true,
        data: { success: true },
        summary: `[Lifecycle] Stopped agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.clientError(error);
    }
  }

  async onDestroyAgent(
    params: DestroyAgentParams,
  ): Promise<ToolCallResult<LineageControlToolReturnTypes['destroyAgent']>> {
    if (!this.runtimeClient) return this.noClient();
    try {
      await this.runtimeClient.destroyAgent(params.agentId, {
        cascade: params.cascade,
      });
      delete this.reactive.childAgents[params.agentId];
      return {
        success: true,
        data: { success: true },
        summary: `[Lifecycle] Destroyed agent: ${params.agentId}`,
      };
    } catch (error) {
      return this.clientError(error);
    }
  }

  // ===========================================================================
  // DISCOVERY (coordinator only)
  // ===========================================================================

  async onListAllowedSouls(): Promise<
    ToolCallResult<LineageControlToolReturnTypes['listAllowedSouls']>
  > {
    const souls = this.lineage?.allowedChildren ?? [];
    return {
      success: true,
      data: { souls },
      summary: `[Discovery] ${souls.length} allowed soul type(s)`,
    };
  }

  async onGetMyInfo(): Promise<
    ToolCallResult<LineageControlToolReturnTypes['getMyInfo']>
  > {
    const parentInstanceId = this.runtimeClient?.getParentInstanceId();
    return {
      success: true,
      data: {
        instanceId: this.instanceId,
        role: this.lineage?.role,
        schemaId: this.lineage?.schemaId,
        nodeId: this.lineage?.nodeId,
        allowedChildren: this.lineage?.allowedChildren ?? [],
        parentInstanceId,
      },
      summary: `[Info] ${this.instanceId.slice(0, 8)} role=${this.lineage?.role ?? 'none'}`,
    };
  }

  async onGetStats(): Promise<
    ToolCallResult<LineageControlToolReturnTypes['getStats']>
  > {
    if (!this.runtimeClient) return this.noClient();
    try {
      const stats = await this.runtimeClient.getStats();
      return {
        success: true,
        data: stats,
        summary: `[Stats] Total: ${stats.totalAgents}`,
      };
    } catch (error) {
      return this.clientError(error);
    }
  }

  // ===========================================================================
  // Background tracking
  // ===========================================================================

  private async trackSentTaskInfo(sentTask: SentTaskInfo): Promise<void> {
    try {
      const result = await this.a2aClient.waitForResult(
        sentTask.conversationId,
      );

      this.reactive.sentTasks[sentTask.taskId] = {
        ...sentTask,
        status: 'completed',
        resultSummary: summarizeOutput(result as any),
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

  // ===========================================================================
  // Rendering
  // ===========================================================================

  private formatElapsed(ms: number): string {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    return `${min}m${sec % 60}s`;
  }

  override renderImply = async (): Promise<TUIElement[]> => {
    const elements: TUIElement[] = [];
    const incoming = Object.values(this.snapshot.incomingTasks);
    const sent = Object.values(this.snapshot.sentTasks);
    const now = Date.now();

    elements.push(
      new th({
        content: `Lineage Control (${this.lineage?.role ?? 'none'})`,
        styles: { align: 'center' },
      }),
    );
    elements.push(
      new tdiv({ content: `Instance: ${this.instanceId.slice(0, 8)}` }),
    );

    // INBOX
    const inboxPending = incoming.filter((t) => t.status === 'pending');
    const inboxAcked = incoming.filter((t) => t.status === 'acknowledged');
    const inboxDone = incoming.filter((t) => t.status === 'completed');
    const inboxFailed = incoming.filter((t) => t.status === 'failed');

    const hasInbox =
      inboxPending.length > 0 ||
      inboxAcked.length > 0 ||
      inboxDone.length > 0 ||
      inboxFailed.length > 0;

    if (hasInbox) {
      elements.push(
        new th({
          content: `INBOX (${inboxPending.length} pending, ${inboxAcked.length} processing, ${inboxDone.length} done, ${inboxFailed.length} failed)`,
          styles: { align: 'left' },
        }),
      );

      for (const t of inboxPending) {
        const elapsed = this.formatElapsed(now - t.receivedAt);
        elements.push(
          new tdiv({
            content: `  [PENDING]  [${t.priority}] ${t.description} — from ${t.fromAgentName ?? t.from} (${elapsed} ago)`,
          }),
        );
      }

      for (const t of inboxAcked) {
        const elapsed = t.acknowledgedAt
          ? this.formatElapsed(now - t.acknowledgedAt)
          : '?';
        elements.push(
          new tdiv({
            content: `  [PROCESSING] [${t.priority}] ${t.description} — from ${t.fromAgentName ?? t.from} (acking ${elapsed} ago)`,
          }),
        );
      }

      for (const t of inboxDone.slice(-3)) {
        const elapsed = t.completedAt
          ? this.formatElapsed(t.completedAt - t.receivedAt)
          : '?';
        elements.push(
          new tdiv({
            content: `  [DONE] ${t.description} — from ${t.fromAgentName ?? t.from} (${elapsed})`,
          }),
        );
      }

      for (const t of inboxFailed.slice(-3)) {
        elements.push(
          new tdiv({
            content: `  [FAILED] ${t.description} — from ${t.fromAgentName ?? t.from}: ${t.error ?? 'unknown'}`,
          }),
        );
      }
    }

    // SENT (coordinator only)
    if (this.lineage?.role !== 'worker') {
      const sentInFlight = sent.filter((t) => t.status === 'in-flight');
      const sentDone = sent.filter((t) => t.status === 'completed');
      const sentFailed = sent.filter(
        (t) => t.status === 'failed' || t.status === 'timeout',
      );
      const sentCancelled = sent.filter((t) => t.status === 'cancelled');

      const hasSent =
        sentInFlight.length > 0 ||
        sentDone.length > 0 ||
        sentFailed.length > 0 ||
        sentCancelled.length > 0;

      if (hasSent) {
        elements.push(
          new th({
            content: `SENT (${sentInFlight.length} in-flight, ${sentDone.length} done, ${sentFailed.length} failed, ${sentCancelled.length} cancelled)`,
            styles: { align: 'left' },
          }),
        );

        for (const t of sentInFlight) {
          const elapsed = this.formatElapsed(now - t.sentAt);
          elements.push(
            new tdiv({
              content: `  -> [IN-FLIGHT] ${t.description} -> ${t.targetAgentName ?? t.targetAgentId} (${elapsed} ago)`,
            }),
          );
        }

        for (const t of sentDone.slice(-3)) {
          const elapsed = t.completedAt
            ? this.formatElapsed(t.completedAt - t.sentAt)
            : '?';
          elements.push(
            new tdiv({
              content: `  \u2713 [DONE] ${t.description} -> ${t.targetAgentName ?? t.targetAgentId} (${elapsed})`,
            }),
          );
        }

        for (const t of sentFailed.slice(-3)) {
          elements.push(
            new tdiv({
              content: `  x [FAILED] ${t.description} -> ${t.targetAgentName ?? t.targetAgentId}: ${t.error ?? t.status}`,
            }),
          );
        }

        for (const t of sentCancelled.slice(-2)) {
          elements.push(
            new tdiv({
              content: `  - [CANCELLED] ${t.description} -> ${t.targetAgentName ?? t.targetAgentId}`,
            }),
          );
        }
      }
    }

    // CHILDREN (coordinator only)
    if (this.lineage?.role !== 'worker') {
      const localChildren = Object.values(this.snapshot.childAgents);
      if (localChildren.length > 0) {
        elements.push(
          new th({
            content: `MY CHILDREN (${localChildren.length})`,
            styles: { align: 'left' },
          }),
        );
        for (const child of localChildren) {
          const age = Math.round((Date.now() - child.createdAt) / 1000);
          const suffix = child.soulType ? ` [${child.soulType}]` : '';
          elements.push(
            new tdiv({
              content: `  + ${child.name}${suffix} (${child.instanceId.slice(0, 8)}) ${age}s ago`,
            }),
          );
        }
      }
    }

    if (
      !hasInbox &&
      sent.length === 0 &&
      Object.keys(this.snapshot.childAgents).length === 0
    ) {
      elements.push(new tdiv({ content: 'No activity' }));
    }

    return elements;
  };

  // ===========================================================================
  // Prompts
  // ===========================================================================

  private noLineagePrompt = `## Agent Mailbox
You have an Agent Mailbox for collaborating with other agents.

**At the start of every turn, call checkInbox first** to see if new tasks arrived.

## Receiving tasks (Inbox)
1. checkInbox — view all incoming tasks grouped by status
2. acknowledgeTask — accept a task (tells the sender you're working on it)
3. completeTask — send back the result
4. failTask — report that you cannot complete the task

**Important:** Always acknowledge a task before processing it.

## Delegating tasks (Sent)
1. sendTask — delegate work asynchronously (returns immediately after ACK)
2. sendQuery — ask a quick question and get an immediate response
3. checkSent — view status of all delegated tasks
4. waitForResult — sleep until a delegated task completes
5. cancelTask — cancel an in-flight task

## Agent Management
1. listChildAgents — list your child agents
2. createAgentByType — create a new child agent from a predefined soul
3. startAgent / stopAgent / destroyAgent — lifecycle management
4. listAllowedSouls — see what soul types you can create
5. getMyInfo — your own instance ID and lineage info
6. getStats — runtime statistics`;

  private workerPrompt = `## Task Processing

You are a worker agent. You receive tasks from your coordinator and return results.

**At the start of every turn, call checkInbox first.**

**Workflow:**
1. checkInbox — check for new tasks
2. acknowledgeTask — accept a task
3. Process the task using your domain tools
4. completeTask — return the result
5. failTask — report failure if you cannot complete

You cannot create agents or send tasks to others. Focus on your specialized work.`;

  private get coordinatorPrompt(): string {
    const allowed = (this.lineage?.allowedChildren ?? [])
      .map((c) => c.soulType)
      .join(', ');
    return `## Agent Control Panel

You are a coordinator. You manage child agents and delegate work to them.

**At the start of every turn, call checkInbox first.**

## Receiving tasks
1. checkInbox — check for new tasks from your parent
2. acknowledgeTask → process → completeTask

## Managing child agents (allowed types: [${allowed}])
1. listAllowedSouls — see what types you can create
2. createAgentByType — create a child agent (will auto-start)
3. listChildAgents — see your children
4. stopAgent / destroyAgent — lifecycle management

## Delegating work
1. listChildAgents — find available children
2. sendTask — delegate a task asynchronously
3. sendQuery — ask a quick question
4. checkSent / waitForResult — track progress
5. cancelTask — cancel if needed

## Info
- getMyInfo — your instance ID, role, and lineage
- getStats — runtime statistics

**Important:** Only send tasks to your own child agents.`;
  }

  // ===========================================================================
  // Export
  // ===========================================================================

  override async exportData(_options?: any): Promise<ExportResult> {
    try {
      const sentTasks = Object.values(this.snapshot.sentTasks);
      const incomingTasks = Object.values(this.snapshot.incomingTasks);
      const childAgents = Object.values(this.snapshot.childAgents);
      return {
        data: {
          instanceId: this.instanceId,
          lineage: this.lineage,
          sentTasks,
          incomingTasks,
          childAgents,
          inFlightCount: sentTasks.filter((t) => t.status === 'in-flight')
            .length,
          completedCount: sentTasks.filter((t) => t.status === 'completed')
            .length,
          failedCount: sentTasks.filter(
            (t) => t.status === 'failed' || t.status === 'timeout',
          ).length,
          inboxPendingCount: incomingTasks.filter((t) => t.status === 'pending')
            .length,
          inboxProcessingCount: incomingTasks.filter(
            (t) => t.status === 'acknowledged',
          ).length,
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
}
