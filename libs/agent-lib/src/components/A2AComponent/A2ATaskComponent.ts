import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ToolComponent } from '../core/toolComponent.js';
import type { ExportResult } from '../core/toolComponent.js';
import type { ToolCallResult } from '../core/types.js';
import type { TUIElement } from '../ui/TUIElement.js';
import { tdiv, th } from '../ui/index.js';
import { TYPES } from '../../core/di/types.js';
import type { IA2AHandler } from '../../core/a2a/A2AHandler.js';
import type { IA2AClient } from '../../core/a2a/A2AClient.js';
import type { A2ATaskResult } from '../../core/a2a/types.js';
import type { IAgentSleepControl } from '../../core/runtime/AgentSleepControl.js';

const MAX_SUMMARY_LENGTH = 500;

function summarizeResult(data: unknown): string | undefined {
  if (data === undefined || data === null) return undefined;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  if (!str) return undefined;
  return str.length > MAX_SUMMARY_LENGTH
    ? str.slice(0, MAX_SUMMARY_LENGTH) + '...(truncated)'
    : str;
}

function summarizeOutput(result?: A2ATaskResult): string | undefined {
  if (!result?.output) return undefined;
  return summarizeResult(result.output);
}
import { getGlobalAgentRegistry } from '../../core/a2a/index.js';
import type { IAgentCardRegistry } from '../../core/a2a/AgentCard.js';
import {
  a2aTaskToolSchemas,
  type A2ATaskToolReturnTypes,
  type AcknowledgeTaskParams,
  type CompleteTaskParams,
  type FailTaskParams,
  type SendTaskParams,
  type SendQueryParams,
  type WaitForResultParams,
  type CancelTaskParams,
  type DiscoverAgentsParams,
  type SentTaskInfo,
  type IncomingTaskInfo,
} from './a2aTaskSchemas.js';

interface A2ATaskState {
  sentTasks: Record<string, SentTaskInfo>;
  incomingTasks: Record<string, IncomingTaskInfo>;
}

@injectable()
export class A2ATaskComponent extends ToolComponent<A2ATaskState> {
  override componentId = 'a2a-task';
  override displayName = 'Agent Mailbox';
  override description =
    'Agent-to-Agent collaboration: inbox, task delegation, and agent discovery';
  override componentPrompt = `
You have an Agent Mailbox for collaborating with other agents. Think of it as your work email + contacts.

**At the start of every turn, call checkInbox first** to see if new tasks arrived.

## Receiving tasks (Inbox)

1. checkInbox — view all incoming tasks grouped by status
2. acknowledgeTask — accept a task (tells the sender you're working on it)
3. completeTask — send back the result
4. failTask — report that you cannot complete the task

**Important:** Always acknowledge a task before processing it. Use the exact conversationId from checkInbox — never guess.

## Delegating tasks (Sent)

1. discoverAgents — find which agents can handle your task
2. sendTask — delegate work asynchronously (returns immediately after ACK)
3. sendQuery — ask a quick question and get an immediate response
4. checkSent — view status of all delegated tasks
5. waitForResult — sleep until a delegated task completes
6. cancelTask — cancel an in-flight task

**Workflow:** discoverAgents → sendTask → (continue other work) → waitForResult → use result

## Contacts

- discoverAgents — search agents by capability or skill`;

  protected a2aHandler: IA2AHandler;
  protected a2aClient: IA2AClient;
  protected sleepControl: IAgentSleepControl;
  private agentRegistry: IAgentCardRegistry;

  constructor(
    @inject(TYPES.IA2AHandler) a2aHandler: IA2AHandler,
    @inject(TYPES.IA2AClient) a2aClient: IA2AClient,
    @inject(TYPES.AgentSleepControl) sleepControl: IAgentSleepControl,
  ) {
    super();
    this.a2aHandler = a2aHandler;
    this.a2aClient = a2aClient;
    this.sleepControl = sleepControl;
    this.agentRegistry = getGlobalAgentRegistry();
  }

  protected override initialState(): A2ATaskState {
    return { sentTasks: {}, incomingTasks: {} };
  }

  protected override toolDefs() {
    return {
      checkInbox: {
        desc: a2aTaskToolSchemas.checkInbox.desc,
        paramsSchema: a2aTaskToolSchemas.checkInbox.paramsSchema,
      },
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
      sendTask: {
        desc: a2aTaskToolSchemas.sendTask.desc,
        paramsSchema: a2aTaskToolSchemas.sendTask.paramsSchema,
      },
      sendQuery: {
        desc: a2aTaskToolSchemas.sendQuery.desc,
        paramsSchema: a2aTaskToolSchemas.sendQuery.paramsSchema,
      },
      checkSent: {
        desc: a2aTaskToolSchemas.checkSent.desc,
        paramsSchema: a2aTaskToolSchemas.checkSent.paramsSchema,
      },
      waitForResult: {
        desc: a2aTaskToolSchemas.waitForResult.desc,
        paramsSchema: a2aTaskToolSchemas.waitForResult.paramsSchema,
      },
      cancelTask: {
        desc: a2aTaskToolSchemas.cancelTask.desc,
        paramsSchema: a2aTaskToolSchemas.cancelTask.paramsSchema,
      },
      discoverAgents: {
        desc: a2aTaskToolSchemas.discoverAgents.desc,
        paramsSchema: a2aTaskToolSchemas.discoverAgents.paramsSchema,
      },
    };
  }

  // ===========================================================================
  // INBOX
  // ===========================================================================

  async onCheckInbox(): Promise<
    ToolCallResult<A2ATaskToolReturnTypes['checkInbox']>
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
        } as A2ATaskToolReturnTypes['checkInbox'] & { error: string },
        summary: `[Inbox] Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onAcknowledgeTask(
    params: AcknowledgeTaskParams,
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['acknowledgeTask']>> {
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
        } as A2ATaskToolReturnTypes['acknowledgeTask'] & { error: string },
        summary: `[Inbox] Failed to acknowledge: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onCompleteTask(
    params: CompleteTaskParams,
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['completeTask']>> {
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
        } as A2ATaskToolReturnTypes['completeTask'] & { error: string },
        summary: `[Inbox] Failed to complete: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onFailTask(
    params: FailTaskParams,
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['failTask']>> {
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
        } as A2ATaskToolReturnTypes['failTask'] & { error: string },
        summary: `[Inbox] Failed to report failure: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  // ===========================================================================
  // SENT
  // ===========================================================================

  async onSendTask(
    params: SendTaskParams,
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['sendTask']>> {
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
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['sendQuery']>> {
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
        } as A2ATaskToolReturnTypes['sendQuery'] & { error: string },
        summary: `[Sent] Query failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  async onCheckSent(): Promise<
    ToolCallResult<A2ATaskToolReturnTypes['checkSent']>
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
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['waitForResult']>> {
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
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['cancelTask']>> {
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
        } as A2ATaskToolReturnTypes['cancelTask'] & { error: string },
        summary: `[Sent] Failed to cancel: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  // ===========================================================================
  // CONTACTS
  // ===========================================================================

  async onDiscoverAgents(
    params: DiscoverAgentsParams,
  ): Promise<ToolCallResult<A2ATaskToolReturnTypes['discoverAgents']>> {
    try {
      let agents;
      if (params.capability) {
        agents = this.agentRegistry.findByCapability(params.capability);
      } else if (params.skill) {
        agents = this.agentRegistry.findBySkill(params.skill);
      } else {
        agents = this.agentRegistry.getAllAgents();
      }

      const summary = agents.map((a) => ({
        instanceId: a.instanceId,
        alias: a.alias,
        name: a.name,
        capabilities: a.capabilities,
        skills: a.skills,
      }));

      return {
        success: true,
        data: { agents: summary, total: summary.length },
        summary: `[Contacts] Found ${summary.length} agent(s)${params.capability ? ` with capability "${params.capability}"` : params.skill ? ` with skill "${params.skill}"` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          agents: [],
          total: 0,
          error: error instanceof Error ? error.message : String(error),
        } as A2ATaskToolReturnTypes['discoverAgents'] & { error: string },
        summary: `[Contacts] Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
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
        resultSummary: summarizeOutput(result),
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
        content: 'Agent Mailbox',
        styles: { align: 'center' },
      }),
    );

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
            content: `  ✓ [DONE] ${t.description} -> ${t.targetAgentName ?? t.targetAgentId} (${elapsed})`,
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

    const totalAgents = this.agentRegistry.size;
    if (totalAgents > 0) {
      const summaries = this.agentRegistry.getAgentSummaries();
      elements.push(
        new th({
          content: `CONTACTS (${totalAgents} agents)`,
          styles: { align: 'left' },
        }),
      );
      for (const a of summaries) {
        elements.push(
          new tdiv({
            content: `  ${a.alias ?? a.instanceId} (${a.name}) [${a.capabilities.join(', ')}]`,
          }),
        );
      }
    }

    if (!hasInbox && !hasSent && totalAgents === 0) {
      elements.push(new tdiv({ content: 'No activity' }));
    }

    return elements;
  };

  // ===========================================================================
  // Export
  // ===========================================================================

  override async exportData(_options?: any): Promise<ExportResult> {
    try {
      const sentTasks = Object.values(this.snapshot.sentTasks);
      const incomingTasks = Object.values(this.snapshot.incomingTasks);
      return {
        data: {
          sentTasks,
          incomingTasks,
          inFlightCount: sentTasks.filter((t) => t.status === 'in-flight')
            .length,
          completedCount: sentTasks.filter((t) => t.status === 'completed')
            .length,
          failedCount: sentTasks.filter(
            (t) => t.status === 'failed' || t.status === 'timeout',
          ).length,
          cancelledCount: sentTasks.filter((t) => t.status === 'cancelled')
            .length,
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
