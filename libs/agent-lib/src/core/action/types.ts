/**
 * Type definitions for ActionModule
 */

import { ApiMessage } from '../memory/types.js';
import type { ApiResponse, ChatCompletionTool } from '../api-client/index.js';
import { ToolUsage } from '../types/index.js';
import type { IToolManager } from '../tools/index.js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Configuration for the action module
 */
export interface ActionModuleConfig {
    /** API request timeout in milliseconds */
    apiRequestTimeout: number;
    /** Maximum retry attempts for failed tool executions */
    maxToolRetryAttempts: number;
    /** Enable parallel tool execution */
    enableParallelExecution: boolean;
    /** Maximum retry attempts for failed API requests */
    maxApiRetryAttempts: number;
    /** Delay between API retry attempts in milliseconds */
    apiRetryDelayMs: number;
}

/**
 * Tool result from execution
 */
export interface ToolResult {
    toolName: string;
    success: boolean;
    result: any;
    timestamp: number;
    /** Component key that provided this tool (if applicable) */
    componentKey?: string;
    /** Step ID for planned actions (if applicable) */
    stepId?: string;
}

/**
 * A planned action step from thinking phase action plan
 */
export interface ActionStep {
    /** Unique step identifier */
    stepId: string;
    /** Tool name to execute */
    toolName: string;
    /** Tool parameters */
    parameters: Record<string, any>;
    /** Why this action is needed */
    reasoning: string;
    /** Step IDs this action depends on */
    dependsOn?: string[];
    /** Status of this step */
    status: 'planned' | 'completed' | 'failed';
}

/**
 * Result from action phase
 */
export interface ActionPhaseResult {
    /** API response from LLM */
    apiResponse: ApiResponse;
    /** Tool execution results */
    toolResults: ToolResult[];
    /** Whether task completion was attempted */
    didAttemptCompletion: boolean;
    /** Assistant message to add to history */
    assistantMessage: ApiMessage;
    /** User message content (tool results) to add to history */
    userMessageContent: Array<Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam>;
    /** Tokens used in action phase */
    tokensUsed: number;
    /** Tool usage statistics */
    toolUsage: ToolUsage;
}

/**
 * Interface for ActionModule
 * Defines the contract for action phase management
 */
export interface IActionModule {
    /**
     * Perform action phase
     * @param workspaceContext - Current workspace state
     * @param systemPrompt - System prompt for the request
     * @param conversationHistory - Conversation history for the request
     * @param tools - Available tools for execution
     * @param isAborted - Callback to check if task is aborted
     * @param toolManager - Optional tool manager to use for tool execution.
     *                      If provided, this will be used instead of the injected one.
     *                      This ensures tools registered in the workspace are available.
     * @param actionPlan - Optional structured action plan from thinking phase.
     *                      If provided, actions will be executed according to the plan.
     */
    performActionPhase(
        workspaceContext: string,
        systemPrompt: string,
        conversationHistory: ApiMessage[],
        tools: ChatCompletionTool[],
        isAborted: () => boolean,
        toolManager?: IToolManager,
        actionPlan?: ActionStep[]
    ): Promise<ActionPhaseResult>;

    /**
     * Get current configuration
     */
    getConfig(): ActionModuleConfig;

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ActionModuleConfig>): void;
}
