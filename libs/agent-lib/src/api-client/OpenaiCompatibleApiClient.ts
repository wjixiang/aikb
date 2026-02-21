import { injectable } from 'inversify';
import OpenAI from 'openai';
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

/**
 * Configuration for OpenAI-compatible API client
 */
export interface OpenAICompatibleConfig {
    /** API key for authentication */
    apiKey: string;
    /** Base URL for the API (e.g., "https://api.openai.com/v1") */
    baseURL?: string;
    /** Model to use (e.g., "gpt-4", "gpt-3.5-turbo") */
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
 * OpenAI-compatible API client implementation
 *
 * Supports OpenAI API and compatible endpoints (e.g., Azure OpenAI, local models)
 * Converts responses to the unified ToolCall[] format
 */
@injectable()
export class OpenaiCompatibleApiClient implements ApiClient {
    private client: OpenAI;
    private config: OpenAICompatibleConfig;
    private requestCount = 0;
    private lastError: ApiClientError | null = null;
    private logger: pino.Logger;

    constructor(config: OpenAICompatibleConfig) {
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
        }).child({ component: 'OpenaiCompatibleApiClient' });

        this.client = new OpenAI({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseURL,
        });
    }

    /**
     * Validate configuration parameters
     */
    private validateConfig(config: OpenAICompatibleConfig): void {
        if (!config.apiKey || config.apiKey.trim() === '') {
            throw new ConfigurationError('API key is required', 'apiKey');
        }
        if (!config.model || config.model.trim() === '') {
            throw new ConfigurationError('Model name is required', 'model');
        }
        if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
            throw new ConfigurationError('Temperature must be between 0 and 2', 'temperature');
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
        const messages = this.buildMessages(systemPrompt, workspaceContext, memoryContext);

        this.logger.info(
            {
                requestId,
                model: this.config.model,
                timeout,
                messageCount: messages.length,
                hasTools: !!tools && tools.length > 0,
                toolCount: tools?.length ?? 0,
            },
            'Starting request'
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

                const response = await this.makeRequestInternal(requestId, messages, tools, timeout, originalInputs);

                this.logger.info(
                    {
                        requestId,
                        attempt: attempt + 1,
                        requestTime: response.requestTime,
                        tokenUsage: response.tokenUsage,
                    },
                    'Request completed successfully'
                );

                this.lastError = null;
                return response;
            } catch (error) {
                const apiError = parseError(error, { timeout });
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
        messages: OpenAI.Chat.ChatCompletionMessageParam[],
        tools: ChatCompletionTool[] | undefined,
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

        // Clear timeout on promise settlement
        if (timeoutId !== undefined) {
            timeoutPromise.finally?.(() => clearTimeout(timeoutId));
        }

        try {
            // Start timing
            const startTime = Date.now();

            // Make API request with timeout
            const completion = await Promise.race([
                this.client.chat.completions.create({
                    model: this.config.model,
                    messages,
                    tools,
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                }),
                timeoutPromise,
            ]);

            // Calculate request time
            const requestTime = Date.now() - startTime;

            // Validate response structure
            if (!completion) {
                throw new ResponseParsingError('Received empty response from API');
            }

            const response = this.convertOpenAIResponse(completion, requestTime);

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
            throw parseError(error, { timeout });
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
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[]
    ): OpenAI.Chat.ChatCompletionMessageParam[] {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: systemPrompt,
            },
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
     * Convert OpenAI completion response to unified ApiResponse format
     */
    private convertOpenAIResponse(completion: OpenAI.Chat.ChatCompletion, requestTime: number): ApiResponse {
        try {
            // Validate completion structure
            if (!completion.choices || completion.choices.length === 0) {
                throw new ResponseParsingError('No completion choices returned from API', completion);
            }

            const choice = completion.choices[0];
            if (!choice) {
                throw new ResponseParsingError('First completion choice is undefined', completion);
            }

            const message = choice.message;
            if (!message) {
                throw new ResponseParsingError('Completion message is undefined', choice);
            }

            const toolCalls: ToolCall[] = [];
            let textResponse = '';

            // Handle tool calls if present
            if (message.tool_calls && message.tool_calls.length > 0) {
                for (const toolCall of message.tool_calls) {
                    // Validate tool call structure
                    if (!toolCall.id) {
                        this.logger.warn({ toolCall }, 'Tool call missing ID, skipping');
                        continue;
                    }

                    if (toolCall.type === 'function') {
                        if (!toolCall.function?.name) {
                            this.logger.warn({ toolCall }, 'Function call missing name, skipping');
                            continue;
                        }

                        // Validate function arguments
                        let args = toolCall.function.arguments;
                        if (args) {
                            try {
                                // Validate JSON format
                                JSON.parse(args);
                            } catch (e) {
                                throw new ResponseParsingError(
                                    `Invalid JSON in function arguments for ${toolCall.function.name}`,
                                    { toolCall, parseError: e }
                                );
                            }
                        }

                        toolCalls.push({
                            id: toolCall.id,
                            call_id: toolCall.id,
                            type: 'function_call',
                            name: toolCall.function.name,
                            arguments: args ?? '{}',
                        });
                    }
                }
            }

            // Capture text response if present
            if (message.content) {
                textResponse = message.content;
            }

            // Validate and extract token usage
            const usage = completion.usage;
            if (!usage) {
                this.logger.warn('Token usage not provided in response');
            }

            const tokenUsage: TokenUsage = {
                promptTokens: usage?.prompt_tokens ?? 0,
                completionTokens: usage?.completion_tokens ?? 0,
                totalTokens: usage?.total_tokens ?? 0,
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
                error instanceof Error ? { originalError: error.message, completion } : completion
            );
        }
    }
}