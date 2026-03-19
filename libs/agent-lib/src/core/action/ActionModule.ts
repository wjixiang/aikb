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
} from '../memory/types.js';
import { ToolUsage } from '../types/index.js';
import type { ApiClient, ApiResponse, ChatCompletionTool } from '../api-client/index.js';
import { TYPES } from '../di/types.js';
// Define Logger type locally to avoid pino ESM import issues
type Logger = import('pino').Logger;
import type { IToolManager } from '../tools/index.js';
import type { ITurnMemoryStore } from '../memory/TurnMemoryStore.interface.js';
import {
    IActionModule,
    ActionModuleConfig,
    ActionPhaseResult,
    ToolResult,
    ActionStep,
} from './types.js';
import { NoToolsUsedError } from '../common/errors.js';
import { Turn } from '../memory/Turn.js';

/**
 * Default configuration for ActionModule
 */
export const defaultActionConfig: ActionModuleConfig = {
    apiRequestTimeout: 60000,
    maxToolRetryAttempts: 3,
    enableParallelExecution: true,
    maxApiRetryAttempts: 3,
    apiRetryDelayMs: 1000,
};

/**
 * ActionModule - Implements action phase logic
 */
@injectable()
export class ActionModule implements IActionModule {
    private config: ActionModuleConfig;
    private apiClient: ApiClient; // ApiClient
    private logger: Logger;
    private toolManager: IToolManager;
    private turnMemoryStore: ITurnMemoryStore;


    constructor(
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.IToolManager) toolManager: IToolManager,
        @inject(TYPES.ITurnMemoryStore) turnMemoryStore: ITurnMemoryStore,
        @inject(TYPES.ActionModuleConfig) @optional() config: Partial<ActionModuleConfig> = {}
    ) {
        this.config = { ...defaultActionConfig, ...config };
        this.apiClient = apiClient;
        this.logger = logger;
        this.toolManager = toolManager;
        this.turnMemoryStore = turnMemoryStore;

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
     * @param actionPlan - Optional structured action plan from thinking phase.
     *                      If provided, actions will be executed according to the plan.
     */
    async performActionPhase(
        workspaceContext: string,
        systemPrompt: string,
        conversationHistory: ApiMessage[],
        tools: ChatCompletionTool[],
        isAborted: () => boolean,
        toolManager?: IToolManager,
        actionPlan?: ActionStep[],
    ): Promise<ActionPhaseResult> {
        this.logger.info('Starting action phase execution');

        let apiResponse: ApiResponse;
        let assistantMessage: ApiMessage;
        let toolResults: ToolResult[] = [];
        let userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        let didAttemptCompletion = false;

        try {
            // Use the provided toolManager or fall back to injected one
            const effectiveToolManager = toolManager || this.toolManager;

            // If actionPlan is provided, execute from plan
            if (actionPlan && actionPlan.length > 0) {
                // Execute from plan directly without LLM call
                this.logger.info({ actionPlanLength: actionPlan.length }, 'Executing from action plan (no LLM call)');

                // Execute from plan
                const executionResult = await this.executeFromPlan(actionPlan, isAborted, effectiveToolManager);
                toolResults = executionResult.toolResults;
                userMessageContent = executionResult.userMessageContent;
                didAttemptCompletion = executionResult.didAttemptCompletion;

                // If execution failed at a step, propagate the error
                if (executionResult.failedStep) {
                    throw new Error(`Action step ${executionResult.failedStep.stepId} failed: ${executionResult.failedStep.reasoning}`);
                }

                // Build assistant message from plan execution (no LLM response)
                assistantMessage = {
                    role: 'assistant' as const,
                    content: [{
                        type: 'text' as const,
                        text: `Executing action plan with ${actionPlan.length} steps`,
                    }],
                    ts: Date.now(),
                };

                // Set apiResponse to empty response since we didn't call LLM
                apiResponse = {
                    toolCalls: [],
                    textResponse: `Executed ${toolResults.length} steps from action plan`,
                    requestTime: 0,
                    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                };
            } else {
                // Original behavior: LLM decides tool calls
                // 1. Make API request
                this.logger.info('Making API request in action phase');
                apiResponse = await this.makeApiRequest(
                    systemPrompt,
                    workspaceContext,
                    conversationHistory,
                    tools
                );
                this.logger.info({
                    hasToolCalls: !!apiResponse.toolCalls,
                    toolCallsCount: apiResponse.toolCalls?.length || 0,
                    hasTextResponse: !!apiResponse.textResponse
                }, 'API request completed successfully');

                // 2. Convert API response to assistant message
                assistantMessage = this.convertApiResponseToApiMessage(apiResponse);

                // 3. Execute tool calls
                this.logger.info('Starting tool execution');
                const executionResult = await this.executeToolCalls(apiResponse, isAborted, effectiveToolManager);
                toolResults = executionResult.toolResults;
                userMessageContent = executionResult.userMessageContent;
                didAttemptCompletion = executionResult.didAttemptCompletion;
            }

            this.logger.info({
                toolResultsCount: toolResults.length,
                successfulTools: toolResults.filter(r => r.success).length,
                failedTools: toolResults.filter(r => !r.success).length
            }, 'Tool execution completed');

            // 4. Calculate token usage
            const tokensUsed = (apiResponse.tokenUsage?.completionTokens || 0) + (apiResponse.tokenUsage?.promptTokens || 0);

            // 5. Build tool usage statistics
            const toolUsage = this.buildToolUsage(toolResults);

            this.logger.info('Action phase completed successfully');

            return {
                apiResponse,
                toolResults,
                didAttemptCompletion,
                assistantMessage,
                userMessageContent,
                tokensUsed,
                toolUsage,
            };
        } catch (error) {
            // Log error with partial results (with defensive checks)
            this.logger.error({
                error,
                toolResultsCount: toolResults?.length ?? 0,
                userMessageContentLength: userMessageContent?.length ?? 0,
                didAttemptCompletion
            }, 'Action phase failed with error');

            // Push error to turn memory store for potential retry
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.turnMemoryStore.pushErrors([new Error(`Action phase failed: ${errorMessage}`)]);

            // Re-throw the error for the caller to handle
            throw error;
        }
    }

    /**
     * Make API request with timeout and retry mechanism
     * Uses the injected ApiClient for making requests
     * Implements error reuse by storing errors and prepending them to subsequent retry prompts
     */
    private async makeApiRequest(
        systemPrompt: string,
        workspaceContext: string,
        conversationHistory: ApiMessage[],
        tools: ChatCompletionTool[]
    ): Promise<ApiResponse> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.maxApiRetryAttempts; attempt++) {
            try {
                // Handle errors from previous attempts
                const errors = this.turnMemoryStore.popErrors();
                let errorPrompt = '';
                if (errors.length > 0) {
                    errorPrompt = `=== PREVIOUS ERRORS (to learn from) ===
${errors.map((e, i) => `Error ${i + 1}: ${e.message}`).join('\n')}

Please take these errors into consideration and avoid repeating the same mistakes.
`;
                }

                // Convert conversation history to memory context format
                const memoryContext = this.convertConversationHistoryToMemoryContext(conversationHistory);

                // Prepend error context if there are errors
                const fullContext = errorPrompt ? [errorPrompt, ...memoryContext] : memoryContext;

                // Use the injected ApiClient to make the request
                const response = await this.apiClient.makeRequest(
                    systemPrompt,
                    workspaceContext,
                    fullContext,
                    { timeout: this.config.apiRequestTimeout },
                    tools
                );

                return response;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                this.logger.error({
                    error: lastError,
                    attempt: attempt + 1,
                    maxRetries: this.config.maxApiRetryAttempts
                }, 'API request failed, will retry');

                // Push error to turn memory store for next attempt
                const errorMessage = lastError.message;
                this.turnMemoryStore.pushErrors([new Error(`API request failed: ${errorMessage}`)]);

                if (attempt < this.config.maxApiRetryAttempts) {
                    // Retry after delay if configured
                    if (this.config.apiRetryDelayMs > 0) {
                        await this.delay(this.config.apiRetryDelayMs);
                    }
                    continue;
                }

                // No more retries - throw the error
                throw lastError;
            }
        }

        // Should not reach here, but throw last error for safety
        throw lastError || new Error('Unexpected error in makeApiRequest');
    }

    /**
     * Delay helper for retry waits
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
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
     * @param toolManager - The tool manager to use for executing tools.
     */
    private async executeToolCalls(
        response: ApiResponse,
        isAborted: () => boolean,
        toolManager: IToolManager,
    ): Promise<{
        toolResults: ToolResult[];
        userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>;
        didAttemptCompletion: boolean;
    }> {
        // Use provided toolManager or fall back to injected one
        const effectiveToolManager = toolManager || this.toolManager;

        const userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        const toolResults: ToolResult[] = [];
        let didAttemptCompletion = false;

        // Ensure toolCalls is an array before iterating
        const toolCalls = response.toolCalls || [];
        if (toolCalls.length === 0) {
            this.logger.error('no tool used')
            throw new NoToolsUsedError()
        }
        this.logger.info({ toolCallsCount: toolCalls.length, toolCalls, parallelEnabled: this.config.enableParallelExecution }, `Starting tool execution for ${toolCalls.length} tool call(s)`);

        // Helper function to execute a single tool call
        const executeSingleTool = async (toolCall: any): Promise<{
            toolResult: ToolResult;
            userMessageContentItem: Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam;
            didAttempt: boolean;
        }> => {
            let result: any;
            let didAttempt = false;

            try {
                // Check if this is attempt_completion
                if (toolCall.name === 'attempt_completion') {
                    didAttempt = true;
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
                        recalled = turns.flatMap((turn: Turn) => turn.messages);
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
                    this.logger.info({ toolName: toolCall.name, params: parsedParams }, `Executing tool: ${toolCall.name}`);
                    result = await effectiveToolManager.executeTool(toolCall.name, parsedParams);
                    this.logger.info({ toolName: toolCall.name, result }, `Tool execution completed: ${toolCall.name}`);
                }

                // Get component key for the tool (for logging/display purposes)
                const toolSourceInfo = effectiveToolManager.getToolSource(toolCall.name);
                const componentKey = toolSourceInfo?.componentKey;

                const toolResult: ToolResult = {
                    toolName: toolCall.name,
                    success: true,
                    result,
                    timestamp: Date.now(),
                    componentKey,
                };

                const userMessageContentItem = {
                    type: 'tool_result' as const,
                    tool_use_id: toolCall.id,
                    content: JSON.stringify(result),
                };

                return { toolResult, userMessageContentItem, didAttempt };
            } catch (error) {
                this.logger.error({ toolName: toolCall.name, error }, `Tool execution failed: ${toolCall.name}`);
                // Push error to turn memory store for potential retry
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.turnMemoryStore.pushErrors([new Error(`Tool ${toolCall.name} failed: ${errorMessage}`)]);

                // Get component key for the tool (for logging/display purposes)
                const toolSourceInfo = effectiveToolManager.getToolSource(toolCall.name);
                const componentKey = toolSourceInfo?.componentKey;

                const toolResult: ToolResult = {
                    toolName: toolCall.name,
                    success: false,
                    result: error instanceof Error ? error.message : String(error),
                    timestamp: Date.now(),
                    componentKey,
                };

                const userMessageContentItem = {
                    type: 'tool_result' as const,
                    tool_use_id: toolCall.id,
                    content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
                };

                return { toolResult, userMessageContentItem, didAttempt: false };
            }
        };

        if (this.config.enableParallelExecution) {
            // Parallel execution
            const promises = toolCalls.map(async (toolCall) => {
                if (isAborted()) {
                    return null;
                }
                return executeSingleTool(toolCall);
            });

            const results = await Promise.all(promises);
            results.forEach((result) => {
                if (result) {
                    toolResults.push(result.toolResult);
                    userMessageContent.push(result.userMessageContentItem);
                    if (result.didAttempt) {
                        didAttemptCompletion = true;
                    }
                }
            });
        } else {
            // Sequential execution (original behavior)
            for (const toolCall of toolCalls) {
                if (isAborted()) {
                    break;
                }

                const result = await executeSingleTool(toolCall);
                toolResults.push(result.toolResult);
                userMessageContent.push(result.userMessageContentItem);
                if (result.didAttempt) {
                    didAttemptCompletion = true;
                }
            }
        }

        this.logger.info({
            toolResultsCount: toolResults.length,
            userMessageContentLength: userMessageContent.length,
            didAttemptCompletion
        }, `Tool execution completed. Total tools executed: ${toolResults.length}`);
        return { toolResults, userMessageContent, didAttemptCompletion };
    }

    /**
     * Execute actions from a structured action plan
     * Used when thinking phase produces an action plan
     */
    private async executeFromPlan(
        plan: ActionStep[],
        isAborted: () => boolean,
        toolManager: IToolManager,
    ): Promise<{
        toolResults: ToolResult[];
        userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>;
        didAttemptCompletion: boolean;
        failedStep?: ActionStep;
    }> {
        const toolResults: ToolResult[] = [];
        const userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam> = [];
        let didAttemptCompletion = false;
        let failedStep: ActionStep | undefined;

        this.logger.info({ planLength: plan.length }, 'Starting execution from action plan');

        for (const step of plan) {
            if (isAborted()) {
                this.logger.info('Execution aborted');
                break;
            }

            try {
                // Check if dependencies are satisfied
                if (step.dependsOn && step.dependsOn.length > 0) {
                    const depsSatisfied = step.dependsOn.every(depId => {
                        const depResult = toolResults.find(r => r.stepId === depId);
                        return depResult?.success === true;
                    });

                    if (!depsSatisfied) {
                        this.logger.info({ stepId: step.stepId, dependsOn: step.dependsOn }, 'Skipping step due to unsatisfied dependencies');
                        continue;
                    }
                }

                this.logger.info({ stepId: step.stepId, toolName: step.toolName, reasoning: step.reasoning }, 'Executing planned action step');

                // Execute the tool
                const result = await toolManager.executeTool(step.toolName, step.parameters);

                // Get component key
                const toolSourceInfo = toolManager.getToolSource(step.toolName);
                const componentKey = toolSourceInfo?.componentKey;

                const toolResult: ToolResult = {
                    toolName: step.toolName,
                    success: true,
                    result,
                    timestamp: Date.now(),
                    componentKey,
                    stepId: step.stepId,
                };
                toolResults.push(toolResult);

                const userMessageContentItem = {
                    type: 'tool_result' as const,
                    tool_use_id: step.stepId,
                    content: JSON.stringify(result),
                };
                userMessageContent.push(userMessageContentItem);

                // Check if this was a completion step
                if (step.toolName === 'attempt_completion') {
                    didAttemptCompletion = true;
                    this.logger.info({ stepId: step.stepId }, 'Action plan completed successfully');
                    break;
                }
            } catch (error) {
                this.logger.error({ stepId: step.stepId, toolName: step.toolName, error }, 'Action step failed');

                const errorMessage = error instanceof Error ? error.message : String(error);

                // Push error to turn memory store for potential retry
                this.turnMemoryStore.pushErrors([new Error(`Action step ${step.stepId} (${step.toolName}) failed: ${errorMessage}`)]);

                const toolResult: ToolResult = {
                    toolName: step.toolName,
                    success: false,
                    result: errorMessage,
                    timestamp: Date.now(),
                    stepId: step.stepId,
                };
                toolResults.push(toolResult);

                const userMessageContentItem = {
                    type: 'tool_result' as const,
                    tool_use_id: step.stepId,
                    content: JSON.stringify({ error: errorMessage }),
                };
                userMessageContent.push(userMessageContentItem);

                // Record failed step and exit
                failedStep = step;
                break;
            }
        }

        this.logger.info({
            toolResultsCount: toolResults.length,
            completedSteps: toolResults.filter(r => r.success).length,
            failedSteps: toolResults.filter(r => !r.success).length,
            didAttemptCompletion,
        }, `Action plan execution completed. Total steps executed: ${toolResults.length}`);

        return { toolResults, userMessageContent, didAttemptCompletion, failedStep };
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
        // Ensure toolCalls is an array before iterating
        const toolCalls = response.toolCalls || [];
        for (const toolCall of toolCalls) {
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
