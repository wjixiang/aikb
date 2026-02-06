export interface AttemptCompletion {
    toolName: "attempt_completion"
    toolParams: string

}

export interface ToolCall {
    toolName: string
    toolParams: string

}

/**
 * Response type from API client
 * Union of AttemptCompletion and ToolCall from BAML
 */
export type ApiResponse = AttemptCompletion | ToolCall;

/**
 * Configuration for API request timeout
 */
export interface ApiTimeoutConfig {
    /** Timeout in milliseconds for API requests */
    timeout: number;
}

/**
 * Interface for API client abstraction
 * 
 * This interface defines the contract for making API requests to LLM providers.
 * Implementations can use different protocols (BAML, direct API calls, etc.)
 * while maintaining a consistent interface for the Agent class.
 * 
 * The Agent class depends on this interface rather than concrete implementations,
 * enabling dependency injection and testability.
 */
export interface ApiClient {
    /**
     * Make an API request with the provided prompt components
     * 
     * @param systemPrompt - The system prompt defining agent behavior
     * @param workspaceContext - Current workspace state and information
     * @param memoryContext - Conversation history formatted as XML strings
     * @param timeoutConfig - Optional timeout configuration
     * @returns Promise resolving to the API response (tool call or completion)
     * @throws Error if the request fails or times out
     */
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig
    ): Promise<ApiResponse>;
}
