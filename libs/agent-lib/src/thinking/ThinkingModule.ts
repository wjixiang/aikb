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
import type { ITurnMemoryStore } from '../memory/TurnMemoryStore.interface.js';

/**
 * ThinkingModule - Implements thinking phase logic with Sequential Thinking support
 */
@injectable()
export class ThinkingModule implements IThinkingModule {
    private config: ThinkingModuleConfig;
    private apiClient: ApiClient;
    private logger: Logger;
    private turnMemoryStore: ITurnMemoryStore;

    // Sequential Thinking state tracking
    private sequentialState: {
        thoughtNumber: number;
        totalThoughts: number;
        branches: Map<string, number[]>;
        activeBranchId?: string;
    };

    constructor(
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ThinkingModuleConfig) @optional() config: Partial<ThinkingModuleConfig> = {},
        @inject(TYPES.ITurnMemoryStore) turnMemoryStore: ITurnMemoryStore
    ) {
        this.config = { ...defaultThinkingConfig, ...config };
        this.apiClient = apiClient;
        this.logger = logger;
        this.turnMemoryStore = turnMemoryStore;

        // Initialize Sequential Thinking state
        this.sequentialState = {
            thoughtNumber: 1,
            totalThoughts: this.config.maxThinkingRounds,
            branches: new Map(),
        };
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
     * Reset sequential thinking state for a new thinking phase
     */
    private resetSequentialState(): void {
        this.sequentialState = {
            thoughtNumber: 1,
            totalThoughts: this.config.maxThinkingRounds,
            branches: new Map(),
        };
    }

    /**
     * Perform thinking phase
     * Always performs reflective thinking - LLM controls rounds via continue_thinking tool
     * Now supports Sequential Thinking mode with enhanced tracking
     */
    async performThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        previousRounds: ThinkingRound[] = [],
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult> {
        // Reset sequential state for new thinking phase
        this.resetSequentialState();

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

            // Update sequential state based on round results
            this.updateSequentialState(round);
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
     * Update sequential thinking state based on round results
     */
    private updateSequentialState(round: ThinkingRound): void {
        // Update thought number
        this.sequentialState.thoughtNumber = round.thoughtNumber;

        // Update total thoughts estimate
        if (round.totalThoughts > 0) {
            this.sequentialState.totalThoughts = round.totalThoughts;
        }

        // Handle branching
        if (round.branchId && round.branchFromThought) {
            if (!this.sequentialState.branches.has(round.branchId)) {
                this.sequentialState.branches.set(round.branchId, []);
            }
            this.sequentialState.branches.get(round.branchId)!.push(round.thoughtNumber);
            this.sequentialState.activeBranchId = round.branchId;
        }
    }

    /**
     * Perform sequential thinking phase
     * Enhanced thinking mode with hypothesis generation and verification
     */
    async performSequentialThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        initialState?: any
    ): Promise<ThinkingPhaseResult & { sequentialState: any }> {
        // Reset or initialize sequential state
        if (initialState) {
            this.sequentialState = initialState;
        } else {
            this.resetSequentialState();
        }

        // Perform thinking phase with sequential mode enabled
        const result = await this.performThinkingPhase(
            workspaceContext,
            taskContext
        );

        return {
            ...result,
            sequentialState: { ...this.sequentialState },
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
                continueThinking: (controlDecision?.continueThinking || recallRequest !== null) ?? false,
                recalledContexts,
                tokens: this.estimateTokens(content),
                reason: controlDecision?.reason,
                summary: controlDecision?.summary,
                // Sequential Thinking properties
                thoughtNumber: controlDecision?.thoughtNumber ?? this.sequentialState.thoughtNumber,
                totalThoughts: controlDecision?.totalThoughts ?? this.sequentialState.totalThoughts,
                isRevision: controlDecision?.isRevision,
                revisesThought: controlDecision?.revisesThought,
                branchFromThought: controlDecision?.branchFromThought,
                branchId: controlDecision?.branchId,
                needsMoreThoughts: controlDecision?.needsMoreThoughts,
                hypothesis: controlDecision?.hypothesis,
                hypothesisVerified: controlDecision?.hypothesisVerified,
            };
        } catch (error) {
            this.logger.error({ error }, 'Thinking round failed');
            return {
                roundNumber,
                reason: '',
                content: 'Thinking round failed',
                continueThinking: false,
                recalledContexts: [],
                tokens: 0,
                thoughtNumber: this.sequentialState.thoughtNumber,
                totalThoughts: this.sequentialState.totalThoughts,
            };
        }
    }

    /**
     * Build thinking prompt
     * Now includes Sequential Thinking guidance
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

        const systemPrompt = `You are in the THINKING phase to plan and self-reflex using Sequential Thinking methodology.

Your task is to:
1. Understand the user's overall task/goal
2. Analyze the current situation based on conversation history and workspace context
3. Review accumulated summaries from previous turns
4. Evaluate whether a SKILL SWITCH would be beneficial for the current task
5. Decide whether to continue thinking or proceed to action
6. Optionally recall historical contexts if needed

🧠 SEQUENTIAL THINKING MODE 🧠
You are using Sequential Thinking - a dynamic and reflective problem-solving approach.

Key Principles:
- Break down complex problems into manageable steps
- Each thought can build on, question, or revise previous insights
- You can adjust your estimate of total thoughts as you progress
- Generate and verify hypotheses before reaching conclusions
- Feel free to branch into alternative approaches
- Express uncertainty when present
- Don't hesitate to add more thoughts even when you think you're done

Sequential Thinking Process:
1. Start with an initial estimate of thoughts needed (thoughtNumber=1, totalThoughts=N)
2. For each thought:
   - Provide your current thinking step
   - Update thoughtNumber (incrementing)
   - Adjust totalThoughts if needed (can increase or decrease)
   - Mark if this is a revision (isRevision=true, revisesThought=N)
   - Note if branching (branchFromThought=N, branchId="branch-name")
   - Generate hypotheses when appropriate
   - Verify hypotheses based on accumulated reasoning
3. Continue until satisfied with the solution
4. When done, provide a comprehensive summary

You have access to these tools:

${toolsText}

⚠️ CRITICAL INSTRUCTION ⚠️
You MUST provide your thinking as TEXT FIRST, before calling any tools.
Format your response as:
1. Write your thinking/reasoning in plain text (this will be stored as the thinking content)
2. Then call the continue_thinking tool with your decision and Sequential Thinking parameters

Example format:
"Thought 1: I need to analyze this clinical question. The P is adult patients with type 2 diabetes mellitus.
Let me evaluate the available skills... I estimate I'll need about 5 thoughts to complete this analysis."
[Then call continue_thinking with thoughtNumber=1, totalThoughts=5]

Think deeply about:
- What the user wants to accomplish (the overall goal)
- What has been accomplished so far
- What needs to be done next
- What information is missing
- Whether you need to recall any historical context
- Whether you have enough understanding to take action
- What hypotheses can be formed and how to verify them

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

Current thinking round: ${roundNumber}/${this.config.maxThinkingRounds}
Current thought number: ${this.sequentialState.thoughtNumber}
Estimated total thoughts: ${this.sequentialState.totalThoughts}`;

        // Get task context if available
        const taskContextSection = taskContext
            ? `\n=== TASK CONTEXT ===\nUser's Goal: ${taskContext}\n`
            : '';

        // Build previous rounds display with all ThinkingRound properties
        const previousRoundsText = previousRounds.map(r => {
            const parts: string[] = [];

            // Basic round info
            parts.push(`## Round ${r.roundNumber}`);

            // Sequential Thinking info
            const sequentialParts: string[] = [];
            sequentialParts.push(`Thought ${r.thoughtNumber}/${r.totalThoughts}`);
            if (r.isRevision) {
                sequentialParts.push(`(revises thought ${r.revisesThought})`);
            }
            if (r.branchId) {
                sequentialParts.push(`(branch: ${r.branchId})`);
                if (r.branchFromThought !== undefined) {
                    sequentialParts.push(`from thought ${r.branchFromThought}`);
                }
            }
            if (r.hypothesis) {
                sequentialParts.push(`[Hypothesis: ${r.hypothesis.substring(0, 50)}...]`);
            }
            if (r.hypothesisVerified !== undefined) {
                sequentialParts.push(`[Verified: ${r.hypothesisVerified}]`);
            }
            if (r.needsMoreThoughts) {
                sequentialParts.push(`[Needs more thoughts]`);
            }
            parts.push(`[${sequentialParts.join(' ')}]`);

            // Content and reasoning
            parts.push(`- Log: ${r.content}`);
            if (r.reason) {
                parts.push(`- Reasoning: ${r.reason}`);
            }

            // Control decision
            parts.push(`- Continue Thinking: ${r.continueThinking}`);

            // Summary (if provided)
            if (r.summary) {
                parts.push(`- Summary: ${r.summary}`);
            }

            // Recalled contexts
            if (r.recalledContexts && r.recalledContexts.length > 0) {
                parts.push(`- Recalled Contexts: ${r.recalledContexts.length} items`);
            }

            // Token usage
            parts.push(`- Tokens: ${r.tokens}`);

            return parts.join('\n');
        }).join('\n\n');

        const context = `${taskContextSection}
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRoundsText || 'None yet'}
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
     * Now supports Sequential Thinking mode with enhanced parameters
     */
    private buildThinkingTools(): ChatCompletionTool[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'continue_thinking',
                    description: `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- You can adjust total_thoughts up or down as you progress
- You can question or revise previous thoughts
- You can add more thoughts even after reaching what seemed like the end
- You can express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - you can branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

Parameters explained:
- thought: Your current thinking step, which can include:
  * Regular analytical steps
  * Revisions of previous thoughts
  * Questions about previous decisions
  * Realizations about needing more analysis
  * Changes in approach
  * Hypothesis generation
  * Hypothesis verification
- nextThoughtNeeded: True if you need more thinking, even if at what seemed like the end
- thoughtNumber: Current number in sequence (can go beyond initial total if needed)
- totalThoughts: Current estimate of thoughts needed (can be adjusted up/down)
- isRevision: A boolean indicating if this thought revises previous thinking
- revisesThought: If is_revision is true, which thought number is being reconsidered
- branchFromThought: If branching, which thought number is the branching point
- branchId: Identifier for the current branch (if any)
- needsMoreThoughts: If reaching end but realizing more thoughts needed
- hypothesis: A solution hypothesis generated during thinking
- hypothesisVerified: Whether the hypothesis has been verified

IMPORTANT: When deciding to stop thinking (continueThinking=false), you MUST provide a detailed summary.`,
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
                            thoughtNumber: {
                                type: 'number',
                                description: 'Current thought number (numeric value, e.g., 1, 2, 3)',
                            },
                            totalThoughts: {
                                type: 'number',
                                description: 'Estimated total thoughts needed (numeric value, e.g., 5, 10)',
                            },
                            isRevision: {
                                type: 'boolean',
                                description: 'Whether this thought revises previous thinking',
                            },
                            revisesThought: {
                                type: 'number',
                                description: 'Which thought number is being reconsidered',
                            },
                            branchFromThought: {
                                type: 'number',
                                description: 'Branching point thought number',
                            },
                            branchId: {
                                type: 'string',
                                description: 'Branch identifier',
                            },
                            needsMoreThoughts: {
                                type: 'boolean',
                                description: 'If more thoughts are needed at the end',
                            },
                            hypothesis: {
                                type: 'string',
                                description: 'A solution hypothesis generated during thinking',
                            },
                            hypothesisVerified: {
                                type: 'boolean',
                                description: 'Whether the hypothesis has been verified',
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
                        required: ['continueThinking', 'reason', 'thoughtNumber', 'totalThoughts'],
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
     * Now supports Sequential Thinking parameters
     */
    private extractControlDecision(response: ApiResponse): {
        continueThinking: boolean;
        reason: string;
        summary?: string;
        thoughtNumber?: number;
        totalThoughts?: number;
        isRevision?: boolean;
        revisesThought?: number;
        branchFromThought?: number;
        branchId?: string;
        needsMoreThoughts?: boolean;
        hypothesis?: string;
        hypothesisVerified?: boolean;
    } | null {
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
