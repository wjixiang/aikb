/**
 * Base error class for Tool-related errors
 */
export abstract class ToolError extends Error {
    abstract readonly code: string;
    abstract readonly retryable: boolean;

    constructor(
        message: string,
        public readonly cause?: Error,
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * Error thrown when a tool is not found
 */
export class ToolNotFoundError extends ToolError {
    readonly code = 'TOOL_NOT_FOUND';
    readonly retryable = true;

    constructor(toolName: string, cause?: Error) {
        super(`Tool '${toolName}' not found`, cause);
    }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends ToolError {
    readonly code = 'TOOL_EXECUTION_FAILED';
    readonly retryable = true;

    constructor(
        toolName: string,
        message: string,
        cause?: Error,
    ) {
        super(`Tool '${toolName}' execution failed: ${message}`, cause);
    }
}

/**
 * Error thrown when tool parameters are invalid
 */
export class ToolParameterError extends ToolError {
    readonly code = 'TOOL_PARAMETER_INVALID';
    readonly retryable = true;

    constructor(
        toolName: string,
        paramName: string,
        message: string,
        cause?: Error,
    ) {
        super(`Tool '${toolName}' parameter '${paramName}' is invalid: ${message}`, cause);
    }
}

/**
 * Error thrown when tool times out
 */
export class ToolTimeoutError extends ToolError {
    readonly code = 'TOOL_TIMEOUT';
    readonly retryable = true;

    constructor(
        toolName: string,
        timeoutMs: number,
        cause?: Error,
    ) {
        super(`Tool '${toolName}' timed out after ${timeoutMs}ms`, cause);
    }
}

/**
 * Error thrown when tool is not properly registered
 */
export class ToolNotRegisteredError extends ToolError {
    readonly code = 'TOOL_NOT_REGISTERED';
    readonly retryable = true;

    constructor(toolName: string, cause?: Error) {
        super(`Tool '${toolName}' is not registered in the tool set`, cause);
    }
}
