import {
  ApiHandler,
  ApiStreamChunk,
  buildApiHandler,
  type ApiStream,
} from '../api';
import {
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ProviderSettings,
  getApiProtocol,
  getModelId,
  ModelInfo,
  ToolName,
} from '../types';
import type { ToolUsage, TokenUsage } from '../types';
import Anthropic from '@anthropic-ai/sdk';
import { resolveToolProtocol } from '../utils/resolveToolProtocol';
import { formatResponse } from './simplified-dependencies/formatResponse';
import {
  AssistantMessageContent,
  ToolUse,
} from '../assistant-message/assistantMessageTypes';
import { processUserContentMentions } from './simplified-dependencies/processUserContentMentions';
import { SYSTEM_PROMPT } from '../prompts/system';
import { ConsecutiveMistakeError, NoApiResponseError, NoToolsUsedError } from './task.errors';
import { ToolCallingHandler, ToolContext } from '../tools';
import { IWorkspace } from '../agent/agentWorkspace';
import {
  TaskStatus,
  ThinkingBlock,
  ExtendedApiMessage,
  ApiMessage,
  MessageAddedCallback,
  TaskStatusChangedCallback,
  TaskCompletedCallback,
  TaskAbortedCallback,
} from './task.type';
import TooCallingParser from '../tools/toolCallingParser/toolCallingParser';
import { TaskObservers } from './observers/TaskObservers';
import { TokenUsageTracker } from './token-usage/TokenUsageTracker';
import { ResponseProcessor } from './response/ResponseProcessor';
import { TaskErrorHandler } from './error/TaskErrorHandler';
import { ToolExecutor, ToolExecutorConfig } from './tool-execution/ToolExecutor';
import { ErrorHandlerPrompt } from './error-prompt/ErrorHandlerPrompt';

type SystemMessage = ErrorMessage | ToolResultMessage

interface ErrorMessage {
  type: 'error';
  content: string
}

interface ToolResultMessage {
  type: 'tool_result';
  content: string;
}

/**
 * Interface to encapsulate message processing state
 */
interface MessageProcessingState {
  assistantMessageContent: AssistantMessageContent[];
  userMessageContent: (
    | Anthropic.TextBlockParam
    | Anthropic.ImageBlockParam
    | Anthropic.ToolResultBlockParam
  )[];
  systemMessageContent: SystemMessage[];
  didAttemptCompletion: boolean;
  cachedModel?: { id: string; info: ModelInfo };
}

/**
 * Simplified Task entity with no core dependencies
 * Only essential functionality for recursivelyMakeClineRequests
 * All UI, frontend, persistence, and event emission features removed
 */
export class Task {
  readonly taskId: string;
  private _status: TaskStatus = 'idle';
  taskInput: string = '';

  readonly instanceId: string;
  readonly rootTaskId?: string;
  readonly parentTaskId?: string;
  childTaskId?: string;
  pendingNewTaskToolCallId?: string;

  private api: ApiHandler;

  // Tool Use
  consecutiveMistakeCount: number = 0;
  consecutiveMistakeLimit: number = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT;
  consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map();

  // LLM Messages & Chat Messages
  conversationHistory: ApiMessage[] = [];

  didFinishAbortingStream = false;
  abandoned = false;
  abortReason?: any;
  isInitialized = false;
  isPaused: boolean = false;

  // Message processing state
  private messageState: MessageProcessingState = {
    assistantMessageContent: [],
    userMessageContent: [],
    systemMessageContent: [],
    didAttemptCompletion: false,
    cachedModel: undefined,
  };

  // Retry configuration
  private readonly maxRetryAttempts: number = 3;
  private readonly apiRequestTimeout: number = 60000; // 60 seconds

  // Helper classes
  private readonly observers: TaskObservers;
  private readonly tokenUsageTracker: TokenUsageTracker;
  private readonly responseProcessor: ResponseProcessor;
  private readonly errorHandler: TaskErrorHandler;
  private readonly toolExecutor: ToolExecutor;
  private readonly toolCallingParser = new TooCallingParser();

  constructor(
    taskId: string,
    taskInput: string,
    private apiConfiguration: ProviderSettings,
    consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ) {
    this.taskId = taskId;
    this.instanceId = crypto.randomUUID().slice(0, 8);
    this.taskInput = taskInput;
    this.consecutiveMistakeLimit = consecutiveMistakeLimit;
    this.api = buildApiHandler(apiConfiguration);

    // Initialize helper classes
    this.observers = new TaskObservers();
    this.tokenUsageTracker = new TokenUsageTracker();
    this.responseProcessor = new ResponseProcessor(
      this.tokenUsageTracker,
      this.toolCallingParser,
    );
    this.errorHandler = new TaskErrorHandler({
      maxRetryAttempts: this.maxRetryAttempts,
      apiRequestTimeout: this.apiRequestTimeout,
    });
    this.toolExecutor = new ToolExecutor(new ToolCallingHandler());
  }

  // ==================== Registration Methods ====================

  /**
   * Register message added observer
   * @param callback - Function to be called when a message is added
   * @returns cleanup function - Used to unregister
   */
  onMessageAdded(callback: MessageAddedCallback): () => void {
    return this.observers.onMessageAdded(callback);
  }

  onStatusChanged(callback: TaskStatusChangedCallback): () => void {
    return this.observers.onStatusChanged(callback);
  }

  onTaskCompleted(callback: TaskCompletedCallback): () => void {
    return this.observers.onTaskCompleted(callback);
  }

  onTaskAborted(callback: TaskAbortedCallback): () => void {
    return this.observers.onTaskAborted(callback);
  }

  // ==================== Helper Methods ====================
  /**
   * Reset message processing state for each new API request
   */
  private resetMessageState(): void {
    this.messageState.assistantMessageContent = [];
    this.messageState.userMessageContent = [];
    this.messageState.didAttemptCompletion = false;
  }

  /**
   * Getter for assistantMessageContent (for testing purposes)
   */
  public get assistantMessageContent(): AssistantMessageContent[] {
    return this.messageState.assistantMessageContent;
  }

  /**
   * Getter for task status (for testing purposes)
   */
  public get status(): TaskStatus {
    return this._status;
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
   * Helper method to set task status
   */
  private setStatus(status: TaskStatus): void {
    this._status = status;
    this.observers.notifyStatusChanged(this.taskId, status);
  }

  /**
   * Check if task is aborted
   */
  private isAborted(): boolean {
    return this._status === 'aborted';
  }

  /**
   * Get all collected errors for debugging purposes
   */
  public getCollectedErrors() {
    return this.errorHandler.getCollectedErrors();
  }

  /**
   * Reset collected errors (useful for starting a new operation)
   */
  public resetCollectedErrors(): void {
    this.errorHandler.resetCollectedErrors();
  }

  // ==================== Life Cycle Methods ====================
  // Start / Resume / Abort / Dispose / Complete

  async start(task?: string, images?: string[]): Promise<Task> {
    this.setStatus('running');

    this.recursivelyMakeClineRequests([
      {
        type: 'text',
        text: `<task>${task ?? this.taskInput}</task>`,
      },
    ]);

    return this;
  }

  complete(tokenUsage?: TokenUsage, toolUsage?: ToolUsage) {
    this.setStatus('completed');
    this.observers.notifyTaskCompleted(this.taskId);
  }

  abort(abortReason?: string) {
    this.setStatus('aborted');
    this.abortReason = abortReason;
    this.observers.notifyTaskAborted(this.taskId, abortReason || 'Task aborted');
  }

  /**
   * Core method for making recursive API requests to the LLM
   * Simplified version without streaming - processes complete response
   */
  public async recursivelyMakeClineRequests(
    userContent: Anthropic.Messages.ContentBlockParam[]
  ): Promise<boolean> {
    // Reset collected errors for this new operation
    this.resetCollectedErrors();

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
        // Clear the stack to ensure the while loop terminates
        stack.length = 0;
        // Return false to indicate the task was aborted
        return false;
      }

      if (
        this.consecutiveMistakeCount > 0 &&
        this.consecutiveMistakeCount >= this.consecutiveMistakeLimit
      ) {
        console.error('Consecutive mistake limit reached');
        this.consecutiveMistakeCount = 0;
        throw new Error(`Consecutive mistake limit reached`);
      }

      // Determine API protocol based on provider and model
      const modelId = getModelId(this.apiConfiguration);
      const apiProtocol = getApiProtocol(
        this.apiConfiguration.apiProvider,
        modelId,
      );

      const parsedUserContent = await processUserContentMentions({
        userContent: currentUserContent,
      });

      let finalUserContent: Anthropic.Messages.ContentBlockParam[] = [
        ...parsedUserContent,
      ];

      // Add user message to conversation history if needed
      const isEmptyUserContent = currentUserContent.length === 0;
      const shouldAddUserMessage =
        ((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) ||
        currentItem.userMessageWasRemoved;

      if (shouldAddUserMessage) {
        await this.addToConversationHistory({
          role: 'user',
          content: finalUserContent,
        });
      }

      try {
        // Reset message processing state for each new API request
        this.resetMessageState();

        // Cache model info once per API request
        this.messageState.cachedModel = this.api.getModel();
        const modelInfo = this.messageState.cachedModel.info;

        const toolProtocol = resolveToolProtocol(
          this.apiConfiguration,
          modelInfo,
        );

        const shouldUseXmlParser = toolProtocol === 'xml';

        // Collect complete response from stream
        const response = await this.collectCompleteResponse();

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

  /**
   * Collect complete response from stream without processing chunks individually
   */
  private async collectCompleteResponse(): Promise<ApiStreamChunk[]> {
    const stream = this.attemptApiRequest();
    const chunks: ApiStreamChunk[] = [];

    try {
      const iterator = stream[Symbol.asyncIterator]();
      let item = await iterator.next();

      while (!item.done) {
        // Check for abort status during stream processing
        if (this.isAborted()) {
          console.log(
            `Task ${this.taskId} was aborted during stream collection`,
          );
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
      // This ensures the tool_result block references the correct tool_use block
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

  private async addToConversationHistory(
    message: Anthropic.MessageParam,
    reasoning?: string,
  ) {
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

  private async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
    try {
      console.log(`Starting API request attempt ${retryAttempt + 1}`);

      const systemPrompt = await this.getSystemPrompt();
      // console.debug(`system prompt: ${systemPrompt}`);

      // Build clean conversation history
      const cleanConversationHistory = this.buildCleanConversationHistory(
        this.conversationHistory,
      );

      // console.log(`context: ${JSON.stringify(cleanConversationHistory)}`);

      const metadata = {
        taskId: this.taskId,
      };

      // Create the stream with timeout
      const streamPromise = this.api.createMessage(
        systemPrompt,
        cleanConversationHistory as unknown as Anthropic.MessageParam[],
      );

      try {
        const stream = await Promise.race([
          streamPromise,
          this.createTimeoutPromise(this.apiRequestTimeout),
        ]);

        console.log(`API request attempt ${retryAttempt + 1} successful`);
        yield* stream;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new Error(`API request timed out after ${this.apiRequestTimeout}ms`);
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

  private async getSystemPrompt(): Promise<string> {
    // Get model info to determine tool protocol
    const modelInfo = this.api.getModel();
    const modelId = modelInfo.id;

    // Resolve tool protocol based on provider settings and model info
    const toolProtocol = resolveToolProtocol(
      this.apiConfiguration,
      modelInfo.info,
    );

    return (await SYSTEM_PROMPT({ toolProtocol }, modelId)) || '';
  }

  private buildCleanConversationHistory(
    history: ApiMessage[],
  ): Anthropic.MessageParam[] {
    return history as unknown as Anthropic.MessageParam[];
  }
}
