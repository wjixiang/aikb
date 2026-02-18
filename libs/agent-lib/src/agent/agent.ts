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
import { ResponseProcessor, ProcessedResponse } from '../task/response/ResponseProcessor.js';
import { TokenUsageTracker } from '../task/token-usage/TokenUsageTracker.js';
import TooCallingParser from '../tools/toolCallingParser/toolCallingParser.js';
import { ErrorHandlerPrompt } from '../task/error-prompt/ErrorHandlerPrompt.js';
import {
    ConsecutiveMistakeError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../task/task.errors.js';
import { PromptBuilder, FullPrompt } from '../prompts/PromptBuilder.js';
import type { ApiClient } from '../api-client/index.js';
import { generateWorkspaceGuide } from "../prompts/sections/workspaceGuide.js";

export interface AgentConfig {
    apiRequestTimeout: number;
    maxRetryAttempts: number;
    consecutiveMistakeLimit: number;
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
    private _conversationHistory: ApiMessage[] = [];
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

    // Helper classes
    private tokenUsageTracker: TokenUsageTracker;
    private responseProcessor: ResponseProcessor;
    private messageState: MessageProcessingState = {
        assistantMessageContent: [],
        userMessageContent: [],
        didAttemptCompletion: false,
        cachedModel: undefined,
    };

    // API client (dependency injected)
    private apiClient: ApiClient;

    constructor(
        public config: AgentConfig = defaultAgentConfig,
        workspace: VirtualWorkspace,
        private agentPrompt: AgentPrompt,
        apiClient: ApiClient,
        taskId?: string,
    ) {
        this.workspace = workspace;
        this._taskId = taskId || crypto.randomUUID();

        // Initialize helper classes
        this.tokenUsageTracker = new TokenUsageTracker();
        this.responseProcessor = new ResponseProcessor(
            this.tokenUsageTracker,
            new TooCallingParser(),
        );

        // Use injected API client
        this.apiClient = apiClient;
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
     * Getter for conversation history
     */
    public get conversationHistory(): ApiMessage[] {
        return this._conversationHistory;
    }

    /**
     * Setter for conversation history (for restoring state)
     */
    public set conversationHistory(history: ApiMessage[]) {
        this._conversationHistory = history;
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

    // ==================== Lifecycle Methods ====================

    /**
     * Start agent with a user query
     */
    async start(query: string): Promise<Agent> {
        console.log('[Agent.start] Starting agent with query:', query);
        this._status = 'running';
        console.log('[Agent.start] Status set to running');

        // Add initial user message to history
        this._conversationHistory.push(
            MessageBuilder.user(`<task>${query}</task>`)
        );
        console.log('[Agent.start] Initial user message added to history');

        // Start request loop
        console.log('[Agent.start] About to call requestLoop...');
        await this.requestLoop(query);
        console.log('[Agent.start] requestLoop completed');
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
        console.log('[Agent.requestLoop] Starting request loop');
        // Reset collected errors for this new operation
        this.resetCollectedErrors();

        const userContent: Anthropic.Messages.ContentBlockParam[] = [
            { type: 'text', text: `<task>${query}</task>` }
        ];
        const stack: StackItem[] = [{ sender: 'user', content: userContent, retryAttempt: 0 }];
        console.log('[Agent.requestLoop] Initial stack created with', stack.length, 'items');

        while (stack.length > 0) {
            console.log('[Agent.requestLoop] Loop iteration, stack size:', stack.length);
            const currentItem = stack.pop()!;
            const currentUserContent = currentItem.content;
            console.log('[Agent.requestLoop] Current item sender:', currentItem.sender, 'retryAttempt:', currentItem.retryAttempt);
            let didEndLoop = false;

            if (this.isAborted()) {
                console.log('[Agent.requestLoop] Agent is aborted, exiting loop');
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


            // Add user message to conversation history if needed
            const isEmptyUserContent = currentUserContent.length === 0;

            const shouldAddUserMessage =
                (((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) ||
                    currentItem.userMessageWasRemoved) && currentItem.sender === 'user';

            if (shouldAddUserMessage) {
                await this.addToConversationHistory(
                    MessageBuilder.custom('user', currentUserContent)
                );
            }

            const oldWorkspaceContext = await this.workspace.render();
            console.log('[Agent.requestLoop] Workspace context rendered, length:', oldWorkspaceContext.length);

            try {
                console.log('[Agent.requestLoop] About to call attemptApiRequest...');
                // Reset message processing state for each new API request
                this.resetMessageState();

                // Collect complete response from stream

                const response = await this.attemptApiRequest();
                console.log('[Agent.requestLoop] API response received, tool calls:', response.toolCalls.length);

                if (!response) {
                    console.error('[Agent.requestLoop] No response received from API');
                    throw new NoApiResponseError(1);
                }


                console.log('[Agent.requestLoop] Converting API response to assistant message...');
                // Convert API response to assistant message content
                this.convertApiResponseToAssistantMessage(response);
                console.log('[Agent.requestLoop] Assistant message content:', this.messageState.assistantMessageContent.length, 'items');

                // Execute tool calls and build response
                console.log('[Agent.requestLoop] Executing tool calls...');
                // This will update workspace states
                const executionResult = await this.executeToolCalls(
                    response,
                    () => this.isAborted(),
                );

                // Update message state with execution result
                this.messageState.userMessageContent = executionResult.userMessageContent;
                this.messageState.didAttemptCompletion = executionResult.didAttemptCompletion;

                // Add assistant message to conversation history
                await this.addAssistantMessageToHistory();

                // Add user message (tool result) to conversation history
                if (this.messageState.userMessageContent.length > 0) {
                    await this.addToConversationHistory(
                        MessageBuilder.custom('user', this.messageState.userMessageContent)
                    );
                }

                // Add workspace context to conversation history
                this.addSystemMessageToHistory(oldWorkspaceContext);

                // Check if we should continue recursion
                console.log('[Agent.requestLoop] didAttemptCompletion:', this.messageState.didAttemptCompletion);
                if (
                    !this.messageState.didAttemptCompletion
                ) {
                    console.log('[Agent.requestLoop] Task not completed, pushing to stack for continuation');
                    stack.push({
                        sender: 'system',
                        content: [{
                            type: 'text',
                            text: 'WORKSPACE STATE UPDATED'
                        }],
                    });
                }

                // For debugging: avoid stuck in loop for some tests
                // didEndLoop = true;
            } catch (error) {
                console.error('[Agent.requestLoop] Error occurred:', error);
                const currentRetryAttempt = currentItem.retryAttempt ?? 0;

                // Handle error using error handler logic
                const shouldAbort = this.handleError(error, currentRetryAttempt);

                // Format error as prompt and add to user content
                const errorPrompt = ErrorHandlerPrompt.formatErrorPrompt(error as any, currentRetryAttempt);
                console.log('[Agent.requestLoop] Error prompt formatted, shouldAbort:', shouldAbort);

                if (shouldAbort) {
                    console.log('[Agent.requestLoop] Aborting due to error');
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
                    console.log('[Agent.requestLoop] Pushing retry to stack, attempt:', currentRetryAttempt + 1);
                }
            }

            if (didEndLoop) {
                return true;
            }
        }

        console.log('[Agent.requestLoop] Loop completed, calling complete()');
        this.complete();
        console.log('[Agent.requestLoop] Returning from requestLoop');
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
    private async addAssistantMessageToHistory(reasoning?: string): Promise<void> {
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

        await this.addToConversationHistory({
            role: 'assistant',
            content: assistantContent,
        }, reasoning);
    }

    /**
     * Add workspace context into history
     */
    addSystemMessageToHistory(workspaceContext: string): void {
        this.addToConversationHistory(
            MessageBuilder.system(workspaceContext)
        );
    }

    /**
     * Add message to conversation history with timestamp and optional reasoning
     */
    private async addToConversationHistory(
        message: ApiMessage,
        reasoning?: string,
    ): Promise<void> {
        const messageWithTs: ApiMessage = {
            role: message.role,
            content: [...message.content],
            ts: Date.now(),
        };

        if (message.role === 'assistant' && reasoning) {
            const reasoningBlock: ThinkingBlock = {
                type: 'thinking',
                thinking: reasoning,
            };

            messageWithTs.content = [reasoningBlock, ...messageWithTs.content];
        }

        this._conversationHistory.push(messageWithTs);
    }

    getConversationHistory() {
        return this._conversationHistory
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
        const tools = allTools.map(t => t.tool);

        // Use the existing converter
        const converter = new DefaultToolCallConverter();

        return converter.convertTools(tools);
    }

    /**
     * Attempt API request with timeout
     * Uses the injected ApiClient for making requests
     */
    async attemptApiRequest(retryAttempt: number = 0) {
        console.log('[Agent.attemptApiRequest] Starting API request, retryAttempt:', retryAttempt);

        try {
            console.log('[Agent.attemptApiRequest] Getting system prompt...');
            const systemPrompt = await this.getSystemPrompt();
            console.log('[Agent.attemptApiRequest] System prompt length:', systemPrompt.length);

            console.log('[Agent.attemptApiRequest] Getting workspace context...');
            const workspaceContext = await this.workspace.render();
            console.log('[Agent.attemptApiRequest] Workspace context length:', workspaceContext.length);

            // Build prompt using PromptBuilder
            console.log('[Agent.attemptApiRequest] Building prompt...');
            const prompt: FullPrompt = new PromptBuilder()
                .setSystemPrompt(systemPrompt)
                .setWorkspaceContext(workspaceContext)
                .setConversationHistory(this._conversationHistory)
                .build();
            console.log('[Agent.attemptApiRequest] Prompt built, conversation history length:', this._conversationHistory.length);

            try {
                // Get tools from workspace and convert to OpenAI format
                console.log('[Agent.attemptApiRequest] Converting workspace tools...');
                const tools = this.convertWorkspaceToolsToOpenAI();
                console.log('[Agent.attemptApiRequest] Tools converted, count:', tools.length);

                // Use the injected ApiClient to make the request
                console.log('[Agent.attemptApiRequest] Calling apiClient.makeRequest...');
                const response = await this.apiClient.makeRequest(
                    prompt.systemPrompt,
                    prompt.workspaceContext,
                    prompt.memoryContext,
                    { timeout: this.config.apiRequestTimeout },
                    tools  // Pass tools to API client
                );
                console.log('[Agent.attemptApiRequest] API response received, tool calls:', response.toolCalls.length);

                return response;

            } catch (error) {
                console.error('[Agent.attemptApiRequest] Error in API request:', error);
                throw error;
            }
        } catch (error) {
            console.error('[Agent.attemptApiRequest] Error in attemptApiRequest:', error);
            throw error;
        }
    }

    // ==================== Helper Methods ====================

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
