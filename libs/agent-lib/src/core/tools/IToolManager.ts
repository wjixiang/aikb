import type { Tool } from '../statefulContext/index.js';
import type { ToolSource } from './IToolProvider.js';
import type { IToolProvider } from './IToolProvider.js';

/**
 * Extended tool registration with source tracking and state management
 */
export interface ToolRegistration {
    /** The tool definition */
    tool: Tool;
    /** Where this tool comes from */
    source: ToolSource;
    /** Provider ID that registered this tool */
    providerId: string;
    /** Component key (for component tools) */
    componentKey?: string;
    /** Whether the tool is currently enabled/available (for backward compatibility) */
    enabled: boolean;
    /** Optional handler function for executing the tool */
    handler?: (params: any) => Promise<any>;
}

/**
 * Tool source information for lookup
 */
export interface ToolSourceInfo {
    source: ToolSource;
    providerId: string;
    componentKey?: string;
}

/**
 * Callback type for tool availability changes
 */
export type ToolAvailabilityCallback = (tools: Tool[]) => void;

/**
 * Unsubscribe function type
 */
export type UnsubscribeFn = () => void;

/**
 * Central tool management interface
 *
 * Simplified version after removing skill system.
 * All registered tools are now available by default.
 *
 * The ToolManager is responsible for:
 * - Registering/unregistering tool providers
 * - Maintaining a registry of all tools
 * - Determining tool enabled/disabled state
 * - Executing tool calls
 * - Notifying subscribers of tool availability changes
 */
export interface IToolManager {
    /**
     * Register a tool provider
     * @param provider - The provider to register
     */
    registerProvider(provider: IToolProvider): void;

    /**
     * Unregister a tool provider by ID
     * @param providerId - The provider ID to unregister
     * @returns true if provider was found and unregistered
     */
    unregisterProvider(providerId: string): boolean;

    /**
     * Get all registered tools (including disabled)
     * @returns Array of tool registrations
     */
    getAllTools(): ToolRegistration[];

    /**
     * Get available (enabled) tools based on current skill state
     * @returns Array of enabled tool definitions
     */
    getAvailableTools(): Tool[];

    /**
     * Execute a tool call
     * @param name - The tool name to execute
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to the tool result
     * @throws {ToolNotFoundError} When the tool is not found
     * @throws {ToolDisabledError} When the tool is disabled
     * @throws {ProviderNotFoundError} When the provider is not found
     * @throws {ToolExecutionError} When tool execution fails
     * @throws {ToolParameterError} When tool parameters are invalid
     * @throws {ToolTimeoutError} When tool execution times out
     */
    executeTool(name: string, params: any): Promise<any>;

    /**
     * Enable a tool (for backward compatibility)
     * @param name - The tool name to enable
     * @returns true if tool was found
     */
    enableTool(name: string): boolean;

    /**
     * Disable a tool (for backward compatibility)
     * @param name - The tool name to disable
     * @returns true if tool was found
     */
    disableTool(name: string): boolean;

    /**
     * Check if a tool is enabled based on current skill state
     * @param name - The tool name to check
     * @returns true if tool exists and is enabled
     */
    isToolEnabled(name: string): boolean;

    /**
     * Get tool source information
     * @param name - The tool name to look up
     * @returns Tool source info or null if not found
     */
    getToolSource(name: string): ToolSourceInfo | null;

    /**
     * Subscribe to tool availability changes
     * @param callback - Function to call when tools change
     * @returns Unsubscribe function
     */
    onAvailabilityChange(callback: ToolAvailabilityCallback): UnsubscribeFn;

    /**
     * Notify all subscribers of tool availability change
     * Called internally when tools are added/removed/enabled/disabled
     */
    notifyAvailabilityChange(): void;

    /**
     * Get a provider by ID (for testing/debugging)
     */
    getProvider(providerId: string): IToolProvider | undefined;

    /**
     * Get all provider IDs (for testing/debugging)
     */
    getProviderIds(): string[];

    /**
     * Get tool count (for testing/debugging)
     */
    getToolCount(): { total: number; enabled: number; disabled: number };
}
