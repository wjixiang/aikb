import Anthropic from "@anthropic-ai/sdk";
import { ApiHandler, ApiStream, ApiStreamChunk, buildApiHandler } from "../api";
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
import TooCallingParser from "../tools/toolCallingParser/toolCallingParser";
import { ProviderSettings } from "../types/provider-settings";
import { ToolName, TokenUsage, ToolUsage } from "../types";
import { IWorkspace } from "./agentWorkspace";
import { ToolCallingHandler, ToolContext, toolSet } from "../tools";
import { SYSTEM_PROMPT } from "../prompts/system";
import { AssistantMessageContent, ToolUse } from "../assistant-message/assistantMessageTypes";
import { resolveToolProtocol } from "../utils/resolveToolProtocol";
import { ConsecutiveMistakeError, NoApiResponseError, NoToolsUsedError } from "../task/task.errors";
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from "../types";

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

export abstract class Agent {
    private api: ApiHandler;
    conversationHistory: ApiMessage[] = [];
    toolCallingParser = new TooCallingParser();
    private toolCallingHandler = new ToolCallingHandler();
    private context = new AgentContext(this);
    private observers: AgentObservers = new AgentObservers(this);
    private tokenUsageTracker: AgentTokenUsageTracker = new AgentTokenUsageTracker();
    private toolUsageTracker: AgentToolUsageTracker = new AgentToolUsageTracker();
    private errorHandler: AgentErrorHandler = new AgentErrorHandler(this);
    private toolExecutor: AgentToolExecutor = new AgentToolExecutor(this.toolCallingHandler, this);

    // Status management
    private _status: TaskStatus = 'idle';
    private taskId: string;

    // Tool use tracking
    consecutiveMistakeCount: number = 0;
    consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map();

    // Message processing state
    private messageState: MessageProcessingState = {
        assistantMessageContent: [],
        userMessageContent: [],
        didAttemptCompletion: false,
        cachedModel: undefined,
    };

    constructor(
        protected config: AgentConfig = defaultAgentConfig,
        private apiConfiguration: ProviderSettings = defaultApiConfig,
        private workspace: IWorkspace,
        taskId?: string,
    ) {
        this.api = buildApiHandler(this.apiConfiguration);
        this.taskId = taskId || crypto.randomUUID();
    }

    /**
     * Get tool context with workspace
     */
    private getToolContext(): ToolContext {
        return { workspace: this.workspace };
    }

    /**
     * Execute a tool call with workspace context
     */
    protected async executeToolCall(toolName: string, params: any): Promise<any> {
        return this.toolCallingHandler.handleToolCalling(
            toolName as ToolName,
            params,
            { context: this.getToolContext() }
        );
    }

    // ==================== Status Management ====================

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
        return this.taskId;
    }

    /**
     * Check if task is aborted
     */
    private isAborted(): boolean {
        return this._status === 'aborted';
    }

    /**
     * Set task status and notify observers
     */
    private setStatus(status: TaskStatus): void {
        this._status = status;
        this.observers.notifyStatusChanged(this.taskId, status);
    }

    // ==================== Observer Registration ====================

    /**
     * Register message added observer
     */
    onMessageAdded(callback: MessageAddedCallback): () => void {
        return this.observers.onMessageAdded(callback);
    }

    /**
     * Register status changed observer
     */
    onStatusChanged(callback: TaskStatusChangedCallback): () => void {
        return this.observers.onStatusChanged(callback);
    }

    /**
     * Register task completed observer
     */
    onTaskCompleted(callback: TaskCompletedCallback): () => void {
        return this.observers.onTaskCompleted(callback);
    }

    /**
     * Register task aborted observer
     */
    onTaskAborted(callback: TaskAbortedCallback): () => void {
        return this.observers.onTaskAborted(callback);
    }

    // ==================== Tracking ====================

    /**
     * Get token usage
     */
    public get tokenUsage(): TokenUsage {
        return this.tokenUsageTracker.getUsage();
    }

    /**
     * Get tool usage
     */
    public get toolUsage(): ToolUsage {
        return this.toolUsageTracker.getUsage();
    }

    // ==================== Lifecycle Methods ====================

    /**
     * Start the agent with a user query
     */
    async start(query: string): Promise<Agent> {
        this.setStatus('running');

        this.recursivelyMakeClineRequests([
            {
                type: 'text',
                text: `<task>${query}</task>`,
            },
        ]);

        return this;
    }

    /**
     * Complete the agent task
     */
    complete(tokenUsage?: TokenUsage, toolUsage?: ToolUsage): void {
        this.setStatus('completed');
        this.observers.notifyTaskCompleted(this.taskId);
    }

    /**
     * Abort the agent task
     */
    abort(abortReason?: string): void {
        this.setStatus('aborted');
        this.observers.notifyTaskAborted(this.taskId, abortReason || 'Agent task aborted');
    }

    // ==================== Core Request Loop ====================

    /**
     * Core method for making recursive API requests to the LLM
     * Implements stack-based retry mechanism with error handling
     */
    public async recursivelyMakeClineRequests(
        userContent: Anthropic.Messages.ContentBlockParam[],
    ): Promise<boolean> {
        interface StackItem {
            userContent: Anthropic.Messages.ContentBlockParam[];
            retryAttempt?: number;
            userMessageWasRemoved?: boolean;
        }

        const stack: StackItem[] = [{ userContent, retryAttempt: 0 }];

        while (stack.length > 0) {
            const currentItem = stack.pop()!;
            const currentUserContent = currentItem.userContent;
            let didEndLoop = false;

            if (this.isAborted()) {
                console.log(`Task ${this.taskId} was aborted, exiting loop`);
                stack.length = 0;
                return false;
            }

            if (
                this.consecutiveMistakeCount > 0 &&
                this.consecutiveMistakeCount >= this.config.consecutiveMistakeLimit
            ) {
                console.error('Consecutive mistake limit reached');
                this.consecutiveMistakeCount = 0;
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
                ((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) ||
                currentItem.userMessageWasRemoved;

            if (shouldAddUserMessage) {
                await this.addToConversationHistory({
                    role: 'user',
                    content: currentUserContent,
                });
            }

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
                    : this.responseProcessor.processNativeCompleteResponse(response);

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
                    this.consecutiveMistakeCount++;
                    throw new NoToolsUsedError();
                }

                // Execute tool calls and build response
                const executionResult = await this.toolExecutor.executeToolCalls(
                    toolUseBlocks,
                    () => this.isAborted(),
                );

                // Update message state with execution result
                this.messageState.userMessageContent = executionResult.userMessageContent;
                this.messageState.didAttemptCompletion = executionResult.didAttemptCompletion;

                // Add assistant message to conversation history
                await this.addAssistantMessageToHistory(processedResponse.reasoningMessage);

                // Check if we should continue recursion
                if (
                    this.messageState.userMessageContent.length > 0 &&
                    !this.messageState.didAttemptCompletion
                ) {
                    stack.push({
                        userContent: [...this.messageState.userMessageContent],
                    });
                }

                // For debugging: avoid stuck in loop for some tests
                // didEndLoop = true;
            } catch (error) {
                const currentRetryAttempt = currentItem.retryAttempt ?? 0;

                // Handle error using error handler
                const taskError = this.errorHandler.convertToTaskError(error);
                const shouldAbort = this.errorHandler.handleError(error, currentRetryAttempt);

                // Format error as prompt and add to user content
                const errorPrompt = ErrorHandlerPrompt.formatErrorPrompt(taskError, currentRetryAttempt);

                if (shouldAbort) {
                    this.abort('Max retry attempts exceeded or non-retryable error');
                } else {
                    // Push the same content with error prompt back onto the stack to retry
                    stack.push({
                        userContent: [
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
     * Add message to conversation history with timestamp and optional reasoning
     */
    private async addToConversationHistory(
        message: Anthropic.MessageParam,
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

        this.observers.notifyMessageAdded(this.taskId, messageWithTs as ApiMessage);
        this.conversationHistory.push(messageWithTs as ApiMessage);
    }

    // ==================== Response Processing ====================

    /**
     * Get the response processor instance
     */
    private get responseProcessor(): AgentResponseProcessor {
        return new AgentResponseProcessor(this.tokenUsageTracker, this.toolCallingParser);
    }

    // ==================== Error Handling ====================

    /**
     * Get collected errors for debugging
     */
    public getCollectedErrors() {
        return this.errorHandler.getCollectedErrors();
    }

    /**
     * Reset collected errors
     */
    public resetCollectedErrors(): void {
        this.errorHandler.resetCollectedErrors();
    }

    async getSystemPrompt() {
        return `
${await SYSTEM_PROMPT()}

${await this.workspace.renderContext()}
        `
    }

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

    private async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
        try {
            console.log(`Starting API request attempt ${retryAttempt + 1}`);

            const systemPrompt = await this.getSystemPrompt();
            // console.debug(`system prompt: ${systemPrompt}`);

            // Build clean conversation history
            const cleanConversationHistory = this.buildCleanConversationHistory(
                this.conversationHistory,
            );



            // Create the stream with timeout
            const streamPromise = this.api.createMessage(
                systemPrompt,
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


    private createTimeoutPromise(timeoutMs: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
    }

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


}


// ==================== Helper Classes ====================

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

/**
 * Observer pattern implementation for Agent events
 */
class AgentObservers {
    private messageAddedCallbacks: Set<MessageAddedCallback> = new Set();
    private statusChangedCallbacks: Set<TaskStatusChangedCallback> = new Set();
    private taskCompletedCallbacks: Set<TaskCompletedCallback> = new Set();
    private taskAbortedCallbacks: Set<TaskAbortedCallback> = new Set();

    constructor(private agent: Agent) { }

    /**
     * Register message added observer
     */
    onMessageAdded(callback: MessageAddedCallback): () => void {
        this.messageAddedCallbacks.add(callback);
        return () => this.messageAddedCallbacks.delete(callback);
    }

    /**
     * Register status changed observer
     */
    onStatusChanged(callback: TaskStatusChangedCallback): () => void {
        this.statusChangedCallbacks.add(callback);
        return () => this.statusChangedCallbacks.delete(callback);
    }

    /**
     * Register task completed observer
     */
    onTaskCompleted(callback: TaskCompletedCallback): () => void {
        this.taskCompletedCallbacks.add(callback);
        return () => this.taskCompletedCallbacks.delete(callback);
    }

    /**
     * Register task aborted observer
     */
    onTaskAborted(callback: TaskAbortedCallback): () => void {
        this.taskAbortedCallbacks.add(callback);
        return () => this.taskAbortedCallbacks.delete(callback);
    }

    /**
     * Notify all message added observers
     */
    notifyMessageAdded(taskId: string, message: ApiMessage): void {
        for (const callback of this.messageAddedCallbacks) {
            callback(taskId, message);
        }
    }

    /**
     * Notify all status changed observers
     */
    notifyStatusChanged(taskId: string, status: TaskStatus): void {
        for (const callback of this.statusChangedCallbacks) {
            callback(taskId, status);
        }
    }

    /**
     * Notify all task completed observers
     */
    notifyTaskCompleted(taskId: string): void {
        for (const callback of this.taskCompletedCallbacks) {
            callback(taskId);
        }
    }

    /**
     * Notify all task aborted observers
     */
    notifyTaskAborted(taskId: string, abortReason: string): void {
        for (const callback of this.taskAbortedCallbacks) {
            callback(taskId, abortReason);
        }
    }
}

/**
 * Context management for Agent
 */
class AgentContext {
    context: ApiMessage[] = [];

    constructor(private agent: Agent) { }
}

/**
 * Token usage tracker for Agent
 */
class AgentTokenUsageTracker {
    private tokenUsage: TokenUsage = {
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCost: 0,
        contextTokens: 0,
    };

    /**
     * Accumulate token usage from API response
     */
    accumulate(chunk: ApiStreamChunk): void {
        if (!chunk || chunk.type !== 'usage') return;

        const usageChunk = chunk as { type: 'usage'; inputTokens: number; outputTokens: number; cacheWriteTokens?: number; cacheReadTokens?: number; totalCost?: number; reasoningTokens?: number };
        this.tokenUsage.totalTokensIn += usageChunk.inputTokens;
        this.tokenUsage.totalTokensOut += usageChunk.outputTokens;

        if (usageChunk.cacheWriteTokens !== undefined) {
            this.tokenUsage.totalCacheWrites = (this.tokenUsage.totalCacheWrites || 0) + usageChunk.cacheWriteTokens;
        }
        if (usageChunk.cacheReadTokens !== undefined) {
            this.tokenUsage.totalCacheReads = (this.tokenUsage.totalCacheReads || 0) + usageChunk.cacheReadTokens;
        }
        if (usageChunk.totalCost !== undefined) {
            this.tokenUsage.totalCost += usageChunk.totalCost;
        }
    }

    /**
     * Get current token usage
     */
    getUsage(): TokenUsage {
        return { ...this.tokenUsage };
    }

    /**
     * Reset token usage
     */
    reset(): void {
        this.tokenUsage = {
            totalTokensIn: 0,
            totalTokensOut: 0,
            totalCacheWrites: 0,
            totalCacheReads: 0,
            totalCost: 0,
            contextTokens: 0,
        };
    }

    /**
     * Set context tokens
     */
    setContextTokens(tokens: number): void {
        this.tokenUsage.contextTokens = tokens;
    }
}

/**
 * Tool usage tracker for Agent
 */
class AgentToolUsageTracker {
    private usage: ToolUsage = {};

    /**
     * Track tool attempt
     */
    trackAttempt(toolName: ToolName): void {
        if (!this.usage[toolName]) {
            this.usage[toolName] = { attempts: 0, failures: 0 };
        }
        this.usage[toolName]!.attempts++;
    }

    /**
     * Track tool failure
     */
    trackFailure(toolName: ToolName): void {
        if (!this.usage[toolName]) {
            this.usage[toolName] = { attempts: 0, failures: 0 };
        }
        this.usage[toolName]!.failures++;
    }

    /**
     * Get current tool usage
     */
    getUsage(): ToolUsage {
        return { ...this.usage };
    }

    /**
     * Reset tool usage
     */
    reset(): void {
        this.usage = {};
    }
}

/**
 * Error handler for Agent
 */
class AgentErrorHandler {
    private collectedErrors: Error[] = [];

    constructor(private agent: Agent) { }

    /**
     * Convert error to task error
     */
    convertToTaskError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        return new Error(String(error));
    }

    /**
     * Handle error and determine if should abort
     */
    handleError(error: unknown, retryAttempt: number): boolean {
        const taskError = this.convertToTaskError(error);
        this.collectedErrors.push(taskError);

        console.error(`Error in attempt ${retryAttempt + 1}:`, taskError);

        // Check if we should abort
        if (retryAttempt >= this.agent['config'].maxRetryAttempts - 1) {
            return true; // Abort
        }

        // Don't retry on certain errors
        if (error instanceof NoApiResponseError || error instanceof NoToolsUsedError) {
            return false; // Retry
        }

        return false; // Retry by default
    }

    /**
     * Get collected errors
     */
    getCollectedErrors(): Error[] {
        return [...this.collectedErrors];
    }

    /**
     * Reset collected errors
     */
    resetCollectedErrors(): void {
        this.collectedErrors = [];
    }
}

/**
 * Response processor for Agent
 */
class AgentResponseProcessor {
    constructor(
        private readonly tokenUsageTracker: AgentTokenUsageTracker,
        private readonly toolCallingParser: TooCallingParser,
    ) { }

    /**
     * Process XML-based complete response
     */
    processXmlCompleteResponse(chunks: ApiStreamChunk[]): ProcessedResponse {
        let reasoningMessage = '';
        let assistantMessage = '';

        for (const chunk of chunks) {
            switch (chunk.type) {
                case 'usage':
                    this.tokenUsageTracker.accumulate(chunk);
                    break;
                case 'reasoning':
                    reasoningMessage += chunk.text;
                    break;
                case 'text':
                    assistantMessage += chunk.text;
                    break;
            }
        }

        // Handle weird behavior of LLM that always outputs 'tool_call>'
        assistantMessage = assistantMessage.replace('tool_call>', '');
        console.log(assistantMessage);

        const finalBlocks = this.toolCallingParser.xmlToolCallingParser.processMessage(assistantMessage);

        return {
            assistantMessageContent: finalBlocks,
            reasoningMessage,
            assistantMessage,
        };
    }

    /**
     * Process native protocol complete response
     */
    processNativeCompleteResponse(chunks: ApiStreamChunk[]): ProcessedResponse {
        let reasoningMessage = '';
        let assistantMessage = '';

        // Import NativeToolCallParser dynamically to avoid circular dependency
        const { NativeToolCallParser } = require('../assistant-message/NativeToolCallParser');

        // Clear any previous tool call state before processing new chunks
        NativeToolCallParser.clearRawChunkState();

        // Map to accumulate streaming tool call arguments by ID
        const streamingToolCalls = new Map<string, { id: string; name: string; arguments: string }>();
        const assistantMessageContent: AssistantMessageContent[] = [];

        // Process all chunks to build complete response
        for (const chunk of chunks) {
            switch (chunk.type) {
                case 'usage':
                    this.tokenUsageTracker.accumulate(chunk);
                    break;
                case 'tool_call': {
                    const toolUse = NativeToolCallParser.parseToolCall({
                        id: chunk.id,
                        name: chunk.name as any,
                        arguments: chunk.arguments,
                    });

                    if (toolUse) {
                        assistantMessageContent.push(toolUse);
                    }
                    break;
                }
                case 'tool_call_partial': {
                    const events = NativeToolCallParser.processRawChunk({
                        index: chunk.index,
                        id: chunk.id,
                        name: chunk.name,
                        arguments: chunk.arguments,
                    });

                    for (const event of events) {
                        switch (event.type) {
                            case 'tool_call_start':
                                streamingToolCalls.set(event.id, {
                                    id: event.id,
                                    name: event.name,
                                    arguments: '',
                                });
                                break;
                            case 'tool_call_delta': {
                                const toolCall = streamingToolCalls.get(event.id);
                                if (toolCall) {
                                    toolCall.arguments += event.delta;
                                }
                                break;
                            }
                            case 'tool_call_end': {
                                const completedToolCall = streamingToolCalls.get(event.id);
                                if (completedToolCall) {
                                    const toolUse = NativeToolCallParser.parseToolCall({
                                        id: completedToolCall.id,
                                        name: completedToolCall.name as any,
                                        arguments: completedToolCall.arguments,
                                    });

                                    if (toolUse) {
                                        assistantMessageContent.push(toolUse);
                                    }
                                    streamingToolCalls.delete(event.id);
                                }
                                break;
                            }
                        }
                    }
                    break;
                }
                case 'reasoning':
                    reasoningMessage += chunk.text;
                    break;
                case 'text':
                    assistantMessage += chunk.text;
                    break;
            }
        }

        // Handle weird behavior of LLM that always outputs 'tool_call>'
        assistantMessage = assistantMessage.replace('tool_call>', '');

        // Finalize any remaining tool calls that weren't explicitly ended
        const finalizationEvents = NativeToolCallParser.finalizeRawChunks();
        for (const event of finalizationEvents) {
            if (event.type === 'tool_call_end') {
                const remainingToolCall = streamingToolCalls.get(event.id);
                if (remainingToolCall) {
                    const toolUse = NativeToolCallParser.parseToolCall({
                        id: remainingToolCall.id,
                        name: remainingToolCall.name as any,
                        arguments: remainingToolCall.arguments,
                    });

                    if (toolUse) {
                        assistantMessageContent.push(toolUse);
                    }
                    streamingToolCalls.delete(event.id);
                }
            }
        }

        // Native protocol: Add text as content block
        if (assistantMessage) {
            assistantMessageContent.push({
                type: 'text',
                content: assistantMessage,
            });
        }

        console.log(`LLM response: ${reasoningMessage} \n\n ${assistantMessage}`);

        return {
            assistantMessageContent,
            reasoningMessage,
            assistantMessage,
        };
    }
}

/**
 * Tool executor for Agent
 */
class AgentToolExecutor {
    private toolUsage: ToolUsage = {};

    constructor(
        private readonly toolCallHandler: ToolCallingHandler,
        private readonly agent: Agent,
    ) { }

    /**
     * Execute tool calls and build user message content
     */
    async executeToolCalls(
        toolUseBlocks: AssistantMessageContent[],
        isAborted: () => boolean,
    ): Promise<ToolExecutionResult> {
        const userMessageContent: (
            | Anthropic.TextBlockParam
            | Anthropic.ImageBlockParam
            | Anthropic.ToolResultBlockParam
        )[] = [];
        let didAttemptCompletion = false;

        for (const block of toolUseBlocks) {
            // Check for abort status before executing each tool
            if (isAborted()) {
                console.log('Task was aborted during tool execution');
                return { userMessageContent, didAttemptCompletion, toolUsage: this.toolUsage };
            }

            console.log(`detect tool calling: ${JSON.stringify(block)}`);
            const toolUse = block as ToolUse;
            const toolCallId = crypto.randomUUID();

            // Store the tool call ID directly in the tool use block
            toolUse.id = toolCallId;

            const input = toolUse.nativeArgs || toolUse.params;

            // Track tool usage
            this.trackToolUsage(toolUse.name as ToolName);

            // // Handle tool calling
            // const toolCallRes = await this.toolCallHandler.handleToolCalling(
            //     toolUse.name as ToolName,
            //     input,
            //     {
            //         timeout: 30000, // 30 seconds timeout for tool execution
            //         context: this.agent['getToolContext'](),
            //     },
            // );

            // Check for abort status after tool execution
            if (isAborted()) {
                console.log('Task was aborted after tool execution');
                return { userMessageContent, didAttemptCompletion, toolUsage: this.toolUsage };
            }

            // // Process tool call result and add to user message content
            // if (toolCallRes) {
            //     // Convert tool result to text format for user message
            //     const resultText = this.parseToolCallResponse(toolCallRes);

            //     // Add tool result to user message content
            //     if (resultText) {
            //         userMessageContent.push({
            //             type: 'tool_result' as const,
            //             tool_use_id: toolCallId,
            //             content: resultText,
            //         });

            //         // Check if this is an attempt_completion tool call
            //         if (toolUse.name === 'attempt_completion') {
            //             // For attempt_completion, don't push to stack for further processing
            //             console.log(
            //                 'Tool call completed with attempt_completion, ending recursion',
            //             );
            //             didAttemptCompletion = true;
            //             // Clear user message content to prevent further recursion
            //             userMessageContent.length = 0;
            //         }
            //     }
            // }

            if (toolUse.name === 'attempt_completion') {
                // For attempt_completion, don't push to stack for further processing
                console.log(
                    'Tool call completed with attempt_completion, ending recursion',
                );
                didAttemptCompletion = true;
                // Clear user message content to prevent further recursion
                userMessageContent.length = 0;
            } else if (toolUse.name === 'update_workspace') {
                console.log(`change workspace state: ${JSON.stringify(toolUse)}`)
            }
        }

        return { userMessageContent, didAttemptCompletion, toolUsage: this.toolUsage };
    }

    /**
     * Parse tool call response into text format
     */
    private parseToolCallResponse(toolCallRes: any): string {
        if (typeof toolCallRes === 'string') {
            return toolCallRes;
        }

        if (!toolCallRes || typeof toolCallRes !== 'object') {
            return '';
        }

        // Handle structured tool responses
        if ('content' in toolCallRes && Array.isArray(toolCallRes.content)) {
            // Handle McpToolCallResponse - it has a content array
            return toolCallRes.content
                .map((block: any) => {
                    if (block.type === 'text') {
                        return block.text;
                    }
                    return `[${block.type} content]`;
                })
                .join('\n');
        }

        if (
            'type' in toolCallRes &&
            toolCallRes.type === 'text' &&
            toolCallRes.content
        ) {
            // Handle simple object with type and content
            return toolCallRes.content;
        }

        if (Array.isArray(toolCallRes)) {
            // Handle array of content blocks
            return toolCallRes
                .map((block: any) => {
                    if (block.type === 'text') {
                        return block.text;
                    }
                    return `[${block.type} content]`;
                })
                .join('\n');
        }

        // Fallback for other object types
        return JSON.stringify(toolCallRes);
    }

    /**
     * Track tool usage statistics
     */
    private trackToolUsage(toolName: ToolName): void {
        if (!this.toolUsage[toolName]) {
            this.toolUsage[toolName] = { attempts: 0, failures: 0 };
        }
        this.toolUsage[toolName]!.attempts++;
    }

    /**
     * Get current tool usage
     */
    getToolUsage(): ToolUsage {
        return { ...this.toolUsage };
    }

    /**
     * Reset tool usage
     */
    resetToolUsage(): void {
        this.toolUsage = {};
    }
}

// ==================== Type Definitions ====================

/**
 * Result of processing a complete API response
 */
interface ProcessedResponse {
    assistantMessageContent: AssistantMessageContent[];
    reasoningMessage: string;
    assistantMessage: string;
}

/**
 * Result of executing tool calls
 */
interface ToolExecutionResult {
    userMessageContent: (
        | Anthropic.TextBlockParam
        | Anthropic.ImageBlockParam
        | Anthropic.ToolResultBlockParam
    )[];
    didAttemptCompletion: boolean;
    toolUsage: ToolUsage;
}

/**
 * Format response helper
 */
const formatResponse = {
    noToolsUsed: (toolProtocol: string) => {
        return `No tools were used in your response. Please use the appropriate tools to complete the task.`;
    },
};

/**
 * Error handler prompt helper
 */
const ErrorHandlerPrompt = {
    formatErrorPrompt: (error: Error, retryAttempt: number): string => {
        return `Error occurred (attempt ${retryAttempt + 1}): ${error.message}

Please try again with a different approach.`;
    },
};