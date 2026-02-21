import { injectable, inject, optional } from 'inversify';
import { ApiMessage } from '../task/task.type.js';
import { ContextMemoryStore, ContextSnapshot } from './ContextMemoryStore.js';
import type { ApiClient } from '../api-client/index.js';
import { TYPES } from '../di/types.js';

/**
 * Tool for LLM to control thinking flow
 */
export interface ThinkingControl {
    /** Whether to continue thinking */
    continueThinking: boolean;
    /** Reason for the decision */
    reason: string;
    /** Next thinking focus (if continuing) */
    nextFocus?: string;
}

/**
 * Tool for LLM to recall historical context
 */
export interface RecallRequest {
    /** Turn numbers to recall */
    turnNumbers?: number[];
    /** Context IDs to recall */
    contextIds?: string[];
    /** Search keywords */
    keywords?: string[];
}

/**
 * Result of reflective thinking phase
 */
export interface ReflectiveThinkingResult {
    /** All thinking rounds performed */
    thinkingRounds: ThinkingRound[];
    /** Final compressed history */
    compressedHistory: ApiMessage[];
    /** Accumulated summaries to inject into prompt */
    accumulatedSummaries: string;
    /** Total thinking tokens used */
    thinkingTokens: number;
    /** Context snapshot for this turn */
    contextSnapshot: ContextSnapshot;
}

/**
 * Single thinking round
 */
export interface ThinkingRound {
    /** Round number */
    roundNumber: number;
    /** Thinking content */
    content: string;
    /** Whether to continue thinking */
    continueThinking: boolean;
    /** Recalled contexts in this round */
    recalledContexts: ContextSnapshot[];
    /** Token usage */
    tokens: number;
}

/**
 * Configuration for reflective thinking
 */
export interface ReflectiveThinkingConfig {
    /** Maximum thinking rounds allowed */
    maxThinkingRounds: number;
    /** Token budget for thinking phase */
    thinkingTokenBudget: number;
    /** Whether to enable context recall */
    enableRecall: boolean;
    /** Maximum contexts to recall per request */
    maxRecallContexts: number;
    /** API request timeout in milliseconds (default: 40000) */
    apiRequestTimeout: number;
}

/**
 * ReflectiveThinkingProcessor - Enhanced thinking with continuous reflection and memory
 *
 * Key features:
 * 1. Continuous thinking controlled by LLM
 * 2. Context summarization and accumulation
 * 3. Historical context recall mechanism
 */
@injectable()
export class ReflectiveThinkingProcessor {
    private config: ReflectiveThinkingConfig;
    private memoryStore: ContextMemoryStore;
    private apiClient: ApiClient;

    constructor(
        @inject(TYPES.MemoryModuleConfig) @optional() config: ReflectiveThinkingConfig,
        @inject(TYPES.ContextMemoryStore) @optional() memoryStore: ContextMemoryStore,
        @inject(TYPES.ApiClient) apiClient: ApiClient
    ) {
        this.config = config;
        this.memoryStore = memoryStore;
        this.apiClient = apiClient;
    }

    /**
     * Perform reflective thinking with continuous rounds
     */
    async performReflectiveThinking(
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        lastToolResults?: any[]
    ): Promise<ReflectiveThinkingResult> {
        // Store current workspace context
        const contextSnapshot = this.memoryStore.storeContext(
            workspaceContext,
            lastToolResults?.map(r => r.toolName)
        );

        const thinkingRounds: ThinkingRound[] = [];
        let totalThinkingTokens = 0;
        let continueThinking = true;
        let currentRound = 0;

        // Get accumulated summaries from previous turns
        const accumulatedSummaries = this.buildAccumulatedSummaries();

        while (
            continueThinking &&
            currentRound < this.config.maxThinkingRounds &&
            totalThinkingTokens < this.config.thinkingTokenBudget
        ) {
            currentRound++;

            // Perform one thinking round
            const roundResult = await this.performThinkingRound(
                currentRound,
                conversationHistory,
                workspaceContext,
                accumulatedSummaries,
                thinkingRounds
            );

            thinkingRounds.push(roundResult);
            totalThinkingTokens += roundResult.tokens;
            continueThinking = roundResult.continueThinking;
        }

        // Generate summary for current context
        const summary = await this.generateContextSummary(
            workspaceContext,
            thinkingRounds,
            lastToolResults
        );

        // Store summary in memory
        this.memoryStore.storeSummary(
            contextSnapshot.id,
            summary.text,
            summary.insights
        );

        // Compress conversation history (basic sliding window for now)
        const compressedHistory = this.compressHistory(conversationHistory);

        return {
            thinkingRounds,
            compressedHistory,
            accumulatedSummaries: this.buildAccumulatedSummaries(), // Rebuild with new summary
            thinkingTokens: totalThinkingTokens,
            contextSnapshot,
        };
    }

    /**
     * Perform a single thinking round
     */
    private async performThinkingRound(
        roundNumber: number,
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        accumulatedSummaries: string,
        previousRounds: ThinkingRound[]
    ): Promise<ThinkingRound> {
        // Build thinking prompt
        const thinkingPrompt = this.buildThinkingPrompt(
            roundNumber,
            conversationHistory,
            workspaceContext,
            accumulatedSummaries,
            previousRounds
        );

        // Define thinking tools
        const thinkingTools = this.buildThinkingTools();

        // Call LLM for thinking
        const response = await this.apiClient.makeRequest(
            thinkingPrompt.systemPrompt,
            thinkingPrompt.context,
            thinkingPrompt.history,
            { timeout: this.config.apiRequestTimeout },
            thinkingTools
        );

        // Parse thinking result
        const thinkingContent = this.extractThinkingContent(response);
        const controlDecision = this.extractControlDecision(response);
        const recallRequest = this.extractRecallRequest(response);

        // Handle recall if requested
        const recalledContexts = recallRequest
            ? this.handleRecall(recallRequest)
            : [];

        return {
            roundNumber,
            content: thinkingContent,
            continueThinking: controlDecision?.continueThinking ?? false,
            recalledContexts,
            tokens: this.estimateTokens(thinkingContent),
        };
    }

    /**
     * Build thinking prompt for LLM
     */
    private buildThinkingPrompt(
        roundNumber: number,
        conversationHistory: ApiMessage[],
        workspaceContext: string,
        accumulatedSummaries: string,
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

        const context = `
=== WORKSPACE CONTEXT ===
${workspaceContext}

=== ACCUMULATED SUMMARIES ===
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
     * Build thinking tools for LLM
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
     * Handle context recall request
     */
    private handleRecall(request: RecallRequest): ContextSnapshot[] {
        if (!this.config.enableRecall) {
            return [];
        }

        const recalled: ContextSnapshot[] = [];

        // Recall by turn numbers
        if (request.turnNumbers) {
            for (const turn of request.turnNumbers) {
                const ctx = this.memoryStore.getContextByTurn(turn);
                if (ctx) recalled.push(ctx);
            }
        }

        // Recall by context IDs
        if (request.contextIds) {
            for (const id of request.contextIds) {
                const ctx = this.memoryStore.getContext(id);
                if (ctx) recalled.push(ctx);
            }
        }

        // Recall by keywords
        if (request.keywords) {
            for (const keyword of request.keywords) {
                const summaries = this.memoryStore.searchSummaries(keyword);
                for (const summary of summaries) {
                    const ctx = this.memoryStore.getContext(summary.contextId);
                    if (ctx) recalled.push(ctx);
                }
            }
        }

        // Limit number of recalled contexts
        return recalled.slice(0, this.config.maxRecallContexts);
    }

    /**
     * Generate summary for current context
     */
    private async generateContextSummary(
        workspaceContext: string,
        thinkingRounds: ThinkingRound[],
        toolResults?: any[]
    ): Promise<{ text: string; insights: string[] }> {
        const summaryPrompt = `Summarize the following workspace context and thinking process into a concise summary.

WORKSPACE CONTEXT:
${workspaceContext}

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content}`).join('\n')}

TOOL RESULTS:
${toolResults?.map(r => `${r.toolName}: ${r.success ? 'success' : 'failed'}`).join('\n') || 'None'}

Generate:
1. A concise summary (2-3 sentences) of what happened in this turn
2. Key insights (3-5 bullet points) that should be remembered

Format as JSON:
{
  "summary": "...",
  "insights": ["...", "..."]
}`;

        try {
            const response = await this.apiClient.makeRequest(
                'You are a summarization assistant. Generate concise summaries.',
                summaryPrompt,
                [],
                { timeout: 20000 },
                []
            );

            // Parse JSON response
            const parsed = this.parseJsonFromResponse(response);
            return {
                text: parsed.summary || 'Summary generation failed',
                insights: parsed.insights || [],
            };
        } catch (error) {
            console.error('Failed to generate summary:', error);
            return {
                text: 'Summary generation failed',
                insights: [],
            };
        }
    }

    /**
     * Build accumulated summaries string
     */
    private buildAccumulatedSummaries(): string {
        const summaries = this.memoryStore.getAllSummaries();

        if (summaries.length === 0) {
            return 'No previous summaries available.';
        }

        return summaries
            .map(s => {
                const insights = s.insights.length > 0
                    ? `\nInsights: ${s.insights.join('; ')}`
                    : '';
                return `[Turn ${s.turnNumber}] ${s.summary}${insights}`;
            })
            .join('\n\n');
    }

    /**
     * Compress conversation history (basic implementation)
     */
    private compressHistory(history: ApiMessage[]): ApiMessage[] {
        // Keep first message and last 10 messages
        if (history.length <= 11) {
            return history;
        }

        return [history[0], ...history.slice(-10)];
    }

    /**
     * Extract thinking content from API response
     */
    private extractThinkingContent(response: any): string {
        // Extract text content from response
        if (response.content) {
            return response.content;
        }
        return 'No thinking content';
    }

    /**
     * Extract control decision from API response
     */
    private extractControlDecision(response: any): ThinkingControl | null {
        // Look for continue_thinking tool call
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
     * Extract recall request from API response
     */
    private extractRecallRequest(response: any): RecallRequest | null {
        // Look for recall_context tool call
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
     * Parse JSON from response text
     */
    private parseJsonFromResponse(response: any): any {
        try {
            if (typeof response.content === 'string') {
                // Try to extract JSON from markdown code blocks
                const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[1]);
                }
                // Try direct parse
                return JSON.parse(response.content);
            }
            return {};
        } catch (e) {
            return {};
        }
    }

    /**
     * Estimate token count
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Get memory store
     */
    getMemoryStore(): ContextMemoryStore {
        return this.memoryStore;
    }
}
