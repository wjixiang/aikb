import { ApiHandler, buildApiHandler, type ApiStream } from 'llm-api';
import {
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ProviderSettings,
  ToolUsage,
  getApiProtocol,
  getModelId,
  ModelInfo,
  ClineMessage,
  ToolName
} from 'llm-types';
import Anthropic from '@anthropic-ai/sdk';
import { resolveToolProtocol } from 'llm-utils/resolveToolProtocol';
import { formatResponse } from './simplified-dependencies/formatResponse';
import {
  AssistantMessageContent,
  ToolUse,
} from 'llm-core/assistant-message/assistantMessageTypes';
import { NativeToolCallParser } from 'llm-core/assistant-message/NativeToolCallParser';
import { processUserContentMentions } from './simplified-dependencies/processUserContentMentions';
import { ApiMessage } from './simplified-dependencies/taskPersistence';
import { AssistantMessageParser } from 'llm-core/assistant-message/AssistantMessageParser';
import { SYSTEM_PROMPT } from 'llm-core/prompts/system';
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
  private _status: 'running' | 'completed' | 'aborted' = 'running';

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

  // LLM Messages & Chat Messages
  apiConversationHistory: ApiMessage[] = [];


  // Ask
  private askResponse?: any;
  private askResponseText?: string;
  private askResponseImages?: string[];
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

  start() {
    (this._status as 'running' | 'completed' | 'aborted') = 'running';
    return { event: 'task.started', data: { taskId: this.taskId } };
  }

  complete(tokenUsage: any, toolUsage: ToolUsage) {
    (this._status as 'running' | 'completed' | 'aborted') = 'completed';
    return {
      event: 'task.completed',
      data: { taskId: this.taskId, tokenUsage, toolUsage },
    };
  }

  abort() {
    (this._status as 'running' | 'completed' | 'aborted') = 'aborted';
    return { event: 'task.aborted', data: { taskId: this.taskId } };
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

      if ((this._status as 'running' | 'completed' | 'aborted') === 'aborted') {
        throw new Error(
          `[Task#recursivelyMakeClineRequests] task ${this.taskId} aborted`,
        );
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
        await this.addToApiConversationHistory({
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

        didEndLoop = true;

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

      console.log('stack:\n', JSON.stringify(stack))

      if (didEndLoop) {
        return true;
      }
    }

    return false;
  }

  /**
   * Collect complete response from stream without processing chunks individually
   */
  private async collectCompleteResponse(): Promise<any[]> {
    const stream = this.attemptApiRequest();
    const chunks: any[] = [];

    try {
      const iterator = stream[Symbol.asyncIterator]();
      let item = await iterator.next();

      while (!item.done) {
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
  private async processCompleteResponse(chunks: any[], shouldUseXmlParser: boolean): Promise<void> {
    let reasoningMessage = '';
    let assistantMessage = '';

    // Process all chunks to build complete response
    for (const chunk of chunks) {
      switch (chunk.type) {
        case 'usage':
          // Handle usage tracking (simplified)
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
          console.log('reasoning:', chunk.text);
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
   * Execute tool calls and build user message content
   */
  private async executeToolCalls(toolUseBlocks: AssistantMessageContent[]): Promise<void> {
    for (const block of toolUseBlocks) {
      console.log(`detect tool calling: ${JSON.stringify(block)}`);
      const toolUse = block as ToolUse;
      const toolCallId = randomUUID();

      const input = toolUse.nativeArgs || toolUse.params;

      // Handle tool calling
      const toolCallRes = await this.toolCallHandler.handleToolCalling(toolUse.name as ToolName, input);
      console.log(`toolCallRes:${JSON.stringify(toolCallRes)}`);

      // Process tool call result and add to user message content
      if (toolCallRes) {
        // Convert tool result to text format for user message
        let resultText = '';

        if (typeof toolCallRes === 'string') {
          resultText = toolCallRes;
        } else if (toolCallRes && typeof toolCallRes === 'object') {
          // Handle structured tool responses
          if ('content' in toolCallRes && Array.isArray(toolCallRes.content)) {
            // Handle McpToolCallResponse - it has a content array
            resultText = toolCallRes.content.map((block: any) => {
              if (block.type === 'text') {
                return block.text;
              }
              return `[${block.type} content]`;
            }).join('\n');
          } else if ('type' in toolCallRes && toolCallRes.type === 'text' && toolCallRes.content) {
            // Handle simple object with type and content
            resultText = toolCallRes.content;
          } else if (Array.isArray(toolCallRes)) {
            // Handle array of content blocks
            resultText = toolCallRes.map((block: any) => {
              if (block.type === 'text') {
                return block.text;
              }
              return `[${block.type} content]`;
            }).join('\n');
          } else {
            // Fallback for other object types
            resultText = JSON.stringify(toolCallRes);
          }
        }

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

    await this.addToApiConversationHistory({
      role: 'assistant',
      content: assistantContent,
    });
  }

  private async addToApiConversationHistory(
    message: Anthropic.MessageParam,
    reasoning?: string,
  ) {
    const messageWithTs: any = {
      ...message,
      ts: Date.now(),
    };

    if (message.role === 'assistant' && reasoning) {
      const reasoningBlock = {
        type: 'thinking' as const,
        thinking: reasoning,
      };

      if (Array.isArray(messageWithTs.content)) {
        messageWithTs.content = [reasoningBlock, ...messageWithTs.content];
      } else {
        messageWithTs.content = [reasoningBlock];
      }
    }

    this.apiConversationHistory.push(messageWithTs);
  }

  private async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
    try {
      console.log(`Starting API request attempt ${retryAttempt + 1}`);

      const systemPrompt = await this.getSystemPrompt();
      console.debug(`system prompt: ${systemPrompt}`);

      // Build clean conversation history
      const cleanConversationHistory = this.buildCleanConversationHistory(
        this.apiConversationHistory,
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
