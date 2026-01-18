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
import { VirtualWorkspace } from "./virtualWorkspace";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../types";
import { TextBlockParam } from "@anthropic-ai/sdk/resources";
import {
    ApiHandler,
    ApiStream,
    ApiStreamChunk,
    buildApiHandler,
} from '../api';
import { AssistantMessageContent, ToolUse } from '../assistant-message/assistantMessageTypes';
import { ResponseProcessor, ProcessedResponse } from '../task/response/ResponseProcessor';
import { TokenUsageTracker } from '../task/token-usage/TokenUsageTracker';
import TooCallingParser from '../tools/toolCallingParser/toolCallingParser';
import { resolveToolProtocol } from '../utils/resolveToolProtocol';
import { ErrorHandlerPrompt } from '../task/error-prompt/ErrorHandlerPrompt';
import { formatResponse } from '../task/simplified-dependencies/formatResponse';
import {
    ConsecutiveMistakeError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../task/task.errors';

export interface AgentConfig {
    apiRequestTimeout: number;
    maxRetryAttempts: number;
    consecutiveMistakeLimit: number;
}

export const defaultAgentConfig: AgentConfig = {
    apiRequestTimeout: 60000,
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
 * AgentV2 class that uses VirtualWorkspace for context management
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

export class AgentV2 {
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

    // API and helper classes
    private api: ApiHandler;
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

        // Initialize API handler
        this.api = buildApiHandler(this.apiConfiguration);

        // Initialize helper classes
        this.tokenUsageTracker = new TokenUsageTracker();
        this.responseProcessor = new ResponseProcessor(
            this.tokenUsageTracker,
            new TooCallingParser(),
        );

        // Set completion callback for script execution
        workspace.setCompletionCallback(async (result: string) => {
            this.complete();
        });
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
    async start(query: string): Promise<AgentV2> {
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
                console.log(`Task ${this._taskId} was aborted, exiting loop`);
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

            // Determine API protocol based on provider and model
            const modelId = this.api.getModel().id;
            const modelInfo = this.api.getModel().info;
            const toolProtocol = resolveToolProtocol(
                this.apiConfiguration,
                modelInfo,
            );

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
                this.messageState.cachedModel = this.api.getModel();

                // Collect complete response from stream
                const response = await this.collectCompleteResponse(this._status);

                if (!response || response.length === 0) {
                    throw new NoApiResponseError(1);
                }

                // Process the complete response
                const processedResponse = shouldUseXmlParser
                    ? this.responseProcessor.processXmlCompleteResponse(response)
                    : this.responseProcessor.processCompleteResponse(response);

                // Update message state with processed response
                this.messageState.assistantMessageContent = processedResponse.assistantMessageContent;

                // Check if we have tool calls to execute
                const toolUseBlocks = this.messageState.assistantMessageContent.filter(
                    (block: AssistantMessageContent) => block.type === 'tool_use',
                );

                if (toolUseBlocks.length === 0) {
                    // No tools used - this is an error case
                    this.messageState.userMessageContent.push({
                        type: 'text',
                        text: formatResponse.noToolsUsed(toolProtocol),
                    });
                    this._consecutiveMistakeCount++;
                    throw new NoToolsUsedError();
                }

                // Execute tool calls and build response
                // This will update workspace states
                const executionResult = await this.executeToolCalls(
                    toolUseBlocks,
                    () => this.isAborted(),
                );

                // Update message state with execution result
                this.messageState.userMessageContent = executionResult.userMessageContent;
                this.messageState.didAttemptCompletion = executionResult.didAttemptCompletion;

                // Add assistant message to conversation history
                await this.addAssistantMessageToHistory(processedResponse.reasoningMessage);

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

            console.log(`stack length: ${stack.length}`);
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
    private addSystemMessageToHistory(workspaceContext: string): void {
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

    // ==================== Tool Execution ====================

    /**
     * Execute tool calls and build response
     */
    private async executeToolCalls(
        toolUseBlocks: AssistantMessageContent[],
        isAborted: () => boolean,
    ): Promise<{ userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>, didAttemptCompletion: boolean }> {
        const userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        let didAttemptCompletion = false;

        const commonTools = this.workspace.getCommonTools();

        for (const block of toolUseBlocks) {
            if (block.type !== 'tool_use') continue;

            const toolUse = block as ToolUse;
            const toolName = toolUse.name;
            const toolParams = toolUse.nativeArgs || toolUse.params;

            // Track tool usage
            if (!this._toolUsage[toolName as keyof ToolUsage]) {
                (this._toolUsage as any)[toolName] = 0;
            }
            (this._toolUsage as any)[toolName]++;

            try {
                let result: any;

                if (toolName === 'execute_script') {
                    const script = toolParams.script;
                    const executionResult = await commonTools.execute_script(script);
                    result = {
                        success: executionResult.success,
                        message: executionResult.message,
                        output: executionResult.output,
                        error: executionResult.error,
                    };
                } else if (toolName === 'attempt_completion') {
                    didAttemptCompletion = true;
                    const completionResult = toolParams.result;
                    await commonTools.attempt_completion(completionResult);
                    result = { success: true, result: completionResult };
                } else {
                    result = { error: `Unknown tool: ${toolName}` };
                }

                userMessageContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id || crypto.randomUUID(),
                    content: JSON.stringify(result),
                });
            } catch (error) {
                userMessageContent.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id || crypto.randomUUID(),
                    content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
                });
            }
        }

        return { userMessageContent, didAttemptCompletion };
    }

    // ==================== API Request Handling ====================

    /**
     * Collect complete response from stream without processing chunks individually
     */
    private async collectCompleteResponse(status: TaskStatus): Promise<ApiStreamChunk[]> {
        const stream = this.attemptApiRequest();
        const chunks: ApiStreamChunk[] = [];

        try {
            const iterator = stream[Symbol.asyncIterator]();
            let item = await iterator.next();

            while (!item.done) {
                // Check for abort status during stream processing
                if (status === 'aborted') {
                    return chunks; // Return whatever chunks we have collected so far
                }

                const chunk = item.value;
                if (chunk) {
                    chunks.push(chunk);
                }
                item = await iterator.next();
            }

            console.log(`Collected ${chunks.length} chunks from stream`);
            return chunks;
        } catch (error) {
            console.error('Error collecting complete response:', error);
            throw error;
        }
    }

    /**
     * Attempt API request with timeout
     */
    private async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
        try {
            console.debug(`Starting API request attempt ${retryAttempt + 1}`);

            const systemPrompt = await this.getSystemPrompt();
            const workspaceContext = await this.workspace.render();

            // Build clean conversation history
            const cleanConversationHistory = this.buildCleanConversationHistory(
                this._conversationHistory,
            );

            // Create the stream with timeout
            const streamPromise = this.api.createMessage(
                systemPrompt + "\n" + workspaceContext,
                cleanConversationHistory,
            );

            try {
                const stream = await Promise.race([
                    streamPromise,
                    this.createTimeoutPromise(this.config.apiRequestTimeout),
                ]);

                console.log(`API request attempt ${retryAttempt + 1} successful`);
                yield* stream;
            } catch (error) {
                if (error instanceof Error && error.message.includes('timed out')) {
                    throw new Error(`API request timed out after ${this.config.apiRequestTimeout}ms`);
                }
                throw error;
            }
        } catch (error) {
            console.error(`API request attempt ${retryAttempt + 1} failed:`, error);
            throw error;
        }
    }

    /**
     * Create timeout promise
     */
    private createTimeoutPromise(timeoutMs: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }

    /**
     * Build clean conversation history
     */
    private buildCleanConversationHistory(
        history: ApiMessage[],
    ): Anthropic.MessageParam[] {
        return history
            .filter((msg): msg is ApiMessage & { role: 'user' | 'assistant' } =>
                msg.role === 'user' || msg.role === 'assistant'
            )
            .map((msg): Anthropic.MessageParam => {
                if (typeof msg.content === 'string') {
                    return {
                        role: msg.role,
                        content: msg.content,
                    };
                }

                // Filter out custom ThinkingBlock and keep only Anthropic.ContentBlockParam
                const content = (msg.content as Anthropic.ContentBlockParam[]).filter(
                    (block) => block.type !== 'thinking'
                ) as Anthropic.ContentBlockParam[];

                return {
                    role: msg.role,
                    content,
                };
            });
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

    // ==================== AgentV2-Specific Methods ====================

    /**
     * Get system prompt for agent
     * Uses VirtualWorkspace's renderWithScriptSection for context
     */
    async getSystemPrompt() {
        const { SYSTEM_PROMPT } = await import("../prompts/system.js");
        return `
${await SYSTEM_PROMPT()}

${await this.workspace.renderWithScriptSection()}
        `;
    }
}
