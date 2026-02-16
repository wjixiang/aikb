import { b } from '../baml_client/index.js';
import { ApiClient, ApiTimeoutConfig, ApiResponse, ToolCall, TokenUsage } from './ApiClient.interface.js';

/**
 * Legacy BAML response format (for backward compatibility)
 */
interface LegacyBamlResponse {
    toolName: string;
    toolParams: string;
}

/**
 * BAML-based implementation of the ApiClient interface
 *
 * This class wraps the BAML client to provide API requests through the
 * ApiClient interface. It uses Promise.race to implement timeout functionality
 * since BAML's client doesn't natively support timeout configuration.
 *
 * Supports both legacy single tool call format and new multiple tool calls format.
 *
 * @example
 * ```ts
 * const client = new BamlApiClient();
 * const response = await client.makeRequest(
 *   systemPrompt,
 *   workspaceContext,
 *   memoryContext,
 *   { timeout: 40000 }
 * );
 * ```
 */
export class BamlApiClient implements ApiClient {
    /**
     * Default timeout in milliseconds if not specified
     */
    private static readonly DEFAULT_TIMEOUT = 40000;

    /**
     * Make an API request using BAML client
     *
     * @param systemPrompt - The system prompt defining agent behavior
     * @param workspaceContext - Current workspace state and information
     * @param memoryContext - Conversation history formatted as XML strings
     * @param timeoutConfig - Optional timeout configuration
     * @param tools - Optional tool definitions (BAML may handle tools differently)
     * @returns Promise resolving to the API response (array of tool calls)
     * @throws Error if the request fails or times out
     */
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]
    ): Promise<ApiResponse> {
        console.log('[BamlApiClient.makeRequest] Starting BAML API request');
        console.log('[BamlApiClient.makeRequest] System prompt length:', systemPrompt.length);
        console.log('[BamlApiClient.makeRequest] Workspace context length:', workspaceContext.length);
        console.log('[BamlApiClient.makeRequest] Memory context items:', memoryContext.length);
        console.log('[BamlApiClient.makeRequest] Tools provided:', tools?.length || 0);

        const timeout = timeoutConfig?.timeout ?? BamlApiClient.DEFAULT_TIMEOUT;
        console.log('[BamlApiClient.makeRequest] Timeout:', timeout, 'ms');

        // Create a timeout promise that rejects after the specified time
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeout}ms`));
            }, timeout);
        });

        try {
            // Start timing
            const startTime = Date.now();
            console.log('[BamlApiClient.makeRequest] Calling b.ApiRequest...');

            // Race between BAML request and timeout
            const bamlResponse = await Promise.race([
                b.ApiRequest(systemPrompt, workspaceContext, memoryContext),
                timeoutPromise,
            ]);

            console.log('[BamlApiClient.makeRequest] BAML response received');

            // Calculate request time
            const requestTime = Date.now() - startTime;
            console.log('[BamlApiClient.makeRequest] Request time:', requestTime, 'ms');

            // Convert BAML response to unified format
            console.log('[BamlApiClient.makeRequest] Converting BAML response...');
            const result = this.convertBamlResponse(bamlResponse, requestTime);
            console.log('[BamlApiClient.makeRequest] Conversion complete, tool calls:', result.toolCalls.length);
            return result;
        } catch (error) {
            // Re-throw with additional context
            console.error('[BamlApiClient.makeRequest] BAML API request failed:', error);
            throw error;
        }
    }

    /**
     * Convert BAML response to unified ApiResponse format
     * Handles both legacy single response and new array format
     */
    private convertBamlResponse(bamlResponse: any, requestTime: number): ApiResponse {
        let toolCalls: ToolCall[];

        // If already in correct format (array of ToolCall)
        if (Array.isArray(bamlResponse)) {
            toolCalls = bamlResponse.map((item, index) => this.normalizeToolCall(item, index));
        }
        // Legacy format: single object with toolName/toolParams
        else if (this.isLegacyFormat(bamlResponse)) {
            toolCalls = [this.convertLegacyToolCall(bamlResponse as LegacyBamlResponse)];
        }
        // Unknown format
        else {
            console.warn('Unknown BAML response format:', bamlResponse);
            throw new Error('Invalid BAML response format');
        }

        // BAML doesn't provide token usage, so we use zeros
        const tokenUsage: TokenUsage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
        };

        return {
            toolCalls,
            textResponse: '', // BAML doesn't provide text response
            requestTime,
            tokenUsage,
        };
    }

    /**
     * Check if response is in legacy format
     */
    private isLegacyFormat(response: any): boolean {
        return response &&
            typeof response === 'object' &&
            'toolName' in response &&
            'toolParams' in response;
    }

    /**
     * Convert legacy BAML response to new ToolCall format
     */
    private convertLegacyToolCall(legacy: LegacyBamlResponse): ToolCall {
        const id = `fc_${this.generateId()}`;
        return {
            id,
            call_id: `call_${this.generateId()}`,
            type: 'function_call',
            name: legacy.toolName,
            arguments: legacy.toolParams,
        };
    }

    /**
     * Normalize a tool call to ensure it has all required fields
     */
    private normalizeToolCall(toolCall: any, index: number): ToolCall {
        // If already in correct format
        if (this.isValidToolCall(toolCall)) {
            return toolCall;
        }

        // If in legacy format
        if (this.isLegacyFormat(toolCall)) {
            return this.convertLegacyToolCall(toolCall);
        }

        // Partial format - fill in missing fields
        const id = toolCall.id || `fc_${this.generateId()}_${index}`;
        return {
            id,
            call_id: toolCall.call_id || `call_${this.generateId()}_${index}`,
            type: 'function_call',
            name: toolCall.name || toolCall.toolName || 'unknown',
            arguments: toolCall.arguments || toolCall.toolParams || '{}',
        };
    }

    /**
     * Check if object is a valid ToolCall
     */
    private isValidToolCall(obj: any): obj is ToolCall {
        return obj &&
            typeof obj === 'object' &&
            typeof obj.id === 'string' &&
            typeof obj.call_id === 'string' &&
            obj.type === 'function_call' &&
            typeof obj.name === 'string' &&
            typeof obj.arguments === 'string';
    }

    /**
     * Generate a random ID for tool calls
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}
