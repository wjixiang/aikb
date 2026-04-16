import { injectable, inject, optional } from 'inversify';

import type { Message, ContentBlock, ToolUseBlock, ToolResultBlock } from '../memory/types.js';
import { MessageBuilder, TokenUsage } from 'llm-api-client';
import { AgentStatus } from '../common/types.js';
import { ToolUsage } from '../types/index.js';
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from '../types/index.js';
import { VirtualWorkspace } from '../statefulContext/virtualWorkspace.js';
import { DefaultToolCallConverter } from 'llm-api-client';
import { AgentError, NoToolsUsedError } from '../common/errors.js';
import { MemoryModule } from '../memory/MemoryModule.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type {
  ApiClient,
  ChatCompletionTool,
  ToolCall,
} from 'llm-api-client';
import type { IToolManager } from '../tools/index.js';
import { TYPES } from '../di/types.js';
import type { IVirtualWorkspace } from '../../components/core/types.js';
import type { IMemoryModule } from '../memory/types.js';
import type { Tool } from '../../components/core/types.js';
import { ToolComponent } from '../statefulContext/index.js';
import type { HookModule } from '../hooks/HookModule.js';
import { HookType } from '../hooks/types.js';
import type { IPersistenceService } from '../persistence/types.js';

import { getLogger } from '@shared/logger';



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

@injectable()
export class Agent {
  workspace: VirtualWorkspace;
  private _status: AgentStatus = AgentStatus.Sleeping;
  private _taskId: string;
  private _tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
  };
  private _toolUsage: ToolUsage = {};
  private _consecutiveMistakeCount = 0;
  private _collectedErrors: string[] = [];
  private _abortInfo: AbortInfo | null = null;

  // Consecutive error tracking for abort (disabled by setting to Infinity)
  private _consecutiveErrorCount = 0;
  private readonly MAX_CONSECUTIVE_ERRORS = Infinity;

  // Memory module (dependency injected, always present)
  private memoryModule: IMemoryModule;

  // API client for LLM calls
  private apiClient: ApiClient;

  // Tool manager for executing tools
  private toolManager: IToolManager;

  // Sleep reason (for observability)
  private _sleepReason: string | null = null;

  // Persistence service (for component states - instance-level)
  private persistenceService?: IPersistenceService;

  private persistInstanceStatus(): void {
    if (!this.persistenceService) return;
    void this.persistenceService.updateInstanceMetadata(this.instanceId, {
      status: this._status,
    });
  }

  // Hook module (required)
  private hookModule: HookModule;

  private agentSop: SOP;
  private logger = getLogger('Agent');
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
    @inject(TYPES.HookModule) hookModule: HookModule,
    @inject(TYPES.IPersistenceService)
    @optional()
    persistenceService?: IPersistenceService,
    @inject(TYPES.TaskId) @optional() taskId?: string,
  ) {
    this.instanceId = instanceId;
    this.workspace = workspace as unknown as VirtualWorkspace;
    this._taskId = taskId || crypto.randomUUID();
    this.agentSop = agentSop;

    this.memoryModule = memoryModule as MemoryModule;
    this.apiClient = apiClient;
    this.toolManager = toolManager;
    this.hookModule = hookModule;
    this.persistenceService = persistenceService;
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
   * Restore memory from persistence (instance-level)
   */
  public async restoreMemory(): Promise<void> {
    if (!this.persistenceService) return;

    try {
      const savedMemory = await this.persistenceService.loadMemory(
        this.instanceId,
      );
      if (savedMemory) {
        (this.memoryModule as MemoryModule).import(savedMemory);
        this.logger.info(
          { instanceId: this.instanceId },
          '[Agent] Memory restored from persistence',
        );
      }
    } catch (error) {
      this.logger.error(
        { error, instanceId: this.instanceId },
        '[Agent] Failed to restore memory',
      );
    }
  }



  // ==================== Memory Helpers ====================

  /**
   * Add a message to memory and emit MESSAGE_ADDED hook.
   * Centralizes all memoryModule.addMessage calls so events are never missed.
   */
  private async addMessageToMemory(msg: Message): Promise<void> {
    await this.memoryModule.addMessage(msg);
    await this.hookModule.executeHooks(HookType.MESSAGE_ADDED, {
      type: HookType.MESSAGE_ADDED,
      timestamp: new Date(),
      instanceId: this.instanceId,
      message: msg,
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
  public get tokenUsage(): TokenUsage {
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
  public get conversationHistory(): Message[] {
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
    const jsonReplacer = (key: string, value: unknown): unknown => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      if (replacer && typeof replacer === 'function') {
        return replacer(key, value);
      }
      return value;
    };
    try {
      return JSON.stringify(obj, jsonReplacer, space);
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



  // ==================== Lifecycle Methods ====================
  // Lifecycle status: sleeping / running / aborted

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

    this._status = AgentStatus.Running;
    this.persistInstanceStatus();
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

    this._status = AgentStatus.Sleeping;
    this.persistInstanceStatus();

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

    this._status = AgentStatus.Aborted;
    this._abortInfo = {
      reason: abortReason,
      timestamp: Date.now(),
      source,
      details,
    };

    this.persistInstanceStatus();

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
   * Reset agent status to Sleeping - allows agent to be restarted after stop.
   * This is called by Runtime when stopping an agent, not by abort() itself.
   */
  public resetToSleeping(): void {
    this._status = AgentStatus.Sleeping;
    this.persistInstanceStatus();
  }

  /**
   * Check if agent is sleeping
   */
  public isSleeping(): boolean {
    return this._status === AgentStatus.Sleeping;
  }

  /**
   * Save state and transition to Sleeping.
   * The Runtime will unload the container after this call.
   * @param reason - Why the agent is sleeping (for observability)
   */
  public async sleep(reason: string): Promise<void> {
    this._status = AgentStatus.Sleeping;
    this._sleepReason = reason;

    // Save component states and memory before unloading
    await this.saveComponentStates();

    this.persistInstanceStatus();

    void this.hookModule.executeHooks(HookType.AGENT_SLEEPING, {
      type: HookType.AGENT_SLEEPING,
      timestamp: new Date(),
      instanceId: this.instanceId,
      reason,
    });

    this.logger.info({ reason }, '[Agent] Entering sleep state');
  }

  /**
   * Inject a message into the agent's conversation memory.
   * If the agent is sleeping, it will be woken up and the requestLoop started.
   */
  public async injectMessage(text: string): Promise<void> {
    const userMessage: Message = {
      role: 'user',
      content: [{ type: 'text' as const, text }],
      ts: Date.now(),
    };
    await this.addMessageToMemory(userMessage);

    if (this._status === AgentStatus.Sleeping) {
      this._status = AgentStatus.Running;
      void this.requestLoop();
    }
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
   * @returns The workspace context after completion
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
          const errorApiMessage: Message = {
            role: 'system',
            content: [
              { type: 'text' as const, text: `[Error: ${error.message}]` },
            ],
            ts: Date.now(),
          };
          await this.addMessageToMemory(errorApiMessage);

          // Track consecutive error for abort (NoToolsUsedError counts as an error)
          this.handleConsecutiveError({ errorMessage });

          // Check if we've aborted due to too many consecutive errors
          if (this._status === AgentStatus.Aborted) {
            needsNewTurn = false;
            break;
          }
        } else {
          // Handle other errors (tool execution errors, API errors, etc.)
          if (error instanceof Error) {
            this.memoryModule.pushErrors([error]);
            const errorApiMessage: Message = {
              role: 'system',
              content: [
                { type: 'text' as const, text: `[Error: ${error.message}]` },
              ],
              ts: Date.now(),
            };
            await this.addMessageToMemory(errorApiMessage);

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
          if (this._status === AgentStatus.Aborted) {
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
      if (this._status !== AgentStatus.Aborted) {
        this._status = AgentStatus.Sleeping;
        this.persistInstanceStatus();
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

      // Get conversation history — now directly usable as Message[] (no conversion needed)
      const memoryContext = this.memoryModule.getHistoryForPrompt();

      // Call LLM
      const response = await this.apiClient.makeRequest(
        systemPrompt,
        currentWorkspaceContext,
        memoryContext,
        { timeout: this.config.apiRequestTimeout },
        tools,
      );

      // Track token usage
      this._tokenUsage.promptTokens += response.tokenUsage.promptTokens;
      this._tokenUsage.completionTokens += response.tokenUsage.completionTokens;

      // Emit LLM call completed hook
      await this.hookModule.executeHooks(HookType.LLM_CALL_COMPLETED, {
        type: HookType.LLM_CALL_COMPLETED,
        timestamp: new Date(),
        instanceId: this.instanceId,
        tokenUsage: response.tokenUsage,
      });

      // Add assistant message to memory (including tool_use blocks for multi-turn context)
      const assistantContent: ContentBlock[] = [];
      if (response.textResponse) {
        assistantContent.push({ type: 'text', text: response.textResponse });
      }
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          let parsedArgs: Record<string, unknown> = {};
          try { parsedArgs = JSON.parse(tc.arguments); } catch { /* keep empty */ }
          assistantContent.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: parsedArgs,
          });
        }
      }
      if (assistantContent.length > 0) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: assistantContent,
          ts: Date.now(),
        };
        await this.addMessageToMemory(assistantMsg);
      }

      // Execute tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Enforce single tool call per response
        if (response.toolCalls.length > 1) {
          // Push error for LLM to see in context
          const errorMsg = `Multiple tool calls detected (${response.toolCalls.length}). Only one tool per response is allowed. Please retry with a single tool call.`;
          this.memoryModule.pushErrors([new Error(errorMsg)]);
          // Create error tool results for ALL tool calls so every tool_use
          // has a matching tool_result (Anthropic API requirement).
          const errorBlocks: ToolResultBlock[] = response.toolCalls.map((tc) => ({
            type: 'tool_result',
            tool_use_id: tc.id,
            toolName: tc.name,
            content: `Error: ${errorMsg}`,
            is_error: true,
          }));
          const errorResult: Message = {
            role: 'user',
            content: errorBlocks,
            ts: Date.now(),
          };
          await this.addMessageToMemory(errorResult);
          this.logger.warn(errorMsg);
          continue; // Let LLM retry
        }
        const toolResults = await this.executeToolCalls(response.toolCalls);
        this.logger.debug(
          {
            count: toolResults.length,
            toolResults: JSON.stringify(toolResults),
          },
          '[Agent core] tool call executed',
        );
        // const toolResultsJson =
        //   toolResults && toolResults.length > 0
        //     ? this.safeStringify(toolResults, null, 2)
        //     : '[]';
        // this.logger.info(
        //   { toolResults: toolResultsJson },
        //   '[Agent core] tool call executed',
        // );

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

        // Ensure result is properly formatted for memory
        let resultContent: string;
        if (result === null || result === undefined) {
          resultContent = 'null';
        } else if (typeof result === 'string') {
          resultContent = result || '(empty string)';
        } else {
          resultContent = this.safeStringify(result);
        }

        this.logger.debug(
          { toolName: toolCall.name, resultContent },
          '[Agent] Tool result content',
        );

        const isResultSuccess = !(
          result !== null &&
          typeof result === 'object' &&
          'error' in result
        );

        const toolResult: ToolExecutionResult = {
          toolName: toolCall.name,
          success: isResultSuccess,
          result,
          timestamp: Date.now(),
          componentKey,
          toolUseId: toolCall.id,
        };
        results.push(toolResult);

        // Add tool result message to memory
        const toolResultMsg: Message = {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolCall.id,
              toolName: toolCall.name,
              content: resultContent,
            },
          ],
          ts: Date.now(),
        };
        await this.addMessageToMemory(toolResultMsg);

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

        // Record failure in memory as tool_result message
        const errorToolResultMsg: Message = {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolCall.id,
              toolName: toolCall.name,
              content: `Error: ${errorMessage}`,
              is_error: true,
            },
          ],
          ts: Date.now(),
        };
        await this.addMessageToMemory(errorToolResultMsg);

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

You are an autonomous AI agent. You MUST take actions to accomplish tasks — never stop to ask the user for instructions or wait for input. Your only ways to respond are:
1. Call a tool to gather information or perform an action
2. Call attempt_completion when the task is fully done

You MUST call a tool in EVERY response. Never respond with plain text alone — that will be treated as an error.

**Tool Call Loop:**
1. Analyze the current context and task
2. Call ONE tool to gather information or perform an action
3. Receive the tool result
4. Analyze the result and decide next step
5. Repeat until task is complete
6. Call attempt_completion (no parameters) to finish

**Critical Rules:**
- Call ONLY ONE tool per response
- NEVER respond with text only — always call a tool
- When all tasks are done, call attempt_completion (no parameters) as your final action
- If a tool fails, analyze the error and try a different tool or approach
- Do NOT ask the user what to do — figure it out yourself using available tools

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
- You MUST call exactly ONE tool in every response — never respond with text only
- After receiving a tool result, analyze it and call the next tool
- When the task is fully complete, call attempt_completion (no parameters) to finish
- If a tool fails, try a different tool or different parameters — do not give up`);

    // 3. Component prompts (from registered components)
    const allComponents = this.workspace
      .getComponentKeys()
      .map((key) => this.workspace.getComponent(key))
      .filter((c): c is ToolComponent => c !== undefined);
    const componentPromptSections: string[] = [];
    for (const component of allComponents) {
      if (component.componentPrompt) {
        componentPromptSections.push(
          `## ${component.displayName}\n\n${component.componentPrompt}`,
        );
      }
    }
    if (componentPromptSections.length > 0) {
      parts.push(
        `# Component Context\n\n${componentPromptSections.join('\n\n---\n\n')}`,
      );
    }

    // 4. Tool descriptions (grouped by component with examples)
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
  private formatMessage(message: Message): string {
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
    return this._status === AgentStatus.Aborted;
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
