import { ApiHandler, ApiStreamChunk, buildApiHandler, type ApiStream } from 'llm-api';
import {
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ProviderSettings,
  ToolUsage,
  getApiProtocol,
  getModelId,
  ModelInfo,
  ToolName
} from 'llm-types';
import Anthropic from '@anthropic-ai/sdk';
import { resolveToolProtocol } from 'llm-utils/resolveToolProtocol';
import { formatResponse } from './simplified-dependencies/formatResponse';
import {
  AssistantMessageContent,
  ToolUse,
} from '../assistant-message/assistantMessageTypes';
import { NativeToolCallParser } from '../assistant-message/NativeToolCallParser';
import { processUserContentMentions } from './simplified-dependencies/processUserContentMentions';
import { AssistantMessageParser } from '../assistant-message/AssistantMessageParser';
import { SYSTEM_PROMPT } from '../prompts/system';
import {
  TaskError,
  TaskAbortedError,
  ConsecutiveMistakeError,
  ApiTimeoutError,
  ApiRequestError,
  NoApiResponseError,
  NoToolsUsedError,
  StreamingError,
  MaxRetryExceededError
} from './task.errors';
import { ToolCallingHandler } from 'llm-tools'
import { randomUUID } from 'node:crypto';
import { TokenUsage } from 'llm-types'
import {
  TaskStatus,
  ThinkingBlock,
  ExtendedApiMessage,
  MessageAddedCallback,
  TaskStatusChangedCallback,
  ApiMessage
} from './task.type';


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
  didAttemptCompletion: boolean;
  assistantMessageParser?: AssistantMessageParser;
  cachedModel?: { id: string; info: ModelInfo };
}


/**
 * Simplified Task entity with no core dependencies
 * Only essential functionality for recursivelyMakeClineRequests
 * All UI, frontend, persistence, and event emission features removed
 */
export class Task {
  readonly taskId: string;
  private _status: TaskStatus = 'running';

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
  toolUsage: ToolUsage = {};
  toolCallHandler = new ToolCallingHandler()

  // Token Usage
  tokenUsage: TokenUsage = {
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCacheWrites: 0,
    totalCacheReads: 0,
    totalCost: 0,
    contextTokens: 0,
  };

  // LLM Messages & Chat Messages
  conversationHistory: ApiMessage[] = [];


  // Ask
  public lastMessageTs?: number;

  // TaskStatus
  idleAsk?: any;
  resumableAsk?: any;
  interactiveAsk?: any;

  didFinishAbortingStream = false;
  abandoned = false;
  abortReason?: any;
  isInitialized = false;
  isPaused: boolean = false;

  // Message processing state
  private messageState: MessageProcessingState = {
    assistantMessageContent: [],
    userMessageContent: [],
    didAttemptCompletion: false,
    assistantMessageParser: undefined,
    cachedModel: undefined,
  };

  // Retry configuration
  private readonly maxRetryAttempts: number = 3;
  private readonly apiRequestTimeout: number = 60000; // 60 seconds

  // Error collection for retry attempts
  private collectedErrors: TaskError[] = [];

  // Observer
  private messageAddedCallbacks: MessageAddedCallback[] = [];
  private taskStatusChangedCallbacks: TaskStatusChangedCallback[] = [];

  constructor(
    taskId: string,
    private apiConfiguration: ProviderSettings,
    consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ) {
    this.taskId = taskId;
    this.instanceId = crypto.randomUUID().slice(0, 8);
    this.consecutiveMistakeLimit = consecutiveMistakeLimit;
    this.api = buildApiHandler(apiConfiguration);
    this.messageState.assistantMessageParser = new AssistantMessageParser();
  }

  // ==================== Registration Methods ====================

  /**
   * Register message added observer
   * @param callback - Function to be called when a message is added
   * @returns cleanup function - Used to unregister
   */
  onMessageAdded(callback: MessageAddedCallback): () => void {
    // 1. Store the callback function in the array
    this.messageAddedCallbacks.push(callback);

    // 2. Return a cleanup function
    return () => {
      // Remove this callback from the array
      this.messageAddedCallbacks = this.messageAddedCallbacks.filter(
        cb => cb !== callback
      );
    };
  }

  // ==================== Notification Methods ====================

  /**
   * Notify all observers
   */
  private notifyMessageAdded(message: ApiMessage): void {
    // Iterate through all registered callback functions and call them
    this.messageAddedCallbacks.forEach(callback => {
      try {
        callback(message);  // ← Directly call the function passed by TaskService
      } catch (error) {
        console.error('Error in callback:', error);
      }
    });
  }


  /**
   * Reset message processing state for each new API request
   */
  private resetMessageState(): void {
    this.messageState.assistantMessageContent = [];
    this.messageState.userMessageContent = [];
    this.messageState.didAttemptCompletion = false;
    this.messageState.assistantMessageParser?.reset();
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
   * Helper method to set task status to running
   */
  private setRunning(): void {
    this._status = 'running';
  }

  /**
   * Helper method to set task status to completed
   */
  private setCompleted(): void {
    this._status = 'completed';
  }

  /**
   * Helper method to set task status to aborted
   */
  private setAborted(): void {
    this._status = 'aborted';
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
  public getCollectedErrors(): TaskError[] {
    return [...this.collectedErrors];
  }

  /**
   * Reset collected errors (useful for starting a new operation)
   */
  public resetCollectedErrors(): void {
    this.collectedErrors = [];
  }

  // Lifecycle
  // Start / Resume / Abort / Dispose / Complete

  async start(task?: string, images?: string[]): Promise<void> {
    this.setRunning();

    const result = await this.recursivelyMakeClineRequests([
      {
        type: 'text',
        text: `<task>${task}</task>`
      }
    ])

    if (result) {
      // this.complete()
    }

  }

  complete(tokenUsage?: any, toolUsage?: ToolUsage) {
    this.setCompleted();
    // return {
    //   event: 'task.completed',
    //   data: {
    //     taskId: this.taskId,
    //     tokenUsage: tokenUsage || this.tokenUsage,
    //     toolUsage: toolUsage || this.toolUsage
    //   },
    // };
  }

  abort(abortReason?: any) {
    this.setAborted();
    this.abortReason = abortReason;
    // return { event: 'task.aborted', data: { taskId: this.taskId } };
  }

  /**
   * Core method for making recursive API requests to the LLM
   * Simplified version without streaming - processes complete response
   */
  public async recursivelyMakeClineRequests(
    userContent: Anthropic.Messages.ContentBlockParam[],
    includeFileDetails: boolean = false,
  ): Promise<boolean> {
    // Reset collected errors for this new operation
    this.resetCollectedErrors();

    interface StackItem {
      userContent: Anthropic.Messages.ContentBlockParam[];
      retryAttempt?: number;
      userMessageWasRemoved?: boolean;
    }

    const stack: StackItem[] = [
      { userContent, retryAttempt: 0 },
    ];

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
        throw new Error(`Consecutive mistake limit reached`)
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
        await this.processCompleteResponse(response, shouldUseXmlParser);

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
        await this.executeToolCalls(toolUseBlocks);

        // Add assistant message to conversation history
        await this.addAssistantMessageToHistory();

        // Check if we should continue recursion
        if (this.messageState.userMessageContent.length > 0 && !this.messageState.didAttemptCompletion) {
          stack.push({
            userContent: [...this.messageState.userMessageContent],
          });
        }

        // For debugging: avoid stuck in loop for some tests
        // didEndLoop = true;

      } catch (error) {
        const currentRetryAttempt = currentItem.retryAttempt ?? 0;

        // Convert to TaskError if it's not already one
        let taskError: TaskError;
        if (error instanceof TaskError) {
          taskError = error;
        } else if (error instanceof Error) {
          // Check for timeout errors
          if (error.message.includes('timed out')) {
            taskError = new ApiTimeoutError(this.apiRequestTimeout, error);
          } else {
            taskError = new ApiRequestError(error.message, undefined, error);
          }
        } else {
          taskError = new ApiRequestError(String(error));
        }

        this.collectedErrors.push(taskError);
        console.error(`Error in recursivelyMakeClineRequests (attempt ${currentRetryAttempt + 1}):`, taskError);

        // Don't retry non-retryable errors
        if (!taskError.retryable) {
          console.error(`Non-retryable error encountered: ${taskError.code}. Aborting.`);
          throw taskError;
        }

        // Check if we've exceeded the maximum retry attempts
        if (currentRetryAttempt >= this.maxRetryAttempts) {
          console.error(`Maximum retry attempts (${this.maxRetryAttempts}) exceeded due to errors. Aborting.`);
          throw new MaxRetryExceededError(this.maxRetryAttempts, this.collectedErrors);
        }

        // Push the same content back onto the stack to retry
        console.log(`Retrying after error (attempt ${currentRetryAttempt + 2}/${this.maxRetryAttempts + 1})`);
        stack.push({
          userContent: currentUserContent,
          retryAttempt: currentRetryAttempt + 1,
        });
      }
      console.log(`stack length: ${stack.length}`)
      if (didEndLoop) {
        return true;
      }
    }

    return false;
  }

  /**
   * Collect complete response from stream without processing chunks individually
   */
  private async collectCompleteResponse(): Promise<ApiStreamChunk[]> {
    const stream = this.attemptApiRequest();
    const chunks = [];

    try {
      const iterator = stream[Symbol.asyncIterator]();
      let item = await iterator.next();

      while (!item.done) {
        // Check for abort status during stream processing
        if (this.isAborted()) {
          console.log(`Task ${this.taskId} was aborted during stream collection`);
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
   * Process complete response collected from stream
   */
  private async processCompleteResponse(chunks: ApiStreamChunk[], shouldUseXmlParser: boolean): Promise<void> {
    let reasoningMessage = '';
    let assistantMessage = '';

    // Process all chunks to build complete response
    for (const chunk of chunks) {
      switch (chunk.type) {
        case 'usage':
          // Accumulate token usage information
          this.accumulateTokenUsage(chunk);
          break;
        case 'tool_call': {
          // Handle complete tool calls
          const toolUse = NativeToolCallParser.parseToolCall({
            id: chunk.id,
            name: chunk.name as any,
            arguments: chunk.arguments,
          });

          if (toolUse) {
            this.messageState.assistantMessageContent.push(toolUse);
          }
          break;
        }
        case 'reasoning': {
          reasoningMessage += chunk.text;
          // console.log('reasoning:', chunk.text);
          break;
        }
        case 'text': {
          assistantMessage += chunk.text;
          break;
        }
      }
    }

    // Process text content if using XML parser
    if (shouldUseXmlParser && this.messageState.assistantMessageParser && assistantMessage) {
      this.messageState.assistantMessageContent =
        this.messageState.assistantMessageParser.processChunk(assistantMessage);
      this.messageState.assistantMessageParser.finalizeContentBlocks();
      const parsedBlocks = this.messageState.assistantMessageParser.getContentBlocks();
      this.messageState.assistantMessageContent = parsedBlocks;
    } else if (assistantMessage) {
      // Native protocol: Add text as content block
      this.messageState.assistantMessageContent.push({
        type: 'text',
        content: assistantMessage,
      });
    }
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
      return toolCallRes.content.map((block: any) => {
        if (block.type === 'text') {
          return block.text;
        }
        return `[${block.type} content]`;
      }).join('\n');
    }

    if ('type' in toolCallRes && toolCallRes.type === 'text' && toolCallRes.content) {
      // Handle simple object with type and content
      return toolCallRes.content;
    }

    if (Array.isArray(toolCallRes)) {
      // Handle array of content blocks
      return toolCallRes.map((block: any) => {
        if (block.type === 'text') {
          return block.text;
        }
        return `[${block.type} content]`;
      }).join('\n');
    }

    // Fallback for other object types
    return JSON.stringify(toolCallRes);
  }

  /**
   * Accumulate token usage information from usage chunks
   */
  private accumulateTokenUsage(usageChunk: any): void {
    if (!usageChunk) return;

    // Initialize tokenUsage structure if needed
    if (!this.tokenUsage) {
      this.tokenUsage = {
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCacheWrites: 0,
        totalCacheReads: 0,
        totalCost: 0,
        contextTokens: 0,
      };
    }

    // Accumulate values from the usage chunk
    // Map from the chunk properties to the TokenUsage type properties
    this.tokenUsage.totalTokensIn += usageChunk.inputTokens || 0;
    this.tokenUsage.totalTokensOut += usageChunk.outputTokens || 0;
    this.tokenUsage.totalCacheWrites += usageChunk.cacheWriteTokens || 0;
    this.tokenUsage.totalCacheReads += usageChunk.cacheReadTokens || 0;
    this.tokenUsage.totalCost += usageChunk.totalCost || 0;
    // Note: reasoningTokens is not part of the TokenUsage type, so we'll ignore it
    // contextTokens might need to be calculated or set separately
  }

  /**
   * Execute tool calls and build user message content
   */
  private async executeToolCalls(toolUseBlocks: AssistantMessageContent[]): Promise<void> {
    for (const block of toolUseBlocks) {
      // Check for abort status before executing each tool
      if (this.isAborted()) {
        console.log(`Task ${this.taskId} was aborted during tool execution`);
        return;
      }

      console.log(`detect tool calling: ${JSON.stringify(block)}`);
      const toolUse = block as ToolUse;
      const toolCallId = randomUUID();

      const input = toolUse.nativeArgs || toolUse.params;

      // Handle tool calling
      const toolCallRes = await this.toolCallHandler.handleToolCalling(toolUse.name as ToolName, input);

      // Check for abort status after tool execution
      if (this.isAborted()) {
        console.log(`Task ${this.taskId} was aborted after tool execution`);
        return;
      }

      // Process tool call result and add to user message content
      if (toolCallRes) {
        // Convert tool result to text format for user message
        const resultText = this.parseToolCallResponse(toolCallRes);

        // Add tool result to user message content
        if (resultText) {
          this.messageState.userMessageContent.push({
            type: 'tool_result' as const,
            tool_use_id: toolCallId,
            content: resultText,
          });

          // Check if this is an attempt_completion tool call
          if (toolUse.name === 'attempt_completion') {
            // For attempt_completion, don't push to stack for further processing
            console.log('Tool call completed with attempt_completion, ending recursion');
            this.messageState.didAttemptCompletion = true;
            // Clear user message content to prevent further recursion
            this.messageState.userMessageContent = [];
          }
        }
      }
    }
  }

  /**
   * Add assistant message to conversation history
   */
  private async addAssistantMessageToHistory(): Promise<void> {
    const assistantContent: Array<Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam> = [];

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
      const toolCallId = randomUUID();
      const input = toolUse.nativeArgs || toolUse.params;

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
    });
  }

  private async addToConversationHistory(
    message: Anthropic.MessageParam,
    reasoning?: string,
  ) {
    const messageWithTs: ExtendedApiMessage = {
      role: message.role,
      content: Array.isArray(message.content)
        ? [...message.content] as Array<Anthropic.ContentBlockParam | ThinkingBlock>
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

    this.notifyMessageAdded(messageWithTs as ApiMessage);
    this.conversationHistory.push(messageWithTs as ApiMessage);
  }

  private async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
    try {
      console.log(`Starting API request attempt ${retryAttempt + 1}`);

      const systemPrompt = await this.getSystemPrompt();
      console.debug(`system prompt: ${systemPrompt}`);

      // Build clean conversation history
      const cleanConversationHistory = this.buildCleanConversationHistory(
        this.conversationHistory,
      );

      const metadata = {
        taskId: this.taskId,
      };

      // Create the stream with timeout
      const streamPromise = this.api.createMessage(
        systemPrompt,
        cleanConversationHistory as unknown as Anthropic.MessageParam[],
        metadata,
      );

      try {
        const stream = await Promise.race([
          streamPromise,
          this.createTimeoutPromise(this.apiRequestTimeout)
        ]);

        console.log(`API request attempt ${retryAttempt + 1} successful`);
        yield* stream;
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          throw new ApiTimeoutError(this.apiRequestTimeout, error);
        }
        throw error;
      }
    } catch (error) {
      console.error(`API request attempt ${retryAttempt + 1} failed:`, error);

      // Convert to TaskError if it's not already one
      if (error instanceof TaskError) {
        throw error;
      } else if (error instanceof Error) {
        throw new ApiRequestError(error.message, undefined, error);
      } else {
        throw new ApiRequestError(String(error));
      }
    }
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ApiTimeoutError(timeoutMs));
      }, timeoutMs);
    });
  }

  private async getSystemPrompt(): Promise<string> {
    return await SYSTEM_PROMPT() || '';
  }

  private buildCleanConversationHistory(
    history: ApiMessage[]
  ): Anthropic.MessageParam[] {
    return history as unknown as Anthropic.MessageParam[];
  }
}
