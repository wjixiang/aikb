import { NativeToolCallParser } from '../../assistant-message/NativeToolCallParser';
import { AssistantMessageContent } from '../../assistant-message/assistantMessageTypes';
import { TokenUsageTracker } from '../token-usage/TokenUsageTracker';
import TooCallingParser from '../../tools/toolCallingParser/toolCallingParser';
import type { ApiStreamChunk } from '../../api';

/**
 * Result of processing a complete API response
 */
export interface ProcessedResponse {
    assistantMessageContent: AssistantMessageContent[];
    reasoningMessage: string;
    assistantMessage: string;
}

/**
 * Processes API response chunks into structured message content
 * Handles both native and XML tool calling protocols
 */
export class ResponseProcessor {
    constructor(
        private readonly tokenUsageTracker: TokenUsageTracker,
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
    processCompleteResponse(chunks: ApiStreamChunk[]): ProcessedResponse {
        let reasoningMessage = '';
        let assistantMessage = '';

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
