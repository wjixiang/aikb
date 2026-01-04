import { TaskError } from '../task.errors';

/**
 * Generates user-friendly error prompts for the LLM
 * Converts error information into readable text format
 */
export class ErrorHandlerPrompt {
    /**
     * Format an error into a user-friendly prompt message
     */
    static formatErrorPrompt(error: TaskError, retryAttempt: number): string {
        const errorType = this.getErrorTypeLabel(error);
        const suggestion = this.getErrorSuggestion(error);

        return `⚠️ Error Occurred (Attempt ${retryAttempt + 1})

**Error Type:** ${errorType}
**Error Code:** ${error.code}
**Message:** ${error.message}

${suggestion ? `**Suggestion:** ${suggestion}` : ''}

This error is retryable. The system will attempt to retry the operation.`;
    }

    /**
     * Get a user-friendly label for the error type
     */
    private static getErrorTypeLabel(error: TaskError): string {
        switch (error.code) {
            case 'API_TIMEOUT':
                return 'API Timeout';
            case 'API_REQUEST_FAILED':
                return 'API Request Error';
            case 'TOOL_EXECUTION_FAILED':
                return 'Tool Execution Failed';
            case 'MAX_RETRY_EXCEEDED':
                return 'Maximum Retry Attempts Exceeded';
            case 'NO_API_RESPONSE':
                return 'No API Response';
            case 'NO_TOOLS_USED':
                return 'No Tools Used';
            case 'CONSECUTIVE_MISTAKE_LIMIT':
                return 'Consecutive Mistake Limit Reached';
            case 'TASK_ABORTED':
                return 'Task Aborted';
            case 'STREAMING_FAILED':
                return 'Streaming Failed';
            default:
                return 'Unknown Error';
        }
    }

    /**
     * Get a helpful suggestion based on the error type
     */
    private static getErrorSuggestion(error: TaskError): string {
        switch (error.code) {
            case 'API_TIMEOUT':
                return 'The API request took too long to complete. Try simplifying your request or check your network connection.';
            case 'API_REQUEST_FAILED':
                return 'There was an error communicating with the API. Please check your API configuration and try again.';
            case 'TOOL_EXECUTION_FAILED':
                return 'A tool execution failed. Please verify the tool parameters and try again.';
            case 'MAX_RETRY_EXCEEDED':
                return 'The operation has been retried the maximum number of times. Please review the errors and try a different approach.';
            case 'NO_API_RESPONSE':
                return 'The API did not return a response. Please check your API configuration.';
            case 'NO_TOOLS_USED':
                return 'No tools were used in the response. Please ensure you are using appropriate tools for the task.';
            case 'CONSECUTIVE_MISTAKE_LIMIT':
                return 'Too many consecutive errors have occurred. Please review your approach and try again.';
            case 'TASK_ABORTED':
                return 'The task was aborted. Please review the abort reason and try again if needed.';
            case 'STREAMING_FAILED':
                return 'The streaming operation failed. Please check your connection and try again.';
            default:
                return 'An unexpected error occurred. Please review the error details.';
        }
    }

    /**
     * Format multiple errors into a consolidated prompt
     */
    static formatMultipleErrorsPrompt(errors: TaskError[]): string {
        if (errors.length === 0) {
            return '';
        }

        const errorList = errors
            .map((error, index) => {
                const errorType = this.getErrorTypeLabel(error);
                return `${index + 1}. **${errorType}** (${error.code}): ${error.message}`;
            })
            .join('\n');

        return `⚠️ Multiple Errors Occurred

The following errors were encountered:
${errorList}

Please review these errors and adjust your approach accordingly.`;
    }
}
