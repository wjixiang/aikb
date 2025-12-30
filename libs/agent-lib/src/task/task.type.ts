import Anthropic from '@anthropic-ai/sdk';

export type TaskStatus = 'idle' | 'running' | 'completed' | 'aborted';

/**
 * Thinking block for assistant messages
 */
export interface ThinkingBlock {
    type: 'thinking';
    thinking: string;
}

/**
 * Extended content block type that includes custom thinking blocks
 */
export type ExtendedContentBlock = Anthropic.ContentBlockParam | ThinkingBlock;

/**
 * Simplified task persistence types
 * Extracted from core/task-persistence/index.ts
 */
export interface ApiMessage {
    role: 'user' | 'assistant' | 'system';
    content:
    | string
    | Anthropic.ContentBlockParam[]
    | ExtendedContentBlock[];
    ts?: number;
}

/**
 * Extended message type with reasoning support and timestamp
 * This type represents a message that has been processed and includes:
 * - The original message content
 * - Optional reasoning for assistant messages
 * - Timestamp for tracking
 */
export interface ExtendedApiMessage {
    role: 'user' | 'assistant' | 'system';
    content: Array<Anthropic.ContentBlockParam | ThinkingBlock>;
    ts: number;
}

/**
 * Callback type for message added events
 */
export type MessageAddedCallback = (taskId: string, message: ApiMessage) => void;

/**
 * Callback type for task status changed events
 */
export type TaskStatusChangedCallback = (taskId: string, changedStatus: TaskStatus) => void;

/**
 * Simplified task metadata
 * Extracted from core/task-persistence/taskMetadata.ts
 */
export interface TaskMetadata {
    taskId: string;
    startTime?: number;
    endTime?: number;
    tokenCount?: number;
    cost?: number;
}