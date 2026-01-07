import {
    ApiHandler,
    ApiStream,
    ApiStreamChunk,
    buildApiHandler,
} from '../../api';
import {
    ApiMessage,
    TaskStatus,
    ExtendedApiMessage,
    ThinkingBlock,
    MessageAddedCallback,
    TaskStatusChangedCallback,
    TaskCompletedCallback,
    TaskAbortedCallback,
} from '../task.type';
import {
    ConsecutiveMistakeError,
    NoApiResponseError,
    NoToolsUsedError,
} from '../task.errors';
import { TokenUsage, ToolUsage } from '../../types';
import Anthropic from '@anthropic-ai/sdk';
import { resolveToolProtocol } from '../../utils/resolveToolProtocol';
import { AssistantMessageContent, ToolUse } from '../../assistant-message/assistantMessageTypes';
import { SYSTEM_PROMPT } from '../../prompts/system';
import { DEFAULT_CONSECUTIVE_MISTAKE_LIMIT } from '../../types';

// Import helper classes
import { TaskObservers } from '../observers/TaskObservers';
import { TokenUsageTracker } from '../token-usage/TokenUsageTracker';
import { ResponseProcessor, ProcessedResponse } from '../response/ResponseProcessor';
import { TaskErrorHandler } from '../error/TaskErrorHandler';
import { ToolExecutor, ToolExecutionResult, ToolExecutorConfig } from '../tool-execution/ToolExecutor';
import { ErrorHandlerPrompt } from '../error-prompt/ErrorHandlerPrompt';
import { formatResponse } from '../simplified-dependencies/formatResponse';
import TooCallingParser from '../../tools/toolCallingParser/toolCallingParser';
import { Agent } from '../../agent/agent';

/**
 * Configuration for TaskExecutor
 */
export interface TaskExecutorConfig {
    apiRequestTimeout: number;
    maxRetryAttempts: number;
    consecutiveMistakeLimit: number;
}

/**
 * Interface for message processing state
 */
export interface MessageProcessingState {
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
 * Stack item for recursive request loop
 */
interface StackItem {
    sender: 'user' | 'system';
    content: Anthropic.Messages.ContentBlockParam[];
    retryAttempt?: number;
    userMessageWasRemoved?: boolean;
}

/**
 * TaskExecutor encapsulates all task execution logic
 * Handles status management, API requests, message processing,
 * error handling, and observer notifications
 */
export class TaskExecutor {
    private api: ApiHandler;
    private conversationHistory: ApiMessage[] = [];

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

    // Configuration
    private readonly config: TaskExecutorConfig;

    // Helper classes
    private readonly observers: TaskObservers;
    private readonly tokenUsageTracker: TokenUsageTracker;
    private readonly responseProcessor: ResponseProcessor;
    private readonly errorHandler: TaskErrorHandler;
    private readonly toolExecutor: ToolExecutor;

    constructor(
        taskId: string,
        config: TaskExecutorConfig,
        private agent: Agent,
    ) {
        this.taskId = taskId;
        this.config = config;
        this.api = buildApiHandler(this.agent.apiConfiguration);

        // Initialize helper classes
        this.observers = new TaskObservers();
        this.tokenUsageTracker = new TokenUsageTracker();
        this.responseProcessor = new ResponseProcessor(
            this.tokenUsageTracker,
            new TooCallingParser(),
        );
        this.errorHandler = new TaskErrorHandler({
            maxRetryAttempts: config.maxRetryAttempts,
            apiRequestTimeout: config.apiRequestTimeout,
        });
        this.toolExecutor = new ToolExecutor(
            this.agent.workspace
        );
    }

    /**
     * Set the tool calling handler (needed for tool execution)
     */
    setToolCallingHandler(handler: any): void {
        // @ts-ignore - Access private property to set handler
        this.toolExecutor.toolCallHandler = handler;
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
        return this.taskId;
    }

    /**
     * Getter for token usage
     */
    public get tokenUsage(): TokenUsage {
        return this.tokenUsageTracker.getUsage();
    }

    /**
     * Getter for tool usage
     */
    public get toolUsage(): ToolUsage {
        return this.toolExecutor.getToolUsage();
    }

    /**
     * Getter for conversation history
     */
    public get conversationHistoryRef(): ApiMessage[] {
        return this.conversationHistory;
    }

    /**
     * Setter for conversation history (for restoring state)
     */
    public set conversationHistoryRef(history: ApiMessage[]) {
        this.conversationHistory = history;
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

    // ==================== Lifecycle Methods ====================

    /**
     * Execute the task with user content
     */
    async execute(userContent: Anthropic.Messages.ContentBlockParam[]): Promise<boolean> {
        this.setStatus('running');
        return this.recursivelyMakeClineRequests(userContent);
    }

    /**
     * Complete the task
     */
    complete(): void {
        this.setStatus('completed');
        this.observers.notifyTaskCompleted(this.taskId);
    }

    /**
     * Abort the task
     */
    abort(abortReason?: string): void {
        this.setStatus('aborted');
        this.observers.notifyTaskAborted(this.taskId, abortReason || 'Task aborted');
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

    // ==================== Core Request Loop ====================

    /**
     * Core method for making recursive API requests to the LLM
     * Implements stack-based retry mechanism with error handling
     */
    private async recursivelyMakeClineRequests(
        userContent: Anthropic.Messages.ContentBlockParam[],
    ): Promise<boolean> {
        // Reset collected errors for this new operation
        this.resetCollectedErrors();

        const stack: StackItem[] = [{ sender: 'user', content: userContent, retryAttempt: 0 }];

        while (stack.length > 0) {
            const currentItem = stack.pop()!;
            const currentUserContent = currentItem.content;
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
                this.agent.apiConfiguration,
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

            const oldWorkspaceContext = await this.agent.workspace.renderContext()

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
                    this.consecutiveMistakeCount++;
                    throw new NoToolsUsedError();
                }

                // Execute tool calls and build response
                // This will update workspace states
                const executionResult = await this.toolExecutor.executeToolCalls(
                    toolUseBlocks,
                    () => this.isAborted(),
                );

                // Update message state with execution result
                this.messageState.userMessageContent = executionResult.userMessageContent;
                this.messageState.didAttemptCompletion = executionResult.didAttemptCompletion;

                // Add assistant message to conversation history
                await this.addAssistantMessageToHistory(processedResponse.reasoningMessage);

                // Add workspace context to conversation history
                this.addSystemMessageToHistory(oldWorkspaceContext)

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

                // const newContext = await this.agent.workspace.renderContext()
                // console.log(`new workspace LLM-interface: \n========================\n${newContext}\n========================\n`)


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
        })
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

        this.observers.notifyMessageAdded(this.taskId, messageWithTs as ApiMessage);
        this.conversationHistory.push(messageWithTs as ApiMessage);
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
            const workspaceContext = await this.agent.workspace.renderContext()
            // console.debug(`system prompt: ${systemPrompt}`);
            // console.log(workspaceContext)

            // Build clean conversation history
            const cleanConversationHistory = this.buildCleanConversationHistory(
                this.conversationHistory,
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
     * Get system prompt
     */
    private async getSystemPrompt(): Promise<string> {
        const modelInfo = this.api.getModel();
        const modelId = modelInfo.id;

        // Resolve tool protocol based on provider settings and model info
        const toolProtocol = resolveToolProtocol(
            this.agent.apiConfiguration,
            modelInfo.info,
        );
        return `
        ${(await SYSTEM_PROMPT({ toolProtocol }, modelId)) || ''}

        ${await this.agent.workspace.getWorkspacePrompt()}
        `
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
     * Set task status and notify observers
     */
    private setStatus(status: TaskStatus): void {
        this._status = status;
        this.observers.notifyStatusChanged(this.taskId, status);
    }
}
