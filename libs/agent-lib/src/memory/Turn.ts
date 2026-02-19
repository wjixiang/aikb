/**
 * Turn-based memory architecture
 *
 * A Turn represents a complete interaction cycle:
 * User Input → Thinking → Action → Tool Execution → Workspace Update
 */

import { ApiMessage } from '../task/task.type.js';

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
 */
export interface ThinkingRound {
    roundNumber: number;
    content: string;
    continueThinking: boolean;
    recalledContexts: any[];
    tokens: number;
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
