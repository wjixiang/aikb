import { injectable, inject, optional } from 'inversify';
import Anthropic from "@anthropic-ai/sdk";
import { ApiMessage, MessageBuilder, ExtendedContentBlock } from "../memory/types.js";
import type { AgentStatus } from "../common/types.js";
import { MessageTokenUsage, ToolUsage } from "../types/index.js";
import { VirtualWorkspace } from "../statefulContext/index.js";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../types/index.js";
import type { ApiResponse, ToolCall } from '../api-client/index.js';
import { DefaultToolCallConverter } from '../api-client/index.js';
import { ErrorHandlerPrompt } from '../common/ErrorHandlerPrompt.js';
import {
    AgentError,
    ConsecutiveMistakeError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../common/errors.js';
import { PromptBuilder, FullPrompt } from '../prompts/PromptBuilder.js';
import type { ApiClient } from '../api-client/index.js';
import { generateWorkspaceGuide } from "../prompts/sections/workspaceGuide.js";
import { generateActionPhaseGuidance } from "../prompts/sections/actionPhaseGuidance.js";
import { MemoryModule, defaultMemoryConfig } from '../memory/MemoryModule.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import type { ThinkingPhaseResult, IThinkingModule } from '../thinking/types.js';
import type { IActionModule, ActionPhaseResult, ToolResult } from '../action/types.js';
import { TYPES } from '../di/types.js';
import type { IVirtualWorkspace } from '../statefulContext/index.js';
import type { IMemoryModule } from '../memory/types.js';
import type { IToolManager } from '../tools/IToolManager.js';
import type { ILogger } from '../utils/logging/types.js';

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
    override code: string = 'NullCurrentTurnError'
    constructor(message: string) {
        super(message)
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
 * Stack item for recursive request loop
 */
interface StackItem {
    sender: 'user' | 'system';
    content: Anthropic.Messages.ContentBlockParam[];
    retryAttempt?: number;
    userMessageWasRemoved?: boolean;
}

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
    private _consecutiveMistakeCount: number = 0;
    private _consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map();
    private _collectedErrors: string[] = [];
    private _abortInfo: AbortInfo | null = null;


    // Memory module (dependency injected, always present)
    private memoryModule: IMemoryModule;

    // Thinking module (dependency injected, always present)
    private thinkingModule: IThinkingModule;

    // Action module (dependency injected, always present)
    private actionModule: IActionModule;

    private agentPrompt: AgentPrompt;

    constructor(
        @inject(TYPES.AgentConfig) @optional() public config: AgentConfig = defaultAgentConfig,
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
     * Getter for consecutive mistake count for apply diff
     */
    public get consecutiveMistakeCountForApplyDiff(): Map<string, number> {
        return this._consecutiveMistakeCountForApplyDiff;
    }

    /**
     * Setter for consecutive mistake count for apply diff
     */
    public set consecutiveMistakeCountForApplyDiff(map: Map<string, number>) {
        this._consecutiveMistakeCountForApplyDiff = map;
    }

    /**
     * Get memory module (always available)
     */
    public getMemoryModule(): IMemoryModule {
        return this.memoryModule;
    }

    /**
     * Check if memory module is enabled (always true now)
     * @deprecated Memory module is always enabled
     */
    public hasMemoryModule(): boolean {
        return true;
    }

    // ==================== Lifecycle Methods ====================
    // Lifecycle status: running / completed / idle / aborted

    /**
     * Start agent with a user query
     */
    async start(query: string): Promise<Agent> {
        this._status = 'running';

        // Note: Initial user message will be added in requestLoop after startTurn()
        // This ensures the message is properly associated with a Turn

        // Start request loop
        await this.requestLoop(query);
        return this;
    }

    /**
     * Complete agent task
     */
    complete(tokenUsage?: MessageTokenUsage, toolUsage?: ToolUsage): void {
        this._status = 'completed';
    }

    /**
     * Abort agent task
     * @param abortReason - The reason for aborting (required)
     * @param source - The source of the abort (user, system, error, timeout, manual)
     * @param details - Additional details about the abort
     */
    abort(abortReason: string, source: AbortSource = 'manual', details?: Record<string, unknown>): void {
        this._status = 'aborted';
        this._abortInfo = {
            reason: abortReason,
            timestamp: Date.now(),
            source,
            details
        };
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
    protected async requestLoop(query: string): Promise<void> {
        // Reset collected errors for this new operation
        this.resetCollectedErrors();

        let lastToolResults: ToolResult[] = [];

        const userContent: Anthropic.Messages.ContentBlockParam[] = [
            { type: 'text', text: `<task>${query}</task>` }
        ];
        const stack: StackItem[] = [{ sender: 'user', content: userContent, retryAttempt: 0 }];

        // Track if we need to start a new turn
        let needsNewTurn = true;

        while (needsNewTurn) {

            // Create new turn 
            // Notice: now workspace context will include Mail component, which has the information 
            // about task. The system do not need to pass Task or user message anymore, instead agent 
            // should analysis and extract task from mail component automatically.

            const currentWorkspaceContext = await this.workspace.render()
            this.memoryModule.startTurn(currentWorkspaceContext);

            try {
                // EXECUTE THINKING PHASE
                const thinkingResult = await this.executeThinkingPhase(
                    lastToolResults
                );

                // EXECUTE ACTION PHASE
                const actionResult = await this.executeActionPhase(
                    thinkingResult,
                    lastToolResults
                );

                // Store tool results for next thinking phase
                lastToolResults = actionResult.toolResults;

                // Trigger workspace re-render after tool execution
                // This ensures the next iteration gets the UPDATED workspace context
                // rather than the context that was captured BEFORE tool execution
                this.logger.info(`Tool-calling has been executed successfully`, {
                    toolCallResult: lastToolResults
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
                const errorObj: Record<string, unknown> = error instanceof Error
                    ? {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    }
                    : { message: String(error), original: error };
                // Add cause if it exists
                if (error instanceof Error && (error as any).cause) {
                    this.memoryModule.getTurnStore().pushErrors([error])
                }
                this.logger.error('Agent loop error', {
                    ...errorObj
                })

                if (this._status === 'aborted') {
                    needsNewTurn = false
                } else {
                    needsNewTurn = true
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
        lastToolResults: ToolResult[]
    ): Promise<ThinkingPhaseResult> {
        const currentTurn = this.memoryModule.getCurrentTurn();
        const currentWorkspaceContext = await this.workspace.render()
        const thinkingResult = await this.thinkingModule.performThinkingPhase(
            currentWorkspaceContext,
            lastToolResults
        );

        const thinkingTokens = thinkingResult.tokensUsed;

        // Store thinking phase in turn
        if (!currentTurn) throw new NullCurrentTurnError(`Store thinking message failed: current turn is null`)
        this.memoryModule.getTurnStore().storeThinkingPhase(
            currentTurn.id,
            thinkingResult.rounds,
            thinkingResult.tokensUsed
        );

        // Store summary if available
        if (thinkingResult.summary) {
            this.memoryModule.getTurnStore().storeSummary(
                currentTurn.id,
                thinkingResult.summary,
                []  // insights - extracted by ThinkingModule
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
     * @param lastToolResults - Results from previous tool executions
     * @returns ActionPhaseResult from the action module
     */
    private async executeActionPhase(
        thinkingResult: ThinkingPhaseResult,
        lastToolResults: ToolResult[]
    ): Promise<ActionPhaseResult> {
        const systemPrompt = await this.getSystemPrompt();
        const conversationHistory = this.memoryModule.getHistoryForPrompt();

        // Convert tools to OpenAI format (inline utility)
        const allTools = this.workspace.getAllTools();
        const tools = allTools.map((t: { tool: any }) => t.tool);
        const converter = new DefaultToolCallConverter();
        const openaiTools = converter.convertTools(tools);

        // Generate action phase guidance with thinking summary
        const thinkingSummary = thinkingResult.rounds.length > 0
            ? this.formatMemoryThinkingSummary(thinkingResult)
            : undefined;
        const actionPhaseGuidance = generateActionPhaseGuidance(thinkingSummary);

        // Prepend action phase guidance to system prompt
        const enhancedSystemPrompt = `${actionPhaseGuidance}\n\n${systemPrompt}`;

        // Get current workspace context
        const currentWorkspaceContext = await this.workspace.render()

        const actionResult: ActionPhaseResult = await this.actionModule.performActionPhase(
            currentWorkspaceContext,
            enhancedSystemPrompt,
            conversationHistory,
            openaiTools,
            () => this.isAborted(),
            this.workspace.getToolManager()  // Use workspace's toolManager to ensure tools are available
        );
        this.logger.info(`Action phase successfully proformed`);

        // Update agent state from action result
        this._tokenUsage.totalTokensOut += actionResult.tokensUsed;
        this._toolUsage = { ...this._toolUsage, ...actionResult.toolUsage };

        // Add messages to memory
        this.memoryModule.addMessage(actionResult.assistantMessage);
        if (actionResult.userMessageContent.length > 0) {
            const message = MessageBuilder.custom('system', actionResult.userMessageContent);
            this.memoryModule.addMessage(message);
        }

        // Record tool calls to turn
        actionResult.toolResults.forEach(result => {
            this.memoryModule.recordToolCall(
                result.toolName,
                result.success,
                result.result
            );
        });

        return actionResult;
    }

    // ==================== Message Processing (Deprecated - Now handled by ActionModule) ====================

    /**
     * Add a system message to conversation history
     *
     * NOTE: This method is NOT used for workspace context anymore.
     * Workspace context is always passed fresh via workspaceContext parameter.
     * Use this method for other system messages like thinking summaries, etc.
     *
     * @param message - The system message content to add
     * @deprecated Use memoryModule.addSystemMessage() directly
     */
    addSystemMessageToHistory(message: string): void {
        const apiMessage = MessageBuilder.system(message);
        this.memoryModule.addMessage(apiMessage);
    }

    // ==================== Helper Methods ====================

    /**
     * Format memory thinking summary for history
     */
    private formatMemoryThinkingSummary(result: ThinkingPhaseResult): string {
        const rounds = result.rounds
            .map((r: any) => {
                const recalled = r.recalledContexts?.length > 0
                    ? `\n  Recalled: ${r.recalledContexts.map((c: any) => `Turn ${c.turnNumber}`).join(', ')}`
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

    /**
     * Handle error and determine if should abort
     */
    private handleError(error: unknown, retryAttempt: number): boolean {
        // Collect error
        const errorMessage = error instanceof Error ? error.message : String(error);
        this._collectedErrors.push(errorMessage);

        // Check if should abort
        if (retryAttempt >= this.config.maxRetryAttempts) {
            return true;
        }

        // Non-retryable errors
        if (error instanceof ConsecutiveMistakeError) {
            return true;
        }

        return false;
    }

    renderAgentPrompt() {
        const capability = this.agentPrompt.capability;
        const direction = this.agentPrompt.direction;

        return `
------------
Capabilities
------------
${capability}

--------------
Work Direction
--------------
${direction}

`
    }

    // ==================== Agent-Specific Methods ====================

    /**
     * Get system prompt for agent
     * Uses VirtualWorkspace's render for context
     */
    async getSystemPrompt() {
        // Render component tools section
        const componentToolsSection = await this.workspace.renderComponentToolsSection();
        const componentToolsRendered = componentToolsSection ? componentToolsSection.render() : '';

        return `
${generateWorkspaceGuide()}
${this.renderAgentPrompt()}
${this.workspace.renderToolBox().render()}
${componentToolsRendered}
        `;
    }
}
