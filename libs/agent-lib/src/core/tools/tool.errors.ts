export abstract class ToolError extends Error {
    abstract readonly code: string;
    abstract readonly retryable: boolean;

    constructor(
        message: string,
        public override readonly cause?: Error,
    ) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class ToolNotFoundError extends ToolError {
    readonly code = 'TOOL_NOT_FOUND';
    readonly retryable = true;

    constructor(toolName: string, cause?: Error) {
        super(`Tool '${toolName}' not found`, cause);
    }
}

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
