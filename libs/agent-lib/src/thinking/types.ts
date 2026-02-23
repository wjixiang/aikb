/**
 * Type definitions for ThinkingModule
 */

import { Turn, ThinkingRound, ToolCallResult } from '../memory/Turn.js';

/**
 * Thinking mode types
 */
export enum ThinkingMode {
    /** Standard reflective thinking mode */
    STANDARD = 'standard',
    /** Sequential thinking mode with hypothesis generation and verification */
    SEQUENTIAL = 'sequential',
}

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
    /** Thinking mode to use (standard or sequential) */
    thinkingMode: ThinkingMode;
}

/**
 * Default configuration for ThinkingModule
 */
export const defaultThinkingConfig: ThinkingModuleConfig = {
    maxThinkingRounds: 10,
    thinkingTokenBudget: 15000,
    enableSummarization: true,
    apiRequestTimeout: 40000,
    thinkingMode: ThinkingMode.STANDARD,
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
 * Sequential Thinking specific types
 */

/**
 * A single thought in the sequential thinking process
 */
export interface SequentialThought {
    /** Thought content */
    thought: string;
    /** Current thought number */
    thoughtNumber: number;
    /** Estimated total thoughts */
    totalThoughts: number;
    /** Whether another thought is needed */
    nextThoughtNeeded: boolean;
    /** Whether this thought revises previous thinking */
    isRevision?: boolean;
    /** Which thought number is being reconsidered */
    revisesThought?: number;
    /** Branching point thought number */
    branchFromThought?: number;
    /** Branch identifier */
    branchId?: string;
    /** If more thoughts are needed at the end */
    needsMoreThoughts?: boolean;
    /** Hypothesis generated (if any) */
    hypothesis?: string;
    /** Hypothesis verification result (if any) */
    hypothesisVerified?: boolean;
}

/**
 * Sequential thinking state
 */
export interface SequentialThinkingState {
    /** All thoughts in sequence */
    thoughts: SequentialThought[];
    /** Active branches */
    branches: Map<string, SequentialThought[]>;
    /** Current thought number */
    currentThoughtNumber: number;
    /** Current estimated total thoughts */
    currentTotalThoughts: number;
    /** Active branch ID */
    activeBranchId?: string;
}

/**
 * Hypothesis verification result
 */
export interface HypothesisVerification {
    /** The hypothesis being verified */
    hypothesis: string;
    /** Whether the hypothesis is verified */
    verified: boolean;
    /** Confidence level (0-1) */
    confidence: number;
    /** Reasoning for verification */
    reasoning: string;
    /** Thoughts used for verification */
    supportingThoughts: number[];
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
     * Perform sequential thinking phase
     * @param workspaceContext - Current workspace state
     * @param taskContext - Optional task context (user's goal)
     * @param initialState - Optional initial state for sequential thinking
     */
    performSequentialThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        initialState?: SequentialThinkingState
    ): Promise<ThinkingPhaseResult & { sequentialState: SequentialThinkingState }>;

    /**
     * Get current configuration
     */
    getConfig(): ThinkingModuleConfig;

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ThinkingModuleConfig>): void;
}
