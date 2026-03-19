import { injectable, inject, optional } from 'inversify';
import Anthropic from '@anthropic-ai/sdk';
import { ApiMessage, MessageBuilder } from '../memory/types.js';
import type { AgentStatus } from '../common/types.js';
import { MessageTokenUsage, ToolUsage } from '../types/index.js';
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from '../types/index.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { DefaultToolCallConverter } from '../api-client/index.js';
import {
  AgentError,
} from '../common/errors.js';
import { MemoryModule } from '../memory/MemoryModule.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type {
  ThinkingPhaseResult,
  IThinkingModule,
} from '../thinking/types.js';
import type { ThinkingRound } from '../memory/Turn.js';
import type {
  IActionModule,
  ActionPhaseResult,
  ToolResult,
} from '../action/types.js';
import { TYPES } from '../di/types.js';
import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { ILogger } from '../utils/logging/types.js';
import type { Tool } from '../../components/core/types.js';
import { ActionPromptBuilder } from '../prompts/action/index.js';

// Tool result from execution - now defined in action/types.ts
// interface ToolResult {
//     toolName: string;
//     success: boolean;
//     result: any;
//     timestamp: number;
// }

export interface AgentConfig {
  apiRequestTimeout: number;
  maxRetryAttempts: number;
  consecutiveMistakeLimit: number;
  // Memory module configuration (now required, with defaults)
  memory?: Partial<MemoryModuleConfig>;
}

export const defaultAgentConfig: AgentConfig = {
  apiRequestTimeout: 60000,
  maxRetryAttempts: 3,
  consecutiveMistakeLimit: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
};

export class NullCurrentTurnError extends AgentError {
  override code = 'NullCurrentTurnError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Agent class that uses VirtualWorkspace for context management
 *
 * Key features:
 * - Uses VirtualWorkspace instead of WorkspaceBase
 * - Uses script execution (execute_script, attempt_completion) instead of editable props
 * - States are merged from all components in the workspace
 * - Simpler architecture without complex TaskExecutor dependency
 */

/**
 * Abort source types
 */
export type AbortSource = 'user' | 'system' | 'error' | 'timeout' | 'manual';

/**
 * Abort information interface
 */
export interface AbortInfo {
  reason: string;
  timestamp: number;
  source: AbortSource;
  details?: Record<string, unknown>;
}

export interface AgentPrompt {
  capability: string;
  direction: string;
}

/**
 * Mail-driven mode configuration
 */
interface MailDrivenConfig {
  pollInterval: number;
  maxConsecutiveErrors: number;
}

@injectable()
export class Agent {
  workspace: VirtualWorkspace;
  private _status: AgentStatus = 'idle';
  private _taskId: string;
  private _tokenUsage: MessageTokenUsage = {
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCost: 0,
    contextTokens: 0,
  };
  private _toolUsage: ToolUsage = {};
  private _consecutiveMistakeCount = 0;
  private _collectedErrors: string[] = [];
  private _abortInfo: AbortInfo | null = null;

  // Mail-driven mode state
  private _isMailDrivenRunning = false;
  private _mailDrivenConfig: MailDrivenConfig = {
    pollInterval: 30000,
    maxConsecutiveErrors: 5,
  };
  private _lastUnreadCount = 0;
  private _lastCheckTimestamp = 0;
  private _consecutiveErrors = 0;
  private _currentPollInterval: number;

  // Mail reply tracking state
  private _receivedMailIds: Set<string> = new Set();
  private _repliedMailIds: Set<string> = new Set();

  // Memory module (dependency injected, always present)
  private memoryModule: IMemoryModule;

  // Thinking module (dependency injected, always present)
  private thinkingModule: IThinkingModule;

  // Action module (dependency injected, always present)
  private actionModule: IActionModule;

  private agentPrompt: AgentPrompt;

  constructor(
    @inject(TYPES.AgentConfig)
    @optional()
    public config: AgentConfig = defaultAgentConfig,
    @inject(TYPES.IVirtualWorkspace) workspace: IVirtualWorkspace,
    @inject(TYPES.AgentPrompt) agentPrompt: AgentPrompt,
    @inject(TYPES.IMemoryModule) memoryModule: IMemoryModule,
    @inject(TYPES.IThinkingModule) thinkingModule: IThinkingModule,
    @inject(TYPES.IActionModule) actionModule: IActionModule,
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.TaskId) @optional() taskId?: string,
  ) {
    this.workspace = workspace as unknown as VirtualWorkspace;
    this._taskId = taskId || crypto.randomUUID();
    this.agentPrompt = agentPrompt;
    this._currentPollInterval = 30000;

    // Use injected dependencies
    this.memoryModule = memoryModule as MemoryModule;
    this.thinkingModule = thinkingModule;
    this.actionModule = actionModule;
  }

  // ==================== Public API ====================

  /**
   * Getter for task status
   */
  public get status(): AgentStatus {
    return this._status;
  }

  /**
   * Getter for task ID
   */
  public get getTaskId(): string {
    return this._taskId;
  }

  /**
   * Getter for token usage
   */
  public get tokenUsage(): MessageTokenUsage {
    return this._tokenUsage;
  }

  /**
   * Getter for tool usage
   */
  public get toolUsage(): ToolUsage {
    return this._toolUsage;
  }

  /**
   * Getter for conversation history (delegated to MemoryModule)
   */
  public get conversationHistory(): ApiMessage[] {
    return this.memoryModule.getAllMessages();
  }

  /**
   * Getter for consecutive mistake count
   */
  public get consecutiveMistakeCount(): number {
    return this._consecutiveMistakeCount;
  }

  /**
   * Setter for consecutive mistake count
   */
  public set consecutiveMistakeCount(count: number) {
    this._consecutiveMistakeCount = count;
  }

  /**
   * Get memory module (always available)
   */
  public getMemoryModule(): IMemoryModule {
    return this.memoryModule;
  }

  // ==================== Lifecycle Methods ====================
  // Lifecycle status: running / completed / idle / aborted

  /**
   * Start agent with a user query
   */
  async start(): Promise<Agent> {
    this._status = 'running';

    // Note: Initial user message will be added in requestLoop after startTurn()
    // This ensures the message is properly associated with a Turn

    // Start request loop
    await this.requestLoop();
    return this;
  }

  /**
   * Complete agent task
   */
  complete(): void {
    this._status = 'completed';
  }

  /**
   * Abort agent task
   * @param abortReason - The reason for aborting (required)
   * @param source - The source of the abort (user, system, error, timeout, manual)
   * @param details - Additional details about the abort
   */
  abort(
    abortReason: string,
    source: AbortSource = 'manual',
    details?: Record<string, unknown>,
  ): void {
    this._status = 'aborted';
    this._abortInfo = {
      reason: abortReason,
      timestamp: Date.now(),
      source,
      details,
    };
  }

  /**
   * Wake up agent to process mail tasks
   * Called by ExpertInstance when new mail is detected
   * Triggers the agent to check mailbox and process pending tasks
   */
  async wakeUpForMailTask(): Promise<void> {
    this.logger.info('Waking up agent for mail task processing');

    // In mail-driven mode, the agent should check its inbox for new tasks
    // The system prompt already includes instructions for the LLM to check mailbox
    // We just need to trigger the agent to run with a prompt that tells it to check mail

    // Reset status to running if it was completed
    if (this._status === 'completed' || this._status === 'idle') {
      this._status = 'running';
    }

    // Track received emails before processing
    await this.trackReceivedEmails();

    // Trigger agent to check mailbox
    // The LLM will check inbox, process tasks, and send results
    await this.requestLoop();
  }

  /**
   * Track all received emails for mandatory reply verification
   * Called at the start of each mail task to record which emails need replies
   */
  private async trackReceivedEmails(): Promise<void> {
    const mailComponent = this.getMailComponent();
    if (!mailComponent) {
      return;
    }

    try {
      // Get all messages to build the full set of emails received before this task
      const result = await mailComponent.handleToolCall('getInbox', {
        limit: 100,
        unreadOnly: false,
      });

      if (result?.data?.messages) {
        // Record all message IDs received at the start of this task
        // These are the emails that MUST be replied to before completion
        const messageIds = result.data.messages.map((m: any) => m.messageId);
        this._receivedMailIds = new Set(messageIds);
        this._repliedMailIds.clear();
        this.logger.info(`[MailReplyCheck] Tracking ${messageIds.length} received emails for mandatory reply`);
      }
    } catch (error) {
      this.logger.warn(`[MailReplyCheck] Failed to track received emails: ${error}`);
    }
  }

  /**
   * Check current unreplied emails by fetching fresh inbox data
   * This is called at attempt_completion time to get accurate state
   */
  public async getCurrentUnrepliedMailIds(): Promise<string[]> {
    const mailComponent = this.getMailComponent();
    if (!mailComponent) {
      return [];
    }

    try {
      const result = await mailComponent.handleToolCall('getInbox', {
        limit: 100,
        unreadOnly: false,
      });

      if (result?.data?.messages) {
        // Get messages that were in the original received set but haven't been replied to
        // A message is considered "replied" if there's a reply with inReplyTo pointing to it
        // For simplicity, we check if the message has been read (status.read)
        // A more robust implementation would check the sent folder for replies
        const currentMessageIds = new Set(result.data.messages.map((m: any) => m.messageId));

        // Return messages that:
        // 1. Were in our tracking set (received before/during this task)
        // 2. Are still in the inbox (not deleted)
        // 3. Have not been marked as read (indicating they haven't been processed)
        const unreplied: string[] = [];
        for (const msgId of this._receivedMailIds) {
          if (currentMessageIds.has(msgId)) {
            const msg = result.data.messages.find((m: any) => m.messageId === msgId);
            if (msg && !msg.status?.read) {
              unreplied.push(msgId);
            }
          }
        }
        return unreplied;
      }
    } catch (error) {
      this.logger.warn(`[MailReplyCheck] Failed to check unreplied emails: ${error}`);
    }
    return [];
  }

  /**
   * Mark a mail as replied
   * Called when the agent sends a reply to an email
   */
  public markMailAsReplied(mailId: string): void {
    if (this._receivedMailIds.has(mailId)) {
      this._repliedMailIds.add(mailId);
      this.logger.info(`[MailReplyCheck] Marked ${mailId} as replied (${this._repliedMailIds.size}/${this._receivedMailIds.size})`);
    }
  }

  /**
   * Get list of unreplied mail IDs (from cache)
   */
  public getUnrepliedMailIds(): string[] {
    return Array.from(this._receivedMailIds).filter(id => !this._repliedMailIds.has(id));
  }

  /**
   * Check if all received emails have been replied to
   */
  public hasAllReplied(): boolean {
    return this.getUnrepliedMailIds().length === 0;
  }

  /**
   * Check if in mail-driven mode with pending replies
   */
  public hasPendingReplies(): boolean {
    return this._isMailDrivenRunning && !this.hasAllReplied();
  }

  /**
   * Set up mail reply tracking callbacks for GlobalToolProvider
   * This enables the mandatory reply check before allowing attempt_completion
   */
  private setupMailReplyTracking(): void {
    try {
      const toolManager = this.workspace.getToolManager();
      const globalProvider = toolManager.getProvider('global-tools') as any;

      if (globalProvider && typeof globalProvider.setReplyTrackingCallbacks === 'function') {
        globalProvider.setReplyTrackingCallbacks({
          onReplySent: (mailId: string) => this.markMailAsReplied(mailId),
          getUnrepliedMailIds: () => this.getUnrepliedMailIds(),
          // Also provide async version for real-time checking
          getCurrentUnrepliedMailIds: () => this.getCurrentUnrepliedMailIds(),
        });
        this.logger.info('[MailReplyCheck] Reply tracking callbacks set up successfully');
      } else {
        this.logger.warn('[MailReplyCheck] GlobalToolProvider not found or does not support reply tracking');
      }
    } catch (error) {
      this.logger.warn(`[MailReplyCheck] Failed to set up reply tracking: ${error}`);
    }
  }

  /**
   * Start agent in mail-driven mode
   * Agent polls its mailbox for new tasks and processes them autonomously
   * @param pollInterval - Polling interval in milliseconds (default: 30000)
   */
  async startMailDrivenMode(pollInterval = 30000): Promise<void> {
    this.logger.info(`[MailDriven] startMailDrivenMode called, current status=${this._status}`);

    if (this._isMailDrivenRunning) {
      this.logger.warn('Agent is already in mail-driven mode');
      return;
    }

    // Check if mail component is available
    const mailComponent = this.getMailComponent();
    if (!mailComponent) {
      this.logger.warn('[MailDriven] Mail component not found in workspace, mail-driven mode requires mail component');
      this.logger.warn('[MailDriven] Available components: ' + (this.workspace.getComponentKeys?.()?.join(', ') || 'unknown'));
      return;
    }

    this.logger.info('[MailDriven] Mail component found');
    this._isMailDrivenRunning = true;
    this._currentPollInterval = pollInterval;
    this._mailDrivenConfig.pollInterval = pollInterval;
    this._consecutiveErrors = 0;
    this._lastUnreadCount = 0;

    // Set up mail reply tracking callbacks for GlobalToolProvider
    this.setupMailReplyTracking();

    // Don't set status to 'running' here - stay idle until actually processing a task
    // _status remains whatever it was before (typically 'idle')

    this.logger.info(`[MailDriven] Agent started mail-driven mode (pollInterval: ${pollInterval}ms), status=${this._status}`);

    try {
      while (this._isMailDrivenRunning) {
        const agentStatus = this.status;
        const isAgentIdle = agentStatus === 'idle' || agentStatus === 'completed';

        this.logger.debug(`[MailDriven] poll check: status=${agentStatus}, isIdle=${isAgentIdle}`);

        if (isAgentIdle && this._isMailDrivenRunning) {
          const hasNewTasks = await this.checkForNewTasks();

          if (hasNewTasks) {
            this.logger.info('[MailDriven] New task detected, waking up agent');
            await this.wakeUpAgentForMailTask();
            this.logger.info('[MailDriven] Agent finished processing task');
          }
        } else {
          this.logger.debug(`[MailDriven] Agent busy (status=${agentStatus}), skipping poll`);
        }

        await this.sleep(this._currentPollInterval);
      }
    } catch (error) {
      this.logger.error(`Agent mail-driven polling error: ${error}`);
    } finally {
      this._isMailDrivenRunning = false;
      this._status = 'idle';
      this.logger.info('Agent stopped mail-driven mode');
    }
  }

  /**
   * Check for new tasks by querying the mail component
   * Returns true if there are new unread messages
   */
  private async checkForNewTasks(): Promise<boolean> {
    const mailComponent = this.getMailComponent();
    if (!mailComponent) {
      this.logger.debug('No mail component found in workspace');
      return false;
    }

    try {
      const result = await mailComponent.handleToolCall('getUnreadCount', {});

      // MailComponent returns errors inside result.data.error
      if (result?.data?.error) {
        this._handlePollingError(new Error(result.data.error as string));
        return false;
      }

      const currentUnreadCount = result?.data?.count ?? 0;
      this._lastCheckTimestamp = Date.now();
      this._consecutiveErrors = 0;
      this._currentPollInterval = this._mailDrivenConfig.pollInterval;

      this.logger.debug(`[MailDriven] Unread count: current=${currentUnreadCount}, last=${this._lastUnreadCount}`);

      if (currentUnreadCount > this._lastUnreadCount) {
        const newMessageCount = currentUnreadCount - this._lastUnreadCount;
        this.logger.info(
          `[MailDriven] Detected ${newMessageCount} new unread message(s) (total: ${currentUnreadCount})`,
        );
        this._lastUnreadCount = currentUnreadCount;
        return true;
      }

      this._lastUnreadCount = currentUnreadCount;
      this.logger.debug(`[MailDriven] No new messages (unread: ${currentUnreadCount})`);
      return false;
    } catch (error) {
      this._handlePollingError(error as Error);
      return false;
    }
  }

  /**
   * Handle polling errors with exponential backoff
   */
  private _handlePollingError(error: Error): void {
    this._consecutiveErrors++;

    if (this._consecutiveErrors >= this._mailDrivenConfig.maxConsecutiveErrors) {
      const maxInterval = 300000;
      const newInterval = Math.min(
        this._currentPollInterval * 2,
        maxInterval,
      );

      if (newInterval !== this._currentPollInterval) {
        this.logger.warn(
          `Too many consecutive errors (${this._consecutiveErrors}), backing off to ${newInterval}ms`,
        );
        this._currentPollInterval = newInterval;
      }
    }

    this.logger.error(`Error checking for new tasks: ${error.message}`);
  }

  /**
   * Get MailComponent from workspace
   */
  private getMailComponent(): any {
    return this.workspace.getComponent('mail');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if in mail-driven mode
   */
  isMailDrivenRunning(): boolean {
    return this._isMailDrivenRunning;
  }

  /**
   * Stop mail-driven mode
   */
  stopMailDrivenMode(): void {
    if (!this._isMailDrivenRunning) {
      return;
    }
    this._isMailDrivenRunning = false;
    this._status = 'idle';
    this.logger.info('Stopping mail-driven mode');
  }

  /**
   * Internal wake up agent for mail task (called from polling loop)
   */
  private async wakeUpAgentForMailTask(): Promise<void> {
    await this.wakeUpForMailTask();
  }

  /**
   * Get abort information
   * @returns The abort info if task was aborted, null otherwise
   */
  public getAbortInfo(): AbortInfo | null {
    return this._abortInfo;
  }

  /**
   * Get abort reason
   * @returns The abort reason if task was aborted, undefined otherwise
   */
  public getAbortReason(): string | undefined {
    return this._abortInfo?.reason;
  }

  // ==================== Error Handling ====================

  /**
   * Get collected errors for debugging
   */
  public getCollectedErrors() {
    return this._collectedErrors;
  }

  /**
   * Reset collected errors
   */
  public resetCollectedErrors(): void {
    this._collectedErrors = [];
  }

  // ==================== Core Request Loop ====================

  /**
   * Core method for making recursive API requests to the LLM
   * Implements stack-based retry mechanism with error handling
   */
  protected async requestLoop(): Promise<void> {
    // Reset collected errors for this new operation
    this.resetCollectedErrors();

    let lastToolResults: ToolResult[] = [];


    // Track if we need to start a new turn
    let needsNewTurn = true;

    while (needsNewTurn) {
      // Create new turn
      // Notice: now workspace context will include Mail component, which has the information
      // about task. The system do not need to pass Task or user message anymore, instead agent
      // should analysis and extract task from mail component automatically.

      const currentWorkspaceContext = await this.workspace.render();
      this.memoryModule.startTurn(currentWorkspaceContext);

      try {
        // EXECUTE THINKING PHASE
        const thinkingResult = await this.executeThinkingPhase(lastToolResults);

        // EXECUTE ACTION PHASE
        const actionResult = await this.executeActionPhase(
          thinkingResult,
        );

        // Store tool results for next thinking phase
        lastToolResults = actionResult.toolResults;

        // Trigger workspace re-render after tool execution
        // This ensures the next iteration gets the UPDATED workspace context
        // rather than the context that was captured BEFORE tool execution
        this.logger.info(`Tool-calling has been executed successfully`, {
          toolCallResult: lastToolResults,
        });

        // // Re-render workspace to capture updated component states
        // // Note: Tool call logging is handled via notifyToolExecuted callback
        // // in ComponentToolProvider, which is set up when the workspace is initialized
        // const updatedWorkspaceContext = await this.workspace.render();

        if (!actionResult.didAttemptCompletion) {
          // Complete current turn and prepare for next turn
          this.memoryModule.completeTurn();
          needsNewTurn = true;
        } else {
          // Task completed, complete the turn
          this.memoryModule.completeTurn();
          needsNewTurn = false;
        }
      } catch (error) {
        // Properly serialize error to extract message, name, and stack
        const errorObj: Record<string, unknown> =
          error instanceof Error
            ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
            : { message: String(error), original: error };
        // Add cause if it exists
        if (error instanceof Error && 'cause' in error) {
          this.memoryModule.getTurnStore().pushErrors([error]);
        }
        this.logger.error('Agent loop error', {
          ...errorObj,
        });

        if (this._status === 'aborted') {
          needsNewTurn = false;
        } else {
          needsNewTurn = true;
        }
      }
    }

    this.complete();
  }

  /**
   * Execute the thinking phase using ThinkingModule
   * @param currentWorkspaceContext - Current workspace context
   * @param lastToolResults - Results from previous tool executions
   * @returns ThinkingPhaseResult from the thinking module
   */
  private async executeThinkingPhase(
    lastToolResults: ToolResult[],
  ): Promise<ThinkingPhaseResult> {
    const currentTurn = this.memoryModule.getCurrentTurn();
    const currentWorkspaceContext = await this.workspace.render();
    const thinkingResult = await this.thinkingModule.performThinkingPhase(
      currentWorkspaceContext,
      lastToolResults,
    );

    const thinkingTokens = thinkingResult.tokensUsed;

    // Store thinking phase in turn
    if (!currentTurn)
      throw new NullCurrentTurnError(
        `Store thinking message failed: current turn is null`,
      );
    this.memoryModule
      .getTurnStore()
      .storeThinkingPhase(
        currentTurn.id,
        thinkingResult.rounds,
        thinkingResult.tokensUsed,
      );

    // Store summary if available
    if (thinkingResult.summary) {
      this.memoryModule.getTurnStore().storeSummary(
        currentTurn.id,
        thinkingResult.summary,
        [], // insights - extracted by ThinkingModule
      );
    }

    // Add thinking summary to history for observability
    if (thinkingResult.rounds.length > 0) {
      const thinkingSummary = this.formatMemoryThinkingSummary(thinkingResult);
      const message = MessageBuilder.system(thinkingSummary);
      this.memoryModule.addMessage(message);
    }

    // Track thinking tokens
    this._tokenUsage.contextTokens += thinkingTokens;

    return thinkingResult;
  }

  /**
   * Execute the action phase using ActionModule
   * @param currentWorkspaceContext - Current workspace context
   * @param thinkingResult - Result from thinking phase
   * @returns ActionPhaseResult from the action module
   */
  private async executeActionPhase(
    thinkingResult: ThinkingPhaseResult,
  ): Promise<ActionPhaseResult> {
    const conversationHistory = this.memoryModule.getHistoryForPrompt();

    // Convert tools to OpenAI format (inline utility)
    const allTools = this.workspace.getAllTools();
    const tools = allTools.map((t): Tool => t.tool);
    const converter = new DefaultToolCallConverter();
    const openaiTools = converter.convertTools(tools);

    // Generate thinking summary if available
    const thinkingSummary =
      thinkingResult.rounds.length > 0
        ? this.formatMemoryThinkingSummary(thinkingResult)
        : undefined;

    // Build enhanced prompt using ActionPromptBuilder
    const componentKeys = this.workspace.getComponentKeys();
    const hasMailComponent = componentKeys.includes('mail');
    const builder = new ActionPromptBuilder({
      workspace: this.workspace,
      agentPrompt: this.agentPrompt,
      hasMailComponent,
    }).setThinkingSummary(thinkingSummary);

    const enhancedSystemPrompt = await builder.build();

    // Get current workspace context
    const currentWorkspaceContext = await this.workspace.render();

    const actionResult: ActionPhaseResult =
      await this.actionModule.performActionPhase(
        currentWorkspaceContext,
        enhancedSystemPrompt,
        conversationHistory,
        openaiTools,
        () => this.isAborted(),
        this.workspace.getToolManager(), // Use workspace's toolManager to ensure tools are available
      );
    this.logger.info(`Action phase successfully proformed`);

    // Update agent state from action result
    this._tokenUsage.totalTokensOut += actionResult.tokensUsed;
    this._toolUsage = { ...this._toolUsage, ...actionResult.toolUsage };

    // Add messages to memory
    this.memoryModule.addMessage(actionResult.assistantMessage);
    if (actionResult.userMessageContent.length > 0) {
      const message = MessageBuilder.custom(
        'system',
        actionResult.userMessageContent,
      );
      this.memoryModule.addMessage(message);
    }

    // Record tool calls to turn
    actionResult.toolResults.forEach((result) => {
      this.memoryModule.recordToolCall(
        result.toolName,
        result.success,
        result.result,
      );
    });

    return actionResult;
  }

  // ==================== Helper Methods ====================

  /**
   * Format memory thinking summary for history
   */
  private formatMemoryThinkingSummary(result: ThinkingPhaseResult): string {
    const rounds = result.rounds
      .map((r: ThinkingRound) => {
        const recalled =
          r.recalledContexts?.length > 0
            ? `\n  Recalled: ${r.recalledContexts.map((c) => `Turn ${c.turnNumber}`).join(', ')}`
            : '';

        // Use summary if available, otherwise use content
        const content = r.summary || r.content || '';
        return `  Round ${r.roundNumber}: ${content}...${recalled}`;
      })
      .join('\n');

    return `[Reflective Thinking Phase]
Total rounds: ${result.rounds.length}
Tokens used: ${result.tokensUsed}

Thinking rounds:
${rounds}`;
  }

  /**
   * Check if task is aborted
   */
  private isAborted(): boolean {
    return this._status === 'aborted';
  }

  // ==================== Agent-Specific Methods ====================

  /**
   * Get system prompt for agent
   * Uses VirtualWorkspace's render for context
   */
  async getSystemPrompt() {
    // Check if mail component is available for mail-driven mode
    const componentKeys = this.workspace.getComponentKeys();
    const hasMailComponent = componentKeys.includes('mail');

    // Use ActionPromptBuilder to construct the system prompt
    const builder = new ActionPromptBuilder({
      workspace: this.workspace,
      agentPrompt: this.agentPrompt,
      hasMailComponent,
    });

    return await builder.buildSystemPrompt();
  }
}
