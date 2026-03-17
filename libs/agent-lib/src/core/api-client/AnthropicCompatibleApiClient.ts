import { injectable } from 'inversify';
import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import { ApiClient, ApiResponse, ApiTimeoutConfig, ToolCall, TokenUsage, ChatCompletionTool } from './ApiClient.interface.js';
import {
    ApiClientError,
    AuthenticationError,
    RateLimitError,
    TimeoutError,
    NetworkError,
    ValidationError,
    ServiceUnavailableError,
    QuotaExceededError,
    ContentPolicyError,
    ResponseParsingError,
    ConfigurationError,
    UnknownApiError,
    parseError,
    isRetryableError,
} from './errors.js';
import chalk from 'chalk';

/**
 * Configuration for Anthropic-compatible API client
 */
export interface AnthropicCompatibleConfig {
    /** API key for authentication */
    apiKey: string;
    /** Base URL for the API (e.g., "https://api.anthropic.com") */
    baseURL?: string;
    /** Model to use (e.g., "claude-3-5-sonnet-20241022", "claude-3-opus-20240229") */
    model: string;
    /** Optional temperature setting */
    temperature?: number;
    /** Optional max tokens */
    maxTokens?: number;
    /** Maximum number of retry attempts for retryable errors */
    maxRetries?: number;
    /** Initial delay in ms for exponential backoff */
    retryDelay?: number;
    /** Enable/disable request logging */
    enableLogging?: boolean;
    /** Optional custom pino logger instance */
    logger?: pino.Logger;
}

/**
 * Anthropic-compatible API client implementation
 *
 * Supports Anthropic API and compatible endpoints (e.g., Bedrock, Vertex AI)
 * Converts responses to the unified ToolCall[] format
 */
@injectable()
export class AnthropicCompatibleApiClient implements ApiClient {
    private client: Anthropic;
    private config: AnthropicCompatibleConfig;
    private requestCount = 0;
    private lastError: ApiClientError | null = null;
    private logger: pino.Logger;

    constructor(config: AnthropicCompatibleConfig) {
        this.validateConfig(config);
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            enableLogging: true,
            ...config,
        };

        // Initialize pino logger
        this.logger = config.logger ?? pino({
            level: this.config.enableLogging ? 'info' : 'silent',
            formatters: {
                level: (label) => {
                    return { level: label };
                },
            },
            timestamp: pino.stdTimeFunctions.isoTime,
        }).child({ component: 'AnthropicCompatibleApiClient' });

        this.client = new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseURL,
        });
    }

    /**
     * Validate configuration parameters
     */
    private validateConfig(config: AnthropicCompatibleConfig): void {
        if (!config.apiKey || config.apiKey.trim() === '') {
            throw new ConfigurationError('API key is required', 'apiKey');
        }
        if (!config.model || config.model.trim() === '') {
            throw new ConfigurationError('Model name is required', 'model');
        }
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
            throw new ConfigurationError('Temperature must be between 0 and 1', 'temperature');
        }
        if (config.maxTokens !== undefined && config.maxTokens < 1) {
            throw new ConfigurationError('Max tokens must be greater than 0', 'maxTokens');
        }
    }


    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: ChatCompletionTool[]
    ): Promise<ApiResponse> {
        this.requestCount++;
        const requestId = `req-${this.requestCount}-${Date.now()}`;
        const timeout = timeoutConfig?.timeout ?? 40000;

        // Validate input parameters
        this.validateRequestInputs(systemPrompt, workspaceContext, memoryContext, tools);

        // Build messages array
        const messages = this.buildMessages(workspaceContext, memoryContext);

        // Convert tools to Anthropic format
        const anthropicTools = this.convertToolsToAnthropicFormat(tools);

        this.logger.info(
            {
                requestId,
                model: this.config.model,
                timeout,
                messageCount: messages.length,
                hasTools: !!tools && tools.length > 0,
                toolCount: tools?.length ?? 0,
            },
            'Starting Anthropic request'
        );

        // Store original inputs for error logging
        const originalInputs = { systemPrompt, memoryContext, workspaceContext };

        // Attempt request with retry logic
        let lastError: ApiClientError | null = null;
        const maxRetries = this.config.maxRetries ?? 3;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    const delay = this.calculateRetryDelay(attempt);
                    this.logger.info(
                        { requestId, attempt, maxRetries, delay },
                        `Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`
                    );
                    await this.sleep(delay);
                }

                const response = await this.makeRequestInternal(
                    requestId,
                    systemPrompt,
                    messages,
                    anthropicTools,
                    timeout,
                    originalInputs
                );

                console.debug(chalk.bgBlueBright("workspaceContext\n", workspaceContext));
                this.logger.info({
                    response: response
                }, "Get response successfully");

                this.lastError = null;
                return response;
            } catch (error) {
                const apiError = this.parseAnthropicError(error, { timeout });
                lastError = apiError;
                this.lastError = apiError;

                this.logger.error(
                    {
                        requestId,
                        attempt: attempt + 1,
                        error: apiError.toJSON(),
                        isRetryable: apiError.retryable,
                        remainingAttempts: maxRetries - attempt,
                    },
                    'Request failed on attempt'
                );

                // Don't retry if error is not retryable or we've exhausted retries
                if (!apiError.retryable || attempt >= maxRetries) {
                    break;
                }

                // Special handling for rate limit errors with retry-after header
                if (apiError instanceof RateLimitError && apiError.retryAfter) {
                    this.logger.warn(
                        { requestId, retryAfter: apiError.retryAfter },
                        'Rate limit detected, waiting before retry'
                    );
                    await this.sleep(apiError.retryAfter * 1000);
                }
            }
        }

        // All retries exhausted or non-retryable error
        this.logger.error(
            {
                requestId,
                attempts: maxRetries + 1,
                finalError: lastError?.toJSON(),
            },
            'Request failed after all retry attempts'
        );

        throw lastError ?? new UnknownApiError('Request failed with unknown error');
    }

    /**
     * Internal method to make the actual API request with timeout
     */
    private async makeRequestInternal(
        requestId: string,
        systemPrompt: string,
        messages: Anthropic.MessageParam[],
        tools: Anthropic.Tool[] | undefined,
        timeout: number,
        originalInputs: { systemPrompt: string; memoryContext: string[]; workspaceContext: string }
    ): Promise<ApiResponse> {
        // Create timeout promise
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new TimeoutError(`API request timed out after ${timeout}ms`, timeout));
            }, timeout);
        });

        try {
            // Start timing
            const startTime = Date.now();

            // Build request parameters
            const requestParams: Anthropic.MessageCreateParams = {
                model: this.config.model,
                max_tokens: this.config.maxTokens ?? 4096,
                messages,
                system: systemPrompt,
                temperature: this.config.temperature,
                tools,
            };

            // Make API request with timeout
            const message = await Promise.race([
                this.client.messages.create(requestParams),
                timeoutPromise,
            ]);

            // Calculate request time
            const requestTime = Date.now() - startTime;

            // Validate response structure
            if (!message) {
                throw new ResponseParsingError('Received empty response from API');
            }

            const response = this.convertAnthropicResponse(message, requestTime);

            // Log request details for debugging
            this.logger.debug(
                {
                    requestId,
                    systemPrompt: originalInputs.systemPrompt.substring(0, 200) + (originalInputs.systemPrompt.length > 200 ? '...' : ''),
                    memoryContextCount: originalInputs.memoryContext.length,
                    workspaceContextLength: originalInputs.workspaceContext.length,
                    response,
                },
                'Request details'
            );

            return response;
        } catch (error) {
            // Re-throw ApiClientError as-is
            if (error instanceof ApiClientError) {
                throw error;
            }

            // Parse and throw as appropriate error type
            throw this.parseAnthropicError(error, { timeout });
        } finally {
            // Always clear the timeout to prevent unhandled rejections
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }

    /**
     * Validate request input parameters
     */
    private validateRequestInputs(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        tools?: ChatCompletionTool[]
    ): void {
        if (typeof systemPrompt !== 'string') {
            throw new ValidationError('System prompt must be a string', 'systemPrompt');
        }
        if (typeof workspaceContext !== 'string') {
            throw new ValidationError('Workspace context must be a string', 'workspaceContext');
        }
        if (!Array.isArray(memoryContext)) {
            throw new ValidationError('Memory context must be an array', 'memoryContext');
        }

        // Validate tools if provided
        if (tools) {
            if (!Array.isArray(tools)) {
                throw new ValidationError('Tools must be an array', 'tools');
            }
            for (let i = 0; i < tools.length; i++) {
                const tool = tools[i];
                if (!tool.type || (tool.type !== 'function' && tool.type !== 'custom')) {
                    throw new ValidationError(`Tool at index ${i} has invalid type`, `tools[${i}].type`);
                }
                if (tool.type === 'function') {
                    if (!tool.function?.name) {
                        throw new ValidationError(`Tool at index ${i} is missing function name`, `tools[${i}].function.name`);
                    }
                }
            }
        }
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay(attempt: number): number {
        const baseDelay = this.config.retryDelay ?? 1000;
        // Exponential backoff: baseDelay * 2^(attempt-1) with jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
        return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get the last error that occurred
     */
    public getLastError(): ApiClientError | null {
        return this.lastError;
    }

    /**
     * Get statistics about the client
     */
    public getStats(): { requestCount: number; lastError: ApiClientError | null } {
        return {
            requestCount: this.requestCount,
            lastError: this.lastError,
        };
    }

    /**
     * Build messages array from prompt components
     */
    private buildMessages(
        workspaceContext: string,
        memoryContext: string[]
    ): Anthropic.MessageParam[] {
        const messages: Anthropic.MessageParam[] = [
            {
                role: 'user',
                content: `--- WORKSPACE CONTEXT ---\n${workspaceContext}\n--- END WORKSPACE CONTEXT ---`,
            },
        ];

        // Add conversation history
        for (const historyItem of memoryContext) {
            messages.push({
                role: 'user',
                content: historyItem,
            });
        }

        return messages;
    }

    /**
     * Convert OpenAI-compatible tools to Anthropic tool format
     */
    private convertToolsToAnthropicFormat(tools?: ChatCompletionTool[]): Anthropic.Tool[] | undefined {
        if (!tools || tools.length === 0) {
            return undefined;
        }

        return tools
            .filter((tool): tool is ChatCompletionTool & { type: 'function' } => tool.type === 'function')
            .map((tool) => ({
                name: tool.function.name,
                description: tool.function.description ?? '',
                input_schema: tool.function.parameters as Anthropic.Tool.InputSchema,
            }));
    }

    /**
     * Convert Anthropic message response to unified ApiResponse format
     */
    private convertAnthropicResponse(message: Anthropic.Message, requestTime: number): ApiResponse {
        try {
            // Validate message structure
            if (!message.content || message.content.length === 0) {
                throw new ResponseParsingError('No content returned from API', message);
            }

            const toolCalls: ToolCall[] = [];
            let textResponse = '';

            // Process content blocks
            for (const block of message.content) {
                if (block.type === 'text') {
                    textResponse += block.text;
                } else if (block.type === 'tool_use') {
                    const toolUseBlock = block as Anthropic.ToolUseBlock;

                    // Validate tool call structure
                    if (!toolUseBlock.id) {
                        this.logger.warn({ toolUseBlock }, 'Tool call missing ID, skipping');
                        continue;
                    }

                    if (!toolUseBlock.name) {
                        this.logger.warn({ toolUseBlock }, 'Function call missing name, skipping');
                        continue;
                    }

                    // Convert arguments to JSON string
                    let args: string;
                    try {
                        args = JSON.stringify(toolUseBlock.input);
                    } catch (e) {
                        throw new ResponseParsingError(
                            `Failed to serialize function arguments for ${toolUseBlock.name}`,
                            { toolUseBlock, serializeError: e }
                        );
                    }

                    toolCalls.push({
                        id: toolUseBlock.id,
                        call_id: toolUseBlock.id,
                        type: 'function_call',
                        name: toolUseBlock.name,
                        arguments: args,
                    });
                }
            }

            // Extract token usage
            const tokenUsage: TokenUsage = {
                promptTokens: message.usage?.input_tokens ?? 0,
                completionTokens: message.usage?.output_tokens ?? 0,
                totalTokens: (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
            };

            // Validate token counts are non-negative
            if (tokenUsage.promptTokens < 0 || tokenUsage.completionTokens < 0 || tokenUsage.totalTokens < 0) {
                throw new ResponseParsingError('Token counts cannot be negative', tokenUsage);
            }

            return {
                toolCalls,
                textResponse,
                requestTime,
                tokenUsage,
            };
        } catch (error) {
            // Re-throw ApiClientError as-is
            if (error instanceof ApiClientError) {
                throw error;
            }

            // Wrap parsing errors
            throw new ResponseParsingError(
                `Failed to parse API response: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error instanceof Error ? { originalError: error.message, message } : message
            );
        }
    }

    /**
     * Parse Anthropic-specific errors
     */
    private parseAnthropicError(error: unknown, context?: { timeout?: number }): ApiClientError {
        // Handle ApiClientError instances
        if (error instanceof ApiClientError) {
            return error;
        }

        // Handle Anthropic API errors
        if (error instanceof Anthropic.APIError) {
            const statusCode = error.status ?? undefined;
            const errorCode = error.error?.type ?? 'unknown_error';

            // Authentication errors
            if (statusCode === 401 || errorCode === 'authentication_error') {
                return new AuthenticationError(
                    error.message || 'Authentication failed',
                    statusCode
                );
            }

            // Rate limit errors
            if (statusCode === 429 || errorCode === 'rate_limit_error') {
                // Try to extract retry-after from headers
                const retryAfter = this.extractRetryAfter(error.headers);
                return new RateLimitError(
                    error.message || 'Rate limit exceeded',
                    retryAfter,
                    statusCode
                );
            }

            // Service unavailable
            if (statusCode === 503 || statusCode === 502 || errorCode === 'service_unavailable') {
                return new ServiceUnavailableError(
                    error.message || 'Service unavailable',
                    statusCode
                );
            }

            // Content policy / safety violations
            if (errorCode === 'content_policy_violation' || errorCode === 'safety_error') {
                return new ContentPolicyError(
                    error.message || 'Content policy violation',
                    statusCode
                );
            }

            // Invalid request / validation errors
            if (statusCode === 400 || errorCode === 'invalid_request_error') {
                return new ValidationError(error.message || 'Invalid request');
            }

            // Quota exceeded
            if (errorCode === 'quota_exceeded') {
                return new QuotaExceededError(error.message || 'Quota exceeded');
            }

            // Default to unknown error with status info
            return new UnknownApiError(
                error.message || `API error: ${errorCode}`,
                { statusCode, errorCode, originalError: error }
            );
        }

        // Handle standard Error instances
        if (error instanceof Error) {
            const message = error.message;

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
                return new NetworkError(message, error);
            }
        }

        // Fall back to generic error parsing
        return parseError(error, context);
    }

    /**
     * Extract retry-after value from response headers
     */
    private extractRetryAfter(headers: Headers | undefined): number | undefined {
        if (!headers) return undefined;

        const retryAfter = headers.get('retry-after');
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
                return seconds;
            }
        }

        return undefined;
    }
}
