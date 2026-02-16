/**
 * Unified ToolCall interface compatible with OpenAI format
 * Supports both single and multiple tool calls in one response
 */
export interface ToolCall {
    /** Unique identifier for this tool call (e.g., "fc_12345xyz") */
    id: string;
    /** Alternative call ID field for compatibility (e.g., "call_12345xyz") */
    call_id: string;
    /** Type of the call, always "function_call" */
    type: "function_call";
    /** Name of the function/tool to call */
    name: string;
    /** JSON string containing the function arguments */
    arguments: string;
}

/**
 * Token usage information for API requests
 */
export interface TokenUsage {
    /** Number of tokens used in the prompt */
    promptTokens: number;
    /** Number of tokens used in the completion */
    completionTokens: number;
    /** Total number of tokens used */
    totalTokens: number;
}

/**
 * Response type from API client
 * Returns tool calls, text response, and metadata from the LLM
 */
export interface ApiResponse {
    /** Array of tool calls requested by the LLM */
    toolCalls: ToolCall[];
    /** Text response from the LLM */
    textResponse: string;
    /** Time taken for the request in milliseconds */
    requestTime: number;
    /** Token usage information */
    tokenUsage: TokenUsage;
}

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
     * @param tools - Optional array of tool definitions in OpenAI format
     * @returns Promise resolving to the API response (array of tool calls)
     * @throws Error if the request fails or times out
     */
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: any[]
    ): Promise<ApiResponse>;
}
