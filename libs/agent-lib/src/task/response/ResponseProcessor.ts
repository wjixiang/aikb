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
        console.log('[DEBUG] ResponseProcessor.processXmlCompleteResponse - START');
        console.log('[DEBUG] Total chunks to process:', chunks.length);
        let reasoningMessage = '';
        let assistantMessage = '';

        let usageCount = 0;
        let reasoningCount = 0;
        let textCount = 0;
        let otherCount = 0;

        for (const chunk of chunks) {
            switch (chunk.type) {
                case 'usage':
                    this.tokenUsageTracker.accumulate(chunk);
                    usageCount++;
                    break;
                case 'reasoning':
                    reasoningMessage += chunk.text;
                    reasoningCount++;
                    break;
                case 'text':
                    assistantMessage += chunk.text;
                    textCount++;
                    break;
                default:
                    otherCount++;
                    console.log('[DEBUG] Unknown chunk type:', chunk.type);
            }
        }

        console.log(`[DEBUG] Chunk breakdown - usage: ${usageCount}, reasoning: ${reasoningCount}, text: ${textCount}, other: ${otherCount}`);
        console.log('[DEBUG] Assistant message length:', assistantMessage.length);
        console.log('[DEBUG] Reasoning message length:', reasoningMessage.length);

        // Handle weird behavior of LLM that always outputs 'tool_call>'
        assistantMessage = assistantMessage.replace('tool_call>', '');
        console.log('[DEBUG] Assistant message (first 200 chars):', assistantMessage.substring(0, 200));

        console.log('[DEBUG] Calling xmlToolCallingParser.processMessage...');
        const finalBlocks = this.toolCallingParser.xmlToolCallingParser.processMessage(assistantMessage);
        console.log('[DEBUG] Final blocks count:', finalBlocks.length);
        console.log('[DEBUG] Final blocks:', JSON.stringify(finalBlocks).substring(0, 500));

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
        console.log('[DEBUG] ResponseProcessor.processCompleteResponse - START');
        console.log('[DEBUG] Total chunks to process:', chunks.length);
        let reasoningMessage = '';
        let assistantMessage = '';

        // Clear any previous tool call state before processing new chunks
        NativeToolCallParser.clearRawChunkState();

        // Map to accumulate streaming tool call arguments by ID
        const streamingToolCalls = new Map<string, { id: string; name: string; arguments: string }>();
        const assistantMessageContent: AssistantMessageContent[] = [];

        let usageCount = 0;
        let reasoningCount = 0;
        let textCount = 0;
        let toolCallCount = 0;
        let toolCallPartialCount = 0;
        let otherCount = 0;

        // Process all chunks to build complete response
        for (const chunk of chunks) {
            switch (chunk.type) {
                case 'usage':
                    this.tokenUsageTracker.accumulate(chunk);
                    usageCount++;
                    break;
                case 'tool_call': {
                    toolCallCount++;
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
                    toolCallPartialCount++;
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
                    reasoningCount++;
                    break;
                case 'text':
                    assistantMessage += chunk.text;
                    textCount++;
                    break;
                default:
                    otherCount++;
                    console.log('[DEBUG] Unknown chunk type:', chunk.type);
            }
        }

        console.log(`[DEBUG] Chunk breakdown - usage: ${usageCount}, reasoning: ${reasoningCount}, text: ${textCount}, tool_call: ${toolCallCount}, tool_call_partial: ${toolCallPartialCount}, other: ${otherCount}`);
        console.log('[DEBUG] Assistant message length:', assistantMessage.length);
        console.log('[DEBUG] Reasoning message length:', reasoningMessage.length);
        console.log('[DEBUG] Assistant message content blocks count:', assistantMessageContent.length);

        // Handle weird behavior of LLM that always outputs 'tool_call>'
        assistantMessage = assistantMessage.replace('tool_call>', '');

        // Finalize any remaining tool calls that weren't explicitly ended
        console.log('[DEBUG] Finalizing remaining tool calls...');
        const finalizationEvents = NativeToolCallParser.finalizeRawChunks();
        console.log('[DEBUG] Finalization events count:', finalizationEvents.length);
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

        console.log(`[DEBUG] Final assistant message content blocks count: ${assistantMessageContent.length}`);
        console.log(`[DEBUG] LLM response - reasoning: ${reasoningMessage.substring(0, 200)}... assistant: ${assistantMessage.substring(0, 200)}...`);

        return {
            assistantMessageContent,
            reasoningMessage,
            assistantMessage,
        };
    }
}
