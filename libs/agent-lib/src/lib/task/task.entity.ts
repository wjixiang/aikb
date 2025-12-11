import { ApiHandler, buildApiHandler, type ApiStream } from 'llm-api';
import {
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ProviderSettings,
  ToolUsage,
  getApiProtocol,
  getModelId,
  ModelInfo,
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
import { ApiMessage } from './simplified-dependencies/taskPersistence';
import { AssistantMessageParser } from '../assistant-message/AssistantMessageParser';
import { SYSTEM_PROMPT } from './simplified-dependencies/systemPrompt';

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

  // LLM Messages & Chat Messages
  apiConversationHistory: ApiMessage[] = [];
  clineMessages: any[] = [];

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
  assistantMessageParser?: AssistantMessageParser;
  private providerProfileChangeListener?: (config: {
    name: string;
    provider?: string;
  }) => void;

  // Native tool call streaming state (track which index each tool is at)
  private streamingToolCallIndices: Map<string, number> = new Map();

  // Cached model info for current streaming session
  cachedStreamingModel?: { id: string; info: ModelInfo };

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
    interface StackItem {
      userContent: Anthropic.Messages.ContentBlockParam[];
      includeFileDetails: boolean;
      retryAttempt?: number;
      userMessageWasRemoved?: boolean;
    }

    const stack: StackItem[] = [
      { userContent, includeFileDetails, retryAttempt: 0 },
    ];

    while (stack.length > 0) {
      const currentItem = stack.pop()!;
      const currentUserContent = currentItem.userContent;
      const currentIncludeFileDetails = currentItem.includeFileDetails;
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
        // Simplified error handling - just reset count and continue
        console.warn('Consecutive mistake limit reached, resetting count');
        this.consecutiveMistakeCount = 0;
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
        let assistantMessage = '';
        this.isStreaming = true;

        try {
          const iterator = stream[Symbol.asyncIterator]();

          let item = await iterator.next();
          while (!item.done) {
            const chunk = item.value;
            item = await iterator.next();

            if (!chunk) {
              continue;
            }

            switch (chunk.type) {
              case 'usage':
                // Handle usage tracking (simplified)
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
              case 'text': {
                assistantMessage += chunk.text;

                if (shouldUseXmlParser && this.assistantMessageParser) {
                  // XML protocol: Parse raw assistant message chunk into content blocks
                  const prevLength = this.assistantMessageContent.length;
                  this.assistantMessageContent =
                    this.assistantMessageParser.processChunk(chunk.text);

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
        const hasTextContent = assistantMessage.length > 0;
        const hasToolUses = this.assistantMessageContent.some(
          (block) => block.type === 'tool_use',
        );

        if (hasTextContent || hasToolUses) {
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
            const toolUse = block as ToolUse;
            const toolCallId = toolUse.id;
            if (toolCallId) {
              const input = toolUse.nativeArgs || toolUse.params;
              assistantContent.push({
                type: 'tool_use' as const,
                id: toolCallId,
                name: toolUse.name,
                input,
              });
            }
          }

          await this.addToApiConversationHistory({
            role: 'assistant',
            content: assistantContent,
          });

          // Wait for user message content to be ready
          await this.waitForUserMessageContentReady();

          const didToolUse = hasToolUses;

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
          }

          if (this.userMessageContent.length > 0) {
            stack.push({
              userContent: [...this.userMessageContent],
              includeFileDetails: false,
            });
          } else {
            didEndLoop = true;
          }
        } else {
          // No assistant response - this is an error case
          console.error('No assistant response received from API');

          // Push the same content back onto the stack to retry
          stack.push({
            userContent: currentUserContent,
            includeFileDetails: false,
            retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
          });
        }
      } catch (error) {
        console.error('Error in recursivelyMakeClineRequests:', error);
        return true;
      }

      if (didEndLoop) {
        return true;
      }
    }

    return false;
  }

  private async waitForUserMessageContentReady(): Promise<void> {
    // Simple polling implementation
    const maxWaitTime = 30000; // 30 seconds max
    const pollInterval = 100; // 100ms intervals
    const startTime = Date.now();

    while (
      !this.userMessageContentReady &&
      Date.now() - startTime < maxWaitTime
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (!this.userMessageContentReady) {
      console.warn('Timeout waiting for user message content to be ready');
    }
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
    const systemPrompt = await this.getSystemPrompt();

    // Build clean conversation history
    const cleanConversationHistory = this.buildCleanConversationHistory(
      this.apiConversationHistory,
    );

    const metadata = {
      taskId: this.taskId,
    };

    const stream = this.api.createMessage(
      systemPrompt,
      cleanConversationHistory as unknown as Anthropic.MessageParam[],
      metadata,
    );

    return stream;
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
