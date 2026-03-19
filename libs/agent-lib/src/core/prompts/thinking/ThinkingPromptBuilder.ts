/**
 * Thinking Prompt Builder
 *
 * Builds the system prompt for the thinking phase using shared common modules.
 */

import type { ChatCompletionTool } from '../../api-client/index.js';
import { formatChatCompletionTools } from '../../components/index.js';
import type { ThinkingPhaseRound, ThinkingSequentialState } from '../../memory/Turn.js';
import {
  getBaseInstruction,
  getThinkingPhaseToolGuidance,
  getThinkingPhaseRestrictions,
  getExpertPromptOverrideWarning,
  getSequentialThinkingSection,
  getPlanningGuidance,
  getExitInstructions,
  getRetryWarning,
} from '../common/index.js';

/**
 * Configuration for ThinkingPromptBuilder
 */
export interface ThinkingPromptBuilderConfig {
  roundNumber: number;
  maxRounds: number;
  sequentialState: ThinkingSequentialState;
  retryAttempt?: number;
  lastError?: Error | null;
}

/**
 * Result from building the thinking prompt
 */
export interface ThinkingPromptResult {
  systemPrompt: string;
  context: string;
  history: string[];
}

/**
 * Sequential Thinking state interface (matches the internal state in ThinkingModule)
 */
export interface ThinkingSequentialState {
  thoughtNumber: number;
  totalThoughts: number;
  branches: Map<string, number[]>;
  activeBranchId?: string;
}

/**
 * Builder class for constructing thinking phase prompts
 */
export class ThinkingPromptBuilder {
  private tools: ChatCompletionTool[] = [];
  private history: string[] = [];

  constructor(private config: ThinkingPromptBuilderConfig) {}

  /**
   * Set the tools available in thinking phase
   */
  setTools(tools: ChatCompletionTool[]): this {
    this.tools = tools;
    return this;
  }

  /**
   * Set the conversation history
   */
  setHistory(history: string[]): this {
    this.history = history;
    return this;
  }

  /**
   * Build the complete thinking phase system prompt
   */
  buildSystemPrompt(): string {
    const { roundNumber, maxRounds, sequentialState, retryAttempt = 0, lastError = null } = this.config;

    const retryWarning = getRetryWarning(retryAttempt, lastError);

    // Build exit instructions with current state
    const exitInstructions = getExitInstructions({
      roundNumber,
      maxRounds,
      thoughtNumber: sequentialState.thoughtNumber,
      totalThoughts: sequentialState.totalThoughts,
      retryWarning,
    });

    return `╔══════════════════════════════════════════════════════════════════════════════╗
║                    🧠 THINKING PHASE - PLANNING ONLY 🧠                        ║
║                         NO EXECUTION ALLOWED                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

You are in the THINKING phase. This phase is EXCLUSIVELY for PLANNING and REFLECTION.
You CANNOT execute any actions during this phase.

${getBaseInstruction()}

${getThinkingPhaseToolGuidance()}

${getThinkingPhaseRestrictions()}

${getExpertPromptOverrideWarning()}

${getSequentialThinkingSection()}

${getPlanningGuidance()}

${this.buildAvailableToolsSection()}

${getExitInstructions({
  roundNumber,
  maxRounds,
  thoughtNumber: sequentialState.thoughtNumber,
  totalThoughts: sequentialState.totalThoughts,
  retryWarning,
})}`;
  }

  /**
   * Build the available tools section
   */
  private buildAvailableToolsSection(): string {
    if (this.tools.length === 0) {
      return '';
    }

    const toolsText = formatChatCompletionTools(this.tools);

    return `====

AVAILABLE TOOLS (PLANNING ONLY)

You have access to ONLY these tools for planning purposes:

${toolsText}`;
  }

  /**
   * Build the context section (workspace + summaries + previous rounds)
   */
  buildContext(
    workspaceContext: string,
    accumulatedSummaries: string,
    previousRounds: ThinkingPhaseRound[]
  ): string {
    const previousRoundsText = this.buildPreviousRoundsText(previousRounds);

    return `
=== WORKSPACE CONTEXT ===
${workspaceContext}

${accumulatedSummaries}

=== PREVIOUS THINKING ROUNDS ===
${previousRoundsText || 'None yet'}
`;
  }

  /**
   * Build the previous rounds text
   */
  private buildPreviousRoundsText(rounds: ThinkingPhaseRound[]): string {
    return rounds.map(r => {
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
  }

  /**
   * Get the history
   */
  getHistory(): string[] {
    return this.history;
  }

  /**
   * Build the complete prompt result
   */
  build(): ThinkingPromptResult {
    return {
      systemPrompt: this.buildSystemPrompt(),
      context: '',  // Context is built separately with runtime data
      history: this.history,
    };
  }
}
