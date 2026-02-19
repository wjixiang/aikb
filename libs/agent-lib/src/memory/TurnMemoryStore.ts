/**
 * TurnMemoryStore - Manages Turn-based memory storage
 *
 * This store maintains a complete history of all turns in the conversation.
 * Each turn encapsulates all messages, context, and metadata for that interaction cycle.
 */

import { ApiMessage } from '../task/task.type.js';
import {
    Turn,
    TurnStatus,
    TurnMemoryExport,
    ThinkingRound,
    ToolCallResult
} from './Turn.js';

export class TurnMemoryStore {
    private turns: Map<string, Turn> = new Map();
    private turnNumberToId: Map<number, string> = new Map();
    private currentTurnNumber: number = 0;

    /**
     * Create a new turn
     */
    createTurn(workspaceContext: string, taskContext?: string): Turn {
        this.currentTurnNumber++;

        const turn: Turn = {
            id: `turn_${this.currentTurnNumber}_${Date.now()}`,
            turnNumber: this.currentTurnNumber,
            timestamp: Date.now(),
            status: TurnStatus.PENDING,
            messages: [],
            workspaceContext,  // Immutable after creation
            taskContext,       // User's initial goal/query
            toolCalls: [],
            tokenUsage: {
                thinking: 0,
                action: 0,
                total: 0,
            },
        };

        this.turns.set(turn.id, turn);
        this.turnNumberToId.set(this.currentTurnNumber, turn.id);

        return turn;
    }

    /**
     * Update turn status
     */
    updateTurnStatus(turnId: string, status: TurnStatus): void {
        const turn = this.turns.get(turnId);
        if (!turn) {
            throw new Error(`Turn ${turnId} not found`);
        }
        turn.status = status;
    }

    /**
     * Add message to turn
     */
    addMessageToTurn(turnId: string, message: ApiMessage): void {
        const turn = this.turns.get(turnId);
        if (!turn) {
            throw new Error(`Turn ${turnId} not found`);
        }

        const messageWithTs: ApiMessage = {
            ...message,
            ts: Date.now(),
        };

        turn.messages.push(messageWithTs);
    }

    /**
     * Store thinking phase result
     */
    storeThinkingPhase(
        turnId: string,
        rounds: ThinkingRound[],
        tokensUsed: number
    ): void {
        const turn = this.turns.get(turnId);
        if (!turn) {
            throw new Error(`Turn ${turnId} not found`);
        }

        turn.thinkingPhase = {
            rounds,
            tokensUsed,
        };

        turn.tokenUsage.thinking = tokensUsed;
        turn.tokenUsage.total += tokensUsed;
    }

    /**
     * Add tool call result
     */
    addToolCallResult(turnId: string, toolCall: ToolCallResult): void {
        const turn = this.turns.get(turnId);
        if (!turn) {
            throw new Error(`Turn ${turnId} not found`);
        }
        turn.toolCalls.push(toolCall);
    }

    /**
     * Store summary and insights
     */
    storeSummary(turnId: string, summary: string, insights: string[]): void {
        const turn = this.turns.get(turnId);
        if (!turn) {
            throw new Error(`Turn ${turnId} not found`);
        }
        turn.summary = summary;
        turn.insights = insights;
    }

    /**
     * Update action phase token usage
     */
    updateActionTokens(turnId: string, tokens: number): void {
        const turn = this.turns.get(turnId);
        if (!turn) {
            throw new Error(`Turn ${turnId} not found`);
        }
        turn.tokenUsage.action = tokens;
        turn.tokenUsage.total = turn.tokenUsage.thinking + tokens;
    }

    /**
     * Get turn by ID
     */
    getTurn(turnId: string): Turn | undefined {
        return this.turns.get(turnId);
    }

    /**
     * Get turn by number
     */
    getTurnByNumber(turnNumber: number): Turn | undefined {
        const turnId = this.turnNumberToId.get(turnNumber);
        return turnId ? this.turns.get(turnId) : undefined;
    }

    /**
     * Get all turns in chronological order
     */
    getAllTurns(): Turn[] {
        return Array.from(this.turns.values())
            .sort((a, b) => a.turnNumber - b.turnNumber);
    }

    /**
     * Get recent turns (last N turns)
     */
    getRecentTurns(count: number): Turn[] {
        const allTurns = this.getAllTurns();
        return allTurns.slice(-count);
    }

    /**
     * Get all messages (flattened from all turns)
     */
    getAllMessages(): ApiMessage[] {
        const allTurns = this.getAllTurns();
        return allTurns.flatMap(turn => turn.messages);
    }

    /**
     * Get recent messages (from last N turns)
     */
    getRecentMessages(turnCount: number): ApiMessage[] {
        const recentTurns = this.getRecentTurns(turnCount);
        return recentTurns.flatMap(turn => turn.messages);
    }

    /**
     * Search turns by keyword (in summary or insights)
     */
    searchTurns(keyword: string): Turn[] {
        const lowerKeyword = keyword.toLowerCase();
        return Array.from(this.turns.values())
            .filter(turn => {
                if (turn.summary?.toLowerCase().includes(lowerKeyword)) {
                    return true;
                }
                if (turn.insights?.some(i => i.toLowerCase().includes(lowerKeyword))) {
                    return true;
                }
                return false;
            })
            .sort((a, b) => a.turnNumber - b.turnNumber);
    }

    /**
     * Get current turn number
     */
    getCurrentTurnNumber(): number {
        return this.currentTurnNumber;
    }

    /**
     * Get all summaries in chronological order
     */
    getAllSummaries(): Array<{ turnNumber: number; summary: string; insights: string[] }> {
        return this.getAllTurns()
            .filter(turn => turn.summary)
            .map(turn => ({
                turnNumber: turn.turnNumber,
                summary: turn.summary!,
                insights: turn.insights || [],
            }));
    }

    /**
     * Export memory state
     */
    export(): TurnMemoryExport {
        return {
            turns: this.getAllTurns(),
            currentTurnNumber: this.currentTurnNumber,
        };
    }

    /**
     * Import memory state
     */
    import(data: TurnMemoryExport): void {
        this.clear();

        for (const turn of data.turns) {
            this.turns.set(turn.id, turn);
            this.turnNumberToId.set(turn.turnNumber, turn.id);
        }

        this.currentTurnNumber = data.currentTurnNumber;
    }

    /**
     * Clear all data
     */
    clear(): void {
        this.turns.clear();
        this.turnNumberToId.clear();
        this.currentTurnNumber = 0;
    }
}
