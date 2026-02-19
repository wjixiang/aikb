import OpenAI from 'openai';
import { ApiClient, ApiResponse, ApiTimeoutConfig, ToolCall, TokenUsage, ChatCompletionTool } from './ApiClient.interface';

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
}

/**
 * OpenAI-compatible API client implementation
 *
 * Supports OpenAI API and compatible endpoints (e.g., Azure OpenAI, local models)
 * Converts responses to the unified ToolCall[] format
 */
export class OpenaiCompatibleApiClient implements ApiClient {
    private client: OpenAI;
    private config: OpenAICompatibleConfig;

    constructor(config: OpenAICompatibleConfig) {
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
    }

    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: ChatCompletionTool[]
    ): Promise<ApiResponse> {
        const timeout = timeoutConfig?.timeout ?? 40000;

        // Build messages array
        const messages = this.buildMessages(systemPrompt, workspaceContext, memoryContext);

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeout}ms`));
            }, timeout);
        });

        try {
            // Start timing
            const startTime = Date.now();

            // Make API request with timeout
            const completion = await Promise.race([
                this.client.chat.completions.create({
                    model: this.config.model,
                    messages,
                    tools,  // Pass tools if provided
                    temperature: this.config.temperature,
                    max_tokens: this.config.maxTokens,
                }),
                timeoutPromise,
            ]);

            // Calculate request time
            const requestTime = Date.now() - startTime;
            const resposne = this.convertOpenAIResponse(completion, requestTime);
            console.log(`systemPrompt:${systemPrompt}\n\n\n`)
            console.log(`memoryContext:${memoryContext} \n\n\n`)
            console.log(`workspaceContext:${workspaceContext}\n\n\n`)
            console.log(resposne)

            // Convert OpenAI response to unified format
            return resposne
        } catch (error) {
            console.error('OpenAI-compatible API request failed:', error);
            throw error;
        }
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
        const choice = completion.choices[0];
        if (!choice) {
            throw new Error('No completion choice returned from API');
        }

        const message = choice.message;
        const toolCalls: ToolCall[] = [];
        let textResponse = '';

        // Handle tool calls if present
        if (message.tool_calls && message.tool_calls.length > 0) {
            for (const toolCall of message.tool_calls) {
                if (toolCall.type === 'function') {
                    toolCalls.push({
                        id: toolCall.id,
                        call_id: toolCall.id, // OpenAI uses same ID
                        type: 'function_call',
                        name: toolCall.function.name,
                        arguments: toolCall.function.arguments,
                    });
                }
            }
        }

        // Capture text response if present
        if (message.content) {
            textResponse = message.content;
        }

        // Extract token usage
        const tokenUsage: TokenUsage = {
            promptTokens: completion.usage?.prompt_tokens ?? 0,
            completionTokens: completion.usage?.completion_tokens ?? 0,
            totalTokens: completion.usage?.total_tokens ?? 0,
        };

        return {
            toolCalls,
            textResponse,
            requestTime,
            tokenUsage,
        };
    }
}