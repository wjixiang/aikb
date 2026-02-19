/**
 * Memory Module - Pluggable memory system for Agent
 *
 * This module can be plugged into the existing Agent without requiring inheritance.
 * It provides reflective thinking and context memory capabilities as an optional enhancement.
 */

import { ApiMessage } from '../task/task.type.js';
import { ContextMemoryStore, ContextSnapshot } from './ContextMemoryStore.js';
import type { ApiClient } from '../api-client/index.js';

/**
 * Configuration for the memory module
 */
export interface MemoryModuleConfig {
    /** Enable reflective thinking */
    enableReflectiveThinking: boolean;
    /** Maximum thinking rounds per turn */
    maxThinkingRounds: number;
    /** Token budget for thinking phase */
    thinkingTokenBudget: number;
    /** Enable context recall */
    enableRecall: boolean;
    /** Maximum contexts to recall per request */
    maxRecallContexts: number;
    /** Enable automatic summarization */
    enableSummarization: boolean;
}

/**
 * Default configuration
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
    enableReflectiveThinking: false,
    maxThinkingRounds: 3,
    thinkingTokenBudget: 10000,
    enableRecall: true,
    maxRecallContexts: 3,
    enableSummarization: true,
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
    /** Context snapshot created */
    contextSnapshot?: ContextSnapshot;
    /** Summary generated */
    summary?: string;
}

/**
 * Single thinking round
 */
export interface ThinkingRound {
    roundNumber: number;
    content: string;
    continueThinking: boolean;
    recalledContexts: ContextSnapshot[];
    tokens: number;
}

/**
 * Memory Module - Pluggable memory system
 *
 * This module can be attached to an Agent to provide:
 * 1. Complete context storage
 * 2. Reflective thinking with multiple rounds
 * 3. Context summarization
 * 4. Historical context recall
 */
export class MemoryModule {
    private config: MemoryModuleConfig;
    private memoryStore: ContextMemoryStore;
    private apiClient: ApiClient;

    constructor(apiClient: ApiClient, config: Partial<MemoryModuleConfig> = {}) {
        this.config = { ...defaultMemoryConfig, ...config };
        this.memoryStore = new ContextMemoryStore();
        this.apiClient = apiClient;
    }

    /**
     * Get the memory store
     */
    getMemoryStore(): ContextMemoryStore {
        return this.memoryStore;
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

    /**
     * Store current workspace context
     */
    storeContext(workspaceContext: string, toolCalls?: string[]): ContextSnapshot {
        return this.memoryStore.storeContext(workspaceContext, toolCalls);
    }

    /**
     * Get accumulated summaries for prompt injection
     */
    getAccumulatedSummaries(): string {
        const summaries = this.memoryStore.getAllSummaries();

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

    /**
     * Perform thinking phase (if enabled)
     */
    async performThinkingPhase(
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        lastToolResults?: any[]
    ): Promise<ThinkingPhaseResult> {
        if (!this.config.enableReflectiveThinking) {
            // Skip thinking phase, just store context
            const snapshot = this.storeContext(
                workspaceContext,
                lastToolResults?.map(r => r.toolName)
            );

            return {
                rounds: [],
                tokensUsed: 0,
                shouldProceedToAction: true,
                contextSnapshot: snapshot,
            };
        }

        // Perform reflective thinking
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
                conversationHistory,
                workspaceContext,
                rounds
            );

            rounds.push(round);
            totalTokens += round.tokens;
            continueThinking = round.continueThinking;
        }

        // Store context
        const snapshot = this.storeContext(
            workspaceContext,
            lastToolResults?.map(r => r.toolName)
        );

        // Generate summary if enabled
        let summary: string | undefined;
        if (this.config.enableSummarization) {
            summary = await this.generateSummary(
                workspaceContext,
                rounds,
                lastToolResults
            );

            if (summary) {
                this.memoryStore.storeSummary(
                    snapshot.id,
                    summary,
                    this.extractInsights(rounds)
                );
            }
        }

        return {
            rounds,
            tokensUsed: totalTokens,
            shouldProceedToAction: true,
            contextSnapshot: snapshot,
            summary,
        };
    }

    /**
     * Perform a single thinking round
     */
    private async performSingleThinkingRound(
        roundNumber: number,
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        previousRounds: ThinkingRound[]
    ): Promise<ThinkingRound> {
        const prompt = this.buildThinkingPrompt(
            roundNumber,
            conversationHistory,
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
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        previousRounds: ThinkingRound[]
    ): { systemPrompt: string; context: string; history: string[] } {
        const systemPrompt = `You are in the THINKING phase of an agent framework.

Your task is to:
1. Analyze the current situation based on conversation history and workspace context
2. Review accumulated summaries from previous turns
3. Decide whether to continue thinking or proceed to action
4. Optionally recall historical contexts if needed

You have access to these tools:
- continue_thinking: Decide whether to continue thinking or proceed to action
- recall_context: Recall historical workspace contexts by turn number, ID, or keyword

Think deeply about:
- What has been accomplished so far
- What needs to be done next
- What information is missing
- Whether you need to recall any historical context
- Whether you have enough understanding to take action

Current thinking round: ${roundNumber}/${this.config.maxThinkingRounds}`;

        const accumulatedSummaries = this.getAccumulatedSummaries();

        const context = `
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRounds.map(r => `Round ${r.roundNumber}: ${r.content}`).join('\n\n')}
`;

        const history = conversationHistory.map(msg => {
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
    private buildThinkingTools(): any[] {
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
    private handleRecall(request: any): ContextSnapshot[] {
        if (!this.config.enableRecall) {
            return [];
        }

        const recalled: ContextSnapshot[] = [];

        if (request.turnNumbers) {
            for (const turn of request.turnNumbers) {
                const ctx = this.memoryStore.getContextByTurn(turn);
                if (ctx) recalled.push(ctx);
            }
        }

        if (request.contextIds) {
            for (const id of request.contextIds) {
                const ctx = this.memoryStore.getContext(id);
                if (ctx) recalled.push(ctx);
            }
        }

        if (request.keywords) {
            for (const keyword of request.keywords) {
                const summaries = this.memoryStore.searchSummaries(keyword);
                for (const summary of summaries) {
                    const ctx = this.memoryStore.getContext(summary.contextId);
                    if (ctx) recalled.push(ctx);
                }
            }
        }

        return recalled.slice(0, this.config.maxRecallContexts);
    }

    /**
     * Generate summary for current turn
     */
    private async generateSummary(
        workspaceContext: string,
        thinkingRounds: ThinkingRound[],
        toolResults?: any[]
    ): Promise<string> {
        const summaryPrompt = `Summarize the following workspace context and thinking process into a concise summary (2-3 sentences).

WORKSPACE CONTEXT:
${workspaceContext.substring(0, 1000)}...

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content.substring(0, 200)}`).join('\n')}

TOOL RESULTS:
${toolResults?.map(r => `${r.toolName}: ${r.success ? 'success' : 'failed'}`).join('\n') || 'None'}

Generate a concise summary (2-3 sentences) of what happened in this turn.`;

        try {
            const response = await this.apiClient.makeRequest(
                'You are a summarization assistant. Generate concise summaries.',
                summaryPrompt,
                [],
                { timeout: 20000 },
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

    /**
     * Extract content from API response
     */
    private extractContent(response: any): string {
        if (response.content) {
            return response.content;
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

    /**
     * Export memory state
     */
    export() {
        return this.memoryStore.export();
    }

    /**
     * Import memory state
     */
    import(data: any) {
        this.memoryStore.import(data);
    }

    /**
     * Clear all memory
     */
    clear() {
        this.memoryStore.clear();
    }
}
