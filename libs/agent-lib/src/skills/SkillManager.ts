import { injectable } from 'inversify';
import type { Skill, SkillSummary, SkillActivationResult, SkillManagerOptions, Tool, SkillToolState, ToolComponent } from './types.js';

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

    /** NEW: Track active components from the active skill */
    private activeComponents: Map<string, ToolComponent> = new Map();

    /** NEW: Track added component IDs for activation result */
    private addedComponents: string[] = [];

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

        // Deactivate current skill and its components
        if (this.activeSkill) {
            // Deactivate components first
            for (const component of this.activeComponents.values()) {
                try {
                    await this.activeSkill.onComponentDeactivate?.(component);
                } catch (error) {
                    console.error(`[SkillManager] Error deactivating component "${component.componentId}":`, error);
                }
                try {
                    await component.onDeactivate?.();
                } catch (compError) {
                    console.error(`[SkillManager] Component "${component.componentId}" error during deactivation:`, compError);
                }
            }
            this.activeComponents.clear();

            // Deactivate skill
            try {
                await this.activeSkill.onDeactivate?.();
            } catch (error) {
                console.error(`[SkillManager] Error deactivating skill "${this.activeSkill.name}":`, error);
                throw error
            }
        }

        // Activate new skill
        this.activeSkill = skill;

        // Activate skill's components
        const activatedComponentIds: string[] = [];
        if (skill.components) {
            for (const componentDef of skill.components) {
                let componentInstance: ToolComponent;

                // Check if componentDef.instance is a factory function (sync or async)
                if (typeof componentDef.instance === 'function') {
                    // Call the factory function to get the component instance
                    try {
                        componentInstance = await componentDef.instance();
                    } catch (factoryError) {
                        console.error(`[SkillManager] Error calling factory for component "${componentDef.componentId}":`, factoryError);
                        continue; // Skip this component if factory fails
                    }

                    // Extract tools from the component's toolSet and add to skill's tools
                    if (componentInstance && 'toolSet' in componentInstance) {
                        const toolSet = componentInstance.toolSet as Map<string, Tool>;
                        const existingTools = skill.tools ?? [];
                        const newTools = Array.from(toolSet.values());
                        skill.tools = [...existingTools, ...newTools];
                    }
                } else {
                    // Already an instance, use it directly
                    componentInstance = componentDef.instance;
                }

                // Store the actual component instance
                this.activeComponents.set(componentDef.componentId, componentInstance);
                activatedComponentIds.push(componentDef.componentId);

                try {
                    await skill.onComponentActivate?.(componentInstance);
                } catch (error) {
                    console.error(`[SkillManager] Error in skill's onComponentActivate for "${componentDef.componentId}":`, error);
                }

                try {
                    await componentInstance.onActivate?.();
                } catch (compError) {
                    console.error(`[SkillManager] Component "${componentDef.componentId}" error during activation:`, compError);
                }
            }
        }

        // Call skill's onActivate
        try {
            await skill.onActivate?.();
        } catch (error) {
            console.error(`[SkillManager] Error activating skill "${skill.name}":`, error);
            throw error
            // Still consider it activated, but log the error
        }

        // Notify listeners
        this.onSkillChange?.(skill);

        const addedComponents = activatedComponentIds.length > 0 ? activatedComponentIds : undefined;

        return {
            success: true,
            message: `Skill "${skill.displayName}" activated successfully. ${skill.prompt.direction.split('\n')[0]}`,
            skill,
            addedComponents
        };
    }

    /**
     * Deactivate current skill and all its components
     */
    async deactivateSkill(): Promise<{ success: boolean; message: string }> {
        if (!this.activeSkill) {
            return {
                success: true,
                message: 'No skill is currently active.'
            };
        }

        const skillName = this.activeSkill.displayName;

        // Deactivate all components first
        for (const component of this.activeComponents.values()) {
            try {
                await this.activeSkill.onComponentDeactivate?.(component);
            } catch (error) {
                console.error(`[SkillManager] Error in onComponentDeactivate for "${component.componentId}":`, error);
            }
            try {
                await component.onDeactivate?.();
            } catch (compError) {
                console.error(`[SkillManager] Component "${component.componentId}" error during deactivation:`, compError);
            }
        }
        this.activeComponents.clear();

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

    // ==================== NEW: Component Management ====================

    /**
     * Get active components from the currently active skill
     * @returns Array of active ToolComponent instances
     */
    getActiveComponents(): ToolComponent[] {
        return Array.from(this.activeComponents.values());
    }

    /**
     * Get a specific component from the active skill by ID
     * @param componentId - The component ID to look up
     * @returns ToolComponent or undefined
     */
    getComponent(componentId: string): ToolComponent | undefined {
        return this.activeComponents.get(componentId);
    }

    /**
     * Get the number of active components
     * @returns Number of active components
     */
    getActiveComponentCount(): number {
        return this.activeComponents.size;
    }

    /**
     * Check if a component is active
     * @param componentId - The component ID to check
     * @returns true if component is active
     */
    isComponentActive(componentId: string): boolean {
        return this.activeComponents.has(componentId);
    }
}
