/**
 * Base error class for Task-related errors
 */
export abstract class TaskError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when task is aborted
 */
export class TaskAbortedError extends TaskError {
  readonly code = 'TASK_ABORTED';

  constructor(taskId: string, cause?: Error) {
    super(`Task ${taskId} was aborted`, cause);
  }
}

/**
 * Error thrown when consecutive mistake limit is reached
 */
export class ConsecutiveMistakeError extends TaskError {
  readonly code = 'CONSECUTIVE_MISTAKE_LIMIT';

  constructor(limit: number, cause?: Error) {
    super(`Consecutive mistake limit of ${limit} reached`, cause);
  }
}

/**
 * Error thrown when API request times out
 */
export class ApiTimeoutError extends TaskError {
  readonly code = 'API_TIMEOUT';

  constructor(timeoutMs: number, cause?: Error) {
    super(`API request timed out after ${timeoutMs}ms`, cause);
  }
}

/**
 * Error thrown when API request fails
 */
export class ApiRequestError extends TaskError {
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
export class NoApiResponseError extends TaskError {
  readonly code = 'NO_API_RESPONSE';

  constructor(attempt: number, cause?: Error) {
    super(`No response received from API (attempt ${attempt})`, cause);
  }
}

/**
 * Error thrown when LLM doesn't use any tools
 */
export class NoToolsUsedError extends TaskError {
  readonly code = 'NO_TOOLS_USED';

  constructor(cause?: Error) {
    super('LLM did not use any tools', cause);
  }
}

/**
 * Error thrown when streaming fails
 */
export class StreamingError extends TaskError {
  readonly code = 'STREAMING_FAILED';

  constructor(message: string, cause?: Error) {
    super(`Streaming failed: ${message}`, cause);
  }
}

/**
 * Error thrown when maximum retry attempts are exceeded
 */
export class MaxRetryExceededError extends TaskError {
  readonly code = 'MAX_RETRY_EXCEEDED';

  readonly errors: TaskError[];

  constructor(maxAttempts: number, errors: TaskError[], cause?: Error) {
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
export class ToolExecutionFailedError extends TaskError {
  readonly code = 'TOOL_EXECUTION_FAILED';

  constructor(
    toolName: string,
    message: string,
    cause?: Error,
  ) {
    super(`Tool execution failed for '${toolName}': ${message}`, cause);
  }
}
