/**
 * Custom error types for API client operations
 * Provides structured error handling with specific error codes and recovery suggestions
 */

/**
 * Base error class for all API client errors
 */
export class ApiClientError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode?: number,
        public readonly retryable: boolean = false,
        public readonly recoverySuggestions?: string[]
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            retryable: this.retryable,
            recoverySuggestions: this.recoverySuggestions,
        };
    }
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends ApiClientError {
    constructor(message: string, statusCode?: number) {
        super(
            message,
            'AUTHENTICATION_ERROR',
            statusCode,
            false,
            [
                'Verify your API key is correct',
                'Check if the API key has expired',
                'Ensure the API key has the required permissions',
                'Try regenerating a new API key',
            ]
        );
    }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends ApiClientError {
    constructor(
        message: string,
        public readonly retryAfter?: number,
        statusCode: number = 429
    ) {
        const suggestions = [
            'Wait before making another request',
            'Implement exponential backoff for retries',
            'Consider reducing request frequency',
        ];
        if (retryAfter) {
            suggestions.unshift(`Wait ${retryAfter} seconds before retrying`);
        }

        super(message, 'RATE_LIMIT_ERROR', statusCode, true, suggestions);
    }
}

/**
 * Request timeout errors
 */
export class TimeoutError extends ApiClientError {
    constructor(message: string, public readonly timeoutMs: number) {
        super(
            message,
            'TIMEOUT_ERROR',
            undefined,
            true,
            [
                `Increase the timeout limit (current: ${timeoutMs}ms)`,
                'Check your network connection',
                'Try reducing the complexity of your request',
                'Verify the API service is operational',
            ]
        );
    }
}

/**
 * Network-related errors
 */
export class NetworkError extends ApiClientError {
    private _cause?: Error;

    constructor(message: string, cause?: Error) {
        super(
            message,
            'NETWORK_ERROR',
            undefined,
            true,
            [
                'Check your internet connection',
                'Verify the API endpoint is accessible',
                'Check if a firewall or proxy is blocking the request',
                'Try again later as the network might be temporarily unavailable',
            ]
        );
        this._cause = cause;
    }

    /**
     * Get the underlying cause of the network error
     */
    getCause(): Error | undefined {
        return this._cause;
    }
}

/**
 * Invalid request parameters
 */
export class ValidationError extends ApiClientError {
    constructor(message: string, public readonly field?: string) {
        const suggestions = [
            'Review the request parameters',
            'Check if all required fields are provided',
            'Verify parameter values are within allowed ranges',
        ];
        if (field) {
            suggestions.unshift(`Check the '${field}' parameter`);
        }

        super(message, 'VALIDATION_ERROR', 400, false, suggestions);
    }
}

/**
 * API service unavailable errors
 */
export class ServiceUnavailableError extends ApiClientError {
    constructor(message: string, statusCode: number = 503) {
        super(
            message,
            'SERVICE_UNAVAILABLE',
            statusCode,
            true,
            [
                'The API service is temporarily unavailable',
                'Wait a few minutes and try again',
                'Check the API status page for service disruptions',
                'Consider implementing a retry mechanism with backoff',
            ]
        );
    }
}

/**
 * Quota exceeded errors
 */
export class QuotaExceededError extends ApiClientError {
    constructor(message: string, public readonly quotaType?: string) {
        const suggestions = [
            'Check your API usage quota',
            'Upgrade your plan to increase limits',
            'Wait for your quota to reset',
        ];
        if (quotaType) {
            suggestions.unshift(`Your ${quotaType} quota has been exceeded`);
        }

        super(message, 'QUOTA_EXCEEDED', 429, false, suggestions);
    }
}

/**
 * Content policy violations
 */
export class ContentPolicyError extends ApiClientError {
    constructor(message: string, statusCode: number = 400) {
        super(
            message,
            'CONTENT_POLICY_VIOLATION',
            statusCode,
            false,
            [
                'Review and modify your prompt content',
                'Ensure the content complies with the API usage policies',
                'Remove any potentially sensitive or prohibited content',
            ]
        );
    }
}

/**
 * Response parsing errors
 */
export class ResponseParsingError extends ApiClientError {
    constructor(message: string, public readonly rawResponse?: unknown) {
        super(
            message,
            'RESPONSE_PARSING_ERROR',
            undefined,
            false,
            [
                'The API response format was unexpected',
                'Check if the API version is compatible',
                'Verify the response structure matches expected format',
                'Contact support if the issue persists',
            ]
        );
    }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends ApiClientError {
    constructor(message: string, public readonly configField?: string) {
        const suggestions = [
            'Review your API client configuration',
            'Ensure all required configuration values are provided',
            'Check if configuration values are valid',
        ];
        if (configField) {
            suggestions.unshift(`Check the '${configField}' configuration`);
        }

        super(message, 'CONFIGURATION_ERROR', undefined, false, suggestions);
    }
}

/**
 * Unknown/unexpected errors
 */
export class UnknownApiError extends ApiClientError {
    constructor(message: string, public readonly originalError?: unknown) {
        super(
            message,
            'UNKNOWN_ERROR',
            undefined,
            false,
            [
                'An unexpected error occurred',
                'Check the error details for more information',
                'Try again or contact support if the issue persists',
            ]
        );
    }
}

/**
 * Error type mapping for OpenAI SDK errors
 */
interface OpenAIError {
    status?: number;
    code?: string;
    message: string;
    type?: string;
}

/**
 * Parse an unknown error and return the appropriate ApiClientError
 */
export function parseError(error: unknown, context?: { timeout?: number }): ApiClientError {
    // Handle ApiClientError instances
    if (error instanceof ApiClientError) {
        return error;
    }

    // Handle standard Error instances
    if (error instanceof Error) {
        const message = error.message;
        const cause = (error as { cause?: Error }).cause;

        // Check for timeout errors
        if (message.includes('timed out') || message.includes('timeout')) {
            return new TimeoutError(message, context?.timeout ?? 0);
        }

        // Check for network errors
        if (
            message.includes('ECONNREFUSED') ||
            message.includes('ENOTFOUND') ||
            message.includes('ECONNRESET') ||
            message.includes('ETIMEDOUT') ||
            message.includes('fetch failed') ||
            message.includes('network')
        ) {
            return new NetworkError(message, cause);
        }

        // Check for authentication errors
        if (
            message.includes('401') ||
            message.includes('Unauthorized') ||
            message.includes('invalid api key') ||
            message.includes('authentication')
        ) {
            return new AuthenticationError(message, 401);
        }

        // Check for rate limit errors
        if (
            message.includes('429') ||
            message.includes('rate limit') ||
            message.includes('too many requests')
        ) {
            return new RateLimitError(message);
        }

        // Check for service unavailable
        if (
            message.includes('503') ||
            message.includes('502') ||
            message.includes('service unavailable') ||
            message.includes('bad gateway')
        ) {
            return new ServiceUnavailableError(message);
        }

        // Check for quota errors
        if (
            message.includes('quota') ||
            message.includes('exceeded') ||
            message.includes('limit reached')
        ) {
            return new QuotaExceededError(message);
        }

        // Check for content policy violations
        if (
            message.includes('content policy') ||
            message.includes('safety') ||
            message.includes('moderation')
        ) {
            return new ContentPolicyError(message);
        }

        // Check for validation errors
        if (
            message.includes('400') ||
            message.includes('invalid') ||
            message.includes('validation') ||
            message.includes('required')
        ) {
            return new ValidationError(message);
        }
    }

    // Handle objects with status property (like OpenAI errors)
    if (typeof error === 'object' && error !== null) {
        const err = error as Partial<OpenAIError>;

        if (err.status === 401) {
            return new AuthenticationError(err.message ?? 'Authentication failed', 401);
        }
        if (err.status === 429) {
            return new RateLimitError(err.message ?? 'Rate limit exceeded', undefined, 429);
        }
        if (err.status === 400) {
            if (err.code === 'content_policy') {
                return new ContentPolicyError(err.message ?? 'Content policy violation', 400);
            }
            return new ValidationError(err.message ?? 'Invalid request');
        }
        if (err.status === 503 || err.status === 502) {
            return new ServiceUnavailableError(err.message ?? 'Service unavailable', err.status);
        }
    }

    // Default to unknown error
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new UnknownApiError(message, error);
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof ApiClientError) {
        return error.retryable;
    }
    const parsed = parseError(error);
    return parsed.retryable;
}

/**
 * Get a user-friendly error message with recovery suggestions
 */
export function getErrorMessageWithSuggestions(error: unknown): string {
    const parsed = parseError(error);
    let message = `Error: ${parsed.message}`;

    if (parsed.recoverySuggestions && parsed.recoverySuggestions.length > 0) {
        message += '\n\nSuggestions to resolve:\n';
        message += parsed.recoverySuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
    }

    return message;
}
