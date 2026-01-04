import {
    TaskError,
    ApiTimeoutError,
    ApiRequestError,
    MaxRetryExceededError,
    ToolExecutionFailedError,
} from '../task.errors';
import { ToolExecutionError, ToolTimeoutError, ToolNotFoundError } from '../../tools';

/**
 * Configuration for error handling and retry logic
 */
export interface ErrorHandlingConfig {
    maxRetryAttempts: number;
    apiRequestTimeout: number;
}

/**
 * Handles error conversion and retry logic for task operations
 */
export class TaskErrorHandler {
    private readonly maxRetryAttempts: number;
    private readonly apiRequestTimeout: number;
    private collectedErrors: TaskError[] = [];

    constructor(config: ErrorHandlingConfig) {
        this.maxRetryAttempts = config.maxRetryAttempts;
        this.apiRequestTimeout = config.apiRequestTimeout;
    }

    /**
     * Convert an error to a TaskError
     */
    convertToTaskError(error: unknown): TaskError {
        if (error instanceof TaskError) {
            return error;
        }

        // Handle tool-specific errors
        if (error instanceof ToolNotFoundError) {
            // Tool not found is not retryable
            return new ToolExecutionFailedError(
                error.message.split("'")[1] || 'unknown',
                error.message,
                error,
                false, // Not retryable
            );
        }

        if (error instanceof ToolTimeoutError) {
            // Tool timeout is retryable
            return new ToolExecutionFailedError(
                error.message.split("'")[1] || 'unknown',
                error.message,
                error,
                true, // Retryable
            );
        }

        if (error instanceof ToolExecutionError) {
            // Tool execution error is retryable
            return new ToolExecutionFailedError(
                error.message.split("'")[1] || 'unknown',
                error.message,
                error,
                true, // Retryable
            );
        }

        if (error instanceof Error) {
            // Check for timeout errors
            if (error.message.includes('timed out')) {
                return new ApiTimeoutError(this.apiRequestTimeout, error);
            }
            return new ApiRequestError(error.message, undefined, error);
        }

        return new ApiRequestError(String(error));
    }

    /**
     * Handle an error and determine if it should be retried
     * @returns The TaskError to throw, or null if retrying
     * @throws TaskError if the error is non-retryable or max retries exceeded
     */
    handleError(error: unknown, retryAttempt: number): TaskError | null {
        const taskError = this.convertToTaskError(error);
        this.collectedErrors.push(taskError);

        console.error(
            `Error in operation (attempt ${retryAttempt + 1}):`,
            taskError,
        );

        // Don't retry non-retryable errors
        if (!taskError.retryable) {
            console.error(
                `Non-retryable error encountered: ${taskError.code}. Aborting.`,
            );
            throw taskError;
        }

        // Check if we've exceeded the maximum retry attempts
        if (retryAttempt >= this.maxRetryAttempts) {
            console.error(
                `Maximum retry attempts (${this.maxRetryAttempts}) exceeded due to errors. Aborting.`,
            );
            throw new MaxRetryExceededError(
                this.maxRetryAttempts,
                this.collectedErrors,
            );
        }

        // Return null to indicate retry should be attempted
        console.log(
            `Retrying after error (attempt ${retryAttempt + 2}/${this.maxRetryAttempts + 1})`,
        );
        return null;
    }

    /**
     * Get all collected errors for debugging purposes
     */
    getCollectedErrors(): TaskError[] {
        return [...this.collectedErrors];
    }

    /**
     * Reset collected errors (useful for starting a new operation)
     */
    resetCollectedErrors(): void {
        this.collectedErrors = [];
    }
}
