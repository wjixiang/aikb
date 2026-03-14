import { Tool } from '../statefulContext/index.js';

/**
 * Interface for providing tools to API clients
 *
 * This interface abstracts the tool provision capability, allowing different
 * implementations (VirtualWorkspace, database, remote service, etc.) to provide
 * tools to API clients without tight coupling.
 *
 * @example
 * ```typescript
 * class VirtualWorkspace implements ToolProvider {
 *     getTools(): Tool[] {
 *         return Array.from(this.toolSet.values()).map(t => t.tool);
 *     }
 * }
 * ```
 */
export interface ToolProvider {
    /**
     * Get all available tools in their native format
     * @returns Array of tool definitions
     */
    getTools(): Tool[];

    /**
     * Get tools in OpenAI-compatible format
     * This method should convert tools to the format expected by OpenAI API
     * @returns Array of OpenAI-compatible tool definitions
     */
    getToolsForOpenAI(): any[];

    /**
     * Optional: Get a specific tool by name for validation
     * @param name - The name of the tool to retrieve
     * @returns The tool definition or undefined if not found
     */
    getTool?(name: string): Tool | undefined;

    /**
     * Optional: Check if a tool exists
     * @param name - The name of the tool to check
     * @returns True if the tool exists, false otherwise
     */
    hasTool?(name: string): boolean;
}

/**
 * Empty tool provider implementation for testing or when no tools are needed
 */
export class EmptyToolProvider implements ToolProvider {
    getTools(): Tool[] {
        return [];
    }

    getToolsForOpenAI(): any[] {
        return [];
    }

    getTool(name: string): Tool | undefined {
        return undefined;
    }

    hasTool(name: string): boolean {
        return false;
    }
}

/**
 * Static tool provider that wraps a fixed set of tools
 */
export class StaticToolProvider implements ToolProvider {
    private tools: Map<string, Tool>;

    constructor(tools: Tool[]) {
        this.tools = new Map(tools.map(tool => [tool.toolName, tool]));
    }

    getTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    getToolsForOpenAI(): any[] {
        // Import converter dynamically to avoid circular dependency
        const { DefaultToolCallConverter } = require('./ToolCallConvert');
        const converter = new DefaultToolCallConverter();
        return converter.convertTools(this.getTools());
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    hasTool(name: string): boolean {
        return this.tools.has(name);
    }
}
