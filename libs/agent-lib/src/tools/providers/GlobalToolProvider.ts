import { injectable, inject, optional } from 'inversify';
import type { Tool } from '../../statefulContext/types.js';
import type { IToolProvider } from '../IToolProvider.js';
import { ToolSource, BaseToolProvider } from '../IToolProvider.js';
import type { SkillManager } from '../../skills/index.js';
import { TYPES } from '../../di/types.js';

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

    constructor(
        @inject(TYPES.SkillManager) @optional() private skillManager?: SkillManager
    ) {
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
            case 'get_skill':
                return await this.handleGetSkill(params);
            case 'list_skills':
                return this.handleListSkills();
            case 'deactivate_skill':
                return await this.handleDeactivateSkill();
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
     * Handle get_skill tool call
     */
    private async handleGetSkill(params: any): Promise<any> {
        if (!this.skillManager) {
            throw new Error('SkillManager not available for get_skill operation');
        }
        const skillName = typeof params?.skill_name === 'string' ? params.skill_name : '';
        return await this.skillManager.activateSkill(skillName);
    }

    /**
     * Handle list_skills tool call
     */
    private handleListSkills(): { skills: any[]; activeSkill: string | null } {
        if (!this.skillManager) {
            throw new Error('SkillManager not available for list_skills operation');
        }
        const skills = this.skillManager.getAvailableSkills();
        const activeSkill = this.skillManager.getActiveSkill();
        return {
            skills,
            activeSkill: activeSkill?.name ?? null
        };
    }

    /**
     * Handle deactivate_skill tool call
     */
    private async handleDeactivateSkill(): Promise<{ success: boolean; message: string }> {
        if (!this.skillManager) {
            throw new Error('SkillManager not available for deactivate_skill operation');
        }
        return await this.skillManager.deactivateSkill();
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
