import Anthropic from "@anthropic-ai/sdk";
import {
    ApiMessage,
    TaskStatus,
    ThinkingBlock,
    MessageBuilder,
} from "../task/task.type.js";
import { TokenUsage, ToolUsage } from "../types/index.js";
import { VirtualWorkspace } from "../statefulContext/index.js";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../types/index.js";
import type { ApiResponse, ToolCall } from '../api-client/index.js';
import { DefaultToolCallConverter } from '../api-client/index.js';
import { AssistantMessageContent, ToolUse } from '../assistant-message/assistantMessageTypes.js';
import { ErrorHandlerPrompt } from '../task/error/ErrorHandlerPrompt.js';
import {
    ConsecutiveMistakeError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../task/task.errors.js';
import { PromptBuilder, FullPrompt } from '../prompts/PromptBuilder.js';
import type { ApiClient } from '../api-client/index.js';
import { generateWorkspaceGuide } from "../prompts/sections/workspaceGuide.js";
import { MemoryModule, MemoryModuleConfig, defaultMemoryConfig } from '../memory/MemoryModule.js';

/**
 * Tool result from execution
 */
interface ToolResult {
    toolName: string;
    success: boolean;
    result: any;
    timestamp: number;
}

export interface AgentConfig {
    apiRequestTimeout: number;
    maxRetryAttempts: number;
    consecutiveMistakeLimit: number;
    // Memory module configuration (now required, with defaults)
    memory?: Partial<MemoryModuleConfig>;
}

export const defaultAgentConfig: AgentConfig = {
    apiRequestTimeout: 40000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
};


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
 * Interface for message processing state
 */
interface MessageProcessingState {
    assistantMessageContent: AssistantMessageContent[];
    userMessageContent: (
        | Anthropic.TextBlockParam
        | Anthropic.ImageBlockParam
        | Anthropic.ToolResultBlockParam
    )[];
    didAttemptCompletion: boolean;
    cachedModel?: { id: string; info: any };
}

export interface AgentPrompt {
    capability: string;
    direction: string;
}

export class Agent {
    workspace: VirtualWorkspace;
    private _status: TaskStatus = 'idle';
    private _taskId: string;
    private _initialQuery: string | null = null;  // Store initial user query for task context
    private _tokenUsage: TokenUsage = {
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        contextTokens: 0,
    };
    private _toolUsage: ToolUsage = {};
    private _consecutiveMistakeCount: number = 0;
    private _consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map();
    private _collectedErrors: string[] = [];

    // Message processing state
    private messageState: MessageProcessingState = {
        assistantMessageContent: [],
        userMessageContent: [],
        didAttemptCompletion: false,
        cachedModel: undefined,
    };

    // API client (dependency injected)
    private apiClient: ApiClient;

    // Memory module (dependency injected, always present)
    private memoryModule: MemoryModule;

    constructor(
        public config: AgentConfig = defaultAgentConfig,
        workspace: VirtualWorkspace,
        private agentPrompt: AgentPrompt,
        apiClient: ApiClient,
        memoryModule?: MemoryModule,  // Optional injection for testing
        taskId?: string,
    ) {
        this.workspace = workspace;
        this._taskId = taskId || crypto.randomUUID();

        // Use injected API client
        this.apiClient = apiClient;

        // Initialize memory module (dependency injection or create new)
        if (memoryModule) {
            this.memoryModule = memoryModule;
        } else {
            this.memoryModule = new MemoryModule(apiClient, config.memory);
        }
    }

    // ==================== Public API ====================

    /**
     * Getter for task status
     */
    public get status(): TaskStatus {
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
    public get conversationHistory(): ApiMessage[] {
        return this.memoryModule.getAllMessages();
    }

    /**
     * Setter for conversation history (not supported in Turn-based architecture)
     * @deprecated Turn-based architecture doesn't support setting history directly
     */
    public set conversationHistory(history: ApiMessage[]) {
        console.warn('Setting conversation history is not supported in Turn-based architecture');
        // For backward compatibility, do nothing
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
    public getMemoryModule(): MemoryModule {
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

    /**
     * Start agent with a user query
     */
    async start(query: string): Promise<Agent> {
        this._status = 'running';
        this._initialQuery = query;  // Save initial query for task context

        // Note: Initial user message will be added in requestLoop after startTurn()
        // This ensures the message is properly associated with a Turn

        // Start request loop
        await this.requestLoop(query);
        return this;
    }

    /**
     * Complete agent task
     */
    complete(tokenUsage?: TokenUsage, toolUsage?: ToolUsage): void {
        this._status = 'completed';
    }

    /**
     * Abort agent task
     */
    abort(abortReason?: string): void {
        this._status = 'aborted';
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
    protected async requestLoop(query: string): Promise<boolean> {
        // Reset collected errors for this new operation
        this.resetCollectedErrors();

        let lastToolResults: ToolResult[] = [];

        const userContent: Anthropic.Messages.ContentBlockParam[] = [
            { type: 'text', text: `<task>${query}</task>` }
        ];
        const stack: StackItem[] = [{ sender: 'user', content: userContent, retryAttempt: 0 }];

        // Track if we need to start a new turn
        let needsNewTurn = true;

        while (stack.length > 0) {
            const currentItem = stack.pop()!;
            const currentUserContent = currentItem.content;
            let didEndLoop = false;

            if (this.isAborted()) {
                stack.length = 0;
                return false;
            }

            if (
                this._consecutiveMistakeCount > 0 &&
                this._consecutiveMistakeCount >= this.config.consecutiveMistakeLimit
            ) {
                this._consecutiveMistakeCount = 0;
                throw new Error(`Consecutive mistake limit reached`);
            }

            // Get current workspace context
            const currentWorkspaceContext = await this.workspace.render();

            // Start new turn if needed
            if (needsNewTurn) {
                // Pass task context only for the first turn
                const taskContext = this.memoryModule.getTurnStore().getCurrentTurnNumber() === 0
                    ? this._initialQuery || undefined
                    : undefined;

                this.memoryModule.startTurn(currentWorkspaceContext, taskContext);
                needsNewTurn = false;
            }

            // Add user message to conversation history if needed
            const isEmptyUserContent = currentUserContent.length === 0;

            const shouldAddUserMessage =
                (((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) ||
                    currentItem.userMessageWasRemoved) && currentItem.sender === 'user';

            if (shouldAddUserMessage) {
                // Use the appropriate method based on content type
                if (currentUserContent.length === 1 && currentUserContent[0].type === 'text') {
                    this.memoryModule.addUserMessage((currentUserContent[0] as any).text);
                } else {
                    this.memoryModule.addUserMessage(currentUserContent);
                }
            }

            try {
                // Reset message processing state for each new API request
                this.resetMessageState();

                // THINKING PHASE: Use MemoryModule (always enabled)
                const memoryResult = await this.memoryModule.performThinkingPhase(
                    currentWorkspaceContext,
                    lastToolResults
                );

                const thinkingTokens = memoryResult.tokensUsed;

                // Add thinking summary to history for observability
                if (memoryResult.rounds.length > 0) {
                    const thinkingSummary = this.formatMemoryThinkingSummary(memoryResult);
                    this.memoryModule.addSystemMessage(thinkingSummary);
                }

                // Track thinking tokens
                this._tokenUsage.contextTokens += thinkingTokens;

                // Collect complete response from stream
                const response = await this.attemptApiRequest();

                if (!response) {
                    throw new NoApiResponseError(1);
                }

                if (response.toolCalls.length === 0) {
                    throw new NoToolsUsedError()
                }

                // Convert API response to assistant message content
                this.convertApiResponseToAssistantMessage(response);

                // Execute tool calls and build response
                // This will update workspace states
                const executionResult = await this.executeToolCalls(
                    response,
                    () => this.isAborted(),
                );

                // Update message state with execution result
                this.messageState.userMessageContent = executionResult.userMessageContent;
                this.messageState.didAttemptCompletion = executionResult.didAttemptCompletion;

                // Add assistant message to conversation history
                this.addAssistantMessageToHistory();

                // Add user message (tool result) to conversation history
                if (this.messageState.userMessageContent.length > 0) {
                    this.memoryModule.addUserMessage(this.messageState.userMessageContent);
                }

                // Store tool results for next thinking phase
                lastToolResults = response.toolCalls.map(tc => {
                    const toolResult = executionResult.userMessageContent.find(
                        m => m.type === 'tool_result' && m.tool_use_id === tc.id
                    );
                    const success = toolResult && 'is_error' in toolResult ? !toolResult.is_error : true;
                    const result = toolResult && 'content' in toolResult ? toolResult.content : '';

                    // Record tool call to current turn
                    this.memoryModule.recordToolCall(tc.name, success, result);

                    return {
                        toolName: tc.name,
                        success,
                        result,
                        timestamp: Date.now(),
                    };
                });

                // NOTE: Workspace context is NOT added to conversation history
                // It is always passed fresh via workspaceContext parameter in attemptApiRequest()
                // This prevents token explosion from duplicating workspace state in history

                // Check if we should continue recursion
                if (
                    !this.messageState.didAttemptCompletion
                ) {
                    // Complete current turn and prepare for next turn
                    this.memoryModule.completeTurn();
                    needsNewTurn = true;

                    stack.push({
                        sender: 'system',
                        content: [{
                            type: 'text',
                            text: 'WORKSPACE STATE UPDATED'
                        }],
                    });
                } else {
                    // Task completed, complete the turn
                    this.memoryModule.completeTurn();
                }

                // For debugging: avoid stuck in loop for some tests
                // didEndLoop = true;
            } catch (error) {
                const currentRetryAttempt = currentItem.retryAttempt ?? 0;

                // Handle error using error handler logic
                const shouldAbort = this.handleError(error, currentRetryAttempt);

                // Format error as prompt and add to user content
                const errorPrompt = ErrorHandlerPrompt.formatErrorPrompt(error as any, currentRetryAttempt);

                if (shouldAbort) {
                    this.abort('Max retry attempts exceeded or non-retryable error');
                } else {
                    // Push the same content with error prompt back onto the stack to retry
                    stack.push({
                        sender: 'user',
                        content: [
                            {
                                type: 'text',
                                text: errorPrompt,
                            },
                            ...currentUserContent,
                        ],
                        retryAttempt: currentRetryAttempt + 1,
                    });
                }
            }

            if (didEndLoop) {
                return true;
            }
        }

        this.complete();
        return false;
    }

    // ==================== Message Processing ====================

    /**
     * Reset message processing state for each new API request
     */
    private resetMessageState(): void {
        this.messageState.assistantMessageContent = [];
        this.messageState.userMessageContent = [];
        this.messageState.didAttemptCompletion = false;
    }

    /**
     * Convert API response to assistant message content
     * Handles multiple tool calls in a single response
     */
    private convertApiResponseToAssistantMessage(response: ApiResponse): void {
        const toolUseBlocks: ToolUse[] = [];

        for (const toolCall of response.toolCalls) {
            // Parse arguments from JSON string
            let parsedArgs: any = {};
            try {
                parsedArgs = JSON.parse(toolCall.arguments);
            } catch (e) {
                console.error('Failed to parse tool call arguments:', e);
                parsedArgs = { raw: toolCall.arguments };
            }

            const toolUse: ToolUse = {
                type: 'tool_use',
                name: toolCall.name,
                id: toolCall.id,
                params: parsedArgs,
                nativeArgs: parsedArgs,
            };

            toolUseBlocks.push(toolUse);
        }

        this.messageState.assistantMessageContent = toolUseBlocks;
    }

    /**
     * Add assistant message to conversation history
     */
    private addAssistantMessageToHistory(reasoning?: string): void {
        const assistantContent: Array<
            Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam
        > = [];

        // Add text content if present
        const textBlocks = this.messageState.assistantMessageContent.filter(
            (block: AssistantMessageContent) => block.type === 'text',
        );

        for (const textBlock of textBlocks) {
            assistantContent.push({
                type: 'text' as const,
                text: textBlock.content || '',
            });
        }

        // Add tool use blocks
        const toolUseBlocks = this.messageState.assistantMessageContent.filter(
            (block: AssistantMessageContent) => block.type === 'tool_use',
        );

        for (const block of toolUseBlocks) {
            const toolUse = block as ToolUse;
            const input = toolUse.nativeArgs || toolUse.params;

            // Use the tool call ID that was stored during executeToolCalls
            const toolCallId = toolUse.id || crypto.randomUUID();

            assistantContent.push({
                type: 'tool_use' as const,
                id: toolCallId,
                name: toolUse.name,
                input,
            });
        }

        // Add to MemoryModule
        const message: ApiMessage = {
            role: 'assistant',
            content: assistantContent,
        };

        if (reasoning) {
            const reasoningBlock: ThinkingBlock = {
                type: 'thinking',
                thinking: reasoning,
            };
            message.content = [reasoningBlock, ...message.content];
        }

        this.memoryModule.addAssistantMessage(message.content);
    }

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
        this.memoryModule.addSystemMessage(message);
    }

    // ==================== Tool Execution ====================

    /**
     * Execute tool calls and build response
     * Supports multiple tool calls in a single response
     */
    private async executeToolCalls(
        response: ApiResponse,
        isAborted: () => boolean,
    ): Promise<{ userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>, didAttemptCompletion: boolean }> {
        const userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        let didAttemptCompletion = false;

        for (const toolCall of response.toolCalls) {
            if (isAborted()) {
                break;
            }

            try {
                let result: any;

                // Check if this is attempt_completion
                if (toolCall.name === 'attempt_completion') {
                    didAttemptCompletion = true;
                    // Parse arguments to get the completion result
                    let completionData: any = {};
                    try {
                        completionData = JSON.parse(toolCall.arguments);
                    } catch (e) {
                        completionData = { result: toolCall.arguments };
                    }
                    result = { success: true, result: completionData.result || completionData };
                } else if (toolCall.name === 'recall_conversation') {
                    // Handle recall_conversation tool
                    let recallParams: any = {};
                    try {
                        recallParams = JSON.parse(toolCall.arguments);
                    } catch (e) {
                        recallParams = {};
                    }

                    // Call MemoryModule to recall turns
                    let recalled: ApiMessage[] = [];
                    if (recallParams.turn_numbers && recallParams.turn_numbers.length > 0) {
                        recalled = this.memoryModule.recallTurns(recallParams.turn_numbers);
                    } else if (recallParams.last_n) {
                        // Get recent messages from last N turns
                        recalled = this.memoryModule.getTurnStore().getRecentMessages(recallParams.last_n);
                        // Store for next prompt
                        this.memoryModule['recalledMessages'] = recalled.slice(0, this.memoryModule.getConfig().maxRecalledMessages);
                    }

                    result = {
                        success: true,
                        recalled_messages: recalled.length,
                        message: `Successfully recalled ${recalled.length} messages. They will be injected into the next API request.`,
                    };
                } else {
                    // Parse tool arguments
                    let parsedParams: any = {};
                    try {
                        parsedParams = JSON.parse(toolCall.arguments);
                    } catch (e) {
                        parsedParams = { raw: toolCall.arguments };
                    }

                    // Call the tool on the VirtualWorkspace component
                    result = await this.workspace.handleToolCall(
                        toolCall.name,
                        parsedParams
                    );
                }

                userMessageContent.push({
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: JSON.stringify(result),
                });
            } catch (error) {
                userMessageContent.push({
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
                });
            }
        }

        return { userMessageContent, didAttemptCompletion };
    }

    // ==================== API Request Handling ====================

    /**
     * Convert Workspace tools to OpenAI format
     * @returns Array of OpenAI-compatible tool definitions
     */
    private convertWorkspaceToolsToOpenAI(): any[] {
        // Get all tools from workspace
        const allTools = this.workspace.getAllTools();
        const tools = allTools.map((t: { tool: any }) => t.tool);

        // Use the existing converter
        const converter = new DefaultToolCallConverter();

        return converter.convertTools(tools);
    }

    /**
     * Attempt API request with timeout
     * Uses the injected ApiClient for making requests
     */
    async attemptApiRequest(retryAttempt: number = 0) {
        try {
            const systemPrompt = await this.getSystemPrompt();
            let workspaceContext = await this.workspace.render();

            // Inject task context and accumulated summaries from MemoryModule
            const currentTurn = this.memoryModule.getCurrentTurn();
            const taskContext = currentTurn?.taskContext
                ? `=== TASK CONTEXT ===\nUser's Goal: ${currentTurn.taskContext}\n\n`
                : '';

            const accumulatedSummaries = this.memoryModule.getAccumulatedSummaries();

            if (taskContext || accumulatedSummaries) {
                workspaceContext = `${taskContext}${accumulatedSummaries}\n\n=== CURRENT WORKSPACE CONTEXT ===\n${workspaceContext}`;
            }

            // Get conversation history for prompt
            // Default: summary-only mode (no history injected by default)
            // History is only injected when LLM explicitly calls recall_conversation tool
            const conversationHistory = this.memoryModule.getHistoryForPrompt();

            // Build prompt using PromptBuilder
            const prompt: FullPrompt = new PromptBuilder()
                .setSystemPrompt(systemPrompt)
                .setWorkspaceContext(workspaceContext)
                .setConversationHistory(conversationHistory)
                .build();

            try {
                // Get tools from workspace and convert to OpenAI format
                const tools = this.convertWorkspaceToolsToOpenAI();

                // Use the injected ApiClient to make the request
                const response = await this.apiClient.makeRequest(
                    prompt.systemPrompt,
                    prompt.workspaceContext,
                    prompt.memoryContext,
                    { timeout: this.config.apiRequestTimeout },
                    tools  // Pass tools to API client
                );

                // Clear recalled messages after API request
                // They were injected into this request, so clear for next request
                this.memoryModule.clearRecalledMessages();

                return response;

            } catch (error) {
                throw error;
            }
        } catch (error) {
            throw error;
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Format memory thinking summary for history
     */
    private formatMemoryThinkingSummary(result: any): string {
        const rounds = result.rounds
            .map((r: any) => {
                const recalled = r.recalledContexts.length > 0
                    ? `\n  Recalled: ${r.recalledContexts.map((c: any) => `Turn ${c.turnNumber}`).join(', ')}`
                    : '';
                return `  Round ${r.roundNumber}: ${r.content.substring(0, 100)}...${recalled}`;
            })
            .join('\n');

        const contextInfo = result.contextSnapshot
            ? `\nContext stored: Turn ${result.contextSnapshot.turnNumber} (ID: ${result.contextSnapshot.id})`
            : '';

        return `[Reflective Thinking Phase]
Total rounds: ${result.rounds.length}
Tokens used: ${result.tokensUsed}

Thinking rounds:
${rounds}${contextInfo}`;
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
        // Get skill prompt enhancement if available
        const skillPrompt = this.workspace.getSkillPrompt();

        // Merge base prompt with skill prompt
        const capability = skillPrompt?.capability
            ? `${this.agentPrompt.capability}\n\n--- Skill Enhancement ---\n${skillPrompt.capability}`
            : this.agentPrompt.capability;

        const direction = skillPrompt?.direction
            ? `${this.agentPrompt.direction}\n\n--- Skill Guidance ---\n${skillPrompt.direction}`
            : this.agentPrompt.direction;

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
        const skillsSection = this.workspace.getAvailableSkills().length > 0
            ? this.workspace.renderSkillsSection().render()
            : '';

        return `
${generateWorkspaceGuide()}
${this.renderAgentPrompt()}
${this.workspace.renderToolBox().render()}
${skillsSection}
        `;
    }
}
