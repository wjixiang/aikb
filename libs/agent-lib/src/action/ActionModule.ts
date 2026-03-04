/**
 * ActionModule - Manages action phase execution
 *
 * This module handles:
 * 1. Making API requests to LLM
 * 2. Executing tool calls
 * 3. Building response messages
 * 4. Tracking token usage and tool statistics
 */

import { injectable, inject, optional } from 'inversify';
import Anthropic from '@anthropic-ai/sdk';
import {
    ApiMessage,
    ExtendedContentBlock,
} from '../task/task.type.js';
import { ToolUsage } from '../types/index.js';
import type { ApiResponse, ChatCompletionTool } from '../api-client/index.js';
import { TYPES } from '../di/types.js';
import type { Logger } from 'pino';
import type { IToolManager } from '../tools/index.js';
import type { ITurnMemoryStore } from '../memory/TurnMemoryStore.interface.js';
import type { MemoryModuleConfig } from '../memory/types.js';
import {
    IActionModule,
    ActionModuleConfig,
    ActionPhaseResult,
    ToolResult,
} from './types.js';

/**
 * Default configuration for ActionModule
 */
export const defaultActionConfig: ActionModuleConfig = {
    apiRequestTimeout: 60000,
    maxToolRetryAttempts: 3,
    enableParallelExecution: false,
};

/**
 * ActionModule - Implements action phase logic
 */
@injectable()
export class ActionModule implements IActionModule {
    private config: ActionModuleConfig;
    private apiClient: any; // ApiClient
    private logger: Logger;
    private toolManager: IToolManager;
    private turnMemoryStore: ITurnMemoryStore;
    private memoryModuleConfig: MemoryModuleConfig;

    constructor(
        @inject(TYPES.ApiClient) apiClient: any,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.IToolManager) toolManager: IToolManager,
        @inject(TYPES.ITurnMemoryStore) turnMemoryStore: ITurnMemoryStore,
        @inject(TYPES.MemoryModuleConfig) memoryModuleConfig: MemoryModuleConfig,
        @inject(TYPES.ActionModuleConfig) @optional() config: Partial<ActionModuleConfig> = {}
    ) {
        this.config = { ...defaultActionConfig, ...config };
        this.apiClient = apiClient;
        this.logger = logger;
        this.toolManager = toolManager;
        this.turnMemoryStore = turnMemoryStore;
        this.memoryModuleConfig = memoryModuleConfig;
    }

    /**
     * Get current configuration
     */
    getConfig(): ActionModuleConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ActionModuleConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Perform action phase
     * @param toolManager - Optional tool manager to use. If provided, uses this instead of injected one.
     *                      This allows using the workspace's tool manager to ensure all registered tools are available.
     */
    async performActionPhase(
        workspaceContext: string,
        systemPrompt: string,
        conversationHistory: ApiMessage[],
        tools: ChatCompletionTool[],
        isAborted: () => boolean,
        toolManager?: IToolManager
    ): Promise<ActionPhaseResult> {
        // Use provided toolManager or fall back to injected one
        const effectiveToolManager = toolManager ?? this.toolManager;
        // 1. Make API request
        const apiResponse = await this.makeApiRequest(
            systemPrompt,
            workspaceContext,
            conversationHistory,
            tools
        );

        // 2. Convert API response to assistant message
        const assistantMessage = this.convertApiResponseToApiMessage(apiResponse);

        // 3. Execute tool calls
        const { toolResults, userMessageContent, didAttemptCompletion } =
            await this.executeToolCalls(apiResponse, isAborted, effectiveToolManager);

        // 4. Calculate token usage
        const tokensUsed = apiResponse.tokenUsage.completionTokens + apiResponse.tokenUsage.promptTokens;

        // 5. Build tool usage statistics
        const toolUsage = this.buildToolUsage(toolResults);

        return {
            apiResponse,
            toolResults,
            didAttemptCompletion,
            assistantMessage,
            userMessageContent,
            tokensUsed,
            toolUsage,
        };
    }

    /**
     * Make API request with timeout
     * Uses the injected ApiClient for making requests
     */
    private async makeApiRequest(
        systemPrompt: string,
        workspaceContext: string,
        conversationHistory: ApiMessage[],
        tools: ChatCompletionTool[]
    ): Promise<ApiResponse> {
        try {
            // Convert conversation history to memory context format
            const memoryContext = this.convertConversationHistoryToMemoryContext(conversationHistory);

            // Use the injected ApiClient to make the request
            const response = await this.apiClient.makeRequest(
                systemPrompt,
                workspaceContext,
                memoryContext,
                { timeout: this.config.apiRequestTimeout },
                tools
            );

            return response;
        } catch (error) {
            this.logger.error({ error }, 'API request failed');
            throw error;
        }
    }

    /**
     * Convert conversation history to memory context format
     * Converts ApiMessage[] to string[] for ApiClient
     */
    private convertConversationHistoryToMemoryContext(conversationHistory: ApiMessage[]): string[] {
        return conversationHistory.map(msg => {
            const content = msg.content
                .map(block => {
                    if (block.type === 'text') {
                        return block.text;
                    } else if (block.type === 'thinking') {
                        return `<thinking>${block.thinking}</thinking>`;
                    } else if (block.type === 'tool_use') {
                        return `<tool_use name="${block.name}">${JSON.stringify(block.input)}</tool_use>`;
                    } else if (block.type === 'tool_result') {
                        return `<tool_result tool_use_id="${block.tool_use_id}">${block.content}</tool_result>`;
                    }
                    return '';
                })
                .join('\n');

            return `<${msg.role}>\n${content}\n</${msg.role}>`;
        });
    }

    /**
     * Execute tool calls and build response
     * Supports multiple tool calls in a single response
     * @param toolManager - The tool manager to use for executing tools. If not provided, uses the injected one.
     */
    private async executeToolCalls(
        response: ApiResponse,
        isAborted: () => boolean,
        toolManager?: IToolManager,
    ): Promise<{
        toolResults: ToolResult[];
        userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>;
        didAttemptCompletion: boolean;
    }> {
        // Use provided toolManager or fall back to injected one
        const effectiveToolManager = toolManager ?? this.toolManager;

        const userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        const toolResults: ToolResult[] = [];
        let didAttemptCompletion = false;

        for (const toolCall of response.toolCalls) {
            if (isAborted()) {
                break;
            }

            try {
                let result: any;

                // Check if this is attempt_completion
                if (toolCall.name === 'attempt_completion') {
                    didAttemptCompletion = true;
                    // Parse arguments to get the completion result
                    let completionData: any = {};
                    try {
                        completionData = JSON.parse(toolCall.arguments);
                    } catch (e) {
                        completionData = { result: toolCall.arguments };
                    }
                    result = { success: true, result: completionData.result || completionData };
                } else if (toolCall.name === 'recall_conversation') {
                    // Handle recall_conversation tool
                    let recallParams: any = {};
                    try {
                        recallParams = JSON.parse(toolCall.arguments);
                    } catch (e) {
                        recallParams = {};
                    }

                    // Call TurnMemoryStore to recall turns
                    let recalled: ApiMessage[] = [];
                    if (recallParams.turn_numbers && recallParams.turn_numbers.length > 0) {
                        // Recall by turn numbers - get turns and extract messages
                        const turns = recallParams.turn_numbers.map((n: number) => this.turnMemoryStore.getTurnByNumber(n)).filter(Boolean);
                        recalled = turns.flatMap((turn: any) => turn.messages);
                    } else if (recallParams.last_n) {
                        // Get recent messages from last N turns
                        recalled = this.turnMemoryStore.getRecentMessages(recallParams.last_n);
                    }

                    result = {
                        success: true,
                        recalled_messages: recalled.length,
                        message: `Successfully recalled ${recalled.length} messages. They will be injected into the next API request.`,
                    };
                } else {
                    // Parse tool arguments
                    let parsedParams: any = {};
                    try {
                        parsedParams = JSON.parse(toolCall.arguments);
                    } catch (e) {
                        parsedParams = { raw: toolCall.arguments };
                    }

                    // Execute tool through IToolManager
                    result = await effectiveToolManager.executeTool(toolCall.name, parsedParams);
                }

                toolResults.push({
                    toolName: toolCall.name,
                    success: true,
                    result,
                    timestamp: Date.now(),
                });

                userMessageContent.push({
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: JSON.stringify(result),
                });
            } catch (error) {
                toolResults.push({
                    toolName: toolCall.name,
                    success: false,
                    result: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now(),
                });

                userMessageContent.push({
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
                });
            }
        }

        return { toolResults, userMessageContent, didAttemptCompletion };
    }

    /**
     * Convert API response to ApiMessage
     */
    private convertApiResponseToApiMessage(response: ApiResponse): ApiMessage {
        const content: ExtendedContentBlock[] = [];

        // Add text response if available
        if (response.textResponse) {
            content.push({
                type: 'text',
                text: response.textResponse,
            });
        }

        // Add tool use blocks for each tool call
        for (const toolCall of response.toolCalls) {
            // Parse arguments from JSON string
            let parsedArgs: any = {};
            try {
                parsedArgs = JSON.parse(toolCall.arguments);
            } catch (e) {
                console.error('Failed to parse tool call arguments:', e);
                parsedArgs = { raw: toolCall.arguments };
            }

            content.push({
                type: 'tool_use' as const,
                id: toolCall.id,
                name: toolCall.name,
                input: parsedArgs,
            });
        }

        return {
            role: 'assistant',
            content,
            ts: Date.now(),
        };
    }

    /**
     * Build tool usage statistics from tool results
     */
    private buildToolUsage(toolResults: ToolResult[]): ToolUsage {
        const toolUsage: ToolUsage = {};

        for (const result of toolResults) {
            if (!toolUsage[result.toolName]) {
                toolUsage[result.toolName] = {
                    attempts: 0,
                    failures: 0,
                };
            }
            toolUsage[result.toolName].attempts++;
            if (!result.success) {
                toolUsage[result.toolName].failures++;
            }
        }

        return toolUsage;
    }
}
