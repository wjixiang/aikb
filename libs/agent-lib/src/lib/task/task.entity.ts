import { ApiHandler, buildApiHandler } from '../api';
import {
  DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
  ProviderSettings,
  ToolUsage,
  ClineAsk,
  ClineMessage,
  TokenUsage,
  ToolProgressStatus,
  getApiProtocol,
  getModelId,
  isIdleAsk,
  isInteractiveAsk,
  isNativeProtocol,
  isResumableAsk,
  ToolName,
  ClineSay,
  ContextCondense,
  ContextTruncation,
  ModelInfo,
} from '../types';
import Anthropic from '@anthropic-ai/sdk';
import { resolveToolProtocol } from '../utils/resolveToolProtocol';
import { formatResponse } from '../core/prompts/responses';
import { ClineAskResponse } from '../shared/WebviewMessage';
import {
  ClineApiReqCancelReason,
  ClineApiReqInfo,
} from '../shared/ExtensionMessage';
import { RooCodeEventName } from '../types/event.type';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { t } from 'i18next';
import { ApiStream, GroundingSource } from '../api/transform/stream';
import { AssistantMessageContent, presentAssistantMessage } from '../core/assistant-message';
import { NativeToolCallParser } from '../core/assistant-message/NativeToolCallParser';
import { checkAutoApproval } from '../core/auto-approval';
import { getEnvironmentDetails } from '../core/environment/getEnvironmentDetails';
import { processUserContentMentions } from '../core/mentions';
import { AskIgnoredError } from '../core/task/AskIgnoredError';
import { ClineProvider } from '../core/webview/ClineProvider';
import { findLastIndex } from '../shared/array';
import {
  calculateApiCostAnthropic,
  calculateApiCostOpenAI,
} from '../shared/cost';
import { ToolUse } from '../shared/tools';
import { combineCommandSequences } from "../shared/combineCommandSequences"
import { ApiMessage, saveTaskMessages } from '../core/task-persistence';
import { AssistantMessageParser } from '../core/assistant-message/AssistantMessageParser';
import { SYSTEM_PROMPT } from '../prompts/system';
import { getApiMetrics } from '../shared/getApiMetrics';
import { combineApiRequests } from '../shared/combineApiRequests';
import { getModelMaxOutputTokens } from '../shared/api';
import { manageContext, willManageContext } from '../core/context-management';

export class Task {
  readonly taskId: string;
  private _status: 'running' | 'completed' | 'aborted' = 'running';

  readonly instanceId: string;
  readonly rootTaskId?: string;
  readonly parentTaskId?: string;
  childTaskId?: string;
  pendingNewTaskToolCallId?: string;

  private api: ApiHandler;

  // providerRef: WeakRef<ClineProvider>

  // Tool Use
  consecutiveMistakeCount: number = 0;
  consecutiveMistakeLimit: number = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT;
  consecutiveMistakeCountForApplyDiff: Map<string, number> = new Map();
  toolUsage: ToolUsage = {};

  // LLM Messages & Chat Messages
  apiConversationHistory: ApiMessage[] = [];
  clineMessages: ClineMessage[] = [];

  // Ask
  private askResponse?: ClineAskResponse;
  private askResponseText?: string;
  private askResponseImages?: string[];
  public lastMessageTs?: number;

  // TaskStatus
  idleAsk?: ClineMessage;
  resumableAsk?: ClineMessage;
  interactiveAsk?: ClineMessage;

  didFinishAbortingStream = false;
  abandoned = false;
  abortReason?: ClineApiReqCancelReason;
  isInitialized = false;
  isPaused: boolean = false;

  // Streaming
	isWaitingForFirstChunk = false
	isStreaming = false
	currentStreamingContentIndex = 0
	currentStreamingDidCheckpoint = false
	assistantMessageContent: AssistantMessageContent[] = []
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false
	userMessageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam)[] = []
	userMessageContentReady = false
	didRejectTool = false
	didAlreadyUseTool = false
	didToolFailInCurrentTurn = false
	didCompleteReadingStream = false
	assistantMessageParser?: AssistantMessageParser
	private providerProfileChangeListener?: (config: { name: string; provider?: string }) => void

  // Native tool call streaming state (track which index each tool is at)
	private streamingToolCallIndices: Map<string, number> = new Map()

  // Cached model info for current streaming session (set at start of each API request)
	// This prevents excessive getModel() calls during tool execution
	cachedStreamingModel?: { id: string; info: ModelInfo }

  constructor(
    taskId: string,
    private apiConfiguration: ProviderSettings,
    consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
    private eventEmitter: EventEmitter2,
  ) {
    this.taskId = taskId;
    this.instanceId = crypto.randomUUID().slice(0, 8);

    this.api = buildApiHandler(apiConfiguration);
    // this.providerRef = new WeakRef(provider)
  }

  start() {
    this._status = 'running';
    return { event: 'task.started', data: { taskId: this.taskId } };
  }

  complete(tokenUsage: TokenUsage, toolUsage: ToolUsage) {
    this._status = 'completed';
    return {
      event: 'task.completed',
      data: { taskId: this.taskId, tokenUsage, toolUsage },
    };
  }

  abort() {
    this._status = 'aborted';
    return { event: 'task.aborted', data: { taskId: this.taskId } };
  }

  private async initiateTaskLoop(
    userContent: Anthropic.Messages.ContentBlockParam[],
  ): Promise<void> {
    // Kicks off the checkpoints initialization process in the background.
    // getCheckpointService(this)

    let nextUserContent = userContent;
    let includeFileDetails = true;

    // this.eventEmitter.emit(RooCodeEventName.TaskStarted);

    while (!(this._status === 'aborted')) {
      const didEndLoop = await this.recursivelyMakeClineRequests(
        nextUserContent,
        includeFileDetails,
      );
      includeFileDetails = false; // We only need file details the first time.

      // The way this agentic loop works is that cline will be given a
      // task that he then calls tools to complete. Unless there's an
      // attempt_completion call, we keep responding back to him with his
      // tool's responses until he either attempt_completion or does not
      // use anymore tools. If he does not use anymore tools, we ask him
      // to consider if he's completed the task and then call
      // attempt_completion, otherwise proceed with completing the task.
      // There is a MAX_REQUESTS_PER_TASK limit to prevent infinite
      // requests, but Cline is prompted to finish the task as efficiently
      // as he can.

      if (didEndLoop) {
        // For now a task never 'completes'. This will only happen if
        // the user hits max requests and denies resetting the count.
        break;
      } else {
        const modelInfo = this.api.getModel().info;
        // const state = await this.providerRef.deref()?.getState();
        const toolProtocol = resolveToolProtocol(
          this.apiConfiguration,
          modelInfo,
        );
        nextUserContent = [
          { type: 'text', text: formatResponse.noToolsUsed(toolProtocol) },
        ];
        this.consecutiveMistakeCount++;
      }
    }
  }

  public async recursivelyMakeClineRequests(
    userContent: Anthropic.Messages.ContentBlockParam[],
    includeFileDetails: boolean = false,
  ): Promise<boolean> {
    interface StackItem {
      userContent: Anthropic.Messages.ContentBlockParam[];
      includeFileDetails: boolean;
      retryAttempt?: number;
      userMessageWasRemoved?: boolean; // Track if user message was removed due to empty response
    }

    const stack: StackItem[] = [
      { userContent, includeFileDetails, retryAttempt: 0 },
    ];

    while (stack.length > 0) {
      const currentItem = stack.pop()!;
      const currentUserContent = currentItem.userContent;
      const currentIncludeFileDetails = currentItem.includeFileDetails;

      if (this._status === 'aborted') {
        throw new Error(
          `[RooCode#recursivelyMakeRooRequests] task ${this.taskId} aborted`,
        );
      }

      if (
        this.consecutiveMistakeCount > 0 &&
        this.consecutiveMistakeCount >= this.consecutiveMistakeLimit
      ) {
        const { response, text, images } = await this.ask(
          'mistake_limit_reached',
          t('common:errors.mistake_limit_guidance'),
        );

        if (response === 'messageResponse') {
          currentUserContent.push(
            ...[
              {
                type: 'text' as const,
                text: formatResponse.tooManyMistakes(text),
              },
              ...formatResponse.imageBlocks(images),
            ],
          );

          await this.say('user_feedback', text, images);

          // Track consecutive mistake errors in telemetry.
          // TelemetryService.instance.captureConsecutiveMistakeError(this.taskId);
        }

        this.consecutiveMistakeCount = 0;
      }

      // Getting verbose details is an expensive operation, it uses ripgrep to
      // top-down build file structure of project which for large projects can
      // take a few seconds. For the best UX we show a placeholder api_req_started
      // message with a loading spinner as this happens.

      // Determine API protocol based on provider and model
      const modelId = getModelId(this.apiConfiguration);
      const apiProtocol = getApiProtocol(
        this.apiConfiguration.apiProvider,
        modelId,
      );

      await this.say(
        'api_req_started',
        JSON.stringify({
          apiProtocol,
        }),
      );

      // const {
      //   showRooIgnoredFiles = false,
      //   includeDiagnosticMessages = true,
      //   maxDiagnosticMessages = 50,
      //   maxReadFileLine = -1,
      // } = (await this.providerRef.deref()?.getState()) ?? {};

      const parsedUserContent = await processUserContentMentions({
        userContent: currentUserContent
      });


      // Add environment details as its own text block, separate from tool
      // results.
      let finalUserContent = [
        ...parsedUserContent
      ];
      // Only add user message to conversation history if:
      // 1. This is the first attempt (retryAttempt === 0), AND
      // 2. The original userContent was not empty (empty signals delegation resume where
      //    the user message with tool_result and env details is already in history), OR
      // 3. The message was removed in a previous iteration (userMessageWasRemoved === true)
      // This prevents consecutive user messages while allowing re-add when needed
      const isEmptyUserContent = currentUserContent.length === 0;
      const shouldAddUserMessage =
        ((currentItem.retryAttempt ?? 0) === 0 && !isEmptyUserContent) ||
        currentItem.userMessageWasRemoved;
      if (shouldAddUserMessage) {
        await this.addToApiConversationHistory({
          role: 'user',
          content: finalUserContent,
        });
        // TelemetryService.instance.captureConversationMessage(
        //   this.taskId,
        //   'user',
        // );
      }

      // Since we sent off a placeholder api_req_started message to update the
      // webview while waiting to actually start the API request (to load
      // potential details for example), we need to update the text of that
      // message.
      const lastApiReqIndex = findLastIndex(
        this.clineMessages,
        (m) => m.say === 'api_req_started',
      );

      this.clineMessages[lastApiReqIndex].text = JSON.stringify({
        apiProtocol,
      } satisfies ClineApiReqInfo);

      await this.saveClineMessages();
      // await this.providerRef.deref()?.postStateToWebview();

      try {
        let cacheWriteTokens = 0;
        let cacheReadTokens = 0;
        let inputTokens = 0;
        let outputTokens = 0;
        let totalCost: number | undefined;

        // We can't use `api_req_finished` anymore since it's a unique case
        // where it could come after a streaming message (i.e. in the middle
        // of being updated or executed).
        // Fortunately `api_req_finished` was always parsed out for the GUI
        // anyways, so it remains solely for legacy purposes to keep track
        // of prices in tasks from history (it's worth removing a few months
        // from now).
        const updateApiReqMsg = (
          cancelReason?: ClineApiReqCancelReason,
          streamingFailedMessage?: string,
        ) => {
          if (lastApiReqIndex < 0 || !this.clineMessages[lastApiReqIndex]) {
            return;
          }

          const existingData = JSON.parse(
            this.clineMessages[lastApiReqIndex].text || '{}',
          );

          // Calculate total tokens and cost using provider-aware function
          const modelId = getModelId(this.apiConfiguration);
          const apiProtocol = getApiProtocol(
            this.apiConfiguration.apiProvider,
            modelId,
          );

          const costResult =
            apiProtocol === 'anthropic'
              ? calculateApiCostAnthropic(
                  streamModelInfo,
                  inputTokens,
                  outputTokens,
                  cacheWriteTokens,
                  cacheReadTokens,
                )
              : calculateApiCostOpenAI(
                  streamModelInfo,
                  inputTokens,
                  outputTokens,
                  cacheWriteTokens,
                  cacheReadTokens,
                );

          this.clineMessages[lastApiReqIndex].text = JSON.stringify({
            ...existingData,
            tokensIn: costResult.totalInputTokens,
            tokensOut: costResult.totalOutputTokens,
            cacheWrites: cacheWriteTokens,
            cacheReads: cacheReadTokens,
            cost: totalCost ?? costResult.totalCost,
            cancelReason,
            streamingFailedMessage,
          } satisfies ClineApiReqInfo);
        };

        const abortStream = async (
          cancelReason: ClineApiReqCancelReason,
          streamingFailedMessage?: string,
        ) => {
          

          // if last message is a partial we need to update and save it
          const lastMessage = this.clineMessages.at(-1);

          if (lastMessage && lastMessage.partial) {
            // lastMessage.ts = Date.now() DO NOT update ts since it is used as a key for virtuoso list
            lastMessage.partial = false;
            // instead of streaming partialMessage events, we do a save and post like normal to persist to disk
            console.log('updating partial message', lastMessage);
          }

          // Update `api_req_started` to have cancelled and cost, so that
          // we can display the cost of the partial stream and the cancellation reason
          updateApiReqMsg(cancelReason, streamingFailedMessage);
          await this.saveClineMessages();

          // Signals to provider that it can retrieve the saved messages
          // from disk, as abortTask can not be awaited on in nature.
          this.didFinishAbortingStream = true;
        };

        // Reset streaming state for each new API request
        this.currentStreamingContentIndex = 0;
        this.currentStreamingDidCheckpoint = false;
        this.assistantMessageContent = [];
        this.didCompleteReadingStream = false;
        this.userMessageContent = [];
        this.userMessageContentReady = false;
        this.didRejectTool = false;
        this.didAlreadyUseTool = false;

        
        // Reset tool failure flag for each new assistant turn - this ensures that tool failures
        // only prevent attempt_completion within the same assistant message, not across turns
        // (e.g., if a tool fails, then user sends a message saying "just complete anyway")
        this.didToolFailInCurrentTurn = false;
        this.presentAssistantMessageLocked = false;
        this.presentAssistantMessageHasPendingUpdates = false;
        this.assistantMessageParser?.reset();
        this.streamingToolCallIndices.clear();
        // Clear any leftover streaming tool call state from previous interrupted streams
        NativeToolCallParser.clearAllStreamingToolCalls();
        NativeToolCallParser.clearRawChunkState();

        

        // Cache model info once per API request to avoid repeated calls during streaming
        // This is especially important for tools and background usage collection
        this.cachedStreamingModel = this.api.getModel();
        const streamModelInfo = this.cachedStreamingModel.info;
        
        const streamProtocol = resolveToolProtocol(
          this.apiConfiguration,
          streamModelInfo,
        );
        const shouldUseXmlParser = streamProtocol === 'xml';

        // Yields only if the first chunk is successful, otherwise will
        // allow the user to retry the request (most likely due to rate
        // limit error, which gets thrown on the first chunk).
        const stream = this.attemptApiRequest();
        let assistantMessage = '';
        let reasoningMessage = '';
        let pendingGroundingSources: GroundingSource[] = [];
        this.isStreaming = true;

        try {
          const iterator = stream[Symbol.asyncIterator]();

          // Helper to race iterator.next() with abort signal
          const nextChunkWithAbort = async () => {
            const nextPromise = iterator.next();

            // If we have an abort controller, race it with the next chunk
            if (this.currentRequestAbortController) {
              const abortPromise = new Promise<never>((_, reject) => {
                const signal = this.currentRequestAbortController!.signal;
                if (signal.aborted) {
                  reject(new Error('Request cancelled by user'));
                } else {
                  signal.addEventListener('abort', () => {
                    reject(new Error('Request cancelled by user'));
                  });
                }
              });
              return await Promise.race([nextPromise, abortPromise]);
            }

            // No abort controller, just return the next chunk normally
            return await nextPromise;
          };

          let item = await nextChunkWithAbort();
          while (!item.done) {
            const chunk = item.value;
            item = await nextChunkWithAbort();
            if (!chunk) {
              // Sometimes chunk is undefined, no idea that can cause
              // it, but this workaround seems to fix it.
              continue;
            }

            switch (chunk.type) {
              case 'reasoning': {
                reasoningMessage += chunk.text;
                // Only apply formatting if the message contains sentence-ending punctuation followed by **
                let formattedReasoning = reasoningMessage;
                if (reasoningMessage.includes('**')) {
                  // Add line breaks before **Title** patterns that appear after sentence endings
                  // This targets section headers like "...end of sentence.**Title Here**"
                  // Handles periods, exclamation marks, and question marks
                  formattedReasoning = reasoningMessage.replace(
                    /([.!?])\*\*([^*\n]+)\*\*/g,
                    '$1\n\n**$2**',
                  );
                }
                await this.say(
                  'reasoning',
                  formattedReasoning,
                  undefined,
                  true,
                );
                break;
              }
              case 'usage':
                inputTokens += chunk.inputTokens;
                outputTokens += chunk.outputTokens;
                cacheWriteTokens += chunk.cacheWriteTokens ?? 0;
                cacheReadTokens += chunk.cacheReadTokens ?? 0;
                totalCost = chunk.totalCost;
                break;
              case 'grounding':
                // Handle grounding sources separately from regular content
                // to prevent state persistence issues - store them separately
                if (chunk.sources && chunk.sources.length > 0) {
                  pendingGroundingSources.push(...chunk.sources);
                }
                break;
              case 'tool_call_partial': {
                // Process raw tool call chunk through NativeToolCallParser
                // which handles tracking, buffering, and emits events
                const events = NativeToolCallParser.processRawChunk({
                  index: chunk.index,
                  id: chunk.id,
                  name: chunk.name,
                  arguments: chunk.arguments,
                });

                for (const event of events) {
                  if (event.type === 'tool_call_start') {
                    // Initialize streaming in NativeToolCallParser
                    NativeToolCallParser.startStreamingToolCall(
                      event.id,
                      event.name as ToolName,
                    );

                    // Before adding a new tool, finalize any preceding text block
                    // This prevents the text block from blocking tool presentation
                    const lastBlock =
                      this.assistantMessageContent[
                        this.assistantMessageContent.length - 1
                      ];
                    if (lastBlock?.type === 'text' && lastBlock.partial) {
                      lastBlock.partial = false;
                    }

                    // Track the index where this tool will be stored
                    const toolUseIndex = this.assistantMessageContent.length;
                    this.streamingToolCallIndices.set(event.id, toolUseIndex);

                    // Create initial partial tool use
                    const partialToolUse: ToolUse = {
                      type: 'tool_use',
                      name: event.name as ToolName,
                      params: {},
                      partial: true,
                    };

                    // Store the ID for native protocol
                    (partialToolUse as any).id = event.id;

                    // Add to content and present
                    this.assistantMessageContent.push(partialToolUse);
                    this.userMessageContentReady = false;
                    presentAssistantMessage(this);
                  } else if (event.type === 'tool_call_delta') {
                    // Process chunk using streaming JSON parser
                    const partialToolUse =
                      NativeToolCallParser.processStreamingChunk(
                        event.id,
                        event.delta,
                      );

                    if (partialToolUse) {
                      // Get the index for this tool call
                      const toolUseIndex = this.streamingToolCallIndices.get(
                        event.id,
                      );
                      if (toolUseIndex !== undefined) {
                        // Store the ID for native protocol
                        (partialToolUse as any).id = event.id;

                        // Update the existing tool use with new partial data
                        this.assistantMessageContent[toolUseIndex] =
                          partialToolUse;

                        // Present updated tool use
                        presentAssistantMessage(this);
                      }
                    }
                  } else if (event.type === 'tool_call_end') {
                    // Finalize the streaming tool call
                    const finalToolUse =
                      NativeToolCallParser.finalizeStreamingToolCall(event.id);

                    // Get the index for this tool call
                    const toolUseIndex = this.streamingToolCallIndices.get(
                      event.id,
                    );

                    if (finalToolUse) {
                      // Store the tool call ID
                      (finalToolUse as any).id = event.id;

                      // Get the index and replace partial with final
                      if (toolUseIndex !== undefined) {
                        this.assistantMessageContent[toolUseIndex] =
                          finalToolUse;
                      }

                      // Clean up tracking
                      this.streamingToolCallIndices.delete(event.id);

                      // Mark that we have new content to process
                      this.userMessageContentReady = false;

                      // Present the finalized tool call
                      presentAssistantMessage(this);
                    } else if (toolUseIndex !== undefined) {
                      // finalizeStreamingToolCall returned null (malformed JSON or missing args)
                      // We still need to mark the tool as non-partial so it gets executed
                      // The tool's validation will catch any missing required parameters
                      const existingToolUse =
                        this.assistantMessageContent[toolUseIndex];
                      if (
                        existingToolUse &&
                        existingToolUse.type === 'tool_use'
                      ) {
                        existingToolUse.partial = false;
                        // Ensure it has the ID for native protocol
                        (existingToolUse as any).id = event.id;
                      }

                      // Clean up tracking
                      this.streamingToolCallIndices.delete(event.id);

                      // Mark that we have new content to process
                      this.userMessageContentReady = false;

                      // Present the tool call - validation will handle missing params
                      presentAssistantMessage(this);
                    }
                  }
                }
                break;
              }

              case 'tool_call': {
                // Legacy: Handle complete tool calls (for backward compatibility)
                // Convert native tool call to ToolUse format
                const toolUse = NativeToolCallParser.parseToolCall({
                  id: chunk.id,
                  name: chunk.name as ToolName,
                  arguments: chunk.arguments,
                });

                if (!toolUse) {
                  console.error(
                    `Failed to parse tool call for task ${this.taskId}:`,
                    chunk,
                  );
                  break;
                }

                // Store the tool call ID on the ToolUse object for later reference
                // This is needed to create tool_result blocks that reference the correct tool_use_id
                toolUse.id = chunk.id;

                // Add the tool use to assistant message content
                this.assistantMessageContent.push(toolUse);

                // Mark that we have new content to process
                this.userMessageContentReady = false;

                // Present the tool call to user - presentAssistantMessage will execute
                // tools sequentially and accumulate all results in userMessageContent
                presentAssistantMessage(this);
                break;
              }
              case 'text': {
                assistantMessage += chunk.text;

                // Use the protocol determined at the start of streaming
                // Don't rely solely on parser existence - parser might exist from previous state
                if (shouldUseXmlParser && this.assistantMessageParser) {
                  // XML protocol: Parse raw assistant message chunk into content blocks
                  const prevLength = this.assistantMessageContent.length;
                  this.assistantMessageContent =
                    this.assistantMessageParser.processChunk(chunk.text);

                  if (this.assistantMessageContent.length > prevLength) {
                    // New content we need to present, reset to
                    // false in case previous content set this to true.
                    this.userMessageContentReady = false;
                  }

                  // Present content to user.
                  presentAssistantMessage(this);
                } else {
                  // Native protocol: Text chunks are plain text, not XML tool calls
                  // Create or update a text content block directly
                  const lastBlock =
                    this.assistantMessageContent[
                      this.assistantMessageContent.length - 1
                    ];

                  if (lastBlock?.type === 'text' && lastBlock.partial) {
                    // Update existing partial text block
                    lastBlock.content = assistantMessage;
                  } else {
                    // Create new text block
                    this.assistantMessageContent.push({
                      type: 'text',
                      content: assistantMessage,
                      partial: true,
                    });
                    this.userMessageContentReady = false;
                  }

                  // Present content to user
                  presentAssistantMessage(this);
                }
                break;
              }
            }

            if (this.abort) {
              console.log(
                `aborting stream, this.abandoned = ${this.abandoned}`,
              );

              if (!this.abandoned) {
                // Only need to gracefully abort if this instance
                // isn't abandoned (sometimes OpenRouter stream
                // hangs, in which case this would affect future
                // instances of Cline).
                await abortStream('user_cancelled');
              }

              break; // Aborts the stream.
            }

            if (this.didRejectTool) {
              // `userContent` has a tool rejection, so interrupt the
              // assistant's response to present the user's feedback.
              assistantMessage += '\n\n[Response interrupted by user feedback]';
              // Instead of setting this preemptively, we allow the
              // present iterator to finish and set
              // userMessageContentReady when its ready.
              // this.userMessageContentReady = true
              break;
            }

            if (this.didAlreadyUseTool) {
              assistantMessage +=
                '\n\n[Response interrupted by a tool use result. Only one tool may be used at a time and should be placed at the end of the message.]';
              break;
            }
          }

          // Finalize any remaining streaming tool calls that weren't explicitly ended
          // This is critical for MCP tools which need tool_call_end events to be properly
          // converted from ToolUse to McpToolUse via finalizeStreamingToolCall()
          const finalizeEvents = NativeToolCallParser.finalizeRawChunks();
          for (const event of finalizeEvents) {
            if (event.type === 'tool_call_end') {
              // Finalize the streaming tool call
              const finalToolUse =
                NativeToolCallParser.finalizeStreamingToolCall(event.id);

              // Get the index for this tool call
              const toolUseIndex = this.streamingToolCallIndices.get(event.id);

              if (finalToolUse) {
                // Store the tool call ID
                (finalToolUse as any).id = event.id;

                // Get the index and replace partial with final
                if (toolUseIndex !== undefined) {
                  this.assistantMessageContent[toolUseIndex] = finalToolUse;
                }

                // Clean up tracking
                this.streamingToolCallIndices.delete(event.id);

                // Mark that we have new content to process
                this.userMessageContentReady = false;

                // Present the finalized tool call
                presentAssistantMessage(this);
              } else if (toolUseIndex !== undefined) {
                // finalizeStreamingToolCall returned null (malformed JSON or missing args)
                // We still need to mark the tool as non-partial so it gets executed
                // The tool's validation will catch any missing required parameters
                const existingToolUse =
                  this.assistantMessageContent[toolUseIndex];
                if (existingToolUse && existingToolUse.type === 'tool_use') {
                  existingToolUse.partial = false;
                  // Ensure it has the ID for native protocol
                  (existingToolUse as any).id = event.id;
                }

                // Clean up tracking
                this.streamingToolCallIndices.delete(event.id);

                // Mark that we have new content to process
                this.userMessageContentReady = false;

                // Present the tool call - validation will handle missing params
                presentAssistantMessage(this);
              }
            }
          }

          // Create a copy of current token values to avoid race conditions
          const currentTokens = {
            input: inputTokens,
            output: outputTokens,
            cacheWrite: cacheWriteTokens,
            cacheRead: cacheReadTokens,
            total: totalCost,
          };

          const drainStreamInBackgroundToFindAllUsage = async (
            apiReqIndex: number,
          ) => {
            const timeoutMs = DEFAULT_USAGE_COLLECTION_TIMEOUT_MS;
            const startTime = performance.now();
            const modelId = getModelId(this.apiConfiguration);

            // Local variables to accumulate usage data without affecting the main flow
            let bgInputTokens = currentTokens.input;
            let bgOutputTokens = currentTokens.output;
            let bgCacheWriteTokens = currentTokens.cacheWrite;
            let bgCacheReadTokens = currentTokens.cacheRead;
            let bgTotalCost = currentTokens.total;

            // Helper function to capture telemetry and update messages
            const captureUsageData = async (
              tokens: {
                input: number;
                output: number;
                cacheWrite: number;
                cacheRead: number;
                total?: number;
              },
              messageIndex: number = apiReqIndex,
            ) => {
              if (
                tokens.input > 0 ||
                tokens.output > 0 ||
                tokens.cacheWrite > 0 ||
                tokens.cacheRead > 0
              ) {
                // Update the shared variables atomically
                inputTokens = tokens.input;
                outputTokens = tokens.output;
                cacheWriteTokens = tokens.cacheWrite;
                cacheReadTokens = tokens.cacheRead;
                totalCost = tokens.total;

                // Update the API request message with the latest usage data
                updateApiReqMsg();
                await this.saveClineMessages();

                // Update the specific message in the webview
                const apiReqMessage = this.clineMessages[messageIndex];
                if (apiReqMessage) {
                  await this.updateClineMessage(apiReqMessage);
                }

                // Capture telemetry with provider-aware cost calculation
                const modelId = getModelId(this.apiConfiguration);
                const apiProtocol = getApiProtocol(
                  this.apiConfiguration.apiProvider,
                  modelId,
                );

                // Use the appropriate cost function based on the API protocol
                const costResult =
                  apiProtocol === 'anthropic'
                    ? calculateApiCostAnthropic(
                        streamModelInfo,
                        tokens.input,
                        tokens.output,
                        tokens.cacheWrite,
                        tokens.cacheRead,
                      )
                    : calculateApiCostOpenAI(
                        streamModelInfo,
                        tokens.input,
                        tokens.output,
                        tokens.cacheWrite,
                        tokens.cacheRead,
                      );

                TelemetryService.instance.captureLlmCompletion(this.taskId, {
                  inputTokens: costResult.totalInputTokens,
                  outputTokens: costResult.totalOutputTokens,
                  cacheWriteTokens: tokens.cacheWrite,
                  cacheReadTokens: tokens.cacheRead,
                  cost: tokens.total ?? costResult.totalCost,
                });
              }
            };

            try {
              // Continue processing the original stream from where the main loop left off
              let usageFound = false;
              let chunkCount = 0;

              // Use the same iterator that the main loop was using
              while (!item.done) {
                // Check for timeout
                if (performance.now() - startTime > timeoutMs) {
                  console.warn(
                    `[Background Usage Collection] Timed out after ${timeoutMs}ms for model: ${modelId}, processed ${chunkCount} chunks`,
                  );
                  // Clean up the iterator before breaking
                  if (iterator.return) {
                    await iterator.return(undefined);
                  }
                  break;
                }

                const chunk = item.value;
                item = await iterator.next();
                chunkCount++;

                if (chunk && chunk.type === 'usage') {
                  usageFound = true;
                  bgInputTokens += chunk.inputTokens;
                  bgOutputTokens += chunk.outputTokens;
                  bgCacheWriteTokens += chunk.cacheWriteTokens ?? 0;
                  bgCacheReadTokens += chunk.cacheReadTokens ?? 0;
                  bgTotalCost = chunk.totalCost;
                }
              }

              if (
                usageFound ||
                bgInputTokens > 0 ||
                bgOutputTokens > 0 ||
                bgCacheWriteTokens > 0 ||
                bgCacheReadTokens > 0
              ) {
                // We have usage data either from a usage chunk or accumulated tokens
                await captureUsageData(
                  {
                    input: bgInputTokens,
                    output: bgOutputTokens,
                    cacheWrite: bgCacheWriteTokens,
                    cacheRead: bgCacheReadTokens,
                    total: bgTotalCost,
                  },
                  lastApiReqIndex,
                );
              } else {
                console.warn(
                  `[Background Usage Collection] Suspicious: request ${apiReqIndex} is complete, but no usage info was found. Model: ${modelId}`,
                );
              }
            } catch (error) {
              console.error('Error draining stream for usage data:', error);
              // Still try to capture whatever usage data we have collected so far
              if (
                bgInputTokens > 0 ||
                bgOutputTokens > 0 ||
                bgCacheWriteTokens > 0 ||
                bgCacheReadTokens > 0
              ) {
                await captureUsageData(
                  {
                    input: bgInputTokens,
                    output: bgOutputTokens,
                    cacheWrite: bgCacheWriteTokens,
                    cacheRead: bgCacheReadTokens,
                    total: bgTotalCost,
                  },
                  lastApiReqIndex,
                );
              }
            }
          };

          // Start the background task and handle any errors
          drainStreamInBackgroundToFindAllUsage(lastApiReqIndex).catch(
            (error) => {
              console.error('Background usage collection failed:', error);
            },
          );
        } catch (error) {
          // Abandoned happens when extension is no longer waiting for the
          // Cline instance to finish aborting (error is thrown here when
          // any function in the for loop throws due to this.abort).
          if (!this.abandoned) {
            // Determine cancellation reason
            const cancelReason: ClineApiReqCancelReason = this.abort
              ? 'user_cancelled'
              : 'streaming_failed';

            const streamingFailedMessage = this.abort
              ? undefined
              : (error.message ??
                JSON.stringify(serializeError(error), null, 2));

            // Clean up partial state
            await abortStream(cancelReason, streamingFailedMessage);

            if (this.abort) {
              // User cancelled - abort the entire task
              this.abortReason = cancelReason;
              await this.abortTask();
            } else {
              // Stream failed - log the error and retry with the same content
              // The existing rate limiting will prevent rapid retries
              console.error(
                `[Task#${this.taskId}.${this.instanceId}] Stream failed, will retry: ${streamingFailedMessage}`,
              );

              // Apply exponential backoff similar to first-chunk errors when auto-resubmit is enabled
              const stateForBackoff = await this.providerRef
                .deref()
                ?.getState();
              if (
                stateForBackoff?.autoApprovalEnabled &&
                stateForBackoff?.alwaysApproveResubmit
              ) {
                await this.backoffAndAnnounce(
                  currentItem.retryAttempt ?? 0,
                  error,
                  streamingFailedMessage,
                );

                // Check if task was aborted during the backoff
                if (this.abort) {
                  console.log(
                    `[Task#${this.taskId}.${this.instanceId}] Task aborted during mid-stream retry backoff`,
                  );
                  // Abort the entire task
                  this.abortReason = 'user_cancelled';
                  await this.abortTask();
                  break;
                }
              }

              // Push the same content back onto the stack to retry, incrementing the retry attempt counter
              stack.push({
                userContent: currentUserContent,
                includeFileDetails: false,
                retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
              });

              // Continue to retry the request
              continue;
            }
          }
        } finally {
          this.isStreaming = false;
          // Clean up the abort controller when streaming completes
          this.currentRequestAbortController = undefined;
        }

        // Need to call here in case the stream was aborted.
        if (this.abort || this.abandoned) {
          throw new Error(
            `[RooCode#recursivelyMakeRooRequests] task ${this.taskId}.${this.instanceId} aborted`,
          );
        }

        this.didCompleteReadingStream = true;

        // Set any blocks to be complete to allow `presentAssistantMessage`
        // to finish and set `userMessageContentReady` to true.
        // (Could be a text block that had no subsequent tool uses, or a
        // text block at the very end, or an invalid tool use, etc. Whatever
        // the case, `presentAssistantMessage` relies on these blocks either
        // to be completed or the user to reject a block in order to proceed
        // and eventually set userMessageContentReady to true.)
        const partialBlocks = this.assistantMessageContent.filter(
          (block) => block.partial,
        );
        partialBlocks.forEach((block) => (block.partial = false));

        // Can't just do this b/c a tool could be in the middle of executing.
        // this.assistantMessageContent.forEach((e) => (e.partial = false))

        // Now that the stream is complete, finalize any remaining partial content blocks (XML protocol only)
        // Use the protocol determined at the start of streaming
        if (shouldUseXmlParser && this.assistantMessageParser) {
          this.assistantMessageParser.finalizeContentBlocks();
          const parsedBlocks = this.assistantMessageParser.getContentBlocks();
          // For XML protocol: Use only parsed blocks (includes both text and tool_use parsed from XML)
          this.assistantMessageContent = parsedBlocks;
        }

        // Present any partial blocks that were just completed
        // For XML protocol: includes both text and tool_use blocks parsed from the text stream
        // For native protocol: tool_use blocks were already presented during streaming via
        // tool_call_partial events, but we still need to present them if they exist (e.g., malformed)
        if (partialBlocks.length > 0) {
          // If there is content to update then it will complete and
          // update `this.userMessageContentReady` to true, which we
          // `pWaitFor` before making the next request.
          presentAssistantMessage(this);
        }

        // Note: updateApiReqMsg() is now called from within drainStreamInBackgroundToFindAllUsage
        // to ensure usage data is captured even when the stream is interrupted. The background task
        // uses local variables to accumulate usage data before atomically updating the shared state.

        // Complete the reasoning message if it exists
        // We can't use say() here because the reasoning message may not be the last message
        // (other messages like text blocks or tool uses may have been added after it during streaming)
        if (reasoningMessage) {
          const lastReasoningIndex = findLastIndex(
            this.clineMessages,
            (m) => m.type === 'say' && m.say === 'reasoning',
          );

          if (
            lastReasoningIndex !== -1 &&
            this.clineMessages[lastReasoningIndex].partial
          ) {
            this.clineMessages[lastReasoningIndex].partial = false;
            await this.updateClineMessage(
              this.clineMessages[lastReasoningIndex],
            );
          }
        }

        await this.saveClineMessages();
        await this.providerRef.deref()?.postStateToWebview();

        // Reset parser after each complete conversation round (XML protocol only)
        this.assistantMessageParser?.reset();

        // Now add to apiConversationHistory.
        // Need to save assistant responses to file before proceeding to
        // tool use since user can exit at any moment and we wouldn't be
        // able to save the assistant's response.
        let didEndLoop = false;

        // Check if we have any content to process (text or tool uses)
        const hasTextContent = assistantMessage.length > 0;
        const hasToolUses = this.assistantMessageContent.some(
          (block) => block.type === 'tool_use' || block.type === 'mcp_tool_use',
        );

        if (hasTextContent || hasToolUses) {
          // Display grounding sources to the user if they exist
          if (pendingGroundingSources.length > 0) {
            const citationLinks = pendingGroundingSources.map(
              (source, i) => `[${i + 1}](${source.url})`,
            );
            const sourcesText = `${t('common:gemini.sources')} ${citationLinks.join(', ')}`;

            await this.say(
              'text',
              sourcesText,
              undefined,
              false,
              undefined,
              undefined,
              {
                isNonInteractive: true,
              },
            );
          }

          // Build the assistant message content array
          const assistantContent: Array<
            Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam
          > = [];

          // Add text content if present
          if (assistantMessage) {
            assistantContent.push({
              type: 'text' as const,
              text: assistantMessage,
            });
          }

          // Add tool_use blocks with their IDs for native protocol
          // This handles both regular ToolUse and McpToolUse types
          const toolUseBlocks = this.assistantMessageContent.filter(
            (block) =>
              block.type === 'tool_use' || block.type === 'mcp_tool_use',
          );
          for (const block of toolUseBlocks) {
            if (block.type === 'mcp_tool_use') {
              // McpToolUse already has the original tool name (e.g., "mcp_serverName_toolName")
              // The arguments are the raw tool arguments (matching the simplified schema)
              const mcpBlock = block as import('../../shared/tools').McpToolUse;
              if (mcpBlock.id) {
                assistantContent.push({
                  type: 'tool_use' as const,
                  id: mcpBlock.id,
                  name: mcpBlock.name, // Original dynamic name
                  input: mcpBlock.arguments, // Direct tool arguments
                });
              }
            } else {
              // Regular ToolUse
              const toolUse = block as import('../../shared/tools').ToolUse;
              const toolCallId = toolUse.id;
              if (toolCallId) {
                // nativeArgs is already in the correct API format for all tools
                const input = toolUse.nativeArgs || toolUse.params;

                assistantContent.push({
                  type: 'tool_use' as const,
                  id: toolCallId,
                  name: toolUse.name,
                  input,
                });
              }
            }
          }

          await this.addToApiConversationHistory(
            {
              role: 'assistant',
              content: assistantContent,
            },
            reasoningMessage || undefined,
          );

          TelemetryService.instance.captureConversationMessage(
            this.taskId,
            'assistant',
          );

          // NOTE: This comment is here for future reference - this was a
          // workaround for `userMessageContent` not getting set to true.
          // It was due to it not recursively calling for partial blocks
          // when `didRejectTool`, so it would get stuck waiting for a
          // partial block to complete before it could continue.
          // In case the content blocks finished it may be the api stream
          // finished after the last parsed content block was executed, so
          // we are able to detect out of bounds and set
          // `userMessageContentReady` to true (note you should not call
          // `presentAssistantMessage` since if the last block i
          //  completed it will be presented again).
          // const completeBlocks = this.assistantMessageContent.filter((block) => !block.partial) // If there are any partial blocks after the stream ended we can consider them invalid.
          // if (this.currentStreamingContentIndex >= completeBlocks.length) {
          // 	this.userMessageContentReady = true
          // }

          await pWaitFor(() => this.userMessageContentReady);

          // If the model did not tool use, then we need to tell it to
          // either use a tool or attempt_completion.
          const didToolUse = this.assistantMessageContent.some(
            (block) =>
              block.type === 'tool_use' || block.type === 'mcp_tool_use',
          );

          if (!didToolUse) {
            const modelInfo = this.api.getModel().info;
            const state = await this.providerRef.deref()?.getState();
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

          // Push to stack if there's content OR if we're paused waiting for a subtask.
          // When paused, we push an empty item so the loop continues to the pause check.
          if (this.userMessageContent.length > 0 || this.isPaused) {
            stack.push({
              userContent: [...this.userMessageContent], // Create a copy to avoid mutation issues
              includeFileDetails: false, // Subsequent iterations don't need file details
            });

            // Add periodic yielding to prevent blocking
            await new Promise((resolve) => setImmediate(resolve));
          }
          // Continue to next iteration instead of setting didEndLoop from recursive call
          continue;
        } else {
          // If there's no assistant_responses, that means we got no text
          // or tool_use content blocks from API which we should assume is
          // an error.

          // IMPORTANT: For native tool protocol, we already added the user message to
          // apiConversationHistory at line 1876. Since the assistant failed to respond,
          // we need to remove that message before retrying to avoid having two consecutive
          // user messages (which would cause tool_result validation errors).
          let state = await this.providerRef.deref()?.getState();
          if (
            isNativeProtocol(
              resolveToolProtocol(
                this.apiConfiguration,
                this.api.getModel().info,
              ),
            ) &&
            this.apiConversationHistory.length > 0
          ) {
            const lastMessage =
              this.apiConversationHistory[
                this.apiConversationHistory.length - 1
              ];
            if (lastMessage.role === 'user') {
              // Remove the last user message that we added earlier
              this.apiConversationHistory.pop();
            }
          }

          // Check if we should auto-retry or prompt the user
          // Reuse the state variable from above
          if (state?.autoApprovalEnabled && state?.alwaysApproveResubmit) {
            // Auto-retry with backoff - don't persist failure message when retrying
            const errorMsg =
              "Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.";

            await this.backoffAndAnnounce(
              currentItem.retryAttempt ?? 0,
              new Error('Empty assistant response'),
              errorMsg,
            );

            // Check if task was aborted during the backoff
            if (this.abort) {
              console.log(
                `[Task#${this.taskId}.${this.instanceId}] Task aborted during empty-assistant retry backoff`,
              );
              break;
            }

            // Push the same content back onto the stack to retry, incrementing the retry attempt counter
            // Mark that user message was removed so it gets re-added on retry
            stack.push({
              userContent: currentUserContent,
              includeFileDetails: false,
              retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
              userMessageWasRemoved: true,
            });

            // Continue to retry the request
            continue;
          } else {
            // Prompt the user for retry decision
            const { response } = await this.ask(
              'api_req_failed',
              "The model returned no assistant messages. This may indicate an issue with the API or the model's output.",
            );

            if (response === 'yesButtonClicked') {
              await this.say('api_req_retried');

              // Push the same content back to retry
              stack.push({
                userContent: currentUserContent,
                includeFileDetails: false,
                retryAttempt: (currentItem.retryAttempt ?? 0) + 1,
              });

              // Continue to retry the request
              continue;
            } else {
              // User declined to retry
              // For native protocol, re-add the user message we removed
              // Reuse the state variable from above
              if (
                isNativeProtocol(
                  resolveToolProtocol(
                    this.apiConfiguration,
                    this.api.getModel().info,
                  ),
                )
              ) {
                await this.addToApiConversationHistory({
                  role: 'user',
                  content: currentUserContent,
                });
              }

              await this.say(
                'error',
                "Unexpected API Response: The language model did not provide any assistant messages. This may indicate an issue with the API or the model's output.",
              );

              await this.addToApiConversationHistory({
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: 'Failure: I did not provide a response.',
                  },
                ],
              });
            }
          }
        }

        // If we reach here without continuing, return false (will always be false for now)
        return false;
      } catch (error) {
        // This should never happen since the only thing that can throw an
        // error is the attemptApiRequest, which is wrapped in a try catch
        // that sends an ask where if noButtonClicked, will clear current
        // task and destroy this instance. However to avoid unhandled
        // promise rejection, we will end this loop which will end execution
        // of this instance (see `startTask`).
        return true; // Needs to be true so parent loop knows to end task.
      }
    }

    // If we exit the while loop normally (stack is empty), return false
    return false;
  }

  public getTokenUsage(): TokenUsage {
		return getApiMetrics(this.combineMessages(this.clineMessages.slice(1)))
	}

  public combineMessages(messages: ClineMessage[]) {
		return combineApiRequests(combineCommandSequences(messages))
	}


  // Cline Messages

  private async getSavedClineMessages(): Promise<ClineMessage[]> {
    console.warn(`getSavedClineMessages not implemented`);
    // return readTaskMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
    return [];
  }

  private async addToClineMessages(message: ClineMessage) {
    this.clineMessages.push(message);
    // const provider = this.providerRef.deref()
    // await provider?.postStateToWebview()
    this.eventEmitter.emit(RooCodeEventName.Message, {
      action: 'created',
      message,
    });
    await this.saveClineMessages();
  }

  public async overwriteClineMessages(newMessages: ClineMessage[]) {
    // this.clineMessages = newMessages
    // restoreTodoListForTask(this)
    // await this.saveClineMessages()
  }

  private async updateClineMessage(message: ClineMessage) {
    // const provider = this.providerRef.deref()
    // await provider?.postMessageToWebview({ type: "messageUpdated", clineMessage: message })
    this.eventEmitter.emit(RooCodeEventName.Message, {
      action: 'updated',
      message,
    });
  }

  private async saveClineMessages() {
    // try {
    // 	await saveTaskMessages({
    // 		messages: this.clineMessages,
    // 		taskId: this.taskId,
    // 		globalStoragePath: this.globalStoragePath,
    // 	})
    // 	const { historyItem, tokenUsage } = await taskMetadata({
    // 		taskId: this.taskId,
    // 		rootTaskId: this.rootTaskId,
    // 		parentTaskId: this.parentTaskId,
    // 		taskNumber: this.taskNumber,
    // 		messages: this.clineMessages,
    // 		globalStoragePath: this.globalStoragePath,
    // 		workspace: this.cwd,
    // 		mode: this._taskMode || defaultModeSlug, // Use the task's own mode, not the current provider mode.
    // 		initialStatus: this.initialStatus,
    // 	})
    // 	// Emit token/tool usage updates using debounced function
    // 	// The debounce with maxWait ensures:
    // 	// - Immediate first emit (leading: true)
    // 	// - At most one emit per interval during rapid updates (maxWait)
    // 	// - Final state is emitted when updates stop (trailing: true)
    // 	this.debouncedEmitTokenUsage(tokenUsage, this.toolUsage)
    // 	await this.providerRef.deref()?.updateTaskHistory(historyItem)
    // } catch (error) {
    // 	console.error("Failed to save Roo messages:", error)
    // }
  }

  private findMessageByTimestamp(ts: number): ClineMessage | undefined {
    for (let i = this.clineMessages.length - 1; i >= 0; i--) {
      if (this.clineMessages[i].ts === ts) {
        return this.clineMessages[i];
      }
    }

    return undefined;
  }


  // API Messages

	private async getSavedApiConversationHistory(): Promise<ApiMessage[]> {
		// return readApiMessages({ taskId: this.taskId, globalStoragePath: this.globalStoragePath })
    console.warn(`getSavedApiConversationHistory not implemented`)
    return []
	}

	private async addToApiConversationHistory(message: Anthropic.MessageParam, reasoning?: string) {
		// Capture the encrypted_content / thought signatures from the provider (e.g., OpenAI Responses API, Google GenAI) if present.
		// We only persist data reported by the current response body.
		const handler = this.api as ApiHandler & {
			getResponseId?: () => string | undefined
			getEncryptedContent?: () => { encrypted_content: string; id?: string } | undefined
			getThoughtSignature?: () => string | undefined
			getSummary?: () => any[] | undefined
			getReasoningDetails?: () => any[] | undefined
		}

		if (message.role === "assistant") {
			const responseId = handler.getResponseId?.()
			const reasoningData = handler.getEncryptedContent?.()
			const thoughtSignature = handler.getThoughtSignature?.()
			const reasoningSummary = handler.getSummary?.()
			const reasoningDetails = handler.getReasoningDetails?.()

			// Start from the original assistant message
			const messageWithTs: any = {
				...message,
				...(responseId ? { id: responseId } : {}),
				ts: Date.now(),
			}

			// Store reasoning_details array if present (for models like Gemini 3)
			if (reasoningDetails) {
				messageWithTs.reasoning_details = reasoningDetails
			}

			// Store reasoning: plain text (most providers) or encrypted (OpenAI Native)
			// Skip if reasoning_details already contains the reasoning (to avoid duplication)
			if (reasoning && !reasoningDetails) {
				const reasoningBlock = {
					type: "reasoning",
					text: reasoning,
					summary: reasoningSummary ?? ([] as any[]),
				}

				if (typeof messageWithTs.content === "string") {
					messageWithTs.content = [
						reasoningBlock,
						{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
					]
				} else if (Array.isArray(messageWithTs.content)) {
					messageWithTs.content = [reasoningBlock, ...messageWithTs.content]
				} else if (!messageWithTs.content) {
					messageWithTs.content = [reasoningBlock]
				}
			} else if (reasoningData?.encrypted_content) {
				// OpenAI Native encrypted reasoning
				const reasoningBlock = {
					type: "reasoning",
					summary: [] as any[],
					encrypted_content: reasoningData.encrypted_content,
					...(reasoningData.id ? { id: reasoningData.id } : {}),
				}

				if (typeof messageWithTs.content === "string") {
					messageWithTs.content = [
						reasoningBlock,
						{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
					]
				} else if (Array.isArray(messageWithTs.content)) {
					messageWithTs.content = [reasoningBlock, ...messageWithTs.content]
				} else if (!messageWithTs.content) {
					messageWithTs.content = [reasoningBlock]
				}
			}

			// If we have a thought signature, append it as a dedicated content block
			// so it can be round-tripped in api_history.json and re-sent on subsequent calls.
			if (thoughtSignature) {
				const thoughtSignatureBlock = {
					type: "thoughtSignature",
					thoughtSignature,
				}

				if (typeof messageWithTs.content === "string") {
					messageWithTs.content = [
						{ type: "text", text: messageWithTs.content } satisfies Anthropic.Messages.TextBlockParam,
						thoughtSignatureBlock,
					]
				} else if (Array.isArray(messageWithTs.content)) {
					messageWithTs.content = [...messageWithTs.content, thoughtSignatureBlock]
				} else if (!messageWithTs.content) {
					messageWithTs.content = [thoughtSignatureBlock]
				}
			}

			this.apiConversationHistory.push(messageWithTs)
		} else {
			const messageWithTs = { ...message, ts: Date.now() }
			this.apiConversationHistory.push(messageWithTs)
		}

		await this.saveApiConversationHistory()
	}

	async overwriteApiConversationHistory(newHistory: ApiMessage[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

  private async saveApiConversationHistory() {
		try {
      console.warn(`saveApiConversationHistory not implemented`)
			// await saveApiMessages({
			// 	messages: this.apiConversationHistory,
			// 	taskId: this.taskId,
			// 	globalStoragePath: this.globalStoragePath,
			// })
		} catch (error) {
			// In the off chance this fails, we don't want to stop the task.
			console.error("Failed to save API conversation history:", error)
		}
	}



  // Note that `partial` has three valid states true (partial message),
  // false (completion of partial message), undefined (individual complete
  // message).
  async ask(
    type: ClineAsk,
    text?: string,
    partial?: boolean,
    progressStatus?: ToolProgressStatus,
    isProtected?: boolean,
  ): Promise<{ response: ClineAskResponse; text?: string; images?: string[] }> {
    // If this Cline instance was aborted by the provider, then the only
    // thing keeping us alive is a promise still running in the background,
    // in which case we don't want to send its result to the webview as it
    // is attached to a new instance of Cline now. So we can safely ignore
    // the result of any active promises, and this class will be
    // deallocated. (Although we set Cline = undefined in provider, that
    // simply removes the reference to this instance, but the instance is
    // still alive until this promise resolves or rejects.)
    if (!(this._status === 'aborted')) {
      throw new Error(
        `[RooCode#ask] task ${this.taskId}.${this.instanceId} aborted`,
      );
    }

    let askTs: number;

    if (partial !== undefined) {
      const lastMessage = this.clineMessages.at(-1);

      const isUpdatingPreviousPartial =
        lastMessage &&
        lastMessage.partial &&
        lastMessage.type === 'ask' &&
        lastMessage.ask === type;

      if (partial) {
        if (isUpdatingPreviousPartial) {
          // Existing partial message, so update it.
          lastMessage.text = text;
          lastMessage.partial = partial;
          lastMessage.progressStatus = progressStatus;
          lastMessage.isProtected = isProtected;
          // TODO: Be more efficient about saving and posting only new
          // data or one whole message at a time so ignore partial for
          // saves, and only post parts of partial message instead of
          // whole array in new listener.
          this.updateClineMessage(lastMessage);
          // console.log("Task#ask: current ask promise was ignored (#1)")
          throw new AskIgnoredError('updating existing partial');
        } else {
          // This is a new partial message, so add it with partial
          // state.
          askTs = Date.now();
          this.lastMessageTs = askTs;
          console.log(`Task#ask: new partial ask -> ${type} @ ${askTs}`);
          await this.addToClineMessages({
            ts: askTs,
            type: 'ask',
            ask: type,
            text,
            partial,
            isProtected,
          });
          // console.log("Task#ask: current ask promise was ignored (#2)")
          throw new AskIgnoredError('new partial');
        }
      } else {
        if (isUpdatingPreviousPartial) {
          // This is the complete version of a previously partial
          // message, so replace the partial with the complete version.
          this.askResponse = undefined;
          this.askResponseText = undefined;
          this.askResponseImages = undefined;

          // Bug for the history books:
          // In the webview we use the ts as the chatrow key for the
          // virtuoso list. Since we would update this ts right at the
          // end of streaming, it would cause the view to flicker. The
          // key prop has to be stable otherwise react has trouble
          // reconciling items between renders, causing unmounting and
          // remounting of components (flickering).
          // The lesson here is if you see flickering when rendering
          // lists, it's likely because the key prop is not stable.
          // So in this case we must make sure that the message ts is
          // never altered after first setting it.
          askTs = lastMessage.ts;
          console.log(
            `Task#ask: updating previous partial ask -> ${type} @ ${askTs}`,
          );
          this.lastMessageTs = askTs;
          lastMessage.text = text;
          lastMessage.partial = false;
          lastMessage.progressStatus = progressStatus;
          lastMessage.isProtected = isProtected;
          await this.saveClineMessages();
          this.updateClineMessage(lastMessage);
        } else {
          // This is a new and complete message, so add it like normal.
          this.askResponse = undefined;
          this.askResponseText = undefined;
          this.askResponseImages = undefined;
          askTs = Date.now();
          console.log(`Task#ask: new complete ask -> ${type} @ ${askTs}`);
          this.lastMessageTs = askTs;
          await this.addToClineMessages({
            ts: askTs,
            type: 'ask',
            ask: type,
            text,
            isProtected,
          });
        }
      }
    } else {
      // This is a new non-partial message, so add it like normal.
      this.askResponse = undefined;
      this.askResponseText = undefined;
      this.askResponseImages = undefined;
      askTs = Date.now();
      console.log(`Task#ask: new complete ask -> ${type} @ ${askTs}`);
      this.lastMessageTs = askTs;
      await this.addToClineMessages({
        ts: askTs,
        type: 'ask',
        ask: type,
        text,
        isProtected,
      });
    }

    let timeouts: NodeJS.Timeout[] = [];

    // // Automatically approve if the ask according to the user's settings.
    // const provider = this.providerRef.deref()
    // const state = provider ? await provider.getState() : undefined
    // const approval = await checkAutoApproval({ state, ask: type, text, isProtected })

    // if (approval.decision === "approve") {
    // 	this.approveAsk()
    // } else if (approval.decision === "deny") {
    // 	this.denyAsk()
    // } else if (approval.decision === "timeout") {
    // 	timeouts.push(
    // 		setTimeout(() => {
    // 			const { askResponse, text, images } = approval.fn()
    // 			this.handleWebviewAskResponse(askResponse, text, images)
    // 		}, approval.timeout),
    // 	)
    // }

    // // The state is mutable if the message is complete and the task will
    // // block (via the `pWaitFor`).
    // const isBlocking = !(this.askResponse !== undefined || this.lastMessageTs !== askTs)
    // const isMessageQueued = !this.messageQueueService.isEmpty()

    // const isStatusMutable = !partial && isBlocking && !isMessageQueued && approval.decision === "ask"

    // if (isBlocking) {
    // 	console.log(`Task#ask will block -> type: ${type}`)
    // }

    // if (isStatusMutable) {
    // 	console.log(`Task#ask: status is mutable -> type: ${type}`)
    // 	const statusMutationTimeout = 2_000

    // 	if (isInteractiveAsk(type)) {
    // 		timeouts.push(
    // 			setTimeout(() => {
    // 				const message = this.findMessageByTimestamp(askTs)

    // 				if (message) {
    // 					this.interactiveAsk = message
    // 					this.eventEmitter.emit(RooCodeEventName.TaskInteractive, this.taskId)
    // 					provider?.postMessageToWebview({ type: "interactionRequired" })
    // 				}
    // 			}, statusMutationTimeout),
    // 		)
    // 	} else if (isResumableAsk(type)) {
    // 		timeouts.push(
    // 			setTimeout(() => {
    // 				const message = this.findMessageByTimestamp(askTs)

    // 				if (message) {
    // 					this.resumableAsk = message
    // 					this.eventEmitter.emit(RooCodeEventName.TaskResumable, this.taskId)
    // 				}
    // 			}, statusMutationTimeout),
    // 		)
    // 	} else if (isIdleAsk(type)) {
    // 		timeouts.push(
    // 			setTimeout(() => {
    // 				const message = this.findMessageByTimestamp(askTs)

    // 				if (message) {
    // 					this.idleAsk = message
    // 					this.eventEmitter.emit(RooCodeEventName.TaskIdle, this.taskId)
    // 				}
    // 			}, statusMutationTimeout),
    // 		)
    // 	}
    // } else if (isMessageQueued) {
    // 	console.log(`Task#ask: will process message queue -> type: ${type}`)

    // 	const message = this.messageQueueService.dequeueMessage()

    // 	if (message) {
    // 		// Check if this is a tool approval ask that needs to be handled.
    // 		if (
    // 			type === "tool" ||
    // 			type === "command" ||
    // 			type === "browser_action_launch" ||
    // 			type === "use_mcp_server"
    // 		) {
    // 			// For tool approvals, we need to approve first, then send
    // 			// the message if there's text/images.
    // 			this.handleWebviewAskResponse("yesButtonClicked", message.text, message.images)
    // 		} else {
    // 			// For other ask types (like followup or command_output), fulfill the ask
    // 			// directly.
    // 			this.handleWebviewAskResponse("messageResponse", message.text, message.images)
    // 		}
    // 	}
    // }

    // Wait for askResponse to be set
    // await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })

    if (this.lastMessageTs !== askTs) {
      // Could happen if we send multiple asks in a row i.e. with
      // command_output. It's important that when we know an ask could
      // fail, it is handled gracefully.
      console.log('Task#ask: current ask promise was ignored');
      throw new AskIgnoredError('superseded');
    }

    const result = {
      response: this.askResponse!,
      text: this.askResponseText,
      images: this.askResponseImages,
    };
    this.askResponse = undefined;
    this.askResponseText = undefined;
    this.askResponseImages = undefined;

    // Cancel the timeouts if they are still running.
    timeouts.forEach((timeout) => clearTimeout(timeout));

    // Switch back to an active state.
    if (this.idleAsk || this.resumableAsk || this.interactiveAsk) {
      this.idleAsk = undefined;
      this.resumableAsk = undefined;
      this.interactiveAsk = undefined;
      this.eventEmitter.emit(RooCodeEventName.TaskActive, this.taskId);
    }

    this.eventEmitter.emit(RooCodeEventName.TaskAskResponded);
    return result;
  }

  async say(
    type: ClineSay,
    text?: string,
    images?: string[],
    partial?: boolean,
    checkpoint?: Record<string, unknown>,
    progressStatus?: ToolProgressStatus,
    options: {
      isNonInteractive?: boolean;
    } = {},
    contextCondense?: ContextCondense,
    contextTruncation?: ContextTruncation,
  ): Promise<undefined> {
    if (this._status==='aborted') {
      throw new Error(
        `[RooCode#say] task ${this.taskId}.${this.instanceId} aborted`,
      );
    }

    if (partial !== undefined) {
      const lastMessage = this.clineMessages.at(-1);

      const isUpdatingPreviousPartial =
        lastMessage &&
        lastMessage.partial &&
        lastMessage.type === 'say' &&
        lastMessage.say === type;

      if (partial) {
        if (isUpdatingPreviousPartial) {
          // Existing partial message, so update it.
          lastMessage.text = text;
          lastMessage.images = images;
          lastMessage.partial = partial;
          lastMessage.progressStatus = progressStatus;
          this.updateClineMessage(lastMessage);
        } else {
          // This is a new partial message, so add it with partial state.
          const sayTs = Date.now();

          if (!options.isNonInteractive) {
            this.lastMessageTs = sayTs;
          }

          await this.addToClineMessages({
            ts: sayTs,
            type: 'say',
            say: type,
            text,
            images,
            partial,
            contextCondense,
            contextTruncation,
          });
        }
      } else {
        // New now have a complete version of a previously partial message.
        // This is the complete version of a previously partial
        // message, so replace the partial with the complete version.
        if (isUpdatingPreviousPartial) {
          if (!options.isNonInteractive) {
            this.lastMessageTs = lastMessage.ts;
          }

          lastMessage.text = text;
          lastMessage.images = images;
          lastMessage.partial = false;
          lastMessage.progressStatus = progressStatus;

          // Instead of streaming partialMessage events, we do a save
          // and post like normal to persist to disk.
          await this.saveClineMessages();

          // More performant than an entire `postStateToWebview`.
          this.updateClineMessage(lastMessage);
        } else {
          // This is a new and complete message, so add it like normal.
          const sayTs = Date.now();

          if (!options.isNonInteractive) {
            this.lastMessageTs = sayTs;
          }

          await this.addToClineMessages({
            ts: sayTs,
            type: 'say',
            say: type,
            text,
            images,
            contextCondense,
            contextTruncation,
          });
        }
      }
    } else {
      // This is a new non-partial message, so add it like normal.
      const sayTs = Date.now();

      // A "non-interactive" message is a message is one that the user
      // does not need to respond to. We don't want these message types
      // to trigger an update to `lastMessageTs` since they can be created
      // asynchronously and could interrupt a pending ask.
      if (!options.isNonInteractive) {
        this.lastMessageTs = sayTs;
      }

      await this.addToClineMessages({
        ts: sayTs,
        type: 'say',
        say: type,
        text,
        images,
        checkpoint,
        contextCondense,
        contextTruncation,
      });
    }

    // Broadcast browser session updates to panel when browser-related messages are added
    // if (
    //   type === 'browser_action' ||
    //   type === 'browser_action_result' ||
    //   type === 'browser_session_status'
    // ) {
    //   this.broadcastBrowserSessionUpdate();
    // }
  }

  public async *attemptApiRequest(retryAttempt: number = 0): ApiStream {
		// const state = await this.providerRef.deref()?.getState()

		// const {
		// 	apiConfiguration,
		// 	autoApprovalEnabled,
		// 	alwaysApproveResubmit,
		// 	requestDelaySeconds,
		// 	mode,
		// 	autoCondenseContext = true,
		// 	autoCondenseContextPercent = 100,
		// 	profileThresholds = {},
		// } = state ?? {}

		// // Get condensing configuration for automatic triggers.
		// const customCondensingPrompt = state?.customCondensingPrompt
		// const condensingApiConfigId = state?.condensingApiConfigId
		// const listApiConfigMeta = state?.listApiConfigMeta

		// // Determine API handler to use for condensing.
		// let condensingApiHandler: ApiHandler | undefined

		// if (condensingApiConfigId && listApiConfigMeta && Array.isArray(listApiConfigMeta)) {
		// 	// Find matching config by ID
		// 	const matchingConfig = listApiConfigMeta.find((config) => config.id === condensingApiConfigId)

		// 	if (matchingConfig) {
		// 		const profile = await this.providerRef.deref()?.providerSettingsManager.getProfile({
		// 			id: condensingApiConfigId,
		// 		})

		// 		// Ensure profile and apiProvider exist before trying to build handler.
		// 		if (profile && profile.apiProvider) {
		// 			condensingApiHandler = buildApiHandler(profile)
		// 		}
		// 	}
		// }

		let rateLimitDelay = 0

		// Use the shared timestamp so that subtasks respect the same rate-limit
		// window as their parent tasks.
		// if (Task.lastGlobalApiRequestTime) {
		// 	const now = performance.now()
		// 	const timeSinceLastRequest = now - Task.lastGlobalApiRequestTime
		// 	const rateLimit = apiConfiguration?.rateLimitSeconds || 0
		// 	rateLimitDelay = Math.ceil(Math.min(rateLimit, Math.max(0, rateLimit * 1000 - timeSinceLastRequest) / 1000))
		// }

		// Only show rate limiting message if we're not retrying. If retrying, we'll include the delay there.
		if (rateLimitDelay > 0 && retryAttempt === 0) {
			// Show countdown timer
			for (let i = rateLimitDelay; i > 0; i--) {
				const delayMessage = `Rate limiting for ${i} seconds...`
				await this.say("api_req_retry_delayed", delayMessage, undefined, true)
				await delay(1000)
			}
		}

		// // Update last request time before making the request so that subsequent
		// // requests — even from new subtasks — will honour the provider's rate-limit.
		// Task.lastGlobalApiRequestTime = performance.now()

		const systemPrompt = await this.getSystemPrompt()
		const { contextTokens } = this.getTokenUsage()

		if (contextTokens) {
			const modelInfo = this.api.getModel().info

			const maxTokens = getModelMaxOutputTokens({
				modelId: this.api.getModel().id,
				model: modelInfo,
				settings: this.apiConfiguration,
			})

			const contextWindow = modelInfo.contextWindow

			// // Get the current profile ID using the helper method
			// const currentProfileId = this.getCurrentProfileId(state)

			// Determine if we're using native tool protocol for proper message handling
			const modelInfoForProtocol = this.api.getModel().info
			const protocol = resolveToolProtocol(this.apiConfiguration, modelInfoForProtocol)
			const useNativeTools = isNativeProtocol(protocol)

			// Check if context management will likely run (threshold check)
			// This allows us to show an in-progress indicator to the user
			// We use the centralized willManageContext helper to avoid duplicating threshold logic
			const lastMessage = this.apiConversationHistory[this.apiConversationHistory.length - 1]
			const lastMessageContent = lastMessage?.content
			let lastMessageTokens = 0
			if (lastMessageContent) {
				lastMessageTokens = Array.isArray(lastMessageContent)
					? await this.api.countTokens(lastMessageContent)
					: await this.api.countTokens([{ type: "text", text: lastMessageContent as string }])
			}

      console.warn(`skip contextManagementWillRun check`)
      const contextManagementWillRun = true
			// const contextManagementWillRun = willManageContext({
			// 	totalTokens: contextTokens,
			// 	contextWindow,
			// 	maxTokens,
			// 	autoCondenseContext,
			// 	autoCondenseContextPercent,
			// 	profileThresholds,
			// 	currentProfileId,
			// 	lastMessageTokens,
			// })

			// // Send condenseTaskContextStarted BEFORE manageContext to show in-progress indicator
			// // This notification must be sent here (not earlier) because the early check uses stale token count
			// // (before user message is added to history), which could incorrectly skip showing the indicator
			// if (contextManagementWillRun && autoCondenseContext) {
			// 	await this.providerRef
			// 		.deref()
			// 		?.postMessageToWebview({ type: "condenseTaskContextStarted", text: this.taskId })
			// }

			const truncateResult = await manageContext({
				messages: this.apiConversationHistory,
				totalTokens: contextTokens,
				maxTokens,
				contextWindow,
				apiHandler: this.api,
				autoCondenseContext,
				autoCondenseContextPercent,
				systemPrompt,
				taskId: this.taskId,
				customCondensingPrompt,
				condensingApiHandler,
				profileThresholds,
				currentProfileId,
				useNativeTools,
			})
			if (truncateResult.messages !== this.apiConversationHistory) {
				await this.overwriteApiConversationHistory(truncateResult.messages)
			}
			if (truncateResult.error) {
				await this.say("condense_context_error", truncateResult.error)
			} else if (truncateResult.summary) {
				const { summary, cost, prevContextTokens, newContextTokens = 0, condenseId } = truncateResult
				const contextCondense: ContextCondense = {
					summary,
					cost,
					newContextTokens,
					prevContextTokens,
					condenseId,
				}
				await this.say(
					"condense_context",
					undefined /* text */,
					undefined /* images */,
					false /* partial */,
					undefined /* checkpoint */,
					undefined /* progressStatus */,
					{ isNonInteractive: true } /* options */,
					contextCondense,
				)
			} else if (truncateResult.truncationId) {
				// Sliding window truncation occurred (fallback when condensing fails or is disabled)
				const contextTruncation: ContextTruncation = {
					truncationId: truncateResult.truncationId,
					messagesRemoved: truncateResult.messagesRemoved ?? 0,
					prevContextTokens: truncateResult.prevContextTokens,
					newContextTokens: truncateResult.newContextTokensAfterTruncation ?? 0,
				}
				await this.say(
					"sliding_window_truncation",
					undefined /* text */,
					undefined /* images */,
					false /* partial */,
					undefined /* checkpoint */,
					undefined /* progressStatus */,
					{ isNonInteractive: true } /* options */,
					undefined /* contextCondense */,
					contextTruncation,
				)
			}

			// // Notify webview that context management is complete (sets isCondensing = false)
			// // This removes the in-progress spinner and allows the completed result to show
			// if (contextManagementWillRun && autoCondenseContext) {
			// 	await this.providerRef
			// 		.deref()
			// 		?.postMessageToWebview({ type: "condenseTaskContextResponse", text: this.taskId })
			// }
		}

		// Get the effective API history by filtering out condensed messages
		// This allows non-destructive condensing where messages are tagged but not deleted,
		// enabling accurate rewind operations while still sending condensed history to the API.
		const effectiveHistory = getEffectiveApiHistory(this.apiConversationHistory)
		const messagesSinceLastSummary = getMessagesSinceLastSummary(effectiveHistory)
		const messagesWithoutImages = maybeRemoveImageBlocks(messagesSinceLastSummary, this.api)
		const cleanConversationHistory = this.buildCleanConversationHistory(messagesWithoutImages as ApiMessage[])

		// Check auto-approval limits
		const approvalResult = await this.autoApprovalHandler.checkAutoApprovalLimits(
			state,
			this.combineMessages(this.clineMessages.slice(1)),
			async (type, data) => this.ask(type, data),
		)

		if (!approvalResult.shouldProceed) {
			// User did not approve, task should be aborted
			throw new Error("Auto-approval limit reached and user did not approve continuation")
		}

		// Determine if we should include native tools based on:
		// 1. Tool protocol is set to NATIVE
		// 2. Model supports native tools
		const modelInfo = this.api.getModel().info
		const toolProtocol = resolveToolProtocol(this.apiConfiguration, modelInfo)
		const shouldIncludeTools = toolProtocol === TOOL_PROTOCOL.NATIVE && (modelInfo.supportsNativeTools ?? false)

		// Build complete tools array: native tools + dynamic MCP tools, filtered by mode restrictions
		let allTools: OpenAI.Chat.ChatCompletionTool[] = []
		if (shouldIncludeTools) {
			const provider = this.providerRef.deref()
			if (!provider) {
				throw new Error("Provider reference lost during tool building")
			}

			allTools = await buildNativeToolsArray({
				provider,
				cwd: this.cwd,
				mode,
				customModes: state?.customModes,
				experiments: state?.experiments,
				apiConfiguration,
				maxReadFileLine: state?.maxReadFileLine ?? -1,
				browserToolEnabled: state?.browserToolEnabled ?? true,
				modelInfo,
				diffEnabled: this.diffEnabled,
			})
		}

		// Parallel tool calls are disabled - feature is on hold
		// Previously resolved from experiments.isEnabled(..., EXPERIMENT_IDS.MULTIPLE_NATIVE_TOOL_CALLS)
		const parallelToolCallsEnabled = false

		const metadata: ApiHandlerCreateMessageMetadata = {
			mode: mode,
			taskId: this.taskId,
			suppressPreviousResponseId: this.skipPrevResponseIdOnce,
			// Include tools and tool protocol when using native protocol and model supports it
			...(shouldIncludeTools
				? { tools: allTools, tool_choice: "auto", toolProtocol, parallelToolCalls: parallelToolCallsEnabled }
				: {}),
		}

		// Create an AbortController to allow cancelling the request mid-stream
		this.currentRequestAbortController = new AbortController()
		const abortSignal = this.currentRequestAbortController.signal
		// Reset the flag after using it
		this.skipPrevResponseIdOnce = false

		// The provider accepts reasoning items alongside standard messages; cast to the expected parameter type.
		const stream = this.api.createMessage(
			systemPrompt,
			cleanConversationHistory as unknown as Anthropic.Messages.MessageParam[],
			metadata,
		)
		const iterator = stream[Symbol.asyncIterator]()

		// Set up abort handling - when the signal is aborted, clean up the controller reference
		abortSignal.addEventListener("abort", () => {
			console.log(`[Task#${this.taskId}.${this.instanceId}] AbortSignal triggered for current request`)
			this.currentRequestAbortController = undefined
		})

		try {
			// Awaiting first chunk to see if it will throw an error.
			this.isWaitingForFirstChunk = true

			// Race between the first chunk and the abort signal
			const firstChunkPromise = iterator.next()
			const abortPromise = new Promise<never>((_, reject) => {
				if (abortSignal.aborted) {
					reject(new Error("Request cancelled by user"))
				} else {
					abortSignal.addEventListener("abort", () => {
						reject(new Error("Request cancelled by user"))
					})
				}
			})

			const firstChunk = await Promise.race([firstChunkPromise, abortPromise])
			yield firstChunk.value
			this.isWaitingForFirstChunk = false
		} catch (error) {
			this.isWaitingForFirstChunk = false
			this.currentRequestAbortController = undefined
			const isContextWindowExceededError = checkContextWindowExceededError(error)

			// If it's a context window error and we haven't exceeded max retries for this error type
			if (isContextWindowExceededError && retryAttempt < MAX_CONTEXT_WINDOW_RETRIES) {
				console.warn(
					`[Task#${this.taskId}] Context window exceeded for model ${this.api.getModel().id}. ` +
						`Retry attempt ${retryAttempt + 1}/${MAX_CONTEXT_WINDOW_RETRIES}. ` +
						`Attempting automatic truncation...`,
				)
				await this.handleContextWindowExceededError()
				// Retry the request after handling the context window error
				yield* this.attemptApiRequest(retryAttempt + 1)
				return
			}

			// note that this api_req_failed ask is unique in that we only present this option if the api hasn't streamed any content yet (ie it fails on the first chunk due), as it would allow them to hit a retry button. However if the api failed mid-stream, it could be in any arbitrary state where some tools may have executed, so that error is handled differently and requires cancelling the task entirely.
			if (autoApprovalEnabled && alwaysApproveResubmit) {
				let errorMsg

				if (error.error?.metadata?.raw) {
					errorMsg = JSON.stringify(error.error.metadata.raw, null, 2)
				} else if (error.message) {
					errorMsg = error.message
				} else {
					errorMsg = "Unknown error"
				}

				// Apply shared exponential backoff and countdown UX
				await this.backoffAndAnnounce(retryAttempt, error, errorMsg)

				// CRITICAL: Check if task was aborted during the backoff countdown
				// This prevents infinite loops when users cancel during auto-retry
				// Without this check, the recursive call below would continue even after abort
				if (this.abort) {
					throw new Error(
						`[Task#attemptApiRequest] task ${this.taskId}.${this.instanceId} aborted during retry`,
					)
				}

				// Delegate generator output from the recursive call with
				// incremented retry count.
				yield* this.attemptApiRequest(retryAttempt + 1)

				return
			} else {
				const { response } = await this.ask(
					"api_req_failed",
					error.message ?? JSON.stringify(serializeError(error), null, 2),
				)

				if (response !== "yesButtonClicked") {
					// This will never happen since if noButtonClicked, we will
					// clear current task, aborting this instance.
					throw new Error("API request failed")
				}

				await this.say("api_req_retried")

				// Delegate generator output from the recursive call.
				yield* this.attemptApiRequest()
				return
			}
		}

		// No error, so we can continue to yield all remaining chunks.
		// (Needs to be placed outside of try/catch since it we want caller to
		// handle errors not with api_req_failed as that is reserved for first
		// chunk failures only.)
		// This delegates to another generator or iterable object. In this case,
		// it's saying "yield all remaining values from this iterator". This
		// effectively passes along all subsequent chunks from the original
		// stream.
		yield* iterator
	}

  private async getSystemPrompt(): Promise<string> {
		// const { mcpEnabled } = (await this.providerRef.deref()?.getState()) ?? {}
		// let mcpHub: McpHub | undefined
		// if (mcpEnabled ?? true) {
		// 	const provider = this.providerRef.deref()

		// 	if (!provider) {
		// 		throw new Error("Provider reference lost during view transition")
		// 	}

		// 	// Wait for MCP hub initialization through McpServerManager
		// 	mcpHub = await McpServerManager.getInstance(provider.context, provider)

		// 	if (!mcpHub) {
		// 		throw new Error("Failed to get MCP hub from server manager")
		// 	}

		// 	// Wait for MCP servers to be connected before generating system prompt
		// 	await pWaitFor(() => !mcpHub!.isConnecting, { timeout: 10_000 }).catch(() => {
		// 		console.error("MCP servers failed to connect in time")
		// 	})
		// }

		// const rooIgnoreInstructions = this.rooIgnoreController?.getInstructions()

		// const state = await this.providerRef.deref()?.getState()

		// const {
		// 	browserViewportSize,
		// 	mode,
		// 	customModes,
		// 	customModePrompts,
		// 	customInstructions,
		// 	experiments,
		// 	enableMcpServerCreation,
		// 	browserToolEnabled,
		// 	language,
		// 	maxConcurrentFileReads,
		// 	maxReadFileLine,
		// 	apiConfiguration,
		// } = state ?? {}

		return await (async () => {
			// const provider = this.providerRef.deref()

			// if (!provider) {
			// 	throw new Error("Provider not available")
			// }

			// // Align browser tool enablement with generateSystemPrompt: require model image support,
			// // mode to include the browser group, and the user setting to be enabled.
			// const modeConfig = getModeBySlug(mode ?? defaultModeSlug, customModes)
			// const modeSupportsBrowser = modeConfig?.groups.some((group) => getGroupName(group) === "browser") ?? false

			// // Check if model supports browser capability (images)
			// const modelInfo = this.api.getModel().info
			// const modelSupportsBrowser = (modelInfo as any)?.supportsImages === true

			// const canUseBrowserTool = modelSupportsBrowser && modeSupportsBrowser && (browserToolEnabled ?? true)

			// // Resolve the tool protocol based on profile, model, and provider settings
			// const toolProtocol = resolveToolProtocol(apiConfiguration ?? this.apiConfiguration, modelInfo)

			return SYSTEM_PROMPT(
				// provider.context,
				// canUseBrowserTool,
			)
		})()
	}

	private getCurrentProfileId(state: any): string {
		return (
			state?.listApiConfigMeta?.find((profile: any) => profile.name === state?.currentApiConfigName)?.id ??
			"default"
		)
	}
}
