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

import { injectable, inject, optional } from 'inversify';
import { ApiMessage, ExtendedContentBlock, MessageBuilder } from '../task/task.type.js';
import { TurnMemoryStore } from './TurnMemoryStore.js';
import { Turn, TurnStatus, ThinkingRound, ToolCallResult } from './Turn.js';
import type { ApiClient, ApiResponse, ChatCompletionTool } from '../api-client/index.js';
import { formatChatCompletionTools } from '../utils/toolRendering.js';
import type { IMemoryModule } from './types.js';
import { TYPES } from '../di/types.js';
import { Logger } from 'pino';

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
 * Default configuration
 */
export const defaultMemoryConfig: MemoryModuleConfig = {
    maxThinkingRounds: 3,
    thinkingTokenBudget: 10000,
    enableRecall: true,
    maxRecallContexts: 3,
    enableSummarization: true,
    maxRecalledMessages: 20,
    apiRequestTimeout: 40000,
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
    /** Context snapshot stored during thinking phase */
    contextSnapshot?: { turnNumber: number; id: string };
}

/**
 * Turn-based MemoryModule
 */
@injectable()
export class MemoryModule implements IMemoryModule {
    private config: MemoryModuleConfig;
    private turnStore: TurnMemoryStore;
    private apiClient: ApiClient;

    // Current active turn
    private currentTurn: Turn | null = null;

    // Recalled messages (temporary storage for next prompt)
    private recalledMessages: ApiMessage[] = [];

    constructor(
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.MemoryModuleConfig) @optional() config: Partial<MemoryModuleConfig> = {},
        @inject(TYPES.TurnMemoryStore) turnStore: TurnMemoryStore,
    ) {
        this.config = { ...defaultMemoryConfig, ...config };
        this.turnStore = turnStore
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
     * @returns The added message
     */
    addUserMessage(content: string | ExtendedContentBlock[]): ApiMessage {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        const message = typeof content === 'string'
            ? MessageBuilder.user(content)
            : MessageBuilder.custom('user', content);

        this.turnStore.addMessageToTurn(this.currentTurn.id, message);
        return message;
    }

    /**
     * Add assistant message to current turn
     * @returns The added message
     */
    addAssistantMessage(content: string | ExtendedContentBlock[]): ApiMessage {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        const message = typeof content === 'string'
            ? MessageBuilder.assistant(content)
            : MessageBuilder.custom('assistant', content);
        this.turnStore.addMessageToTurn(
            this.currentTurn.id,
            message
        );
        return message;
    }

    /**
     * Add system message to current turn
     * @returns The added message
     */
    addSystemMessage(content: string): ApiMessage {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        const message = MessageBuilder.system(content);
        this.turnStore.addMessageToTurn(
            this.currentTurn.id,
            message
        );
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

        // Extract summary from the last thinking round (if provided by LLM)
        // Otherwise, fall back to generating summary separately
        let summary: string | undefined;
        const lastRound = rounds[rounds.length - 1];

        if (lastRound?.summary) {
            // LLM provided summary in the continue_thinking tool call
            summary = lastRound.summary;
        } else if (this.config.enableSummarization) {
            // Fallback: generate summary using separate API call
            summary = await this.generateSummary(
                workspaceContext,
                rounds,
                lastToolResults
            );
        }

        // Store summary if available
        if (summary) {
            this.turnStore.storeSummary(
                this.currentTurn.id,
                summary,
                this.extractInsights(rounds)
            );
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
                { timeout: this.config.apiRequestTimeout },
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
                summary: controlDecision?.summary,
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
        const tools = this.buildThinkingTools();
        const toolsText = formatChatCompletionTools(tools);

        const systemPrompt = `You are in the THINKING phase to plan and self-reflex.

Your task is to:
1. Understand the user's overall task/goal
2. Analyze the current situation based on conversation history and workspace context
3. Review accumulated summaries from previous turns
4. Evaluate whether a SKILL SWITCH would be beneficial for the current task
5. Decide whether to continue thinking or proceed to action
6. Optionally recall historical contexts if needed

You have access to these tools:

${toolsText}

⚠️ CRITICAL INSTRUCTION ⚠️
You MUST provide your thinking as TEXT FIRST, before calling any tools.
Format your response as:
1. Write your thinking/reasoning in plain text (this will be stored as the thinking content)
2. Then call the continue_thinking tool with your decision

Example format:
"I need to analyze this clinical question. The P is adult patients with type 2 diabetes mellitus. Let me evaluate the available skills..."
[Then call continue_thinking tool]

Think deeply about:
- What the user wants to accomplish (the overall goal)
- What has been accomplished so far
- What needs to be done next
- What information is missing
- Whether you need to recall any historical context
- Whether you have enough understanding to take action

⚡ SKILL SWITCHING GUIDANCE ⚡
Before proceeding to action, CONSIDER if activating a specialized skill would improve task execution:

When to CONSIDER switching skills:
• The task requires specialized domain expertise (e.g., literature search, data analysis, PICO extraction)
• You notice available skills in the workspace that match the current task type
• The task involves complex workflows that skills are designed to handle
• You want to optimize the prompt and toolset for specific task categories

Remember: Skills provide specialized prompts, optimized tools, and task-specific guidance.
Activating the right skill can significantly improve task execution quality.

IMPORTANT: When you decide to STOP thinking (continue_thinking with continueThinking=false),
you MUST provide a detailed summary in the same tool call. This summary will be stored as
the official record of this thinking phase.

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
    buildThinkingTools(): ChatCompletionTool[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'continue_thinking',
                    description: 'Decide whether to continue thinking or proceed to action phase. IMPORTANT: When deciding to stop thinking (continueThinking=false), you MUST provide a detailed summary. Consider whether activating a specialized skill would benefit the task before stopping.',
                    parameters: {
                        type: 'object',
                        properties: {
                            continueThinking: {
                                type: 'boolean',
                                description: 'Whether to continue thinking (true) or proceed to action (false)',
                            },
                            reason: {
                                type: 'string',
                                description: 'Reason for the decision. If stopping to switch skills, mention which skill and why.',
                            },
                            nextFocus: {
                                type: 'string',
                                description: 'What to focus on in the next thinking round (if continuing). Include skill evaluation if considering a switch.',
                            },
                            summary: {
                                type: 'string',
                                description: 'REQUIRED when continueThinking=false: A detailed summary with DONE and TODO sections. DONE: specific actions taken, concrete results obtained, decisions made, challenges encountered. TODO: next steps, missing information, follow-up tasks, recommended skill to activate (if applicable). Preserve important details like search terms, numbers, tool names, and key findings.',
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
    private handleRecall(request: RecallRequest): Turn[] {
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
${workspaceContext}

THINKING ROUNDS:
${thinkingRounds.map(r => `Round ${r.roundNumber}: ${r.content}`).join('\n\n')}

TOOL RESULTS:
${toolResults?.map(r => {
            const resultStr = typeof r.result === 'object'
                ? JSON.stringify(r.result).substring(0, 300)
                : String(r.result).substring(0, 300);
            return `${r.toolName}: ${r.success ? 'success' : 'failed'}\nResult: ${resultStr}`;
        }).join('\n\n') || 'None'}

Generate a DETAILED summary with the following structure:

## DONE
- What specific actions were taken (be specific about tools used, parameters, search terms, etc.)
- What concrete results were obtained (include key numbers, counts, findings, data points)
- What decisions were made and the reasoning behind them
- What challenges or issues were encountered and how they were resolved
- Any skill activations or deactivations that occurred

## TODO
- What the next steps or actions should be
- What information is still missing or needs to be gathered
- What follow-up tasks are required
- Recommended skill to activate for the next phase (if applicable)

## SKILL RECOMMENDATION (if applicable)
- If a specialized skill would benefit the next phase, specify which skill and why
- Consider skills that match the task type (e.g., literature search, data analysis, PICO extraction)
- Mention any skills that were identified as potentially useful during thinking

The summary should preserve important details like:
- Specific search terms, keywords, or queries used
- Exact numbers (article counts, data points, measurements)
- Names of tools, databases, or resources accessed
- Key findings or insights discovered
- Specific actions taken and their outcomes
- Skill-related decisions and recommendations

If this turn builds upon previous turns, mention the connection and how it advances the overall task.`;

        try {
            const response = await this.apiClient.makeRequest(
                'You are a detailed summarization assistant. Generate comprehensive summaries that preserve important details, maintain narrative continuity, and include skill-related recommendations when relevant.',
                summaryPrompt,
                [],
                { timeout: this.config.apiRequestTimeout },  // Use configured timeout for summaries
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
     *
     * First tries to get textResponse from the LLM.
     * If no text response, falls back to extracting reasoning from tool calls.
     */
    private extractContent(response: ApiResponse): string {
        // Primary: Use text response if available and non-empty
        if (response.textResponse && response.textResponse.trim()) {
            return response.textResponse;
        }

        // Fallback: Extract reasoning from continue_thinking tool call
        if (response.toolCalls && response.toolCalls.length > 0) {
            const continueThinkingCall = response.toolCalls.find(
                (tc: any) => tc.name === 'continue_thinking'
            );

            if (continueThinkingCall) {
                try {
                    const args = JSON.parse(continueThinkingCall.arguments);
                    const parts: string[] = [];

                    // Add reason if available
                    if (args.reason) {
                        parts.push(`Reason: ${args.reason}`);
                    }

                    // Add nextFocus if available
                    if (args.nextFocus) {
                        parts.push(`Next Focus: ${args.nextFocus}`);
                    }

                    // Add summary if available (typically when stopping)
                    if (args.summary) {
                        parts.push(`Summary: ${args.summary}`);
                    }

                    // Return combined reasoning or a default message
                    return parts.length > 0 ? parts.join('\n') : 'Tool call only - no reasoning provided';
                } catch (e) {
                    // If parsing fails, return a generic message
                    return 'Tool call made (parsing failed)';
                }
            }
        }

        return 'No content';
    }

    /**
     * Extract control decision from response
     */
    private extractControlDecision(response: ApiResponse): { continueThinking: boolean; reason: string; summary?: string } | null {
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
    private extractRecallRequest(response: ApiResponse): RecallRequest | null {
        if (response.toolCalls) {
            const recallCall = response.toolCalls.find(
                (tc: any) => tc.name === 'recall_context'
            );
            if (recallCall) {
                try {
                    return JSON.parse(recallCall.arguments) as RecallRequest;
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

