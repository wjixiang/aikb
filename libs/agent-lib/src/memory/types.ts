/**
 * Type definitions for memory module
 */

import { ApiMessage, ExtendedContentBlock } from '../task/task.type.js';
import { Turn, TurnStatus, ThinkingRound, ToolCallResult } from './Turn.js';
import { TurnMemoryStore } from './TurnMemoryStore.js';

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
 * Configuration for the memory module
 */
export interface MemoryModuleConfig {
    /** Maximum thinking rounds per turn (LLM controls actual rounds via continue_thinking) */
    maxThinkingRounds: number;
    /** Token budget for thinking phase */
    thinkingTokenBudget: number;
    /** Enable context recall */
    enableRecall: boolean;
    /** Maximum contexts to recall per request */
    maxRecallContexts: number;
    /** Enable automatic summarization */
    enableSummarization: boolean;
    /** Maximum recalled conversation messages to inject (default: 20) */
    maxRecalledMessages: number;
    /** API request timeout in milliseconds (default: 40000) */
    apiRequestTimeout: number;
}

/**
 * Result from thinking phase
 */
export interface ThinkingPhaseResult {
    /** Thinking rounds performed */
    rounds: ThinkingRound[];
    /** Total tokens used */
    tokensUsed: number;
    /** Whether to continue to action phase */
    shouldProceedToAction: boolean;
    /** Turn ID that was updated */
    turnId: string;
    /** Summary generated */
    summary?: string;
    /** Context snapshot stored during thinking phase */
    contextSnapshot?: { turnNumber: number; id: string };
}

/**
 * Interface for MemoryModule
 * Defines the contract for turn-based memory management
 */
export interface IMemoryModule {
    /**
     * Start a new turn
     */
    startTurn(workspaceContext: string, taskContext?: string): Turn;

    /**
     * Complete current turn
     */
    completeTurn(): void;

    /**
     * Perform thinking phase (updates current turn)
     */
    performThinkingPhase(workspaceContext: string, toolResults?: ToolCallResult[]): Promise<ThinkingPhaseResult>;

    /**
     * Add user message to current turn
     */
    addUserMessage(content: string | ExtendedContentBlock[]): ApiMessage;

    /**
     * Add assistant message to current turn
     */
    addAssistantMessage(content: string | ExtendedContentBlock[]): ApiMessage;

    /**
     * Add system message to current turn
     */
    addSystemMessage(message: string): ApiMessage;

    /**
     * Get all historical messages (flattened from all turns)
     */
    getAllMessages(): ApiMessage[];

    /**
     * Get current turn
     */
    getCurrentTurn(): Turn | null;

    /**
     * Get the turn store
     */
    getTurnStore(): TurnMemoryStore;

    /**
     * Get current configuration
     */
    getConfig(): MemoryModuleConfig;
}
