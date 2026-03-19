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

/**
 * Error thrown when LLM attempts to use action-phase tools during thinking phase
 */
export class ThinkingPhaseToolViolationError extends Error {
    constructor(public readonly toolNames: string[]) {
        super(
            `Thinking phase violation: LLM attempted to use action-phase tools: ${toolNames.join(', ')}. ` +
            `Only 'continue_thinking' and 'recall_context' are allowed during thinking phase.`
        );
        this.name = 'ThinkingPhaseToolViolationError';
    }
}

/**
 * Error thrown when LLM doesn't call required tools during thinking phase
 */
export class MissingToolCallError extends Error {
    constructor(
        public readonly roundNumber: number,
        public readonly reason: string
    ) {
        super(
            `Round ${roundNumber}: ${reason}. ` +
            `You MUST call 'continue_thinking' tool to indicate whether to continue thinking or proceed to action phase.`
        );
        this.name = 'MissingToolCallError';
    }
}
import { ApiMessage } from '../memory/types.js';
import { Turn, ThinkingRound, ToolCallResult } from '../memory/Turn.js';
import type { ApiClient, ApiResponse, ChatCompletionTool } from '../api-client/index.js';
import { formatChatCompletionTools } from '../../components/index.js';
import { TYPES } from '../di/types.js';
// Define Logger type locally to avoid pino ESM import issues
type Logger = import('pino').Logger;
import {
    IThinkingModule,
    ThinkingModuleConfig,
    ThinkingPhaseResult,
    RecallRequest,
    defaultThinkingConfig,
    ThinkingState,
    ThoughtEntry,
    ActionStep,
} from './types.js';
import type { ITurnMemoryStore } from '../memory/TurnMemoryStore.interface.js';
import { ThinkingPromptBuilder } from '../prompts/thinking/index.js';

/**
 * State update extracted from update_thinking_state tool call
 */
interface StateUpdate {
    updateType: 'hypothesis' | 'evidence' | 'analysis' | 'action' | 'conclusion' | 'question';
    content: string;
    reasoning: string;
    metadata?: {
        source?: string;
        toolName?: string;
        parameters?: Record<string, any>;
        dependsOn?: string[];
    };
}

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

    // Incremental thinking state built via update_thinking_state tool
    private thinkingState: ThinkingState;

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

        // Initialize thinking state
        this.thinkingState = this.createInitialThinkingState();
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
     * Create initial thinking state for a new thinking phase
     */
    private createInitialThinkingState(): ThinkingState {
        return {
            evidence: [],
            analysisSteps: [],
            actionPlan: [],
            conclusions: [],
            confidence: 'medium',
            pendingQuestions: [],
            thoughtLog: [],
        };
    }

    /**
     * Reset thinking state for a new thinking phase
     */
    private resetThinkingState(): void {
        this.thinkingState = this.createInitialThinkingState();
    }

    /**
     * Perform thinking phase
     * Always performs reflective thinking - LLM controls rounds via continue_thinking tool
     * Now supports Sequential Thinking mode with enhanced tracking
     */
    async performThinkingPhase(
        workspaceContext: string,
        availableTools?: any[],
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult> {
        // Reset sequential state and thinking state for new thinking phase
        this.resetSequentialState();
        this.resetThinkingState();

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
                accumulatedSummaries,
                rounds,
                availableTools || []
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
            thinkingState: this.thinkingState,
            actionPlan: this.thinkingState.actionPlan,
        };
    }

    /**
     * Update sequential thinking state based on round results
     */
    private updateSequentialState(round: ThinkingRound): void {
        // Auto-increment thought number (system controlled)
        this.sequentialState.thoughtNumber++;

        // Update total thoughts estimate (LLM controlled)
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
        );

        return {
            ...result,
            sequentialState: { ...this.sequentialState },
        };
    }

    /**
     * Perform a single thinking round with retry mechanism
     * Retries when LLM doesn't call required tools
     */
    private async performSingleThinkingRound(
        roundNumber: number,
        workspaceContext: string,
        accumulatedSummaries: string,
        previousRounds: ThinkingRound[],
        actionTools: any[] = []
    ): Promise<ThinkingRound> {
        const tools = this.buildThinkingTools();
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.config.maxRetriesPerRound; attempt++) {
            // Build prompt with retry instructions if this is a retry
            const prompt = this.buildThinkingPrompt(
                roundNumber,
                workspaceContext,
                accumulatedSummaries,
                previousRounds,
                attempt,
                lastError,
                actionTools
            );

            try {
                // Handle errors from previous attempts
                const errors = this.turnMemoryStore.popErrors()
                let errorPrompt = ''
                if (errors.length > 0) {
                    errorPrompt = `=== PREVIOUS ERRORS (to learn from) ===
${errors.map((e, i) => `Error ${i + 1}: ${e.message}`).join('\n')}

Please take these errors into consideration and avoid repeating the same mistakes.
`
                }

                const response = await this.apiClient.makeRequest(
                    prompt.systemPrompt,
                    errorPrompt + prompt.context,
                    prompt.history,
                    { timeout: this.config.apiRequestTimeout },
                    tools
                );

                // Validate that only thinking-phase tools were used
                this.validateThinkingPhaseTools(response);

                // Extract and apply state updates from update_thinking_state tool
                const stateUpdate = this.extractStateUpdate(response);
                if (stateUpdate) {
                    this.updateThinkingState(stateUpdate);
                }

                const content = this.extractContent(response);
                const controlDecision = this.extractControlDecision(response);
                const recallRequest = this.extractRecallRequest(response);

                // Check if LLM called the required tool
                if (!controlDecision && !recallRequest) {
                    // LLM didn't call continue_thinking or recall_context - need to retry
                    lastError = new MissingToolCallError(
                        roundNumber,
                        'No required tool was called. You MUST call "continue_thinking" to indicate your decision'
                    );

                    this.turnMemoryStore.pushErrors([lastError])

                    this.logger.warn(
                        { roundNumber, attempt: attempt + 1, maxRetries: this.config.maxRetriesPerRound },
                        'LLM did not call required tool, will retry'
                    );

                    // If we have more retries, wait a bit and continue
                    if (attempt < this.config.maxRetriesPerRound) {
                        if (this.config.retryDelayMs > 0) {
                            await this.delay(this.config.retryDelayMs);
                        }
                        continue;
                    }

                    // No more retries - use fallback strategy
                    this.logger.error(
                        { roundNumber, attempts: attempt + 1 },
                        'Max retries exceeded for thinking round, using fallback'
                    );

                    // Fallback: treat as if continueThinking=false with the text response as content
                    return this.createFallbackRound(roundNumber, content, previousRounds);
                }

                // Success - LLM called the required tool
                const recalledContexts = recallRequest
                    ? this.handleRecall(recallRequest)
                    : [];

                // If recall was called but no continue_thinking, we still need to continue
                const continueThinking = controlDecision?.continueThinking ?? (recallRequest !== null);

                return {
                    roundNumber,
                    content,
                    continueThinking,
                    recalledContexts,
                    tokens: this.estimateTokens(content),
                    summary: controlDecision?.summary,
                    // Sequential Thinking properties
                    thoughtNumber: this.sequentialState.thoughtNumber,
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
                // Re-throw ThinkingPhaseToolViolationError - this should not be caught and ignored
                if (error instanceof ThinkingPhaseToolViolationError) {
                    throw error;
                }

                // For other errors, retry if we have attempts left
                lastError = error instanceof Error ? error : new Error(String(error));

                this.logger.error(
                    { error, roundNumber, attempt: attempt + 1, maxRetries: this.config.maxRetriesPerRound },
                    'Thinking round API call failed'
                );

                if (attempt < this.config.maxRetriesPerRound) {
                    if (this.config.retryDelayMs > 0) {
                        await this.delay(this.config.retryDelayMs);
                    }
                    continue;
                }

                // No more retries - return failure round
                return {
                    roundNumber,
                    content: `Thinking round failed after ${attempt + 1} attempts: ${lastError.message}`,
                    continueThinking: false,
                    recalledContexts: [],
                    tokens: 0,
                    thoughtNumber: this.sequentialState.thoughtNumber,
                    totalThoughts: this.sequentialState.totalThoughts,
                };
            }
        }

        // Should not reach here, but return a fallback just in case
        return this.createFallbackRound(roundNumber, 'Unexpected state in thinking round', previousRounds);
    }

    /**
     * Create a fallback round when all retries are exhausted
     */
    private createFallbackRound(
        roundNumber: number,
        content: string,
        previousRounds: ThinkingRound[]
    ): ThinkingRound {
        // If we have meaningful content from the LLM, use it
        const meaningfulContent = content && content !== 'No content'
            ? content
            : 'LLM did not provide thinking content after multiple attempts';

        return {
            roundNumber,
            content: meaningfulContent,
            continueThinking: false, // Stop thinking on fallback
            recalledContexts: [],
            tokens: this.estimateTokens(meaningfulContent),
            summary: undefined,
            thoughtNumber: this.sequentialState.thoughtNumber,
            totalThoughts: this.sequentialState.totalThoughts,
        };
    }

    /**
     * Delay helper for retry waits
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Build thinking prompt
     * Now includes Sequential Thinking guidance and retry instructions
     */
    private buildThinkingPrompt(
        roundNumber: number,
        workspaceContext: string,
        accumulatedSummaries: string,
        previousRounds: ThinkingRound[],
        retryAttempt: number = 0,
        lastError: Error | null = null,
        actionTools: any[] = []
    ): { systemPrompt: string; context: string; history: string[] } {
        const tools = this.buildThinkingTools();
        const toolsText = formatChatCompletionTools(tools);
        const hasActionTools = Array.isArray(actionTools) && actionTools.length > 0;
        const actionToolsText = hasActionTools
            ? formatChatCompletionTools(actionTools)
            : 'No action tools available in this session.';

        const systemPrompt = `╔══════════════════════════════════════════════════════════════════════════════╗
║                    🧠 THINKING PHASE - PLANNING ONLY 🧠                        ║
║                         NO EXECUTION ALLOWED                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

You are in the THINKING phase. This phase is EXCLUSIVELY for PLANNING and REFLECTION.
You CANNOT execute any actions during this phase.

═══════════════════════════════════════════════════════════════════════════════
                              WHAT YOU CAN DO
═══════════════════════════════════════════════════════════════════════════════

Your task is to PLAN using Sequential Thinking methodology:
1. Understand the user's overall task/goal
2. Analyze the current situation based on conversation history and workspace context
3. Review accumulated summaries from previous turns
4. Evaluate whether an Expert switch would be beneficial for the current task
5. Formulate a detailed action plan for the next phase (use update_thinking_state with updateType='action')
6. Decide whether to continue planning or proceed to action phase
7. Optionally recall historical contexts if needed

🧠 SEQUENTIAL THINKING PROCESS 🧠
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
1. Start with an initial estimate of thoughts needed (totalThoughts=N)
2. For each thought:
   - Provide your current thinking step
   - The system will automatically increment thoughtNumber
   - Adjust totalThoughts if needed (can increase or decrease)
   - Mark if this is a revision (isRevision=true, revisesThought=N)
   - Note if branching (branchFromThought=N, branchId="branch-name")
   - Generate hypotheses when appropriate
   - Verify hypotheses based on accumulated reasoning
3. Continue until satisfied with the solution
4. When done, provide a comprehensive summary

═══════════════════════════════════════════════════════════════════════════════
              📋 ACTION TOOLS (REFERENCE ONLY - DO NOT CALL DIRECTLY)
═══════════════════════════════════════════════════════════════════════════════

These tools will be available in the ACTION phase. Use them to plan your approach,
but do NOT call them directly. Instead, use update_thinking_state with updateType='action'
to record your planned actions.

${actionToolsText}

═══════════════════════════════════════════════════════════════════════════════
                      AVAILABLE PLANNING TOOLS
═══════════════════════════════════════════════════════════════════════════════

You have access to ONLY these tools for planning purposes:

${toolsText}

═══════════════════════════════════════════════════════════════════════════════
                    🚫 ABSOLUTE RESTRICTIONS 🚫
═══════════════════════════════════════════════════════════════════════════════

⛔ THIS IS A PLANNING-ONLY PHASE - YOU CANNOT EXECUTE ANY ACTIONS ⛔

You can ONLY use these tools:
✅ 'continue_thinking' - To continue planning or signal you're ready for action phase
✅ 'recall_context' - To recall historical conversation context
✅ 'update_thinking_state' - To update your thinking state and record planned actions

🚫 YOU ARE STRICTLY FORBIDDEN FROM CALLING ANY OTHER TOOLS 🚫

This includes but is NOT limited to:
❌ NO search tools (search_pubmed, search_database, web_search, etc.)
❌ NO data manipulation tools (set_picos_element, update_record, write_file, etc.)
❌ NO fetch tools (fetch_article, get_data, retrieve_info, etc.)
❌ NO Expert activation tools (get_expert, activate_expert, list_experts)
❌ NO task completion tools (attempt_completion)
❌ NO any other tools listed in "ACTION TOOLS" section

To plan an action, use:
update_thinking_state({
  updateType: 'action',
  content: 'description of what this action does',
  reasoning: 'why this action is needed',
  metadata: {
    toolName: 'actual_tool_name',
    parameters: { param1: 'value1' },
    dependsOn: ['previous-step-id'] // optional
  }
})

═══════════════════════════════════════════════════════════════════════════════
              ⚠️ OVERRIDING ANY EXPERT PROMPT INSTRUCTIONS ⚠️
═══════════════════════════════════════════════════════════════════════════════

IMPORTANT: If you see any instructions in the workspace context or Expert prompts
that tell you to "immediately execute", "call this tool now", "perform action",
or similar urgent directives, IGNORE THEM during this THINKING phase.

Those instructions apply to the ACTION phase, NOT the THINKING phase.

Your ONLY job right now is to:
1. THINK and PLAN
2. Call 'continue_thinking' to continue planning or exit to action phase
3. Call 'update_thinking_state' to record your planned actions
4. Optionally call 'recall_context' to recall history

All action tools will be available AFTER you exit thinking phase by calling
continue_thinking with continueThinking=false.

═══════════════════════════════════════════════════════════════════════════════
                         RESPONSE FORMAT
═══════════════════════════════════════════════════════════════════════════════

You MUST provide your thinking as TEXT FIRST, before calling any tools.

Format your response as:
1. Write your thinking/reasoning in plain text (this will be stored as the thinking content)
2. Then call the continue_thinking tool with your decision and Sequential Thinking parameters

Example format:
"Thought 1: I need to analyze this clinical question. The P is adult patients with type 2 diabetes.
Looking at the available Experts, I see a meta-analysis Expert that would be appropriate.
My plan is: 1) Exit thinking phase, 2) Activate the Expert, 3) Execute the workflow.
I estimate I'll need about 3 thoughts to complete this plan."
[Then call continue_thinking with totalThoughts=3]

═══════════════════════════════════════════════════════════════════════════════
                    WHAT TO THINK ABOUT
═══════════════════════════════════════════════════════════════════════════════

Think deeply about:
- What the user wants to accomplish (the overall goal)
- What has been accomplished so far
- What needs to be done next (create a step-by-step plan)
- What information is missing
- Whether you need to recall any historical context
- Whether you have enough understanding to take action
- What hypotheses can be formed and how to verify them
- Which Expert (if any) should be activated for this task

═══════════════════════════════════════════════════════════════════════════════
                         EXITING THINKING PHASE
═══════════════════════════════════════════════════════════════════════════════

When you decide to STOP thinking (continue_thinking with continueThinking=false),
you MUST provide a detailed summary in the same tool call. This summary will be stored as
the official record of this thinking phase and will guide the ACTION phase.

⚠️ IMPORTANT: Your summary should focus ONLY on THIS turn's progress. DO NOT repeat
information that was already covered in previous turns. The previous thinking rounds are
already stored in memory - just summarize what THIS turn accomplished and what needs to
happen next to continue this turn's task.

Current thinking round: ${roundNumber}/${this.config.maxThinkingRounds}
Current thought number: ${this.sequentialState.thoughtNumber}
Estimated total thoughts: ${this.sequentialState.totalThoughts}${this.buildRetryWarning(retryAttempt, lastError)}`;


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

        const context = `
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRoundsText || 'None yet'}
`;

        // Get conversation history from TurnMemoryStore
        // Filter out action phase messages (tool_use, tool_result) to avoid confusing the thinking phase
        // The thinking phase should only see:
        // 1. User messages (the original task)
        // 2. System messages with text content (thinking summaries, not tool results)
        const allMessages = this.turnMemoryStore.getAllMessages();
        const history = allMessages
            .filter(msg => {
                // Filter out messages that contain tool_use or tool_result blocks
                const hasToolUse = msg.content.some(block => block.type === 'tool_use');
                const hasToolResult = msg.content.some(block => block.type === 'tool_result');

                // Skip messages with tool_use or tool_result (these are from action phase)
                if (hasToolUse || hasToolResult) {
                    return false;
                }

                // Only include messages with text content
                const hasTextContent = msg.content.some(block => block.type === 'text');
                return hasTextContent;
            })
            .map(msg => {
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
- totalThoughts: Current estimate of thoughts needed (can be adjusted up/down)
- Note: thoughtNumber is automatically managed by the system
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
                            totalThoughts: {
                                type: 'number',
                                description: 'Estimated total thoughts needed (numeric value, e.g., 3, 5). The system will auto-increment the thought number.',
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
                                description: 'What to focus on in the next thinking round (if continuing). Include Expert evaluation if considering a switch.',
                            },
                            summary: {
                                type: 'string',
                                description: 'REQUIRED when continueThinking=false: A detailed summary with DONE and TODO sections, focusing ONLY on THIS turn. DO NOT repeat information from previous turns. DONE: specific actions taken in THIS turn, concrete results obtained, decisions made in THIS turn, challenges encountered in THIS turn. TODO: next steps to continue from where THIS turn left off, missing information needed to proceed, follow-up tasks for THIS turn only. Preserve important details like search terms, numbers, tool names, and key findings.',
                            },
                        },
                        required: ['continueThinking', 'totalThoughts'],
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
            {
                type: 'function',
                function: {
                    name: 'update_thinking_state',
                    description: `Update the shared thinking state incrementally.
This tool allows you to build up your analysis step by step during the thinking phase.
Use this to:
- Add evidence as you discover it (updateType: 'evidence')
- Update your hypothesis based on new information (updateType: 'hypothesis')
- Add steps to your action plan as you think them through (updateType: 'action')
- Record conclusions when you reach them (updateType: 'conclusion')
- Note questions that need to be answered (updateType: 'question')
- Record analysis steps (updateType: 'analysis')`,
                    parameters: {
                        type: 'object',
                        properties: {
                            updateType: {
                                type: 'string',
                                enum: ['hypothesis', 'evidence', 'analysis', 'action', 'conclusion', 'question'],
                                description: 'What aspect of thinking state to update',
                            },
                            content: {
                                type: 'string',
                                description: 'The content to add or update',
                            },
                            reasoning: {
                                type: 'string',
                                description: 'Why you are making this update (helps maintain trace of your reasoning)',
                            },
                            metadata: {
                                type: 'object',
                                description: 'Additional metadata for specific update types',
                                properties: {
                                    source: {
                                        type: 'string',
                                        description: 'Source of evidence (e.g., tool name, article ID)',
                                    },
                                    toolName: {
                                        type: 'string',
                                        description: 'Tool name for action updates',
                                    },
                                    parameters: {
                                        type: 'object',
                                        description: 'Tool parameters for action updates',
                                    },
                                    dependsOn: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: 'Step IDs this action depends on',
                                    },
                                },
                            },
                        },
                        required: ['updateType', 'content', 'reasoning'],
                    },
                },
            },
        ];
    }

    /**
     * Handle context recall
     * Deduplicates results when both turnNumbers and keywords are provided
     */
    private handleRecall(request: RecallRequest): Turn[] {
        const recalled: Turn[] = [];
        const seenTurnIds = new Set<string>();

        const addTurnIfNotSeen = (turn: Turn) => {
            if (!seenTurnIds.has(turn.id)) {
                seenTurnIds.add(turn.id);
                recalled.push(turn);
            }
        };

        if (request.turnNumbers) {
            for (const turn of request.turnNumbers) {
                const t = this.turnMemoryStore.getTurnByNumber(turn);
                if (t) {
                    addTurnIfNotSeen(t);
                }
            }
        }

        if (request.keywords) {
            for (const keyword of request.keywords) {
                const turns = this.turnMemoryStore.searchTurns(keyword);
                for (const turn of turns) {
                    addTurnIfNotSeen(turn);
                }
            }
        }

        return recalled;
    }

    /**
     * Validate that only thinking-phase tools were used in the response
     * @throws ThinkingPhaseToolViolationError if action-phase tools were attempted
     */
    private validateThinkingPhaseTools(response: ApiResponse): void {
        const allowedTools = ['continue_thinking', 'recall_context', 'update_thinking_state'];

        const violatingTools = response.toolCalls
            .filter(tc => !allowedTools.includes(tc.name))
            .map(tc => tc.name);

        if (violatingTools.length > 0) {
            this.logger.error(
                { violatingTools, allowedTools },
                'Thinking phase tool violation detected'
            );
            throw new ThinkingPhaseToolViolationError(violatingTools);
        }
    }

    /**
     * Extract state update from update_thinking_state tool call
     */
    private extractStateUpdate(response: ApiResponse): StateUpdate | null {
        if (!response.toolCalls) {
            return null;
        }

        const stateUpdateCall = response.toolCalls.find(
            (tc: any) => tc.name === 'update_thinking_state'
        );

        if (!stateUpdateCall) {
            return null;
        }

        try {
            const args = JSON.parse(stateUpdateCall.arguments);
            return {
                updateType: args.updateType,
                content: args.content,
                reasoning: args.reasoning,
                metadata: args.metadata,
            };
        } catch (e) {
            this.logger.warn({ error: e }, 'Failed to parse update_thinking_state arguments');
            return null;
        }
    }

    /**
     * Update thinking state based on extracted state update
     */
    private updateThinkingState(update: StateUpdate): void {
        const entry: ThoughtEntry = {
            thoughtNumber: this.sequentialState.thoughtNumber,
            updateType: update.updateType,
            content: update.content,
            reasoning: update.reasoning,
            timestamp: Date.now(),
        };

        this.thinkingState.thoughtLog.push(entry);

        switch (update.updateType) {
            case 'hypothesis':
                this.thinkingState.hypothesis = update.content;
                this.thinkingState.hypothesisVerified = false;
                break;

            case 'evidence':
                this.thinkingState.evidence.push({
                    source: update.metadata?.source || 'unknown',
                    content: update.content,
                    relevance: update.metadata?.source,
                });
                break;

            case 'analysis':
                this.thinkingState.analysisSteps.push({
                    stepId: `analysis-${this.thinkingState.analysisSteps.length + 1}`,
                    description: update.content,
                    result: update.metadata?.source,
                });
                break;

            case 'action':
                this.thinkingState.actionPlan.push({
                    stepId: `action-${this.thinkingState.actionPlan.length + 1}`,
                    toolName: update.metadata?.toolName || 'unknown',
                    parameters: update.metadata?.parameters || {},
                    reasoning: update.reasoning,
                    dependsOn: update.metadata?.dependsOn,
                    status: 'planned',
                });
                break;

            case 'conclusion':
                this.thinkingState.conclusions.push(update.content);
                break;

            case 'question':
                this.thinkingState.pendingQuestions.push(update.content);
                break;
        }

        this.logger.debug(
            { updateType: update.updateType, content: update.content },
            'Thinking state updated'
        );
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
        previousSummaries: string,
        thinkingRounds: ThinkingRound[],
        toolResults?: ToolCallResult[]
    ): Promise<string> {
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

## TODO
- What the next steps or actions should be
- What information is still missing or needs to be gathered
- What follow-up tasks are required

The summary should preserve important details like:
- Specific search terms, keywords, or queries used
- Exact numbers (article counts, data points, measurements)
- Names of tools, databases, or resources accessed
- Key findings or insights discovered
- Specific actions taken and their outcomes
- Expert-related decisions and recommendations

If this turn builds upon previous turns, mention the connection and how it advances the overall task.`;

        try {
            const response = await this.apiClient.makeRequest(
                'You are a detailed summarization assistant. Generate comprehensive summaries that preserve important details and maintain narrative continuity.',
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
        summary?: string;
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

    /**
     * Build retry warning message for system prompt
     */
    private buildRetryWarning(retryAttempt: number, lastError: Error | null): string {
        if (retryAttempt === 0 || !lastError) {
            return '';
        }

        return `

⚠️ RETRY ATTEMPT ${retryAttempt}/${this.config.maxRetriesPerRound} ⚠️

Previous attempt failed with error:
"${lastError.message}"

IMPORTANT: You MUST call the 'continue_thinking' tool to indicate your decision.
Text-only responses are NOT sufficient. Call the tool with:
- continueThinking=true to continue planning
- continueThinking=false to proceed to action phase (and provide a summary)`;
    }
}
