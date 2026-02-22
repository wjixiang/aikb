/**
 * ThinkingModule - Manages reflective thinking phase
 *
 * This module handles:
 * 1. Multi-round thinking controlled by LLM
 * 2. Thinking prompt building
 * 3. Summary generation
 * 4. Context recall
 * 5. Insight extraction
 */

import { injectable, inject, optional } from 'inversify';
import { ApiMessage } from '../task/task.type.js';
import { Turn, ThinkingRound, ToolCallResult } from '../memory/Turn.js';
import type { ApiClient, ApiResponse, ChatCompletionTool } from '../api-client/index.js';
import { formatChatCompletionTools } from '../utils/toolRendering.js';
import { TYPES } from '../di/types.js';
import type { Logger } from 'pino';
import {
    IThinkingModule,
    ThinkingModuleConfig,
    ThinkingPhaseResult,
    RecallRequest,
    defaultThinkingConfig,
} from './types.js';
import { TurnMemoryStore } from '../memory/TurnMemoryStore.js';

/**
 * ThinkingModule - Implements thinking phase logic
 */
@injectable()
export class ThinkingModule implements IThinkingModule {
    private config: ThinkingModuleConfig;
    private apiClient: ApiClient;
    private logger: Logger;
    private turnMemoryStore: TurnMemoryStore;

    constructor(
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ThinkingModuleConfig) @optional() config: Partial<ThinkingModuleConfig> = {},
        @inject(TYPES.TurnMemoryStore) turnMemoryStore: TurnMemoryStore
    ) {
        this.config = { ...defaultThinkingConfig, ...config };
        this.apiClient = apiClient;
        this.logger = logger;
        this.turnMemoryStore = turnMemoryStore;
    }

    /**
     * Get current configuration
     */
    getConfig(): ThinkingModuleConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ThinkingModuleConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Perform thinking phase
     * Always performs reflective thinking - LLM controls rounds via continue_thinking tool
     */
    async performThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        previousRounds: ThinkingRound[] = [],
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult> {
        // Get accumulated summaries from TurnMemoryStore
        const accumulatedSummaries = this.buildAccumulatedSummaries();

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
                taskContext,
                accumulatedSummaries,
                rounds
            );

            rounds.push(round);
            totalTokens += round.tokens;
            continueThinking = round.continueThinking;
        }

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
                taskContext,
                accumulatedSummaries,
                rounds,
                lastToolResults
            );
        }

        return {
            rounds,
            tokensUsed: totalTokens,
            shouldProceedToAction: true,
            summary,
        };
    }

    /**
     * Perform a single thinking round
     */
    private async performSingleThinkingRound(
        roundNumber: number,
        workspaceContext: string,
        taskContext: string | undefined,
        accumulatedSummaries: string,
        previousRounds: ThinkingRound[]
    ): Promise<ThinkingRound> {
        const prompt = this.buildThinkingPrompt(
            roundNumber,
            workspaceContext,
            taskContext,
            accumulatedSummaries,
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
            this.logger.error({ error }, 'Thinking round failed');
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
        taskContext: string | undefined,
        accumulatedSummaries: string,
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

        // Get task context if available
        const taskContextSection = taskContext
            ? `\n=== TASK CONTEXT ===\nUser's Goal: ${taskContext}\n`
            : '';

        const context = `${taskContextSection}
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRounds.map(r => `Round ${r.roundNumber}: ${r.content}`).join('\n\n')}
`;

        // Get conversation history from TurnMemoryStore
        const allMessages = this.turnMemoryStore.getAllMessages();
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
        const recalled: Turn[] = [];

        if (request.turnNumbers) {
            for (const turn of request.turnNumbers) {
                const t = this.turnMemoryStore.getTurnByNumber(turn);
                if (t) recalled.push(t);
            }
        }

        if (request.keywords) {
            for (const keyword of request.keywords) {
                const turns = this.turnMemoryStore.searchTurns(keyword);
                recalled.push(...turns);
            }
        }

        return recalled;
    }

    /**
     * Build accumulated summaries string
     */
    private buildAccumulatedSummaries(): string {
        const summaries = this.turnMemoryStore.getAllSummaries();

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
     * Generate summary for current turn (based on thinking rounds)
     */
    private async generateSummary(
        workspaceContext: string,
        taskContext: string | undefined,
        previousSummaries: string,
        thinkingRounds: ThinkingRound[],
        toolResults?: ToolCallResult[]
    ): Promise<string> {
        const summaryPrompt = `Generate a DETAILED summary of what happened in this turn.

${previousSummaries}

WORKSPACE CONTEXT:
${workspaceContext}

${taskContext ? `TASK CONTEXT:\nUser's Goal: ${taskContext}\n` : ''}
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
                { timeout: this.config.apiRequestTimeout },
                []
            );

            return this.extractContent(response);
        } catch (error) {
            this.logger.error({ error }, 'Summary generation failed');
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
}
