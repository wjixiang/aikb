import { injectable, inject, optional } from 'inversify';

import { ApiMessage } from '../memory/types.js';
import type { AgentStatus } from '../common/types.js';
import { MessageTokenUsage, ToolUsage } from '../types/index.js';
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from '../types/index.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { DefaultToolCallConverter } from '../api-client/index.js';
import { AgentError, NoToolsUsedError } from '../common/errors.js';
import { MemoryModule } from '../memory/MemoryModule.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type {
  ApiClient,
  ChatCompletionTool,
  ToolCall,
} from '../api-client/index.js';
import type { IToolManager } from '../tools/index.js';
import { TYPES } from '../di/types.js';
import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { Tool } from '../../components/core/types.js';
import { ToolComponent } from '../statefulContext/index.js';
import type {
  A2AHandler,
  IA2AHandler,
  A2AClient,
  A2AMessage,
  A2APayload,
  A2ATaskResult,
} from '../a2a/index.js';
import { createA2AHandler } from '../a2a/index.js';
import type { HookModule } from '../hooks/HookModule.js';
import { HookType } from '../hooks/types.js';
import type { IPersistenceService } from '../persistence/types.js';
import type { ISessionManager } from '../session/ISessionManager.js';
import type { SessionState } from '../session/types.js';
import pino from 'pino';
import type { IRuntimeControlClient } from '../runtime/types.js';

export interface AgentConfig {
  apiRequestTimeout: number;
  maxRetryAttempts: number;
  maxIterations: number;
  consecutiveMistakeLimit: number;
  // Memory module configuration (now required, with defaults)
  memory?: Partial<MemoryModuleConfig>;
}

export const defaultAgentConfig: AgentConfig = {
  apiRequestTimeout: 60000,
  maxIterations: 999,
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

/**
 * SOP - Standard Operating Procedure for the Agent
 * This is the markdown content defining the agent's behavior and capabilities
 */
export type SOP = string;

/**
 * Result of a tool execution
 */
export interface ToolExecutionResult {
  /** Name of the tool that was executed */
  toolName: string;
  /** Whether the tool execution succeeded */
  success: boolean;
  /** The result returned by the tool, or error info on failure */
  result: unknown;
  /** Timestamp of when the tool was executed */
  timestamp: number;
  /** The component key that provided this tool (if available) */
  componentKey?: string;
  /** The tool use ID from the original tool call */
  toolUseId: string;
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

  // Consecutive error tracking for abort (disabled by setting to Infinity)
  private _consecutiveErrorCount = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = Infinity;

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

  // Expert identity (optional - for Agents that represent Experts)
  // @deprecated - Will be removed in future versions. Use taskId for identification instead.

  // Memory module (dependency injected, always present)
  private memoryModule: IMemoryModule;

  // API client for LLM calls
  private apiClient: ApiClient;

  // Tool manager for executing tools
  private toolManager: IToolManager;

  // A2A Handler for agent-to-agent communication
  private _a2aHandler?: A2AHandler;
  private _a2aClient?: A2AClient;
  private _pendingA2AMessages: A2AMessage[] = [];

  // Persistence service (for component states - instance-level)
  private persistenceService?: IPersistenceService;

  // Session manager (handles session lifecycle)
  private sessionManager: ISessionManager;

  // Hook module (required)
  private hookModule: HookModule;

  private agentSop: SOP;
  private logger: pino.Logger;
  public instanceId: string;

  // Runtime control client (set by AgentRuntime)
  private _runtimeClient?: IRuntimeControlClient;

  constructor(
    @inject(TYPES.AgentInstanceId) instanceId: string,
    @inject(TYPES.AgentConfig)
    @optional()
    public config: AgentConfig = defaultAgentConfig,
    @inject(TYPES.IVirtualWorkspace) workspace: IVirtualWorkspace,
    @inject(TYPES.AgentPrompt) agentSop: SOP,
    @inject(TYPES.IMemoryModule) memoryModule: IMemoryModule,
    @inject(TYPES.ApiClient) apiClient: ApiClient,
    @inject(TYPES.IToolManager) toolManager: IToolManager,
    @inject(TYPES.HookModule) hookModule: HookModule,
    @inject(TYPES.ISessionManager) sessionManager: ISessionManager,
    @inject(TYPES.IPersistenceService)
    @optional()
    persistenceService?: IPersistenceService,
    @inject(TYPES.TaskId) @optional() taskId?: string,
    @inject(TYPES.IA2AHandler)
    @optional()
    a2aHandler?: A2AHandler,
  ) {
    this.instanceId = instanceId;
    this.logger = pino({ level: process.env['LOG_LEVEL'] || 'debug' });
    this.workspace = workspace as unknown as VirtualWorkspace;
    this._taskId = taskId || crypto.randomUUID();
    this.agentSop = agentSop;
    this._currentPollInterval = 30000;

    this.memoryModule = memoryModule as MemoryModule;
    this.apiClient = apiClient;
    this.toolManager = toolManager;
    this.hookModule = hookModule;
    this.sessionManager = sessionManager;
    this.persistenceService = persistenceService;

    void this.sessionManager.createSession(this.getSessionState());

    // Initialize A2A Handler if injected via DI
    if (a2aHandler) {
      this._a2aHandler = a2aHandler;
      this.setupA2AHandlers();
      this._a2aHandler.startListening();
      this.logger.info('[Agent] A2A Handler initialized via DI');
    }
  }

  private getSessionState(): SessionState {
    return {
      instanceId: this.instanceId,
      status: this._status,
      tokenUsage: this._tokenUsage,
      toolUsage: this._toolUsage,
      consecutiveMistakeCount: this._consecutiveMistakeCount,
      collectedErrors: this._collectedErrors,
      abortInfo: this._abortInfo,
    };
  }

  /**
   * End the current session
   * Updates both Session and Instance status to 'completed' or 'aborted'
   */
  public async endSession(reason?: string): Promise<void> {
    await this.sessionManager.endSession(this.getSessionState(), reason);
  }

  /**
   * Save all component states to persistence (instance-level)
   */
  public async saveComponentStates(): Promise<void> {
    if (!this.persistenceService) return;

    try {
      const states = this.workspace.exportComponentStates();
      for (const [componentId, state] of states) {
        await this.persistenceService.saveComponentState(
          this.instanceId,
          componentId,
          state,
        );
      }
      this.logger.debug(
        { instanceId: this.instanceId, count: states.size },
        '[Agent] Component states saved',
      );
    } catch (error) {
      this.logger.error(
        { error, instanceId: this.instanceId },
        '[Agent] Failed to save component states',
      );
    }
  }

  /**
   * Restore all component states from persistence (instance-level)
   */
  public async restoreComponentStates(): Promise<void> {
    if (!this.persistenceService) return;

    try {
      const states = await this.persistenceService.getAllComponentStates(
        this.instanceId,
      );
      if (Object.keys(states).length > 0) {
        const stateMap = new Map<string, any>(
          Object.entries(states) as [string, any][],
        );
        this.workspace.importComponentStates(stateMap);
        this.logger.info(
          { instanceId: this.instanceId, count: Object.keys(states).length },
          '[Agent] Component states restored',
        );
      }
    } catch (error) {
      this.logger.error(
        { error, instanceId: this.instanceId },
        '[Agent] Failed to restore component states',
      );
    }
  }

  /**
   * Setup A2A message handlers
   * Called from constructor when A2AHandler is injected via DI
   */
  private setupA2AHandlers(): void {
    if (!this._a2aHandler) {
      return;
    }

    // Register task handler - when a task is received, trigger agent processing
    this._a2aHandler.onTask(async (payload, ctx) => {
      this.logger.info(
        { messageId: ctx.message.messageId, from: ctx.message.from },
        '[Agent] Received A2A task, processing',
      );

      // Inject A2A task as a user message so the LLM can process it
      const taskDescription = payload.description || 'Task received';
      const taskInput = payload.input
        ? this.safeStringify(payload.input, null, 2)
        : '{}';
      const userMessage: ApiMessage = {
        role: 'user',
        content: [
          {
            type: 'text' as const,
            text: `[A2A Task from ${ctx.message.from}]\n\nTask: ${taskDescription}\n\nInput:\n${taskInput}`,
          },
        ],
        ts: Date.now(),
      };
      await this.memoryModule.addMessage(userMessage);

      // Store message for processing in requestLoop
      this._pendingA2AMessages.push(ctx.message);

      // Wake up agent if idle and process the task
      let taskOutput: unknown = null;
      if (this._status === 'idle' || this._status === 'completed') {
        this._status = 'running';
        taskOutput = await this.requestLoop();
      }

      // Return the task result
      return {
        taskId: payload.taskId || '',
        status: this._status === 'aborted' ? 'failed' : 'completed',
        output: taskOutput,
      };
    });

    // Register event handler
    this._a2aHandler.onEvent(async (payload, ctx) => {
      this.logger.info(
        { from: ctx.message.from },
        '[Agent] Received A2A event',
      );
    });
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
   * Safely stringify an object, handling circular references
   */
  private safeStringify(
    obj: unknown,
    replacer?: ((key: string, value: unknown) => unknown) | null | number[],
    space?: string | number,
  ): string {
    const seen = new WeakSet();
    const jsonStringify = (value: unknown, key?: string): unknown => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      if (replacer && typeof replacer === 'function') {
        return replacer(key || '', value);
      }
      return value;
    };
    try {
      return JSON.stringify(
        obj,
        jsonStringify as (key: string, value: unknown) => unknown,
        space,
      );
    } catch (error) {
      return `[Stringify Error: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  /**
   * Get memory module (always available)
   */
  public getMemoryModule(): IMemoryModule {
    return this.memoryModule;
  }

  /**
   * Get A2A handler for agent-to-agent communication
   */
  public getA2AHandler(): A2AHandler | undefined {
    return this._a2aHandler;
  }

  /**
   * Get pending A2A messages
   */
  public getPendingA2AMessages(): A2AMessage[] {
    return this._pendingA2AMessages;
  }

  /**
   * Clear pending A2A messages
   */
  public clearPendingA2AMessages(): void {
    this._pendingA2AMessages = [];
  }

  // ==================== Lifecycle Methods ====================
  // Lifecycle status: running / completed / idle / aborted

  /**
   * Start agent with a user query
   */
  async start(): Promise<Agent> {
    // Trigger agent:starting hook
    await this.hookModule.executeHooks(HookType.AGENT_STARTING, {
      type: HookType.AGENT_STARTING,
      timestamp: new Date(),
      instanceId: this.instanceId,
    });

    this._status = 'running';
    void this.sessionManager.persistState(this.getSessionState());

    // Note: Initial user message will be added in requestLoop after startTurn()
    // This ensures the message is properly associated with a Turn

    // Start request loop
    await this.requestLoop();

    // Trigger agent:started hook
    await this.hookModule.executeHooks(HookType.AGENT_STARTED, {
      type: HookType.AGENT_STARTED,
      timestamp: new Date(),
      instanceId: this.instanceId,
    });

    return this;
  }

  /**
   * Complete agent task
   */
  complete(): void {
    // Trigger agent:completing hook
    void this.hookModule.executeHooks(HookType.AGENT_COMPLETING, {
      type: HookType.AGENT_COMPLETING,
      timestamp: new Date(),
      instanceId: this.instanceId,
    });

    this._status = 'completed';
    void this.sessionManager.persistState(this.getSessionState());
    void this.endSession();

    // Trigger agent:completed hook
    void this.hookModule.executeHooks(HookType.AGENT_COMPLETED, {
      type: HookType.AGENT_COMPLETED,
      timestamp: new Date(),
      instanceId: this.instanceId,
    });
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
    // Trigger agent:aborting hook
    void this.hookModule.executeHooks(HookType.AGENT_ABORTING, {
      type: HookType.AGENT_ABORTING,
      timestamp: new Date(),
      instanceId: this.instanceId,
      reason: abortReason,
      source,
    });

    this._status = 'aborted';
    this._abortInfo = {
      reason: abortReason,
      timestamp: Date.now(),
      source,
      details,
    };
    void this.sessionManager.persistState(this.getSessionState());
    void this.endSession('aborted');

    // Trigger agent:aborted hook
    void this.hookModule.executeHooks(HookType.AGENT_ABORTED, {
      type: HookType.AGENT_ABORTED,
      timestamp: new Date(),
      instanceId: this.instanceId,
      reason: abortReason,
      source,
    });
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

    // Trigger agent to check mailbox
    // The LLM will check inbox, process tasks, and send results
    await this.requestLoop();
  }

  /**
   * Wake up agent for A2A task processing
   * @deprecated Use A2A Handler instead
   */
  async wakeUpForTask(task: any): Promise<void> {
    this.logger.info(`Waking up agent for task processing: ${task.taskId}`);

    // Reset status to running if it was completed
    if (this._status === 'completed' || this._status === 'idle') {
      this._status = 'running';
    }

    // Trigger agent to process the task
    await this.requestLoop();
  }

  /**
   * Set the Runtime control client for this agent
   * This is called by AgentRuntime when the agent is created
   */
  setRuntimeClient(client: IRuntimeControlClient): void {
    this._runtimeClient = client;
    this.logger.info('[Agent] Runtime control client set');
  }

  /**
   * Get the Runtime control client
   */
  getRuntimeClient(): IRuntimeControlClient | undefined {
    return this._runtimeClient;
  }

  /**
   * Check if this agent has Runtime control capabilities
   */
  hasRuntimeControl(): boolean {
    return this._runtimeClient !== undefined;
  }

  /**
   * Set the A2A client for agent-to-agent communication
   * This is called by AgentRuntime when the agent is created
   */
  setA2AClient(client: A2AClient): void {
    this._a2aClient = client;
    this.logger.info('[Agent] A2A client set');
  }

  /**
   * Get the A2A client
   */
  getA2AClient(): A2AClient | undefined {
    return this._a2aClient;
  }

  /**
   * Start agent in mail-driven mode
   * Agent polls its mailbox for new tasks and processes them autonomously
   * @param pollInterval - Polling interval in milliseconds (default: 30000)
   */
  async startMailDrivenMode(pollInterval = 30000): Promise<void> {
    this.logger.info(
      `[MailDriven] startMailDrivenMode called, current status=${this._status}`,
    );

    if (this._isMailDrivenRunning) {
      this.logger.warn('Agent is already in mail-driven mode');
      return;
    }

    // Check if mail component is available
    const mailComponent = this.getMailComponent();
    if (!mailComponent) {
      this.logger.warn(
        '[MailDriven] Mail component not found in workspace, mail-driven mode requires mail component',
      );
      this.logger.warn(
        '[MailDriven] Available components: ' +
          (this.workspace.getComponentKeys?.()?.join(', ') || 'unknown'),
      );
      return;
    }

    this.logger.info('[MailDriven] Mail component found');
    this._isMailDrivenRunning = true;
    this._currentPollInterval = pollInterval;
    this._mailDrivenConfig.pollInterval = pollInterval;
    this._consecutiveErrors = 0;
    this._lastUnreadCount = 0;

    // Don't set status to 'running' here - stay idle until actually processing a task
    // _status remains whatever it was before (typically 'idle')

    this.logger.info(
      `[MailDriven] Agent started mail-driven mode (pollInterval: ${pollInterval}ms), status=${this._status}`,
    );

    try {
      while (this._isMailDrivenRunning) {
        const agentStatus = this.status;
        const isAgentIdle =
          agentStatus === 'idle' || agentStatus === 'completed';

        this.logger.debug(
          `[MailDriven] poll check: status=${agentStatus}, isIdle=${isAgentIdle}`,
        );

        if (isAgentIdle && this._isMailDrivenRunning) {
          const hasNewTasks = await this.checkForNewTasks();

          if (hasNewTasks) {
            this.logger.info('[MailDriven] New task detected, waking up agent');
            await this.wakeUpAgentForMailTask();
            this.logger.info('[MailDriven] Agent finished processing task');
          }
        } else {
          this.logger.debug(
            `[MailDriven] Agent busy (status=${agentStatus}), skipping poll`,
          );
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

      this.logger.debug(
        `[MailDriven] Unread count: current=${currentUnreadCount}, last=${this._lastUnreadCount}`,
      );

      if (currentUnreadCount > this._lastUnreadCount) {
        const newMessageCount = currentUnreadCount - this._lastUnreadCount;
        this.logger.info(
          `[MailDriven] Detected ${newMessageCount} new unread message(s) (total: ${currentUnreadCount})`,
        );
        this._lastUnreadCount = currentUnreadCount;
        return true;
      }

      this._lastUnreadCount = currentUnreadCount;
      this.logger.debug(
        `[MailDriven] No new messages (unread: ${currentUnreadCount})`,
      );
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

    if (
      this._consecutiveErrors >= this._mailDrivenConfig.maxConsecutiveErrors
    ) {
      const maxInterval = 300000;
      const newInterval = Math.min(this._currentPollInterval * 2, maxInterval);

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
   * @returns The MailComponent if found, undefined otherwise
   */
  private getMailComponent(): ToolComponent | undefined {
    return this.workspace.getComponent('mail');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  /**
   * Reset consecutive error count on successful tool execution
   */
  private resetConsecutiveErrorCount(): void {
    this._consecutiveErrorCount = 0;
  }

  /**
   * Increment consecutive error count and abort if threshold reached
   * @param errorInfo Optional error context for abort info
   */
  private handleConsecutiveError(errorInfo?: {
    toolName?: string;
    errorMessage?: string;
  }): void {
    this._consecutiveErrorCount++;
    if (this._consecutiveErrorCount >= this.MAX_CONSECUTIVE_ERRORS) {
      const details: Record<string, unknown> = {
        consecutiveErrors: this._consecutiveErrorCount,
      };
      if (errorInfo?.toolName) details['lastFailedTool'] = errorInfo.toolName;
      if (errorInfo?.errorMessage)
        details['lastError'] = errorInfo.errorMessage;

      this.abort(
        `Too many consecutive errors (${this._consecutiveErrorCount}): ${errorInfo?.errorMessage || 'Unknown error'}`,
        'error',
        details,
      );
    }
  }

  // ==================== Core Request Loop ====================

  /**
   * Core method for making recursive API requests to the LLM
   * Simplified architecture: LLM → Tool Execution → LLM → ...
   * @returns The workspace context after completion (for A2A result)
   */
  protected async requestLoop(): Promise<string> {
    // Reset collected errors for this new operation
    this.resetCollectedErrors();
    // Reset consecutive error count for new operation
    this.resetConsecutiveErrorCount();

    // Track if we need to continue the loop
    let needsNewTurn = true;

    while (needsNewTurn) {
      // Get available tools
      const allTools = this.workspace.getAllTools();
      const tools = allTools.map((t): Tool => t.tool);
      const converter = new DefaultToolCallConverter();
      const openaiTools = converter.convertTools(tools);

      try {
        // Call LLM and execute tools in a loop
        const loopResult = await this.executeAgentLoop(openaiTools);

        if (!loopResult.didComplete) {
          needsNewTurn = true;
        } else {
          needsNewTurn = false;
        }
        // Reset consecutive error count on successful loop iteration
        this.resetConsecutiveErrorCount();
      } catch (error) {
        // Properly serialize error to extract message, name, and stack
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check if this is a NoToolsUsedError
        const isNoToolsError = error instanceof NoToolsUsedError;

        if (isNoToolsError) {
          this.logger.warn(`[Agent] No tool calls made: ${errorMessage}`);

          // Add error to memory for the LLM to see
          this.memoryModule.pushErrors([error]);
          const errorApiMessage: ApiMessage = {
            role: 'system',
            content: [
              { type: 'text' as const, text: `[Error: ${error.message}]` },
            ],
            ts: Date.now(),
          };
          await this.memoryModule.addMessage(errorApiMessage);

          // Track consecutive error for abort (NoToolsUsedError counts as an error)
          this.handleConsecutiveError({ errorMessage });

          // Check if we've aborted due to too many consecutive errors
          if (this._status === 'aborted') {
            needsNewTurn = false;
            break;
          }
        } else {
          // Handle other errors (tool execution errors, API errors, etc.)
          if (error instanceof Error) {
            this.memoryModule.pushErrors([error]);
            const errorApiMessage: ApiMessage = {
              role: 'system',
              content: [
                { type: 'text' as const, text: `[Error: ${error.message}]` },
              ],
              ts: Date.now(),
            };
            await this.memoryModule.addMessage(errorApiMessage);

            // Track consecutive error for abort
            this.handleConsecutiveError({ errorMessage });
          }
          this.logger.error(
            {
              errorName: error instanceof Error ? error.name : undefined,
              errorStack: error instanceof Error ? error.stack : undefined,
              originalError: error instanceof Error ? undefined : error,
            },
            errorMessage + '(error messages have added to memory)',
          );

          // Check if we've aborted due to too many consecutive errors
          if (this._status === 'aborted') {
            needsNewTurn = false;
            break;
          }
          // Otherwise continue the loop
          needsNewTurn = true;
        }
      }
    }

    // Capture workspace context as result before completion
    let resultContext: string;
    try {
      resultContext = await this.workspace.render();
      this.complete();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        {
          errorName: error instanceof Error ? error.name : undefined,
          errorStack: error instanceof Error ? error.stack : undefined,
        },
        `Failed to render workspace or complete agent: ${errorMessage}`,
      );
      // Return last workspace state if available, or error message
      resultContext = `[Agent Error: ${errorMessage}]`;
      // Still mark as completed to avoid hanging
      if (this._status !== 'aborted') {
        this._status = 'completed';
      }
    }
    return resultContext;
  }

  /**
   * Execute a single agent loop: LLM call + tool execution
   * Continues until completion or max iterations
   */
  private async executeAgentLoop(
    tools: ChatCompletionTool[],
  ): Promise<{ didComplete: boolean }> {
    const maxIterations = this.config.maxIterations;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt();

      // Get current workspace context before the LLM call
      const currentWorkspaceContext = await this.workspace.render();
      await this.memoryModule.recordWorkspaceContext(
        currentWorkspaceContext,
        iterations,
      );

      // Get conversation history with workspace contexts interleaved
      // This ensures workspace context appears after each assistant response in history
      const historyContext = this.memoryModule.getHistoryForPrompt(true);
      const memoryContext = historyContext.map((m) =>
        typeof m === 'string' ? m : this.formatMessage(m),
      );

      // Call LLM
      const response = await this.apiClient.makeRequest(
        systemPrompt,
        currentWorkspaceContext, // Empty workspaceContext since it's now part of combinedMemoryContext
        memoryContext,
        { timeout: this.config.apiRequestTimeout },
        tools,
      );

      // Track token usage
      this._tokenUsage.totalTokensIn += response.tokenUsage.promptTokens;
      this._tokenUsage.totalTokensOut += response.tokenUsage.completionTokens;
      this._tokenUsage.contextTokens += response.tokenUsage.promptTokens;

      // Add assistant message to memory
      if (response.textResponse) {
        const assistantMsg: ApiMessage = {
          role: 'assistant',
          content: [{ type: 'text' as const, text: response.textResponse }],
          ts: Date.now(),
        };
        await this.memoryModule.addMessage(assistantMsg);
      }

      // Record current workspace context for future iterations (for next turn's historical record)
      await this.memoryModule.recordWorkspaceContext(
        currentWorkspaceContext,
        iterations,
      );

      // Execute tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Enforce single tool call per response
        if (response.toolCalls.length > 1) {
          // Push error for LLM to see in context
          const errorMsg = `Multiple tool calls detected (${response.toolCalls.length}). Only one tool per response is allowed. Please retry with a single tool call.`;
          this.memoryModule.pushErrors([new Error(errorMsg)]);
          // Create error tool result and add to memory
          const errorResult: ApiMessage = {
            role: 'system',
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: response.toolCalls[0].id,
                content: `Error: ${errorMsg}`,
              },
            ],
            ts: Date.now(),
          };
          await this.memoryModule.addMessage(errorResult);
          this.logger.warn(errorMsg);
          continue; // Let LLM retry
        }
        const toolResults = await this.executeToolCalls(response.toolCalls);
        this.logger.debug(
          {
            count: toolResults.length,
            toolResults: this.safeStringify(toolResults),
          },
          '[Agent core] toolResults count',
        );
        const toolResultsJson =
          toolResults && toolResults.length > 0
            ? this.safeStringify(toolResults, null, 2)
            : '[]';
        this.logger.info(
          { toolResults: toolResultsJson },
          '[Agent core] tool call executed',
        );

        // Check for completion
        const hasCompletion = toolResults.some(
          (r) => r.toolName === 'attempt_completion',
        );
        if (hasCompletion) {
          return { didComplete: true };
        }

        // Check for abort
        if (this.isAborted()) {
          return { didComplete: true };
        }
      } else {
        // No tool calls, throw error
        throw new NoToolsUsedError();
      }
    }

    this.logger.warn({ iterations }, 'Max iterations reached');
    return { didComplete: true };
  }

  /**
   * Execute a batch of tool calls
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
        this.logger.info(
          { toolName: toolCall.name, args: this.safeStringify(args) },
          'Executing tool',
        );

        const result = await this.toolManager.executeTool(toolCall.name, args);

        // Get tool source info
        const toolSourceInfo = this.toolManager.getToolSource(toolCall.name);
        const componentKey = toolSourceInfo?.componentKey;

        const toolResult: ToolExecutionResult = {
          toolName: toolCall.name,
          success: true,
          result,
          timestamp: Date.now(),
          componentKey,
          toolUseId: toolCall.id,
        };
        results.push(toolResult);

        // Record in memory
        this.memoryModule.recordToolCall(toolCall.name, true, result);

        // Add tool result message to memory
        const toolResultMsg: ApiMessage = {
          role: 'system',
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: toolCall.id,
              content: this.safeStringify(result),
            },
          ],
          ts: Date.now(),
        };
        await this.memoryModule.addMessage(toolResultMsg);

        // Track tool usage
        if (!this._toolUsage[toolCall.name]) {
          this._toolUsage[toolCall.name] = { attempts: 0, failures: 0 };
        }
        this._toolUsage[toolCall.name].attempts++;

        // Reset consecutive error count on success
        this.resetConsecutiveErrorCount();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          { toolName: toolCall.name, error: errorMessage },
          'Tool execution failed',
        );

        const toolResult: ToolExecutionResult = {
          toolName: toolCall.name,
          success: false,
          result: { error: errorMessage },
          timestamp: Date.now(),
          toolUseId: toolCall.id,
        };
        results.push(toolResult);

        // Push error for LLM to see in context
        this.memoryModule.pushErrors([
          new Error(
            `Tool "${toolCall.name}" failed: ${errorMessage}. Please analyze the error and try an alternative approach.`,
          ),
        ]);

        // Record failure in memory
        this.memoryModule.recordToolCall(toolCall.name, false, errorMessage);

        // Track tool usage
        if (!this._toolUsage[toolCall.name]) {
          this._toolUsage[toolCall.name] = { attempts: 0, failures: 0 };
        }
        this._toolUsage[toolCall.name].attempts++;
        this._toolUsage[toolCall.name].failures++;

        // Track consecutive errors for abort
        this.handleConsecutiveError({ toolName: toolCall.name, errorMessage });
      }
    }

    return results;
  }

  /**
   * Build system prompt for the agent
   * Simplified mainstream agent framework: role + tools + guidelines
   */
  private buildSystemPrompt(): string {
    const parts: string[] = [];

    // 0. Workspace guidelines with explicit tool calling format
    parts.push(`# Responsive Agent Guideline

You are an AI agent that uses tools to accomplish tasks. Your core workflow is:

**Tool Call Loop:**
1. Analyze the current context and task
2. Call ONE tool to gather information or perform an action
3. Receive the tool result
4. Analyze the result and decide next step
5. Repeat until task is complete
6. Call attempt_completion to finish

**Important Rules:**
- Call ONLY ONE tool per response
- After receiving the tool result, analyze it and decide if more tool calls are needed
- When all tasks are done, call attempt_completion tool

## Workspace Context
- The CONTEXT section shows current component states (data, UI, pending actions)
- The LOG section shows recent tool execution results (most recent marked with **>**)
- After each tool call, the workspace state is updated for the next iteration

## Error Handling
- If a tool fails, analyze the error message and try an alternative approach
- Do NOT repeat the same failed tool call
- Use different tools or parameters to work around failures
`);

    // 1. SOP (Standard Operating Procedure)
    if (this.agentSop) {
      parts.push(`# Standard Operating Procedure\n${this.agentSop}`);
    }

    // 2. Tool usage principles
    parts.push(`# Tool Usage
- Call only ONE tool per response
- After receiving the result, analyze it and call another tool if needed
- When all tasks are complete, call attempt_completion to finish
- If a tool fails, analyze the error and try an alternative approach`);

    // 3.1 Tool descriptions (grouped by component with examples)
    const allTools = this.workspace.getAllTools();
    if (allTools.length > 0) {
      // Group tools by component
      const toolsByComponent = new Map<string, typeof allTools>();
      for (const t of allTools) {
        const key = t.componentKey || 'global';
        const existing = toolsByComponent.get(key);
        if (existing) {
          existing.push(t);
        } else {
          toolsByComponent.set(key, [t]);
        }
      }

      const componentSections: string[] = [];
      for (const [componentKey, tools] of toolsByComponent) {
        const toolDescriptions = tools
          .map((t) => {
            const tool = t.tool;
            const desc = tool.desc || 'No description';

            // Format examples if available
            let examplesStr = '';
            if (tool.examples && tool.examples.length > 0) {
              const exampleLines = tool.examples
                .map((ex) => {
                  const paramsStr = Object.entries(ex.params)
                    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                    .join(', ');
                  return `**${ex.description}**\n\`\`\`json\n{${paramsStr}}\n\`\`\``;
                })
                .join('\n');
              examplesStr = `\n\n**Examples:**\n${exampleLines}`;
            }

            return `### ${tool.toolName}
${desc}${examplesStr}`;
          })
          .join('\n\n');

        const componentLabel =
          componentKey === 'global' ? 'Global Tools' : `${componentKey} Tools`;
        componentSections.push(`## ${componentLabel}\n\n${toolDescriptions}`);
      }

      parts.push(
        `# Available Tools\n\n${componentSections.join('\n\n---\n\n')}`,
      );
    }

    // Note: Errors are prepended to messages in getHistoryForPrompt(), not in system prompt

    return parts.join('\n\n');
  }

  /**
   * Format a message for memory context
   */
  private formatMessage(message: ApiMessage): string {
    if (typeof message === 'string') {
      return message;
    }

    const formatContent = (content: string | unknown[]): string => {
      if (typeof content === 'string') {
        return content;
      }
      if (Array.isArray(content)) {
        return content
          .map((c) => {
            if (typeof c === 'object' && c !== null && 'text' in c) {
              return (c as { text: string }).text;
            }
            return JSON.stringify(c);
          })
          .join('\n');
      }
      return JSON.stringify(content);
    };

    const roleLabel = message.role.toUpperCase();
    const content = formatContent(message.content);
    return `[${roleLabel}]\n${content}`;
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
    // Use the simplified buildSystemPrompt method
    return this.buildSystemPrompt();
  }
}
