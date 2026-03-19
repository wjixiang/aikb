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
    /** Maximum retries per thinking round when LLM doesn't call required tools (default: 2) */
    maxRetriesPerRound: number;
    /** Delay between retries in milliseconds (default: 100) */
    retryDelayMs: number;
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
    maxRetriesPerRound: 2,
    retryDelayMs: 100,
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
    /** Thinking state built incrementally during thinking phase */
    thinkingState?: ThinkingState;
    /** Action plan extracted from thinking state */
    actionPlan?: ActionStep[];
}

/**
 * A single entry in the thought log
 */
export interface ThoughtEntry {
    /** Thought number when this entry was created */
    thoughtNumber: number;
    /** Type of update */
    updateType: 'hypothesis' | 'evidence' | 'analysis' | 'action' | 'conclusion' | 'question';
    /** Content of the entry */
    content: string;
    /** Why this update was made */
    reasoning: string;
    /** When this entry was created */
    timestamp: number;
}

/**
 * Evidence gathered during thinking
 */
export interface Evidence {
    /** Source of the evidence (e.g., tool name, article ID) */
    source: string;
    /** Content of the evidence */
    content: string;
    /** Relevance to the hypothesis */
    relevance?: string;
}

/**
 * A step in the analysis process
 */
export interface AnalysisStep {
    /** Unique step identifier */
    stepId: string;
    /** Description of the analysis step */
    description: string;
    /** Result of this analysis step (filled after execution) */
    result?: string;
}

/**
 * A planned action to be executed in action phase
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
 * Confidence level
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Thinking state - incrementally built during thinking phase
 * This is the shared state object that LLM updates via update_thinking_state tool
 */
export interface ThinkingState {
    /** Current hypothesis or assumption */
    hypothesis?: string;
    /** Whether the hypothesis has been verified */
    hypothesisVerified?: boolean;
    /** Evidence gathered */
    evidence: Evidence[];
    /** Analysis steps performed */
    analysisSteps: AnalysisStep[];
    /** Action plan for execution */
    actionPlan: ActionStep[];
    /** Conclusions reached */
    conclusions: string[];
    /** Confidence in current analysis */
    confidence: ConfidenceLevel;
    /** Questions that need to be answered */
    pendingQuestions: string[];
    /** Log of all thought updates */
    thoughtLog: ThoughtEntry[];
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
     * @param availableTools - Available action tools for planning (optional, for action plan generation)
     * @param lastToolResults - Results from previous tool executions
     */
    performThinkingPhase(
        workspaceContext: string,
        availableTools?: any[],
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
        // taskContext?: string,
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
