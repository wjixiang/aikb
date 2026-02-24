import { injectable } from 'inversify';
import type { Tool } from '../../statefulContext/types.js';
import type { IToolProvider } from '../IToolProvider.js';
import { ToolSource, BaseToolProvider } from '../IToolProvider.js';

// Import global tools
import {
    attempt_completion,
    get_skill,
    list_skills,
    deactivate_skill,
} from '../../statefulContext/globalTools.js';

/**
 * Global tool provider
 * 
 * Provides always-available global tools:
 * - attempt_completion
 * - get_skill
 * - list_skills
 * - deactivate_skill
 */
@injectable()
export class GlobalToolProvider extends BaseToolProvider implements IToolProvider {
    readonly id = 'global-tools';
    readonly priority = 100; // Highest priority for global tools

    private tools: Map<string, Tool>;

    constructor() {
        super();
        this.tools = new Map();
        this.initializeTools();
    }

    /**
     * Initialize global tools
     */
    private initializeTools(): void {
        const globalTools: Tool[] = [
            attempt_completion,
            get_skill,
            list_skills,
            deactivate_skill,
        ];

        for (const tool of globalTools) {
            this.tools.set(tool.toolName, tool);
        }
    }

    /**
     * Get all global tools
     */
    getTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Get a specific global tool by name
     */
    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    /**
     * Execute a global tool
     * 
     * Note: Global tools have special handling and should be executed
     * through the VirtualWorkspace which has access to the necessary
     * context (SkillManager, etc.)
     */
    async executeTool(name: string, params: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Global tool not found: ${name}`);
        }

        // Global tools need special handling - they should be executed
        // by the VirtualWorkspace which has the necessary context
        // This is a placeholder that indicates the tool should be handled specially
        throw new Error(
            `Global tool "${name}" should be executed through VirtualWorkspace.handleGlobalToolCall()`
        );
    }

    /**
     * Check if a tool is a global tool
     */
    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Get all global tool names
     */
    getToolNames(): string[] {
        return Array.from(this.tools.keys());
    }
}
