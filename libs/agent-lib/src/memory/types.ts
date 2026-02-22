/**
 * Type definitions for memory module
 */

import { ApiMessage, ExtendedContentBlock } from '../task/task.type.js';
import { Turn, TurnStatus, ThinkingRound, ToolCallResult } from './Turn.js';
import { TurnMemoryStore } from './TurnMemoryStore.js';

/**
 * Configuration for the memory module
 * Note: Thinking-related configuration has been moved to ThinkingModuleConfig
 */
export interface MemoryModuleConfig {
    /** Enable context recall */
    enableRecall: boolean;
    /** Maximum contexts to recall per request */
    maxRecallContexts: number;
    /** Maximum recalled conversation messages to inject (default: 20) */
    maxRecalledMessages: number;
}

/**
 * Result from thinking phase
 * Re-exported from thinking module for convenience
 */
export type ThinkingPhaseResult = import('../thinking/types.js').ThinkingPhaseResult;

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
     * Add message to current turn
     */
    addMessage(message: ApiMessage): ApiMessage;

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
