/**
 * Common Error Types - Shared error definitions across the agent system
 *
 * This module contains error classes that are used across multiple modules.
 */

// =============================================================================
// Base Error
// =============================================================================

/**
 * Base error class for agent-related errors
 */
export abstract class AgentError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use AgentError instead
 */
export type TaskError = AgentError;

// =============================================================================
// Task/Agent Errors
// =============================================================================

/**
 * Error thrown when task is aborted
 */
export class TaskAbortedError extends AgentError {
  readonly code = 'TASK_ABORTED';

  constructor(taskId: string, cause?: Error) {
    super(`Task ${taskId} was aborted`, cause);
  }
}

/**
 * Error thrown when consecutive mistake limit is reached
 */
export class ConsecutiveMistakeError extends AgentError {
  readonly code = 'CONSECUTIVE_MISTAKE_LIMIT';

  constructor(limit: number, cause?: Error) {
    super(`Consecutive mistake limit of ${limit} reached`, cause);
  }
}

/**
 * Error thrown when API request times out
 */
export class ApiTimeoutError extends AgentError {
  readonly code = 'API_TIMEOUT';

  constructor(timeoutMs: number, cause?: Error) {
    super(`API request timed out after ${timeoutMs}ms`, cause);
  }
}

/**
 * Error thrown when API request fails
 */
export class ApiRequestError extends AgentError {
  readonly code = 'API_REQUEST_FAILED';

  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: Error,
  ) {
    super(`API request failed: ${message}`, cause);
  }
}

/**
 * Error thrown when no response is received from API
 */
export class NoApiResponseError extends AgentError {
  readonly code = 'NO_API_RESPONSE';

  constructor(attempt: number, cause?: Error) {
    super(`No response received from API (attempt ${attempt})`, cause);
  }
}

/**
 * Error thrown when LLM doesn't use any tools
 */
export class NoToolsUsedError extends AgentError {
  readonly code = 'NO_TOOLS_USED';

  constructor(cause?: Error) {
    super('LLM did not use any tools', cause);
  }
}

/**
 * Error thrown when streaming fails
 */
export class StreamingError extends AgentError {
  readonly code = 'STREAMING_FAILED';

  constructor(message: string, cause?: Error) {
    super(`Streaming failed: ${message}`, cause);
  }
}

/**
 * Error thrown when maximum retry attempts are exceeded
 */
export class MaxRetryExceededError extends AgentError {
  readonly code = 'MAX_RETRY_EXCEEDED';

  readonly errors: AgentError[];

  constructor(maxAttempts: number, errors: AgentError[], cause?: Error) {
    super(
      `Maximum retry attempts (${maxAttempts}) exceeded. Collected ${errors.length} errors.`,
      cause,
    );
    this.errors = errors;
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionFailedError extends AgentError {
  readonly code = 'TOOL_EXECUTION_FAILED';

  constructor(
    toolName: string,
    message: string,
    cause?: Error,
  ) {
    super(`Tool execution failed for '${toolName}': ${message}`, cause);
  }
}

/**
 * Error thrown when agent attempts to complete with unreplied emails pending
 * Used in mail-driven mode to enforce mandatory reply policy
 */
export class UnrepliedMailError extends AgentError {
  readonly code = 'UNREPLIED_MAIL';

  constructor(public readonly unrepliedMailIds: string[]) {
    super(
      `Cannot complete: ${unrepliedMailIds.length} unreplied email(s) remaining. Reply to all emails before completing.`,
    );
    this.name = 'UnrepliedMailError';
  }
}

/**
 * Error thrown when LLM returns no tool calls in a response
 */
export class NoToolUseError extends AgentError {
  readonly code = 'NO_TOOL_USE';

  constructor(cause?: Error) {
    super('LLM did not use any tools in the response', cause);
  }
}
