/**
 * Turn-based memory architecture
 *
 * A Turn represents a complete interaction cycle:
 * User Input → Thinking → Action → Tool Execution → Workspace Update
 */

import { ApiMessage } from './types.js';

/**
 * Turn status enum
 */
export enum TurnStatus {
    PENDING = 'pending',           // Just created, waiting for processing
    THINKING = 'thinking',         // In thinking phase
    ACTING = 'acting',             // In action phase (API request)
    EXECUTING = 'executing',       // Executing tool calls
    COMPLETED = 'completed',       // Completed successfully
    FAILED = 'failed'              // Failed with error
}

/**
 * Thinking round in a turn
 * Now supports Sequential Thinking mode with enhanced tracking
 */
export interface ThinkingRound {
    roundNumber: number;
    content: string;
    continueThinking: boolean;
    recalledContexts: any[];
    tokens: number;
    /** Summary provided by LLM when deciding to stop thinking (continueThinking=false) */
    summary?: string;

    // Sequential Thinking properties (always available, defaults to standard mode)
    /** Current thought number in sequence */
    thoughtNumber: number;
    /** Estimated total thoughts needed */
    totalThoughts: number;
    /** Whether this thought revises previous thinking */
    isRevision?: boolean;
    /** Which thought number is being reconsidered */
    revisesThought?: number;
    /** Branching point thought number */
    branchFromThought?: number;
    /** Branch identifier */
    branchId?: string;
    /** If more thoughts are needed at the end */
    needsMoreThoughts?: boolean;
    /** Hypothesis generated (if any) */
    hypothesis?: string;
    /** Hypothesis verification result (if any) */
    hypothesisVerified?: boolean;
}

/**
 * Tool call result
 */
export interface ToolCallResult {
    toolName: string;
    success: boolean;
    result: any;
    timestamp: number;
}

/**
 * Turn object - represents a complete interaction cycle
 */
export interface Turn {
    // Basic information
    id: string;                          // Unique identifier
    turnNumber: number;                  // Turn number (starts from 1)
    timestamp: number;                   // Creation timestamp
    status: TurnStatus;                  // Current status

    // Task context (user's initial goal/query for this turn)
    taskContext?: string;

    // Messages in this turn (user → assistant → tool_result)
    messages: ApiMessage[];

    // Workspace context (immutable after creation)
    workspaceContext: string;

    // Thinking phase (optional)
    thinkingPhase?: {
        rounds: ThinkingRound[];         // Thinking rounds
        tokensUsed: number;              // Tokens used in thinking
    };

    // Tool calls
    toolCalls: ToolCallResult[];

    // Summary and insights
    summary?: string;                    // LLM-generated summary
    insights?: string[];                 // Extracted insights

    // Token usage statistics
    tokenUsage: {
        thinking: number;                // Thinking phase tokens
        action: number;                  // Action phase tokens
        total: number;                   // Total tokens
    };
}

/**
 * Export format for Turn memory
 */
export interface TurnMemoryExport {
    turns: Turn[];
    currentTurnNumber: number;
}
