import type { Tool } from '../statefulContext/types.js';

/**
 * Tool provider interface - abstracts the source of tools
 * 
 * Providers are responsible for:
 * - Providing tool definitions
 * - Executing tool calls
 * - Managing tool lifecycle (optional)
 */
export interface IToolProvider {
    /**
     * Unique identifier for this provider
     * Used for registration and lookup
     */
    readonly id: string;

    /**
     * Get all tools provided by this provider
     * Can be synchronous or asynchronous depending on the provider
     */
    getTools(): Promise<Tool[]> | Tool[];

    /**
     * Get a specific tool by name
     * @param name - The tool name to look up
     * @returns The tool definition or undefined if not found
     */
    getTool(name: string): Promise<Tool | undefined> | Tool | undefined;

    /**
     * Execute a tool call
     * @param name - The tool name to execute
     * @param params - The parameters to pass to the tool
     * @returns Promise resolving to the tool result
     */
    executeTool(name: string, params: any): Promise<any>;

    /**
     * Provider priority (higher = checked first for tool resolution)
     * Default priority is 0
     */
    readonly priority: number;
}

/**
 * Base class for tool providers with common functionality
 */
export abstract class BaseToolProvider implements IToolProvider {
    abstract readonly id: string;
    abstract readonly priority: number;

    abstract getTools(): Promise<Tool[]> | Tool[];
    abstract getTool(name: string): Promise<Tool | undefined> | Tool | undefined;
    abstract executeTool(name: string, params: any): Promise<any>;

    /**
     * Helper method to infer tool source from provider id
     */
    protected inferSource(): ToolSource {
        if (this.id.includes('global')) return ToolSource.GLOBAL;
        if (this.id.includes('component')) return ToolSource.COMPONENT;
        return ToolSource.UNKNOWN;
    }
}

/**
 * Tool source enumeration
 * - GLOBAL: Always available (system-level tools)
 * - COMPONENT: Available only when skill is active (tools from Component)
 * - UNKNOWN: Source cannot be determined
 */
export enum ToolSource {
    /** Global tool (always available) */
    GLOBAL = 'global',
    /** Component tool (available only when skill is active) */
    COMPONENT = 'component',
    /** Unknown source */
    UNKNOWN = 'unknown'
}
