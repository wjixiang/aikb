import { b } from '../baml_client/index.js';
import { ApiClient, ApiTimeoutConfig, ApiResponse } from './ApiClient.interface.js';

/**
 * BAML-based implementation of the ApiClient interface
 * 
 * This class wraps the BAML client to provide API requests through the
 * ApiClient interface. It uses Promise.race to implement timeout functionality
 * since BAML's client doesn't natively support timeout configuration.
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
     * @returns Promise resolving to the API response
     * @throws Error if the request fails or times out
     */
    async makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): Promise<ApiResponse> {
        const timeout = timeoutConfig?.timeout ?? BamlApiClient.DEFAULT_TIMEOUT;

        // Create a timeout promise that rejects after the specified time
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`API request timed out after ${timeout}ms`));
            }, timeout);
        });

        try {
            // Race between BAML request and timeout
            const bamlResponse = await Promise.race([
                b.ApiRequest(systemPrompt, workspaceContext, memoryContext),
                timeoutPromise,
            ]);

            return bamlResponse;
        } catch (error) {
            // Re-throw with additional context
            console.error('BAML API request failed:', error);
            throw error;
        }
    }
}
