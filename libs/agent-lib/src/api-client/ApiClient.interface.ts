import OpenAI from 'openai';

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
 * Function parameters schema following JSON Schema format
 * Used to define the structure of parameters for function calling
 */
export interface FunctionParameters {
    /** JSON Schema type (e.g., "object", "string", "number") */
    type?: string;
    /** Property definitions for object types */
    properties?: Record<string, FunctionParameters>;
    /** Required property names */
    required?: string[] | readonly string[];
    /** Description of the parameter */
    description?: string;
    /** Enum values for the parameter */
    enum?: unknown[] | readonly unknown[];
    /** Array item schema */
    items?: FunctionParameters;
    /** Additional JSON Schema properties */
    [key: string]: unknown;
}

/**
 * Function definition for OpenAI-compatible function calling
 */
export interface FunctionDefinition {
    /** The name of the function to be called */
    name: string;
    /** A description of what the function does */
    description?: string;
    /** The parameters the function accepts, described as a JSON Schema object */
    parameters?: FunctionParameters;
    /** Whether to enable strict schema adherence when generating the function call */
    strict?: boolean | null;
}

/**
 * Function tool definition for OpenAI-compatible API
 */
export interface ChatCompletionFunctionTool {
    /** Function definition */
    function: FunctionDefinition;
    /** The type of the tool, always "function" */
    type: 'function';
}

/**
 * Custom tool definition for OpenAI-compatible API
 * Used for custom tools beyond standard function calling
 */
export interface ChatCompletionCustomTool {
    /** Properties of the custom tool */
    custom: {
        /** The name of the custom tool */
        name: string;
        /** Optional description of the custom tool */
        description?: string;
        /** Additional custom tool properties */
        [key: string]: unknown;
    };
    /** The type of the custom tool, always "custom" */
    type: 'custom';
}

/**
 * Union type for all supported tool types
 * Includes both function tools and custom tools
 */
export type ChatCompletionTool = ChatCompletionFunctionTool | ChatCompletionCustomTool;

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
     * @param tools - Optional array of tool definitions in OpenAI ChatCompletionTool format
     * @returns Promise resolving to the API response (array of tool calls)
     * @throws Error if the request fails or times out
     */
    makeRequest(
        systemPrompt: string,
        workspaceContext: string,
        memoryContext: string[],
        timeoutConfig?: ApiTimeoutConfig,
        tools?: ChatCompletionTool[]
    ): Promise<ApiResponse>;
}
