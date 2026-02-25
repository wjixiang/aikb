import type { Tool } from '../statefulContext/types.js';
import type { ToolSource } from './IToolProvider.js';
import type { IToolProvider } from './IToolProvider.js';
import type { Skill } from '../skills/types.js';
import type { IToolStateStrategy, IToolStateStrategyFactory } from './state/IToolStateStrategy.js';

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
    /** Whether the tool is currently enabled/available */
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
 * The ToolManager is responsible for:
 * - Registering/unregistering tool providers
 * - Maintaining a registry of all tools
 * - Managing tool enabled/disabled state
 * - Managing tool state strategies (skill-based tool control)
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
     * Get available (enabled) tools
     * @returns Array of enabled tool definitions
     */
    getAvailableTools(): Tool[];

    /**
     * Execute a tool call
     * @param name - The tool name to execute
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to the tool result
     */
    executeTool(name: string, params: any): Promise<any>;

    /**
     * Enable a tool
     * @param name - The tool name to enable
     * @returns true if tool was found and enabled
     */
    enableTool(name: string): boolean;

    /**
     * Disable a tool
     * @param name - The tool name to disable
     * @returns true if tool was found and disabled
     */
    disableTool(name: string): boolean;

    /**
     * Check if a tool is enabled
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

    // ==================== Strategy Management (merged from ToolStateManager) ====================

    /**
     * Get the current state strategy
     * @returns The current tool state strategy
     */
    getCurrentStrategy(): IToolStateStrategy;

    /**
     * Set strategy based on active skill
     * This method replaces the separate ToolStateManager.setStrategy()
     * @param skill - The active skill (null for no skill)
     */
    setStrategy(skill: Skill | null): void;

    /**
     * Apply current strategy to enable/disable tools
     * This method replaces the separate ToolStateManager.applyStrategy()
     *
     * This enables/disables component tools based on the strategy.
     * Global tools are always left enabled.
     */
    applyStrategy(): void;

    /**
     * Get the current strategy name (for debugging)
     * @returns The name of the current strategy
     */
    getStrategyName(): string;

    /**
     * Set a custom strategy factory (for testing or advanced use cases)
     * @param factory - The custom strategy factory to use
     */
    setStrategyFactory(factory: IToolStateStrategyFactory): void;
}

/**
 * Tool execution errors
 */
export class ToolNotFoundError extends Error {
    constructor(toolName: string) {
        super(`Tool not found: ${toolName}`);
        this.name = 'ToolNotFoundError';
    }
}

export class ToolDisabledError extends Error {
    constructor(toolName: string) {
        super(`Tool is disabled: ${toolName}`);
        this.name = 'ToolDisabledError';
    }
}

export class ProviderNotFoundError extends Error {
    constructor(providerId: string) {
        super(`Provider not found: ${providerId}`);
        this.name = 'ProviderNotFoundError';
    }
}
