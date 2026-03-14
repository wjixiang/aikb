/**
 * Turn-based MemoryModule - Manages conversation memory with Turn as the core unit
 *
 * This module manages:
 * 1. Turn lifecycle (start → thinking → acting → executing → complete)
 * 2. Messages within each turn
 * 3. Workspace context snapshots per turn
 * 4. Summaries and insights per turn
 * 5. Delegates thinking phase to ThinkingModule
 */

import { injectable, inject, optional } from 'inversify';
import { ApiMessage, ExtendedContentBlock, MessageBuilder } from '../task/task.type.js';
import type { ITurnMemoryStore } from './TurnMemoryStore.interface.js';
import { Turn, TurnStatus, ThinkingRound, ToolCallResult } from './Turn.js';
import type { IMemoryModule, MemoryModuleConfig } from './types.js';
import { TYPES } from '../di/types.js';
// Define Logger type locally to avoid pino ESM import issues
type Logger = import('pino').Logger;
import type { IThinkingModule, ThinkingPhaseResult } from '../thinking/types.js';

// Re-export types for backward compatibility
export type { ThinkingPhaseResult, MemoryModuleConfig };

/**
 * Default configuration for MemoryModule
 * Note: Thinking-related configuration has been moved to ThinkingModuleConfig
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
    enableRecall: true,
    maxRecallContexts: 3,
    maxRecalledMessages: 20,
};

/**
 * Turn-based MemoryModule
 */
@injectable()
export class MemoryModule implements IMemoryModule {
    private config: MemoryModuleConfig;
    private turnStore: ITurnMemoryStore;
    private thinkingModule: IThinkingModule;

    // Current active turn
    private currentTurn: Turn | null = null;

    // Recalled messages (temporary storage for next prompt)
    private recalledMessages: ApiMessage[] = [];

    constructor(
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.MemoryModuleConfig) @optional() config: Partial<MemoryModuleConfig> = {},
        @inject(TYPES.ITurnMemoryStore) turnStore: ITurnMemoryStore,
        @inject(TYPES.IThinkingModule) thinkingModule: IThinkingModule,
    ) {
        this.config = { ...defaultMemoryConfig, ...config };
        this.turnStore = turnStore;
        this.thinkingModule = thinkingModule;
    }

    /**
     * Get the turn store
     */
    getTurnStore(): ITurnMemoryStore {
        return this.turnStore;
    }

    /**
     * Get current configuration
     */
    getConfig(): MemoryModuleConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<MemoryModuleConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // ==================== Turn Lifecycle Management ====================

    /**
     * Start a new turn
     */
    startTurn(workspaceContext: string, taskContext?: string): Turn {
        this.logger.debug(`[MemoryModule] startTurn called, taskContext: ${taskContext ? 'provided' : 'none'}`);

        // Complete previous turn if exists
        if (this.currentTurn && this.currentTurn.status !== TurnStatus.COMPLETED) {
            this.logger.warn(`[MemoryModule] Previous turn ${this.currentTurn.id} was not completed, completing now`);
            this.completeTurn();
        }

        // Create new turn with current workspace context and optional task context
        const turn = this.turnStore.createTurn(workspaceContext, taskContext);
        this.logger.debug(`[MemoryModule] New turn created: ${turn.id}, turnNumber: ${turn.turnNumber}`);
        this.currentTurn = turn;

        return turn;
    }

    /**
     * Complete current turn (no parameters needed - workspace context is immutable)
     */
    completeTurn(): void {
        if (!this.currentTurn) {
            console.warn('No active turn to complete');
            return;
        }

        const turnId = this.currentTurn.id;
        this.logger.debug(`[MemoryModule] Completing turn: ${turnId}`);

        // Update status
        this.turnStore.updateTurnStatus(this.currentTurn.id, TurnStatus.COMPLETED);

        // Clear current turn
        this.currentTurn = null;

        this.logger.debug(`[MemoryModule] Turn completed: ${turnId}`);
    }

    /**
     * Get current turn
     */
    getCurrentTurn(): Turn | null {
        return this.currentTurn;
    }

    // ==================== Message Management (through Turn) ====================

    /**
     * Add message to current turn
     * @returns The added message
     */
    addMessage(message: ApiMessage): ApiMessage {
        this.logger.debug(`[MemoryModule] addMessage called with role: ${message.role}`)
        if (!this.currentTurn) {
            this.logger.error(`[MemoryModule] No active turn when trying to add message`)
            throw new Error('No active turn. Call startTurn() first.');
        }
        this.logger.debug(`[MemoryModule] add message to turn, turnId: ${this.currentTurn.id}`)
        this.turnStore.addMessageToTurn(this.currentTurn.id, message);
        this.logger.debug(`[MemoryModule] add message to turn successfully: ${message.content.map(e => e.type)}`)
        this.logger.debug(`[MemoryModule] addMessage returning`)
        return message;
    }

    // ==================== History Retrieval ====================

    /**
     * Get all historical messages (flattened from all turns)
     */
    getAllMessages(): ApiMessage[] {
        return this.turnStore.getAllMessages();
    }

    /**
     * Get history for prompt injection (based on strategy)
     */
    getHistoryForPrompt(): ApiMessage[] {
        // Return recalled messages if any, otherwise empty (summary-only mode)
        return [...this.recalledMessages];
    }

    /**
     * Recall specific turns by turn numbers
     */
    recallTurns(turnNumbers: number[]): ApiMessage[] {
        const recalled: ApiMessage[] = [];

        for (const turnNum of turnNumbers) {
            const turn = this.turnStore.getTurnByNumber(turnNum);
            if (turn) {
                recalled.push(...turn.messages);
            }
        }

        // Limit to maxRecalledMessages
        const limited = recalled.slice(0, this.config.maxRecalledMessages);

        // Store for next prompt
        this.recalledMessages = limited;

        return limited;
    }

    /**
     * Clear recalled messages
     */
    clearRecalledMessages(): void {
        this.recalledMessages = [];
    }

    /**
     * Get accumulated summaries for prompt injection
     */
    getAccumulatedSummaries(): string {
        const summaries = this.turnStore.getAllSummaries();

        if (summaries.length === 0) {
            return '';
        }

        const summaryText = summaries
            .map(s => {
                const insights = s.insights.length > 0
                    ? `\nInsights: ${s.insights.join('; ')}`
                    : '';
                return `[Turn ${s.turnNumber}] ${s.summary}${insights}`;
            })
            .join('\n\n');

        return `
=== ACCUMULATED MEMORY SUMMARIES ===
${summaryText}
`;
    }

    // ==================== Thinking Phase ====================

    /**
     * Perform thinking phase (updates current turn)
     * Delegates to ThinkingModule for the actual thinking logic
     * Note: ThinkingModule will access TurnMemoryStore directly for summaries/history
     */
    async performThinkingPhase(
        workspaceContext: string,
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult> {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        // Update turn status
        this.turnStore.updateTurnStatus(this.currentTurn.id, TurnStatus.THINKING);

        // Delegate to ThinkingModule
        // ThinkingModule will access TurnMemoryStore directly for:
        // - accumulatedSummaries (via getAllSummaries())
        // - conversation history (via getAllMessages())
        const result = await this.thinkingModule.performThinkingPhase(
            workspaceContext,
            this.currentTurn.taskContext,  // Pass task context
            [],  // previousRounds - empty for new phase
            lastToolResults
        );

        // Store thinking phase in turn
        this.turnStore.storeThinkingPhase(
            this.currentTurn.id,
            result.rounds,
            result.tokensUsed
        );

        // Store summary if available
        if (result.summary) {
            this.turnStore.storeSummary(
                this.currentTurn.id,
                result.summary,
                []  // insights - extracted by ThinkingModule
            );
        }

        return result;
    }

    // ==================== Tool Call Recording ====================

    /**
     * Record tool call result to current turn
     */
    recordToolCall(toolName: string, success: boolean, result: any): void {
        this.logger.debug(`[MemoryModule] recordToolCall called with toolName: ${toolName}`)
        if (!this.currentTurn) {
            this.logger.error('[MemoryModule] No active turn to record tool call');
            console.warn('No active turn to record tool call');
            return;
        }

        const toolCall: ToolCallResult = {
            toolName,
            success,
            result,
            timestamp: Date.now(),
        };

        this.logger.debug(`[MemoryModule] About to add tool call result to turn`)
        this.turnStore.addToolCallResult(this.currentTurn.id, toolCall);
        this.logger.debug(`[MemoryModule] Tool call result added successfully`)
    }

    // ==================== Import/Export ====================

    /**
     * Export memory state
     */
    export() {
        return this.turnStore.export();
    }

    /**
     * Import memory state
     */
    import(data: any) {
        this.turnStore.import(data);
        this.currentTurn = null;
    }

    /**
     * Clear all memory
     */
    clear() {
        this.turnStore.clear();
        this.currentTurn = null;
        this.recalledMessages = [];
    }
}

