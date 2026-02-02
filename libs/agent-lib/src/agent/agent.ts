import Anthropic from "@anthropic-ai/sdk";
import {
    ApiMessage,
    TaskStatus,
    ExtendedApiMessage,
    ThinkingBlock,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
    TaskAbortedCallback,
} from "../task/task.type";
import { ProviderSettings } from "../types/provider-settings";
import { ToolName, TokenUsage, ToolUsage } from "../types";
import { VirtualWorkspace } from "statefulContext";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../types";
import { AttemptCompletion, b, ToolCall } from '../baml_client'
import { AssistantMessageContent, ToolUse } from '../assistant-message/assistantMessageTypes';
import { ResponseProcessor, ProcessedResponse } from '../task/response/ResponseProcessor';
import { TokenUsageTracker } from '../task/token-usage/TokenUsageTracker';
import TooCallingParser from '../tools/toolCallingParser/toolCallingParser';
import { ErrorHandlerPrompt } from '../task/error-prompt/ErrorHandlerPrompt';
import {
    ConsecutiveMistakeError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../task/task.errors';
import { PromptBuilder, BamlPrompt } from '../prompts/PromptBuilder';

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

export const defaultApiConfig: ProviderSettings = {
    apiProvider: 'zai',
    apiKey: process.env['GLM_API_KEY'],
    apiModelId: 'glm-4.7',
    toolProtocol: 'xml',
    zaiApiLine: 'china_coding',
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

    // Observer callbacks
    private messageAddedCallbacks: MessageAddedCallback[] = [];
    private statusChangedCallbacks: TaskStatusChangedCallback[] = [];
    private taskCompletedCallbacks: TaskCompletedCallback[] = [];
    private taskAbortedCallbacks: TaskAbortedCallback[] = [];

    // Helper classes
    private tokenUsageTracker: TokenUsageTracker;
    private responseProcessor: ResponseProcessor;
    private messageState: MessageProcessingState = {
        assistantMessageContent: [],
        userMessageContent: [],
        didAttemptCompletion: false,
        cachedModel: undefined,
    };

    constructor(
        public config: AgentConfig = defaultAgentConfig,
        public apiConfiguration: ProviderSettings = defaultApiConfig,
        workspace: VirtualWorkspace,
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

        // Note: Message added callback for debugging can be registered externally
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

    // ==================== Observer Registration ====================

    /**
     * Register message added observer
     */
    onMessageAdded(callback: MessageAddedCallback): () => void {
        this.messageAddedCallbacks.push(callback);
        return () => {
            const index = this.messageAddedCallbacks.indexOf(callback);
            if (index > -1) {
                this.messageAddedCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Register status changed observer
     */
    onStatusChanged(callback: TaskStatusChangedCallback): () => void {
        this.statusChangedCallbacks.push(callback);
        return () => {
            const index = this.statusChangedCallbacks.indexOf(callback);
            if (index > -1) {
                this.statusChangedCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Register task completed observer
     */
    onTaskCompleted(callback: TaskCompletedCallback): () => void {
        this.taskCompletedCallbacks.push(callback);
        return () => {
            const index = this.taskCompletedCallbacks.indexOf(callback);
            if (index > -1) {
                this.taskCompletedCallbacks.splice(index, 1);
            }
        };
    }

    /**
     * Register task aborted observer
     */
    onTaskAborted(callback: TaskAbortedCallback): () => void {
        this.taskAbortedCallbacks.push(callback);
        return () => {
            const index = this.taskAbortedCallbacks.indexOf(callback);
            if (index > -1) {
                this.taskAbortedCallbacks.splice(index, 1);
            }
        };
    }

    // ==================== Notification Methods ====================

    /**
     * Notify all observers of status change
     */
    private notifyStatusChanged(status: TaskStatus): void {
        this.statusChangedCallbacks.forEach((callback) => {
            try {
                callback(this._taskId, status);
            } catch (error) {
                console.error('Error in status changed callback:', error);
            }
        });
    }

    /**
     * Notify all observers of task completion
     */
    private notifyTaskCompleted(): void {
        this.taskCompletedCallbacks.forEach((callback) => {
            try {
                callback(this._taskId);
            } catch (error) {
                console.error('Error in task completed callback:', error);
            }
        });
    }

    /**
     * Notify all observers of task abortion
     */
    private notifyTaskAborted(abortReason?: string): void {
        this.taskAbortedCallbacks.forEach((callback) => {
            try {
                callback(this._taskId, abortReason || 'Task aborted');
            } catch (error) {
                console.error('Error in task aborted callback:', error);
            }
        });
    }

    // ==================== Lifecycle Methods ====================

    /**
     * Start agent with a user query
     */
    async start(query: string): Promise<Agent> {
        this._status = 'running';
        this.notifyStatusChanged('running');

        // Add initial user message to history
        this._conversationHistory.push({
            role: 'user',
            content: `<task>${query}</task>`,
        });

        // Start request loop
        await this.requestLoop(query);
        return this;
    }

    /**
     * Complete agent task
     */
    complete(tokenUsage?: TokenUsage, toolUsage?: ToolUsage): void {
        this._status = 'completed';
        this.notifyStatusChanged('completed');
        this.notifyTaskCompleted();
    }

    /**
     * Abort agent task
     */
    abort(abortReason?: string): void {
        this._status = 'aborted';
        this.notifyStatusChanged('aborted');
        this.notifyTaskAborted(abortReason);
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

        const userContent: Anthropic.Messages.ContentBlockParam[] = [
            { type: 'text', text: `<task>${query}</task>` }
        ];
        const stack: StackItem[] = [{ sender: 'user', content: userContent, retryAttempt: 0 }];

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
                console.error('Consecutive mistake limit reached');
                this._consecutiveMistakeCount = 0;
                throw new Error(`Consecutive mistake limit reached`);
            }

            // Determine API protocol based on provider configuration
            // Since we're using BAML with GLM47_coder client, use the configured tool protocol
            const toolProtocol = this.apiConfiguration.toolProtocol || 'xml';

            const shouldUseXmlParser = toolProtocol === 'xml';

            // Add user message to conversation history if needed
            const isEmptyUserContent = currentUserContent.length === 0;

            const shouldAddUserMessage =
                (((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) ||
                    currentItem.userMessageWasRemoved) && currentItem.sender === 'user';

            if (shouldAddUserMessage) await this.addToConversationHistory({
                role: 'user',
                content: currentUserContent,
            });

            const oldWorkspaceContext = await this.workspace.render();

            try {
                // Reset message processing state for each new API request
                this.resetMessageState();

                // Cache model info once per API request
                // Using BAML client (GLM47_coder) which uses glm-4.7 model
                this.messageState.cachedModel = {
                    id: this.apiConfiguration.apiModelId || 'glm-4.7',
                    info: {
                        supportsNativeTools: false, // BAML uses XML protocol
                        defaultToolProtocol: 'xml',
                    }
                };

                // Collect complete response from stream

                const response = await this.attemptApiRequest();

                if (!response) {
                    throw new NoApiResponseError(1);
                }


                // Convert BAML response to assistant message content and get tool use ID
                const toolUseId = this.convertBamlResponseToAssistantMessage(response);

                // Execute tool calls and build response
                // This will update workspace states
                const executionResult = await this.executeToolCalls(
                    response,
                    toolUseId,
                    () => this.isAborted(),
                );

                // Update message state with execution result
                this.messageState.userMessageContent = executionResult.userMessageContent;
                this.messageState.didAttemptCompletion = executionResult.didAttemptCompletion;

                // Add assistant message to conversation history
                await this.addAssistantMessageToHistory();

                // Add user message (tool result) to conversation history
                if (this.messageState.userMessageContent.length > 0) {
                    await this.addToConversationHistory({
                        role: 'user',
                        content: this.messageState.userMessageContent,
                    });
                }

                // Add workspace context to conversation history
                this.addSystemMessageToHistory(oldWorkspaceContext);

                // Check if we should continue recursion
                if (
                    !this.messageState.didAttemptCompletion
                ) {
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
     * Convert BAML response to assistant message content
     * Returns the tool_use_id for use in the tool result
     */
    private convertBamlResponseToAssistantMessage(response: AttemptCompletion | ToolCall): string {
        const toolUseId = crypto.randomUUID();

        if (response.toolName === 'attempt_completion') {
            const toolUse: ToolUse = {
                type: 'tool_use',
                name: response.toolName,
                id: toolUseId,
                params: { data: response.toolParams },
                nativeArgs: { data: response.toolParams },
            };
            this.messageState.assistantMessageContent = [toolUse];
        } else if (response.toolName === 'call_tool') {
            const toolUse: ToolUse = {
                type: 'tool_use',
                name: response.toolName,
                id: toolUseId,
                params: JSON.parse(response.toolParams)
            };
            this.messageState.assistantMessageContent = [toolUse];
        }

        return toolUseId;
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
        this.addToConversationHistory({
            role: 'system',
            content: workspaceContext
        });
    }

    /**
     * Add message to conversation history with timestamp and optional reasoning
     */
    private async addToConversationHistory(
        message: ApiMessage,
        reasoning?: string,
    ): Promise<void> {
        const messageWithTs: ExtendedApiMessage = {
            role: message.role,
            content: Array.isArray(message.content)
                ? ([...message.content] as Array<
                    Anthropic.ContentBlockParam | ThinkingBlock
                >)
                : [{ type: 'text' as const, text: message.content as string }],
            ts: Date.now(),
        };

        if (message.role === 'assistant' && reasoning) {
            const reasoningBlock: ThinkingBlock = {
                type: 'thinking',
                thinking: reasoning,
            };

            messageWithTs.content = [reasoningBlock, ...messageWithTs.content];
        }

        this.messageAddedCallbacks.forEach((callback) => {
            try {
                callback(this._taskId, messageWithTs as ApiMessage);
            } catch (error) {
                console.error('Error in message added callback:', error);
            }
        });
        this._conversationHistory.push(messageWithTs as ApiMessage);
    }

    getConversationHistory() {
        return this._conversationHistory
    }

    // ==================== Tool Execution ====================

    /**
     * Execute tool calls and build response
     */
    private async executeToolCalls(
        toolCall: AttemptCompletion | ToolCall,
        toolUseId: string,
        isAborted: () => boolean,
    ): Promise<{ userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>, didAttemptCompletion: boolean }> {
        const userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        let didAttemptCompletion = false;

        try {
            let result: any;

            if (toolCall.toolName === 'attempt_completion') {
                didAttemptCompletion = true;
                const completionResult = toolCall.toolParams;
                result = { success: true, result: completionResult };
            } else {
                // Parse tool params
                let parsedParams: any = {};
                try {
                    parsedParams = JSON.parse(toolCall.toolParams);
                } catch (e) {
                    parsedParams = toolCall.toolParams;
                }


                // Call the tool on the VirtualWorkspace component
                result = await this.workspace.handleToolCall(
                    toolCall.toolName,
                    parsedParams
                );
            }

            userMessageContent.push({
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: JSON.stringify(result),
            });
        } catch (error) {
            userMessageContent.push({
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            });
        }


        return { userMessageContent, didAttemptCompletion };
    }

    // ==================== API Request Handling ====================


    /**
     * Attempt API request with timeout
     */
    async attemptApiRequest(retryAttempt: number = 0) {

        try {
            const systemPrompt = await this.getSystemPrompt();
            const workspaceContext = await this.workspace.render();

            // Build prompt using PromptBuilder
            const prompt: BamlPrompt = new PromptBuilder()
                .setSystemPrompt(systemPrompt)
                .setWorkspaceContext(workspaceContext)
                .setConversationHistory(this._conversationHistory)
                .build();

            try {
                // Use Promise.race for timeout (more reliable than AbortController for BAML)
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`API request timed out after ${this.config.apiRequestTimeout}ms`));
                    }, this.config.apiRequestTimeout);
                });

                try {
                    // Race between BAML request and timeout
                    const bamlResponse = await Promise.race([
                        b.ApiRequest(
                            prompt.systemPrompt,
                            prompt.workspaceContext,
                            prompt.memoryContext
                        ),
                        //     b.ApiRequest('test', 'hello', []),
                        //     timeoutPromise
                    ]);

                    return bamlResponse;


                } catch (error) {
                    throw error;
                }

            } catch (error) {
                console.error(`BAML request failed:`, error);
                throw error;
            }
        } catch (error) {
            console.error(`API request attempt ${retryAttempt + 1} failed:`, error);
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

    // ==================== Agent-Specific Methods ====================

    /**
     * Get system prompt for agent
     * Uses VirtualWorkspace's render for context
     */
    async getSystemPrompt() {
        const { SYSTEM_PROMPT } = await import("../prompts/system.js");
        return `
${await SYSTEM_PROMPT()}
${this.workspace.renderToolBox().render()}

        `;
    }
}
