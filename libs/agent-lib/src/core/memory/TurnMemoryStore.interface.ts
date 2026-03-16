/**
 * ITurnMemoryStore - Interface for Turn-based memory storage
 *
 * This interface defines the contract for managing conversation turns.
 * Each turn encapsulates all messages, context, and metadata for that interaction cycle.
 *
 * Implementations should maintain:
 * - Complete history of all turns in the conversation
 * - Turn metadata including status, messages, and token usage
 * - Thinking phase results and tool call results
 * - Summary and insights for each turn
 */

import { ApiMessage } from './types.js';
import {
    Turn,
    TurnStatus,
    TurnMemoryExport,
    ThinkingRound,
    ToolCallResult
} from './Turn.js';

export interface ITurnMemoryStore {
    /**
     * Push errors to be saved for later retrieval
     * @param errors - Array of Error objects to store
     */
    pushErrors(errors: Error[]): void;

    popErrors(): Error[];

    /**
     * Create a new turn with the given context
     * @param workspaceContext - The workspace context for this turn
     * @param taskContext - Optional user's initial goal/query
     * @returns The newly created Turn
     */
    createTurn(workspaceContext: string): Turn;

    /**
     * Update the status of a turn
     * @param turnId - The ID of the turn to update
     * @param status - The new status to set
     * @throws Error if turn is not found
     */
    updateTurnStatus(turnId: string, status: TurnStatus): void;

    /**
     * Add a message to a turn
     * @param turnId - The ID of the turn
     * @param message - The message to add
     * @throws Error if turn is not found
     */
    addMessageToTurn(turnId: string, message: ApiMessage): void;

    /**
     * Store thinking phase results for a turn
     * @param turnId - The ID of the turn
     * @param rounds - Array of thinking rounds
     * @param tokensUsed - Total tokens used during thinking phase
     * @throws Error if turn is not found
     */
    storeThinkingPhase(
        turnId: string,
        rounds: ThinkingRound[],
        tokensUsed: number
    ): void;

    /**
     * Add a tool call result to a turn
     * @param turnId - The ID of the turn
     * @param toolCall - The tool call result to add
     * @throws Error if turn is not found
     */
    addToolCallResult(turnId: string, toolCall: ToolCallResult): void;

    /**
     * Store summary and insights for a turn
     * @param turnId - The ID of the turn
     * @param summary - The summary text
     * @param insights - Array of insights extracted
     * @throws Error if turn is not found
     */
    storeSummary(turnId: string, summary: string, insights: string[]): void;

    /**
     * Update action phase token usage for a turn
     * @param turnId - The ID of the turn
     * @param tokens - Number of tokens used during action phase
     * @throws Error if turn is not found
     */
    updateActionTokens(turnId: string, tokens: number): void;

    /**
     * Get a turn by its ID
     * @param turnId - The ID of the turn
     * @returns The turn if found, undefined otherwise
     */
    getTurn(turnId: string): Turn | undefined;

    /**
     * Get a turn by its number
     * @param turnNumber - The turn number
     * @returns The turn if found, undefined otherwise
     */
    getTurnByNumber(turnNumber: number): Turn | undefined;

    /**
     * Get all turns in chronological order
     * @returns Array of all turns sorted by turn number
     */
    getAllTurns(): Turn[];

    /**
     * Get the most recent N turns
     * @param count - Number of recent turns to retrieve
     * @returns Array of recent turns
     */
    getRecentTurns(count: number): Turn[];

    /**
     * Get all messages from all turns (flattened)
     * @returns Array of all messages
     */
    getAllMessages(): ApiMessage[];

    /**
     * Get messages from the last N turns
     * @param turnCount - Number of recent turns to get messages from
     * @returns Array of messages from recent turns
     */
    getRecentMessages(turnCount: number): ApiMessage[];

    /**
     * Search turns by keyword in summary or insights
     * @param keyword - The keyword to search for
     * @returns Array of matching turns sorted by turn number
     */
    searchTurns(keyword: string): Turn[];

    /**
     * Get the current turn number
     * @returns The current turn number
     */
    getCurrentTurnNumber(): number;

    /**
     * Get all summaries in chronological order
     * @returns Array of objects containing turn number, summary, and insights
     */
    getAllSummaries(): Array<{ turnNumber: number; summary: string; insights: string[] }>;

    /**
     * Export the entire memory state
     * @returns Object containing all turns and current turn number
     */
    export(): TurnMemoryExport;

    /**
     * Import memory state
     * @param data - The memory data to import
     */
    import(data: TurnMemoryExport): void;

    /**
     * Clear all data from the store
     */
    clear(): void;
}
