import { injectable, inject, optional } from 'inversify';
import type { Tool } from '../../statefulContext/types.js';
import type { IToolProvider } from '../IToolProvider.js';
import { ToolSource, BaseToolProvider } from '../IToolProvider.js';

// Import global tools
import {
    attempt_completion,
} from '../../statefulContext/globalTools.js';

/**
 * Global tool provider
 *
 * Provides always-available global tools:
 * - attempt_completion
 *
 * Note: Skill-related tools (get_skill, list_skills, deactivate_skill) have been
 * removed as part of the VirtualWorkspace refactoring. Components are now
 * registered directly without requiring skill activation.
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
     */
    async executeTool(name: string, params: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Global tool not found: ${name}`);
        }

        // Execute the appropriate global tool
        switch (name) {
            case 'attempt_completion':
                return this.handleAttemptCompletion(params);
            default:
                throw new Error(`Unknown global tool: ${name}`);
        }
    }

    /**
     * Handle attempt_completion tool call
     */
    private handleAttemptCompletion(params: any): { success: boolean; completed: boolean; result: string } {
        const result = typeof params?.result === 'string' ? params.result : '';
        return {
            success: true,
            completed: true,
            result
        };
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
