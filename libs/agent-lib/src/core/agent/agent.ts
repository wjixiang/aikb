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
import { ComponentToolProvider } from '../tools/providers/ComponentToolProvider.js';
import {
  RuntimeTaskComponent,
  createRuntimeTaskComponent,
  type ComponentStateBase,
} from '../../components/index.js';
import type { IPersistenceService } from '../persistence/types.js';
import pino from 'pino';

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

  // Task module (sub-module for runtime task handling)
  // @deprecated - Will be removed in future versions. Use persistence service instead.
  private taskModule?: RuntimeTaskComponent;

  // Persistence service (optional)
  private persistenceService?: IPersistenceService;

  private agentSop: SOP;
  private logger: pino.Logger;
  public instanceId: string;
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
    @inject(TYPES.TaskId) @optional() taskId?: string,
    @inject(TYPES.IPersistenceService)
    @optional()
    persistenceService?: IPersistenceService,
  ) {
    this.instanceId = instanceId;
    // Instantiate pino logger directly
    this.logger = pino({ level: process.env['LOG_LEVEL'] || 'debug' });
    this.workspace = workspace as unknown as VirtualWorkspace;
    this._taskId = taskId || crypto.randomUUID();
    this.agentSop = agentSop;
    this._currentPollInterval = 30000;

    // Use injected dependencies
    this.memoryModule = memoryModule as MemoryModule;
    this.apiClient = apiClient;
    this.toolManager = toolManager;
    this.persistenceService = persistenceService;

    // Create session on initialization if persistence is enabled
    if (this.persistenceService) {
      void this.createSession();
    }
  }

  /**
   * Create persistence session
   */
  private async createSession(): Promise<void> {
    if (!this.persistenceService) return;

    try {
      await this.persistenceService.createSession({
        instanceId: this.instanceId,
        status: this._status,
        totalTokensIn: this._tokenUsage.totalTokensIn,
        totalTokensOut: this._tokenUsage.totalTokensOut,
        totalCost: this._tokenUsage.totalCost,
        consecutiveMistakeCount: this._consecutiveMistakeCount,
        collectedErrors: this._collectedErrors,
      });
    } catch (error) {
      this.logger.error({ error }, '[Agent] Failed to create session');
    }
  }

  /**
   * Persist current agent state
   */
  private async persistState(): Promise<void> {
    if (!this.persistenceService) return;

    try {
      await this.persistenceService.updateSession(this.instanceId, {
        status: this._status,
        abortReason: this._abortInfo?.reason,
        abortSource: this._abortInfo?.source,
        totalTokensIn: this._tokenUsage.totalTokensIn,
        totalTokensOut: this._tokenUsage.totalTokensOut,
        totalCost: this._tokenUsage.totalCost,
        toolUsage: this._toolUsage,
        consecutiveMistakeCount: this._consecutiveMistakeCount,
        collectedErrors: this._collectedErrors,
      });
    } catch (error) {
      this.logger.error(
        { error, instanceId: this.instanceId },
        '[Agent] Failed to persist state',
      );
    }
  }

  /**
   * End the current session
   * Updates both Session and Instance status to 'completed' or 'aborted'
   */
  public async endSession(reason?: string): Promise<void> {
    if (!this.persistenceService) {
      this.logger.warn('[Agent] No persistence service, skipping endSession');
      return;
    }

    const finalStatus = reason === 'aborted' ? 'aborted' : 'completed';

    try {
      // Save component states first
      await this.saveComponentStates();

      // Export and persist component results
      const exportResults = await this.workspace.exportResult();
      if (Object.keys(exportResults).length > 0) {
        await this.persistenceService.saveExportResult(this.instanceId, exportResults as Record<string, unknown>);
        this.logger.info(
          { instanceId: this.instanceId, resultCount: Object.keys(exportResults).length },
          '[Agent] Export results saved',
        );
      }

      // Update session status
      await this.persistenceService.updateSession(this.instanceId, {
        status: finalStatus,
        abortReason: reason,
        abortSource: 'system',
        totalTokensIn: this._tokenUsage.totalTokensIn,
        totalTokensOut: this._tokenUsage.totalTokensOut,
        totalCost: this._tokenUsage.totalCost,
        toolUsage: this._toolUsage,
        consecutiveMistakeCount: this._consecutiveMistakeCount,
        collectedErrors: this._collectedErrors,
      });

      // Update instance metadata status
      await this.persistenceService.updateInstanceMetadata(this.instanceId, {
        status: finalStatus,
      });

      this.logger.info(
        { instanceId: this.instanceId, status: finalStatus },
        '[Agent] Session ended',
      );
    } catch (error) {
      this.logger.error(
        { error, instanceId: this.instanceId },
        '[Agent] Failed to end session',
      );
    }
  }

  /**
   * Save all component states to persistence
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
   * Restore all component states from persistence
   */
  public async restoreComponentStates(): Promise<void> {
    if (!this.persistenceService) return;

    try {
      const states = await this.persistenceService.getAllComponentStates(
        this.instanceId,
      );
      if (Object.keys(states).length > 0) {
        const stateMap = new Map<string, ComponentStateBase>(
          Object.entries(states) as [string, ComponentStateBase][],
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
   * Save memory state to persistence
   */
  private async saveMemory(): Promise<void> {
    if (!this.persistenceService) return;

    // Check if persistence service supports memory persistence
    if (typeof this.persistenceService.saveMemory !== 'function') {
      return;
    }

    try {
      await this.persistenceService.saveMemory(this.instanceId, {
        messages: this.memoryModule.getAllMessages(),
        workspaceContexts: this.memoryModule.getWorkspaceContexts(),
        config: this.memoryModule.getConfig(),
      });
      this.logger.debug('[Agent] Memory saved to persistence');
    } catch (error) {
      this.logger.warn({ error }, '[Agent] Failed to save memory');
    }
  }

  /**
   * Load memory state from persistence
   */
  public async loadMemory(): Promise<boolean> {
    if (!this.persistenceService) return false;

    // Check if persistence service supports memory loading
    if (typeof this.persistenceService.loadMemory !== 'function') {
      return false;
    }

    try {
      const memory = await this.persistenceService.loadMemory(this.instanceId);
      if (memory) {
        // Import memory state into memory module
        this.memoryModule.import({
          messages: memory.messages,
          workspaceContexts: memory.workspaceContexts,
        });
        this.logger.info(
          { instanceId: this.instanceId, messageCount: (memory.messages as unknown[]).length },
          '[Agent] Memory loaded from persistence',
        );
        return true;
      }
    } catch (error) {
      this.logger.warn({ error }, '[Agent] Failed to load memory');
    }
    return false;
  }

  /**
   * Initialize TaskModule after expert identity is set
   * Called internally when setExpertIdentity is invoked
   */
  private initializeTaskModule(): void {
    if (this.taskModule) {
      return; // Already initialized
    }

    this.taskModule = createRuntimeTaskComponent({
      instanceId: this.instanceId,
      maxQueueSize: 100,
    });

    // Register TaskModule tools to ToolManager via ComponentToolProvider
    const taskProvider = new ComponentToolProvider(
      'runtime-task',
      this.taskModule,
      this.workspace.notifyToolExecuted.bind(this.workspace),
    );
    this.toolManager.registerProvider(taskProvider);

    // Register external renderer to Workspace for task content rendering
    this.workspace.registerExternalRenderer('runtime-task', async () => {
      return this.taskModule!.renderImply();
    });

    // Register listener for new tasks to wake up the agent
    this.taskModule.onNewTask(async (task: any) => {
      this.logger.info(
        `[Agent] Received new task ${task.taskId}, waking up agent`,
      );
      await this.wakeUpForTask(task);
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

  /**
   * Get task module (sub-module for runtime task handling)
   * Initializes on first access if expert identity is set
   */
  public getTaskModule(): RuntimeTaskComponent {
    if (!this.taskModule) {
      this.initializeTaskModule();
    }
    return this.taskModule!;
  }

  // ==================== Lifecycle Methods ====================
  // Lifecycle status: running / completed / idle / aborted

  /**
   * Start agent with a user query
   */
  async start(): Promise<Agent> {
    this._status = 'running';
    void this.persistState(); // 持久化状态变更

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
    void this.persistState();
    void this.endSession(); // 结束 session
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
    void this.persistState();
    void this.endSession('aborted'); // 结束 session
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
   * Wake up agent to process a runtime task
   * Called by ExpertInstance when a new task is received via RuntimeTaskComponent
   * Triggers the agent to check task queue and process pending tasks
   */
  async wakeUpForTask(task: any): Promise<void> {
    this.logger.info(`Waking up agent for task processing: ${task.taskId}`);

    // Ensure task module is initialized (registers external renderer)
    if (!this.taskModule) {
      this.initializeTaskModule();
    }

    // Reset status to running if it was completed
    if (this._status === 'completed' || this._status === 'idle') {
      this._status = 'running';
    }

    // Trigger agent to process the task
    // The LLM will check task queue, process tasks, and report results
    await this.requestLoop();
  }

  /**
   * Set the central task queue for the agent's task module
   * This allows the agent to access runtime-managed tasks
   */
  setCentralTaskQueue(centralTaskQueue: any): void {
    // Ensure task module is initialized
    if (!this.taskModule) {
      this.initializeTaskModule();
    }
    // Update the task module's central queue reference
    if (this.taskModule) {
      this.taskModule.centralTaskQueue = centralTaskQueue;
      this.logger.info('[Agent] Central task queue set for task module');
    }
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
   */
  protected async requestLoop(): Promise<void> {
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

        // Save memory to persistence after each iteration
        await this.saveMemory();
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

    this.complete();
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
            toolResults: JSON.stringify(toolResults),
          },
          '[Agent core] toolResults count',
        );
        const toolResultsJson =
          toolResults && toolResults.length > 0
            ? JSON.stringify(toolResults, null, 2)
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
          { toolName: toolCall.name, args: JSON.stringify(args) },
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
              content: JSON.stringify(result),
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

    // 4. Mail component (if available)
    const componentKeys = this.workspace.getComponentKeys();
    if (componentKeys.includes('mail')) {
      parts.push(`# Mail System
The mail system provides task instructions from other agents. Check your inbox regularly for new tasks.

## Available Operations
- Use getInbox to check your mailbox for new tasks/instructions
- Use markAsRead after processing a message

Note: The mail component is for receiving task instructions only. Do not send replies through the mail system.`);
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
