import { injectable } from 'inversify';
import type { Skill, SkillSummary, SkillActivationResult, SkillManagerOptions, Tool, SkillToolState } from './types.js';

/**
 * SkillManager - manages skill registration, activation, and lifecycle
 *
 * Allows LLM to dynamically select skills to optimize prompts and tools
 * for specific tasks.
 */
@injectable()
export class SkillManager {
    private registry = new Map<string, Skill>();
    private activeSkill: Skill | null = null;
    private onSkillChange?: ((skill: Skill | null) => void) | undefined;

    constructor(options?: SkillManagerOptions) {
        this.onSkillChange = options?.onSkillChange ?? undefined;
    }

    /**
     * Register a skill
     */
    register(skill: Skill): void {
        if (this.registry.has(skill.name)) {
            console.warn(`[SkillManager] Skill "${skill.name}" already registered, overwriting`);
        }
        this.registry.set(skill.name, skill);
    }

    /**
     * Register multiple skills
     */
    registerAll(skills: Skill[]): void {
        skills.forEach(s => this.register(s));
    }

    /**
     * Unregister a skill
     */
    unregister(skillName: string): boolean {
        // Cannot unregister active skill
        if (this.activeSkill?.name === skillName) {
            console.warn(`[SkillManager] Cannot unregister active skill "${skillName}"`);
            return false;
        }
        return this.registry.delete(skillName);
    }

    /**
     * Get a skill by name
     */
    get(skillName: string): Skill | undefined {
        return this.registry.get(skillName);
    }

    /**
     * Check if a skill exists
     */
    has(skillName: string): boolean {
        return this.registry.has(skillName);
    }

    /**
     * Get all registered skill names
     */
    getSkillNames(): string[] {
        return Array.from(this.registry.keys());
    }

    /**
     * Get all skill summaries (for LLM selection)
     */
    getAvailableSkills(): SkillSummary[] {
        return Array.from(this.registry.values()).map(s => ({
            name: s.name,
            displayName: s.displayName,
            description: s.description,
            whenToUse: s.whenToUse,
            triggers: s.triggers ?? undefined
        }));
    }

    /**
     * Activate a skill by name
     */
    async activateSkill(skillName: string): Promise<SkillActivationResult> {
        const skill = this.registry.get(skillName);

        if (!skill) {
            const available = this.getSkillNames();
            return {
                success: false,
                message: `Skill "${skillName}" not found. Available skills: ${available.length > 0 ? available.join(', ') : 'none'}`
            };
        }

        // If same skill is already active, return success
        if (this.activeSkill?.name === skillName) {
            return {
                success: true,
                message: `Skill "${skill.displayName}" is already active.`,
                skill
            };
        }

        // Deactivate current skill
        if (this.activeSkill) {
            try {
                await this.activeSkill.onDeactivate?.();
            } catch (error) {
                console.error(`[SkillManager] Error deactivating skill "${this.activeSkill.name}":`, error);
                throw error
            }
        }

        // Activate new skill
        this.activeSkill = skill;

        try {
            await skill.onActivate?.();
        } catch (error) {
            console.error(`[SkillManager] Error activating skill "${skill.name}":`, error);
            throw error
            // Still consider it activated, but log the error
        }

        // Notify listeners
        this.onSkillChange?.(skill);

        const addedTools = skill.tools?.map((t: Tool) => t.toolName) ?? [];

        return {
            success: true,
            message: `Skill "${skill.displayName}" activated successfully. ${skill.prompt.direction.split('\n')[0]}`,
            skill,
            addedTools: addedTools.length > 0 ? addedTools : undefined
        };
    }

    /**
     * Deactivate current skill
     */
    async deactivateSkill(): Promise<{ success: boolean; message: string }> {
        if (!this.activeSkill) {
            return {
                success: true,
                message: 'No skill is currently active.'
            };
        }

        const skillName = this.activeSkill.displayName;

        try {
            await this.activeSkill.onDeactivate?.();
        } catch (error) {
            console.error(`[SkillManager] Error deactivating skill "${this.activeSkill.name}":`, error);
        }

        this.activeSkill = null;
        this.onSkillChange?.(null);

        return {
            success: true,
            message: `Skill "${skillName}" deactivated.`
        };
    }

    /**
     * Get currently active skill
     */
    getActiveSkill(): Skill | null {
        return this.activeSkill;
    }

    /**
     * Get active skill's prompt enhancement
     */
    getActivePrompt(): { capability: string; direction: string } | null {
        return this.activeSkill?.prompt ?? null;
    }

    /**
     * Get active skill's tools
     */
    getActiveTools(): Tool[] {
        return this.activeSkill?.tools ?? [];
    }

    /**
     * Check if any skill is active
     */
    hasActiveSkill(): boolean {
        return this.activeSkill !== null;
    }

    /**
     * Get skill count
     */
    get size(): number {
        return this.registry.size;
    }

    /**
     * Clear all registered skills (deactivates current skill first)
     */
    async clear(): Promise<void> {
        await this.deactivateSkill();
        this.registry.clear();
    }

    /**
     * Find skills matching a query (for smart skill suggestion)
     */
    findMatchingSkills(query: string): SkillSummary[] {
        const lowerQuery = query.toLowerCase();

        return this.getAvailableSkills().filter(skill => {
            // Check name
            if (skill.name.toLowerCase().includes(lowerQuery)) return true;

            // Check display name
            if (skill.displayName.toLowerCase().includes(lowerQuery)) return true;

            // Check description
            if (skill.description.toLowerCase().includes(lowerQuery)) return true;

            // Check triggers
            if (skill.triggers?.some((t: string) => t.toLowerCase().includes(lowerQuery))) return true;

            return false;
        });
    }

    /**
     * Get tools from the currently active skill
     */
    getActiveSkillTools(): Tool[] {
        return this.activeSkill?.tools ?? [];
    }

    /**
     * Get tool names from the currently active skill
     */
    getActiveSkillToolNames(): string[] {
        return this.activeSkill?.tools?.map(t => t.toolName) ?? [];
    }

    /**
     * Check if a tool name belongs to the active skill
     */
    isToolFromActiveSkill(toolName: string): boolean {
        return this.getActiveSkillToolNames().includes(toolName);
    }

    /**
     * Get tool state for all skills
     */
    getAllSkillToolStates(): SkillToolState[] {
        return Array.from(this.registry.values()).map(skill => ({
            skillName: skill.name,
            tools: skill.tools ?? [],
            active: this.activeSkill?.name === skill.name,
            addedToolNames: skill.tools?.map(t => t.toolName) ?? []
        }));
    }
}
