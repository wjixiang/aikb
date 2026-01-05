import { ToolCallingHandler, ToolExecutionError, ToolTimeoutError, ToolContext } from '../../tools';
import { ToolName, ToolUsage } from '../../types';
import { AssistantMessageContent, ToolUse } from '../../assistant-message/assistantMessageTypes';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';

/**
 * Result of executing tool calls
 */
export interface ToolExecutionResult {
    userMessageContent: (
        | Anthropic.TextBlockParam
        | Anthropic.ImageBlockParam
        | Anthropic.ToolResultBlockParam
    )[];
    didAttemptCompletion: boolean;
    toolUsage: ToolUsage;
}

/**
 * Configuration for ToolExecutor
 */
export interface ToolExecutorConfig {
    context?: ToolContext;
}

/**
 * Executes tool calls and builds user message content
 */
export class ToolExecutor {
    private toolUsage: ToolUsage = {};

    constructor(
        private readonly toolCallHandler: ToolCallingHandler,
        private readonly config?: ToolExecutorConfig,
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
            const toolCallId = randomUUID();

            // Store the tool call ID directly in the tool use block
            // This ensures the same ID is used when adding the assistant message to history
            toolUse.id = toolCallId;

            const input = toolUse.nativeArgs || toolUse.params;

            // Track tool usage
            this.trackToolUsage(toolUse.name as ToolName);

            // Handle tool calling
            const toolCallRes = await this.toolCallHandler.handleToolCalling(
                toolUse.name as ToolName,
                input,
                {
                    timeout: 30000, // 30 seconds timeout for tool execution
                    context: this.config?.context,
                },
            );

            // Check for abort status after tool execution
            if (isAborted()) {
                console.log('Task was aborted after tool execution');
                return { userMessageContent, didAttemptCompletion, toolUsage: this.toolUsage };
            }

            // Process tool call result and add to user message content
            if (toolCallRes) {
                // Convert tool result to text format for user message
                const resultText = this.parseToolCallResponse(toolCallRes);

                // Add tool result to user message content
                if (resultText) {
                    userMessageContent.push({
                        type: 'tool_result' as const,
                        tool_use_id: toolCallId,
                        content: resultText,
                    });

                    // Check if this is an attempt_completion tool call
                    if (toolUse.name === 'attempt_completion') {
                        // For attempt_completion, don't push to stack for further processing
                        console.log(
                            'Tool call completed with attempt_completion, ending recursion',
                        );
                        didAttemptCompletion = true;
                        // Clear user message content to prevent further recursion
                        userMessageContent.length = 0;
                    }
                }
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
