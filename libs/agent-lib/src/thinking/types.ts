/**
 * Type definitions for ThinkingModule
 */

import { Turn, ThinkingRound, ToolCallResult } from '../memory/Turn.js';

/**
 * Configuration for the thinking module
 */
export interface ThinkingModuleConfig {
    /** Maximum thinking rounds per turn (LLM controls actual rounds via continue_thinking) */
    maxThinkingRounds: number;
    /** Token budget for thinking phase */
    thinkingTokenBudget: number;
    /** Enable automatic summarization */
    enableSummarization: boolean;
    /** API request timeout in milliseconds (default: 40000) */
    apiRequestTimeout: number;
}

/**
 * Default configuration for ThinkingModule
 */
export const defaultThinkingConfig: ThinkingModuleConfig = {
    maxThinkingRounds: 3,
    thinkingTokenBudget: 10000,
    enableSummarization: true,
    apiRequestTimeout: 40000,
};

/**
 * Result from thinking phase
 */
export interface ThinkingPhaseResult {
    /** Thinking rounds performed */
    rounds: ThinkingRound[];
    /** Total tokens used */
    tokensUsed: number;
    /** Whether to proceed to action phase */
    shouldProceedToAction: boolean;
    /** Summary generated */
    summary?: string;
}

/**
 * Request parameters for recalling historical contexts
 */
export interface RecallRequest {
    /** Turn numbers to recall */
    turnNumbers?: number[];
    /** Context IDs to recall */
    contextIds?: string[];
    /** Keywords to search in summaries */
    keywords?: string[];
}

/**
 * Interface for ThinkingModule
 * Defines the contract for thinking phase management
 */
export interface IThinkingModule {
    /**
     * Perform thinking phase
     * @param workspaceContext - Current workspace state
     * @param taskContext - Optional task context (user's goal)
     * @param previousRounds - Previous thinking rounds in current phase
     * @param lastToolResults - Results from previous tool executions
     */
    performThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        previousRounds?: ThinkingRound[],
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult>;

    /**
     * Get current configuration
     */
    getConfig(): ThinkingModuleConfig;

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ThinkingModuleConfig>): void;
}
