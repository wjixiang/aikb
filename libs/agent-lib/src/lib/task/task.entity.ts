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

  // Streaming
  isStreaming = false;
  currentStreamingContentIndex = 0;
  currentStreamingDidCheckpoint = false;
  assistantMessageContent: AssistantMessageContent[] = [];
  presentAssistantMessageLocked = false;
  presentAssistantMessageHasPendingUpdates = false;
  userMessageContent: (
    | Anthropic.TextBlockParam
    | Anthropic.ImageBlockParam
    | Anthropic.ToolResultBlockParam
  )[] = [];
  userMessageContentReady = false;
  didRejectTool = false;
  didAlreadyUseTool = false;
  didToolFailInCurrentTurn = false;
  didCompleteReadingStream = false;
  didAttemptCompletion = false;
  assistantMessageParser?: AssistantMessageParser;
  private providerProfileChangeListener?: (config: {
    name: string;
    provider?: string;
  }) => void;

  // Native tool call streaming state (track which index each tool is at)
  private streamingToolCallIndices: Map<string, number> = new Map();

  // Cached model info for current streaming session
  cachedStreamingModel?: { id: string; info: ModelInfo };

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
    this.assistantMessageParser = new AssistantMessageParser();
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
   * This is the main functionality we want to preserve
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
        // Reset streaming state for each new API request
        this.currentStreamingContentIndex = 0;
        this.assistantMessageContent = [];
        this.didCompleteReadingStream = false;
        this.userMessageContent = [];
        this.userMessageContentReady = false;
        this.didRejectTool = false;
        this.didAlreadyUseTool = false;
        this.didToolFailInCurrentTurn = false;
        this.didAttemptCompletion = false;
        this.assistantMessageParser?.reset();
        this.streamingToolCallIndices.clear();
        NativeToolCallParser.clearAllStreamingToolCalls();
        NativeToolCallParser.clearRawChunkState();

        // Cache model info once per API request
        this.cachedStreamingModel = this.api.getModel();
        const streamModelInfo = this.cachedStreamingModel.info;

        const streamProtocol = resolveToolProtocol(
          this.apiConfiguration,
          streamModelInfo,
        );

        const shouldUseXmlParser = streamProtocol === 'xml';

        // Create the API request stream
        const stream = this.attemptApiRequest();
        let reasoningMessage = '';
        let assistantMessage = '';
        this.isStreaming = true;

        // Variables for tracking stream status
        let chunkCount = 0;
        let hasReceivedContent = false;

        try {
          const iterator = stream[Symbol.asyncIterator]();

          let item = await iterator.next();
          while (!item.done) {
            const chunk = item.value;
            item = await iterator.next();

            if (!chunk) {
              continue;
            }

            chunkCount++;
            console.log(`Received chunk ${chunkCount}:`, chunk);

            // Track if we've received any meaningful content
            if (chunk.type === 'text' || chunk.type === 'reasoning' || chunk.type === 'tool_call' || chunk.type === 'tool_call_partial') {
              hasReceivedContent = true;
            }
            switch (chunk.type) {
              case 'usage':
                // Handle usage tracking (simplified)
                // Will be emitted as event for further process
                break;
              case 'tool_call_partial': {
                // Process raw tool call chunk through NativeToolCallParser
                const events = NativeToolCallParser.processRawChunk({
                  index: chunk.index,
                  id: chunk.id,
                  name: chunk.name,
                  arguments: chunk.arguments,
                });

                for (const event of events) {
                  if (event.type === 'tool_call_start') {
                    NativeToolCallParser.startStreamingToolCall(
                      event.id,
                      event.name as any,
                    );

                    const toolUseIndex = this.assistantMessageContent.length;
                    this.streamingToolCallIndices.set(event.id, toolUseIndex);

                    const partialToolUse: ToolUse = {
                      type: 'tool_use',
                      name: event.name as any,
                      params: {},
                      partial: true,
                      id: event.id,
                    };

                    console.debug(`partial_tool_use`, partialToolUse)

                    this.assistantMessageContent.push(partialToolUse);
                    this.userMessageContentReady = false;
                  } else if (event.type === 'tool_call_delta') {
                    const partialToolUse =
                      NativeToolCallParser.processStreamingChunk(
                        event.id,
                        (chunk as any).delta || '',
                      );

                    if (partialToolUse) {
                      const toolUseIndex = this.streamingToolCallIndices.get(
                        event.id,
                      );
                      if (toolUseIndex !== undefined) {
                        (partialToolUse as any).id = event.id;
                        this.assistantMessageContent[toolUseIndex] =
                          partialToolUse;
                      }
                      this.userMessageContentReady = false;
                    }
                  } else if (event.type === 'tool_call_end') {
                    const finalToolUse =
                      NativeToolCallParser.finalizeStreamingToolCall(event.id);

                    if (finalToolUse) {
                      const toolUseIndex = this.streamingToolCallIndices.get(
                        event.id,
                      );
                      if (toolUseIndex !== undefined) {
                        (finalToolUse as any).id = event.id;
                        this.assistantMessageContent[toolUseIndex] =
                          finalToolUse;
                      }
                      this.streamingToolCallIndices.delete(event.id);
                      this.userMessageContentReady = false;
                    }
                  }
                }
                break;
              }
              case 'tool_call': {
                // Handle complete tool calls (legacy)
                const toolUse = NativeToolCallParser.parseToolCall({
                  id: chunk.id,
                  name: chunk.name as any,
                  arguments: chunk.arguments,
                });

                if (toolUse) {
                  this.assistantMessageContent.push(toolUse);
                  this.userMessageContentReady = false;
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

                if (shouldUseXmlParser && this.assistantMessageParser) {
                  // XML protocol: Parse raw assistant message chunk into content blocks
                  const prevLength = this.assistantMessageContent.length;
                  this.assistantMessageContent =
                    this.assistantMessageParser.processChunk(chunk.text);

                  // console.debug(`assistantMessage:`, this.assistantMessageContent)

                  if (this.assistantMessageContent.length > prevLength) {
                    this.userMessageContentReady = false;
                  }
                } else {
                  // Native protocol: Text chunks are plain text
                  const lastBlock =
                    this.assistantMessageContent[
                    this.assistantMessageContent.length - 1
                    ];

                  if (lastBlock?.type === 'text' && lastBlock.partial) {
                    lastBlock.content = assistantMessage;
                    lastBlock.partial = true;
                    this.userMessageContentReady = false;
                  } else {
                    this.assistantMessageContent.push({
                      type: 'text',
                      content: assistantMessage,
                      partial: true,
                    });
                    this.userMessageContentReady = false;
                  }
                }
                break;
              }
            }

            if (
              (this._status as 'running' | 'completed' | 'aborted') ===
              'aborted'
            ) {
              break;
            }

            if (this.didRejectTool) {
              assistantMessage += '\n\n[Response interrupted by user feedback]';
              break;
            }

            if (this.didAlreadyUseTool) {
              assistantMessage +=
                '\n\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]';
              break;
            }
          }

          // Finalize any remaining streaming tool calls
          const finalizeEvents = NativeToolCallParser.finalizeRawChunks();
          for (const event of finalizeEvents) {
            if (event.type === 'tool_call_end') {
              const finalToolUse =
                NativeToolCallParser.finalizeStreamingToolCall(event.id);

              if (finalToolUse) {
                const toolUseIndex = this.streamingToolCallIndices.get(
                  event.id,
                );
                if (toolUseIndex !== undefined) {
                  (finalToolUse as any).id = event.id;
                  this.assistantMessageContent[toolUseIndex] = finalToolUse;
                }
                this.streamingToolCallIndices.delete(event.id);
                this.userMessageContentReady = false;
              }
            }
          }
        } finally {
          this.isStreaming = false;

          // Log streaming completion status
          if (chunkCount === 0) {
            console.warn('No chunks received from API stream');
          } else if (!hasReceivedContent) {
            console.warn(`Received ${chunkCount} chunks but no meaningful content`);
          } else {
            console.log(`Stream completed successfully with ${chunkCount} chunks`);
          }
        }

        this.didCompleteReadingStream = true;

        // Set any blocks to be complete
        const partialBlocks = this.assistantMessageContent.filter(
          (block) => block.partial,
        );
        partialBlocks.forEach((block) => (block.partial = false));

        // Finalize any remaining partial content blocks (XML protocol only)
        if (shouldUseXmlParser && this.assistantMessageParser) {
          this.assistantMessageParser.finalizeContentBlocks();
          const parsedBlocks = this.assistantMessageParser.getContentBlocks();
          this.assistantMessageContent = parsedBlocks;
        }

        // Add to apiConversationHistory
        const hasTextContent = assistantMessage.length > 0 || this.assistantMessageContent.some(
          (block) => block.type === 'text',
        );
        const HasReasoningContent = reasoningMessage.length > 0;
        const hasToolUses = this.assistantMessageContent.some(
          (block) => block.type === 'tool_use',
        );

        if (hasTextContent || hasToolUses || HasReasoningContent) {
          // Build the assistant message content array
          const assistantContent: Array<
            Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam
          > = [];

          if (assistantMessage) {
            assistantContent.push({
              type: 'text' as const,
              text: assistantMessage,
            });
          }

          const toolUseBlocks = this.assistantMessageContent.filter(
            (block) => block.type === 'tool_use',
          );
          for (const block of toolUseBlocks) {
            console.log(`detect tool calling: ${JSON.stringify(block)}`)
            const toolUse = block as ToolUse;
            const toolCallId = randomUUID();

            const input = toolUse.nativeArgs || toolUse.params;
            assistantContent.push({
              type: 'tool_use' as const,
              id: toolCallId,
              name: toolUse.name,
              input,
            });

            // Handle tool calling
            const toolCallRes = await this.toolCallHandler.handleToolCalling(toolUse.name as ToolName, input)
            console.log(`toolCallRes:${JSON.stringify(toolCallRes)}`)
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
                  resultText = toolCallRes.content.map(block => {
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
                  resultText = toolCallRes.map(block => {
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
                this.userMessageContent.push({
                  type: 'tool_result' as const,
                  tool_use_id: toolCallId,
                  content: resultText,
                });

                // Check if this is an attempt_completion tool call
                if (toolUse.name === 'attempt_completion') {
                  // For attempt_completion, don't push to stack for further processing
                  console.log('Tool call completed with attempt_completion, ending recursion');
                  this.didAttemptCompletion = true;
                }
              }
            }


          }

          await this.addToApiConversationHistory({
            role: 'assistant',
            content: assistantContent,
          });

          // Set user message content as ready since we've processed the stream
          this.userMessageContentReady = true;

          const didToolUse = hasToolUses;

          // Handle senario: LLM didn't use any tools
          if (!didToolUse) {
            const modelInfo = this.api.getModel().info;
            const toolProtocol = resolveToolProtocol(
              this.apiConfiguration,
              modelInfo,
            );
            this.userMessageContent.push({
              type: 'text',
              text: formatResponse.noToolsUsed(toolProtocol),
            });
            this.consecutiveMistakeCount++;
            throw new NoToolsUsedError()
          }

          // Handle scenario: user input new message
          // Only push to stack if not attempting completion
          if (this.userMessageContent.length > 0 && !this.didAttemptCompletion) {
            stack.push({
              userContent: [...this.userMessageContent],
            });
          }

          didEndLoop = true

        } else {
          // No assistant response - this is an error case
          const currentRetryAttempt = currentItem.retryAttempt ?? 0;
          const error = new NoApiResponseError(currentRetryAttempt + 1);
          this.collectedErrors.push(error);
          console.error(error.message);

          // Check if we've exceeded the maximum retry attempts
          if (currentRetryAttempt >= this.maxRetryAttempts) {
            console.error(`Maximum retry attempts (${this.maxRetryAttempts}) exceeded. Aborting.`);
            throw new MaxRetryExceededError(this.maxRetryAttempts, this.collectedErrors);
          }

          // Push the same content back onto the stack to retry
          console.log(`Retrying API request (attempt ${currentRetryAttempt + 2}/${this.maxRetryAttempts + 1})`);
          stack.push({
            userContent: currentUserContent,
            retryAttempt: currentRetryAttempt + 1,
          });
        }
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
      console.debug(`system prompt: ${systemPrompt}`)

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
    return SYSTEM_PROMPT();
  }

  private buildCleanConversationHistory(
    messages: any[],
  ): Anthropic.MessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const filteredContent = msg.content.filter(
          (block: any) =>
            block.type !== 'thinking' && block.type !== 'redacted_thinking',
        );
        return {
          ...msg,
          content: filteredContent as Anthropic.Messages.ContentBlockParam[],
        };
      }
      return msg as Anthropic.MessageParam;
    });
  }
}
