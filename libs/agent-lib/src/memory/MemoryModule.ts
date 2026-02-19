/**
 * Turn-based MemoryModule - Manages conversation memory with Turn as the core unit
 *
 * This module manages:
 * 1. Turn lifecycle (start → thinking → acting → executing → complete)
 * 2. Messages within each turn
 * 3. Workspace context snapshots per turn
 * 4. Summaries and insights per turn
 * 5. Reflective thinking (optional)
 */

import { ApiMessage, MessageBuilder } from '../task/task.type.js';
import { TurnMemoryStore } from './TurnMemoryStore.js';
import { Turn, TurnStatus, ThinkingRound, ToolCallResult } from './Turn.js';
import type { ApiClient, ChatCompletionTool } from '../api-client/index.js';

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
}

/**
 * Default configuration
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
    maxThinkingRounds: 3,
    thinkingTokenBudget: 10000,
    enableRecall: true,
    maxRecallContexts: 3,
    enableSummarization: true,
    maxRecalledMessages: 20,
};

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
}

/**
 * Turn-based MemoryModule
 */
export class MemoryModule {
    private config: MemoryModuleConfig;
    private turnStore: TurnMemoryStore;
    private apiClient: ApiClient;

    // Current active turn
    private currentTurn: Turn | null = null;

    // Recalled messages (temporary storage for next prompt)
    private recalledMessages: ApiMessage[] = [];

    constructor(apiClient: ApiClient, config: Partial<MemoryModuleConfig> = {}) {
        this.config = { ...defaultMemoryConfig, ...config };
        this.turnStore = new TurnMemoryStore();
        this.apiClient = apiClient;
    }

    /**
     * Get the turn store
     */
    getTurnStore(): TurnMemoryStore {
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
        // Complete previous turn if exists
        if (this.currentTurn && this.currentTurn.status !== TurnStatus.COMPLETED) {
            console.warn(`Previous turn ${this.currentTurn.id} was not completed, completing now`);
            this.completeTurn();
        }

        // Create new turn with current workspace context and optional task context
        const turn = this.turnStore.createTurn(workspaceContext, taskContext);
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

        // Update status
        this.turnStore.updateTurnStatus(this.currentTurn.id, TurnStatus.COMPLETED);

        // Clear current turn
        this.currentTurn = null;
    }

    /**
     * Get current turn
     */
    getCurrentTurn(): Turn | null {
        return this.currentTurn;
    }

    // ==================== Message Management (through Turn) ====================

    /**
     * Add user message to current turn
     */
    addUserMessage(content: string | any[]): void {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        const message = typeof content === 'string'
            ? MessageBuilder.user(content)
            : MessageBuilder.custom('user', content);

        this.turnStore.addMessageToTurn(this.currentTurn.id, message);
    }

    /**
     * Add assistant message to current turn
     */
    addAssistantMessage(content: any[]): void {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        this.turnStore.addMessageToTurn(
            this.currentTurn.id,
            MessageBuilder.custom('assistant', content)
        );
    }

    /**
     * Add system message to current turn
     */
    addSystemMessage(content: string): void {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        this.turnStore.addMessageToTurn(
            this.currentTurn.id,
            MessageBuilder.system(content)
        );
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
     * Always performs reflective thinking - LLM controls rounds via continue_thinking tool
     */
    async performThinkingPhase(
        workspaceContext: string,
        lastToolResults?: any[]
    ): Promise<ThinkingPhaseResult> {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        // Update turn status
        this.turnStore.updateTurnStatus(this.currentTurn.id, TurnStatus.THINKING);

        // Perform reflective thinking - LLM controls when to stop
        const rounds: ThinkingRound[] = [];
        let totalTokens = 0;
        let continueThinking = true;
        let currentRound = 0;

        while (
            continueThinking &&
            currentRound < this.config.maxThinkingRounds &&
            totalTokens < this.config.thinkingTokenBudget
        ) {
            currentRound++;

            const round = await this.performSingleThinkingRound(
                currentRound,
                workspaceContext,
                rounds
            );

            rounds.push(round);
            totalTokens += round.tokens;
            continueThinking = round.continueThinking;
        }

        // Store thinking phase in turn
        this.turnStore.storeThinkingPhase(this.currentTurn.id, rounds, totalTokens);

        // Generate summary if enabled
        let summary: string | undefined;
        if (this.config.enableSummarization) {
            summary = await this.generateSummary(
                workspaceContext,
                rounds,
                lastToolResults
            );

            if (summary) {
                this.turnStore.storeSummary(
                    this.currentTurn.id,
                    summary,
                    this.extractInsights(rounds)
                );
            }
        }

        return {
            rounds,
            tokensUsed: totalTokens,
            shouldProceedToAction: true,
            turnId: this.currentTurn.id,
            summary,
        };
    }

    /**
     * Perform a single thinking round
     */
    async performSingleThinkingRound(
        roundNumber: number,
        workspaceContext: string,
        previousRounds: ThinkingRound[]
    ): Promise<ThinkingRound> {
        const prompt = this.buildThinkingPrompt(
            roundNumber,
            workspaceContext,
            previousRounds
        );

        const tools = this.buildThinkingTools();

        try {
            const response = await this.apiClient.makeRequest(
                prompt.systemPrompt,
                prompt.context,
                prompt.history,
                { timeout: 30000 },
                tools
            );

            const content = this.extractContent(response);
            const controlDecision = this.extractControlDecision(response);
            const recallRequest = this.extractRecallRequest(response);

            const recalledContexts = recallRequest
                ? this.handleRecall(recallRequest)
                : [];

            return {
                roundNumber,
                content,
                continueThinking: controlDecision?.continueThinking ?? false,
                recalledContexts,
                tokens: this.estimateTokens(content),
            };
        } catch (error) {
            console.error('Thinking round failed:', error);
            return {
                roundNumber,
                content: 'Thinking round failed',
                continueThinking: false,
                recalledContexts: [],
                tokens: 0,
            };
        }
    }

    /**
     * Build thinking prompt
     */
    private buildThinkingPrompt(
        roundNumber: number,
        workspaceContext: string,
        previousRounds: ThinkingRound[]
    ): { systemPrompt: string; context: string; history: string[] } {
        const systemPrompt = `You are in the THINKING phase of an agent framework.

Your task is to:
1. Understand the user's overall task/goal
2. Analyze the current situation based on conversation history and workspace context
3. Review accumulated summaries from previous turns
4. Decide whether to continue thinking or proceed to action
5. Optionally recall historical contexts if needed

You have access to these tools:
- continue_thinking: Decide whether to continue thinking or proceed to action
- recall_context: Recall historical workspace contexts by turn number, ID, or keyword

Think deeply about:
- What the user wants to accomplish (the overall goal)
- What has been accomplished so far
- What needs to be done next
- What information is missing
- Whether you need to recall any historical context
- Whether you have enough understanding to take action

Current thinking round: ${roundNumber}/${this.config.maxThinkingRounds}`;

        const accumulatedSummaries = this.getAccumulatedSummaries();

        // Get task context from current turn
        const taskContext = this.currentTurn?.taskContext
            ? `\n=== TASK CONTEXT ===\nUser's Goal: ${this.currentTurn.taskContext}\n`
            : '';

        const context = `${taskContext}
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRounds.map(r => `Round ${r.roundNumber}: ${r.content}`).join('\n\n')}
`;

        const allMessages = this.turnStore.getAllMessages();
        const history = allMessages.map(msg => {
            const role = msg.role;
            const content = msg.content
                .filter(block => block.type === 'text')
                .map(block => (block as any).text)
                .join('\n');
            return `<${role}>\n${content}\n</${role}>`;
        });

        return { systemPrompt, context, history };
    }

    /**
     * Build thinking tools
     */
    private buildThinkingTools(): ChatCompletionTool[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'continue_thinking',
                    description: 'Decide whether to continue thinking or proceed to action phase',
                    parameters: {
                        type: 'object',
                        properties: {
                            continueThinking: {
                                type: 'boolean',
                                description: 'Whether to continue thinking (true) or proceed to action (false)',
                            },
                            reason: {
                                type: 'string',
                                description: 'Reason for the decision',
                            },
                            nextFocus: {
                                type: 'string',
                                description: 'What to focus on in the next thinking round (if continuing)',
                            },
                        },
                        required: ['continueThinking', 'reason'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'recall_context',
                    description: 'Recall historical workspace contexts for reference',
                    parameters: {
                        type: 'object',
                        properties: {
                            turnNumbers: {
                                type: 'array',
                                items: { type: 'number' },
                                description: 'Turn numbers to recall',
                            },
                            contextIds: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Context IDs to recall',
                            },
                            keywords: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Keywords to search in summaries',
                            },
                        },
                    },
                },
            },
        ];
    }

    /**
     * Handle context recall
     */
    private handleRecall(request: any): Turn[] {
        if (!this.config.enableRecall) {
            return [];
        }

        const recalled: Turn[] = [];

        if (request.turnNumbers) {
            for (const turn of request.turnNumbers) {
                const t = this.turnStore.getTurnByNumber(turn);
                if (t) recalled.push(t);
            }
        }

        if (request.keywords) {
            for (const keyword of request.keywords) {
                const turns = this.turnStore.searchTurns(keyword);
                recalled.push(...turns);
            }
        }

        return recalled.slice(0, this.config.maxRecallContexts);
    }

    // ==================== Tool Call Recording ====================

    /**
     * Record tool call result to current turn
     */
    recordToolCall(toolName: string, success: boolean, result: any): void {
        if (!this.currentTurn) {
            console.warn('No active turn to record tool call');
            return;
        }

        const toolCall: ToolCallResult = {
            toolName,
            success,
            result,
            timestamp: Date.now(),
        };

        this.turnStore.addToolCallResult(this.currentTurn.id, toolCall);
    }

    // ==================== Summary Generation ====================

    /**
     * Generate summary for current turn (based on thinking rounds)
     */
    private async generateSummary(
        workspaceContext: string,
        thinkingRounds: ThinkingRound[],
        toolResults?: any[]
    ): Promise<string> {
        // Get previous summaries for context continuity
        const previousSummaries = this.getAccumulatedSummaries();

        const summaryPrompt = `Generate a DETAILED summary of what happened in this turn.

${previousSummaries}

WORKSPACE CONTEXT:
${workspaceContext.substring(0, 1000)}...

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content.substring(0, 500)}`).join('\n\n')}

TOOL RESULTS:
${toolResults?.map(r => {
    const resultStr = typeof r.result === 'object'
        ? JSON.stringify(r.result).substring(0, 300)
        : String(r.result).substring(0, 300);
    return `${r.toolName}: ${r.success ? 'success' : 'failed'}\nResult: ${resultStr}`;
}).join('\n\n') || 'None'}

Generate a DETAILED summary (5-8 sentences) that includes:
1. What specific actions were taken (be specific about tools used, parameters, search terms, etc.)
2. What concrete results were obtained (include key numbers, counts, findings, data points)
3. What decisions were made and the reasoning behind them
4. What challenges or issues were encountered (if any)
5. What the next steps or implications might be

The summary should preserve important details like:
- Specific search terms, keywords, or queries used
- Exact numbers (article counts, data points, measurements)
- Names of tools, databases, or resources accessed
- Key findings or insights discovered
- Specific actions taken and their outcomes

If this turn builds upon previous turns, mention the connection and how it advances the overall task.`;

        try {
            const response = await this.apiClient.makeRequest(
                'You are a detailed summarization assistant. Generate comprehensive summaries that preserve important details and maintain narrative continuity.',
                summaryPrompt,
                [],
                { timeout: 30000 },  // Increased timeout for longer summaries
                []
            );

            return this.extractContent(response);
        } catch (error) {
            console.error('Summary generation failed:', error);
            return 'Summary generation failed';
        }
    }

    /**
     * Extract insights from thinking rounds
     */
    private extractInsights(rounds: ThinkingRound[]): string[] {
        const insights: string[] = [];

        for (const round of rounds) {
            // Extract key phrases (simple heuristic)
            const sentences = round.content.split(/[.!?]+/);
            for (const sentence of sentences) {
                if (sentence.length > 20 && sentence.length < 100) {
                    insights.push(sentence.trim());
                }
            }
        }

        return insights.slice(0, 5); // Keep top 5 insights
    }

    // ==================== Helper Methods ====================

    /**
     * Extract content from API response
     */
    private extractContent(response: any): string {
        if (response.content) {
            return response.content;
        }
        if (response.textResponse) {
            return response.textResponse;
        }
        return 'No content';
    }

    /**
     * Extract control decision from response
     */
    private extractControlDecision(response: any): { continueThinking: boolean; reason: string } | null {
        if (response.toolCalls) {
            const controlCall = response.toolCalls.find(
                (tc: any) => tc.name === 'continue_thinking'
            );
            if (controlCall) {
                try {
                    return JSON.parse(controlCall.arguments);
                } catch (e) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Extract recall request from response
     */
    private extractRecallRequest(response: any): any | null {
        if (response.toolCalls) {
            const recallCall = response.toolCalls.find(
                (tc: any) => tc.name === 'recall_context'
            );
            if (recallCall) {
                try {
                    return JSON.parse(recallCall.arguments);
                } catch (e) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Estimate token count
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
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

